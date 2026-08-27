use crate::control::models::{ActionRisk, ConfirmationChallenge};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tokio::sync::Mutex;
use uuid::Uuid;

const MAX_PENDING_CONFIRMATIONS: usize = 128;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PolicyDenial {
    InvalidOrExpiredConfirmation,
    ConfirmationBindingMismatch,
}

impl PolicyDenial {
    pub fn code(&self) -> &'static str {
        match self {
            Self::InvalidOrExpiredConfirmation => "invalid_or_expired_confirmation",
            Self::ConfirmationBindingMismatch => "confirmation_binding_mismatch",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PolicyDecision {
    Allowed,
    ConfirmationRequired(ConfirmationChallenge),
    Denied(PolicyDenial),
}

#[derive(Debug, Clone)]
struct PendingConfirmation {
    request_id: String,
    action_id: String,
    parameters: Value,
    expires_at: i64,
    issued_sequence: u64,
}

pub struct PolicyEngine {
    lifetime: Duration,
    pending: Mutex<HashMap<String, PendingConfirmation>>,
    next_sequence: AtomicU64,
}

impl PolicyEngine {
    pub fn new(lifetime: Duration) -> Self {
        Self {
            lifetime,
            pending: Mutex::new(HashMap::new()),
            next_sequence: AtomicU64::new(0),
        }
    }

    pub async fn authorize(
        &self,
        request_id: &str,
        action_id: &str,
        parameters: &Value,
        risk: ActionRisk,
        confirmation_token: Option<&str>,
    ) -> PolicyDecision {
        if risk == ActionRisk::Safe {
            return PolicyDecision::Allowed;
        }

        let now = chrono::Utc::now().timestamp_millis();
        let mut pending = self.pending.lock().await;
        pending.retain(|_, challenge| challenge.expires_at >= now);
        let Some(token) = confirmation_token else {
            let token = Uuid::new_v4().simple().to_string();
            let lifetime_ms = i64::try_from(self.lifetime.as_millis()).unwrap_or(i64::MAX);
            let expires_at = now.saturating_add(lifetime_ms);
            if pending.len() >= MAX_PENDING_CONFIRMATIONS {
                let oldest_token = pending
                    .iter()
                    .min_by_key(|(_, challenge)| challenge.issued_sequence)
                    .map(|(token, _)| token.clone());
                if let Some(oldest_token) = oldest_token {
                    pending.remove(&oldest_token);
                }
            }
            pending.insert(
                token.clone(),
                PendingConfirmation {
                    request_id: request_id.to_string(),
                    action_id: action_id.to_string(),
                    parameters: parameters.clone(),
                    expires_at,
                    issued_sequence: self.next_sequence.fetch_add(1, Ordering::Relaxed),
                },
            );
            return PolicyDecision::ConfirmationRequired(ConfirmationChallenge {
                token,
                expires_at,
                risk,
            });
        };

        let Some(challenge) = pending.get(token) else {
            return PolicyDecision::Denied(PolicyDenial::InvalidOrExpiredConfirmation);
        };
        if challenge.request_id != request_id
            || challenge.action_id != action_id
            || challenge.parameters != *parameters
        {
            return PolicyDecision::Denied(PolicyDenial::ConfirmationBindingMismatch);
        }
        pending.remove(token);
        PolicyDecision::Allowed
    }
}

impl Default for PolicyEngine {
    fn default() -> Self {
        Self::new(Duration::from_secs(60))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::control::models::ActionRisk;
    use serde_json::json;
    use std::time::Duration;

    #[tokio::test]
    async fn safe_actions_are_allowed_without_a_ticket() {
        let policy = PolicyEngine::new(Duration::from_secs(60));
        assert_eq!(
            policy
                .authorize(
                    "req",
                    "snapshot.create",
                    &json!({"project_path": "/tmp/repo"}),
                    ActionRisk::Safe,
                    None,
                )
                .await,
            PolicyDecision::Allowed
        );
    }

    #[tokio::test]
    async fn dangerous_actions_require_a_single_use_bound_ticket() {
        let policy = PolicyEngine::new(Duration::from_secs(60));
        let parameters = json!({"pid": 42});
        let challenge = match policy
            .authorize(
                "req-1",
                "process.kill",
                &parameters,
                ActionRisk::ConfirmationRequired,
                None,
            )
            .await
        {
            PolicyDecision::ConfirmationRequired(challenge) => challenge,
            decision => panic!("expected challenge, got {decision:?}"),
        };

        assert_eq!(
            policy
                .authorize(
                    "req-1",
                    "process.kill",
                    &parameters,
                    ActionRisk::ConfirmationRequired,
                    Some(&challenge.token),
                )
                .await,
            PolicyDecision::Allowed
        );
        assert!(matches!(
            policy
                .authorize(
                    "req-1",
                    "process.kill",
                    &parameters,
                    ActionRisk::ConfirmationRequired,
                    Some(&challenge.token),
                )
                .await,
            PolicyDecision::Denied(PolicyDenial::InvalidOrExpiredConfirmation)
        ));
    }

    #[tokio::test]
    async fn a_ticket_cannot_be_replayed_for_other_parameters_or_requests() {
        let policy = PolicyEngine::new(Duration::from_secs(60));
        let challenge = match policy
            .authorize(
                "req-1",
                "process.kill",
                &json!({"pid": 42}),
                ActionRisk::ConfirmationRequired,
                None,
            )
            .await
        {
            PolicyDecision::ConfirmationRequired(challenge) => challenge,
            decision => panic!("expected challenge, got {decision:?}"),
        };

        assert!(matches!(
            policy
                .authorize(
                    "req-1",
                    "process.kill",
                    &json!({"pid": 43}),
                    ActionRisk::ConfirmationRequired,
                    Some(&challenge.token),
                )
                .await,
            PolicyDecision::Denied(PolicyDenial::ConfirmationBindingMismatch)
        ));
        assert!(matches!(
            policy
                .authorize(
                    "req-2",
                    "process.kill",
                    &json!({"pid": 42}),
                    ActionRisk::ConfirmationRequired,
                    Some(&challenge.token),
                )
                .await,
            PolicyDecision::Denied(PolicyDenial::ConfirmationBindingMismatch)
        ));
    }

    #[tokio::test]
    async fn expired_tickets_are_denied() {
        let policy = PolicyEngine::new(Duration::from_millis(1));
        let parameters = json!({"pid": 42});
        let challenge = match policy
            .authorize(
                "req-1",
                "process.kill",
                &parameters,
                ActionRisk::ConfirmationRequired,
                None,
            )
            .await
        {
            PolicyDecision::ConfirmationRequired(challenge) => challenge,
            decision => panic!("expected challenge, got {decision:?}"),
        };
        tokio::time::sleep(Duration::from_millis(5)).await;

        assert!(matches!(
            policy
                .authorize(
                    "req-1",
                    "process.kill",
                    &parameters,
                    ActionRisk::ConfirmationRequired,
                    Some(&challenge.token),
                )
                .await,
            PolicyDecision::Denied(PolicyDenial::InvalidOrExpiredConfirmation)
        ));
    }

    #[tokio::test]
    async fn issuing_a_challenge_purges_all_expired_challenges() {
        let policy = PolicyEngine::new(Duration::from_millis(1));
        let _expired = policy
            .authorize(
                "expired",
                "process.kill",
                &json!({"pid": 1}),
                ActionRisk::ConfirmationRequired,
                None,
            )
            .await;
        tokio::time::sleep(Duration::from_millis(5)).await;

        let _fresh = policy
            .authorize(
                "fresh",
                "process.kill",
                &json!({"pid": 2}),
                ActionRisk::ConfirmationRequired,
                None,
            )
            .await;

        assert_eq!(policy.pending.lock().await.len(), 1);
    }

    #[tokio::test]
    async fn pending_challenges_are_bounded_and_evict_the_oldest() {
        let policy = PolicyEngine::new(Duration::from_secs(60));
        let parameters = json!({"pid": 1});
        let oldest = match policy
            .authorize(
                "oldest",
                "process.kill",
                &parameters,
                ActionRisk::ConfirmationRequired,
                None,
            )
            .await
        {
            PolicyDecision::ConfirmationRequired(challenge) => challenge,
            decision => panic!("expected challenge, got {decision:?}"),
        };
        for index in 0..128 {
            let _ = policy
                .authorize(
                    &format!("request-{index}"),
                    "process.kill",
                    &json!({"pid": index}),
                    ActionRisk::ConfirmationRequired,
                    None,
                )
                .await;
        }

        assert_eq!(policy.pending.lock().await.len(), 128);
        assert!(matches!(
            policy
                .authorize(
                    "oldest",
                    "process.kill",
                    &parameters,
                    ActionRisk::ConfirmationRequired,
                    Some(&oldest.token),
                )
                .await,
            PolicyDecision::Denied(PolicyDenial::InvalidOrExpiredConfirmation)
        ));
    }
}
