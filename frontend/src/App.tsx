import { onMount } from 'solid-js';
import type { Component } from 'solid-js';
import { Navigate, Route } from '@solidjs/router';
import { AppLayout } from './components/AppLayout';
import { RoutePath } from './constants';
import { OverviewView } from './components/views/OverviewView';
import { TrafficView } from './components/views/TrafficView';
import { SocketInspector } from './components/SocketInspector';
import { LatencyMatrix } from './components/LatencyMatrix';
import { PacketSniffer } from './components/PacketSniffer';
import { SpeedTester } from './components/SpeedTester';
import { MachineInfo } from './components/MachineInfo';
import { ProcessManager } from './components/ProcessManager';
import { DisksHardware } from './components/DisksHardware';
import { SystemCleaner } from './components/SystemCleaner';
import { GitRadar } from './components/GitRadar';
import { ObsidianHub } from './components/ObsidianHub';
import { HostsManager } from './components/HostsManager';
import { DevToolsView } from './components/DevToolsView';
import { OpsView } from './components/OpsView';
import {
  fetchHostsApi,
  fetchMachineInfoApi,
  fetchObsidianVaultApi,
  fetchUpdateCheckApi,
  initWebSocket,
  scanCleanerApi,
  scanGitProjectsApi,
} from './services/store';

export const App: Component = () => {
  onMount(() => {
    // 1. Initialize Realtime WebSocket Stream
    initWebSocket();

    // 2. Pre-fetch essential data for fast navigation & sidebar badges
    fetchMachineInfoApi();
    scanCleanerApi();
    scanGitProjectsApi();
    fetchObsidianVaultApi();
    fetchHostsApi();

    // 3. Silent background update check after 3 seconds
    setTimeout(() => {
      fetchUpdateCheckApi(true);
    }, 3000);
  });

  return (
    <Route component={AppLayout}>
      <Route path="/" component={() => <Navigate href={RoutePath.OVERVIEW} />} />
      <Route path={RoutePath.OVERVIEW} component={OverviewView} />
      <Route path={RoutePath.TRAFFIC} component={TrafficView} />
      <Route path={RoutePath.SOCKETS} component={SocketInspector} />
      <Route path={RoutePath.LATENCY} component={LatencyMatrix} />
      <Route path={RoutePath.SNIFFER} component={PacketSniffer} />
      <Route path={RoutePath.SPEEDTEST} component={SpeedTester} />
      <Route path={RoutePath.MACHINE_INFO} component={MachineInfo} />
      <Route path={RoutePath.PROCESSES} component={ProcessManager} />
      <Route path={RoutePath.DISKS} component={DisksHardware} />
      <Route path={RoutePath.CLEANER} component={SystemCleaner} />
      <Route path={RoutePath.GIT_RADAR} component={GitRadar} />
      <Route path={RoutePath.OBSIDIAN} component={ObsidianHub} />
      <Route path={RoutePath.HOSTS} component={HostsManager} />
      <Route path={RoutePath.DEVTOOLS} component={DevToolsView} />
      <Route path={RoutePath.OPS} component={OpsView} />
      <Route path="*path" component={() => <Navigate href={RoutePath.OVERVIEW} />} />
    </Route>
  );
};

export default App;
