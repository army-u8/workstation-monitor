class TrafficWaveChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.container = this.canvas.parentElement;
    this.tooltip = document.getElementById('canvasTooltip');
    this.ctx = this.canvas.getContext('2d');
    this.maxPoints = 60; // 60 data points (1s each = 60s history)
    this.rxData = new Array(this.maxPoints).fill(0);
    this.txData = new Array(this.maxPoints).fill(0);
    this.maxY = 1024 * 50; // default 50 KB/s ceiling
    this.peakSpeed = 0;
    this.hoverIndex = null;

    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Interactive mouse hover
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());

    this.render();
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
    this.render();
  }

  addDataPoint(rxSpeed, txSpeed) {
    this.rxData.push(rxSpeed);
    if (this.rxData.length > this.maxPoints) this.rxData.shift();

    this.txData.push(txSpeed);
    if (this.txData.length > this.maxPoints) this.txData.shift();

    // Track peak speed
    const currentMax = Math.max(...this.rxData, ...this.txData);
    if (currentMax > this.peakSpeed) {
      this.peakSpeed = currentMax;
      const peakEl = document.getElementById('chartPeakSpeed');
      if (peakEl) peakEl.textContent = this.formatBytes(this.peakSpeed);
    }

    // Smooth Y-axis auto scale
    const targetMax = Math.max(currentMax * 1.25, 1024 * 20);
    this.maxY = this.maxY * 0.82 + targetMax * 0.18;

    // Update live indicators
    const rxEl = document.getElementById('chartLiveRx');
    const txEl = document.getElementById('chartLiveTx');
    if (rxEl) rxEl.textContent = this.formatBytes(rxSpeed);
    if (txEl) txEl.textContent = this.formatBytes(txSpeed);

    this.render();
  }

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const stepX = this.width / (this.maxPoints - 1);
    this.hoverIndex = Math.min(Math.max(Math.round(x / stepX), 0), this.maxPoints - 1);

    if (this.tooltip) {
      const rx = this.rxData[this.hoverIndex] || 0;
      const tx = this.txData[this.hoverIndex] || 0;
      const secAgo = this.maxPoints - 1 - this.hoverIndex;
      const timeLabel = secAgo === 0 ? '当前' : `${secAgo} 秒前`;

      this.tooltip.style.display = 'block';
      this.tooltip.style.left = `${Math.min(Math.max(x - 60, 10), this.width - 140)}px`;
      this.tooltip.style.top = `10px`;
      this.tooltip.innerHTML = `
        <div style="color:#94a3b8;font-size:10px;margin-bottom:2px;">⏱ ${timeLabel}</div>
        <div style="color:#34d399;font-weight:700;">↓ RX: ${this.formatBytes(rx)}</div>
        <div style="color:#38bdf8;font-weight:700;">↑ TX: ${this.formatBytes(tx)}</div>
      `;
    }
    this.render();
  }

  handleMouseLeave() {
    this.hoverIndex = null;
    if (this.tooltip) this.tooltip.style.display = 'none';
    this.render();
  }

  formatBytes(bytes) {
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB/s';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB/s';
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB/s';
    return bytes.toFixed(0) + ' B/s';
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    if (!w || !h) return;

    ctx.clearRect(0, 0, w, h);

    // 1. Draw Subtle Grid Lines & Y-axis labels
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1;
    const gridSteps = 4;
    ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.font = '10px "JetBrains Mono", monospace';

    for (let i = 0; i <= gridSteps; i++) {
      const y = h - (h / gridSteps) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      if (i > 0 && i < gridSteps) {
        const val = (this.maxY / gridSteps) * i;
        ctx.fillText(this.formatBytes(val), 10, y - 4);
      }
    }

    const stepX = w / (this.maxPoints - 1);
    const getY = (val) => h - (Math.min(val, this.maxY) / this.maxY) * (h - 14) - 4;

    // 2. Draw RX (Download - Emerald Gradient)
    this.drawSmoothSeries(this.rxData, '#10b981', 'rgba(16, 185, 129, 0.18)', 'rgba(16, 185, 129, 0.01)', stepX, getY);

    // 3. Draw TX (Upload - Cyan Gradient)
    this.drawSmoothSeries(this.txData, '#06b6d4', 'rgba(6, 182, 212, 0.18)', 'rgba(6, 182, 212, 0.01)', stepX, getY);

    // 4. Draw Hover Vertical Cursor
    if (this.hoverIndex !== null) {
      const hx = this.hoverIndex * stepX;
      ctx.beginPath();
      ctx.moveTo(hx, 0);
      ctx.lineTo(hx, h);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw point dots
      const rxY = getY(this.rxData[this.hoverIndex]);
      ctx.beginPath();
      ctx.arc(hx, rxY, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981';
      ctx.fill();

      const txY = getY(this.txData[this.hoverIndex]);
      ctx.beginPath();
      ctx.arc(hx, txY, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#06b6d4';
      ctx.fill();
    }
  }

  drawSmoothSeries(data, strokeColor, gradTop, gradBottom, stepX, getY) {
    const ctx = this.ctx;
    const h = this.height;
    const len = data.length;

    if (len < 2) return;

    // Build gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, gradTop);
    grad.addColorStop(1, gradBottom);

    // Area path
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < len; i++) {
      ctx.lineTo(i * stepX, getY(data[i]));
    }
    ctx.lineTo((len - 1) * stepX, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line stroke
    ctx.beginPath();
    ctx.moveTo(0, getY(data[0]));
    for (let i = 1; i < len; i++) {
      ctx.lineTo(i * stepX, getY(data[i]));
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

window.TrafficWaveChart = TrafficWaveChart;
