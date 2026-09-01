/**
 * ProSkeleton — base building block for all skeletons in the system.
 *
 * Enforces a single shimmer animation style across the entire app.
 * Use variant to pick a pre-configured shape, or compose with className.
 *
 * Rules:
 * - ONE shimmer style system-wide
 * - NEVER nest ProSkeleton inside another ProSkeleton
 * - Match the real content's height/width so layout doesn't shift on load
 * - Don't use spinner as primary loading — use skeletons
 *
 * Deliberately imports no HeroUI JavaScript. It used to wrap @heroui/skeleton,
 * which drags in `client-only` and therefore cannot be used from a Server
 * Component — and every `loading.tsx` is a Server Component. Turbopack let
 * that slide; `next build --webpack` does not. Keeping this module free of
 * HeroUI JS is what allows either bundler to build the app, which matters
 * because Turbopack names chunks from an alphabet containing `~` and digits,
 * and the university WAF rejects any URL matching `~<digit>` (the Windows
 * 8.3 short-name pattern) with a 403.
 *
 * The markup below reproduces @heroui/theme's skeleton slot exactly, so it
 * still looks identical. Those colour tokens and `animate-shimmer` come from
 * HeroUI's Tailwind plugin, which is loaded app-wide in globals.css — the CSS
 * side of HeroUI is untouched, only the JS import is gone.
 */

import { cn } from "@/lib/cn";

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

const shimmerBase = [
  "relative overflow-hidden pointer-events-none",
  "bg-content3 dark:bg-content2",
  "before:absolute before:inset-0 before:opacity-100",
  "before:-translate-x-full before:animate-shimmer",
  "before:border-t before:border-content4/30",
  "before:bg-gradient-to-r before:from-transparent before:via-content4 before:to-transparent",
  "dark:before:via-default-700/10",
].join(" ");

export function ProSkeleton({ variant = "card", className, width, style }: ProSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(shimmerBase, variantDefaults[variant], width, className)}
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
