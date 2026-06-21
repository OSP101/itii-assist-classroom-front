"use client";

import { useRef, useState, type ChangeEvent } from "react";
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
    const [isAdjustOpen, setIsAdjustOpen] = useState(false);
    const [draft, setDraft] = useState({
        cover_position_x: value.cover_position_x || COURSE_COVER_DEFAULT_POSITION_X,
        cover_position_y: value.cover_position_y || COURSE_COVER_DEFAULT_POSITION_Y,
        cover_zoom: value.cover_zoom || COURSE_COVER_DEFAULT_ZOOM,
    });

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
                <div className="flex items-center gap-2">
                    <Icon icon="solar:gallery-bold" className={`text-lg ${accentClassName}`} />
                    <span className="text-sm font-semibold text-default-700">{text.title}</span>
                </div>

                {value.image ? (
                    <>
                        <CourseCoverImage
                            src={value.image}
                            alt={text.title}
                            positionX={value.cover_position_x}
                            positionY={value.cover_position_y}
                            zoom={value.cover_zoom}
                            className="aspect-[4/1] w-full rounded-xl border border-default-200 bg-default-100"
                        />
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
                        <p className="mt-2 text-xs text-default-400">{text.recommendedSize}</p>
                    </button>
                )}

                {value.image ? (
                    <p className="text-xs text-default-400">
                        {text.recommendedSize}
                    </p>
                ) : null}
            </div>

            <Modal isOpen={isAdjustOpen} onClose={() => setIsAdjustOpen(false)} size="3xl">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>{text.modalTitle}</ModalHeader>
                            <ModalBody className="space-y-4">
                                <p className="text-sm text-default-500">{text.modalHint}</p>
                                <CourseCoverImage
                                    src={value.image}
                                    alt={text.title}
                                    positionX={draft.cover_position_x}
                                    positionY={draft.cover_position_y}
                                    zoom={draft.cover_zoom}
                                    className="aspect-[4/1] w-full rounded-xl border border-default-200 bg-slate-950"
                                />
                                <div className="space-y-3">
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
                                <div className="space-y-3">
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
                                <div className="space-y-3">
                                    <label className="block text-xs font-medium uppercase tracking-wide text-default-500">
                                        {text.zoom}
                                    </label>
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
    return `${prefix} ${COURSE_COVER_RECOMMENDED_WIDTH} x ${COURSE_COVER_RECOMMENDED_HEIGHT}px`;
}
