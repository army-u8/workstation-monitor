use crate::types::ProcessInfo;
use netstat2::{get_sockets_info, AddressFamilyFlags, ProtocolFlags, ProtocolSocketInfo};
use std::process::Command;
use sysinfo::{Pid, ProcessStatus, System};

pub struct ProcessCollector {
    system: System,
}

impl ProcessCollector {
    pub fn new() -> Self {
        let mut system = System::new();
        system.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
        Self { system }
    }

    pub fn collect(&mut self) -> Vec<ProcessInfo> {
        self.system
            .refresh_processes(sysinfo::ProcessesToUpdate::All, true);
        let total_mem = self.system.total_memory() as f32;

        let mut list: Vec<ProcessInfo> = self
            .system
            .processes()
            .iter()
            .map(|(pid, proc_)| {
                let mem_bytes = proc_.memory();
                let mem_pct = if total_mem > 0.0 {
                    (mem_bytes as f32 / total_mem) * 100.0
                } else {
                    0.0
                };

                let disk_usage = proc_.disk_usage();
                let status_str = match proc_.status() {
                    ProcessStatus::Run => "Running",
                    ProcessStatus::Sleep => "Sleeping",
                    ProcessStatus::Idle => "Idle",
                    ProcessStatus::Zombie => "Zombie",
                    ProcessStatus::Stop => "Stopped",
                    _ => "Unknown",
                };

                ProcessInfo {
                    pid: pid.as_u32(),
                    name: proc_.name().to_string_lossy().to_string(),
                    cpu_usage: proc_.cpu_usage(),
                    memory_bytes: mem_bytes,
                    memory_percent: mem_pct,
                    disk_read_bytes: disk_usage.read_bytes,
                    disk_written_bytes: disk_usage.written_bytes,
                    status: status_str.to_string(),
                }
            })
            .collect();

        // Sort primarily by CPU usage, and then by Memory
        list.sort_by(|a, b| {
            b.cpu_usage
                .partial_cmp(&a.cpu_usage)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then(b.memory_bytes.cmp(&a.memory_bytes))
        });

        // Limit to top 50 active processes
        list.truncate(50);
        list
    }
}

pub fn kill_process(pid: u32) -> Result<(), String> {
    let mut system = System::new();
    system.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    let sys_pid = Pid::from_u32(pid);
    if let Some(proc_) = system.process(sys_pid) {
        if proc_.kill() {
            return Ok(());
        }
    }

    // Fallback: execute macOS standard kill -15 command
    let res = Command::new("kill")
        .arg("-15")
        .arg(pid.to_string())
        .output();

    match res {
        Ok(out) if out.status.success() => Ok(()),
        Ok(out) => {
            let err = String::from_utf8_lossy(&out.stderr);
            Err(format!("终止进程 PID {} 失败: {}", pid, err.trim()))
        }
        Err(e) => Err(format!("无法执行 kill 指令: {}", e)),
    }
}

pub fn kill_process_by_port(port: u16) -> Result<Vec<u32>, String> {
    let af_flags = AddressFamilyFlags::IPV4 | AddressFamilyFlags::IPV6;
    let proto_flags = ProtocolFlags::TCP | ProtocolFlags::UDP;

    let mut killed_pids = Vec::new();

    if let Ok(sockets) = get_sockets_info(af_flags, proto_flags) {
        for s in sockets {
            let matches_port = match s.protocol_socket_info {
                ProtocolSocketInfo::Tcp(tcp) => tcp.local_port == port,
                ProtocolSocketInfo::Udp(udp) => udp.local_port == port,
            };

            if matches_port {
                for pid in s.associated_pids {
                    if !killed_pids.contains(&pid) {
                        let _ = kill_process(pid);
                        killed_pids.push(pid);
                    }
                }
            }
        }
    }

    if killed_pids.is_empty() {
        Err(format!("未发现正在监听或占用端口 :{} 的进程", port))
    } else {
        Ok(killed_pids)
    }
}
