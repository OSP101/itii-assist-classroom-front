/**
 * AttendanceTab Module
 * Barrel exports for the attendance tab functionality
 */

// Export types and config
export * from "./config";

// Export the custom hook
export { useAttendanceTab, type UseAttendanceTabReturn } from "./useAttendanceTab";

// Export the view component
export { AttendanceTabView } from "./AttendanceTabView";

// Export sub-components for potential reuse
export {
    AttendanceTableSkeleton,
    StatsSkeleton,
    StatsCards,
    FiltersCard,
    EmptyState,
    SessionsTable,
    LocationCheckCard,
    CreateSessionModal,
    EditSessionModal,
    DeleteConfirmModal,
    CloseSessionModal,
} from "./components";
