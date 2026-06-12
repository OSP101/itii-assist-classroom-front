import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Queue Worker",
  description: "Manage grading and help queue tasks for a classroom session.",
};

export default function QueueWorkerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
