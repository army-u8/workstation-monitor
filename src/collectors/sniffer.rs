use std::sync::atomic::{AtomicU64, Ordering};
use tokio::sync::broadcast;
use crate::types::{CapturedPacket, WsEvent};

static PACKET_ID: AtomicU64 = AtomicU64::new(1);

pub struct SnifferHandle {
    pub active: bool,
    pub device_name: Option<String>,
    pub error_msg: Option<String>,
}

pub fn start_sniffer(tx: broadcast::Sender<WsEvent>) -> SnifferHandle {
    // Attempt to find active network device on macOS
    let devices = match pcap::Device::list() {
        Ok(d) => d,
        Err(e) => {
            return SnifferHandle {
                active: false,
                device_name: None,
                error_msg: Some(format!("Failed to list network devices: {}", e)),
            };
        }
    };

    // Prefer active interface like en0, en1, or first default
    let target_device = devices
        .into_iter()
        .find(|d| d.name == "en0" || (!d.addresses.is_empty() && !d.name.starts_with("lo")));

    let dev = match target_device {
        Some(d) => d,
        None => match pcap::Device::lookup() {
            Ok(Some(d)) => d,
            Ok(None) | Err(_) => {
                return SnifferHandle {
                    active: false,
                    device_name: None,
                    error_msg: Some("No suitable network interface found for capture".to_string()),
                };
            }
        },
    };

    let dev_name = dev.name.clone();

    // Try to open capture handle
    let cap = match pcap::Capture::from_device(dev)
        .and_then(|c| c.promisc(false).snaplen(128).timeout(100).open())
    {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!("Packet sniffer could not start on {}: {}. Run with sudo for raw packet sniffing.", dev_name, e);
            return SnifferHandle {
                active: false,
                device_name: Some(dev_name),
                error_msg: Some(format!("Permission denied on /dev/bpf ({}) - Run with sudo to enable deep packet sniffer", e)),
            };
        }
    };

    // Spawn blocking capture loop
    let dev_name_clone = dev_name.clone();
    std::thread::spawn(move || {
        let mut cap = cap;
        let mut last_emit = std::time::Instant::now();
        let mut emit_count_per_sec = 0;

        while let Ok(packet) = cap.next_packet() {
            // Rate limit packet broadcast to max 60 packets/sec to keep UI silky smooth
            let now = std::time::Instant::now();
            if now.duration_since(last_emit).as_millis() >= 1000 {
                last_emit = now;
                emit_count_per_sec = 0;
            }
            if emit_count_per_sec >= 60 {
                continue;
            }

            if let Some(parsed) = parse_ethernet_packet(packet.data) {
                emit_count_per_sec += 1;
                let _ = tx.send(WsEvent::PacketEvent(parsed));
            }
        }
    });

    SnifferHandle {
        active: true,
        device_name: Some(dev_name_clone),
        error_msg: None,
    }
}

fn parse_ethernet_packet(data: &[u8]) -> Option<CapturedPacket> {
    if data.len() < 14 {
        return None;
    }

    let ethertype = u16::from_be_bytes([data[12], data[13]]);
    let (src_ip, dst_ip, proto_num, l4_offset) = match ethertype {
        0x0800 => {
            // IPv4
            if data.len() < 34 {
                return None;
            }
            let ihl = (data[14] & 0x0F) as usize * 4;
            let proto = data[23];
            let src = format!("{}.{}.{}.{}", data[26], data[27], data[28], data[29]);
            let dst = format!("{}.{}.{}.{}", data[30], data[31], data[32], data[33]);
            (src, dst, proto, 14 + ihl)
        }
        0x86dd => {
            // IPv6
            if data.len() < 54 {
                return None;
            }
            let next_header = data[20];
            let src = "IPv6 Source".to_string();
            let dst = "IPv6 Dest".to_string();
            (src, dst, next_header, 54)
        }
        0x0806 => {
            // ARP
            return Some(CapturedPacket {
                id: PACKET_ID.fetch_add(1, Ordering::Relaxed),
                timestamp: chrono::Utc::now().timestamp_millis(),
                protocol: "ARP".to_string(),
                src_ip: "Broadcast".to_string(),
                src_port: None,
                dst_ip: "Network".to_string(),
                dst_port: None,
                length: data.len(),
                info: "Address Resolution Protocol".to_string(),
            });
        }
        _ => return None,
    };

    let mut src_port = None;
    let mut dst_port = None;
    let mut proto_name = "IP".to_string();
    let mut info = String::new();

    if data.len() >= l4_offset + 4 {
        let sp = u16::from_be_bytes([data[l4_offset], data[l4_offset + 1]]);
        let dp = u16::from_be_bytes([data[l4_offset + 2], data[l4_offset + 3]]);
        src_port = Some(sp);
        dst_port = Some(dp);

        match proto_num {
            6 => {
                // TCP
                let flags = if data.len() >= l4_offset + 14 {
                    let f = data[l4_offset + 13];
                    let mut flags_vec = Vec::new();
                    if f & 0x02 != 0 { flags_vec.push("SYN"); }
                    if f & 0x10 != 0 { flags_vec.push("ACK"); }
                    if f & 0x01 != 0 { flags_vec.push("FIN"); }
                    if f & 0x04 != 0 { flags_vec.push("RST"); }
                    if f & 0x08 != 0 { flags_vec.push("PSH"); }
                    flags_vec.join(",")
                } else {
                    "".to_string()
                };

                if sp == 443 || dp == 443 || sp == 8443 || dp == 8443 {
                    proto_name = "TLS/HTTPS".to_string();
                    info = format!("TLS Traffic [{}]", flags);
                } else if sp == 80 || dp == 80 || sp == 8080 || dp == 8080 || sp == 3000 || dp == 3000 {
                    proto_name = "HTTP".to_string();
                    info = format!("HTTP Stream [{}]", flags);
                } else if sp == 22 || dp == 22 {
                    proto_name = "SSH".to_string();
                    info = format!("SSH Secure Shell [{}]", flags);
                } else {
                    proto_name = "TCP".to_string();
                    info = format!("TCP Stream [{}]", flags);
                }
            }
            17 => {
                // UDP
                if sp == 53 || dp == 53 {
                    proto_name = "DNS".to_string();
                    info = "Standard DNS Query/Response".to_string();
                } else if sp == 123 || dp == 123 {
                    proto_name = "NTP".to_string();
                    info = "Network Time Protocol".to_string();
                } else if sp == 443 || dp == 443 {
                    proto_name = "QUIC/HTTP3".to_string();
                    info = "QUIC Encrypted Datagram".to_string();
                } else {
                    proto_name = "UDP".to_string();
                    info = "User Datagram Protocol".to_string();
                }
            }
            1 => {
                proto_name = "ICMP".to_string();
                info = "Internet Control Message (Ping)".to_string();
            }
            _ => {
                proto_name = format!("PROTO-{}", proto_num);
            }
        }
    }

    Some(CapturedPacket {
        id: PACKET_ID.fetch_add(1, Ordering::Relaxed),
        timestamp: chrono::Utc::now().timestamp_millis(),
        protocol: proto_name,
        src_ip,
        src_port,
        dst_ip,
        dst_port,
        length: data.len(),
        info,
    })
}
