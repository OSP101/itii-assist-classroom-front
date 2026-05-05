"use client";

import { useEffect } from "react";
import { addCollection } from "@iconify/react";
import solarIcons from "@iconify-json/solar/icons.json";

let hasRegisteredSolarIcons = false;

export function IconifyPreload() {
  useEffect(() => {
    if (hasRegisteredSolarIcons) {
      return;
    }

    addCollection(solarIcons as Parameters<typeof addCollection>[0]);
    hasRegisteredSolarIcons = true;
  }, []);

  return null;
}
