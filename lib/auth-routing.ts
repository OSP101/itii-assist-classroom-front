export type AppRole = "admin" | "instructor" | "ta" | "student";

export function getDefaultRouteForRole(role?: AppRole | null): string {
  switch (role) {
    case "admin":
      return "/admin/dashboard";
    case "instructor":
    case "ta":
      return "/home";
    case "student":
      return "/student";
    default:
      return "/login";
  }
}

export function isStudentRole(role?: string | null): role is "student" {
  return role === "student";
}