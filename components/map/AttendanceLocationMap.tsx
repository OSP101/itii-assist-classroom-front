"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

interface AttendanceLocationMapProps {
    studentLat: number;
    studentLng: number;
    sessionLat: number;
    sessionLng: number;
    radiusMeters: number;
    distanceMeters: number | null;
    studentLabel: string;
    sessionLabel: string;
}

const MapWithNoSSR = dynamic(
    () => import("./AttendanceLocationMapContent"),
    {
        ssr: false,
        loading: () => (
            <div className="flex h-70 items-center justify-center rounded-lg bg-default-100">
                <span className="text-sm text-default-400">กำลังโหลดแผนที่...</span>
            </div>
        )
    }
);

export default function AttendanceLocationMap(props: AttendanceLocationMapProps) {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        return () => setIsMounted(false);
    }, []);

    if (!isMounted) {
        return (
            <div className="flex h-70 items-center justify-center rounded-lg bg-default-100">
                <span className="text-sm text-default-400">กำลังโหลดแผนที่...</span>
            </div>
        );
    }

    return <MapWithNoSSR {...props} />;
}
