import type { Component } from 'solid-js';
import { KpiRibbon } from '../KpiRibbon';
import { TrafficWaveform } from '../TrafficWaveform';
import { LatencyMatrix } from '../LatencyMatrix';
import { PacketSniffer } from '../PacketSniffer';
import { SocketInspector } from '../SocketInspector';
import { WorkbenchPulse } from '../WorkbenchPulse';

export const OverviewView: Component = () => {
  return (
    <div class="flex flex-col gap-3">
      <WorkbenchPulse />
      <KpiRibbon />
      <TrafficWaveform />
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <LatencyMatrix />
        <PacketSniffer />
      </div>
      <SocketInspector />
    </div>
  );
};
