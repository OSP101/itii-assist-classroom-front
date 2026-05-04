/**
 * useDebouncedValue - Debounce values สำหรับ search/filter
 * useDebouncedCallback - Debounce function calls
 * useThrottledCallback - Throttle function calls
 * 
 * ช่วยป้องกัน:
 * - Excessive API calls จาก search input
 * - Rapid re-renders
 * - Performance issues จาก frequent updates
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/**
 * Debounce value (delay update until user stops changing)
 * เหมาะสำหรับ: Search input, Filter
 * 
 * @example
 * const [search, setSearch] = useState('');
 * const debouncedSearch = useDebouncedValue(search, 300);
 * // API จะถูกเรียกเมื่อ debouncedSearch เปลี่ยน (หลัง 300ms ที่หยุดพิมพ์)
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}

/**
 * Debounce callback function
 * เหมาะสำหรับ: Form submit, Button clicks ที่ต้องป้องกัน double-click
 * 
 * @example
 * const handleSearch = useDebouncedCallback((query: string) => {
 *   api.search(query);
 * }, 300);
 */
export function useDebouncedCallback<T extends (...args: Parameters<T>) => ReturnType<T>>(
    callback: T,
    delay: number = 300
): T {
    const callbackRef = useRef(callback);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // อัพเดท ref เมื่อ callback เปลี่ยน
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, []);

    const debouncedCallback = useCallback(
        (...args: Parameters<T>) => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            timerRef.current = setTimeout(() => {
                callbackRef.current(...args);
            }, delay);
        },
        [delay]
    ) as T;

    return debouncedCallback;
}

/**
 * Throttle callback function
 * เหมาะสำหรับ: Scroll events, Resize events, Real-time updates
 * 
 * @example
 * const handleScroll = useThrottledCallback(() => {
 *   checkIfNearBottom();
 * }, 100);
 */
export function useThrottledCallback<T extends (...args: Parameters<T>) => ReturnType<T>>(
    callback: T,
    delay: number = 100
): T {
    const callbackRef = useRef(callback);
    const lastRanRef = useRef<number>(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, []);

    const throttledCallback = useCallback(
        (...args: Parameters<T>) => {
            const now = Date.now();
            const timeSinceLastRun = now - lastRanRef.current;

            if (timeSinceLastRun >= delay) {
                lastRanRef.current = now;
                callbackRef.current(...args);
            } else {
                // Schedule trailing call
                if (timerRef.current) {
                    clearTimeout(timerRef.current);
                }
                timerRef.current = setTimeout(() => {
                    lastRanRef.current = Date.now();
                    callbackRef.current(...args);
                }, delay - timeSinceLastRun);
            }
        },
        [delay]
    ) as T;

    return throttledCallback;
}

/**
 * ตรวจสอบว่า component ยัง mounted อยู่หรือไม่
 * ป้องกัน memory leaks จาก setState หลัง unmount
 */
export function useIsMounted(): () => boolean {
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    return useCallback(() => isMountedRef.current, []);
}

/**
 * เก็บ previous value ไว้เพื่อเปรียบเทียบ
 */
export function usePrevious<T>(value: T): T | undefined {
    const ref = useRef<T | undefined>(undefined);

    useEffect(() => {
        ref.current = value;
    }, [value]);

    return ref.current;
}

/**
 * ป้องกัน double submit สำหรับ async operations
 */
export function useAsyncLock() {
    const lockRef = useRef(false);

    const runWithLock = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
        if (lockRef.current) {
            return null; // Already running
        }

        lockRef.current = true;
        try {
            return await fn();
        } finally {
            lockRef.current = false;
        }
    }, []);

    const isLocked = useCallback(() => lockRef.current, []);

    return { runWithLock, isLocked };
}

export default useDebouncedValue;
