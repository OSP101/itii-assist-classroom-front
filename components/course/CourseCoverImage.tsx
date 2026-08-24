"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import clsx from "clsx";
import {
    COURSE_COVER_DEFAULT_POSITION_X,
    COURSE_COVER_DEFAULT_POSITION_Y,
    COURSE_COVER_DEFAULT_ZOOM,
    normalizeCoverPosition,
    normalizeCoverZoom,
} from "./course-cover-utils";

interface CourseCoverImageProps {
    src?: string | null;
    alt: string;
    className?: string;
    imageClassName?: string;
    fallback?: ReactNode;
    overlay?: ReactNode;
    positionX?: number | null;
    positionY?: number | null;
    zoom?: number | null;
    /** Passed through to next/image; defaults to a typical card/hero split. */
    sizes?: string;
    /** Mark above-the-fold covers (e.g. the classroom overview hero) so Next skips lazy-loading. */
    priority?: boolean;
}

export function CourseCoverImage({
    src,
    alt,
    className,
    imageClassName,
    fallback,
    overlay,
    positionX = COURSE_COVER_DEFAULT_POSITION_X,
    positionY = COURSE_COVER_DEFAULT_POSITION_Y,
    zoom = COURSE_COVER_DEFAULT_ZOOM,
    sizes = "(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 800px",
    priority = false,
}: CourseCoverImageProps) {
    const hasImage = Boolean(String(src || "").trim());
    const safePositionX = normalizeCoverPosition(positionX);
    const safePositionY = normalizeCoverPosition(positionY);
    const safeZoom = normalizeCoverZoom(zoom);

    return (
        <div className={clsx("relative overflow-hidden", className)}>
            {hasImage ? (
                <Image
                    src={String(src)}
                    alt={alt}
                    fill
                    sizes={sizes}
                    priority={priority}
                    className={clsx("object-cover", imageClassName)}
                    style={{
                        objectPosition: `${safePositionX}% ${safePositionY}%`,
                        transform: `scale(${safeZoom})`,
                        transformOrigin: `${safePositionX}% ${safePositionY}%`,
                    }}
                />
            ) : (
                fallback
            )}
            {overlay}
        </div>
    );
}
