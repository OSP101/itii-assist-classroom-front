"use client";

import { useEffect } from "react";
import { addCollection } from "@iconify/react";
import solarIcons from "@iconify-json/solar/icons.json";
import offlineIcons from "@/lib/offline-icons.json";

// Every icon the app renders has to be registered here.
//
// @iconify/react falls back to fetching unknown icons from api.iconify.design
// (then api.unisvg.com, then api.simplesvg.com) at runtime. Our CSP allows no
// such origin in connect-src, so those requests are blocked and the icon just
// never appears — silently, with only a console CSP violation to show for it.
// That is how the GitHub mark on /login went missing.
//
// `solar` is the house icon set (~1500 uses) and ships as a whole collection.
// The other six sets account for 13 icons in total, and their full packages
// run to megabytes, so lib/offline-icons.json carries just those 13 — pulled
// from the same public API the runtime would have called.
//
// Adding an icon from a set that is not listed below will look fine in dev
// (where the CDN fetch is not blocked by a CSP) and silently render nothing in
// production. Regenerate the JSON instead:
//
//   curl -s 'https://api.iconify.design/<prefix>.json?icons=<a>,<b>' -o /tmp/x.json
//
// then merge the {prefix, icons, width, height, …} object into
// lib/offline-icons.json under its prefix key.
type IconCollection = Parameters<typeof addCollection>[0];

let hasRegisteredIcons = false;

export function IconifyPreload() {
  useEffect(() => {
    if (hasRegisteredIcons) {
      return;
    }

    addCollection(solarIcons as IconCollection);
    for (const collection of Object.values(offlineIcons)) {
      addCollection(collection as IconCollection);
    }
    hasRegisteredIcons = true;
  }, []);

  return null;
}
