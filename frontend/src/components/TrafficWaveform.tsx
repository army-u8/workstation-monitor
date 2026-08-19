import { For, createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import { formatSpeed, traffic } from '../services/store';
import { t } from '../i18n';

export const TrafficWaveform: Component = () => {
  let canvasRef: HTMLCanvasElement | null = null;
  let containerRef: HTMLDivElement | null = null;

  const maxPoints = 60;
  const rxData: number[] = new Array(maxPoints).fill(0);
  const txData: number[] = new Array(maxPoints).fill(0);
  let maxY = 1024 * 50;
  let peakSpeed = 0;

  const [peakDisplay, setPeakDisplay] = createSignal('0 B/s');
  const [hoverData, setHoverData] = createSignal<{
    rx: number;
    tx: number;
    time: string;
    x: number;
  } | null>(null);

  const render = () => {
    if (!canvasRef || !containerRef) return;
    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;

    const w = containerRef.clientWidth;
    const h = containerRef.clientHeight;

    ctx.clearRect(0, 0, w, h);

    // 1. Gridlines & labels
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.12)';
    ctx.lineWidth = 1;
    const gridSteps = 4;
    ctx.fillStyle = 'rgba(128, 128, 128, 0.6)';
    ctx.font = '9px "JetBrains Mono", monospace';

    for (let i = 0; i <= gridSteps; i++) {
      const y = h - (h / gridSteps) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      if (i > 0 && i < gridSteps) {
        const val = (maxY / gridSteps) * i;
        ctx.fillText(formatSpeed(val).num + ' ' + formatSpeed(val).unit, 8, y - 4);
      }
    }

    const stepX = w / (maxPoints - 1);
    const getY = (val: number) => h - (Math.min(val, maxY) / maxY) * (h - 14) - 4;

    // 2. Draw RX Series (Download) - Emerald
    drawSmoothSeries(
      ctx,
      rxData,
      '#10b981',
      'rgba(16, 185, 129, 0.15)',
      'rgba(16, 185, 129, 0.00)',
      stepX,
      getY,
      h,
    );

    // 3. Draw TX Series (Upload) - Sky
    drawSmoothSeries(
      ctx,
      txData,
      '#0284c7',
      'rgba(2, 132, 199, 0.15)',
      'rgba(2, 132, 199, 0.00)',
      stepX,
      getY,
      h,
    );

    // 4. Hover cursor
    const hov = hoverData();
    if (hov) {
      ctx.beginPath();
      ctx.moveTo(hov.x, 0);
      ctx.lineTo(hov.x, h);
      ctx.strokeStyle = 'rgba(128, 128, 128, 0.4)';
      ctx.setLineDash([2, 2]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  const drawSmoothSeries = (
    ctx: CanvasRenderingContext2D,
    data: number[],
    stroke: string,
    gradTop: string,
    gradBottom: string,
    stepX: number,
    getY: (val: number) => number,
    h: number,
  ) => {
    const len = data.length;
    if (len < 2) return;

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, gradTop);
    grad.addColorStop(1, gradBottom);

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < len; i++) {
      ctx.lineTo(i * stepX, getY(data[i]));
    }
    ctx.lineTo((len - 1) * stepX, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, getY(data[0]));
    for (let i = 1; i < len; i++) {
      ctx.lineTo(i * stepX, getY(data[i]));
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };

  const resize = () => {
    if (!canvasRef || !containerRef) return;
    const rect = containerRef.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvasRef.width = rect.width * dpr;
    canvasRef.height = rect.height * dpr;
    const ctx = canvasRef.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
    render();
  };

  onMount(() => {
    resize();
    window.addEventListener('resize', resize);
    onCleanup(() => window.removeEventListener('resize', resize));
  });

  createEffect(() => {
    const t = traffic();
    if (!t) return;

    rxData.push(t.total_rx_speed);
    if (rxData.length > maxPoints) rxData.shift();

    txData.push(t.total_tx_speed);
    if (txData.length > maxPoints) txData.shift();

    const curMax = Math.max(...rxData, ...txData);
    if (curMax > peakSpeed) {
      peakSpeed = curMax;
      const f = formatSpeed(peakSpeed);
      setPeakDisplay(`${f.num} ${f.unit}`);
    }

    const targetMax = Math.max(curMax * 1.25, 1024 * 20);
    maxY = maxY * 0.82 + targetMax * 0.18;

    render();
  });

  const handleMouseMove = (e: MouseEvent) => {
    if (!canvasRef || !containerRef) return;
    const rect = canvasRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const stepX = containerRef.clientWidth / (maxPoints - 1);
    const idx = Math.min(Math.max(Math.round(x / stepX), 0), maxPoints - 1);

    const rx = rxData[idx] || 0;
    const tx = txData[idx] || 0;
    const secAgo = maxPoints - 1 - idx;
    const time = secAgo === 0 ? t().traffic.current : `${secAgo}${t().traffic.secAgo}`;

    setHoverData({ rx, tx, time, x: idx * stepX });
    render();
  };

  const handleMouseLeave = () => {
    setHoverData(null);
    render();
  };

  const activeInterfaces = () => {
    const ifaces = traffic()?.interfaces || [];
    return ifaces.filter(
      (i) => i.rx_speed > 0 || i.tx_speed > 0 || i.name === 'en0' || i.name === 'lo0',
    );
  };

  return (
    <section class="hud-box p-4 bg-bg-surface/90 shadow-lg">
      {/* Panel Header */}
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_rgba(0,240,255,0.8)] animate-pulse-dot" />
          <h2 class="hud-tag text-text-primary text-xs m-0">{t().traffic.title}</h2>
          <span class="mono text-[10px] text-accent/70 bg-accent/10 px-1.5 py-0.2 rounded border border-accent/20">
            {t().traffic.window}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1.5 rounded-sm bg-bg-base/80 border border-border-default px-2.5 py-0.8 text-[10.5px]">
            <span class="h-1.5 w-1.5 rounded-full bg-status-success shadow-[0_0_6px_rgba(0,255,157,0.8)]" />
            <span class="text-text-muted font-bold font-mono">RX</span>
            <span class="type-data-mono text-status-success">
              {formatSpeed(traffic()?.total_rx_speed || 0).num}{' '}
              {formatSpeed(traffic()?.total_rx_speed || 0).unit}
            </span>
          </div>

          <div class="flex items-center gap-1.5 rounded-sm bg-bg-base/80 border border-border-default px-2.5 py-0.8 text-[10.5px]">
            <span class="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_6px_rgba(0,240,255,0.8)]" />
            <span class="text-text-muted font-bold font-mono">TX</span>
            <span class="type-data-mono text-accent">
              {formatSpeed(traffic()?.total_tx_speed || 0).num}{' '}
              {formatSpeed(traffic()?.total_tx_speed || 0).unit}
            </span>
          </div>

          <div class="hidden items-center gap-1.5 text-[10.5px] text-text-muted sm:flex ml-1">
            <span class="font-mono font-bold text-text-muted/70">{t().traffic.peak}:</span>
            <span class="type-data-mono text-text-secondary">{peakDisplay()}</span>
          </div>
        </div>
      </div>

      {/* Canvas chart container */}
      <div
        ref={(el) => (containerRef = el)}
        class="relative mb-2.5 h-44 w-full overflow-hidden rounded-sm border border-accent/25 bg-bg-input shadow-inner"
      >
        <canvas
          ref={(el) => (canvasRef = el)}
          class="h-full w-full block cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />

        {/* Hover Tooltip */}
        {hoverData() && (
          <div
            class="pointer-events-none absolute top-2 z-10 rounded border border-border-default bg-bg-modal/95 p-1.5 font-mono text-[9.5px] text-text-primary shadow-lg backdrop-blur-md"
            style={{
              left: `${Math.min(Math.max((hoverData()?.x || 0) - 40, 8), ((containerRef as HTMLDivElement | null)?.clientWidth || 300) - 120)}px`,
            }}
          >
            <div class="text-[9px] text-text-muted">{hoverData()?.time}</div>
            <div class="text-status-success">
              ↓ {formatSpeed(hoverData()?.rx || 0).num} {formatSpeed(hoverData()?.rx || 0).unit}
            </div>
            <div class="text-accent">
              ↑ {formatSpeed(hoverData()?.tx || 0).num} {formatSpeed(hoverData()?.tx || 0).unit}
            </div>
          </div>
        )}
      </div>

      {/* Network Interface Chips */}
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="text-[10px] font-medium text-text-muted mr-1">{t().traffic.devices}:</span>
        <For each={activeInterfaces()}>
          {(iface) => {
            const rxF = formatSpeed(iface.rx_speed);
            const txF = formatSpeed(iface.tx_speed);
            return (
              <div class="flex items-center gap-1.5 rounded border border-border-subtle bg-bg-subtle px-2 py-0.5 text-[10px]">
                <span class="mono font-semibold text-text-primary">{iface.name}</span>
                <div class="mono flex gap-1 text-[9.5px] text-text-muted">
                  <span>
                    ↓{rxF.num}
                    {rxF.unit}
                  </span>
                  <span>
                    ↑{txF.num}
                    {txF.unit}
                  </span>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </section>
  );
};
