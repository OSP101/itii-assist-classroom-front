/**
 * Shared helpers for pinning a table's trailing "actions" column.
 *
 * Wide instructor tables scroll sideways on mobile, and the actions column falls
 * off the right edge with no hint that it exists. Pinning that column keeps it in
 * view; a left-edge shadow signals that content scrolls underneath it. The shadow
 * is shown only while the table actually overflows, so it never appears as stray
 * chrome on a desktop where the whole table fits.
 *
 * Usage (HeroUI Table):
 *   const { scrollRef, hasOverflow } = useHorizontalOverflow();
 *   <div ref={scrollRef} data-overflow={hasOverflow ? "true" : "false"} className={STICKY_SCROLL_CONTAINER_CLASS}>
 *     <Table ...>
 *       <TableColumn className={`${STICKY_ACTION_HEADER_CLASS} min-w-40`}>Actions</TableColumn>
 *       ...
 *       <TableCell className={STICKY_ACTION_CELL_CLASS}>...</TableCell>
 */

import { useEffect, useRef, useState } from "react";

// The scroll container. `group/attn` scopes the shadow variant below to this
// table only, so nested tables cannot toggle each other's shadow.
export const STICKY_SCROLL_CONTAINER_CLASS = "group/attn overflow-x-auto";

// Shadow value is duplicated between header and cell so tailwind-merge treats
// them as one group. It renders only when the container carries data-overflow="true".
const PINNED_SHADOW =
    "transition-shadow group-data-[overflow=true]/attn:shadow-[-8px_0_12px_-8px_rgba(15,23,42,0.18)]";

// Opaque backgrounds (matching the header vs body surfaces) are required so the
// cells scrolling beneath the pinned column do not bleed through it.
export const STICKY_ACTION_HEADER_CLASS = `sticky right-0 z-20 bg-content2 ${PINNED_SHADOW}`;
export const STICKY_ACTION_CELL_CLASS = `sticky right-0 z-10 bg-content1 ${PINNED_SHADOW}`;

// Always-on-shadow variants for tables rendered inside a loop. Each looped table
// would need its own overflow ref, which a single hook cannot provide, so these
// skip the detection and always show the shadow — the same treatment already used
// by the exam-scores grid. Pair them with an existing `overflow-x-auto` container;
// no group/data-overflow wiring is required.
const PINNED_SHADOW_ALWAYS = "shadow-[-8px_0_12px_-8px_rgba(15,23,42,0.18)]";
export const STICKY_ACTION_HEADER_CLASS_ALWAYS = `sticky right-0 z-20 bg-content2 ${PINNED_SHADOW_ALWAYS}`;
export const STICKY_ACTION_CELL_CLASS_ALWAYS = `sticky right-0 z-10 bg-content1 ${PINNED_SHADOW_ALWAYS}`;

/**
 * Reports whether the referenced scroll container is currently wider than the
 * viewport allows. The table's own width is fixed (a min-width), so overflow only
 * changes when the container is resized — a ResizeObserver is enough; row changes
 * do not affect it.
 */
export function useHorizontalOverflow<T extends HTMLElement = HTMLDivElement>() {
    const scrollRef = useRef<T>(null);
    const [hasOverflow, setHasOverflow] = useState(false);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const update = () => setHasOverflow(el.scrollWidth - el.clientWidth > 1);
        update();
        const observer = new ResizeObserver(update);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return { scrollRef, hasOverflow };
}
