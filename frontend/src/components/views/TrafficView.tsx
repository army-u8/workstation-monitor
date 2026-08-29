import type { Component } from 'solid-js';
import { KpiRibbon } from '../KpiRibbon';
import { TrafficWaveform } from '../TrafficWaveform';
import { PacketSniffer } from '../PacketSniffer';
import { SpeedTester } from '../SpeedTester';

export const TrafficView: Component = () => {
  return (
    <div class="flex flex-col gap-3">
      <KpiRibbon />
      <TrafficWaveform />
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <PacketSniffer />
        <SpeedTester />
      </div>
    </div>
  );
};

