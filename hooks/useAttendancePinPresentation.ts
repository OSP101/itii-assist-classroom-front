import { useEffect, useState } from "react";

type PinSessionLike = {
    pin_code?: string | null;
    pin_issued_at?: string | null;
    pin_rotates_at?: string | null;
    auto_rotate_pin?: boolean;
    pin_mode?: "static" | "rotating" | string;
    status?: "draft" | "active" | "closed" | string;
};

type PinPresentationState = {
    isPending: boolean;
    isStatic: boolean;
    progressPercent: number | null;
    secondsLeft: number | null;
    totalSeconds: number | null;
};

const initialState: PinPresentationState = {
    isPending: false,
    isStatic: false,
    progressPercent: null,
    secondsLeft: null,
    totalSeconds: null,
};

export function useAttendancePinPresentation(session: PinSessionLike | null | undefined): PinPresentationState {
    const [state, setState] = useState<PinPresentationState>(initialState);

    useEffect(() => {
        if (!session || session.status !== "active") {
            setState(initialState);
            return;
        }

        if (!session.pin_code) {
            setState({
                isPending: true,
                isStatic: false,
                progressPercent: null,
                secondsLeft: null,
                totalSeconds: null,
            });
            return;
        }

        const isStaticMode = session.pin_mode === "static" || !session.auto_rotate_pin;

        if (isStaticMode || !session.pin_rotates_at) {
            setState({
                isPending: false,
                isStatic: true,
                progressPercent: null,
                secondsLeft: null,
                totalSeconds: null,
            });
            return;
        }

        const issuedAtMs = session.pin_issued_at ? new Date(session.pin_issued_at).getTime() : Date.now();
        const rotatesAtMs = new Date(session.pin_rotates_at).getTime();

        if (!Number.isFinite(issuedAtMs) || !Number.isFinite(rotatesAtMs) || rotatesAtMs <= issuedAtMs) {
            setState({
                isPending: false,
                isStatic: false,
                progressPercent: 0,
                secondsLeft: 0,
                totalSeconds: null,
            });
            return;
        }

        let frameId = 0;
        const totalSeconds = Math.max(1, Math.ceil((rotatesAtMs - issuedAtMs) / 1000));

        const tick = () => {
            const nowMs = Date.now();
            const remainingMs = Math.max(0, rotatesAtMs - nowMs);
            const remainingSeconds = Math.ceil(remainingMs / 1000);
            const progressPercent = Math.max(0, Math.min(100, (remainingMs / (rotatesAtMs - issuedAtMs)) * 100));

            setState({
                isPending: false,
                isStatic: false,
                progressPercent,
                secondsLeft: remainingSeconds,
                totalSeconds,
            });

            if (remainingMs > 0) {
                frameId = window.requestAnimationFrame(tick);
            }
        };

        tick();
        return () => window.cancelAnimationFrame(frameId);
    }, [
        session?.auto_rotate_pin,
        session?.pin_mode,
        session?.pin_code,
        session?.pin_issued_at,
        session?.pin_rotates_at,
        session?.status,
    ]);

    return state;
}
