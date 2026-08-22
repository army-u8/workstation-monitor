import type { GitProjectInfo, WebArtifactInfo } from '../types';

const commitTimestamp = (project: GitProjectInfo): number => {
  const timestamp = Date.parse(project.last_commit_time);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export function rankWorkbenchProjects(projects: GitProjectInfo[], limit = 5): GitProjectInfo[] {
  return [...projects]
    .sort((a, b) => {
      if (a.is_dirty !== b.is_dirty) return a.is_dirty ? -1 : 1;
      return commitTimestamp(b) - commitTimestamp(a);
    })
    .slice(0, Math.max(0, limit));
}

export function summarizeWorkbenchServices(services: WebArtifactInfo[]) {
  const latencySamples = services
    .map((service) => service.response_time_ms)
    .filter(
      (latency): latency is number => typeof latency === 'number' && Number.isFinite(latency),
    );

  return {
    total: services.length,
    healthy: services.filter((service) => service.is_healthy).length,
    degraded: services.filter((service) => !service.is_healthy).length,
    averageLatency: latencySamples.length
      ? Math.round(
          latencySamples.reduce((sum, latency) => sum + latency, 0) / latencySamples.length,
        )
      : 0,
  };
}
