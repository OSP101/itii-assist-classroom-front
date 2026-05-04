"use client";

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in Leaflet with Next.js
if (typeof window !== 'undefined') {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });
}

interface MapContentProps {
    latitude?: number;
    longitude?: number;
    radius?: number;
    onLocationChange: (lat: number, lng: number) => void;
}

export default function MapContent({ latitude, longitude, radius = 100, onLocationChange }: MapContentProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);
    const circleRef = useRef<L.Circle | null>(null);
    const [isMapReady, setIsMapReady] = useState(false);

    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;

        // ค่า default (มหาวิทยาลัยขอนแก่น)
        const defaultCenter: [number, number] = latitude && longitude
            ? [latitude, longitude]
            : [16.475658, 102.825331];

        // สร้าง map
        const map = L.map(mapRef.current, {
            center: defaultCenter,
            zoom: 17,
            zoomControl: true,
        });

        // เพิ่ม tile layer (OpenStreetMap)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;
        setIsMapReady(true);

        // สร้าง marker และ circle เริ่มต้น (ถ้ามี)
        if (latitude && longitude) {
            const marker = L.marker([latitude, longitude], {
                draggable: true,
            }).addTo(map);

            const circle = L.circle([latitude, longitude], {
                radius: radius,
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.2,
            }).addTo(map);

            markerRef.current = marker;
            circleRef.current = circle;

            // เมื่อลาก marker
            marker.on('dragend', (e) => {
                const position = e.target.getLatLng();
                onLocationChange(position.lat, position.lng);
                if (circleRef.current) {
                    circleRef.current.setLatLng([position.lat, position.lng]);
                }
            });
        }

        // คลิกบนแผนที่เพื่อปักหมุด
        map.on('click', (e) => {
            const { lat, lng } = e.latlng;

            if (markerRef.current) {
                markerRef.current.setLatLng([lat, lng]);
            } else {
                const marker = L.marker([lat, lng], {
                    draggable: true,
                }).addTo(map);

                markerRef.current = marker;

                // เมื่อลาก marker
                marker.on('dragend', (e) => {
                    const position = e.target.getLatLng();
                    onLocationChange(position.lat, position.lng);
                    if (circleRef.current) {
                        circleRef.current.setLatLng([position.lat, position.lng]);
                    }
                });
            }

            // อัปเดต circle
            if (circleRef.current) {
                circleRef.current.setLatLng([lat, lng]);
            } else {
                const circle = L.circle([lat, lng], {
                    radius: radius,
                    color: '#3b82f6',
                    fillColor: '#3b82f6',
                    fillOpacity: 0.2,
                }).addTo(map);
                circleRef.current = circle;
            }

            onLocationChange(lat, lng);
        });

        // Cleanup
        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
                markerRef.current = null;
                circleRef.current = null;
            }
        };
    }, []);

    // อัปเดต marker และ circle เมื่อ latitude/longitude เปลี่ยนจากภายนอก
    useEffect(() => {
        if (!isMapReady || !mapInstanceRef.current) return;

        if (latitude && longitude) {
            if (markerRef.current) {
                markerRef.current.setLatLng([latitude, longitude]);
            } else {
                const marker = L.marker([latitude, longitude], {
                    draggable: true,
                }).addTo(mapInstanceRef.current);

                markerRef.current = marker;

                marker.on('dragend', (e) => {
                    const position = e.target.getLatLng();
                    onLocationChange(position.lat, position.lng);
                    if (circleRef.current) {
                        circleRef.current.setLatLng([position.lat, position.lng]);
                    }
                });
            }

            // อัปเดต circle
            if (circleRef.current) {
                circleRef.current.setLatLng([latitude, longitude]);
            } else {
                const circle = L.circle([latitude, longitude], {
                    radius: radius,
                    color: '#3b82f6',
                    fillColor: '#3b82f6',
                    fillOpacity: 0.2,
                }).addTo(mapInstanceRef.current);
                circleRef.current = circle;
            }

            // Pan map to new location
            mapInstanceRef.current.setView([latitude, longitude], mapInstanceRef.current.getZoom());
        } else if (markerRef.current && mapInstanceRef.current) {
            mapInstanceRef.current.removeLayer(markerRef.current);
            markerRef.current = null;
            if (circleRef.current) {
                mapInstanceRef.current.removeLayer(circleRef.current);
                circleRef.current = null;
            }
        }
    }, [latitude, longitude, isMapReady, onLocationChange]);

    // อัปเดต radius ของ circle
    useEffect(() => {
        if (circleRef.current && radius) {
            circleRef.current.setRadius(radius);
        }
    }, [radius]);

    return (
        <div
            ref={mapRef}
            style={{ width: '100%', height: '300px', zIndex: 0 }}
            className="rounded-xl border border-gray-200"
        />
    );
}
