import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Queue Projector Display",
  description: "Projector view for the room layout and queue status.",
};

export default function ProjectorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-900">
      {children}
    </div>
  );
}
