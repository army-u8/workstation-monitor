use crate::control::models::{EventPage, EventQuery, WorkstationEvent};
use crate::control::repository::{ControlRepository, RepositoryResult};
use crate::types::WsEvent;
use std::collections::{HashSet, VecDeque};
use std::sync::{
    atomic::{AtomicBool, AtomicI64, Ordering},
    Arc,
};
use tokio::sync::{broadcast, RwLock};

pub trait EventRepository: Send + Sync {
    fn insert_event(&self, event: &WorkstationEvent) -> RepositoryResult<()>;
    fn list_events(&self, query: EventQuery) -> RepositoryResult<EventPage>;

    fn persistence_available(&self) -> bool {
        true
    }
}

impl EventRepository for ControlRepository {
    fn insert_event(&self, event: &WorkstationEvent) -> RepositoryResult<()> {
        ControlRepository::insert_event(self, event)
    }

    fn list_events(&self, query: EventQuery) -> RepositoryResult<EventPage> {
        ControlRepository::list_events(self, query)
    }

    fn persistence_available(&self) -> bool {
        ControlRepository::persistence_available(self)
    }
}

#[derive(Debug, Clone)]
pub struct PublishedEvent {
    pub persisted: bool,
}

#[derive(Clone)]
pub struct EventHub {
    repository: Arc<dyn EventRepository>,
    tx: broadcast::Sender<WsEvent>,
    memory: Arc<RwLock<VecDeque<WorkstationEvent>>>,
    memory_limit: usize,
    persistence_available: bool,
    storage_degraded: Arc<AtomicBool>,
    last_occurred_at: Arc<AtomicI64>,
}

impl EventHub {
    pub fn new(repository: Arc<dyn EventRepository>, tx: broadcast::Sender<WsEvent>) -> Self {
        Self::with_memory_limit(repository, tx, 500)
    }

    pub fn with_memory_limit(
        repository: Arc<dyn EventRepository>,
        tx: broadcast::Sender<WsEvent>,
        memory_limit: usize,
    ) -> Self {
        let persistence_available = repository.persistence_available();
        Self {
            repository,
            tx,
            memory: Arc::new(RwLock::new(VecDeque::with_capacity(memory_limit.max(1)))),
            memory_limit: memory_limit.max(1),
            persistence_available,
            storage_degraded: Arc::new(AtomicBool::new(!persistence_available)),
            last_occurred_at: Arc::new(AtomicI64::new(0)),
        }
    }

    pub async fn publish(&self, mut event: WorkstationEvent) -> PublishedEvent {
        event.occurred_at = reserve_monotonic_timestamp(&self.last_occurred_at, event.occurred_at);
        let repository = Arc::clone(&self.repository);
        let persisted_event = event.clone();
        let persisted =
            tokio::task::spawn_blocking(move || repository.insert_event(&persisted_event))
                .await
                .map_err(|error| error.to_string())
                .and_then(|result| result.map_err(|error| error.to_string()))
                .map(|_| true)
                .unwrap_or_else(|error| {
                    tracing::warn!(error = %error, "workstation event persistence degraded");
                    false
                });

        if persisted && self.persistence_available {
            self.storage_degraded.store(false, Ordering::Release);
        } else if !persisted {
            self.storage_degraded.store(true, Ordering::Release);
            let mut memory = self.memory.write().await;
            memory.push_front(event.clone());
            while memory.len() > self.memory_limit {
                memory.pop_back();
            }
        }

        let _ = self.tx.send(WsEvent::WorkstationEvent(event.clone()));
        PublishedEvent { persisted }
    }

    pub fn storage_degraded(&self) -> bool {
        self.storage_degraded.load(Ordering::Acquire)
    }

    #[cfg(test)]
    pub async fn memory_events(&self) -> Vec<WorkstationEvent> {
        self.memory.read().await.iter().cloned().collect()
    }

    pub async fn list_events(&self, query: EventQuery) -> EventPage {
        let repository = Arc::clone(&self.repository);
        let persistent_query = query.clone();
        let persistent =
            tokio::task::spawn_blocking(move || repository.list_events(persistent_query)).await;
        let (mut items, mut next_cursor, repository_failed) = match persistent {
            Ok(Ok(page)) => (page.items, page.next_cursor, false),
            Ok(Err(error)) => {
                tracing::warn!(error = %error, "workstation event query degraded");
                (Vec::new(), None, true)
            }
            Err(error) => {
                tracing::warn!(error = %error, "workstation event query task failed");
                (Vec::new(), None, true)
            }
        };

        let memory = self.memory.read().await;
        let mut known_ids: HashSet<String> =
            items.iter().map(|event| event.event_id.clone()).collect();
        for event in memory.iter().filter(|event| matches_query(event, &query)) {
            if known_ids.insert(event.event_id.clone()) {
                items.push(event.clone());
            }
        }
        items.sort_by(|left, right| {
            right
                .occurred_at
                .cmp(&left.occurred_at)
                .then_with(|| right.event_id.cmp(&left.event_id))
        });
        let limit = if query.limit == 0 {
            50
        } else {
            query.limit.clamp(1, 200)
        };
        if items.len() > limit {
            items.truncate(limit);
            next_cursor = items
                .last()
                .map(|event| format!("{}:{}", event.occurred_at, event.event_id));
        }
        let storage_degraded = repository_failed || self.storage_degraded();
        EventPage {
            items,
            next_cursor,
            storage_degraded,
        }
    }
}

fn reserve_monotonic_timestamp(last_timestamp: &AtomicI64, requested: i64) -> i64 {
    let mut observed = last_timestamp.load(Ordering::Acquire);
    loop {
        let candidate = requested.max(observed.saturating_add(1));
        match last_timestamp.compare_exchange_weak(
            observed,
            candidate,
            Ordering::AcqRel,
            Ordering::Acquire,
        ) {
            Ok(_) => return candidate,
            Err(actual) => observed = actual,
        }
    }
}

fn matches_query(event: &WorkstationEvent, query: &EventQuery) -> bool {
    if query
        .device_id
        .as_ref()
        .is_some_and(|device_id| &event.device_id != device_id)
        || query
            .event_type
            .as_ref()
            .is_some_and(|event_type| &event.event_type != event_type)
        || query
            .severity
            .as_ref()
            .is_some_and(|severity| &event.severity != severity)
        || query
            .source
            .as_ref()
            .is_some_and(|source| &event.source != source)
    {
        return false;
    }
    let Some(cursor) = query.before.as_deref() else {
        return true;
    };
    let Some((timestamp, event_id)) = cursor.split_once(':') else {
        return false;
    };
    let Ok(timestamp) = timestamp.parse::<i64>() else {
        return false;
    };
    event.occurred_at < timestamp
        || (event.occurred_at == timestamp && event.event_id.as_str() < event_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::control::models::{
        EventKind, EventPage, EventQuery, EventSeverity, WorkstationEvent,
    };
    use crate::control::repository::{RepositoryError, RepositoryResult};
    use crate::types::WsEvent;
    use std::sync::{Arc, Mutex};
    use tokio::sync::broadcast;

    struct TestRepository {
        events: Mutex<Vec<WorkstationEvent>>,
        failing: bool,
    }

    impl TestRepository {
        fn working() -> Self {
            Self {
                events: Mutex::new(Vec::new()),
                failing: false,
            }
        }

        fn failing() -> Self {
            Self {
                events: Mutex::new(Vec::new()),
                failing: true,
            }
        }

        fn events(&self) -> Vec<WorkstationEvent> {
            self.events.lock().unwrap().clone()
        }
    }

    impl EventRepository for TestRepository {
        fn insert_event(&self, event: &WorkstationEvent) -> RepositoryResult<()> {
            if self.failing {
                return Err(RepositoryError::LockPoisoned);
            }
            self.events.lock().unwrap().push(event.clone());
            Ok(())
        }

        fn list_events(&self, _query: EventQuery) -> RepositoryResult<EventPage> {
            if self.failing {
                return Err(RepositoryError::LockPoisoned);
            }
            Ok(EventPage {
                items: self.events(),
                next_cursor: None,
                storage_degraded: false,
            })
        }
    }

    fn test_event(id: &str) -> WorkstationEvent {
        let mut event = WorkstationEvent::new(
            "local",
            EventKind::ServiceStarted,
            EventSeverity::Info,
            "test",
            serde_json::json!({}),
        );
        event.event_id = id.to_string();
        event
    }

    #[tokio::test]
    async fn publishing_persists_and_broadcasts_the_same_event() {
        let repository = Arc::new(TestRepository::working());
        let (tx, mut rx) = broadcast::channel(8);
        let hub = EventHub::new(repository.clone(), tx);

        let published = hub.publish(test_event("event-1")).await;

        assert!(published.persisted);
        assert_eq!(repository.events()[0].event_id, "event-1");
        assert!(matches!(
            rx.recv().await.unwrap(),
            WsEvent::WorkstationEvent(event) if event.event_id == "event-1"
        ));
    }

    #[tokio::test]
    async fn repository_failure_keeps_a_bounded_in_memory_timeline() {
        let repository = Arc::new(TestRepository::failing());
        let (tx, _) = broadcast::channel(8);
        let hub = EventHub::with_memory_limit(repository, tx, 2);
        hub.publish(test_event("one")).await;
        hub.publish(test_event("two")).await;
        hub.publish(test_event("three")).await;

        assert!(hub.storage_degraded());
        assert_eq!(hub.memory_events().await.len(), 2);
        assert_eq!(hub.memory_events().await[0].event_id, "three");
    }

    #[tokio::test]
    async fn in_memory_repository_reports_degraded_persistence_immediately() {
        let repository = Arc::new(ControlRepository::open_in_memory().unwrap());
        let (tx, _) = broadcast::channel(8);
        let hub = EventHub::new(repository, tx);

        let page = hub.list_events(EventQuery::default()).await;

        assert!(page.storage_degraded);
    }

    #[tokio::test]
    async fn publishing_preserves_causal_order_for_same_millisecond_events() {
        let repository = Arc::new(TestRepository::working());
        let (tx, _) = broadcast::channel(8);
        let hub = EventHub::new(repository.clone(), tx);
        let mut requested = test_event("requested");
        requested.occurred_at = 100;
        let mut succeeded = test_event("succeeded");
        succeeded.occurred_at = 100;

        hub.publish(requested).await;
        hub.publish(succeeded).await;

        let events = repository.events();
        assert!(events[1].occurred_at > events[0].occurred_at);
    }
}
