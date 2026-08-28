"use client";

import { CourseCoverImage } from "./CourseCoverImage";

/** Stable hue per course code, so a course keeps the same colour everywhere. */
function hueFor(code: string): number {
  let n = 0;
  for (let i = 0; i < code.length; i++) n = (n * 31 + code.charCodeAt(i)) % 360;
  return n;
}

function fallbackBackground(code: string): string {
  const h = hueFor(code);
  return (
    `radial-gradient(120% 100% at 15% 10%, hsl(${h} 78% 62%) 0%, transparent 58%),` +
    `radial-gradient(110% 90% at 88% 90%, hsl(${(h + 42) % 360} 70% 48%) 0%, transparent 62%),` +
    `linear-gradient(150deg, hsl(${h} 62% 38%), hsl(${(h + 24) % 360} 66% 22%))`
  );
}

interface CourseThumbProps {
  code: string;
  name: string;
  image?: string | null;
  positionX?: number | null;
  positionY?: number | null;
  zoom?: number | null;
  /** Dim the thumbnail for a course that is no longer running. */
  muted?: boolean;
  className?: string;
}

/**
 * The 44px cover thumbnail used in every student course list. Falls back to a
 * generated gradient when the course has no cover photo, which is common — a
 * generic book icon on every row makes the courses impossible to tell apart.
 */
export function CourseThumb({
  code,
  name,
  image,
  positionX,
  positionY,
  zoom,
  muted = false,
  className = "cg-thumb",
}: CourseThumbProps) {
  const classes = muted ? `${className} cg-thumb-muted` : className;

  if (image) {
    return (
      <CourseCoverImage
        src={image}
        alt={name}
        positionX={positionX}
        positionY={positionY}
        zoom={zoom}
        className={classes}
        sizes="44px"
      />
    );
  }

  return (
    <span className={classes} aria-hidden="true">
      <span className="absolute inset-0" style={{ background: fallbackBackground(code) }} />
    </span>
  );
}

export { fallbackBackground as courseCoverFallback };
