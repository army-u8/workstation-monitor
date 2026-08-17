import type { Component } from 'solid-js';
import { KpiRibbon } from '../KpiRibbon';
import { TrafficWaveform } from '../TrafficWaveform';

export const TrafficView: Component = () => {
  return (
    <div class="flex flex-col gap-3">
      <KpiRibbon />
      <TrafficWaveform />
    </div>
  );
};
