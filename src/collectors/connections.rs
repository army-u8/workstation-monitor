use std::collections::HashMap;
use netstat2::{get_sockets_info, AddressFamilyFlags, ProtocolFlags, ProtocolSocketInfo, TcpState};
use sysinfo::System;
use crate::types::{SocketEntry, SocketsPayload};

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
        self.system.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

        // Build PID -> process name map
        let mut pid_to_name: HashMap<u32, String> = HashMap::new();
        for (pid, proc_) in self.system.processes() {
            pid_to_name.insert(pid.as_u32(), proc_.name().to_string_lossy().to_string());
        }

        let af_flags = AddressFamilyFlags::IPV4 | AddressFamilyFlags::IPV6;
        let proto_flags = ProtocolFlags::TCP | ProtocolFlags::UDP;

        let mut listening_ports = Vec::new();
        let mut active_connections = Vec::new();

        if let Ok(sockets) = get_sockets_info(af_flags, proto_flags) {
            for s in sockets {
                let pid = s.associated_pids.first().copied();
                let process_name = pid.and_then(|p| pid_to_name.get(&p).cloned());

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

                        let entry = SocketEntry {
                            protocol: "TCP".to_string(),
                            local_ip: tcp.local_addr.to_string(),
                            local_port: tcp.local_port,
                            remote_ip: if tcp.remote_addr.is_unspecified() && tcp.remote_port == 0 {
                                None
                            } else {
                                Some(tcp.remote_addr.to_string())
                            },
                            remote_port: if tcp.remote_port == 0 { None } else { Some(tcp.remote_port) },
                            state: state_str.to_string(),
                            pid,
                            process_name,
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
            a.protocol == b.protocol && a.local_ip == b.local_ip && a.local_port == b.local_port && a.pid == b.pid
        });

        // Sort active connections: ESTABLISHED first, then by remote_ip
        active_connections.sort_by(|a, b| {
            let state_order_a = if a.state == "ESTABLISHED" { 0 } else { 1 };
            let state_order_b = if b.state == "ESTABLISHED" { 0 } else { 1 };
            state_order_a.cmp(&state_order_b).then(a.local_port.cmp(&b.local_port))
        });

        SocketsPayload {
            listening_ports,
            active_connections,
            timestamp: chrono::Utc::now().timestamp_millis(),
        }
    }
}
