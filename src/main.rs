use std::process::Command as ProcCommand;
use std::sync::Arc;
use std::time::Duration;
use sysinfo::System;
use tokio::sync::{broadcast, RwLock};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod collectors;
mod control;
mod server;
mod types;

use collectors::{
    start_sniffer, BatteryCollector, ConnectionsCollector, DevToolsCollector, DiskCollector,
    LatencyCollector, ProcessCollector, TrafficCollector,
};
use control::actions::ControlPlane;
use control::models::{EventKind, EventSeverity, WorkstationEvent};
use control::repository::ControlRepository;
use server::{build_router, AppState};
use types::{SystemStats, WsEvent};

fn resolve_bind_ip(configured: Option<&str>) -> Result<std::net::IpAddr, String> {
    configured
        .unwrap_or("127.0.0.1")
        .parse::<std::net::IpAddr>()
        .map_err(|e| format!("Invalid WORKSTATION_BIND_ADDR: {}", e))
}

fn socket_domain_for(ip: std::net::IpAddr) -> socket2::Domain {
    match ip {
        std::net::IpAddr::V4(_) => socket2::Domain::IPV4,
        std::net::IpAddr::V6(_) => socket2::Domain::IPV6,
    }
}

fn socket_addr_for(ip: std::net::IpAddr, port: u16) -> std::net::SocketAddr {
    std::net::SocketAddr::new(ip, port)
}

fn health_probe_ip(bind_ip: std::net::IpAddr) -> std::net::IpAddr {
    match bind_ip {
        std::net::IpAddr::V4(ip) if ip.is_unspecified() => {
            std::net::IpAddr::V4(std::net::Ipv4Addr::LOCALHOST)
        }
        std::net::IpAddr::V6(ip) if ip.is_unspecified() => {
            std::net::IpAddr::V6(std::net::Ipv6Addr::LOCALHOST)
        }
        ip => ip,
    }
}

fn dashboard_host(bind_ip: std::net::IpAddr) -> String {
    match bind_ip {
        std::net::IpAddr::V4(ip) if ip.is_unspecified() => "localhost".to_string(),
        std::net::IpAddr::V6(ip) if ip.is_unspecified() => "localhost".to_string(),
        std::net::IpAddr::V4(ip) => ip.to_string(),
        std::net::IpAddr::V6(ip) => format!("[{ip}]"),
    }
}

#[derive(Debug, PartialEq, Eq)]
enum PrivilegePlan {
    AlreadyUnprivileged,
    DropTo { uid: u32, gid: u32 },
}

fn privilege_plan(
    effective_uid: u32,
    sudo_uid: Option<&str>,
    sudo_gid: Option<&str>,
) -> Result<PrivilegePlan, String> {
    if effective_uid != 0 {
        return Ok(PrivilegePlan::AlreadyUnprivileged);
    }

    let uid = sudo_uid
        .and_then(|value| value.parse::<u32>().ok())
        .filter(|uid| *uid != 0)
        .ok_or_else(|| {
            "Refusing to expose the HTTP server as root; run as a normal user or through sudo"
                .to_string()
        })?;
    let gid = sudo_gid
        .and_then(|value| value.parse::<u32>().ok())
        .filter(|gid| *gid != 0)
        .ok_or_else(|| "Cannot determine the invoking user's non-root group".to_string())?;

    Ok(PrivilegePlan::DropTo { uid, gid })
}

#[cfg(unix)]
fn lookup_user_identity(uid: u32) -> Result<(std::ffi::CString, std::ffi::OsString), String> {
    use std::ffi::CStr;
    use std::os::unix::ffi::OsStringExt;

    let configured_size = unsafe { libc::sysconf(libc::_SC_GETPW_R_SIZE_MAX) };
    let mut buffer = vec![0_u8; configured_size.max(16_384) as usize];
    let mut passwd = unsafe { std::mem::zeroed::<libc::passwd>() };
    let mut result = std::ptr::null_mut();
    let status = unsafe {
        libc::getpwuid_r(
            uid as libc::uid_t,
            &mut passwd,
            buffer.as_mut_ptr().cast(),
            buffer.len(),
            &mut result,
        )
    };
    if status != 0 || result.is_null() || passwd.pw_name.is_null() || passwd.pw_dir.is_null() {
        return Err(format!(
            "Cannot resolve invoking user identity for uid {uid}"
        ));
    }

    let name = unsafe { CStr::from_ptr(passwd.pw_name) }.to_owned();
    let home =
        std::ffi::OsString::from_vec(unsafe { CStr::from_ptr(passwd.pw_dir) }.to_bytes().to_vec());
    Ok((name, home))
}

#[cfg(unix)]
fn drop_server_privileges_after_sniffer() -> Result<(), String> {
    let plan = privilege_plan(
        unsafe { libc::geteuid() },
        std::env::var("SUDO_UID").ok().as_deref(),
        std::env::var("SUDO_GID").ok().as_deref(),
    )?;
    let PrivilegePlan::DropTo { uid, gid } = plan else {
        return Ok(());
    };
    let (user_name, user_home) = lookup_user_identity(uid)?;
    let base_gid = libc::c_int::try_from(gid)
        .map_err(|_| format!("Invoking user's group id is out of range: {gid}"))?;

    let result = unsafe {
        if libc::initgroups(user_name.as_ptr(), base_gid) != 0 {
            return Err(format!(
                "Failed to initialize invoking user's supplementary groups: {}",
                std::io::Error::last_os_error()
            ));
        }
        if libc::setgid(gid as libc::gid_t) != 0 {
            return Err(format!(
                "Failed to drop root group privileges: {}",
                std::io::Error::last_os_error()
            ));
        }
        libc::setuid(uid as libc::uid_t)
    };
    if result != 0 {
        return Err(format!(
            "Failed to drop root user privileges: {}",
            std::io::Error::last_os_error()
        ));
    }
    if unsafe { libc::geteuid() } != uid || unsafe { libc::getegid() } != gid {
        return Err("Privilege drop verification failed".to_string());
    }

    let user_name = user_name.to_string_lossy().into_owned();
    std::env::set_var("HOME", user_home);
    std::env::set_var("USER", &user_name);
    std::env::set_var("LOGNAME", &user_name);

    tracing::info!(
        uid,
        gid,
        "Dropped root privileges after opening packet capture"
    );
    Ok(())
}

#[cfg(not(unix))]
fn drop_server_privileges_after_sniffer() -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod bind_tests {
    use super::*;

    #[test]
    fn server_binds_to_loopback_by_default() {
        assert!(resolve_bind_ip(None).unwrap().is_loopback());
    }

    #[test]
    fn server_allows_explicit_lan_bind_opt_in() {
        assert_eq!(
            resolve_bind_ip(Some("0.0.0.0")).unwrap(),
            std::net::IpAddr::V4(std::net::Ipv4Addr::UNSPECIFIED)
        );
    }

    #[test]
    fn server_uses_ipv6_socket_for_ipv6_bind_address() {
        let ip = "::1".parse().unwrap();
        assert_eq!(socket_domain_for(ip), socket2::Domain::IPV6);
        assert_eq!(
            socket_addr_for(ip, 9527),
            std::net::SocketAddr::new(ip, 9527)
        );
    }

    #[test]
    fn health_probe_uses_reachable_address_for_each_bind_mode() {
        let ipv6_loopback = "::1".parse().unwrap();
        let ipv6_unspecified = "::".parse().unwrap();
        let ipv4_unspecified = "0.0.0.0".parse().unwrap();

        assert_eq!(health_probe_ip(ipv6_loopback), ipv6_loopback);
        assert_eq!(health_probe_ip(ipv6_unspecified), ipv6_loopback);
        assert_eq!(
            health_probe_ip(ipv4_unspecified),
            "127.0.0.1".parse::<std::net::IpAddr>().unwrap()
        );
    }

    #[test]
    fn dashboard_host_uses_the_explicit_bind_address() {
        assert_eq!(
            dashboard_host("192.168.1.44".parse().unwrap()),
            "192.168.1.44"
        );
        assert_eq!(dashboard_host("::1".parse().unwrap()), "[::1]");
        assert_eq!(dashboard_host("0.0.0.0".parse().unwrap()), "localhost");
        assert_eq!(dashboard_host("::".parse().unwrap()), "localhost");
    }

    #[test]
    fn root_server_requires_a_non_root_sudo_identity_for_privilege_drop() {
        assert_eq!(
            privilege_plan(0, Some("501"), Some("20")).unwrap(),
            PrivilegePlan::DropTo { uid: 501, gid: 20 }
        );
        assert!(privilege_plan(0, None, None).is_err());
        assert!(privilege_plan(0, Some("0"), Some("0")).is_err());
        assert_eq!(
            privilege_plan(501, None, None).unwrap(),
            PrivilegePlan::AlreadyUnprivileged
        );
    }

    #[cfg(unix)]
    #[test]
    fn invoking_user_identity_resolves_to_a_named_home_directory() {
        let (name, home) = lookup_user_identity(unsafe { libc::getuid() }).unwrap();

        assert!(!name.as_bytes().is_empty());
        assert!(std::path::Path::new(&home).is_absolute());
    }
}

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

    // A sudo launch may open /dev/bpf while privileged, but the HTTP server and
    // every mutation endpoint must run as the invoking non-root user.
    drop_server_privileges_after_sniffer().map_err(std::io::Error::other)?;

    let repository = ControlRepository::open_default()
        .or_else(|error| {
            tracing::warn!(error = %error, "falling back to in-memory control database");
            ControlRepository::open_in_memory()
        })
        .map_err(|error| std::io::Error::other(error.to_string()))?;
    let control = Arc::new(ControlPlane::built_in(Arc::new(repository), tx.clone()));
    let app_state = AppState {
        tx: tx.clone(),
        control: control.clone(),
        latest_traffic: latest_traffic.clone(),
        latest_sockets: latest_sockets.clone(),
        latest_latency: latest_latency.clone(),
        latest_stats: latest_stats.clone(),
        latest_processes: latest_processes.clone(),
        latest_disks: latest_disks.clone(),
        latest_battery: latest_battery.clone(),
        latest_dev_tools: latest_dev_tools.clone(),
    };

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
    let bind_ip = resolve_bind_ip(std::env::var("WORKSTATION_BIND_ADDR").ok().as_deref())
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidInput, e))?;
    let socket_addr = socket_addr_for(bind_ip, port);
    let socket = socket2::Socket::new(
        socket_domain_for(bind_ip),
        socket2::Type::STREAM,
        Some(socket2::Protocol::TCP),
    )?;
    socket.set_reuse_address(true)?;
    #[cfg(all(unix, not(target_os = "solaris"), not(target_os = "illumos")))]
    let _ = socket.set_reuse_port(true);
    socket.set_nonblocking(true)?;
    socket.bind(&socket_addr.into())?;
    socket.listen(1024)?;
    let std_listener: std::net::TcpListener = socket.into();
    let listener = tokio::net::TcpListener::from_std(std_listener)?;

    control
        .event_hub()
        .publish(WorkstationEvent::new(
            "local",
            EventKind::ServiceStarted,
            EventSeverity::Info,
            "server",
            serde_json::json!({
                "port": port,
                "bind_mode": if bind_ip.is_loopback() { "loopback" } else { "lan" },
                "version": env!("CARGO_PKG_VERSION"),
                "sniffer_active": sniffer_active,
            }),
        ))
        .await;

    let dashboard_host = dashboard_host(bind_ip);
    println!("\n╔══════════════════════════════════════════════════════════════╗");
    println!("║       🚀 macOS 全局本机总控台 (Mission Control Pro)          ║");
    println!("╠══════════════════════════════════════════════════════════════╣");
    println!("║  • Web Dashboard:  http://{}:{}", dashboard_host, port);
    println!("║  • WebSocket Feed: ws://{}:{}/ws", dashboard_host, port);
    println!(
        "║  • REST API:       http://{}:{}/api/status",
        dashboard_host, port
    );
    if sniffer_active {
        println!(
            "║  • Packet Sniffer: ✅ Active ({})",
            sniffer_dev.unwrap_or_default()
        );
    } else {
        println!("║  • Packet Sniffer: ⚠️ Disabled (Run with sudo to enable)    ║");
    }
    println!("╚══════════════════════════════════════════════════════════════╝\n");

    // Auto-open the dashboard in the default browser once the server is actually
    // listening, so double-clicking the bundled .app just works without a transient
    // "cannot connect" error. We poll the port in a background task instead of
    // opening before `axum::serve` starts.
    let no_open = std::env::args().any(|a| a == "--no-open" || a == "-n")
        || std::env::var("WORKSTATION_NO_OPEN")
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(false);

    if !no_open {
        let dashboard_url = format!("http://{}:{}", dashboard_host, port);
        let listen_addr = std::net::SocketAddr::new(health_probe_ip(bind_ip), port);
        tokio::spawn(async move {
            for _ in 0..100 {
                if tokio::net::TcpStream::connect(listen_addr).await.is_ok() {
                    if let Err(e) = open::that(&dashboard_url) {
                        tracing::warn!(
                            "failed to auto-open browser ({}), trying `open` command",
                            e
                        );
                        let _ = ProcCommand::new("open").arg(&dashboard_url).spawn();
                    }
                    return;
                }
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            }
            tracing::warn!(
                "server did not become reachable; skipping auto-open of {}",
                dashboard_url
            );
        });
    } else {
        tracing::info!("Auto-open browser skipped via --no-open / WORKSTATION_NO_OPEN");
    }

    axum::serve(listener, router).await?;

    Ok(())
}
