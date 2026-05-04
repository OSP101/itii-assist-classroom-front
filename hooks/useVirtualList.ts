/**
 * useVirtualList - Virtual scrolling สำหรับ list ที่มีข้อมูลเยอะ
 * 
 * ช่วยลด:
 * - Memory usage (render เฉพาะ items ที่เห็น)
 * - DOM nodes (ไม่ render items ที่อยู่นอก viewport)
 * - Re-render time
 * 
 * @example
 * const { virtualItems, totalHeight, containerRef } = useVirtualList({
 *   items: students,
 *   itemHeight: 60,
 *   overscan: 5,
 * });
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

interface VirtualListOptions<T> {
    /** Array ของ items ทั้งหมด */
    items: T[];
    /** ความสูงของแต่ละ item (pixels) */
    itemHeight: number;
    /** จำนวน items ที่ render เพิ่มนอก viewport (buffer) */
    overscan?: number;
    /** ความสูงของ container (auto-detect ถ้าไม่ระบุ) */
    containerHeight?: number;
}

interface VirtualItem<T> {
    /** Index ใน original array */
    index: number;
    /** Item data */
    data: T;
    /** Top position (pixels) */
    top: number;
    /** Height (pixels) */
    height: number;
}

interface VirtualListReturn<T> {
    /** Items ที่ควร render */
    virtualItems: VirtualItem<T>[];
    /** ความสูงรวมของ list ทั้งหมด */
    totalHeight: number;
    /** Ref สำหรับ container element */
    containerRef: React.RefObject<HTMLDivElement>;
    /** Scroll to specific index */
    scrollToIndex: (index: number, align?: 'start' | 'center' | 'end') => void;
    /** Force re-measure */
    measure: () => void;
}

export function useVirtualList<T>({
    items,
    itemHeight,
    overscan = 3,
    containerHeight: providedHeight,
}: VirtualListOptions<T>): VirtualListReturn<T> {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(providedHeight || 400);

    // Update container height
    const measure = useCallback(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setContainerHeight(rect.height || providedHeight || 400);
        }
    }, [providedHeight]);

    // Measure on mount and resize
    useEffect(() => {
        measure();

        if (typeof window === 'undefined') return;

        const observer = new ResizeObserver(measure);
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, [measure]);

    // Handle scroll
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            setScrollTop(container.scrollTop);
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, []);

    // Calculate visible items
    const { virtualItems, totalHeight } = useMemo(() => {
        const totalHeight = items.length * itemHeight;
        
        if (items.length === 0) {
            return { virtualItems: [], totalHeight: 0 };
        }

        // Calculate visible range
        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
        const endIndex = Math.min(
            items.length - 1,
            Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
        );

        // Create virtual items
        const virtualItems: VirtualItem<T>[] = [];
        for (let i = startIndex; i <= endIndex; i++) {
            virtualItems.push({
                index: i,
                data: items[i],
                top: i * itemHeight,
                height: itemHeight,
            });
        }

        return { virtualItems, totalHeight };
    }, [items, itemHeight, scrollTop, containerHeight, overscan]);

    // Scroll to specific index
    const scrollToIndex = useCallback((index: number, align: 'start' | 'center' | 'end' = 'start') => {
        if (!containerRef.current) return;

        const targetTop = index * itemHeight;
        let scrollTo: number;

        switch (align) {
            case 'center':
                scrollTo = targetTop - containerHeight / 2 + itemHeight / 2;
                break;
            case 'end':
                scrollTo = targetTop - containerHeight + itemHeight;
                break;
            default:
                scrollTo = targetTop;
        }

        containerRef.current.scrollTo({
            top: Math.max(0, scrollTo),
            behavior: 'smooth',
        });
    }, [itemHeight, containerHeight]);

    return {
        virtualItems,
        totalHeight,
        containerRef: containerRef as React.RefObject<HTMLDivElement>,
        scrollToIndex,
        measure,
    };
}

/**
 * useInfiniteScroll - Load more data เมื่อ scroll ใกล้ bottom
 */
interface InfiniteScrollOptions {
    /** Function ที่เรียกเมื่อต้อง load more */
    onLoadMore: () => Promise<void>;
    /** ระยะห่างจาก bottom ที่จะ trigger load (pixels) */
    threshold?: number;
    /** มีข้อมูลอีกไหม */
    hasMore: boolean;
    /** กำลัง loading อยู่ไหม */
    isLoading: boolean;
}

export function useInfiniteScroll({
    onLoadMore,
    threshold = 200,
    hasMore,
    isLoading,
}: InfiniteScrollOptions) {
    const containerRef = useRef<HTMLDivElement>(null);
    const loadingRef = useRef(false);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = async () => {
            if (loadingRef.current || isLoading || !hasMore) return;

            const { scrollTop, scrollHeight, clientHeight } = container;
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

            if (distanceFromBottom < threshold) {
                loadingRef.current = true;
                try {
                    await onLoadMore();
                } finally {
                    loadingRef.current = false;
                }
            }
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, [onLoadMore, threshold, hasMore, isLoading]);

    return { containerRef };
}

export default useVirtualList;
