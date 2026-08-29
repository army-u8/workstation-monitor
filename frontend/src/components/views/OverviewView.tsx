import type { Component } from 'solid-js';
import { KpiRibbon } from '../KpiRibbon';
import { TrafficWaveform } from '../TrafficWaveform';
import { LatencyMatrix } from '../LatencyMatrix';
import { PacketSniffer } from '../PacketSniffer';
import { WorkbenchPulse } from '../WorkbenchPulse';
import { SocketInspector } from '../SocketInspector';

export const OverviewView: Component = () => {
  return (
    <div class="flex flex-col gap-3.5">
      {/* 1. Hero Bento KPI Strip (RX, TX, CPU, RAM) */}
      <KpiRibbon />

      {/* 2. Realtime Telemetry Grid: Waveform & Latency Probes */}
      <div class="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        <div class="lg:col-span-7 xl:col-span-8">
          <TrafficWaveform />
        </div>
        <div class="lg:col-span-5 xl:col-span-4">
          <LatencyMatrix />
        </div>
      </div>

      {/* 3. Deep Packet Sniffer */}
      <PacketSniffer />

      {/* 4. Developer Workspace Pulse: Projects & Services */}
      <WorkbenchPulse />

      {/* 5. Network Sockets & Port Inspector */}
      <SocketInspector />
    </div>
  );
};


