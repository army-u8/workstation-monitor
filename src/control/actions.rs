use crate::collectors::{kill_process, kill_process_by_port, SavePointManager, SystemCleaner};
use crate::control::event_hub::EventHub;
use crate::control::models::{
    ActionDefinition, ActionExecutionStatus, ActionParameterDefinition, ActionParameterType,
    ActionRequest, ActionResult, ActionRisk, EventKind, EventQuery, EventSeverity,
    ExecuteActionResponse, WorkstationEvent,
};
use crate::control::policy::{PolicyDecision, PolicyEngine};
use crate::control::repository::{ActionClaim, ActionClaimOutcome, ControlRepository};
use crate::types::WsEvent;
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::process::Command;
use std::sync::Arc;
use tokio::sync::{broadcast, Mutex};

pub trait ActionExecutor: Send + Sync {
    fn execute(&self, action_id: &str, parameters: &Value) -> Result<Value, String>;
}

pub struct BuiltInActionExecutor;

impl ActionExecutor for BuiltInActionExecutor {
    fn execute(&self, action_id: &str, parameters: &Value) -> Result<Value, String> {
        match action_id {
            "app.open" => {
                let params: OpenAppParams = parse_parameters(parameters)?;
                open_app(&params.path, params.app.as_deref())?;
                Ok(json!({"summary": "opened"}))
            }
            "snapshot.create" => {
                let params: SnapshotCreateParams = parse_parameters(parameters)?;
                let result =
                    SavePointManager::create_snapshot(&params.project_path, &params.title)?;
                serde_json::to_value(result).map_err(|error| error.to_string())
            }
            "process.kill" => {
                let params: KillProcessParams = parse_parameters(parameters)?;
                kill_process(params.pid)?;
                Ok(json!({"summary": "process_terminated", "pid": params.pid}))
            }
            "port.kill" => {
                let params: KillPortParams = parse_parameters(parameters)?;
                let pids = kill_process_by_port(params.port)?;
                Ok(json!({"summary": "port_released", "port": params.port, "pids": pids}))
            }
            "cleaner.clean" => {
                let params: CleanerParams = parse_parameters(parameters)?;
                let message = SystemCleaner::clean(&params.id)?;
                Ok(json!({"summary": "cache_cleaned", "message": message}))
            }
            "network.flush_dns" => {
                flush_dns()?;
                Ok(json!({"summary": "dns_flushed"}))
            }
            _ => Err("unknown_action".to_string()),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct OpenAppParams {
    path: String,
    #[serde(default)]
    app: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct SnapshotCreateParams {
    project_path: String,
    #[serde(default)]
    title: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct KillProcessParams {
    pid: u32,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct KillPortParams {
    port: u16,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct CleanerParams {
    id: String,
}

fn parse_parameters<T: for<'de> Deserialize<'de>>(parameters: &Value) -> Result<T, String> {
    serde_json::from_value(parameters.clone())
        .map_err(|error| format!("invalid_parameters: {error}"))
}

fn open_app(path: &str, requested_app: Option<&str>) -> Result<(), String> {
    let path = path.trim();
    if path.is_empty() {
        return Err("path cannot be empty".to_string());
    }
    let app = requested_app.unwrap_or("finder").trim().to_lowercase();
    let result = match app.as_str() {
        "code" | "vscode" => Command::new("open")
            .args(["-a", "Visual Studio Code", path])
            .spawn()
            .or_else(|_| Command::new("code").arg(path).spawn()),
        "cursor" => Command::new("open")
            .args(["-a", "Cursor", path])
            .spawn()
            .or_else(|_| Command::new("cursor").arg(path).spawn()),
        "windsurf" => Command::new("open")
            .args(["-a", "Windsurf", path])
            .spawn()
            .or_else(|_| Command::new("windsurf").arg(path).spawn()),
        "zed" => Command::new("open")
            .args(["-a", "Zed", path])
            .spawn()
            .or_else(|_| Command::new("zed").arg(path).spawn()),
        "terminal" => Command::new("open")
            .args(["-a", "Ghostty", path])
            .spawn()
            .or_else(|_| Command::new("open").args(["-a", "iTerm", path]).spawn())
            .or_else(|_| Command::new("open").args(["-a", "Warp", path]).spawn())
            .or_else(|_| Command::new("open").args(["-a", "Terminal", path]).spawn()),
        "iterm" | "iterm2" => Command::new("open").args(["-a", "iTerm", path]).spawn(),
        "ghostty" => Command::new("open").args(["-a", "Ghostty", path]).spawn(),
        "warp" => Command::new("open").args(["-a", "Warp", path]).spawn(),
        _ => Command::new("open").arg(path).spawn(),
    };
    result.map(|_| ()).map_err(|error| error.to_string())
}

fn flush_dns() -> Result<(), String> {
    let cache = Command::new("dscacheutil").arg("-flushcache").output();
    let responder = Command::new("killall")
        .args(["-HUP", "mDNSResponder"])
        .output();
    dns_flush_result(cache, responder)
}

fn dns_flush_result(
    cache: std::io::Result<std::process::Output>,
    responder: std::io::Result<std::process::Output>,
) -> Result<(), String> {
    if cache.is_ok_and(|output| output.status.success())
        && responder.is_ok_and(|output| output.status.success())
    {
        Ok(())
    } else {
        Err("dns_flush_failed".to_string())
    }
}

#[derive(Debug, Clone)]
pub enum ControlError {
    UnknownAction,
    InvalidParameters(String),
    Conflict(String),
    Forbidden(String),
    Repository(String),
    Execution(String),
}

impl std::fmt::Display for ControlError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UnknownAction => formatter.write_str("unknown action"),
            Self::InvalidParameters(message) => write!(formatter, "invalid parameters: {message}"),
            Self::Conflict(code) => write!(formatter, "action conflict: {code}"),
            Self::Forbidden(code) => write!(formatter, "action forbidden: {code}"),
            Self::Repository(message) => write!(formatter, "repository error: {message}"),
            Self::Execution(message) => write!(formatter, "execution error: {message}"),
        }
    }
}

impl std::error::Error for ControlError {}

#[derive(Clone)]
pub struct ActionRegistry {
    definitions: Vec<ActionDefinition>,
}

impl ActionRegistry {
    pub fn built_in() -> Self {
        let mut definitions = vec![
            definition(
                "app.open",
                ActionRisk::Safe,
                vec![
                    parameter("path", ActionParameterType::String, true),
                    parameter("app", ActionParameterType::String, false),
                ],
                &["open", "editor", "terminal", "finder"],
            ),
            definition(
                "snapshot.create",
                ActionRisk::Safe,
                vec![
                    parameter("project_path", ActionParameterType::String, true),
                    parameter("title", ActionParameterType::String, false),
                ],
                &["git", "save", "checkpoint", "snapshot"],
            ),
            definition(
                "process.kill",
                ActionRisk::ConfirmationRequired,
                vec![parameter("pid", ActionParameterType::Integer, true)],
                &["process", "kill", "stop"],
            ),
            definition(
                "port.kill",
                ActionRisk::ConfirmationRequired,
                vec![parameter("port", ActionParameterType::Integer, true)],
                &["port", "release", "kill"],
            ),
            definition(
                "cleaner.clean",
                ActionRisk::ConfirmationRequired,
                vec![parameter("id", ActionParameterType::String, true)],
                &["cache", "clean", "storage"],
            ),
            definition(
                "network.flush_dns",
                ActionRisk::AdministratorRequired,
                Vec::new(),
                &["dns", "network", "flush"],
            ),
        ];
        if let Some(action) = definitions
            .iter_mut()
            .find(|action| action.id == "network.flush_dns")
        {
            action.available = administrator_access_available();
            action.unavailable_reason =
                (!action.available).then(|| "administrator_required".to_string());
        }
        Self { definitions }
    }

    pub fn catalog(&self) -> &[ActionDefinition] {
        &self.definitions
    }

    pub fn find(&self, action_id: &str) -> Option<&ActionDefinition> {
        self.definitions
            .iter()
            .find(|action| action.id == action_id)
    }

    pub fn validate(
        &self,
        definition: &ActionDefinition,
        parameters: &Value,
    ) -> Result<(), ControlError> {
        let object = parameters
            .as_object()
            .ok_or_else(|| ControlError::InvalidParameters("expected an object".to_string()))?;
        for key in object.keys() {
            if !definition
                .parameters
                .iter()
                .any(|parameter| parameter.name == *key)
            {
                return Err(ControlError::InvalidParameters(format!(
                    "unknown parameter: {key}"
                )));
            }
        }
        for parameter in &definition.parameters {
            let value = object.get(&parameter.name);
            if parameter.required && value.is_none() {
                return Err(ControlError::InvalidParameters(format!(
                    "missing parameter: {}",
                    parameter.name
                )));
            }
            let Some(value) = value else { continue };
            let valid = match parameter.value_type {
                ActionParameterType::String => value.is_string(),
                ActionParameterType::Integer => value.as_u64().is_some(),
                ActionParameterType::Boolean => value.is_boolean(),
                ActionParameterType::StringList => value
                    .as_array()
                    .is_some_and(|values| values.iter().all(Value::is_string)),
            };
            if !valid {
                return Err(ControlError::InvalidParameters(format!(
                    "invalid parameter type: {}",
                    parameter.name
                )));
            }
        }
        Ok(())
    }
}

#[cfg(unix)]
fn administrator_access_available() -> bool {
    unsafe { libc::geteuid() == 0 }
}

#[cfg(not(unix))]
fn administrator_access_available() -> bool {
    false
}

fn parameter(
    name: &str,
    value_type: ActionParameterType,
    required: bool,
) -> ActionParameterDefinition {
    ActionParameterDefinition {
        name: name.to_string(),
        value_type,
        required,
        label_key: format!("control.parameters.{name}"),
    }
}

fn definition(
    id: &str,
    risk: ActionRisk,
    parameters: Vec<ActionParameterDefinition>,
    keywords: &[&str],
) -> ActionDefinition {
    let translation_id = id.replace('.', "_");
    ActionDefinition {
        id: id.to_string(),
        label_key: format!("control.actions.{translation_id}.label"),
        description_key: format!("control.actions.{translation_id}.description"),
        risk,
        parameters,
        keywords: keywords
            .iter()
            .map(|keyword| (*keyword).to_string())
            .collect(),
        available: true,
        unavailable_reason: None,
    }
}

pub struct ControlPlane {
    repository: Arc<ControlRepository>,
    event_hub: EventHub,
    policy: PolicyEngine,
    registry: ActionRegistry,
    executor: Arc<dyn ActionExecutor>,
    execution_lock: Mutex<()>,
}

impl ControlPlane {
    pub fn new(
        repository: Arc<ControlRepository>,
        tx: broadcast::Sender<WsEvent>,
        executor: Arc<dyn ActionExecutor>,
    ) -> Self {
        let event_hub = EventHub::new(repository.clone(), tx);
        Self {
            repository,
            event_hub,
            policy: PolicyEngine::default(),
            registry: ActionRegistry::built_in(),
            executor,
            execution_lock: Mutex::new(()),
        }
    }

    pub fn built_in(repository: Arc<ControlRepository>, tx: broadcast::Sender<WsEvent>) -> Self {
        Self::new(repository, tx, Arc::new(BuiltInActionExecutor))
    }

    pub fn catalog(&self) -> &[ActionDefinition] {
        self.registry.catalog()
    }

    pub fn event_hub(&self) -> &EventHub {
        &self.event_hub
    }

    pub async fn list_events(&self, query: EventQuery) -> crate::control::models::EventPage {
        self.event_hub.list_events(query).await
    }

    pub async fn prune_events(&self, before_timestamp: i64) -> Result<usize, ControlError> {
        let repository = Arc::clone(&self.repository);
        tokio::task::spawn_blocking(move || repository.prune_events(before_timestamp))
            .await
            .map_err(|error| ControlError::Repository(error.to_string()))?
            .map_err(|error| ControlError::Repository(error.to_string()))
    }

    pub async fn get_action_result(
        &self,
        request_id: &str,
    ) -> Result<Option<ActionResult>, ControlError> {
        let repository = Arc::clone(&self.repository);
        let request_id = request_id.to_string();
        tokio::task::spawn_blocking(move || repository.get_action_result(&request_id))
            .await
            .map_err(|error| ControlError::Repository(error.to_string()))?
            .map_err(|error| ControlError::Repository(error.to_string()))
    }

    async fn get_action_claim(
        &self,
        request_id: &str,
    ) -> Result<Option<ActionClaim>, ControlError> {
        let repository = Arc::clone(&self.repository);
        let request_id = request_id.to_string();
        tokio::task::spawn_blocking(move || repository.get_action_claim(&request_id))
            .await
            .map_err(|error| ControlError::Repository(error.to_string()))?
            .map_err(|error| ControlError::Repository(error.to_string()))
    }

    async fn claim_action(
        &self,
        request: &ActionRequest,
        parameters_hash: &str,
    ) -> Result<ActionClaimOutcome, ControlError> {
        let repository = Arc::clone(&self.repository);
        let request_id = request.request_id.clone();
        let action_id = request.action_id.clone();
        let parameters_hash = parameters_hash.to_string();
        let claimed_at = chrono::Utc::now().timestamp_millis();
        tokio::task::spawn_blocking(move || {
            repository.claim_action(&request_id, &action_id, &parameters_hash, claimed_at)
        })
        .await
        .map_err(|error| ControlError::Repository(error.to_string()))?
        .map_err(|error| ControlError::Repository(error.to_string()))
    }

    pub async fn execute(
        &self,
        request: ActionRequest,
    ) -> Result<ExecuteActionResponse, ControlError> {
        self.execute_internal(request, false).await
    }

    pub(crate) async fn execute_trusted_local(
        &self,
        request: ActionRequest,
    ) -> Result<ExecuteActionResponse, ControlError> {
        self.execute_internal(request, true).await
    }

    async fn execute_internal(
        &self,
        request: ActionRequest,
        trusted_local_confirmation: bool,
    ) -> Result<ExecuteActionResponse, ControlError> {
        if request.request_id.trim().is_empty() || request.action_id.trim().is_empty() {
            return Err(ControlError::InvalidParameters(
                "request_id and action_id are required".to_string(),
            ));
        }
        if request
            .target_device
            .as_deref()
            .is_some_and(|target| target != "local")
        {
            return Err(ControlError::InvalidParameters(
                "remote targets are not enabled".to_string(),
            ));
        }
        let parameters_hash = parameters_hash(&request.parameters);

        let _execution_guard = self.execution_lock.lock().await;
        if let Some(claim) = self.get_action_claim(&request.request_id).await? {
            if claim.action_id != request.action_id || claim.parameters_hash != parameters_hash {
                return Err(ControlError::Conflict(
                    "request_id_binding_mismatch".to_string(),
                ));
            }
            if let Some(result) = self.get_action_result(&request.request_id).await? {
                return Ok(completed_response(result));
            }
            return Ok(indeterminate_response());
        }
        if let Some(result) = self.get_action_result(&request.request_id).await? {
            if result.action_id != request.action_id {
                return Err(ControlError::Conflict(
                    "request_id_binding_mismatch".to_string(),
                ));
            }
            return Ok(completed_response(result));
        }

        let definition = self
            .registry
            .find(&request.action_id)
            .cloned()
            .ok_or(ControlError::UnknownAction)?;
        if !definition.available {
            return Err(ControlError::Forbidden(
                definition
                    .unavailable_reason
                    .unwrap_or_else(|| "action_unavailable".to_string()),
            ));
        }
        self.registry.validate(&definition, &request.parameters)?;

        if !trusted_local_confirmation {
            match self
                .policy
                .authorize(
                    &request.request_id,
                    &request.action_id,
                    &request.parameters,
                    definition.risk.clone(),
                    request.confirmation_token.as_deref(),
                )
                .await
            {
                PolicyDecision::ConfirmationRequired(challenge) => {
                    self.publish_action_event(
                        &request,
                        EventKind::ActionConfirmationRequired,
                        EventSeverity::Warning,
                        json!({"risk": definition.risk}),
                    )
                    .await;
                    return Ok(ExecuteActionResponse {
                        status: ActionExecutionStatus::ConfirmationRequired,
                        confirmation: Some(challenge),
                        result: None,
                        output: None,
                        error_code: None,
                    });
                }
                PolicyDecision::Denied(denial) => {
                    return Err(ControlError::Forbidden(denial.code().to_string()))
                }
                PolicyDecision::Allowed => {}
            }
        }

        match self.claim_action(&request, &parameters_hash).await? {
            ActionClaimOutcome::Acquired => {}
            ActionClaimOutcome::Conflict => {
                return Err(ControlError::Conflict(
                    "request_id_binding_mismatch".to_string(),
                ))
            }
            ActionClaimOutcome::Existing => {
                if let Some(result) = self.get_action_result(&request.request_id).await? {
                    return Ok(completed_response(result));
                }
                return Ok(indeterminate_response());
            }
        }

        self.publish_action_event(
            &request,
            EventKind::ActionRequested,
            EventSeverity::Info,
            json!({"risk": definition.risk, "origin": request.origin}),
        )
        .await;

        let started_at = chrono::Utc::now().timestamp_millis();
        let executor = Arc::clone(&self.executor);
        let action_id = request.action_id.clone();
        let parameters = request.parameters.clone();
        let execution =
            tokio::task::spawn_blocking(move || executor.execute(&action_id, &parameters))
                .await
                .map_err(|error| ControlError::Execution(error.to_string()))?;
        let finished_at = chrono::Utc::now().timestamp_millis();
        let duration_ms = u64::try_from(finished_at.saturating_sub(started_at)).unwrap_or_default();
        let (status, output, output_summary, error) = match execution {
            Ok(output) => (
                ActionExecutionStatus::Succeeded,
                Some(output.clone()),
                Some(output_summary(&output)),
                None,
            ),
            Err(error) => (
                ActionExecutionStatus::Failed,
                None,
                None,
                Some(sanitize_text(&error)),
            ),
        };
        let result = ActionResult {
            request_id: request.request_id.clone(),
            action_id: request.action_id.clone(),
            status: status.clone(),
            started_at,
            finished_at: Some(finished_at),
            duration_ms: Some(duration_ms),
            output_summary,
            error,
            correlation_id: request.request_id.clone(),
        };
        let repository = Arc::clone(&self.repository);
        let persisted_result = result.clone();
        tokio::task::spawn_blocking(move || repository.upsert_action_result(&persisted_result))
            .await
            .map_err(|error| ControlError::Repository(error.to_string()))?
            .map_err(|error| ControlError::Repository(error.to_string()))?;

        let (event_kind, severity) = if status == ActionExecutionStatus::Succeeded {
            (EventKind::ActionSucceeded, EventSeverity::Info)
        } else {
            (EventKind::ActionFailed, EventSeverity::Error)
        };
        self.publish_action_event(
            &request,
            event_kind,
            severity,
            json!({"status": status, "duration_ms": duration_ms}),
        )
        .await;

        Ok(ExecuteActionResponse {
            status,
            confirmation: None,
            result: Some(result),
            output,
            error_code: None,
        })
    }

    async fn publish_action_event(
        &self,
        request: &ActionRequest,
        event_type: EventKind,
        severity: EventSeverity,
        details: Value,
    ) {
        let event = WorkstationEvent::new(
            request.target_device.as_deref().unwrap_or("local"),
            event_type,
            severity,
            "actions",
            json!({
                "request_id": request.request_id,
                "action_id": request.action_id,
                "details": details,
            }),
        )
        .with_correlation_id(request.request_id.clone());
        self.event_hub.publish(event).await;
    }
}

fn completed_response(result: ActionResult) -> ExecuteActionResponse {
    ExecuteActionResponse {
        status: result.status.clone(),
        confirmation: None,
        result: Some(result),
        output: None,
        error_code: None,
    }
}

fn indeterminate_response() -> ExecuteActionResponse {
    ExecuteActionResponse {
        status: ActionExecutionStatus::Indeterminate,
        confirmation: None,
        result: None,
        output: None,
        error_code: Some("action_indeterminate".to_string()),
    }
}

fn parameters_hash(parameters: &Value) -> String {
    let encoded = serde_json::to_vec(parameters).unwrap_or_default();
    Sha256::digest(encoded)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn output_summary(output: &Value) -> String {
    output
        .get("summary")
        .and_then(Value::as_str)
        .map(sanitize_text)
        .unwrap_or_else(|| "completed".to_string())
}

fn sanitize_text(value: &str) -> String {
    value.chars().take(500).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::control::models::{ActionOrigin, EventQuery};
    use crate::control::repository::ControlRepository;
    use serde_json::json;
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    };
    use tokio::sync::broadcast;

    struct CountingExecutor {
        calls: AtomicUsize,
        result: Result<serde_json::Value, String>,
    }

    impl CountingExecutor {
        fn success() -> Self {
            Self {
                calls: AtomicUsize::new(0),
                result: Ok(json!({"summary": "created"})),
            }
        }

        fn calls(&self) -> usize {
            self.calls.load(Ordering::SeqCst)
        }
    }

    impl ActionExecutor for CountingExecutor {
        fn execute(
            &self,
            _action_id: &str,
            _parameters: &serde_json::Value,
        ) -> Result<serde_json::Value, String> {
            self.calls.fetch_add(1, Ordering::SeqCst);
            self.result.clone()
        }
    }

    fn request(request_id: &str, action_id: &str, parameters: serde_json::Value) -> ActionRequest {
        ActionRequest {
            request_id: request_id.to_string(),
            action_id: action_id.to_string(),
            target_device: None,
            parameters,
            origin: ActionOrigin::Api,
            requested_by: "test".to_string(),
            confirmation_token: None,
        }
    }

    fn test_control_plane(
        executor: Arc<dyn ActionExecutor>,
    ) -> (ControlPlane, Arc<ControlRepository>) {
        let repository = Arc::new(ControlRepository::open_in_memory().unwrap());
        let (tx, _) = broadcast::channel(16);
        (
            ControlPlane::new(repository.clone(), tx, executor),
            repository,
        )
    }

    #[test]
    fn catalog_contains_the_initial_built_in_actions() {
        let registry = ActionRegistry::built_in();
        let ids: Vec<&str> = registry
            .catalog()
            .iter()
            .map(|action| action.id.as_str())
            .collect();
        assert_eq!(
            ids,
            vec![
                "app.open",
                "snapshot.create",
                "process.kill",
                "port.kill",
                "cleaner.clean",
                "network.flush_dns",
            ]
        );
    }

    #[cfg(unix)]
    #[test]
    fn administrator_action_availability_matches_effective_user() {
        let registry = ActionRegistry::built_in();
        let flush_dns = registry.find("network.flush_dns").unwrap();
        let has_administrator_access = unsafe { libc::geteuid() == 0 };

        assert_eq!(flush_dns.available, has_administrator_access);
        assert_eq!(
            flush_dns.unavailable_reason.as_deref(),
            (!has_administrator_access).then_some("administrator_required")
        );
    }

    #[test]
    fn dns_flush_rejects_unsuccessful_command_statuses() {
        let failed_cache = Command::new("sh").args(["-c", "exit 1"]).output();
        let successful_responder = Command::new("sh").args(["-c", "exit 0"]).output();

        assert_eq!(
            dns_flush_result(failed_cache, successful_responder),
            Err("dns_flush_failed".to_string())
        );
    }

    #[tokio::test]
    async fn unavailable_actions_are_rejected_before_execution() {
        let executor = Arc::new(CountingExecutor::success());
        let (mut control, _) = test_control_plane(executor.clone());
        let action = control
            .registry
            .definitions
            .iter_mut()
            .find(|action| action.id == "snapshot.create")
            .unwrap();
        action.available = false;
        action.unavailable_reason = Some("administrator_required".to_string());

        let result = control
            .execute(request(
                "request-unavailable",
                "snapshot.create",
                json!({"project_path": "/tmp/repo"}),
            ))
            .await;

        assert!(matches!(
            result,
            Err(ControlError::Forbidden(code)) if code == "administrator_required"
        ));
        assert_eq!(executor.calls(), 0);
    }

    #[tokio::test]
    async fn duplicate_request_ids_return_the_original_result() {
        let executor = Arc::new(CountingExecutor::success());
        let (control, _) = test_control_plane(executor.clone());
        let request = request(
            "request-1",
            "snapshot.create",
            json!({"project_path": "/tmp/repo", "title": "checkpoint"}),
        );

        let first = control.execute(request.clone()).await.unwrap();
        let second = control.execute(request).await.unwrap();

        assert_eq!(
            first.result.as_ref().unwrap().request_id,
            second.result.as_ref().unwrap().request_id
        );
        assert_eq!(executor.calls(), 1);
    }

    #[tokio::test]
    async fn duplicate_request_id_with_a_different_binding_is_rejected() {
        let executor = Arc::new(CountingExecutor::success());
        let (control, _) = test_control_plane(executor.clone());

        control
            .execute(request(
                "request-conflict",
                "snapshot.create",
                json!({"project_path": "/tmp/repo", "title": "checkpoint"}),
            ))
            .await
            .unwrap();
        let conflict = control
            .execute(request(
                "request-conflict",
                "snapshot.create",
                json!({"project_path": "/tmp/other", "title": "checkpoint"}),
            ))
            .await;

        assert!(matches!(conflict, Err(ControlError::Conflict(_))));
        assert_eq!(executor.calls(), 1);
    }

    #[tokio::test]
    async fn completed_request_binding_wins_over_current_action_availability() {
        let executor = Arc::new(CountingExecutor::success());
        let (mut control, _) = test_control_plane(executor.clone());
        let original = request(
            "request-availability-change",
            "snapshot.create",
            json!({"project_path": "/tmp/repo", "title": "checkpoint"}),
        );

        let first = control.execute(original.clone()).await.unwrap();
        let action = control
            .registry
            .definitions
            .iter_mut()
            .find(|action| action.id == "snapshot.create")
            .unwrap();
        action.available = false;
        action.unavailable_reason = Some("administrator_required".to_string());

        let duplicate = control.execute(original).await.unwrap();
        let conflict = control
            .execute(request(
                "request-availability-change",
                "snapshot.create",
                json!({"project_path": "/tmp/other", "title": "checkpoint"}),
            ))
            .await;

        assert_eq!(first.result, duplicate.result);
        assert!(matches!(conflict, Err(ControlError::Conflict(_))));
        assert_eq!(executor.calls(), 1);
    }

    #[tokio::test]
    async fn durable_claim_without_a_result_is_reported_as_indeterminate() {
        let executor = Arc::new(CountingExecutor::success());
        let (control, repository) = test_control_plane(executor.clone());
        let request = request(
            "request-pending",
            "snapshot.create",
            json!({"project_path": "/tmp/repo", "title": "checkpoint"}),
        );
        repository
            .claim_action(
                &request.request_id,
                &request.action_id,
                &parameters_hash(&request.parameters),
                10,
            )
            .unwrap();

        let response = control.execute(request).await.unwrap();

        assert_eq!(response.status, ActionExecutionStatus::Indeterminate);
        assert_eq!(response.error_code.as_deref(), Some("action_indeterminate"));
        assert_eq!(executor.calls(), 0);
    }

    #[tokio::test]
    async fn process_kill_returns_a_confirmation_challenge_before_execution() {
        let executor = Arc::new(CountingExecutor::success());
        let (control, _) = test_control_plane(executor.clone());

        let response = control
            .execute(request("request-2", "process.kill", json!({"pid": 42})))
            .await
            .unwrap();

        assert_eq!(response.status, ActionExecutionStatus::ConfirmationRequired);
        assert!(response.confirmation.is_some());
        assert_eq!(executor.calls(), 0);
    }

    #[tokio::test]
    async fn invalid_parameters_and_unknown_actions_are_rejected_without_execution() {
        let executor = Arc::new(CountingExecutor::success());
        let (control, _) = test_control_plane(executor.clone());

        assert!(matches!(
            control
                .execute(request("request-3", "process.kill", json!({"pid": "42"})))
                .await,
            Err(ControlError::InvalidParameters(_))
        ));
        assert!(matches!(
            control
                .execute(request("request-4", "missing.action", json!({})))
                .await,
            Err(ControlError::UnknownAction)
        ));
        assert_eq!(executor.calls(), 0);
    }

    #[tokio::test]
    async fn successful_execution_is_persisted_and_correlated_with_events() {
        let executor = Arc::new(CountingExecutor::success());
        let (control, repository) = test_control_plane(executor);
        let response = control
            .execute(request(
                "request-5",
                "snapshot.create",
                json!({"project_path": "/tmp/repo", "title": "checkpoint"}),
            ))
            .await
            .unwrap();
        let result = response.result.unwrap();
        let events = repository.list_events(EventQuery::default()).unwrap().items;

        assert_eq!(result.status, ActionExecutionStatus::Succeeded);
        assert_eq!(repository.count_action_results().unwrap(), 1);
        assert_eq!(events.len(), 2);
        assert!(events
            .iter()
            .all(|event| event.correlation_id == result.correlation_id));
    }
}
