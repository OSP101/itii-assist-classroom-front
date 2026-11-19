"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import { useI18n } from "@/hooks/useI18n";
import { buildStudentLoginHref, peekOAuthReturnPath } from "@/lib/auth-resume";

const selectionEndpoint = "/api/auth/student-selection";

interface StudentSelection {
    selection_id: string;
    choices: { student_id: string; full_name: string }[];
}

export function StudentLoginSelection() {
    const t = useI18n();
    const router = useRouter();
    const [selection, setSelection] = useState<StudentSelection | null>(null);
    const [studentId, setStudentId] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [loadAttempt, setLoadAttempt] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        async function loadChoices() {
            try {
                const response = await fetch(selectionEndpoint, { cache: "no-store", signal: controller.signal });
                if (controller.signal.aborted) return;
                if (!response.ok) {
                    setError(response.status === 401 ? "studentSelectionExpired" : "studentSelectionLoadError");
                    return;
                }
                const data: StudentSelection = await response.json();
                if (!controller.signal.aborted) {
                    setSelection(data);
                    if (!data.choices.length) setError("studentSelectionEmpty");
                }
            } catch {
                if (!controller.signal.aborted) setError("studentSelectionLoadError");
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }
        void loadChoices();
        return () => controller.abort();
    }, [loadAttempt]);

    function reloadChoices(message = "") {
        setSelection(null);
        setStudentId("");
        setError(message);
        setLoading(true);
        setLoadAttempt((previous) => previous + 1);
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!selection || !studentId || submitting) return;

        setSubmitting(true);
        setError("");
        try {
            const response = await fetch(selectionEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ student_id: studentId, selection_id: selection.selection_id }),
            });
            if (response.ok) {
                window.location.replace("/auth/callback?login=success");
                return;
            }
            if (response.status === 409) {
                reloadChoices("studentSelectionUnavailable");
            } else if (response.status === 401) {
                setSelection(null);
                setError("studentSelectionExpired");
            } else {
                setError("studentSelectionSubmitError");
            }
        } catch {
            setError("studentSelectionSubmitError");
        }
        setSubmitting(false);
    }

    const hasChoices = Boolean(selection?.choices.length);

    return (
        <section aria-labelledby="student-selection-title" className="space-y-5">
            <div className="space-y-2">
                <h1 id="student-selection-title" className="text-balance text-2xl font-semibold">
                    {t("studentSelectionTitle")}
                </h1>
                {hasChoices && <p className="text-sm leading-relaxed text-default-600">{t("studentSelectionDescription")}</p>}
            </div>

            {loading && (
                <div role="status" className="flex items-center gap-3 text-sm text-default-600">
                    <Spinner size="sm" aria-hidden="true" />
                    {t("studentSelectionLoading")}
                </div>
            )}
            {error && <p role="alert" className="text-sm leading-relaxed text-danger-700">{t(error)}</p>}

            {hasChoices && (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <fieldset aria-labelledby="student-selection-title" disabled={submitting} className="space-y-2">
                        {selection?.choices.map((choice) => (
                            <label key={choice.student_id} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border border-default-300 px-4 py-2 transition-colors hover:border-primary focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary has-checked:border-primary has-checked:bg-primary-50">
                                <input type="radio" name="studentId" value={choice.student_id} checked={studentId === choice.student_id} onChange={() => setStudentId(choice.student_id)} className="size-4 shrink-0 accent-primary" />
                                <span className="min-w-0">
                                    <span className="block font-semibold tabular-nums">{choice.student_id}</span>
                                    <span className="block wrap-break-word text-sm text-default-600">{choice.full_name}</span>
                                </span>
                            </label>
                        ))}
                    </fieldset>
                    <Button type="submit" color="primary" fullWidth isDisabled={!studentId || submitting} isLoading={submitting} className="min-h-11 bg-blue-700 text-white dark:bg-blue-300 dark:text-blue-950">
                        {t("studentSelectionContinue")}
                    </Button>
                </form>
            )}

            {error === "studentSelectionLoadError" && (
                <Button variant="bordered" fullWidth onPress={() => reloadChoices()}>{t("retry")}</Button>
            )}
            <Button type="button" variant="light" fullWidth isDisabled={submitting} className="min-h-11" onPress={() => router.replace(buildStudentLoginHref(peekOAuthReturnPath()))}>
                {t("studentSelectionRestart")}
            </Button>
        </section>
    );
}
