"use client";

/**
 * Global SWR defaults.
 *
 * Before this, nothing on the client cached API responses: every navigation
 * refetched the same course, roster and classroom data from scratch, so moving
 * between tabs of the same course meant sitting through a spinner for data the
 * browser had just been given. SWR keeps a module-level cache that survives
 * unmounts, so a revisit renders instantly from cache and revalidates behind
 * the scenes.
 *
 * The settings below are deliberately conservative — this layer is only used
 * for slow-changing reference data (courses, classrooms, rosters). Live data
 * (queue state, attendance check-ins, PIN rotation) keeps using
 * lib/realtime/useRealtimeResource, which is driven by WebSocket events and
 * must not be served from a stale cache.
 */

import { SWRConfig } from "swr";
import type { ReactNode } from "react";

export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        // Identical requests fired within this window share one response.
        // Covers the common case of several components on a page each asking
        // for the same course.
        dedupingInterval: 30_000,

        // Refocus revalidation stays on — an instructor coming back to the tab
        // should not act on a stale roster — but throttled so alt-tabbing
        // repeatedly does not translate into a burst of requests.
        revalidateOnFocus: true,
        focusThrottleInterval: 60_000,

        // Reconnect revalidation matters on campus wifi, where handovers are
        // frequent.
        revalidateOnReconnect: true,

        // No polling by default. Anything needing live updates should be on the
        // realtime layer instead, not on an interval here.
        refreshInterval: 0,

        // apiService already retries 429s and refreshes on 401. Retrying again
        // here would multiply the request count against an API that is already
        // signalling it is under pressure.
        shouldRetryOnError: false,

        // Show cached data immediately while revalidating rather than dropping
        // back to a loading state — this is the part the user actually feels.
        keepPreviousData: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}
