"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Desk {
    id: string;
    x: number;
    y: number;
    type: "computer" | "normal" | "teacher";
    isEnabled: boolean;
    number: number;
}

interface Zone {
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
}

interface CanvasEditorProps {
    width: number;
    height: number;
    canvasWidth: number;
    canvasHeight: number;
    scale: number;
    desks: Desk[];
    zones: Zone[];
    gridSize: number;
    deskWidth: number;
    deskHeight: number;
    teacherDeskWidth: number;
    teacherDeskHeight: number;
    selectedDeskIds: Set<string>;
    onDeskDragEnd: (deskId: string, e: { target: { x: () => number; y: () => number } }) => void;
    onMultiDeskDragEnd: (moves: { id: string; x: number; y: number }[]) => void;
    onDeskClick: (desk: Desk) => void;
    onSelectionChange: (ids: Set<string>) => void;
    onZoom?: (delta: number) => void;
    onZoneUpdate?: (zoneId: string, update: Partial<Zone>) => void;
}

function getDeskSize(desk: Desk, dw: number, dh: number, tw: number, th: number) {
    const isTeacher = desk.type === "teacher";
    return { w: isTeacher ? tw : dw, h: isTeacher ? th : dh };
}

const MIN_ZONE_SIZE = 80;
const HANDLE_SIZE = 10;

export default function CanvasEditor({
    width,
    height,
    canvasWidth,
    canvasHeight,
    scale,
    desks,
    zones,
    gridSize,
    deskWidth,
    deskHeight,
    teacherDeskWidth,
    teacherDeskHeight,
    selectedDeskIds,
    onDeskDragEnd,
    onMultiDeskDragEnd,
    onDeskClick,
    onSelectionChange,
    onZoom,
    onZoneUpdate,
}: CanvasEditorProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<any>(null);
    const layerRef = useRef<any>(null);
    const guidesLayerRef = useRef<any>(null);
    const selectionLayerRef = useRef<any>(null);
    const selectionRectRef = useRef<any>(null);
    const KonvaRef = useRef<any>(null);

    // Track Konva readiness so the redraw effect fires after init
    const [konvaReady, setKonvaReady] = useState(false);

    const onDeskDragEndRef = useRef(onDeskDragEnd);
    const onMultiDeskDragEndRef = useRef(onMultiDeskDragEnd);
    const onDeskClickRef = useRef(onDeskClick);
    const onSelectionChangeRef = useRef(onSelectionChange);
    const onZoomRef = useRef(onZoom);
    const onZoneUpdateRef = useRef(onZoneUpdate);
    const desksRef = useRef(desks);
    const selectedIdsRef = useRef(selectedDeskIds);
    const scaleRef = useRef(scale);
    const zonesRef = useRef(zones);

    const isDraggingMultiRef = useRef(false);
    const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
    const deskGroupMapRef = useRef<Map<string, any>>(new Map());

    const isSelectingRef = useRef(false);
    const selectStartRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        onDeskDragEndRef.current = onDeskDragEnd;
        onMultiDeskDragEndRef.current = onMultiDeskDragEnd;
        onDeskClickRef.current = onDeskClick;
        onSelectionChangeRef.current = onSelectionChange;
        onZoomRef.current = onZoom;
        onZoneUpdateRef.current = onZoneUpdate;
        desksRef.current = desks;
        selectedIdsRef.current = selectedDeskIds;
        scaleRef.current = scale;
        zonesRef.current = zones;
    }, [onDeskDragEnd, onMultiDeskDragEnd, onDeskClick, onSelectionChange, onZoom, onZoneUpdate, desks, selectedDeskIds, scale, zones]);

    const snapToGrid = useCallback((v: number) => Math.round(v / gridSize) * gridSize, [gridSize]);

    const getAlignEdges = useCallback((excludeIds: Set<string>) => {
        const xs: number[] = [];
        const ys: number[] = [];
        desksRef.current.forEach((d) => {
            if (excludeIds.has(d.id)) return;
            const { w, h } = getDeskSize(d, deskWidth, deskHeight, teacherDeskWidth, teacherDeskHeight);
            xs.push(d.x, d.x + w / 2, d.x + w);
            ys.push(d.y, d.y + h / 2, d.y + h);
        });
        return { xs, ys };
    }, [deskWidth, deskHeight, teacherDeskWidth, teacherDeskHeight]);

    const drawGuideLines = useCallback((lines: { x?: number; y?: number }[]) => {
        const gl = guidesLayerRef.current;
        if (!gl) return;
        const Konva = KonvaRef.current;
        if (!Konva) return;

        gl.destroyChildren();
        lines.forEach(({ x, y }) => {
            if (x !== undefined) {
                gl.add(new Konva.Line({
                    points: [x, 0, x, canvasHeight],
                    stroke: "#f43f5e",
                    strokeWidth: 1,
                    dash: [4, 4],
                    listening: false,
                }));
            }
            if (y !== undefined) {
                gl.add(new Konva.Line({
                    points: [0, y, canvasWidth, y],
                    stroke: "#f43f5e",
                    strokeWidth: 1,
                    dash: [4, 4],
                    listening: false,
                }));
            }
        });
        gl.batchDraw();
    }, [canvasWidth, canvasHeight]);

    const clearGuideLines = useCallback(() => {
        const gl = guidesLayerRef.current;
        if (gl) { gl.destroyChildren(); gl.batchDraw(); }
    }, []);

    const clampPosition = useCallback((x: number, y: number, w: number, h: number) => {
        return {
            x: Math.max(0, Math.min(x, canvasWidth - w)),
            y: Math.max(0, Math.min(y, canvasHeight - h)),
        };
    }, [canvasWidth, canvasHeight]);

    const findSnapAlign = useCallback((deskX: number, deskY: number, deskW: number, deskH: number, excludeIds: Set<string>) => {
        const SNAP_THRESHOLD = 8;
        const { xs, ys } = getAlignEdges(excludeIds);

        const myXEdges = [deskX, deskX + deskW / 2, deskX + deskW];
        const myYEdges = [deskY, deskY + deskH / 2, deskY + deskH];

        let snappedX = deskX;
        let snappedY = deskY;
        let bestDiffX = SNAP_THRESHOLD;
        let bestDiffY = SNAP_THRESHOLD;

        for (const mx of myXEdges) {
            for (const ox of xs) {
                const diff = Math.abs(mx - ox);
                if (diff < bestDiffX) { bestDiffX = diff; snappedX = deskX + (ox - mx); }
            }
        }
        for (const my of myYEdges) {
            for (const oy of ys) {
                const diff = Math.abs(my - oy);
                if (diff < bestDiffY) { bestDiffY = diff; snappedY = deskY + (oy - my); }
            }
        }

        const finalGuides: { x?: number; y?: number }[] = [];
        if (bestDiffX < SNAP_THRESHOLD) {
            const snappedEdges = [snappedX, snappedX + deskW / 2, snappedX + deskW];
            for (const ox of xs) {
                if (snappedEdges.some(e => Math.abs(e - ox) < 1)) finalGuides.push({ x: ox });
            }
        }
        if (bestDiffY < SNAP_THRESHOLD) {
            const snappedEdges = [snappedY, snappedY + deskH / 2, snappedY + deskH];
            for (const oy of ys) {
                if (snappedEdges.some(e => Math.abs(e - oy) < 1)) finalGuides.push({ y: oy });
            }
        }
        return { x: snappedX, y: snappedY, guides: finalGuides };
    }, [getAlignEdges]);

    const toCanvasCoords = useCallback((pos: { x: number; y: number }) => {
        return { x: pos.x / scaleRef.current, y: pos.y / scaleRef.current };
    }, []);

    // ============ Initialize Konva Stage ============
    useEffect(() => {
        if (!containerRef.current || typeof window === "undefined") return;

        let destroyed = false;

        const initKonva = async () => {
            const Konva = (await import("konva")).default;
            if (destroyed) return;
            KonvaRef.current = Konva;

            const stage = new Konva.Stage({
                container: containerRef.current!,
                width,
                height,
                scaleX: scale,
                scaleY: scale,
            });

            const layer = new Konva.Layer();
            const guidesLayer = new Konva.Layer();
            const selectionLayer = new Konva.Layer();

            stage.add(layer);
            stage.add(guidesLayer);
            stage.add(selectionLayer);

            stageRef.current = stage;
            layerRef.current = layer;
            guidesLayerRef.current = guidesLayer;
            selectionLayerRef.current = selectionLayer;

            const selRect = new Konva.Rect({
                fill: "rgba(59,130,246,0.1)",
                stroke: "#3b82f6",
                strokeWidth: 1,
                visible: false,
                listening: false,
            });
            selectionLayer.add(selRect);
            selectionRectRef.current = selRect;

            // Rubber-band selection on empty space
            stage.on("mousedown touchstart", (e: any) => {
                if (e.target === stage) {
                    const rawPos = stage.getPointerPosition();
                    if (!rawPos) return;
                    const pos = toCanvasCoords(rawPos);
                    isSelectingRef.current = true;
                    selectStartRef.current = pos;
                    selRect.setAttrs({ x: pos.x, y: pos.y, width: 0, height: 0, visible: true });
                    selectionLayer.batchDraw();
                }
            });

            stage.on("mousemove touchmove", () => {
                if (!isSelectingRef.current) return;
                const rawPos = stage.getPointerPosition();
                if (!rawPos) return;
                const pos = toCanvasCoords(rawPos);
                const sx = Math.min(selectStartRef.current.x, pos.x);
                const sy = Math.min(selectStartRef.current.y, pos.y);
                const sw = Math.abs(pos.x - selectStartRef.current.x);
                const sh = Math.abs(pos.y - selectStartRef.current.y);
                selRect.setAttrs({ x: sx, y: sy, width: sw, height: sh });
                selectionLayer.batchDraw();
            });

            stage.on("mouseup touchend", (e: any) => {
                if (!isSelectingRef.current) return;
                isSelectingRef.current = false;
                const rx = selRect.x();
                const ry = selRect.y();
                const rw = selRect.width();
                const rh = selRect.height();
                selRect.visible(false);
                selectionLayer.batchDraw();

                if (rw < 5 && rh < 5) {
                    if (e.target === stage) onSelectionChangeRef.current(new Set());
                    return;
                }

                const newSelected = new Set<string>();
                desksRef.current.forEach((desk) => {
                    const { w, h } = getDeskSize(desk, deskWidth, deskHeight, teacherDeskWidth, teacherDeskHeight);
                    const cx = desk.x + w / 2;
                    const cy = desk.y + h / 2;
                    if (cx >= rx && cx <= rx + rw && cy >= ry && cy <= ry + rh) newSelected.add(desk.id);
                });
                onSelectionChangeRef.current(newSelected);
            });

            // Mouse wheel zoom
            stage.on("wheel", (e: any) => {
                e.evt.preventDefault();
                const delta = e.evt.deltaY > 0 ? -1 : 1;
                if (onZoomRef.current) onZoomRef.current(delta);
            });

            // Signal ready so redraw effect fires
            setKonvaReady(true);
        };

        initKonva();

        return () => {
            destroyed = true;
            if (stageRef.current) {
                stageRef.current.destroy();
                stageRef.current = null;
                layerRef.current = null;
                guidesLayerRef.current = null;
                selectionLayerRef.current = null;
            }
            setKonvaReady(false);
        };
    }, [width, height]);

    // Update stage scale
    useEffect(() => {
        if (stageRef.current) {
            stageRef.current.scaleX(scale);
            stageRef.current.scaleY(scale);
            stageRef.current.batchDraw();
        }
    }, [scale]);

    // Update stage size
    useEffect(() => {
        if (stageRef.current) {
            stageRef.current.width(width);
            stageRef.current.height(height);
            stageRef.current.batchDraw();
        }
    }, [width, height]);

    // ============ Redraw all content ============
    useEffect(() => {
        if (!konvaReady || !layerRef.current || !KonvaRef.current) return;

        const Konva = KonvaRef.current;
        const layer = layerRef.current;

        layer.destroyChildren();
        deskGroupMapRef.current.clear();

        // Draw grid
        const gridColor = "#e2e8f0";
        for (let i = 0; i <= canvasWidth; i += gridSize) {
            const isMajor = i % (gridSize * 5) === 0;
            layer.add(new Konva.Line({
                points: [i, 0, i, canvasHeight],
                stroke: gridColor,
                strokeWidth: isMajor ? 1.5 : 0.5,
                opacity: isMajor ? 0.6 : 0.3,
                listening: false,
            }));
        }
        for (let i = 0; i <= canvasHeight; i += gridSize) {
            const isMajor = i % (gridSize * 5) === 0;
            layer.add(new Konva.Line({
                points: [0, i, canvasWidth, i],
                stroke: gridColor,
                strokeWidth: isMajor ? 1.5 : 0.5,
                opacity: isMajor ? 0.6 : 0.3,
                listening: false,
            }));
        }

        // Canvas boundary
        layer.add(new Konva.Rect({
            x: 0, y: 0,
            width: canvasWidth,
            height: canvasHeight,
            stroke: "#94a3b8",
            strokeWidth: 2,
            listening: false,
        }));

        // ============ Draw Zones (draggable + resizable) โซน ============
        zones.forEach((zone) => {
            const zoneGroup = new Konva.Group({
                x: zone.x,
                y: zone.y,
                draggable: true,
                name: `zone-${zone.id}`,
            });

            // Zone body rect
            const bodyRect = new Konva.Rect({
                width: zone.width,
                height: zone.height,
                fill: zone.color + "10",
                stroke: zone.color,
                strokeWidth: 2,
                dash: [10, 5],
                cornerRadius: 4,
            });
            zoneGroup.add(bodyRect);

            // Label tab
            const labelText = zone.name;
            const labelFontSize = 14;
            const labelPadX = 10;
            const labelPadY = 4;
            const labelW = Math.max(60, labelText.length * (labelFontSize * 0.7) + labelPadX * 2);
            const labelH = labelFontSize + labelPadY * 2;

            zoneGroup.add(new Konva.Rect({
                x: 0,
                y: -labelH - 2,
                width: labelW,
                height: labelH,
                fill: zone.color,
                cornerRadius: [4, 4, 0, 0],
            }));

            zoneGroup.add(new Konva.Text({
                x: labelPadX,
                y: -labelH - 2 + labelPadY,
                text: labelText,
                fontSize: labelFontSize,
                fontStyle: "bold",
                fill: "white",
            }));

            // ---- Resize handles (8 handles: 4 corners + 4 edges) ----
            const handleColor = zone.color;
            const hs = HANDLE_SIZE;
            type HandleAnchor =
                | "top-left" | "top-center" | "top-right"
                | "middle-left" | "middle-right"
                | "bottom-left" | "bottom-center" | "bottom-right";

            const getHandlePos = (anchor: HandleAnchor, w: number, h: number) => {
                const half = hs / 2;
                switch (anchor) {
                    case "top-left": return { x: -half, y: -half };
                    case "top-center": return { x: w / 2 - half, y: -half };
                    case "top-right": return { x: w - half, y: -half };
                    case "middle-left": return { x: -half, y: h / 2 - half };
                    case "middle-right": return { x: w - half, y: h / 2 - half };
                    case "bottom-left": return { x: -half, y: h - half };
                    case "bottom-center": return { x: w / 2 - half, y: h - half };
                    case "bottom-right": return { x: w - half, y: h - half };
                }
            };

            const getCursor = (anchor: HandleAnchor) => {
                switch (anchor) {
                    case "top-left": case "bottom-right": return "nwse-resize";
                    case "top-right": case "bottom-left": return "nesw-resize";
                    case "top-center": case "bottom-center": return "ns-resize";
                    case "middle-left": case "middle-right": return "ew-resize";
                }
            };

            const anchors: HandleAnchor[] = [
                "top-left", "top-center", "top-right",
                "middle-left", "middle-right",
                "bottom-left", "bottom-center", "bottom-right",
            ];

            anchors.forEach((anchor) => {
                const pos = getHandlePos(anchor, zone.width, zone.height);
                const handle = new Konva.Rect({
                    x: pos.x,
                    y: pos.y,
                    width: hs,
                    height: hs,
                    fill: "white",
                    stroke: handleColor,
                    strokeWidth: 1.5,
                    cornerRadius: 2,
                    draggable: true,
                    name: `handle-${anchor}`,
                });

                handle.on("mouseenter", () => {
                    if (containerRef.current) containerRef.current.style.cursor = getCursor(anchor);
                });
                handle.on("mouseleave", () => {
                    if (containerRef.current) containerRef.current.style.cursor = "default";
                });

                // Track resize start state
                let resizeStart = { x: zone.x, y: zone.y, w: zone.width, h: zone.height, hx: 0, hy: 0 };

                handle.on("dragstart", (e: any) => {
                    e.cancelBubble = true;
                    const curBody = bodyRect;
                    resizeStart = {
                        x: zoneGroup.x(),
                        y: zoneGroup.y(),
                        w: curBody.width(),
                        h: curBody.height(),
                        hx: handle.x(),
                        hy: handle.y(),
                    };
                });

                handle.on("dragmove", (e: any) => {
                    e.cancelBubble = true;
                    const dx = handle.x() - resizeStart.hx;
                    const dy = handle.y() - resizeStart.hy;

                    let newX = resizeStart.x;
                    let newY = resizeStart.y;
                    let newW = resizeStart.w;
                    let newH = resizeStart.h;

                    // Adjust based on which anchor is dragged
                    if (anchor.includes("left")) {
                        newX = resizeStart.x + dx;
                        newW = resizeStart.w - dx;
                    }
                    if (anchor.includes("right")) {
                        newW = resizeStart.w + dx;
                    }
                    if (anchor.startsWith("top")) {
                        newY = resizeStart.y + dy;
                        newH = resizeStart.h - dy;
                    }
                    if (anchor.startsWith("bottom")) {
                        newH = resizeStart.h + dy;
                    }

                    // Enforce minimum size
                    if (newW < MIN_ZONE_SIZE) {
                        if (anchor.includes("left")) newX = resizeStart.x + resizeStart.w - MIN_ZONE_SIZE;
                        newW = MIN_ZONE_SIZE;
                    }
                    if (newH < MIN_ZONE_SIZE) {
                        if (anchor.startsWith("top")) newY = resizeStart.y + resizeStart.h - MIN_ZONE_SIZE;
                        newH = MIN_ZONE_SIZE;
                    }

                    // Clamp to canvas
                    if (newX < 0) { newW += newX; newX = 0; }
                    if (newY < 0) { newH += newY; newY = 0; }
                    if (newX + newW > canvasWidth) newW = canvasWidth - newX;
                    if (newY + newH > canvasHeight) newH = canvasHeight - newY;

                    // Update visual immediately
                    zoneGroup.position({ x: newX, y: newY });
                    bodyRect.size({ width: newW, height: newH });

                    // Reposition all handles
                    anchors.forEach((a) => {
                        const hNode = zoneGroup.findOne(`.handle-${a}`);
                        if (hNode) {
                            const p = getHandlePos(a, newW, newH);
                            hNode.position(p);
                        }
                    });

                    // Reset current handle position to avoid compounding
                    const myPos = getHandlePos(anchor, newW, newH);
                    handle.position(myPos);
                    resizeStart = { x: newX, y: newY, w: newW, h: newH, hx: myPos.x, hy: myPos.y };

                    layer.batchDraw();
                });

                handle.on("dragend", (e: any) => {
                    e.cancelBubble = true;
                    const snapX = snapToGrid(zoneGroup.x());
                    const snapY = snapToGrid(zoneGroup.y());
                    const snapW = Math.max(MIN_ZONE_SIZE, snapToGrid(bodyRect.width()));
                    const snapH = Math.max(MIN_ZONE_SIZE, snapToGrid(bodyRect.height()));

                    if (onZoneUpdateRef.current) {
                        onZoneUpdateRef.current(zone.id, {
                            x: snapX,
                            y: snapY,
                            width: snapW,
                            height: snapH,
                        });
                    }
                });

                zoneGroup.add(handle);
            });

            // Zone drag events (move the whole zone)
            zoneGroup.on("dragmove", () => {
                const clamped = clampPosition(
                    zoneGroup.x(), zoneGroup.y(),
                    bodyRect.width(), bodyRect.height()
                );
                zoneGroup.position(clamped);
                layer.batchDraw();
            });

            zoneGroup.on("dragend", () => {
                const snapX = snapToGrid(zoneGroup.x());
                const snapY = snapToGrid(zoneGroup.y());
                zoneGroup.position({ x: snapX, y: snapY });
                layer.batchDraw();
                if (onZoneUpdateRef.current) {
                    onZoneUpdateRef.current(zone.id, { x: snapX, y: snapY });
                }
            });

            zoneGroup.on("mouseenter", () => {
                if (containerRef.current) containerRef.current.style.cursor = "move";
            });
            zoneGroup.on("mouseleave", () => {
                if (containerRef.current) containerRef.current.style.cursor = "default";
            });

            layer.add(zoneGroup);
        });

        // ============ Draw Desks ============
        desks.forEach((desk) => {
            const isTeacher = desk.type === "teacher";
            const currentWidth = isTeacher ? teacherDeskWidth : deskWidth;
            const currentHeight = isTeacher ? teacherDeskHeight : deskHeight;
            const isSelected = selectedDeskIds.has(desk.id);

            const group = new Konva.Group({
                x: desk.x,
                y: desk.y,
                draggable: true,
                name: `desk-${desk.id}`,
            });

            if (isSelected) {
                group.add(new Konva.Rect({
                    x: -4, y: -4,
                    width: currentWidth + 8,
                    height: currentHeight + 8,
                    stroke: "#3b82f6",
                    strokeWidth: 2.5,
                    cornerRadius: 10,
                    dash: [6, 3],
                    listening: false,
                }));
            }

            // สีของโต๊ะ
            const color = !desk.isEnabled ? "#cbd5e1"
                : desk.type === "computer" ? "#3b82f6"
                : desk.type === "teacher" ? "#f59e0b"
                : "#10b981";

            group.add(new Konva.Rect({
                width: currentWidth,
                height: currentHeight,
                fill: color,
                cornerRadius: 8,
                shadowColor: "black",
                shadowBlur: isSelected ? 8 : 5,
                shadowOpacity: isSelected ? 0.35 : 0.2,
                shadowOffsetY: 2,
            }));

            group.add(new Konva.Text({
                text: isTeacher ? `อาจารย์ ${desk.number}` : desk.number.toString(),
                width: currentWidth,
                height: currentHeight,
                align: "center",
                verticalAlign: "middle",
                fontSize: isTeacher ? 14 : 16,
                fontStyle: "bold",
                fill: "white",
            }));

            deskGroupMapRef.current.set(desk.id, group);

            group.on("dragstart", () => {
                const sel = selectedIdsRef.current;
                if (sel.has(desk.id) && sel.size > 1) {
                    isDraggingMultiRef.current = true;
                    dragStartPositionsRef.current.clear();
                    sel.forEach((sid) => {
                        const g = deskGroupMapRef.current.get(sid);
                        if (g) dragStartPositionsRef.current.set(sid, { x: g.x(), y: g.y() });
                    });
                } else {
                    isDraggingMultiRef.current = false;
                }
            });

            group.on("dragmove", () => {
                const sel = selectedIdsRef.current;
                const { w, h } = getDeskSize(desk, deskWidth, deskHeight, teacherDeskWidth, teacherDeskHeight);

                if (isDraggingMultiRef.current && sel.has(desk.id) && sel.size > 1) {
                    const startPos = dragStartPositionsRef.current.get(desk.id);
                    if (startPos) {
                        const leaderClamped = clampPosition(group.x(), group.y(), w, h);
                        group.position(leaderClamped);
                        const dx = leaderClamped.x - startPos.x;
                        const dy = leaderClamped.y - startPos.y;

                        sel.forEach((sid) => {
                            if (sid === desk.id) return;
                            const sGroup = deskGroupMapRef.current.get(sid);
                            const sStart = dragStartPositionsRef.current.get(sid);
                            if (sGroup && sStart) {
                                const sDesk = desksRef.current.find(d => d.id === sid);
                                if (sDesk) {
                                    const { w: sw, h: sh } = getDeskSize(sDesk, deskWidth, deskHeight, teacherDeskWidth, teacherDeskHeight);
                                    sGroup.position(clampPosition(sStart.x + dx, sStart.y + dy, sw, sh));
                                }
                            }
                        });
                    }
                    clearGuideLines();
                } else {
                    const snap = findSnapAlign(group.x(), group.y(), w, h, new Set([desk.id]));
                    const clamped = clampPosition(snap.x, snap.y, w, h);
                    group.position(clamped);
                    drawGuideLines(snap.guides);
                }
                layer.batchDraw();
            });

            group.on("dragend", () => {
                clearGuideLines();
                const sel = selectedIdsRef.current;

                if (isDraggingMultiRef.current && sel.has(desk.id) && sel.size > 1) {
                    const moves: { id: string; x: number; y: number }[] = [];
                    sel.forEach((sid) => {
                        const g = deskGroupMapRef.current.get(sid);
                        if (g) {
                            const sDesk = desksRef.current.find(d => d.id === sid);
                            if (sDesk) {
                                const { w: sw, h: sh } = getDeskSize(sDesk, deskWidth, deskHeight, teacherDeskWidth, teacherDeskHeight);
                                const c = clampPosition(snapToGrid(g.x()), snapToGrid(g.y()), sw, sh);
                                g.position(c);
                                moves.push({ id: sid, x: c.x, y: c.y });
                            }
                        }
                    });
                    isDraggingMultiRef.current = false;
                    layer.batchDraw();
                    onMultiDeskDragEndRef.current(moves);
                } else {
                    const { w: dw2, h: dh2 } = getDeskSize(desk, deskWidth, deskHeight, teacherDeskWidth, teacherDeskHeight);
                    const c = clampPosition(snapToGrid(group.x()), snapToGrid(group.y()), dw2, dh2);
                    group.position(c);
                    layer.batchDraw();
                    onDeskDragEndRef.current(desk.id, {
                        target: { x: () => c.x, y: () => c.y },
                    });
                }
            });

            group.on("click tap", (e: any) => {
                e.cancelBubble = true;
                const evt = e.evt as MouseEvent | TouchEvent;
                const isCtrl = evt instanceof MouseEvent && (evt.ctrlKey || evt.metaKey);

                if (isCtrl) {
                    const ns = new Set(selectedIdsRef.current);
                    if (ns.has(desk.id)) ns.delete(desk.id); else ns.add(desk.id);
                    onSelectionChangeRef.current(ns);
                } else if (selectedIdsRef.current.size <= 1) {
                    onDeskClickRef.current(desk);
                } else {
                    onSelectionChangeRef.current(new Set([desk.id]));
                }
            });

            group.on("mouseenter", () => { if (containerRef.current) containerRef.current.style.cursor = "grab"; });
            group.on("mouseleave", () => { if (containerRef.current) containerRef.current.style.cursor = "default"; });

            layer.add(group);
        });

        layer.batchDraw();
    }, [konvaReady, desks, zones, canvasWidth, canvasHeight, gridSize, deskWidth, deskHeight, teacherDeskWidth, teacherDeskHeight, selectedDeskIds, snapToGrid, clampPosition, findSnapAlign, drawGuideLines, clearGuideLines]);

    return (
        <div
            ref={containerRef}
            style={{ width, height, overflow: "hidden" }}
            className="bg-content1"
        />
    );
}
