/**
 * useApiCache - Custom hook สำหรับ client-side caching
 * 
 * ช่วยป้องกัน:
 * - Duplicate API calls
 * - Excessive re-fetching
 * - Memory leaks
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    error?: Error;
}

interface CacheConfig {
    /** TTL in milliseconds (default: 60000 = 1 minute) */
    ttl?: number;
    /** Stale-while-revalidate time in ms (default: 30000) */
    staleTime?: number;
    /** Max cache entries (default: 100) */
    maxEntries?: number;
}

// Global cache store (shared across hook instances)
const globalCache = new Map<string, CacheEntry<unknown>>();
const pendingRequests = new Map<string, Promise<unknown>>();

// LRU tracking for cache eviction
const accessOrder: string[] = [];

const DEFAULT_CONFIG: Required<CacheConfig> = {
    ttl: 60000,        // 1 minute
    staleTime: 30000,  // 30 seconds
    maxEntries: 100,
};

/**
 * ตรวจสอบว่า cache ยัง fresh อยู่หรือไม่
 */
function isFresh<T>(entry: CacheEntry<T> | undefined, ttl: number): boolean {
    if (!entry) return false;
    return Date.now() - entry.timestamp < ttl;
}

/**
 * ตรวจสอบว่า cache ยังใช้แบบ stale ได้หรือไม่
 */
function isStale<T>(entry: CacheEntry<T> | undefined, staleTime: number): boolean {
    if (!entry) return false;
    return Date.now() - entry.timestamp < staleTime;
}

/**
 * อัพเดท LRU access order
 */
function updateAccessOrder(key: string) {
    const idx = accessOrder.indexOf(key);
    if (idx > -1) {
        accessOrder.splice(idx, 1);
    }
    accessOrder.push(key);
}

/**
 * ลบ cache entries เก่าถ้าเกิน limit
 */
function evictOldEntries(maxEntries: number) {
    while (globalCache.size > maxEntries && accessOrder.length > 0) {
        const oldestKey = accessOrder.shift();
        if (oldestKey) {
            globalCache.delete(oldestKey);
        }
    }
}

/**
 * Hook สำหรับ fetch data พร้อม caching
 */
export function useApiCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    config: CacheConfig = {}
) {
    const { ttl, staleTime, maxEntries } = { ...DEFAULT_CONFIG, ...config };
    
    const [data, setData] = useState<T | undefined>(() => {
        const cached = globalCache.get(key) as CacheEntry<T> | undefined;
        return cached?.data;
    });
    const [error, setError] = useState<Error | undefined>();
    const [isLoading, setIsLoading] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    
    const mountedRef = useRef(true);

    const fetchData = useCallback(async (forceRefresh = false) => {
        const cached = globalCache.get(key) as CacheEntry<T> | undefined;
        
        // ถ้าข้อมูล fresh และไม่ได้ force refresh ให้ใช้ cache
        if (!forceRefresh && cached && isFresh(cached, ttl)) {
            updateAccessOrder(key);
            setData(cached.data);
            return cached.data;
        }
        
        // ป้องกัน duplicate requests (request deduplication)
        const pending = pendingRequests.get(key);
        if (pending) {
            return pending as Promise<T>;
        }
        
        // แสดง stale data ระหว่างรอ revalidate
        if (cached && isStale(cached, staleTime)) {
            setData(cached.data);
            setIsValidating(true);
        } else {
            setIsLoading(true);
        }
        
        const request = (async () => {
            try {
                const result = await fetcher();
                
                // บันทึกลง cache
                const entry: CacheEntry<T> = {
                    data: result,
                    timestamp: Date.now(),
                };
                globalCache.set(key, entry);
                updateAccessOrder(key);
                evictOldEntries(maxEntries);
                
                if (mountedRef.current) {
                    setData(result);
                    setError(undefined);
                }
                
                return result;
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                if (mountedRef.current) {
                    setError(error);
                }
                throw error;
            } finally {
                pendingRequests.delete(key);
                if (mountedRef.current) {
                    setIsLoading(false);
                    setIsValidating(false);
                }
            }
        })();
        
        pendingRequests.set(key, request);
        return request;
    }, [key, fetcher, ttl, staleTime, maxEntries]);

    // ดึงข้อมูลครั้งแรกเมื่อ mount
    useEffect(() => {
        mountedRef.current = true;
        fetchData();
        
        return () => {
            mountedRef.current = false;
        };
    }, [fetchData]);

    const mutate = useCallback((newData?: T) => {
        if (newData !== undefined) {
            const entry: CacheEntry<T> = {
                data: newData,
                timestamp: Date.now(),
            };
            globalCache.set(key, entry);
            setData(newData);
        } else {
            // Revalidate
            fetchData(true);
        }
    }, [key, fetchData]);

    return {
        data,
        error,
        isLoading,
        isValidating,
        mutate,
        refetch: () => fetchData(true),
    };
}

/**
 * Utility: ล้าง cache ทั้งหมดหรือบางส่วน
 */
export function clearCache(pattern?: string | RegExp) {
    if (!pattern) {
        globalCache.clear();
        accessOrder.length = 0;
        return;
    }
    
    const keysToDelete: string[] = [];
    globalCache.forEach((_, key) => {
        if (typeof pattern === 'string') {
            if (key.includes(pattern)) {
                keysToDelete.push(key);
            }
        } else if (pattern.test(key)) {
            keysToDelete.push(key);
        }
    });
    
    keysToDelete.forEach(key => {
        globalCache.delete(key);
        const idx = accessOrder.indexOf(key);
        if (idx > -1) {
            accessOrder.splice(idx, 1);
        }
    });
}

/**
 * Utility: Prefetch data ไว้ล่วงหน้า
 */
export async function prefetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl = DEFAULT_CONFIG.ttl
) {
    const cached = globalCache.get(key);
    if (cached && isFresh(cached, ttl)) {
        return cached.data as T;
    }
    
    const result = await fetcher();
    globalCache.set(key, {
        data: result,
        timestamp: Date.now(),
    });
    updateAccessOrder(key);
    
    return result;
}

export default useApiCache;
