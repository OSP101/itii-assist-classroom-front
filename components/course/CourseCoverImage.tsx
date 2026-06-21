"use client";

import type { ReactNode } from "react";
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
}: CourseCoverImageProps) {
    const hasImage = Boolean(String(src || "").trim());
    const safePositionX = normalizeCoverPosition(positionX);
    const safePositionY = normalizeCoverPosition(positionY);
    const safeZoom = normalizeCoverZoom(zoom);

    return (
        <div className={clsx("relative overflow-hidden", className)}>
            {hasImage ? (
                <img
                    src={String(src)}
                    alt={alt}
                    className={clsx("absolute inset-0 h-full w-full object-cover", imageClassName)}
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
