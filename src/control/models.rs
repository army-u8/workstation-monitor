use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub const EVENT_SCHEMA_VERSION: u16 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EventKind {
    ServiceStarted,
    ServiceDegraded,
    ActionRequested,
    ActionConfirmationRequired,
    ActionSucceeded,
    ActionFailed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EventSeverity {
    Info,
    Warning,
    Error,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ActionRisk {
    Safe,
    ConfirmationRequired,
    AdministratorRequired,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ActionParameterType {
    String,
    Integer,
    Boolean,
    StringList,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ActionParameterDefinition {
    pub name: String,
    pub value_type: ActionParameterType,
    pub required: bool,
    pub label_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ActionDefinition {
    pub id: String,
    pub label_key: String,
    pub description_key: String,
    pub risk: ActionRisk,
    pub parameters: Vec<ActionParameterDefinition>,
    pub keywords: Vec<String>,
    pub available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unavailable_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkstationEvent {
    pub event_id: String,
    pub device_id: String,
    pub event_type: EventKind,
    pub severity: EventSeverity,
    pub source: String,
    pub occurred_at: i64,
    pub correlation_id: String,
    pub schema_version: u16,
    pub payload: serde_json::Value,
}

impl WorkstationEvent {
    pub fn new(
        device_id: impl Into<String>,
        event_type: EventKind,
        severity: EventSeverity,
        source: impl Into<String>,
        payload: serde_json::Value,
    ) -> Self {
        let event_id = Uuid::new_v4().simple().to_string();
        Self {
            correlation_id: event_id.clone(),
            event_id,
            device_id: device_id.into(),
            event_type,
            severity,
            source: source.into(),
            occurred_at: chrono::Utc::now().timestamp_millis(),
            schema_version: EVENT_SCHEMA_VERSION,
            payload,
        }
    }

    pub fn with_correlation_id(mut self, correlation_id: impl Into<String>) -> Self {
        self.correlation_id = correlation_id.into();
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ActionOrigin {
    Api,
    CommandPalette,
    LegacyEndpoint,
    Automation,
    MenuBar,
    Peer,
}

fn default_action_origin() -> ActionOrigin {
    ActionOrigin::Api
}

fn default_requested_by() -> String {
    "local-user".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionRequest {
    pub request_id: String,
    pub action_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_device: Option<String>,
    #[serde(default)]
    pub parameters: serde_json::Value,
    #[serde(default = "default_action_origin")]
    pub origin: ActionOrigin,
    #[serde(default = "default_requested_by")]
    pub requested_by: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub confirmation_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ActionExecutionStatus {
    Pending,
    ConfirmationRequired,
    Succeeded,
    Failed,
    Denied,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ActionResult {
    pub request_id: String,
    pub action_id: String,
    pub status: ActionExecutionStatus,
    pub started_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finished_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub correlation_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ConfirmationChallenge {
    pub token: String,
    pub expires_at: i64,
    pub risk: ActionRisk,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteActionResponse {
    pub status: ActionExecutionStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confirmation: Option<ConfirmationChallenge>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<ActionResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct EventQuery {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub event_type: Option<EventKind>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub severity: Option<EventSeverity>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub before: Option<String>,
    #[serde(default)]
    pub limit: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventPage {
    pub items: Vec<WorkstationEvent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
    pub storage_degraded: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn workstation_event_contract_is_versioned_and_stable() {
        let event = WorkstationEvent::new(
            "local-device",
            EventKind::ServiceStarted,
            EventSeverity::Info,
            "server",
            serde_json::json!({"port": 9527}),
        );
        let json = serde_json::to_value(event).unwrap();

        assert_eq!(json["schema_version"], 1);
        assert_eq!(json["event_type"], "service_started");
        assert_eq!(json["severity"], "info");
        assert_eq!(json["payload"]["port"], 9527);
        assert!(json["event_id"].as_str().unwrap().len() >= 32);
    }

    #[test]
    fn action_risk_serializes_as_a_machine_readable_value() {
        assert_eq!(
            serde_json::to_value(ActionRisk::ConfirmationRequired).unwrap(),
            "confirmation_required"
        );
    }
}
