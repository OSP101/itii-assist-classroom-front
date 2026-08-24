"use client";

import { courseService } from "@/services/course.service";

export const COURSE_COVER_MAX_BYTES = 2 * 1024 * 1024;
export const COURSE_COVER_RECOMMENDED_WIDTH = 1600;
export const COURSE_COVER_RECOMMENDED_HEIGHT = 400;
export const COURSE_COVER_ASPECT_RATIO = COURSE_COVER_RECOMMENDED_WIDTH / COURSE_COVER_RECOMMENDED_HEIGHT;
export const COURSE_COVER_DEFAULT_POSITION_X = 50;
export const COURSE_COVER_DEFAULT_POSITION_Y = 50;
export const COURSE_COVER_DEFAULT_ZOOM = 1;

export interface CourseCoverState {
    image: string;
    cover_position_x: number;
    cover_position_y: number;
    cover_zoom: number;
}

export function normalizeCoverPosition(value: number | null | undefined) {
    if (!Number.isFinite(value)) {
        return COURSE_COVER_DEFAULT_POSITION_X;
    }

    return Math.min(100, Math.max(0, Number(value)));
}

export function normalizeCoverZoom(value: number | null | undefined) {
    if (!Number.isFinite(value)) {
        return COURSE_COVER_DEFAULT_ZOOM;
    }

    return Math.min(2.5, Math.max(1, Number(value)));
}

export async function readImageFileAsDataUrl(file: File): Promise<string> {
    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Failed to read image file"));
        reader.onloadend = () => resolve(String(reader.result || ""));
        reader.readAsDataURL(file);
    });
}

/**
 * The cover editor keeps its live crop/position preview as a base64 data URL
 * (see readImageFileAsDataUrl above) — fine for local preview, but it used to
 * get sent straight through as the course's `image` field on create/update,
 * so every course carried its own full image inline in every list response
 * that included it. Call this right before submitting: it uploads a data URL
 * to get a real file URL back, and passes an existing URL (or empty value)
 * through unchanged so untouched covers aren't re-uploaded.
 */
export async function uploadCourseCoverIfNeeded(image: string | undefined | null): Promise<string | undefined> {
    if (!image || !image.startsWith("data:")) {
        return image || undefined;
    }

    const blob = await (await fetch(image)).blob();
    const file = new File([blob], "cover", { type: blob.type || "image/jpeg" });
    const response = await courseService.uploadCoverImage(file);
    if (response.success && response.data?.url) {
        return response.data.url;
    }

    throw new Error(response.message || "Failed to upload course cover image");
}
