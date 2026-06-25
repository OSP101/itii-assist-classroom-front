"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@heroui/button";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { Icon } from "@iconify/react";
import { CourseCoverImage } from "./CourseCoverImage";
import {
    COURSE_COVER_ASPECT_RATIO,
    COURSE_COVER_DEFAULT_POSITION_X,
    COURSE_COVER_DEFAULT_POSITION_Y,
    COURSE_COVER_DEFAULT_ZOOM,
    COURSE_COVER_MAX_BYTES,
    COURSE_COVER_RECOMMENDED_HEIGHT,
    COURSE_COVER_RECOMMENDED_WIDTH,
    type CourseCoverState,
    readImageFileAsDataUrl,
} from "./course-cover-utils";

interface CourseCoverEditorText {
    title: string;
    emptyTitle: string;
    emptyHint: string;
    recommendedSize: string;
    editCover: string;
    changeImage: string;
    removeImage: string;
    adjustCover: string;
    modalTitle: string;
    modalHint: string;
    horizontalPosition: string;
    verticalPosition: string;
    zoom: string;
    cancel: string;
    apply: string;
    invalidFileType: string;
    fileTooLarge: string;
    dragHint?: string;
}

interface CourseCoverEditorProps {
    value: CourseCoverState;
    onChange: (value: CourseCoverState) => void;
    text: CourseCoverEditorText;
    accentClassName?: string;
    disabled?: boolean;
    onValidationError?: (message: string) => void;
}

export function CourseCoverEditor({
    value,
    onChange,
    text,
    accentClassName = "text-blue-500",
    disabled = false,
    onValidationError,
}: CourseCoverEditorProps) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const previewRef = useRef<HTMLDivElement | null>(null);
    const [isAdjustOpen, setIsAdjustOpen] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [hoverMode, setHoverMode] = useState<"move" | "nw" | "ne" | "sw" | "se" | null>(null);

    // Crop box state: x,y = top-left as fraction of previewW/H, w = width fraction of previewW
    // Frame height fraction = w * imgAR / 4
    const [cropBox, setCropBox] = useState({ x: 0.25, y: 0.25, w: 0.5 });

    // Natural image dimensions
    const [imgNaturalSize, setImgNaturalSize] = useState<{ w: number; h: number } | null>(null);
    useEffect(() => {
        if (!value.image) { setImgNaturalSize(null); return; }
        const img = new window.Image();
        img.onload = () => setImgNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
        img.src = value.image;
    }, [value.image]);

    // Drag refs
    const dragMode = useRef<"move" | "nw" | "ne" | "sw" | "se" | null>(null);
    const dragInitialBox = useRef({ x: 0, y: 0, w: 0 });
    const dragInitialPtr = useRef({ x: 0, y: 0 });

    // Crop frame metrics derived from image aspect ratio
    const cropMetrics = useMemo(() => {
        if (!imgNaturalSize) return null;
        const imgAR = imgNaturalSize.w / imgNaturalSize.h;
        const coverAR = COURSE_COVER_ASPECT_RATIO; // 4
        const visX = Math.min(1, coverAR / imgAR); // max frame width fraction at zoom=1
        const visY = Math.min(1, imgAR / coverAR); // max frame height fraction at zoom=1
        return { imgAR, coverAR, visX, visY };
    }, [imgNaturalSize]);

    // Frame height as fraction of previewH
    const frameH = (w: number) => cropMetrics ? w * cropMetrics.imgAR / 4 : w / 4;

    // Image too small for recommended cover size
    const imageTooSmall = imgNaturalSize
        ? (imgNaturalSize.w < COURSE_COVER_RECOMMENDED_WIDTH || imgNaturalSize.h < COURSE_COVER_RECOMMENDED_HEIGHT)
        : false;

    // Initialize crop box from posX/posY/zoom values
    const initCropBox = (posX: number, posY: number, zoom: number, metrics: typeof cropMetrics) => {
        if (!metrics) { setCropBox({ x: 0.25, y: 0.25, w: 0.5 }); return; }
        const { imgAR, coverAR, visX, visY } = metrics;
        const fw = visX / Math.max(1, Math.min(2.5, zoom));
        const fh = fw * imgAR / 4;
        const centerX = imgAR > coverAR ? posX / 100 * (1 - visX) + visX / 2 : 0.5;
        const centerY = imgAR < coverAR ? posY / 100 * (1 - visY) + visY / 2 : 0.5;
        setCropBox({
            x: Math.max(0, Math.min(1 - fw, centerX - fw / 2)),
            y: Math.max(0, Math.min(1 - fh, centerY - fh / 2)),
            w: fw,
        });
    };

    // Re-init when metrics arrive (image loads after modal already open)
    useEffect(() => {
        if (isAdjustOpen && cropMetrics) {
            initCropBox(
                value.cover_position_x ?? COURSE_COVER_DEFAULT_POSITION_X,
                value.cover_position_y ?? COURSE_COVER_DEFAULT_POSITION_Y,
                value.cover_zoom ?? COURSE_COVER_DEFAULT_ZOOM,
                cropMetrics,
            );
        }
    }, [cropMetrics]); // eslint-disable-line react-hooks/exhaustive-deps

    // Convert current cropBox back to posX/posY/zoom
    const cropBoxToState = (): CourseCoverState => {
        if (!cropMetrics) return value;
        const { imgAR, coverAR, visX, visY } = cropMetrics;
        const fw = cropBox.w;
        const fh = fw * imgAR / 4;
        const zoom = Math.min(2.5, Math.max(1, visX / fw));
        const centerX = cropBox.x + fw / 2;
        const centerY = cropBox.y + fh / 2;
        let posX = 50, posY = 50;
        if (imgAR > coverAR && (1 - visX) > 0.001) {
            posX = Math.min(100, Math.max(0, (centerX - visX / 2) / (1 - visX) * 100));
        }
        if (imgAR < coverAR && (1 - visY) > 0.001) {
            posY = Math.min(100, Math.max(0, (centerY - visY / 2) / (1 - visY) * 100));
        }
        return { ...value, cover_position_x: posX, cover_position_y: posY, cover_zoom: zoom };
    };

    // Derived zoom from cropBox (for display)
    const currentZoom = cropMetrics ? Math.min(2.5, Math.max(1, cropMetrics.visX / cropBox.w)) : 1;

    const openPicker = () => {
        if (disabled) return;
        inputRef.current?.click();
    };

    const openAdjustModal = () => {
        initCropBox(
            value.cover_position_x ?? COURSE_COVER_DEFAULT_POSITION_X,
            value.cover_position_y ?? COURSE_COVER_DEFAULT_POSITION_Y,
            value.cover_zoom ?? COURSE_COVER_DEFAULT_ZOOM,
            cropMetrics,
        );
        setIsAdjustOpen(true);
    };

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (!file.type.startsWith("image/")) { onValidationError?.(text.invalidFileType); return; }
        if (file.size > COURSE_COVER_MAX_BYTES) { onValidationError?.(text.fileTooLarge); return; }
        try {
            const image = await readImageFileAsDataUrl(file);
            onChange({ image, cover_position_x: COURSE_COVER_DEFAULT_POSITION_X, cover_position_y: COURSE_COVER_DEFAULT_POSITION_Y, cover_zoom: COURSE_COVER_DEFAULT_ZOOM });
            setCropBox({ x: 0.25, y: 0.25, w: 0.5 }); // reset; useEffect will fix when metrics load
            setIsAdjustOpen(true);
        } catch {
            onValidationError?.(text.invalidFileType);
        }
    };

    const handleRemove = () => {
        onChange({ image: "", cover_position_x: COURSE_COVER_DEFAULT_POSITION_X, cover_position_y: COURSE_COVER_DEFAULT_POSITION_Y, cover_zoom: COURSE_COVER_DEFAULT_ZOOM });
        setIsAdjustOpen(false);
    };

    const applyAdjust = () => {
        onChange(cropBoxToState());
        setIsAdjustOpen(false);
    };

    // Zoom slider: keep crop center fixed, resize frame
    const handleZoomChange = (newZoom: number) => {
        if (!cropMetrics) return;
        const { imgAR, visX } = cropMetrics;
        const newW = Math.max(visX / 2.5, Math.min(visX, visX / newZoom));
        const newH = newW * imgAR / 4;
        const cx = cropBox.x + cropBox.w / 2;
        const cy = cropBox.y + frameH(cropBox.w) / 2;
        setCropBox({
            x: Math.max(0, Math.min(1 - newW, cx - newW / 2)),
            y: Math.max(0, Math.min(1 - newH, cy - newH / 2)),
            w: newW,
        });
    };

    // ── Interaction mode detection (from pointer position) ───────────────────
    const getMode = (clientX: number, clientY: number): typeof hoverMode => {
        if (!previewRef.current) return null;
        const rect = previewRef.current.getBoundingClientRect();
        const px = (clientX - rect.left) / rect.width;
        const py = (clientY - rect.top) / rect.height;
        const { x: fx, y: fy, w: fw } = cropBox;
        const fh = frameH(fw);
        const r = Math.min(fw, fh) * 0.18; // corner hit radius
        if (Math.abs(px - fx) < r && Math.abs(py - fy) < r) return "nw";
        if (Math.abs(px - (fx + fw)) < r && Math.abs(py - fy) < r) return "ne";
        if (Math.abs(px - fx) < r && Math.abs(py - (fy + fh)) < r) return "sw";
        if (Math.abs(px - (fx + fw)) < r && Math.abs(py - (fy + fh)) < r) return "se";
        if (px >= fx && px <= fx + fw && py >= fy && py <= fy + fh) return "move";
        return null;
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!previewRef.current) return;
        const mode = getMode(e.clientX, e.clientY);
        if (!mode) return;
        dragMode.current = mode;
        dragInitialBox.current = { ...cropBox };
        const rect = previewRef.current.getBoundingClientRect();
        dragInitialPtr.current = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsDragging(true);
        e.preventDefault();
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!previewRef.current || !cropMetrics) return;
        const rect = previewRef.current.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;

        if (!dragMode.current) {
            setHoverMode(getMode(e.clientX, e.clientY));
            return;
        }

        const { imgAR, visX } = cropMetrics;
        const minW = visX / 2.5;
        const maxW = visX;
        const { x: ix, y: iy, w: iw } = dragInitialBox.current;
        const ih = iw * imgAR / 4;
        const dpx = px - dragInitialPtr.current.x;
        const dpy = py - dragInitialPtr.current.y;

        if (dragMode.current === "move") {
            const nh = iw * imgAR / 4;
            setCropBox({
                x: Math.max(0, Math.min(1 - iw, ix + dpx)),
                y: Math.max(0, Math.min(1 - nh, iy + dpy)),
                w: iw,
            });
            return;
        }

        // Resize: horizontal drag is primary driver, maintains 4:1 display ratio
        let newW: number, newX: number, newY: number;
        const right = ix + iw;
        const bottom = iy + ih;

        if (dragMode.current === "se") {
            newW = Math.max(minW, Math.min(maxW, Math.min(1 - ix, iw + dpx)));
            newX = ix;
            newY = Math.max(0, Math.min(1 - newW * imgAR / 4, iy));
        } else if (dragMode.current === "sw") {
            newW = Math.max(minW, Math.min(maxW, Math.min(right, iw - dpx)));
            newX = Math.max(0, right - newW);
            newW = right - newX;
            newY = Math.max(0, Math.min(1 - newW * imgAR / 4, iy));
        } else if (dragMode.current === "ne") {
            newW = Math.max(minW, Math.min(maxW, Math.min(1 - ix, iw + dpx)));
            newX = ix;
            const nh = newW * imgAR / 4;
            newY = Math.max(0, bottom - nh);
        } else { // nw
            newW = Math.max(minW, Math.min(maxW, Math.min(right, iw - dpx)));
            newX = Math.max(0, right - newW);
            newW = right - newX;
            const nh = newW * imgAR / 4;
            newY = Math.max(0, bottom - nh);
        }

        // Ensure frame stays within image
        const finalH = newW * imgAR / 4;
        if (newY + finalH > 1) {
            newW = Math.max(minW, (1 - newY) * 4 / imgAR);
        }
        setCropBox({ x: newX, y: newY, w: newW });
    };

    const handlePointerUp = () => {
        dragMode.current = null;
        setIsDragging(false);
    };

    const handlePointerLeave = () => {
        if (!isDragging) setHoverMode(null);
    };

    // CSS cursor class
    const cursorClass = isDragging
        ? (dragMode.current === "move" ? "cursor-grabbing" : "cursor-crosshair")
        : hoverMode === "move" ? "cursor-grab"
        : (hoverMode === "nw" || hoverMode === "se") ? "cursor-nw-resize"
        : (hoverMode === "ne" || hoverMode === "sw") ? "cursor-ne-resize"
        : "cursor-default";

    const previewAspectRatio = imgNaturalSize
        ? `${imgNaturalSize.w} / ${imgNaturalSize.h}`
        : "16 / 9";

    const fh = frameH(cropBox.w);

    return (
        <>
            <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" disabled={disabled} />

            <div className="space-y-4 rounded-xl bg-content2/80 p-5">
                {/* Header row */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Icon icon="solar:gallery-bold" className={`text-lg ${accentClassName}`} />
                        <span className="text-sm font-semibold text-default-700">{text.title}</span>
                    </div>
                    <span className="shrink-0 rounded-full bg-default-100 px-2.5 py-1 text-xs font-medium text-default-500">
                        {COURSE_COVER_RECOMMENDED_WIDTH} × {COURSE_COVER_RECOMMENDED_HEIGHT} px
                    </span>
                </div>

                {value.image ? (
                    <>
                        <button
                            type="button"
                            onClick={openAdjustModal}
                            disabled={disabled}
                            className="group relative w-full overflow-hidden rounded-xl border border-default-200 bg-default-100 disabled:pointer-events-none"
                            aria-label={text.adjustCover}
                        >
                            <CourseCoverImage
                                src={value.image}
                                alt={text.title}
                                positionX={value.cover_position_x}
                                positionY={value.cover_position_y}
                                zoom={value.cover_zoom}
                                className="aspect-4/1 w-full"
                            />
                            {!disabled && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                                    <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                                        <Icon icon="solar:crop-minimalistic-bold" className="text-sm" />
                                        {text.adjustCover}
                                    </span>
                                </div>
                            )}
                        </button>
                        <div className="flex flex-wrap gap-2">
                            <Button size="sm" color="primary" onPress={openPicker} isDisabled={disabled}>{text.changeImage}</Button>
                            <Button size="sm" variant="flat" onPress={openAdjustModal} isDisabled={disabled}>{text.adjustCover}</Button>
                            <Button size="sm" color="danger" variant="flat" onPress={handleRemove} isDisabled={disabled}>{text.removeImage}</Button>
                        </div>
                    </>
                ) : (
                    <button
                        type="button"
                        onClick={openPicker}
                        disabled={disabled}
                        className="w-full rounded-xl border-2 border-dashed border-default-300 p-6 text-center transition-colors hover:border-primary-400 hover:bg-primary-50/40 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <Icon icon="solar:cloud-upload-bold-duotone" className={`mx-auto mb-3 text-5xl ${accentClassName}`} />
                        <p className="font-medium text-default-700">{text.emptyTitle}</p>
                        <p className="mt-1 text-sm text-default-500">{text.emptyHint}</p>
                        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-default-200 bg-default-50 px-3 py-1 text-xs text-default-500">
                            <Icon icon="solar:ruler-bold" className="text-sm" />
                            {text.recommendedSize}: {COURSE_COVER_RECOMMENDED_WIDTH} × {COURSE_COVER_RECOMMENDED_HEIGHT} px
                        </div>
                    </button>
                )}
            </div>

            {/* ── Adjust Modal ──────────────────────────────────────────────── */}
            <Modal isOpen={isAdjustOpen} onClose={() => setIsAdjustOpen(false)} size="3xl" scrollBehavior="inside">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex items-center gap-2">
                                <Icon icon="solar:crop-minimalistic-bold-duotone" className={`text-xl ${accentClassName}`} />
                                {text.modalTitle}
                            </ModalHeader>
                            <ModalBody className="space-y-4 pb-2">
                                <p className="text-sm text-default-500">{text.modalHint}</p>

                                {/* Image too small warning */}
                                {imageTooSmall && imgNaturalSize && (
                                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-500/40 dark:bg-amber-950/40">
                                        <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 shrink-0 text-base text-amber-500" />
                                        <p className="text-xs text-amber-700 dark:text-amber-300">
                                            ภาพมีขนาด <strong>{imgNaturalSize.w}×{imgNaturalSize.h} px</strong> น้อยกว่าที่แนะนำ ({COURSE_COVER_RECOMMENDED_WIDTH}×{COURSE_COVER_RECOMMENDED_HEIGHT} px) อาจแสดงผลไม่คมชัด
                                        </p>
                                    </div>
                                )}

                                {/* ── Full-image preview with draggable crop frame ── */}
                                <div
                                    ref={previewRef}
                                    className={`relative w-full overflow-hidden rounded-xl border border-default-200 bg-slate-950 select-none ${cursorClass}`}
                                    style={{ aspectRatio: previewAspectRatio, maxHeight: "55vh", touchAction: "none" } as React.CSSProperties}
                                    onPointerDown={handlePointerDown}
                                    onPointerMove={handlePointerMove}
                                    onPointerUp={handlePointerUp}
                                    onPointerCancel={handlePointerUp}
                                    onPointerLeave={handlePointerLeave}
                                >
                                    {/* Full image */}
                                    <img
                                        src={value.image}
                                        alt={text.title}
                                        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                                        draggable={false}
                                    />

                                    {/* SVG: dark vignette outside crop frame + dashed border */}
                                    <svg
                                        className="pointer-events-none absolute inset-0 h-full w-full"
                                        viewBox="0 0 100 100"
                                        preserveAspectRatio="none"
                                        aria-hidden="true"
                                    >
                                        <defs>
                                            <mask id="cover-crop-mask">
                                                <rect x="0" y="0" width="100" height="100" fill="white" />
                                                <rect
                                                    x={cropBox.x * 100} y={cropBox.y * 100}
                                                    width={cropBox.w * 100} height={fh * 100}
                                                    fill="black"
                                                />
                                            </mask>
                                        </defs>
                                        {/* Dark vignette */}
                                        <rect x="0" y="0" width="100" height="100" fill="rgba(0,0,0,0.55)" mask="url(#cover-crop-mask)" />
                                        {/* Dashed crop border */}
                                        <rect
                                            x={cropBox.x * 100} y={cropBox.y * 100}
                                            width={cropBox.w * 100} height={fh * 100}
                                            fill="none" stroke="white" strokeWidth="0.5"
                                            strokeDasharray="3 2"
                                        />
                                        {/* Rule-of-thirds grid inside frame (subtle) */}
                                        {[1, 2].map((n) => (
                                            <g key={n} stroke="white" strokeWidth="0.15" opacity="0.4">
                                                <line
                                                    x1={cropBox.x * 100 + cropBox.w * 100 * n / 3} y1={cropBox.y * 100}
                                                    x2={cropBox.x * 100 + cropBox.w * 100 * n / 3} y2={(cropBox.y + fh) * 100}
                                                />
                                                <line
                                                    x1={cropBox.x * 100} y1={cropBox.y * 100 + fh * 100 * n / 3}
                                                    x2={(cropBox.x + cropBox.w) * 100} y2={cropBox.y * 100 + fh * 100 * n / 3}
                                                />
                                            </g>
                                        ))}
                                    </svg>

                                    {/* Corner handles (visual, hit-testing via getMode) */}
                                    {[
                                        { key: "nw", x: cropBox.x, y: cropBox.y },
                                        { key: "ne", x: cropBox.x + cropBox.w, y: cropBox.y },
                                        { key: "sw", x: cropBox.x, y: cropBox.y + fh },
                                        { key: "se", x: cropBox.x + cropBox.w, y: cropBox.y + fh },
                                    ].map(({ key, x, y }) => (
                                        <div
                                            key={key}
                                            className="pointer-events-none absolute h-3.5 w-3.5 rounded-sm border-2 border-slate-800 bg-white shadow"
                                            style={{ left: `${x * 100}%`, top: `${y * 100}%`, transform: "translate(-50%, -50%)" }}
                                        />
                                    ))}

                                    {/* Hint */}
                                    {!isDragging && (
                                        <div className="pointer-events-none absolute bottom-2 right-2">
                                            <span className="flex items-center gap-1 rounded-lg bg-black/50 px-2 py-1 text-[11px] text-white backdrop-blur-sm">
                                                <Icon icon="solar:move-bold" className="shrink-0" />
                                                {text.dragHint ?? "ลากกรอบหรือดึงมุมเพื่อปรับพื้นที่"}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Zoom slider */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-medium uppercase tracking-wide text-default-500">
                                            {text.zoom}
                                        </label>
                                        <span className="rounded-full bg-default-100 px-2 py-0.5 text-xs text-default-500">
                                            {currentZoom.toFixed(2)}×
                                        </span>
                                    </div>
                                    <input
                                        type="range" min={1} max={2.5} step={0.05}
                                        value={currentZoom}
                                        onChange={(e) => handleZoomChange(Number(e.target.value))}
                                        className="w-full"
                                    />
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>{text.cancel}</Button>
                                <Button color="primary" onPress={applyAdjust}>{text.apply}</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </>
    );
}

export function buildCourseCoverRecommendedSizeText(prefix: string) {
    return `${prefix} ${COURSE_COVER_RECOMMENDED_WIDTH} × ${COURSE_COVER_RECOMMENDED_HEIGHT}px`;
}
