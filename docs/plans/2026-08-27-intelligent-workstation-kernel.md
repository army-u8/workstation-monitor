# Intelligent Workstation Kernel Milestone 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the local event/action/policy/audit kernel, persistent activity timeline, and global command palette that all seven approved VibeDesk capabilities will use.

**Architecture:** Add a `control` backend module containing versioned domain models, a bundled SQLite repository, an event hub, a one-time confirmation policy, and an action registry. Attach one `ControlPlane` to the existing Axum `AppState`, expose additive `/api/control/*` routes and a new `WsEvent::WorkstationEvent` variant, then consume the same contracts in SolidJS for the Activity page and global `⌘K` command palette while preserving every existing API response.

**Tech Stack:** Rust 2021, Tokio, Axum 0.7, Serde, bundled SQLite through `rusqlite`, UUID identifiers, SolidJS 1.9, TypeScript 6, Bun tests, bilingual i18n dictionaries, Tabler icons.

---

## Scope

This plan implements the first approved milestone. It deliberately establishes the contracts required by the remaining capabilities without prematurely implementing the rule editor, Agent inference, native menu bar, or LAN peer transport.

Delivered here:

- Versioned workstation events and action contracts.
- SQLite migrations, event retention, action-result persistence, and memory fallback.
- Risk classification and one-time confirmation tickets.
- A typed action catalog and a first set of adapters around existing operations.
- Additive control REST APIs and WebSocket events.
- Activity timeline page.
- Global `⌘K` command palette.
- Compatibility, i18n, regression, and release-build verification.

Follow-up plans, written after these contracts are running, will implement:

1. Rule Engine + Agent Command Center + Health Diagnostics.
2. macOS menu bar mode.
3. LAN discovery, pairing, identity, and remote actions.

## Required Execution Discipline

- Use `@superpowers:test-driven-development` for every task below.
- Use `@superpowers:systematic-debugging` for any unexpected failure.
- Do not change the response body of existing endpoints.
- Never put user-facing text directly in `.tsx`; update both dictionaries together.
- Only import icons through `frontend/src/components/Icons.tsx`.
- Commit after every task with the exact or equivalent commit message shown.

### Task 1: Add versioned control-domain contracts

**Files:**

- Modify: `Cargo.toml`
- Modify: `Cargo.lock`
- Create: `src/control/mod.rs`
- Create: `src/control/models.rs`
- Modify: `src/main.rs`

**Step 1: Add a failing serialization test**

Create `src/control/models.rs` with a `#[cfg(test)]` module first. The test must require externally tagged snake-case values and a schema version:

```rust
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
```

**Step 2: Run the test and verify the missing types fail compilation**

Run: `cargo test control::models::tests::workstation_event_contract_is_versioned_and_stable --offline`

Expected: FAIL because `WorkstationEvent`, `EventKind`, `EventSeverity`, and `ActionRisk` do not exist.

**Step 3: Add minimal dependencies and models**

Add to `Cargo.toml`:

```toml
rusqlite = { version = "0.37", features = ["bundled"] }
uuid = { version = "1", features = ["v4", "serde"] }
```

Run `cargo test control::models::tests` once without `--offline` immediately after adding these dependencies. This is the single dependency-resolution step: it downloads the crates and updates `Cargo.lock`. All following Rust commands return to `--offline` so release verification proves the lockfile and cache are sufficient.

Implement these public contracts in `src/control/models.rs`:

```rust
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
pub enum EventSeverity { Info, Warning, Error, Critical }

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ActionRisk { Safe, ConfirmationRequired, AdministratorRequired }

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
```

Also define `ActionDefinition`, `ActionRequest`, `ActionExecutionStatus`, `ActionResult`, `ConfirmationChallenge`, `ExecuteActionResponse`, and `EventQuery` with serde names matching the design document. Constructors generate UUIDs server-side; clients may provide `request_id`, but empty identifiers are rejected.

Export the module from `src/control/mod.rs` and add `mod control;` in `src/main.rs`.

**Step 4: Run focused and full Rust tests**

Run: `cargo test control::models::tests --offline`

Expected: PASS, 2 tests.

Run: `cargo test --offline`

Expected: PASS with no existing test regressions.

**Step 5: Commit**

```bash
git add Cargo.toml Cargo.lock src/main.rs src/control/mod.rs src/control/models.rs
git commit -m "feat: add workstation control contracts"
```

### Task 2: Create the SQLite repository and migrations

**Files:**

- Create: `src/control/repository.rs`
- Modify: `src/control/mod.rs`

**Step 1: Write repository tests using an in-memory database**

Tests must cover migration, insert/list ordering, cursor pagination, action-result idempotency, and retention. Begin with:

```rust
#[test]
fn events_are_returned_newest_first_with_a_stable_cursor() {
    let repository = ControlRepository::open_in_memory().unwrap();
    repository.insert_event(&event_at("older", 10)).unwrap();
    repository.insert_event(&event_at("newer", 20)).unwrap();

    let first = repository.list_events(EventQuery { limit: 1, ..Default::default() }).unwrap();
    assert_eq!(first.items[0].event_id, "newer");
    assert_eq!(first.next_cursor.as_deref(), Some("20:newer"));

    let second = repository.list_events(EventQuery {
        limit: 1,
        before: first.next_cursor,
        ..Default::default()
    }).unwrap();
    assert_eq!(second.items[0].event_id, "older");
}

#[test]
fn duplicate_action_results_do_not_create_duplicate_audit_rows() {
    let repository = ControlRepository::open_in_memory().unwrap();
    let result = succeeded_result("request-1");
    repository.upsert_action_result(&result).unwrap();
    repository.upsert_action_result(&result).unwrap();
    assert_eq!(repository.count_action_results().unwrap(), 1);
}
```

**Step 2: Verify the tests fail**

Run: `cargo test control::repository::tests --offline`

Expected: FAIL because `ControlRepository` and migrations are undefined.

**Step 3: Implement schema version 1**

Use one `rusqlite::Connection` guarded by `std::sync::Mutex`; every public operation invoked from async request code must later run through `tokio::task::spawn_blocking` in `ControlPlane`.

Migration 1 must create:

```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);
CREATE TABLE events (
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
CREATE INDEX events_timeline_idx ON events(occurred_at DESC, event_id DESC);
CREATE INDEX events_filter_idx ON events(device_id, severity, event_type, occurred_at DESC);
CREATE TABLE action_results (
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
```

Use parameterized SQL only. Parse the `before` cursor as `<occurred_at>:<event_id>` and cap `limit` to `1..=200`. Add `prune_events(before_timestamp)`.

Production database location: `$WORKSTATION_DATA_DIR/vibedesk.db` when set, otherwise `~/Library/Application Support/VibeDesk/vibedesk.db`. Create its parent directory with user-only permissions where supported.

**Step 4: Run tests**

Run: `cargo test control::repository::tests --offline`

Expected: PASS for migration, pagination, idempotency, and retention tests.

Run: `cargo test --offline`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/control/mod.rs src/control/repository.rs
git commit -m "feat: persist workstation events and audit results"
```

### Task 3: Build the event hub with persistence fallback

**Files:**

- Create: `src/control/event_hub.rs`
- Modify: `src/control/mod.rs`
- Modify: `src/types.rs`
- Modify: `src/server/ws.rs`

**Step 1: Write event-hub tests**

Inject a repository trait/facade that can deliberately fail. Test both the durable and degraded paths:

```rust
#[tokio::test]
async fn publishing_persists_and_broadcasts_the_same_event() {
    let repository = Arc::new(TestRepository::working());
    let (tx, mut rx) = broadcast::channel(8);
    let hub = EventHub::new(repository.clone(), tx);

    let published = hub.publish(test_event("event-1")).await;

    assert!(published.persisted);
    assert_eq!(repository.events()[0].event_id, "event-1");
    assert!(matches!(rx.recv().await.unwrap(), WsEvent::WorkstationEvent(event) if event.event_id == "event-1"));
}

#[tokio::test]
async fn repository_failure_keeps_a_bounded_in_memory_timeline() {
    let repository = Arc::new(TestRepository::failing());
    let (tx, _) = broadcast::channel(8);
    let hub = EventHub::with_memory_limit(repository, tx, 2);
    hub.publish(test_event("one")).await;
    hub.publish(test_event("two")).await;
    hub.publish(test_event("three")).await;

    assert_eq!(hub.memory_events().await.len(), 2);
    assert_eq!(hub.memory_events().await[0].event_id, "three");
}
```

**Step 2: Verify failure**

Run: `cargo test control::event_hub::tests --offline`

Expected: FAIL because Event Hub and `WsEvent::WorkstationEvent` do not exist.

**Step 3: Implement Event Hub**

- Add `WorkstationEvent(WorkstationEvent)` to the existing `WsEvent` enum without renaming old variants.
- Persist using `spawn_blocking`.
- Broadcast the exact event after the persistence attempt.
- On storage failure, retain a newest-first `VecDeque` with a fixed cap and set a degraded flag.
- Prevent a storage-failure event from recursively trying to publish itself; log the repository error with `tracing`.
- Add a list method that merges in-memory fallback events with persistent results by `event_id`.

No special handling is required in `handle_socket`: the current broadcast forwarding already serializes new `WsEvent` variants.

**Step 4: Run tests**

Run: `cargo test control::event_hub::tests --offline`

Expected: PASS.

Run: `cargo test --offline`

Expected: PASS; old WebSocket serialization tests remain unchanged.

**Step 5: Commit**

```bash
git add src/control src/types.rs src/server/ws.rs
git commit -m "feat: add persistent workstation event hub"
```

### Task 4: Implement risk policy and one-time confirmations

**Files:**

- Create: `src/control/policy.rs`
- Modify: `src/control/mod.rs`

**Step 1: Write policy tests**

```rust
#[tokio::test]
async fn safe_actions_are_allowed_without_a_ticket() {
    let policy = PolicyEngine::new(Duration::from_secs(60));
    assert_eq!(policy.authorize("req", "snapshot.create", ActionRisk::Safe, None).await, PolicyDecision::Allowed);
}

#[tokio::test]
async fn dangerous_actions_require_a_single_use_bound_ticket() {
    let policy = PolicyEngine::new(Duration::from_secs(60));
    let challenge = policy.challenge("req-1", "process.kill", params_hash(42)).await;

    assert_eq!(policy.authorize_bound("req-1", "process.kill", params_hash(42), Some(&challenge.token)).await, PolicyDecision::Allowed);
    assert_eq!(policy.authorize_bound("req-1", "process.kill", params_hash(42), Some(&challenge.token)).await, PolicyDecision::Denied);
}

#[tokio::test]
async fn a_ticket_cannot_be_replayed_for_other_parameters() {
    // Issue for PID 42, then assert PID 43 is denied.
}
```

**Step 2: Verify failure**

Run: `cargo test control::policy::tests --offline`

Expected: FAIL because the policy types are missing.

**Step 3: Implement policy**

- Store pending challenges in an in-memory map protected by `tokio::sync::Mutex`.
- Generate at least 128 bits of random ticket entropy using UUID v4 values.
- Bind each ticket to `request_id`, `action_id`, a canonical parameters hash, and expiry.
- Consume tickets atomically before executing the action.
- Return structured decisions: `Allowed`, `ConfirmationRequired(challenge)`, or `Denied(reason_code)`.
- Administrator-required actions still need confirmation and must never imply privilege escalation; the executor reports unavailable when the process lacks required permissions.

**Step 4: Run tests**

Run: `cargo test control::policy::tests --offline`

Expected: PASS, including replay, expiry, and parameter-binding cases.

**Step 5: Commit**

```bash
git add src/control/mod.rs src/control/policy.rs
git commit -m "feat: enforce action confirmation policy"
```

### Task 5: Add the action registry and first built-in actions

**Files:**

- Create: `src/control/actions.rs`
- Modify: `src/control/mod.rs`
- Modify: `src/collectors/processes.rs`
- Modify: `src/collectors/save_point.rs`
- Modify: `src/collectors/cleaner.rs`

**Step 1: Write registry tests with injected executors**

Test catalog discovery, unknown actions, parameter validation, confirmation, idempotency, success events, and failure events:

```rust
#[tokio::test]
async fn duplicate_request_ids_return_the_original_result() {
    let executor = Arc::new(CountingExecutor::success());
    let control = test_control_plane(executor.clone());
    let request = request("request-1", "snapshot.create", json!({"project_path": "/tmp/repo"}));

    let first = control.execute(request.clone()).await.unwrap();
    let second = control.execute(request).await.unwrap();

    assert_eq!(first.result.request_id, second.result.request_id);
    assert_eq!(executor.calls(), 1);
}

#[tokio::test]
async fn process_kill_returns_a_confirmation_challenge_before_execution() {
    let response = control.execute(request("request-2", "process.kill", json!({"pid": 42}))).await.unwrap();
    assert_eq!(response.status, ActionExecutionStatus::ConfirmationRequired);
    assert!(response.confirmation.is_some());
}
```

**Step 2: Verify failure**

Run: `cargo test control::actions::tests --offline`

Expected: FAIL because registry and executor contracts do not exist.

**Step 3: Implement the catalog and adapters**

Register these initial actions:

| Action ID           | Existing implementation              | Risk                   |
| ------------------- | ------------------------------------ | ---------------------- |
| `app.open`          | validated logic from `post_open_app` | Safe                   |
| `snapshot.create`   | `SavePointManager::create_snapshot`  | Safe                   |
| `process.kill`      | `kill_process`                       | Confirmation required  |
| `port.kill`         | `kill_process_by_port`               | Confirmation required  |
| `cleaner.clean`     | `SystemCleaner::clean`               | Confirmation required  |
| `network.flush_dns` | current flush-DNS command path       | Administrator required |

Move reusable operation logic out of Axum handlers only when needed, keeping thin handlers and all old response shapes. Parameter parsing uses dedicated serde structs and rejects unknown or missing required fields with a stable `invalid_parameters` code.

Execution order:

1. Look for an existing `request_id` result.
2. Resolve definition and verify current availability.
3. Validate parameters and calculate canonical hash.
4. Ask Policy Engine for a decision.
5. Publish `action_requested` or `action_confirmation_required`.
6. Execute once.
7. Persist result.
8. Publish `action_succeeded` or `action_failed` with the same `correlation_id`.

Never put raw environment values, API keys, full command output, or confirmation tokens into event payloads.

**Step 4: Run focused and full tests**

Run: `cargo test control::actions::tests --offline`

Expected: PASS.

Run: `cargo test collectors:: --offline`

Expected: PASS; collector safety tests remain green.

**Step 5: Commit**

```bash
git add src/control src/collectors/processes.rs src/collectors/save_point.rs src/collectors/cleaner.rs
git commit -m "feat: register safe and guarded workstation actions"
```

### Task 6: Attach ControlPlane and expose additive APIs

**Files:**

- Modify: `src/control/mod.rs`
- Modify: `src/server/ws.rs`
- Modify: `src/server/router.rs`
- Modify: `src/main.rs`

**Step 1: Add failing router tests**

Extend `src/server/router.rs` test helpers to create a temporary ControlPlane. Add tests for:

```rust
#[tokio::test]
async fn action_catalog_is_available_without_changing_existing_routes() {
    let response = build_router(test_state())
        .oneshot(Request::builder().uri("/api/control/actions").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn dangerous_action_api_returns_confirmation_required() {
    let body = serde_json::json!({
        "request_id": "request-1",
        "action_id": "process.kill",
        "parameters": {"pid": 999999}
    });
    // POST /api/control/actions/execute and assert 202 plus confirmation_required.
}

#[tokio::test]
async fn existing_status_route_keeps_its_response_shape() {
    // Seed latest_stats, call /api/status, and assert there is no control envelope.
}
```

**Step 2: Run and verify failure**

Run: `cargo test server::router::tests::action_catalog_is_available_without_changing_existing_routes --offline`

Expected: FAIL with 404.

**Step 3: Wire application state and routes**

Add `pub control: Arc<ControlPlane>` to `AppState`. Initialize the database and ControlPlane in `main` after privilege drop and before spawning collectors.

Add routes:

```text
GET  /api/control/events
GET  /api/control/actions
GET  /api/control/actions/:request_id
POST /api/control/actions/execute
```

Status mapping:

- Catalog and event list: `200 OK`.
- Completed action: `200 OK`.
- Confirmation challenge: `202 Accepted`.
- Invalid parameters: `400 Bad Request`.
- Unknown action: `404 Not Found`.
- Expired/replayed/invalid confirmation: `403 Forbidden`.
- Internal storage/execution failure: `500 Internal Server Error` with a non-sensitive code.

Publish a `service_started` event after the listener is ready, containing only port, bind mode, version, and sniffer availability.

**Step 4: Run route and compatibility tests**

Run: `cargo test server::router::tests --offline`

Expected: PASS for new control APIs and all existing origin/update tests.

Run: `cargo test --offline`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/control src/server/ws.rs src/server/router.rs src/main.rs
git commit -m "feat: expose workstation control APIs"
```

### Task 7: Route existing mutation endpoints through the registry

**Files:**

- Modify: `src/server/router.rs`
- Modify: `src/control/actions.rs`

**Step 1: Write compatibility tests before refactoring**

For each migrated endpoint, capture and assert its current status code and response keys. At minimum cover:

- `/api/process/kill`
- `/api/port/kill`
- `/api/cleaner/clean`
- `/api/projects/snapshots/create`
- `/api/tools/open-app`

Use injectable fake executors so tests never kill a real PID or modify files. Assert that a successful old endpoint also creates exactly one action result and correlated timeline events.

**Step 2: Verify the new audit assertions fail**

Run: `cargo test server::router::tests::legacy_mutation --offline`

Expected: FAIL because legacy endpoints do not yet write the unified audit chain.

**Step 3: Refactor handlers into compatibility adapters**

- Generate a server-side `request_id` for legacy requests.
- Execute through Action Registry.
- Preserve the old JSON response exactly.
- Preserve existing browser-origin middleware.
- Keep the new confirmation handshake exclusive to `/api/control/actions/execute`; legacy endpoints continue using the existing frontend confirmation modal, but must pass an internal trusted-local confirmation context after the user has confirmed in the existing UI.
- Do not allow a raw HTTP header to mint trusted-local confirmation; the adapter path is internal Rust code only.

**Step 4: Run compatibility tests**

Run: `cargo test server::router::tests --offline`

Expected: PASS, including old response-shape and origin protections.

Run: `cargo test --offline`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/control/actions.rs src/server/router.rs
git commit -m "refactor: audit existing workstation mutations"
```

### Task 8: Add frontend control contracts and store APIs

**Files:**

- Modify: `frontend/src/constants/index.ts`
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/services/store.ts`
- Create: `frontend/tests/control-store.regression.test.ts`

**Step 1: Write failing store tests**

```ts
test("control event fetch encodes filters and replaces the initial page", async () => {
  const requests: string[] = [];
  globalThis.fetch = async (input) => {
    requests.push(String(input));
    return Response.json({ items: [eventFixture], next_cursor: null });
  };

  await fetchWorkstationEventsApi({ severity: "warning", limit: 25 });

  assert.match(requests[0], /\/api\/control\/events/);
  assert.match(requests[0], /severity=warning/);
  assert.equal(workstationEvents()[0].event_id, eventFixture.event_id);
});

test("confirmation-required actions are not reported as failures", async () => {
  globalThis.fetch = async () =>
    Response.json(
      {
        status: "confirmation_required",
        confirmation: { token: "redacted", expires_at: 1 },
      },
      { status: 202 },
    );
  const response = await executeControlActionApi(requestFixture);
  assert.equal(response.status, "confirmation_required");
});
```

Restore `globalThis.fetch` after every test.

**Step 2: Verify failure**

Run: `bun --cwd frontend test tests/control-store.regression.test.ts`

Expected: FAIL because types, signals, and APIs are missing.

**Step 3: Add constants, types, and state**

Add endpoint constants for event list, catalog, result, and execution. Add TypeScript equivalents of every Rust control contract, including the `WorkstationEvent` WebSocket union member.

Add store state:

```ts
export const [workstationEvents, setWorkstationEvents] = createSignal<
  WorkstationEvent[]
>([]);
export const [controlActions, setControlActions] = createSignal<
  ActionDefinition[]
>([]);
export const [isLoadingEvents, setIsLoadingEvents] = createSignal(false);
export const [isCommandPaletteOpen, setIsCommandPaletteOpen] =
  createSignal(false);
```

Implement `fetchWorkstationEventsApi`, `fetchControlActionsApi`, `executeControlActionApi`, and `confirmControlActionApi`. WebSocket event handling prepends unseen event IDs and caps the live list at 200.

Do not expose confirmation tokens in Toast messages or logs.

**Step 4: Run tests**

Run: `bun --cwd frontend test tests/control-store.regression.test.ts tests/store.regression.test.ts`

Expected: PASS.

Run: `bun --cwd frontend run i18n:check`

Expected: PASS; no dictionary change is required yet.

**Step 5: Commit**

```bash
git add frontend/src/constants/index.ts frontend/src/types/index.ts frontend/src/services/store.ts frontend/tests/control-store.regression.test.ts
git commit -m "feat: add frontend control-plane store"
```

### Task 9: Build the Activity timeline page

**Files:**

- Create: `frontend/src/utils/activity.ts`
- Create: `frontend/src/components/ActivityTimeline.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/components/Icons.tsx`
- Modify: `frontend/src/constants/index.ts`
- Modify: `frontend/src/i18n/dict/zh.ts`
- Modify: `frontend/src/i18n/dict/en.ts`
- Create: `frontend/tests/activity-timeline.regression.test.ts`

**Step 1: Write failing pure utility tests**

```ts
test("timeline groups correlated action events together without mutating input", () => {
  const input = [failedEvent, requestedEvent, unrelatedEvent];
  const snapshot = structuredClone(input);
  const groups = groupActivityEvents(input);

  assert.equal(
    groups.find((group) => group.correlationId === "corr-1")?.events.length,
    2,
  );
  assert.deepEqual(input, snapshot);
});

test("severity and source filters compose", () => {
  assert.deepEqual(
    filterActivityEvents(events, {
      severity: "warning",
      source: "actions",
    }).map((event) => event.event_id),
    ["matching-event"],
  );
});
```

Add a source regression assertion that `ActivityTimeline.tsx` imports icons only from `./Icons` and contains no hardcoded user-facing JSX text.

**Step 2: Verify failure**

Run: `bun --cwd frontend test tests/activity-timeline.regression.test.ts`

Expected: FAIL because utility and component files do not exist.

**Step 3: Implement timeline UX**

- Add `NavSectionId.ACTIVITY` and `RoutePath.ACTIVITY` plus both direction maps.
- Add the route to `App.tsx` and one sidebar item labeled through `t().sidebar.navActivity`.
- Export `TimelineIcon`, `WarningIcon`, `SuccessIcon`, and `FailureIcon` aliases from `Icons.tsx`.
- Fetch the first page on mount; use WebSocket additions for live updates.
- Provide severity, source, and device filters; group by correlation ID; show timestamp, source, status, duration, and a safe payload summary.
- Add a load-more action using the opaque next cursor.
- Show explicit loading, empty, degraded-storage, and fetch-error states.
- Never render confirmation tokens or arbitrary raw JSON by default.

Add all timeline and navigation strings to both dictionaries with identical key structure.

**Step 4: Run frontend gates**

Run: `bun --cwd frontend test tests/activity-timeline.regression.test.ts tests/i18n-hardcoded.regression.test.ts`

Expected: PASS.

Run: `bun --cwd frontend run lint`

Expected: PASS.

Run: `bun --cwd frontend run build`

Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src frontend/tests/activity-timeline.regression.test.ts
git commit -m "feat: add workstation activity timeline"
```

### Task 10: Build the global command palette and confirmation flow

**Files:**

- Create: `frontend/src/utils/command-palette.ts`
- Create: `frontend/src/components/CommandPalette.tsx`
- Modify: `frontend/src/components/AppLayout.tsx`
- Modify: `frontend/src/components/Header.tsx`
- Modify: `frontend/src/components/Icons.tsx`
- Modify: `frontend/src/services/store.ts`
- Modify: `frontend/src/i18n/dict/zh.ts`
- Modify: `frontend/src/i18n/dict/en.ts`
- Create: `frontend/tests/command-palette.regression.test.ts`

**Step 1: Write failing ranking and keyboard tests**

```ts
test("exact action id and label matches rank ahead of description matches", () => {
  const ranked = rankActions(actions, "port kill");
  assert.equal(ranked[0].id, "port.kill");
});

test("unavailable actions remain visible but cannot execute", () => {
  const item = toCommandItem(unavailableAction);
  assert.equal(item.disabled, true);
  assert.equal(item.unavailableReason, "permission_required");
});

test("command palette source wires Meta+K and Escape without leaking listeners", () => {
  const source = readFileSync(componentPath, "utf8");
  assert.match(source, /event\.metaKey/);
  assert.match(source, /event\.key\.toLowerCase\(\) === 'k'/);
  assert.match(source, /onCleanup/);
});
```

**Step 2: Verify failure**

Run: `bun --cwd frontend test tests/command-palette.regression.test.ts`

Expected: FAIL because ranking and palette files do not exist.

**Step 3: Implement palette**

- Mount one `CommandPalette` next to the existing global modals in `AppLayout`.
- Open with `⌘K`; close with Escape, overlay click, route change, or successful action.
- Fetch the action catalog on first open and retain it in store.
- Search ID, localized label, localized description, and keywords using a deterministic pure ranking function.
- Render risk and availability with text plus color.
- Collect typed parameters from the action definition; do not accept arbitrary JSON input.
- For safe actions, execute immediately after parameter validation.
- For confirmation-required actions, show the existing `ConfirmModal`; on approval, repeat the same request with the one-time token.
- For administrator-required but unavailable actions, explain the missing permission and do not execute.
- Add a Header button with a Tabler icon and visible `⌘K` shortcut hint.

All labels, descriptions, errors, parameter names, risk text, and ARIA labels come from the bilingual dictionaries.

**Step 4: Run frontend verification**

Run: `bun --cwd frontend test tests/command-palette.regression.test.ts tests/control-store.regression.test.ts tests/dialog-focus.test.ts tests/i18n-hardcoded.regression.test.ts`

Expected: PASS.

Run: `bun --cwd frontend run verify`

Expected: PASS for lint, all Bun tests, and production build.

**Step 5: Commit**

```bash
git add frontend/src frontend/tests/command-palette.regression.test.ts
git commit -m "feat: add global workstation command palette"
```

### Task 11: Add retention startup, documentation, and final regression gates

**Files:**

- Modify: `src/main.rs`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/VIBE_STUDIO_ROADMAP.md`
- Modify: `frontend/tests/accessibility.regression.test.ts`

**Step 1: Add a failing lifecycle test**

Add a backend test proving configured retention is bounded and invalid values fall back safely:

```rust
#[test]
fn event_retention_days_is_bounded() {
    assert_eq!(parse_retention_days(Some("30")), 30);
    assert_eq!(parse_retention_days(Some("0")), 1);
    assert_eq!(parse_retention_days(Some("99999")), 365);
    assert_eq!(parse_retention_days(Some("invalid")), 30);
}
```

Add accessibility source assertions for the Activity navigation label, command dialog semantics, focusable command results, and Escape handling.

**Step 2: Verify tests fail**

Run: `cargo test event_retention_days_is_bounded --offline`

Expected: FAIL because the parser is missing.

Run: `bun --cwd frontend test tests/accessibility.regression.test.ts`

Expected: FAIL until new global controls satisfy the assertions.

**Step 3: Implement lifecycle and documentation**

- Parse `WORKSTATION_EVENT_RETENTION_DAYS`, default 30, clamp to 1–365.
- Run pruning at startup and once every 24 hours through the repository.
- Document the Activity page, `⌘K`, database location, retention environment variable, confirmation behavior, and memory fallback in both READMEs.
- Update the roadmap by marking only milestone-one items complete.
- Add a changelog entry under an unreleased heading; do not bump or tag a version in this task.

**Step 4: Run the complete verification matrix**

Run: `git diff --check`

Expected: no output.

Run: `bun --cwd frontend run verify`

Expected: PASS.

Run: `cargo fmt --all -- --check`

Expected: PASS.

Run: `cargo clippy --all-targets --offline -- -D warnings`

Expected: PASS.

Run: `cargo test --offline`

Expected: PASS.

Run: `cargo build --release --offline`

Expected: PASS and `target/release/workstation-monitor` exists.

**Step 5: Manually smoke-test the completed milestone**

Run backend without auto-opening:

```bash
WORKSTATION_DATA_DIR="$(mktemp -d)" cargo run --offline -- 9527 --no-open
```

In another terminal:

```bash
bun --cwd frontend run dev
```

Verify:

1. Existing dashboard pages still load at `http://localhost:9529`.
2. Activity page receives the service-start event.
3. `⌘K` opens once and Escape closes it.
4. A safe action executes and appears in Activity.
5. A dangerous action shows its impact, requires confirmation, executes once, and produces one result chain.
6. Refreshing the page keeps persistent events.
7. Starting with an unwritable data directory shows degraded storage while live monitoring continues.

Stop both processes after the smoke test.

**Step 6: Commit**

```bash
git add src/main.rs README.md README.zh-CN.md CHANGELOG.md docs/VIBE_STUDIO_ROADMAP.md frontend/tests/accessibility.regression.test.ts
git commit -m "docs: document workstation control milestone"
```

### Task 12: Review milestone-one blast radius before continuing

**Files:**

- Review only; fix files only when a verified issue is found.

**Step 1: Inspect change scope**

Run:

```bash
git status --short
git log --oneline --decorate -12
git diff e3f2cc5...HEAD --stat
```

Expected: only milestone-one control, UI, tests, and documentation files changed.

**Step 2: Use Codebase Memory impact analysis**

Run the repository's Codebase Memory `detect_changes` against commit `e3f2cc5` with inbound direction and depth 3. Inspect affected router, WebSocket, store, layout, and navigation consumers. Call `check_index_coverage` for every changed source path; directly read any missed ranges and all excluded test/i18n files.

**Step 3: Request a code review**

Use `@superpowers:requesting-code-review`. The review scope is `e3f2cc5...HEAD`, with special attention to:

- Confirmation replay or bypass.
- Legacy endpoint compatibility.
- SQLite blocking on async executor threads.
- Secret leakage into audit events.
- Event/action duplicate execution.
- Global keyboard-listener cleanup and dialog accessibility.

**Step 4: Apply only verified fixes test-first**

For every accepted issue, add a regression test, confirm failure, implement the smallest fix, rerun focused tests, then rerun the full verification matrix.

**Step 5: Verify completion**

Use `@superpowers:verification-before-completion`, rerun every command from Task 11 Step 4, and record the actual pass counts in the handoff.

**Step 6: Commit review fixes if any**

```bash
git add <only-reviewed-files>
git commit -m "fix: harden workstation control milestone"
```

If no fixes are needed, do not create an empty commit.

## Milestone-One Completion Criteria

- The application remains a single Rust binary with bundled frontend and bundled SQLite.
- Every existing endpoint and WebSocket variant still works.
- The additive control API has stable versioned contracts.
- Duplicate action request IDs execute at most once.
- Confirmation tokens are short-lived, bound, single-use, and never logged.
- Existing mutations appear in one correlated Activity chain.
- SQLite failure degrades timeline persistence without stopping monitoring.
- Activity and command palette are fully bilingual and keyboard accessible.
- Frontend verification, Rust tests, clippy, and release build all pass.
- No version tag or push is performed until the user explicitly requests release after implementation review.
