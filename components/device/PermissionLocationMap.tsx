"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

interface PermissionLocationMapProps {
  latitude: number;
  longitude: number;
  accuracy: number;
}

const MapWithNoSSR = dynamic(() => import("./PermissionLocationMapContent"), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 items-center justify-center rounded-[1.5rem] border border-slate-200 bg-slate-50">
      <span className="text-sm text-slate-500">กำลังโหลดแผนที่...</span>
    </div>
  ),
});

export default function PermissionLocationMap(props: PermissionLocationMapProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  if (!isMounted) {
    return (
      <div className="flex h-72 items-center justify-center rounded-[1.5rem] border border-slate-200 bg-slate-50">
        <span className="text-sm text-slate-500">กำลังโหลดแผนที่...</span>
      </div>
    );
  }

  return <MapWithNoSSR {...props} />;
}
