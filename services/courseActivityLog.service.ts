/**
 * Course Activity Log Service
 * API calls for course activity logs and TA statistics
 */

import api from './api.service';

// ============================================
// Types
// ============================================

export interface ActivityLogActor {
  id: number;
  full_name: string;
  email?: string;
  role: string;
  avatar?: string | null;
}

/**
 * The two kinds of row stored in the activity log: things that changed the
 * course, and the read audit recording who opened what.
 */
export type ActivityEventType = "" | "changes" | "access";

/** The category the backend uses for read-audit rows. */
export const ACCESS_CATEGORY = "access";

/**
 * One field's value before and after an update, written into `detail.changes`
 * by the backend's diff. Either side is null when the field had no value.
 */
export interface FieldChange {
  from: unknown;
  to: unknown;
}

/** A detail value the backend resolved from a raw foreign key into a name. */
export interface ResolvedRef {
  /** Entity kind: student, user, section, assignment, sub_item, group, classroom, exam_setting, attendance_session, queue_session */
  type: string;
  id: string;
  label: string;
  /** Secondary line: student code, email, building, exam component, ... */
  sub?: string;
}

export interface ActivityLog {
  id: number;
  course_id: string;
  actor_user_id: number;
  actor_email?: string;
  actor_role?: string;
  action: string;
  category: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  detail: Record<string, unknown> | null;
  /**
   * Detail keys whose IDs were resolved to entities. Same keys as `detail`.
   * The `changes` key resolves to `{field: {from?: ResolvedRef, to?: ResolvedRef}}`.
   */
  resolved?: Record<string, ResolvedRef | ResolvedRef[] | Record<string, { from?: ResolvedRef; to?: ResolvedRef }>> | null;
  /** The log target resolved to an entity, when the target type is lookupable. */
  target_ref?: ResolvedRef | null;
  ip_address?: string;
  user_agent?: string;
  device_type?: string;
  browser?: string;
  os?: string;
  created_at: string;
  actor?: ActivityLogActor;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ActivityLogFilters {
  categories: string[];
  actions: { action: string; category: string }[];
  actors: { id: number; fullName: string; role: string; avatar?: string | null }[];
}

export interface ActivityLogStats {
  total: number;
  period: number;
  categoryStats: { category: string; count: number }[];
  actionStats: { action: string; count: number }[];
  actorStats: { userId: number; fullName: string; role: string; avatar?: string | null; count: number }[];
  timeline: { date: string; count: number }[];
}

export interface ScoreDistribution {
  range: string;
  count: number;
}

export interface TAPerAssignment {
  assignmentId: number;
  assignmentName: string;
  maxScore: number;
  totalGraded: number;
  mainScores: number;
  subItemScoresCount: number;
  avgScore: number | null;
  minScore: number | null;
  maxScore_given: number | null;
  scoreDistribution: ScoreDistribution[];
}

export interface TAQueueStats {
  totalCompleted: number;
  avgScore: number | null;
  minScore: number | null;
  maxScore: number | null;
}

// ---- Performance Score Extensions (all optional for backward compat) ----

/** A single KPI dimension with its score, weight, and display info */
export interface KPIItem {
  /** Normalized score 0–100 for this dimension */
  score: number;
  /** Relative weight in the final composite (0.0–1.0) */
  weight: number;
  /** Human-readable Thai label for dashboard display */
  label: string;
  /** Brief explanation of how this score was calculated */
  description?: string;
}

/** Full breakdown of all 6 KPI dimensions */
export interface KPIBreakdown {
  workload: KPIItem;
  coverage: KPIItem;
  consistency: KPIItem;
  spread: KPIItem;
  queue: KPIItem;
  anomaly: KPIItem;
}

/** Confidence metadata explaining how reliable the score is */
export interface ConfidenceInfo {
  /** Categorical level: high (≥20 scores), medium (10–19), low (<10) */
  level: 'high' | 'medium' | 'low';
  /** The exact sample size the score was computed from */
  sampleSize: number;
  /** Minimum recommended sample size for high confidence */
  minRecommended: number;
}

/** A single anomaly/warning flag for instructor attention */
export interface AnomalyFlag {
  /** Machine-readable kind for filtering/grouping */
  kind: 'score_deviation' | 'score_clustering' | 'low_coverage' | 'low_volume';
  /** Severity for badge color logic */
  severity: 'warning' | 'danger';
  /** Human-readable Thai message */
  message: string;
  /** Optional: which assignment triggered this flag */
  assignmentId?: number;
  assignmentName?: string;
}

export interface TAStat {
  // ---- Existing fields (always present) ----
  userId: number;
  fullName: string;
  email: string;
  avatar: string | null;
  totalScoresGraded: number;
  assignmentsGraded: number;
  perAssignment: TAPerAssignment[];
  queueStats: TAQueueStats | null;

  // ---- New optional fields (backward-compatible) ----
  /** Composite performance score 0–100,  Σ(weight_i × KPI_i) */
  performanceScore?: number;
  /** Categorical confidence level (shorthand for quick badge rendering) */
  confidenceLevel?: 'high' | 'medium' | 'low';
  /** Rich confidence metadata with sample size details */
  confidence?: ConfidenceInfo;
  /** Per-KPI breakdown for the explainability dashboard */
  kpiBreakdown?: KPIBreakdown;
  /** Anomaly/warning flags detected for this TA */
  anomalies?: AnomalyFlag[];
}

export interface AssignmentOverview {
  assignmentId: number;
  assignmentName: string;
  maxScore: number;
  totalGraded: number;
  avgScore: number | null;
}

export interface TAStatsData {
  taStats: TAStat[];
  assignments: AssignmentOverview[];
  summary: {
    totalTAs: number;
    totalAssignments: number;
    totalScoresGraded: number;
  };
}

export interface TADetailScore {
  id: number;
  assignment_id: number;
  student_id: number;
  sub_item_id: number | null;
  score: string;
  graded_at: string;
  comment: string | null;
  assignment?: {
    id: number;
    name: string;
    max_score: number;
  };
  subItem?: {
    id: number;
    name: string;
    max_score: number;
  };
  student?: {
    id: number;
    student_id: string;
    full_name: string;
  };
}

export interface TADetailData {
  user: { id: number; full_name: string; email: string };
  scores: TADetailScore[];
  timeline: { date: string; count: number; avg_score: number }[];
  pagination: Pagination;
}

// ============================================
// API Functions
// ============================================

/**
 * Export all activity logs for a course (up to 10 000 rows, no pagination cap)
 */
export const exportActivityLogs = async (
  courseId: string,
  params: {
    /** '' = both kinds, 'changes' = mutations only, 'access' = read audit only */
    eventType?: ActivityEventType;
    category?: string;
    action?: string;
    actorId?: string;
    actorRole?: string;
    /** Entity kind to narrow to, e.g. "student" (a ResolvedRef.type). */
    subjectType?: string;
    /** That entity's id. Both must be set for the filter to apply. */
    subjectId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  } = {},
): Promise<ActivityLog[]> => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const qs = query.toString();
  const response = await api.get(`/courses/${courseId}/activity-logs/export${qs ? `?${qs}` : ''}`);
  const data = response.data as { logs: ActivityLog[]; total: number };
  return data.logs;
};

/**
 * Get activity logs for a course
 */
export const getActivityLogs = async (
  courseId: string,
  params: {
    page?: number;
    limit?: number;
    /** '' = both kinds, 'changes' = mutations only, 'access' = read audit only */
    eventType?: ActivityEventType;
    category?: string;
    action?: string;
    actorId?: string;
    actorRole?: string;
    /** Entity kind to narrow to, e.g. "student" (a ResolvedRef.type). */
    subjectType?: string;
    /** That entity's id. Both must be set for the filter to apply. */
    subjectId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  } = {},
): Promise<{ logs: ActivityLog[]; pagination: Pagination }> => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const qs = query.toString();
  const response = await api.get(`/courses/${courseId}/activity-logs${qs ? `?${qs}` : ''}`);
  return response.data as { logs: ActivityLog[]; pagination: Pagination };
};

/**
 * Get activity log statistics
 */
export const getActivityStats = async (
  courseId: string,
  days: number = 30,
): Promise<ActivityLogStats> => {
  const response = await api.get(`/courses/${courseId}/activity-logs/stats?days=${days}`);
  return response.data as ActivityLogStats;
};

/**
 * Get available filter options
 */
export const getActivityFilters = async (
  courseId: string,
): Promise<ActivityLogFilters> => {
  const response = await api.get(`/courses/${courseId}/activity-logs/filters`);
  return response.data as ActivityLogFilters;
};

/**
 * Get TA statistics overview
 */
export const getTAStats = async (courseId: string): Promise<TAStatsData> => {
  const response = await api.get(`/courses/${courseId}/activity-logs/ta-stats`);
  return response.data as TAStatsData;
};

/**
 * Get TA detailed grading history
 */
export const getTADetail = async (
  courseId: string,
  userId: number,
  params: {
    assignmentId?: number;
    page?: number;
    limit?: number;
  } = {},
): Promise<TADetailData> => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && String(value) !== '') query.set(key, String(value));
  });
  const qs = query.toString();
  const response = await api.get(`/courses/${courseId}/activity-logs/ta-stats/${userId}${qs ? `?${qs}` : ''}`);
  return response.data as TADetailData;
};

export default {
  getActivityLogs,
  exportActivityLogs,
  getActivityStats,
  getActivityFilters,
  getTAStats,
  getTADetail,
};
