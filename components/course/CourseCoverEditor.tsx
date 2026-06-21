"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@heroui/button";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { Icon } from "@iconify/react";
import { CourseCoverImage } from "./CourseCoverImage";
import {
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
    const [draft, setDraft] = useState({
        cover_position_x: value.cover_position_x || COURSE_COVER_DEFAULT_POSITION_X,
        cover_position_y: value.cover_position_y || COURSE_COVER_DEFAULT_POSITION_Y,
        cover_zoom: value.cover_zoom || COURSE_COVER_DEFAULT_ZOOM,
    });

    // Refs for drag state to avoid stale closures
    const dragActive = useRef(false);
    const dragLastPos = useRef({ x: 0, y: 0 });
    const dragZoom = useRef(COURSE_COVER_DEFAULT_ZOOM);

    const openPicker = () => {
        if (disabled) {
            return;
        }
        inputRef.current?.click();
    };

    const openAdjustModal = () => {
        setDraft({
            cover_position_x: value.cover_position_x || COURSE_COVER_DEFAULT_POSITION_X,
            cover_position_y: value.cover_position_y || COURSE_COVER_DEFAULT_POSITION_Y,
            cover_zoom: value.cover_zoom || COURSE_COVER_DEFAULT_ZOOM,
        });
        setIsAdjustOpen(true);
    };

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file) {
            return;
        }

        if (!file.type.startsWith("image/")) {
            onValidationError?.(text.invalidFileType);
            return;
        }

        if (file.size > COURSE_COVER_MAX_BYTES) {
            onValidationError?.(text.fileTooLarge);
            return;
        }

        try {
            const image = await readImageFileAsDataUrl(file);
            const nextValue = {
                image,
                cover_position_x: COURSE_COVER_DEFAULT_POSITION_X,
                cover_position_y: COURSE_COVER_DEFAULT_POSITION_Y,
                cover_zoom: COURSE_COVER_DEFAULT_ZOOM,
            };
            onChange(nextValue);
            setDraft({
                cover_position_x: nextValue.cover_position_x,
                cover_position_y: nextValue.cover_position_y,
                cover_zoom: nextValue.cover_zoom,
            });
            setIsAdjustOpen(true);
        } catch {
            onValidationError?.(text.invalidFileType);
        }
    };

    const handleRemove = () => {
        onChange({
            image: "",
            cover_position_x: COURSE_COVER_DEFAULT_POSITION_X,
            cover_position_y: COURSE_COVER_DEFAULT_POSITION_Y,
            cover_zoom: COURSE_COVER_DEFAULT_ZOOM,
        });
        setIsAdjustOpen(false);
    };

    const applyDraft = () => {
        onChange({
            ...value,
            cover_position_x: draft.cover_position_x,
            cover_position_y: draft.cover_position_y,
            cover_zoom: draft.cover_zoom,
        });
        setIsAdjustOpen(false);
    };

    // ── Drag-to-reposition handlers ──────────────────────────────────────────
    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        dragActive.current = true;
        dragLastPos.current = { x: e.clientX, y: e.clientY };
        dragZoom.current = draft.cover_zoom;
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsDragging(true);
        e.preventDefault();
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragActive.current || !previewRef.current) return;
        const dx = e.clientX - dragLastPos.current.x;
        const dy = e.clientY - dragLastPos.current.y;
        dragLastPos.current = { x: e.clientX, y: e.clientY };
        const rect = previewRef.current.getBoundingClientRect();
        // sensitivity: dragging full container width = 100% position change, scaled by zoom
        const sensX = 100 / (rect.width * Math.max(1, dragZoom.current));
        const sensY = 100 / (rect.height * Math.max(1, dragZoom.current));
        setDraft((prev) => ({
            ...prev,
            cover_position_x: Math.min(100, Math.max(0, prev.cover_position_x - dx * sensX)),
            cover_position_y: Math.min(100, Math.max(0, prev.cover_position_y - dy * sensY)),
        }));
    };

    const handlePointerUp = () => {
        dragActive.current = false;
        setIsDragging(false);
    };

    // Scroll/pinch to zoom on the preview
    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.08 : 0.08;
        setDraft((prev) => ({
            ...prev,
            cover_zoom: Math.min(2.5, Math.max(1, prev.cover_zoom + delta)),
        }));
    };

    const dragHintText = text.dragHint ?? "ลากภาพเพื่อปรับตำแหน่ง · เลื่อนล้อเมาส์เพื่อซูม";

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                disabled={disabled}
            />

            <div className="space-y-4 rounded-xl bg-content2/80 p-5">
                {/* Header row with size badge */}
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
                        {/* Preview thumbnail — click to open adjust modal */}
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
                                className="aspect-[4/1] w-full"
                            />
                            {!disabled && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                                    <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                                        <Icon icon="solar:move-bold" className="text-sm" />
                                        {text.adjustCover}
                                    </span>
                                </div>
                            )}
                        </button>
                        <div className="flex flex-wrap gap-2">
                            <Button size="sm" color="primary" onPress={openPicker} isDisabled={disabled}>
                                {text.changeImage}
                            </Button>
                            <Button size="sm" variant="flat" onPress={openAdjustModal} isDisabled={disabled}>
                                {text.adjustCover}
                            </Button>
                            <Button size="sm" color="danger" variant="flat" onPress={handleRemove} isDisabled={disabled}>
                                {text.removeImage}
                            </Button>
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
            <Modal isOpen={isAdjustOpen} onClose={() => setIsAdjustOpen(false)} size="3xl">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex items-center gap-2">
                                <Icon icon="solar:move-bold-duotone" className={`text-xl ${accentClassName}`} />
                                {text.modalTitle}
                            </ModalHeader>
                            <ModalBody className="space-y-4">
                                <p className="text-sm text-default-500">{text.modalHint}</p>

                                {/* Draggable preview */}
                                <div
                                    ref={previewRef}
                                    className={`relative aspect-[4/1] w-full select-none overflow-hidden rounded-xl border border-default-200 bg-slate-950 ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
                                    onPointerDown={handlePointerDown}
                                    onPointerMove={handlePointerMove}
                                    onPointerUp={handlePointerUp}
                                    onPointerCancel={handlePointerUp}
                                    onWheel={handleWheel}
                                    style={{ touchAction: "none" }}
                                >
                                    <CourseCoverImage
                                        src={value.image}
                                        alt={text.title}
                                        positionX={draft.cover_position_x}
                                        positionY={draft.cover_position_y}
                                        zoom={draft.cover_zoom}
                                        className="pointer-events-none h-full w-full"
                                    />
                                    {/* Drag-hint overlay (shown when not dragging) */}
                                    {!isDragging && (
                                        <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-2">
                                            <span className="flex items-center gap-1 rounded-lg bg-black/50 px-2 py-1 text-[11px] text-white backdrop-blur-sm">
                                                <Icon icon="solar:move-bold" className="shrink-0" />
                                                {dragHintText}
                                            </span>
                                        </div>
                                    )}
                                    {/* Frame guides — 4:1 aspect ratio border overlay */}
                                    <div className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-inset ring-white/20" />
                                </div>

                                {/* Zoom slider */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-medium uppercase tracking-wide text-default-500">
                                            {text.zoom}
                                        </label>
                                        <span className="rounded-full bg-default-100 px-2 py-0.5 text-xs text-default-500">
                                            {draft.cover_zoom.toFixed(2)}×
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min={1}
                                        max={2.5}
                                        step={0.05}
                                        value={draft.cover_zoom}
                                        onChange={(event) => setDraft((prev) => ({ ...prev, cover_zoom: Number(event.target.value) }))}
                                        className="w-full"
                                    />
                                </div>

                                {/* Fine-tune sliders */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="block text-xs font-medium uppercase tracking-wide text-default-500">
                                            {text.horizontalPosition}
                                        </label>
                                        <input
                                            type="range"
                                            min={0}
                                            max={100}
                                            step={1}
                                            value={draft.cover_position_x}
                                            onChange={(event) => setDraft((prev) => ({ ...prev, cover_position_x: Number(event.target.value) }))}
                                            className="w-full"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-xs font-medium uppercase tracking-wide text-default-500">
                                            {text.verticalPosition}
                                        </label>
                                        <input
                                            type="range"
                                            min={0}
                                            max={100}
                                            step={1}
                                            value={draft.cover_position_y}
                                            onChange={(event) => setDraft((prev) => ({ ...prev, cover_position_y: Number(event.target.value) }))}
                                            className="w-full"
                                        />
                                    </div>
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>
                                    {text.cancel}
                                </Button>
                                <Button color="primary" onPress={applyDraft}>
                                    {text.apply}
                                </Button>
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
