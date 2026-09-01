import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes, last conflicting utility wins.
 *
 * Same job as HeroUI's `cn`, reimplemented here so components that only need
 * class merging don't have to import from `@heroui/react`. That import pulls
 * the whole HeroUI barrel — including `client-only` — which makes the module
 * unusable from a Server Component and breaks `next build --webpack`.
 *
 * clsx alone is not enough: callers override variant defaults (`h-28` from a
 * variant, `h-32` from a caller's className), and without tailwind-merge both
 * survive and the winner is decided by stylesheet order rather than intent.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
