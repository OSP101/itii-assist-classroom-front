"use client";

export type ClientNetworkMetrics = {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  dedupeHits: number;
  cooldownHits: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
  lastUpdatedAt: string | null;
};

const metrics: ClientNetworkMetrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  dedupeHits: 0,
  cooldownHits: 0,
  totalLatencyMs: 0,
  avgLatencyMs: 0,
  lastUpdatedAt: null,
};

function updateDerived() {
  const done = metrics.successfulRequests + metrics.failedRequests;
  metrics.avgLatencyMs = done > 0 ? Math.round(metrics.totalLatencyMs / done) : 0;
  metrics.lastUpdatedAt = new Date().toISOString();
}

export function trackNetworkRequestStart() {
  metrics.totalRequests += 1;
  updateDerived();
}

export function trackNetworkRequestSuccess(latencyMs: number) {
  metrics.successfulRequests += 1;
  metrics.totalLatencyMs += latencyMs;
  updateDerived();
}

export function trackNetworkRequestFailure(latencyMs: number) {
  metrics.failedRequests += 1;
  metrics.totalLatencyMs += latencyMs;
  updateDerived();
}

export function trackNetworkDedupeHit() {
  metrics.dedupeHits += 1;
  updateDerived();
}

export function trackNetworkCooldownHit() {
  metrics.cooldownHits += 1;
  updateDerived();
}

export function getClientNetworkMetrics(): ClientNetworkMetrics {
  return { ...metrics };
}

export function resetClientNetworkMetrics() {
  metrics.totalRequests = 0;
  metrics.successfulRequests = 0;
  metrics.failedRequests = 0;
  metrics.dedupeHits = 0;
  metrics.cooldownHits = 0;
  metrics.totalLatencyMs = 0;
  metrics.avgLatencyMs = 0;
  metrics.lastUpdatedAt = new Date().toISOString();
}
