use crate::types::{SocketEntry, SocketsPayload};
use netstat2::{get_sockets_info, AddressFamilyFlags, ProtocolFlags, ProtocolSocketInfo, TcpState};
use std::collections::HashMap;
use sysinfo::System;

#[derive(Clone)]
struct ProcessMeta {
    name: String,
    app_name: String,
    exe_path: Option<String>,
    category: String,
}

fn resolve_process_meta(proc_: &sysinfo::Process) -> ProcessMeta {
    let raw_name = proc_.name().to_string_lossy().to_string();
    let exe_path = proc_.exe().map(|p| p.to_string_lossy().to_string());

    let mut app_name = raw_name.clone();
    let mut category = "app".to_string();

    // 1. Check if exe_path contains a macOS .app bundle
    if let Some(ref path) = exe_path {
        if let Some(idx) = path.find(".app") {
            let prefix = &path[..idx];
            if let Some(slash_idx) = prefix.rfind('/') {
                app_name = prefix[slash_idx + 1..].to_string();
            } else {
                app_name = prefix.to_string();
            }
        }
    }

    let lower_name = raw_name.to_lowercase();
    let lower_app = app_name.to_lowercase();

    // 2. Classify categories & enrich script details
    if lower_name.contains("node")
        || lower_name.contains("vite")
        || lower_name.contains("next")
        || lower_name.contains("deno")
        || lower_name.contains("bun")
        || lower_name.contains("python")
        || lower_name.contains("ruby")
        || lower_name.contains("cargo")
        || lower_name.contains("rust")
        || lower_name.contains("go")
        || lower_name.contains("java")
    {
        category = "dev".to_string();
        let cmd = proc_.cmd();
        for arg in cmd.iter().skip(1) {
            let arg_str = arg.to_string_lossy();
            if !arg_str.starts_with('-') && !arg_str.ends_with(".js.map") {
                if let Some(file_name) = arg_str.split('/').next_back() {
                    if file_name.ends_with(".js")
                        || file_name.ends_with(".ts")
                        || file_name.ends_with(".mjs")
                        || file_name.ends_with(".py")
                        || file_name.ends_with(".rs")
                        || file_name == "vite"
                        || file_name == "next"
                        || file_name == "dev"
                    {
                        app_name = format!("{} ({})", raw_name, file_name);
                        break;
                    }
                }
            }
        }
    } else if lower_name.contains("postgres")
        || lower_name.contains("mysql")
        || lower_name.contains("redis")
        || lower_name.contains("mongo")
        || lower_name.contains("clickhouse")
        || lower_name.contains("sqlite")
    {
        category = "db".to_string();
        if lower_name.contains("postgres") {
            app_name = "PostgreSQL".to_string();
        } else if lower_name.contains("redis") {
            app_name = "Redis".to_string();
        } else if lower_name.contains("mysql") {
            app_name = "MySQL".to_string();
        } else if lower_name.contains("mongo") {
            app_name = "MongoDB".to_string();
        }
    } else if lower_name.contains("nginx")
        || lower_name.contains("caddy")
        || lower_name.contains("apache")
        || lower_name.contains("httpd")
        || lower_name.contains("traefik")
    {
        category = "web".to_string();
        if lower_name.contains("nginx") {
            app_name = "Nginx".to_string();
        } else if lower_name.contains("caddy") {
            app_name = "Caddy Server".to_string();
        }
    } else if lower_app.contains("chrome")
        || lower_app.contains("safari")
        || lower_app.contains("firefox")
        || lower_app.contains("edge")
        || lower_app.contains("brave")
        || lower_app.contains("arc")
    {
        category = "browser".to_string();
    } else if lower_name.starts_with("com.apple.")
        || exe_path
            .as_ref()
            .map(|p| p.starts_with("/System") || p.starts_with("/usr/libexec"))
            .unwrap_or(false)
    {
        category = "sys".to_string();
    }

    ProcessMeta {
        name: raw_name,
        app_name,
        exe_path,
        category,
    }
}

pub struct ConnectionsCollector {
    system: System,
}

impl ConnectionsCollector {
    pub fn new() -> Self {
        let mut system = System::new();
        system.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
        Self { system }
    }

    pub fn collect(&mut self) -> SocketsPayload {
        self.system
            .refresh_processes(sysinfo::ProcessesToUpdate::All, true);

        // Build PID -> ProcessMeta map
        let mut pid_to_meta: HashMap<u32, ProcessMeta> = HashMap::new();
        for (pid, proc_) in self.system.processes() {
            pid_to_meta.insert(pid.as_u32(), resolve_process_meta(proc_));
        }

        let af_flags = AddressFamilyFlags::IPV4 | AddressFamilyFlags::IPV6;
        let proto_flags = ProtocolFlags::TCP | ProtocolFlags::UDP;

        let mut listening_ports = Vec::new();
        let mut active_connections = Vec::new();

        if let Ok(sockets) = get_sockets_info(af_flags, proto_flags) {
            for s in sockets {
                let pid = s.associated_pids.first().copied();
                let meta = pid.and_then(|p| pid_to_meta.get(&p).cloned());

                let process_name = meta.as_ref().map(|m| m.name.clone());
                let app_name = meta.as_ref().map(|m| m.app_name.clone());
                let exe_path = meta.as_ref().and_then(|m| m.exe_path.clone());
                let mut category = meta.as_ref().map(|m| m.category.clone());

                match s.protocol_socket_info {
                    ProtocolSocketInfo::Tcp(tcp) => {
                        let state_str = match tcp.state {
                            TcpState::Listen => "LISTEN",
                            TcpState::Established => "ESTABLISHED",
                            TcpState::SynSent => "SYN_SENT",
                            TcpState::SynReceived => "SYN_RECV",
                            TcpState::FinWait1 => "FIN_WAIT_1",
                            TcpState::FinWait2 => "FIN_WAIT_2",
                            TcpState::TimeWait => "TIME_WAIT",
                            TcpState::Closed => "CLOSED",
                            TcpState::CloseWait => "CLOSE_WAIT",
                            TcpState::LastAck => "LAST_ACK",
                            TcpState::Closing => "CLOSING",
                            _ => "UNKNOWN",
                        };

                        // Fallback category detection based on port if unknown/app
                        if category.as_deref() == Some("app") || category.is_none() {
                            if [
                                80, 443, 3000, 5173, 8000, 8080, 8443, 9527, 9528, 9529, 4173,
                            ]
                            .contains(&tcp.local_port)
                            {
                                category = Some("web".to_string());
                            } else if [3306, 5432, 6379, 27017, 9200, 9042]
                                .contains(&tcp.local_port)
                            {
                                category = Some("db".to_string());
                            }
                        }

                        let entry = SocketEntry {
                            protocol: "TCP".to_string(),
                            local_ip: tcp.local_addr.to_string(),
                            local_port: tcp.local_port,
                            remote_ip: if tcp.remote_addr.is_unspecified() && tcp.remote_port == 0 {
                                None
                            } else {
                                Some(tcp.remote_addr.to_string())
                            },
                            remote_port: if tcp.remote_port == 0 {
                                None
                            } else {
                                Some(tcp.remote_port)
                            },
                            state: state_str.to_string(),
                            pid,
                            process_name,
                            app_name,
                            exe_path,
                            category,
                        };

                        if tcp.state == TcpState::Listen {
                            listening_ports.push(entry);
                        } else {
                            active_connections.push(entry);
                        }
                    }
                    ProtocolSocketInfo::Udp(udp) => {
                        let entry = SocketEntry {
                            protocol: "UDP".to_string(),
                            local_ip: udp.local_addr.to_string(),
                            local_port: udp.local_port,
                            remote_ip: None,
                            remote_port: None,
                            state: "UDP_OPEN".to_string(),
                            pid,
                            process_name,
                            app_name,
                            exe_path,
                            category,
                        };
                        listening_ports.push(entry);
                    }
                }
            }
        }

        // Sort listening ports by local_port
        listening_ports.sort_by_key(|a| a.local_port);
        // Deduplicate duplicate UDP / wildcards if needed
        listening_ports.dedup_by(|a, b| {
            a.protocol == b.protocol
                && a.local_ip == b.local_ip
                && a.local_port == b.local_port
                && a.pid == b.pid
        });

        // Sort active connections: ESTABLISHED first, then by remote_ip
        active_connections.sort_by(|a, b| {
            let state_order_a = if a.state == "ESTABLISHED" { 0 } else { 1 };
            let state_order_b = if b.state == "ESTABLISHED" { 0 } else { 1 };
            state_order_a
                .cmp(&state_order_b)
                .then(a.local_port.cmp(&b.local_port))
        });

        SocketsPayload {
            listening_ports,
            active_connections,
            timestamp: chrono::Utc::now().timestamp_millis(),
        }
    }
}
