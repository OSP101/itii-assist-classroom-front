import { useState } from "react";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Chip } from "@heroui/chip";
import { Icon } from "@iconify/react";
import { useI18n } from "@/hooks/useI18n";
import type { Instructor } from "@/services/course.service";

interface CourseInstructorAutocompleteProps {
    instructors: Instructor[];
    existingInstructors?: Instructor[];
    selectedIds?: number[];
    onChange: (ids: number[]) => void;
    label: string;
    excludeId?: number | null;
    isEditing?: boolean;
}

export function CourseInstructorAutocomplete({
    instructors,
    existingInstructors = [],
    selectedIds = [],
    onChange,
    label,
    excludeId,
    isEditing,
}: CourseInstructorAutocompleteProps) {
    const t = useI18n();
    const [query, setQuery] = useState("");
    const selectedIdSet = new Set(selectedIds);
    const search = query.trim().normalize().toLowerCase();
    const matches = instructors.filter(({ id, full_name, email }) =>
        id !== excludeId &&
        !selectedIdSet.has(id) &&
        (full_name.normalize().toLowerCase().includes(search) || email?.toLowerCase().includes(search))
    );
    const instructorById = new Map([...existingInstructors, ...instructors].map((instructor) => [instructor.id, instructor]));
    const itemHeight = 48;

    return (
        <div className="space-y-2">
            <Autocomplete
                aria-label={label}
                placeholder={t("searchCourseInstructorsPlaceholder")}
                variant="bordered"
                size="lg"
                items={matches}
                inputValue={query}
                onInputChange={setQuery}
                isVirtualized={instructors.length > 50}
                itemHeight={itemHeight}
                maxListboxHeight={Math.min(256, Math.max(1, matches.length) * itemHeight + 8)}
                onSelectionChange={(key) => {
                    if (key === null) return;
                    const id = Number(key);
                    if (!matches.some((instructor) => instructor.id === id)) return;
                    onChange([...selectedIds, id]);
                    setQuery("");
                }}
                startContent={<Icon aria-hidden="true" icon="solar:magnifer-linear" className="shrink-0 text-default-500" />}
                inputProps={{
                    classNames: {
                        inputWrapper: isEditing
                            ? "bg-content1 border-default-200 hover:border-amber-300"
                            : "bg-content1 border-default-200 hover:border-blue-300",
                    },
                }}
                listboxProps={{ emptyContent: t("noResultsFound") }}
            >
                {(instructor) => (
                    <AutocompleteItem
                        key={instructor.id}
                        textValue={[instructor.full_name, instructor.email].filter(Boolean).join(" ")}
                        description={instructor.email ?? undefined}
                    >
                        {instructor.full_name}
                    </AutocompleteItem>
                )}
            </Autocomplete>
            {selectedIds.length > 0 && (
                <ul aria-label={t("selectedCourseInstructors")} className="flex flex-wrap gap-2">
                    {selectedIds.map((id) => {
                        const name = instructorById.get(id)?.full_name || String(id);
                        const removeLabel = `${t("removeCourseInstructor")} ${name}`;
                        return (
                            <li key={id} className="min-w-0 max-w-full">
                                <Chip
                                    size="sm"
                                    variant="flat"
                                    color={isEditing ? "warning" : "primary"}
                                    classNames={{ base: "max-w-full", content: "truncate" }}
                                    endContent={
                                        <button
                                            type="button"
                                            aria-label={removeLabel}
                                            title={removeLabel}
                                            className="flex size-6 shrink-0 items-center justify-center rounded-full focus-visible:outline-2"
                                            onClick={() => onChange(selectedIds.filter((selectedId) => selectedId !== id))}
                                        >
                                            <Icon aria-hidden="true" icon="solar:close-circle-linear" className="size-4" />
                                        </button>
                                    }
                                >
                                    {name}
                                </Chip>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
