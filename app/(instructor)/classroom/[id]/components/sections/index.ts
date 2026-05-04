/**
 * SectionsTab Module
 * 
 * Exports all components, hooks, and types for the SectionsTab feature.
 * 
 * Architecture:
 * - SectionsTab: Container component (manages state via useSectionsTab hook)
 * - SectionsTabView: Presentational component (memoized for performance)
 * - useSectionsTab: Custom hook for state management and business logic
 * - config: Types, interfaces, and utility functions
 */

// Types and utilities
export * from "./config";

// Custom hook
export { useSectionsTab, type UseSectionsTabReturn } from "./useSectionsTab";

// View component (memoized)
export { SectionsTabView } from "./SectionsTabView";
