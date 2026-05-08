/**
 * ProSkeleton — base building block for all skeletons in the system.
 *
 * Enforces a single shimmer animation style across the entire app.
 * Use variant to pick a pre-configured shape, or compose with className.
 *
 * Rules:
 * - ONE shimmer style system-wide (tailwind animate-pulse via HeroUI Skeleton)
 * - NEVER nest ProSkeleton inside another ProSkeleton
 * - Match the real content's height/width so layout doesn't shift on load
 * - Don't use spinner as primary loading — use skeletons
 */

import { Skeleton } from "@heroui/skeleton";
import { cn } from "@heroui/react";

export type ProSkeletonVariant =
  | "text"
  | "title"
  | "card"
  | "hero"
  | "chart"
  | "list"
  | "avatar"
  | "badge"
  | "button"
  | "input"
  | "table-row"
  | "stat";

type ProSkeletonProps = {
  variant?: ProSkeletonVariant;
  className?: string;
  /** Width override — use Tailwind width class */
  width?: string;
  style?: React.CSSProperties;
};

const variantDefaults: Record<ProSkeletonVariant, string> = {
  text: "h-4 w-full rounded",
  title: "h-7 w-48 rounded-md",
  card: "h-28 w-full rounded-xl",
  hero: "h-40 w-full rounded-2xl",
  chart: "h-64 w-full rounded-xl",
  list: "h-48 w-full rounded-xl",
  avatar: "h-10 w-10 rounded-full",
  badge: "h-5 w-16 rounded-full",
  button: "h-9 w-24 rounded-lg",
  input: "h-10 w-full rounded-lg",
  "table-row": "h-10 w-full rounded-md",
  stat: "h-20 w-full rounded-xl",
};

export function ProSkeleton({ variant = "card", className, width, style }: ProSkeletonProps) {
  return (
    <Skeleton
      className={cn(variantDefaults[variant], width, className)}
      style={style}
    />
  );
}

/** Inline updating indicator — shows instead of re-skeleton during background refreshes */
export function UpdatingIndicator({ visible = false }: { visible?: boolean }) {
  if (!visible) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-default-400">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-default-400 animate-pulse" />
      กำลังอัปเดต…
    </span>
  );
}
