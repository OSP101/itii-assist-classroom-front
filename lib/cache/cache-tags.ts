/**
 * Cache tag definitions — domain-based.
 *
 * Use these tags when:
 * 1. Calling `cacheTag(...)` inside a `"use cache"` function
 * 2. Calling `revalidateTag(...)` after a mutation (in server actions)
 *
 * Convention: `domain:id:resource`
 * Invalidating a parent tag (e.g., `course:{id}:overview`) only revalidates
 * that specific resource, not the entire course tree — be explicit.
 */

// ---------------------------------------------------------------------------
// Global
// ---------------------------------------------------------------------------
export const cacheTags = {
  // Current authenticated user
  me: (): string => "global:me",
  // User profile details
  profile: (): string => "global:profile",
  // Instructor's course list
  myCourses: (): string => "global:my-courses",
  // Notification unread counts
  notifications: (): string => "global:notifications",

  // ---------------------------------------------------------------------------
  // Course — scoped by courseId
  // ---------------------------------------------------------------------------
  courseDetail: (courseId: string): string => `course:${courseId}:detail`,
  courseOverview: (courseId: string): string => `course:${courseId}:overview`,
  courseSections: (courseId: string): string => `course:${courseId}:sections`,
  coursePeople: (courseId: string): string => `course:${courseId}:people`,
  courseTeams: (courseId: string): string => `course:${courseId}:teams`,
  courseAssignments: (courseId: string): string => `course:${courseId}:assignments`,
  courseScores: (courseId: string): string => `course:${courseId}:scores`,
  courseScoreApprovals: (courseId: string): string => `course:${courseId}:score-approvals`,
  courseExams: (courseId: string): string => `course:${courseId}:exams`,
  courseBonus: (courseId: string): string => `course:${courseId}:bonus`,
  courseAttendance: (courseId: string): string => `course:${courseId}:attendance`,
  courseQueue: (courseId: string): string => `course:${courseId}:queue`,
  courseTa: (courseId: string): string => `course:${courseId}:ta`,
  courseActivity: (courseId: string): string => `course:${courseId}:activity`,
  courseSettings: (courseId: string): string => `course:${courseId}:settings`,
  courseAnalytics: (courseId: string): string => `course:${courseId}:analytics`,

  // ---------------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------------
  adminUsers: (): string => "admin:users",
  adminStudents: (): string => "admin:students",
  adminCourses: (): string => "admin:courses",
  adminClassrooms: (): string => "admin:classrooms",
  adminFeedback: (): string => "admin:feedback",
  adminLogs: (): string => "admin:logs",
  adminSystem: (): string => "admin:system",

  // ---------------------------------------------------------------------------
  // Public (short-lived, use with caution — never cache live state)
  // ---------------------------------------------------------------------------
  publicCheckIn: (sessionId: string): string => `public:check-in:${sessionId}`,
  publicQueueBooking: (bookingId: string): string => `public:queue-booking:${bookingId}`,
  publicQueueSession: (sessionId: string): string => `public:queue-session:${sessionId}`,
} as const;
