use std::sync::Arc;
use std::time::Duration;
use sysinfo::System;
use std::process::Command as ProcCommand;
use tokio::sync::{broadcast, RwLock};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod collectors;
mod server;
mod types;

use collectors::{
    start_sniffer, BatteryCollector, ConnectionsCollector, DevToolsCollector, DiskCollector,
    LatencyCollector, ProcessCollector, TrafficCollector,
};
use server::{build_router, AppState};
use types::{SystemStats, WsEvent};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "workstation_monitor=info,tower_http=warn".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting macOS Workstation Mission Control...");

    let (tx, _rx) = broadcast::channel::<WsEvent>(1000);

    let latest_traffic = Arc::new(RwLock::new(None));
    let latest_sockets = Arc::new(RwLock::new(None));
    let latest_latency = Arc::new(RwLock::new(Vec::new()));
    let latest_stats = Arc::new(RwLock::new(None));
    let latest_processes = Arc::new(RwLock::new(Vec::new()));
    let latest_disks = Arc::new(RwLock::new(Vec::new()));
    let latest_battery = Arc::new(RwLock::new(None));
    let latest_dev_tools = Arc::new(RwLock::new(Vec::new()));

    let app_state = AppState {
        tx: tx.clone(),
        latest_traffic: latest_traffic.clone(),
        latest_sockets: latest_sockets.clone(),
        latest_latency: latest_latency.clone(),
        latest_stats: latest_stats.clone(),
        latest_processes: latest_processes.clone(),
        latest_disks: latest_disks.clone(),
        latest_battery: latest_battery.clone(),
        latest_dev_tools: latest_dev_tools.clone(),
    };

    // 1. Start Libpcap Sniffer (Runs in background thread if permissions allow)
    let sniffer_handle = start_sniffer(tx.clone());
    let sniffer_active = sniffer_handle.active;
    let sniffer_dev = sniffer_handle.device_name.clone();
    let sniffer_err = sniffer_handle.error_msg.clone();

    if sniffer_active {
        tracing::info!("Packet sniffer started on device: {:?}", sniffer_dev);
    } else {
        tracing::warn!("Packet sniffer inactive: {:?}", sniffer_err);
    }

    // 2. Background Task: System Stats & Traffic Sampling (1000ms ticker)
    {
        let tx = tx.clone();
        let latest_traffic = latest_traffic.clone();
        let latest_stats = latest_stats.clone();
        let sniffer_dev = sniffer_dev.clone();
        let sniffer_err = sniffer_err.clone();

        tokio::spawn(async move {
            let mut traffic_collector = TrafficCollector::new();
            let mut system = System::new_all();
            let mut ticker = tokio::time::interval(Duration::from_millis(1000));

            loop {
                ticker.tick().await;

                // Collect traffic
                let traffic = traffic_collector.collect();
                *latest_traffic.write().await = Some(traffic.clone());
                let _ = tx.send(WsEvent::TrafficUpdate(traffic));

                // Collect system overview
                system.refresh_cpu_usage();
                system.refresh_memory();

                let cpu_usage = system.global_cpu_usage();
                let memory_used = system.used_memory();
                let memory_total = system.total_memory();
                let memory_percent = if memory_total > 0 {
                    (memory_used as f32 / memory_total as f32) * 100.0
                } else {
                    0.0
                };
                let uptime_secs = System::uptime();
                let os_name = System::name().unwrap_or_else(|| "macOS".to_string());
                let host_name = System::host_name().unwrap_or_else(|| "localhost".to_string());

                let stats = SystemStats {
                    cpu_usage,
                    memory_used,
                    memory_total,
                    memory_percent,
                    uptime_secs,
                    os_name,
                    host_name,
                    sniffer_active,
                    sniffer_device: sniffer_dev.clone(),
                    sniffer_error: sniffer_err.clone(),
                };

                *latest_stats.write().await = Some(stats.clone());
                let _ = tx.send(WsEvent::SystemStatsUpdate(stats));
            }
        });
    }

    // 3. Background Task: Connections & Ports Scanner (2000ms ticker)
    {
        let tx = tx.clone();
        let latest_sockets = latest_sockets.clone();

        tokio::spawn(async move {
            let mut connections_collector = ConnectionsCollector::new();
            let mut ticker = tokio::time::interval(Duration::from_millis(2000));

            loop {
                ticker.tick().await;
                let sockets = connections_collector.collect();
                *latest_sockets.write().await = Some(sockets.clone());
                let _ = tx.send(WsEvent::SocketsUpdate(sockets));
            }
        });
    }

    // 4. Background Task: Latency & Health Prober (5000ms ticker)
    {
        let tx = tx.clone();
        let latest_latency = latest_latency.clone();

        tokio::spawn(async move {
            let latency_collector = LatencyCollector::new();
            let mut ticker = tokio::time::interval(Duration::from_millis(5000));

            loop {
                ticker.tick().await;
                let latency_results = latency_collector.collect().await;
                *latest_latency.write().await = latency_results.clone();
                let _ = tx.send(WsEvent::LatencyUpdate(latency_results));
            }
        });
    }

    // 5. Background Task: Process & Top Resources Manager (2000ms ticker)
    {
        let tx = tx.clone();
        let latest_processes = latest_processes.clone();

        tokio::spawn(async move {
            let mut process_collector = ProcessCollector::new();
            let mut ticker = tokio::time::interval(Duration::from_millis(2000));

            loop {
                ticker.tick().await;
                let procs = process_collector.collect();
                *latest_processes.write().await = procs.clone();
                let _ = tx.send(WsEvent::ProcessesUpdate(procs));
            }
        });
    }

    // 6. Background Task: Disk & Volume Storage (10000ms ticker)
    {
        let tx = tx.clone();
        let latest_disks = latest_disks.clone();

        tokio::spawn(async move {
            let mut disk_collector = DiskCollector::new();
            let mut ticker = tokio::time::interval(Duration::from_millis(10000));

            loop {
                let disks = disk_collector.collect();
                *latest_disks.write().await = disks.clone();
                let _ = tx.send(WsEvent::DisksUpdate(disks));
                ticker.tick().await;
            }
        });
    }

    // 7. Background Task: Battery & Power State (10000ms ticker)
    {
        let tx = tx.clone();
        let latest_battery = latest_battery.clone();

        tokio::spawn(async move {
            let battery_collector = BatteryCollector::new();
            let mut ticker = tokio::time::interval(Duration::from_millis(10000));

            loop {
                let batt = battery_collector.collect();
                *latest_battery.write().await = batt.clone();
                let _ = tx.send(WsEvent::BatteryUpdate(batt));
                ticker.tick().await;
            }
        });
    }

    // 8. Background Task: Dev Tools & Runtime Inspector (Initial + 60000ms ticker)
    {
        let tx = tx.clone();
        let latest_dev_tools = latest_dev_tools.clone();

        tokio::spawn(async move {
            let dev_collector = DevToolsCollector::new();
            let mut ticker = tokio::time::interval(Duration::from_millis(60000));

            loop {
                let tools = dev_collector.collect();
                *latest_dev_tools.write().await = tools.clone();
                let _ = tx.send(WsEvent::DevToolsUpdate(tools));
                ticker.tick().await;
            }
        });
    }

    // 9. Build Axum Router & Start HTTP/WS Server
    let router = build_router(app_state);
    let port: u16 = std::env::args()
        .nth(1)
        .and_then(|arg| arg.parse::<u16>().ok())
        .or_else(|| {
            std::env::var("PORT")
                .ok()
                .and_then(|p| p.parse::<u16>().ok())
        })
        .unwrap_or(9527);
    let bind_addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&bind_addr).await?;

    println!("\n╔══════════════════════════════════════════════════════════════╗");
    println!("║       🚀 macOS 全局本机总控台 (Mission Control Pro)          ║");
    println!("╠══════════════════════════════════════════════════════════════╣");
    println!("║  • Web Dashboard:  http://localhost:{}                   ║", port);
    println!("║  • WebSocket Feed: ws://localhost:{}/ws                     ║", port);
    println!("║  • REST API:       http://localhost:{}/api/status           ║", port);
    if sniffer_active {
        println!("║  • Packet Sniffer: ✅ Active ({})", sniffer_dev.unwrap_or_default());
    } else {
        println!("║  • Packet Sniffer: ⚠️ Disabled (Run with sudo to enable)    ║");
    }
    println!("╚══════════════════════════════════════════════════════════════╝\n");

    // Auto-open the dashboard in the default browser once the server is actually
    // listening, so double-clicking the bundled .app just works without a transient
    // "cannot connect" error. We poll the port in a background task instead of
    // opening before `axum::serve` starts.
    let dashboard_url = format!("http://localhost:{}", port);
    let listen_addr = std::net::SocketAddr::new(
        ([127, 0, 0, 1]).into(),
        port,
    );
    tokio::spawn(async move {
        for _ in 0..100 {
            if tokio::net::TcpStream::connect(listen_addr).await.is_ok() {
                if let Err(e) = open::that(&dashboard_url) {
                    tracing::warn!("failed to auto-open browser ({}), trying `open` command", e);
                    let _ = ProcCommand::new("open").arg(&dashboard_url).spawn();
                }
                return;
            }
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        }
        tracing::warn!("server did not become reachable; skipping auto-open of {}", dashboard_url);
    });

    axum::serve(listener, router).await?;

    Ok(())
}
