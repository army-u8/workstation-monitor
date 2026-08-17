// Global Cockpit State
const state = {
  currentTab: 'listening', // 'listening' or 'active'
  quickFilter: '',
  searchQuery: '',
  listeningPorts: [],
  activeConnections: [],
  packetFilter: 'ALL',
  isSnifferPaused: false,
  packetList: [],
  maxPackets: 150,
  latencyHistory: {}, // host -> array of last 8 latency measurements
};

let trafficChart = null;
let ws = null;
let reconnectTimer = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  trafficChart = new TrafficWaveChart('trafficCanvas');
  initWebSocket();
  initClock();
  initKeyboardShortcuts();
});

// Live Clock
function initClock() {
  const clockEl = document.getElementById('liveClock');
  const update = () => {
    const now = new Date();
    clockEl.textContent = now.toTimeString().split(' ')[0];
  };
  update();
  setInterval(update, 1000);
}

// Keyboard shortcuts (Space to toggle sniffer pause)
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      toggleSnifferPause();
    }
  });
}

// Unit formatters
function formatSpeed(bytesPerSec) {
  if (bytesPerSec >= 1024 * 1024 * 1024) {
    return { num: (bytesPerSec / (1024 * 1024 * 1024)).toFixed(2), unit: 'GB/s' };
  }
  if (bytesPerSec >= 1024 * 1024) {
    return { num: (bytesPerSec / (1024 * 1024)).toFixed(2), unit: 'MB/s' };
  }
  if (bytesPerSec >= 1024) {
    return { num: (bytesPerSec / 1024).toFixed(1), unit: 'KB/s' };
  }
  return { num: (bytesPerSec || 0).toFixed(0), unit: 'B/s' };
}

function formatTotalBytes(bytes) {
  if (bytes >= 1024 * 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024 * 1024 * 1024)).toFixed(2) + ' TB';
  }
  if (bytes >= 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }
  if (bytes >= 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
  if (bytes >= 1024) {
    return (bytes / 1024).toFixed(0) + ' KB';
  }
  return (bytes || 0) + ' B';
}

function formatUptime(secs) {
  const h = Math.floor(secs / 3600).toString().padStart(2, '0');
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// Toast notification
function showToast(msg) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast-item';
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 2000);
}

// Copy to clipboard helper
function copyText(text, label = '内容') {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`✓ 已复制 ${label}: ${text}`);
  }).catch(() => {
    showToast(`复制失败`);
  });
}

// WebSocket Connection
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host || 'localhost:9090';
  const wsUrl = `${protocol}//${host}/ws`;

  updateWsStatus('connecting', '连接中...');

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      updateWsStatus('online', '已实时同步');
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        handleWsEvent(payload);
      } catch (err) {
        console.error('Error parsing WS message', err);
      }
    };

    ws.onclose = () => {
      updateWsStatus('offline', '连接已断开，重连中...');
      scheduleReconnect();
    };

    ws.onerror = () => {
      updateWsStatus('offline', '连接异常');
    };
  } catch (err) {
    updateWsStatus('offline', '连接失败');
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    initWebSocket();
  }, 2000);
}

function updateWsStatus(status, text) {
  const dot = document.getElementById('wsDot');
  const label = document.getElementById('wsStatusText');
  if (dot) dot.className = `status-dot ${status}`;
  if (label) label.textContent = text;
}

// Event Dispatcher
function handleWsEvent(msg) {
  switch (msg.type) {
    case 'TrafficUpdate':
      renderTraffic(msg.data);
      break;
    case 'SocketsUpdate':
      renderSockets(msg.data);
      break;
    case 'LatencyUpdate':
      renderLatency(msg.data);
      break;
    case 'PacketEvent':
      renderPacket(msg.data);
      break;
    case 'SystemStatsUpdate':
      renderSystemStats(msg.data);
      break;
    default:
      break;
  }
}

// 1. Render Traffic & KPI
function renderTraffic(data) {
  const rx = formatSpeed(data.total_rx_speed);
  const tx = formatSpeed(data.total_tx_speed);

  document.getElementById('rxSpeedNum').textContent = rx.num;
  document.getElementById('rxSpeedUnit').textContent = rx.unit;
  document.getElementById('totalRxBytes').textContent = `累计: ${formatTotalBytes(data.total_rx_bytes)}`;

  document.getElementById('txSpeedNum').textContent = tx.num;
  document.getElementById('txSpeedUnit').textContent = tx.unit;
  document.getElementById('totalTxBytes').textContent = `累计: ${formatTotalBytes(data.total_tx_bytes)}`;

  if (trafficChart) {
    trafficChart.addDataPoint(data.total_rx_speed, data.total_tx_speed);
  }

  // Render Interface chips
  const container = document.getElementById('interfaceChips');
  const countBadge = document.getElementById('ifaceActiveCount');

  if (data.interfaces && data.interfaces.length > 0) {
    const activeIfaces = data.interfaces.filter(i => (i.rx_speed > 0 || i.tx_speed > 0 || i.name === 'en0' || i.name === 'lo0'));
    countBadge.textContent = `${activeIfaces.length} 网卡`;

    container.innerHTML = activeIfaces.map(iface => {
      const rxSp = formatSpeed(iface.rx_speed);
      const txSp = formatSpeed(iface.tx_speed);
      return `
        <div class="iface-chip">
          <span class="iface-name">${iface.name}</span>
          <div class="iface-speeds mono">
            <span class="iface-rx">↓ ${rxSp.num} ${rxSp.unit}</span>
            <span class="iface-tx">↑ ${txSp.num} ${txSp.unit}</span>
          </div>
        </div>
      `;
    }).join('');
  }
}

// 2. Render System Stats
function renderSystemStats(stats) {
  document.getElementById('cpuVal').textContent = `${stats.cpu_usage.toFixed(1)}%`;
  document.getElementById('cpuBar').style.width = `${Math.min(stats.cpu_usage, 100)}%`;

  const memGbUsed = (stats.memory_used / (1024 * 1024 * 1024)).toFixed(1);
  const memGbTotal = (stats.memory_total / (1024 * 1024 * 1024)).toFixed(1);
  document.getElementById('memVal').textContent = `${memGbUsed} / ${memGbTotal} GB`;
  document.getElementById('memBar').style.width = `${stats.memory_percent.toFixed(0)}%`;

  document.getElementById('uptimeVal').textContent = formatUptime(stats.uptime_secs);
  document.getElementById('osName').textContent = `${stats.os_name} Darwin`;
  document.getElementById('hostName').textContent = stats.host_name;

  // Sniffer status badge
  const snifferDot = document.getElementById('snifferDot');
  const snifferText = document.getElementById('snifferStatusText');
  const snifferNotice = document.getElementById('snifferNotice');
  const snifferNoticeText = document.getElementById('snifferNoticeText');

  if (stats.sniffer_active) {
    snifferDot.className = 'status-dot online';
    snifferText.textContent = `抓包已就绪 (${stats.sniffer_device || 'en0'})`;
    snifferNotice.style.display = 'none';
  } else {
    snifferDot.className = 'status-dot offline';
    snifferText.textContent = '抓包需提权';
    if (stats.sniffer_error) {
      snifferNotice.style.display = 'flex';
      snifferNoticeText.innerHTML = `<strong>权限提示</strong>: ${stats.sniffer_error}。<br>如需启用报文抓包流，请在终端以管理员权限 <code>sudo target/release/workstation-monitor</code> 启动。`;
    }
  }

  const footerTick = document.getElementById('footerTick');
  if (footerTick) footerTick.textContent = `负载: ${stats.cpu_usage.toFixed(1)}% CPU / ${stats.memory_percent.toFixed(0)}% MEM`;
}

// 3. Render Sockets & Ports
function renderSockets(payload) {
  state.listeningPorts = payload.listening_ports || [];
  state.activeConnections = payload.active_connections || [];

  document.getElementById('listeningCount').textContent = state.listeningPorts.length;
  document.getElementById('activeCount').textContent = state.activeConnections.length;
  document.getElementById('kpiListeningCount').textContent = state.listeningPorts.length;
  document.getElementById('kpiActiveCount').textContent = state.activeConnections.length;

  updateSocketTableView();
}

function switchSocketTab(tab) {
  state.currentTab = tab;
  document.getElementById('tabListening').classList.toggle('active', tab === 'listening');
  document.getElementById('tabActive').classList.toggle('active', tab === 'active');
  updateSocketTableView();
}

function setQuickFilter(btn, filterCategory) {
  state.quickFilter = filterCategory;
  document.querySelectorAll('.filter-pill').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  updateSocketTableView();
}

function handleSocketSearch() {
  state.searchQuery = document.getElementById('socketSearchInput').value.trim().toLowerCase();
  const clearBtn = document.getElementById('searchClearBtn');
  if (clearBtn) clearBtn.style.display = state.searchQuery ? 'inline' : 'none';
  updateSocketTableView();
}

function clearSocketSearch() {
  document.getElementById('socketSearchInput').value = '';
  document.getElementById('searchClearBtn').style.display = 'none';
  state.searchQuery = '';
  updateSocketTableView();
}

function matchQuickFilter(port, name) {
  if (!state.quickFilter) return true;
  const p = parseInt(port, 10);
  const n = (name || '').toLowerCase();

  if (state.quickFilter === 'web') {
    return [80, 443, 3000, 8080, 8000, 5000, 5173, 9090, 8443].includes(p) || n.includes('node') || n.includes('nginx') || n.includes('caddy') || n.includes('http');
  }
  if (state.quickFilter === 'db') {
    return [5432, 3306, 6379, 27017, 9200, 9042, 1433].includes(p) || n.includes('postgres') || n.includes('mysql') || n.includes('redis') || n.includes('mongo');
  }
  if (state.quickFilter === 'dev') {
    return [9090, 5173, 8080, 3000, 3001, 8000, 4000, 1313].includes(p) || n.includes('vite') || n.includes('cargo') || n.includes('workstation');
  }
  return true;
}

function updateSocketTableView() {
  const isListening = state.currentTab === 'listening';
  const tableHeader = document.getElementById('socketTableHeader');
  const tableBody = document.getElementById('socketTableBody');

  if (isListening) {
    tableHeader.innerHTML = `
      <th style="width: 75px;">协议</th>
      <th style="width: 120px;">监听端口</th>
      <th>本地地址</th>
      <th style="width: 110px;">状态</th>
      <th>关联进程</th>
      <th style="width: 80px; text-align: right;">PID</th>
    `;
  } else {
    tableHeader.innerHTML = `
      <th style="width: 75px;">协议</th>
      <th>本地地址:端口</th>
      <th>远程地址:端口</th>
      <th style="width: 120px;">状态</th>
      <th>关联进程</th>
      <th style="width: 80px; text-align: right;">PID</th>
    `;
  }

  const rawList = isListening ? state.listeningPorts : state.activeConnections;
  const filtered = rawList.filter(item => {
    if (!matchQuickFilter(item.local_port, item.process_name)) return false;
    if (!state.searchQuery) return true;
    const q = state.searchQuery;
    return (
      item.local_port.toString().includes(q) ||
      (item.remote_port && item.remote_port.toString().includes(q)) ||
      (item.process_name && item.process_name.toLowerCase().includes(q)) ||
      (item.pid && item.pid.toString().includes(q)) ||
      item.local_ip.includes(q) ||
      (item.remote_ip && item.remote_ip.includes(q)) ||
      item.state.toLowerCase().includes(q)
    );
  });

  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="table-empty-row">未匹配到符合条件的端口或连接记录</td></tr>`;
    return;
  }

  tableBody.innerHTML = filtered.map(item => {
    const protoClass = item.protocol.toLowerCase();
    const stateClass = item.state.toLowerCase().replace(/[^a-z0-9]/g, '_');

    if (isListening) {
      return `
        <tr>
          <td><span class="badge-proto-tag ${protoClass}">${item.protocol}</span></td>
          <td><span class="row-port-clickable mono" onclick="copyText('${item.local_port}', '端口')">:${item.local_port}</span></td>
          <td class="mono" style="color:var(--text-medium);">${item.local_ip}</td>
          <td><span class="badge-state-tag ${stateClass}">${item.state}</span></td>
          <td><span class="row-proc-title">${item.process_name || '<span style="color:var(--text-low)">系统内核 / 未知</span>'}</span></td>
          <td class="row-proc-pid mono" style="text-align: right;">${item.pid !== null ? item.pid : '-'}</td>
        </tr>
      `;
    } else {
      const remote = item.remote_ip ? `${item.remote_ip}:${item.remote_port || 0}` : '-';
      return `
        <tr>
          <td><span class="badge-proto-tag ${protoClass}">${item.protocol}</span></td>
          <td class="mono" style="color:var(--text-medium);">${item.local_ip}:${item.local_port}</td>
          <td class="mono" style="color:var(--text-medium);">${remote}</td>
          <td><span class="badge-state-tag ${stateClass}">${item.state}</span></td>
          <td><span class="row-proc-title">${item.process_name || '<span style="color:var(--text-low)">系统内核 / 未知</span>'}</span></td>
          <td class="row-proc-pid mono" style="text-align: right;">${item.pid !== null ? item.pid : '-'}</td>
        </tr>
      `;
    }
  }).join('');
}

// 4. Render Latency Matrix with Sparklines
function renderLatency(targets) {
  const container = document.getElementById('latencyGrid');
  if (!targets || targets.length === 0) return;

  container.innerHTML = targets.map(t => {
    // Record history
    if (!state.latencyHistory[t.host]) {
      state.latencyHistory[t.host] = [];
    }
    const history = state.latencyHistory[t.host];
    if (t.is_alive && t.latency_ms !== null) {
      history.push(t.latency_ms);
      if (history.length > 8) history.shift();
    }

    let gradeClass = 'bad';
    let gradeLabel = 'DOWN';
    let latencyDisplay = '超时';

    if (t.is_alive && t.latency_ms !== null) {
      if (t.latency_ms < 30) {
        gradeClass = 'good';
        gradeLabel = '极佳';
      } else if (t.latency_ms < 100) {
        gradeClass = 'good';
        gradeLabel = '良好';
      } else if (t.latency_ms < 200) {
        gradeClass = 'medium';
        gradeLabel = '一般';
      } else {
        gradeClass = 'bad';
        gradeLabel = '较高';
      }
      latencyDisplay = `${t.latency_ms.toFixed(1)} ms`;
    }

    const sparklineSvg = generateSparklineSvg(history, gradeClass);

    return `
      <div class="latency-item">
        <div class="latency-item-top">
          <div>
            <div class="target-heading">${t.name}</div>
            <div class="target-sub mono">${t.host}:${t.port}</div>
          </div>
          <span class="latency-tag ${gradeClass}">${gradeLabel}</span>
        </div>
        <div class="latency-item-bottom">
          <span class="latency-metric mono ${gradeClass}">${latencyDisplay}</span>
          ${sparklineSvg}
        </div>
      </div>
    `;
  }).join('');
}

function generateSparklineSvg(history, gradeClass) {
  if (history.length < 2) {
    return `<div class="sparkline-box"></div>`;
  }
  const max = Math.max(...history, 10);
  const min = Math.min(...history, 0);
  const range = max - min || 1;
  const w = 44;
  const h = 14;
  const step = w / (history.length - 1);

  const points = history.map((val, i) => {
    const x = i * step;
    const y = h - ((val - min) / range) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const strokeColor = gradeClass === 'good' ? '#10b981' : gradeClass === 'medium' ? '#f59e0b' : '#ef4444';

  return `
    <svg class="sparkline-box" viewBox="0 0 ${w} ${h}">
      <polyline fill="none" stroke="${strokeColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" points="${points}" />
    </svg>
  `;
}

// 5. Render Packet Stream
function renderPacket(packet) {
  if (state.isSnifferPaused) return;

  state.packetList.unshift(packet);
  if (state.packetList.length > state.maxPackets) {
    state.packetList.pop();
  }

  updatePacketStreamView();
}

function handleProtocolFilter() {
  state.packetFilter = document.getElementById('protocolFilter').value;
  updatePacketStreamView();
}

function toggleSnifferPause() {
  state.isSnifferPaused = !state.isSnifferPaused;
  const btn = document.getElementById('pauseSnifferBtn');
  const icon = document.getElementById('pauseBtnIcon');
  const text = document.getElementById('pauseBtnText');

  if (state.isSnifferPaused) {
    btn.classList.add('active');
    icon.textContent = '▶';
    text.textContent = '继续';
    showToast('抓包流已暂停');
  } else {
    btn.classList.remove('active');
    icon.textContent = '⏸';
    text.textContent = '暂停';
    showToast('抓包流已恢复');
  }
}

function clearPacketStream() {
  state.packetList = [];
  updatePacketStreamView();
  showToast('已清空抓包记录');
}

function updatePacketStreamView() {
  const body = document.getElementById('packetStreamBody');
  const filtered = state.packetList.filter(p => {
    if (state.packetFilter === 'ALL') return true;
    return p.protocol.toUpperCase().includes(state.packetFilter.toUpperCase());
  });

  if (filtered.length === 0) {
    body.innerHTML = `<div class="terminal-empty">等待报文捕获或未匹配到筛选规则...</div>`;
    return;
  }

  body.innerHTML = filtered.map(p => {
    const timeStr = new Date(p.timestamp).toTimeString().split(' ')[0];
    const protoLower = p.protocol.toLowerCase().replace(/[^a-z0-9]/g, '');

    let protoClass = 'proto-tcp';
    if (protoLower.includes('dns')) protoClass = 'proto-dns';
    else if (protoLower.includes('tls') || protoLower.includes('https')) protoClass = 'proto-tls';
    else if (protoLower.includes('http')) protoClass = 'proto-http';
    else if (protoLower.includes('udp')) protoClass = 'proto-udp';
    else if (protoLower.includes('icmp')) protoClass = 'proto-icmp';
    else if (protoLower.includes('arp')) protoClass = 'proto-arp';

    const src = p.src_port ? `${p.src_ip}:${p.src_port}` : p.src_ip;
    const dst = p.dst_port ? `${p.dst_ip}:${p.dst_port}` : p.dst_ip;

    return `
      <div class="terminal-row">
        <span class="tcol-time mono" style="color:var(--text-low);">${timeStr}</span>
        <span class="tcol-proto"><span class="proto-label ${protoClass}">${p.protocol}</span></span>
        <span class="tcol-src mono" style="color:var(--text-medium);" title="${src}">${src}</span>
        <span class="tcol-arr" style="color:var(--text-dim);">→</span>
        <span class="tcol-dst mono" style="color:var(--text-medium);" title="${dst}">${dst}</span>
        <span class="tcol-len mono" style="color:var(--text-low);">${p.length} B</span>
        <span class="tcol-info" style="color:var(--text-high);" title="${p.info}">${p.info}</span>
      </div>
    `;
  }).join('');
}
