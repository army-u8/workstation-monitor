use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
};
use futures::{sink::SinkExt, stream::StreamExt};
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use crate::types::{
    BatteryInfo, DevToolInfo, DiskInfo, LatencyTarget, ProcessInfo, SocketsPayload, SystemStats,
    TrafficSummary, WsEvent,
};

#[derive(Clone)]
pub struct AppState {
    pub tx: broadcast::Sender<WsEvent>,
    pub latest_traffic: Arc<RwLock<Option<TrafficSummary>>>,
    pub latest_sockets: Arc<RwLock<Option<SocketsPayload>>>,
    pub latest_latency: Arc<RwLock<Vec<LatencyTarget>>>,
    pub latest_stats: Arc<RwLock<Option<SystemStats>>>,
    pub latest_processes: Arc<RwLock<Vec<ProcessInfo>>>,
    pub latest_disks: Arc<RwLock<Vec<DiskInfo>>>,
    pub latest_battery: Arc<RwLock<Option<BatteryInfo>>>,
    pub latest_dev_tools: Arc<RwLock<Vec<DevToolInfo>>>,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.tx.subscribe();

    // Send initial snapshots immediately on connect
    if let Some(stats) = state.latest_stats.read().await.clone() {
        if let Ok(msg) = serde_json::to_string(&WsEvent::SystemStatsUpdate(stats)) {
            let _ = sender.send(Message::Text(msg)).await;
        }
    }
    if let Some(traffic) = state.latest_traffic.read().await.clone() {
        if let Ok(msg) = serde_json::to_string(&WsEvent::TrafficUpdate(traffic)) {
            let _ = sender.send(Message::Text(msg)).await;
        }
    }
    if let Some(sockets) = state.latest_sockets.read().await.clone() {
        if let Ok(msg) = serde_json::to_string(&WsEvent::SocketsUpdate(sockets)) {
            let _ = sender.send(Message::Text(msg)).await;
        }
    }
    let latency = state.latest_latency.read().await.clone();
    if !latency.is_empty() {
        if let Ok(msg) = serde_json::to_string(&WsEvent::LatencyUpdate(latency)) {
            let _ = sender.send(Message::Text(msg)).await;
        }
    }
    let processes = state.latest_processes.read().await.clone();
    if !processes.is_empty() {
        if let Ok(msg) = serde_json::to_string(&WsEvent::ProcessesUpdate(processes)) {
            let _ = sender.send(Message::Text(msg)).await;
        }
    }
    let disks = state.latest_disks.read().await.clone();
    if !disks.is_empty() {
        if let Ok(msg) = serde_json::to_string(&WsEvent::DisksUpdate(disks)) {
            let _ = sender.send(Message::Text(msg)).await;
        }
    }
    if let Some(batt) = state.latest_battery.read().await.clone() {
        if let Ok(msg) = serde_json::to_string(&WsEvent::BatteryUpdate(Some(batt))) {
            let _ = sender.send(Message::Text(msg)).await;
        }
    }
    let dev_tools = state.latest_dev_tools.read().await.clone();
    if !dev_tools.is_empty() {
        if let Ok(msg) = serde_json::to_string(&WsEvent::DevToolsUpdate(dev_tools)) {
            let _ = sender.send(Message::Text(msg)).await;
        }
    }

    // Forward broadcast messages to this client
    let send_task = tokio::spawn(async move {
        while let Ok(event) = rx.recv().await {
            if let Ok(msg) = serde_json::to_string(&event) {
                if sender.send(Message::Text(msg)).await.is_err() {
                    break;
                }
            }
        }
    });

    // Handle incoming client messages (e.g. ping/pong or client queries)
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Close(_) = msg {
                break;
            }
        }
    });

    // Wait until either direction closes
    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }
}
