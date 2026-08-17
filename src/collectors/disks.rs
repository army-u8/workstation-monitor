use sysinfo::Disks;
use crate::types::DiskInfo;

pub struct DiskCollector {
    disks: Disks,
}

impl DiskCollector {
    pub fn new() -> Self {
        Self {
            disks: Disks::new_with_refreshed_list(),
        }
    }

    pub fn collect(&mut self) -> Vec<DiskInfo> {
        self.disks.refresh(true);

        self.disks
            .iter()
            .map(|disk| {
                let total = disk.total_space();
                let avail = disk.available_space();
                let used = total.saturating_sub(avail);
                let used_pct = if total > 0 {
                    (used as f32 / total as f32) * 100.0
                } else {
                    0.0
                };

                let name = disk.name().to_string_lossy().to_string();
                let mount = disk.mount_point().to_string_lossy().to_string();
                let fs = disk.file_system().to_string_lossy().to_string();

                DiskInfo {
                    name: if name.is_empty() { mount.clone() } else { name },
                    mount_point: mount,
                    total_bytes: total,
                    available_bytes: avail,
                    used_bytes: used,
                    used_percent: used_pct,
                    file_system: fs,
                    is_removable: disk.is_removable(),
                }
            })
            .collect()
    }
}
