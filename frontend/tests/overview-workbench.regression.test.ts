import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { rankWorkbenchProjects, summarizeWorkbenchServices } from '../src/utils/workbench';
import type { GitProjectInfo, WebArtifactInfo } from '../src/types';

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../src/${relativePath}`, import.meta.url), 'utf8');

const project = (name: string, overrides: Partial<GitProjectInfo> = {}): GitProjectInfo => ({
  name,
  path: `/Users/test/${name}`,
  branch: 'main',
  is_dirty: false,
  uncommitted_count: 0,
  ahead: 0,
  behind: 0,
  last_commit_msg: 'initial',
  last_commit_author: 'test',
  last_commit_time: '2026-08-20T00:00:00Z',
  ...overrides,
});

test('workbench ranks dirty projects before clean projects and caps the visible list', () => {
  const projects = [
    project('old-dirty', { is_dirty: true, last_commit_time: '2026-08-18T00:00:00Z' }),
    project('new-clean', { last_commit_time: '2026-08-22T00:00:00Z' }),
    project('new-dirty', { is_dirty: true, last_commit_time: '2026-08-21T00:00:00Z' }),
    project('clean-two'),
    project('clean-three'),
    project('clean-four'),
  ];

  assert.deepEqual(
    rankWorkbenchProjects(projects, 3).map((item) => item.name),
    ['new-dirty', 'old-dirty', 'new-clean'],
  );
});

test('workbench summarizes healthy services and latency independently', () => {
  const services: WebArtifactInfo[] = [
    {
      port: 3000,
      url: 'http://localhost:3000',
      framework: 'Vite',
      is_healthy: true,
      response_time_ms: 12,
    },
    {
      port: 8000,
      url: 'http://localhost:8000',
      framework: 'FastAPI',
      is_healthy: false,
      response_time_ms: null,
    },
    {
      port: 9000,
      url: 'http://localhost:9000',
      framework: 'Axum',
      is_healthy: true,
      response_time_ms: 28,
    },
  ];

  assert.deepEqual(summarizeWorkbenchServices(services), {
    total: 3,
    healthy: 2,
    degraded: 1,
    averageLatency: 20,
  });
});

test('overview composes the workbench and keeps the existing telemetry stack', () => {
  const overview = readSource('components/views/OverviewView.tsx');
  const workbench = readSource('components/WorkbenchPulse.tsx');

  assert.match(overview, /WorkbenchPulse/);
  for (const component of [
    'KpiRibbon',
    'TrafficWaveform',
    'LatencyMatrix',
    'PacketSniffer',
    'SocketInspector',
  ]) {
    assert.match(overview, new RegExp(component));
  }
  for (const api of [
    'scanGitProjectsApi',
    'fetchWebArtifactsApi',
    'fetchMachineInfoApi',
    'openSnapshotDrawer',
  ]) {
    assert.match(workbench, new RegExp(api));
  }
});

test('workbench dictionaries stay available in both languages', () => {
  const zh = readSource('i18n/dict/zh.ts');
  const en = readSource('i18n/dict/en.ts');

  assert.match(zh, /overviewWorkbench:/);
  assert.match(en, /overviewWorkbench:/);
  assert.match(zh, /refreshAll/);
  assert.match(en, /refreshAll/);
});
