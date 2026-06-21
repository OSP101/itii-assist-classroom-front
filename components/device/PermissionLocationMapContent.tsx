"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  });
}

interface PermissionLocationMapContentProps {
  latitude: number;
  longitude: number;
  accuracy: number;
}

function getAccuracyBounds(latitude: number, longitude: number, accuracy: number) {
  return L.latLng(latitude, longitude).toBounds(Math.max(accuracy, 10) * 2);
}

export default function PermissionLocationMapContent({
  latitude,
  longitude,
  accuracy,
}: PermissionLocationMapContentProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    });

    map.setView([latitude, longitude], 16);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;
    markerRef.current = L.marker([latitude, longitude]).addTo(map);
    circleRef.current = L.circle([latitude, longitude], {
      radius: Math.max(accuracy, 10),
      color: "#0f766e",
      fillColor: "#2dd4bf",
      fillOpacity: 0.18,
      weight: 2,
    }).addTo(map);

    map.fitBounds(getAccuracyBounds(latitude, longitude, accuracy), {
      padding: [28, 28],
      maxZoom: 18,
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, [accuracy, latitude, longitude]);

  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current || !circleRef.current) return;

    markerRef.current.setLatLng([latitude, longitude]);
    circleRef.current.setLatLng([latitude, longitude]);
    circleRef.current.setRadius(Math.max(accuracy, 10));
    mapInstanceRef.current.fitBounds(getAccuracyBounds(latitude, longitude, accuracy), {
      padding: [28, 28],
      maxZoom: 18,
    });
  }, [accuracy, latitude, longitude]);

  return <div ref={mapRef} className="h-72 w-full rounded-[1.5rem] border border-slate-200" />;
}
