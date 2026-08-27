use crate::types::{InterfaceTraffic, TrafficSummary};
use std::collections::HashMap;
use std::time::Instant;
use sysinfo::Networks;

pub struct TrafficCollector {
    networks: Networks,
    prev_stats: HashMap<String, (u64, u64)>, // (total_rx, total_tx)
    prev_instant: Instant,
}

impl TrafficCollector {
    pub fn new() -> Self {
        let mut networks = Networks::new_with_refreshed_list();
        networks.refresh(true);
        let mut prev_stats = HashMap::new();
        for (name, data) in &networks {
            prev_stats.insert(
                name.to_string(),
                (data.total_received(), data.total_transmitted()),
            );
        }

        Self {
            networks,
            prev_stats,
            prev_instant: Instant::now(),
        }
    }

    pub fn collect(&mut self) -> TrafficSummary {
        self.networks.refresh(true);
        let now = Instant::now();
        let elapsed_secs = now.duration_since(self.prev_instant).as_secs_f64().max(0.1);
        self.prev_instant = now;

        let mut interfaces = Vec::new();
        let mut total_rx_speed: u64 = 0;
        let mut total_tx_speed: u64 = 0;
        let mut total_rx_bytes: u64 = 0;
        let mut total_tx_bytes: u64 = 0;

        for (name, data) in &self.networks {
            let cur_rx = data.total_received();
            let cur_tx = data.total_transmitted();

            total_rx_bytes = total_rx_bytes.saturating_add(cur_rx);
            total_tx_bytes = total_tx_bytes.saturating_add(cur_tx);

            let (prev_rx, prev_tx) = self
                .prev_stats
                .get(name)
                .cloned()
                .unwrap_or((cur_rx, cur_tx));
            self.prev_stats.insert(name.clone(), (cur_rx, cur_tx));

            let diff_rx = cur_rx.saturating_sub(prev_rx);
            let diff_tx = cur_tx.saturating_sub(prev_tx);

            let rx_speed = (diff_rx as f64 / elapsed_secs) as u64;
            let tx_speed = (diff_tx as f64 / elapsed_secs) as u64;

            // Only aggregate real interfaces to total speed (avoid duplicating if loopback or bridge)
            if !name.starts_with("lo") {
                total_rx_speed = total_rx_speed.saturating_add(rx_speed);
                total_tx_speed = total_tx_speed.saturating_add(tx_speed);
            }

            interfaces.push(InterfaceTraffic {
                name: name.clone(),
                rx_bytes: diff_rx,
                tx_bytes: diff_tx,
                rx_speed,
                tx_speed,
                total_rx: cur_rx,
                total_tx: cur_tx,
            });
        }

        // Sort interfaces by current active speed
        interfaces
            .sort_by_key(|interface| std::cmp::Reverse(interface.rx_speed + interface.tx_speed));

        TrafficSummary {
            total_rx_speed,
            total_tx_speed,
            total_rx_bytes,
            total_tx_bytes,
            interfaces,
            timestamp: chrono::Utc::now().timestamp_millis(),
        }
    }
}
