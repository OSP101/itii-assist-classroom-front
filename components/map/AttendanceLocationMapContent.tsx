"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

if (typeof window !== "undefined") {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: markerIcon2x.src,
        iconUrl: markerIcon.src,
        shadowUrl: markerShadow.src,
    });
}

interface AttendanceLocationMapContentProps {
    studentLat: number;
    studentLng: number;
    sessionLat: number;
    sessionLng: number;
    radiusMeters: number;
    distanceMeters: number | null;
    studentLabel: string;
    sessionLabel: string;
}

export default function AttendanceLocationMapContent({
    studentLat,
    studentLng,
    sessionLat,
    sessionLng,
    radiusMeters,
    distanceMeters,
    studentLabel,
    sessionLabel,
}: AttendanceLocationMapContentProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);

    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;

        const map = L.map(mapRef.current, {
            zoomControl: true,
            scrollWheelZoom: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;

        // Session location — blue circle + blue marker
        L.circle([sessionLat, sessionLng], {
            radius: radiusMeters,
            color: "#3b82f6",
            fillColor: "#3b82f6",
            fillOpacity: 0.15,
            weight: 2,
        }).addTo(map);

        const sessionIcon = L.divIcon({
            html: `<div style="background:#3b82f6;width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
            className: "",
            iconSize: [14, 14],
            iconAnchor: [7, 7],
        });
        L.marker([sessionLat, sessionLng], { icon: sessionIcon })
            .bindTooltip(sessionLabel, { permanent: true, direction: "top", offset: [0, -10], className: "leaflet-tooltip-session" })
            .addTo(map);

        // Student location — red marker
        const studentIcon = L.divIcon({
            html: `<div style="background:#ef4444;width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
            className: "",
            iconSize: [14, 14],
            iconAnchor: [7, 7],
        });
        const studentTooltipText = distanceMeters !== null
            ? `${studentLabel} (${Math.round(distanceMeters)} m)`
            : studentLabel;
        L.marker([studentLat, studentLng], { icon: studentIcon })
            .bindTooltip(studentTooltipText, { permanent: true, direction: "top", offset: [0, -10], className: "leaflet-tooltip-student" })
            .addTo(map);

        // Draw a dashed line between the two points
        L.polyline([[sessionLat, sessionLng], [studentLat, studentLng]], {
            color: "#6b7280",
            weight: 1.5,
            dashArray: "5,6",
            opacity: 0.7,
        }).addTo(map);

        // Fit bounds to show both markers with some padding
        const bounds = L.latLngBounds(
            [studentLat, studentLng],
            [sessionLat, sessionLng]
        );
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 18 });

        return () => {
            map.remove();
            mapInstanceRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <div ref={mapRef} style={{ width: "100%", height: "280px" }} />;
}
