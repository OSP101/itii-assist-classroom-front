"use client";

// Same reason as classroom/[id]/page.tsx: a Next.js page file may only export
// the framework's own set of names, so the shared tab component lives in
// ./monitoring-page and this route just renders it.
import { MonitoringPage } from "./monitoring-page";

export default function MonitoringDefaultPage() {
  return <MonitoringPage initialTab="overview" />;
}
