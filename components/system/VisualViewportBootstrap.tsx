"use client";

import { useEffect } from "react";
import { trackVisualViewportHeight } from "@/lib/visual-viewport";

export function VisualViewportBootstrap() {
  useEffect(() => trackVisualViewportHeight(), []);

  return null;
}
