use crate::control::models::{EventPage, EventQuery, WorkstationEvent};
use crate::control::repository::{ControlRepository, RepositoryResult};
use crate::types::WsEvent;
use std::collections::{HashSet, VecDeque};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tokio::sync::{broadcast, RwLock};

pub trait EventRepository: Send + Sync {
    fn insert_event(&self, event: &WorkstationEvent) -> RepositoryResult<()>;
    fn list_events(&self, query: EventQuery) -> RepositoryResult<EventPage>;
}

impl EventRepository for ControlRepository {
    fn insert_event(&self, event: &WorkstationEvent) -> RepositoryResult<()> {
        ControlRepository::insert_event(self, event)
    }

    fn list_events(&self, query: EventQuery) -> RepositoryResult<EventPage> {
        ControlRepository::list_events(self, query)
    }
}

#[derive(Debug, Clone)]
pub struct PublishedEvent {
    pub event: WorkstationEvent,
    pub persisted: bool,
}

#[derive(Clone)]
pub struct EventHub {
    repository: Arc<dyn EventRepository>,
    tx: broadcast::Sender<WsEvent>,
    memory: Arc<RwLock<VecDeque<WorkstationEvent>>>,
    memory_limit: usize,
    storage_degraded: Arc<AtomicBool>,
}

impl EventHub {
    pub fn new(
        repository: Arc<dyn EventRepository>,
        tx: broadcast::Sender<WsEvent>,
    ) -> Self {
        Self::with_memory_limit(repository, tx, 500)
    }

    pub fn with_memory_limit(
        repository: Arc<dyn EventRepository>,
        tx: broadcast::Sender<WsEvent>,
        memory_limit: usize,
    ) -> Self {
        Self {
            repository,
            tx,
            memory: Arc::new(RwLock::new(VecDeque::with_capacity(memory_limit.max(1)))),
            memory_limit: memory_limit.max(1),
            storage_degraded: Arc::new(AtomicBool::new(false)),
        }
    }

    pub async fn publish(&self, event: WorkstationEvent) -> PublishedEvent {
        let repository = Arc::clone(&self.repository);
        let persisted_event = event.clone();
        let persisted = tokio::task::spawn_blocking(move || {
            repository.insert_event(&persisted_event)
        })
        .await
        .map_err(|error| error.to_string())
        .and_then(|result| result.map_err(|error| error.to_string()))
        .map(|_| true)
        .unwrap_or_else(|error| {
            tracing::warn!(error = %error, "workstation event persistence degraded");
            false
        });

        if persisted {
            self.storage_degraded.store(false, Ordering::Release);
        } else {
            self.storage_degraded.store(true, Ordering::Release);
            let mut memory = self.memory.write().await;
            memory.push_front(event.clone());
            while memory.len() > self.memory_limit {
                memory.pop_back();
            }
        }

        let _ = self.tx.send(WsEvent::WorkstationEvent(event.clone()));
        PublishedEvent { event, persisted }
    }

    pub fn storage_degraded(&self) -> bool {
        self.storage_degraded.load(Ordering::Acquire)
    }

    pub async fn memory_events(&self) -> Vec<WorkstationEvent> {
        self.memory.read().await.iter().cloned().collect()
    }

    pub async fn list_events(&self, query: EventQuery) -> EventPage {
        let repository = Arc::clone(&self.repository);
        let persistent_query = query.clone();
        let persistent = tokio::task::spawn_blocking(move || {
            repository.list_events(persistent_query)
        })
        .await;
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
        let mut known_ids: HashSet<String> = items
            .iter()
            .map(|event| event.event_id.clone())
            .collect();
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
}
