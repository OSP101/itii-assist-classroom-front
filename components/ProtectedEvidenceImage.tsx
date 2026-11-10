"use client";

import { useEffect, useState, type ImgHTMLAttributes } from "react";
import api from "@/services/api.service";

// Evidence is fetched with the same session refresh behavior as its review
// page. Local upload previews remain ordinary blob/data images.
export function ProtectedEvidenceImage({ src, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
    const evidenceSrc = typeof src === "string" && src.includes("/api/uploads/score-edit-requests/") ? src : undefined;
    const [resolved, setResolved] = useState<string | undefined>();
    useEffect(() => {
        if (!evidenceSrc) return;
        let active = true;
        let objectUrl: string | undefined;
        setResolved(undefined);
        const path = new URL(evidenceSrc, window.location.origin).pathname.replace(/^\/api/, "");
        void api.getBlob(path).then((blob) => {
            if (!active) return;
            if (blob) {
                objectUrl = URL.createObjectURL(blob);
                setResolved(objectUrl);
            } else setResolved(evidenceSrc);
        }).catch(() => { if (active) setResolved(evidenceSrc); });
        return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [evidenceSrc]);
    return <img {...props} src={evidenceSrc ? resolved : src} />;
}
