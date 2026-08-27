use crate::control::models::{
    ActionExecutionStatus, ActionResult, EventPage, EventQuery, WorkstationEvent,
};
use rusqlite::{params, Connection, OptionalExtension};
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

const SCHEMA_VERSION: i64 = 1;

#[derive(Debug)]
pub enum RepositoryError {
    Database(rusqlite::Error),
    Serialization(serde_json::Error),
    InvalidCursor,
    LockPoisoned,
    Io(std::io::Error),
}

impl std::fmt::Display for RepositoryError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Database(error) => write!(formatter, "database error: {error}"),
            Self::Serialization(error) => write!(formatter, "serialization error: {error}"),
            Self::InvalidCursor => formatter.write_str("invalid event cursor"),
            Self::LockPoisoned => formatter.write_str("database lock poisoned"),
            Self::Io(error) => write!(formatter, "filesystem error: {error}"),
        }
    }
}

impl std::error::Error for RepositoryError {}

impl From<rusqlite::Error> for RepositoryError {
    fn from(value: rusqlite::Error) -> Self {
        Self::Database(value)
    }
}

impl From<serde_json::Error> for RepositoryError {
    fn from(value: serde_json::Error) -> Self {
        Self::Serialization(value)
    }
}

impl From<std::io::Error> for RepositoryError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value)
    }
}

pub type RepositoryResult<T> = Result<T, RepositoryError>;

pub struct ControlRepository {
    connection: Mutex<Connection>,
}

impl ControlRepository {
    pub fn open(path: impl AsRef<Path>) -> RepositoryResult<Self> {
        let path = path.as_ref();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(parent, std::fs::Permissions::from_mode(0o700))?;
            }
        }
        let connection = Connection::open(path)?;
        Self::from_connection(connection)
    }

    pub fn open_default() -> RepositoryResult<Self> {
        Self::open(default_database_path())
    }

    pub fn open_in_memory() -> RepositoryResult<Self> {
        Self::from_connection(Connection::open_in_memory()?)
    }

    fn from_connection(connection: Connection) -> RepositoryResult<Self> {
        connection.busy_timeout(std::time::Duration::from_secs(5))?;
        connection.execute_batch(
            "PRAGMA foreign_keys = ON;
             CREATE TABLE IF NOT EXISTS schema_migrations (
               version INTEGER PRIMARY KEY,
               applied_at INTEGER NOT NULL
             );",
        )?;
        let current_version: i64 = connection.query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
            [],
            |row| row.get(0),
        )?;
        if current_version < SCHEMA_VERSION {
            connection.execute_batch(
                "BEGIN IMMEDIATE;
                 CREATE TABLE IF NOT EXISTS events (
                   event_id TEXT PRIMARY KEY,
                   device_id TEXT NOT NULL,
                   event_type TEXT NOT NULL,
                   severity TEXT NOT NULL,
                   source TEXT NOT NULL,
                   occurred_at INTEGER NOT NULL,
                   correlation_id TEXT NOT NULL,
                   schema_version INTEGER NOT NULL,
                   payload_json TEXT NOT NULL
                 );
                 CREATE INDEX IF NOT EXISTS events_timeline_idx
                   ON events(occurred_at DESC, event_id DESC);
                 CREATE INDEX IF NOT EXISTS events_filter_idx
                   ON events(device_id, severity, event_type, occurred_at DESC);
                 CREATE TABLE IF NOT EXISTS action_results (
                   request_id TEXT PRIMARY KEY,
                   action_id TEXT NOT NULL,
                   status TEXT NOT NULL,
                   started_at INTEGER NOT NULL,
                   finished_at INTEGER,
                   duration_ms INTEGER,
                   output_summary TEXT,
                   error TEXT,
                   correlation_id TEXT NOT NULL
                 );
                 INSERT OR IGNORE INTO schema_migrations(version, applied_at)
                   VALUES (1, unixepoch('now') * 1000);
                 COMMIT;",
            )?;
        }
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    fn connection(&self) -> RepositoryResult<MutexGuard<'_, Connection>> {
        self.connection
            .lock()
            .map_err(|_| RepositoryError::LockPoisoned)
    }

    pub fn schema_version(&self) -> RepositoryResult<i64> {
        Ok(self.connection()?.query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
            [],
            |row| row.get(0),
        )?)
    }

    pub fn insert_event(&self, event: &WorkstationEvent) -> RepositoryResult<()> {
        self.connection()?.execute(
            "INSERT OR IGNORE INTO events (
               event_id, device_id, event_type, severity, source, occurred_at,
               correlation_id, schema_version, payload_json
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                event.event_id,
                event.device_id,
                enum_value(&event.event_type)?,
                enum_value(&event.severity)?,
                event.source,
                event.occurred_at,
                event.correlation_id,
                event.schema_version,
                serde_json::to_string(&event.payload)?,
            ],
        )?;
        Ok(())
    }

    pub fn list_events(&self, query: EventQuery) -> RepositoryResult<EventPage> {
        let limit = if query.limit == 0 {
            50
        } else {
            query.limit.clamp(1, 200)
        };
        let event_type = query.event_type.as_ref().map(enum_value).transpose()?;
        let severity = query.severity.as_ref().map(enum_value).transpose()?;
        let (before_timestamp, before_id) = parse_cursor(query.before.as_deref())?;
        let connection = self.connection()?;
        let mut statement = connection.prepare(
            "SELECT event_id, device_id, event_type, severity, source, occurred_at,
                    correlation_id, schema_version, payload_json
             FROM events
             WHERE (?1 IS NULL OR device_id = ?1)
               AND (?2 IS NULL OR event_type = ?2)
               AND (?3 IS NULL OR severity = ?3)
               AND (?4 IS NULL OR source = ?4)
               AND (?5 IS NULL OR occurred_at < ?5 OR (occurred_at = ?5 AND event_id < ?6))
             ORDER BY occurred_at DESC, event_id DESC
             LIMIT ?7",
        )?;
        let rows = statement.query_map(
            params![
                query.device_id,
                event_type,
                severity,
                query.source,
                before_timestamp,
                before_id,
                i64::try_from(limit).unwrap_or(200),
            ],
            |row| {
                let event_type: String = row.get(2)?;
                let severity: String = row.get(3)?;
                let payload: String = row.get(8)?;
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    event_type,
                    severity,
                    row.get::<_, String>(4)?,
                    row.get::<_, i64>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, u16>(7)?,
                    payload,
                ))
            },
        )?;
        let mut items = Vec::new();
        for row in rows {
            let (
                event_id,
                device_id,
                event_type,
                severity,
                source,
                occurred_at,
                correlation_id,
                schema_version,
                payload,
            ) = row?;
            items.push(WorkstationEvent {
                event_id,
                device_id,
                event_type: parse_enum(&event_type)?,
                severity: parse_enum(&severity)?,
                source,
                occurred_at,
                correlation_id,
                schema_version,
                payload: serde_json::from_str(&payload)?,
            });
        }
        let next_cursor = if items.len() == limit {
            items
                .last()
                .map(|event| format!("{}:{}", event.occurred_at, event.event_id))
        } else {
            None
        };
        Ok(EventPage {
            items,
            next_cursor,
            storage_degraded: false,
        })
    }

    pub fn upsert_action_result(&self, result: &ActionResult) -> RepositoryResult<()> {
        self.connection()?.execute(
            "INSERT OR IGNORE INTO action_results (
               request_id, action_id, status, started_at, finished_at, duration_ms,
               output_summary, error, correlation_id
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                result.request_id,
                result.action_id,
                enum_value(&result.status)?,
                result.started_at,
                result.finished_at,
                result
                    .duration_ms
                    .and_then(|value| i64::try_from(value).ok()),
                result.output_summary,
                result.error,
                result.correlation_id,
            ],
        )?;
        Ok(())
    }

    pub fn get_action_result(&self, request_id: &str) -> RepositoryResult<Option<ActionResult>> {
        let row = self
            .connection()?
            .query_row(
                "SELECT request_id, action_id, status, started_at, finished_at, duration_ms,
                        output_summary, error, correlation_id
                 FROM action_results WHERE request_id = ?1",
                [request_id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, i64>(3)?,
                        row.get::<_, Option<i64>>(4)?,
                        row.get::<_, Option<i64>>(5)?,
                        row.get::<_, Option<String>>(6)?,
                        row.get::<_, Option<String>>(7)?,
                        row.get::<_, String>(8)?,
                    ))
                },
            )
            .optional()?;
        row.map(
            |(
                request_id,
                action_id,
                status,
                started_at,
                finished_at,
                duration_ms,
                output_summary,
                error,
                correlation_id,
            )| {
                Ok(ActionResult {
                    request_id,
                    action_id,
                    status: parse_enum::<ActionExecutionStatus>(&status)?,
                    started_at,
                    finished_at,
                    duration_ms: duration_ms.and_then(|value| u64::try_from(value).ok()),
                    output_summary,
                    error,
                    correlation_id,
                })
            },
        )
        .transpose()
    }

    pub fn count_action_results(&self) -> RepositoryResult<usize> {
        let count: i64 =
            self.connection()?
                .query_row("SELECT COUNT(*) FROM action_results", [], |row| row.get(0))?;
        Ok(usize::try_from(count).unwrap_or(usize::MAX))
    }

    pub fn prune_events(&self, before_timestamp: i64) -> RepositoryResult<usize> {
        Ok(self.connection()?.execute(
            "DELETE FROM events WHERE occurred_at < ?1",
            [before_timestamp],
        )?)
    }
}

pub fn default_database_path() -> PathBuf {
    if let Some(path) = std::env::var_os("WORKSTATION_DATA_DIR") {
        return PathBuf::from(path).join("vibedesk.db");
    }
    let home = std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));
    home.join("Library/Application Support/VibeDesk/vibedesk.db")
}

fn enum_value<T: Serialize>(value: &T) -> RepositoryResult<String> {
    serde_json::to_value(value)?
        .as_str()
        .map(ToOwned::to_owned)
        .ok_or_else(|| {
            RepositoryError::Serialization(serde_json::Error::io(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "enum did not serialize to a string",
            )))
        })
}

fn parse_enum<T: DeserializeOwned>(value: &str) -> RepositoryResult<T> {
    Ok(serde_json::from_value(serde_json::Value::String(
        value.to_string(),
    ))?)
}

fn parse_cursor(cursor: Option<&str>) -> RepositoryResult<(Option<i64>, Option<String>)> {
    let Some(cursor) = cursor else {
        return Ok((None, None));
    };
    let (timestamp, event_id) = cursor
        .split_once(':')
        .ok_or(RepositoryError::InvalidCursor)?;
    let timestamp = timestamp
        .parse::<i64>()
        .map_err(|_| RepositoryError::InvalidCursor)?;
    if event_id.is_empty() {
        return Err(RepositoryError::InvalidCursor);
    }
    Ok((Some(timestamp), Some(event_id.to_string())))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::control::models::{
        ActionExecutionStatus, ActionResult, EventKind, EventQuery, EventSeverity,
        WorkstationEvent, EVENT_SCHEMA_VERSION,
    };

    fn event_at(id: &str, occurred_at: i64) -> WorkstationEvent {
        WorkstationEvent {
            event_id: id.to_string(),
            device_id: "local".to_string(),
            event_type: EventKind::ServiceStarted,
            severity: EventSeverity::Info,
            source: "test".to_string(),
            occurred_at,
            correlation_id: format!("correlation-{id}"),
            schema_version: EVENT_SCHEMA_VERSION,
            payload: serde_json::json!({"id": id}),
        }
    }

    fn succeeded_result(request_id: &str) -> ActionResult {
        ActionResult {
            request_id: request_id.to_string(),
            action_id: "snapshot.create".to_string(),
            status: ActionExecutionStatus::Succeeded,
            started_at: 10,
            finished_at: Some(20),
            duration_ms: Some(10),
            output_summary: Some("created".to_string()),
            error: None,
            correlation_id: "correlation-1".to_string(),
        }
    }

    #[test]
    fn migration_creates_schema_version_one() {
        let repository = ControlRepository::open_in_memory().unwrap();
        assert_eq!(repository.schema_version().unwrap(), 1);
    }

    #[test]
    fn events_are_returned_newest_first_with_a_stable_cursor() {
        let repository = ControlRepository::open_in_memory().unwrap();
        repository.insert_event(&event_at("older", 10)).unwrap();
        repository.insert_event(&event_at("newer", 20)).unwrap();

        let first = repository
            .list_events(EventQuery {
                limit: 1,
                ..Default::default()
            })
            .unwrap();
        assert_eq!(first.items[0].event_id, "newer");
        assert_eq!(first.next_cursor.as_deref(), Some("20:newer"));

        let second = repository
            .list_events(EventQuery {
                limit: 1,
                before: first.next_cursor,
                ..Default::default()
            })
            .unwrap();
        assert_eq!(second.items[0].event_id, "older");
    }

    #[test]
    fn event_filters_compose() {
        let repository = ControlRepository::open_in_memory().unwrap();
        let mut event = event_at("matching", 20);
        event.severity = EventSeverity::Warning;
        event.source = "actions".to_string();
        repository.insert_event(&event).unwrap();
        repository.insert_event(&event_at("other", 10)).unwrap();

        let page = repository
            .list_events(EventQuery {
                severity: Some(EventSeverity::Warning),
                source: Some("actions".to_string()),
                limit: 20,
                ..Default::default()
            })
            .unwrap();
        assert_eq!(page.items.len(), 1);
        assert_eq!(page.items[0].event_id, "matching");
    }

    #[test]
    fn duplicate_action_results_do_not_create_duplicate_audit_rows() {
        let repository = ControlRepository::open_in_memory().unwrap();
        let result = succeeded_result("request-1");
        repository.upsert_action_result(&result).unwrap();
        repository.upsert_action_result(&result).unwrap();
        assert_eq!(repository.count_action_results().unwrap(), 1);
        assert_eq!(
            repository.get_action_result("request-1").unwrap().unwrap(),
            result
        );
    }

    #[test]
    fn retention_prunes_only_events_before_cutoff() {
        let repository = ControlRepository::open_in_memory().unwrap();
        repository.insert_event(&event_at("expired", 10)).unwrap();
        repository.insert_event(&event_at("retained", 20)).unwrap();

        assert_eq!(repository.prune_events(20).unwrap(), 1);
        let page = repository.list_events(EventQuery::default()).unwrap();
        assert_eq!(page.items.len(), 1);
        assert_eq!(page.items[0].event_id, "retained");
    }
}
