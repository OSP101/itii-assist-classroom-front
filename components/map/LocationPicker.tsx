"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

interface LocationPickerProps {
    latitude?: number;
    longitude?: number;
    radius?: number;
    onLocationChange: (lat: number, lng: number) => void;
    className?: string;
}

// Dynamically import map components with SSR disabled
const MapWithNoSSR = dynamic(
    () => import("./MapContent"),
    { 
        ssr: false,
        loading: () => (
            <div className="h-75 bg-slate-100 rounded-xl flex items-center justify-center">
                <span className="text-sm text-slate-500">กำลังโหลดแผนที่...</span>
            </div>
        )
    }
);

export default function LocationPicker({
    latitude,
    longitude,
    radius = 100,
    onLocationChange,
    className = "",
}: LocationPickerProps) {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        return () => setIsMounted(false);
    }, []);

    if (!isMounted) {
        return (
            <div className={`relative ${className}`}>
                <div className="h-75 bg-slate-100 rounded-xl flex items-center justify-center">
                    <span className="text-sm text-slate-500">กำลังโหลดแผนที่...</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`relative ${className}`}>
            <MapWithNoSSR
                latitude={latitude}
                longitude={longitude}
                radius={radius}
                onLocationChange={onLocationChange}
            />
            <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs text-slate-600 shadow-sm z-1000">
                คลิกบนแผนที่เพื่อปักหมุด
            </div>
        </div>
    );
}
