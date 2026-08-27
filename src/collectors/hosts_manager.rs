use crate::types::HostEntry;
use std::fs;

pub struct HostsManager;

impl HostsManager {
    pub fn read_hosts() -> Vec<HostEntry> {
        let path = "/etc/hosts";
        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => return Vec::new(),
        };

        let mut entries = Vec::new();

        for (idx, raw_line) in content.lines().enumerate() {
            let line = raw_line.trim();
            if line.is_empty() {
                continue;
            }

            let is_commented = line.starts_with('#');
            let clean = if is_commented {
                line.trim_start_matches('#').trim()
            } else {
                line
            };

            let parts: Vec<&str> = clean.split_whitespace().collect();
            if parts.len() >= 2 {
                let ip = parts[0];
                // validate if parts[0] looks like an IP
                if ip.contains('.') || ip.contains(':') {
                    for domain in &parts[1..] {
                        if !domain.starts_with('#') {
                            entries.push(HostEntry {
                                ip: ip.to_string(),
                                domain: domain.to_string(),
                                is_enabled: !is_commented,
                                line_number: idx + 1,
                            });
                        }
                    }
                }
            }
        }

        entries
    }
}
