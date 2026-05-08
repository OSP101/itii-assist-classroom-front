// Assignment Type Configuration
export interface AssignmentTypeInfo {
    label: string;
    color: string;
    icon: string;
    bgColor: string;
    textColor: string;
}

export const getTypeInfo = (type: string): AssignmentTypeInfo => {
    switch (type) {
        case "individual":
            return { 
                label: "Laboratory", 
                color: "bg-indigo-100 text-indigo-700", 
                icon: "solar:monitor-bold",
                bgColor: "bg-indigo-100",
                textColor: "text-indigo-600"
            };
        case "assignment":
            return { 
                label: "Assignment", 
                color: "bg-amber-100 text-amber-700", 
                icon: "solar:document-text-bold",
                bgColor: "bg-amber-100",
                textColor: "text-amber-600"
            };
        case "permanent_group":
            return { 
                label: "กลุ่มโปรเจกต์", 
                color: "bg-purple-100 text-purple-700", 
                icon: "solar:users-group-two-rounded-bold",
                bgColor: "bg-purple-100",
                textColor: "text-purple-600"
            };
        case "weekly_group":
            return { 
                label: "กลุ่มสัปดาห์", 
                color: "bg-emerald-100 text-emerald-700", 
                icon: "solar:users-group-rounded-bold",
                bgColor: "bg-emerald-100",
                textColor: "text-emerald-600"
            };
        default:
            return { 
                label: "งาน", 
                color: "bg-slate-100 text-slate-700", 
                icon: "solar:clipboard-list-bold",
                bgColor: "bg-slate-100",
                textColor: "text-slate-600"
            };
    }
};

export const getTypeBgColor = (type: string): string => {
    switch (type) {
        case "individual": return "bg-indigo-100";
        case "assignment": return "bg-amber-100";
        case "permanent_group": return "bg-purple-100";
        case "weekly_group": return "bg-emerald-100";
        default: return "bg-slate-100";
    }
};

export const getTypeTextColor = (type: string): string => {
    switch (type) {
        case "individual": return "text-indigo-600";
        case "assignment": return "text-amber-600";
        case "permanent_group": return "text-purple-600";
        case "weekly_group": return "text-emerald-600";
        default: return "text-slate-600";
    }
};

// Tab types
export type AssignmentTabType = "lab" | "assignment" | "group";
export type ViewMode = "grid" | "list";

// Placeholder for ASSIGNMENT_TYPE_CONFIG (kept for backward compatibility)
export const ASSIGNMENT_TYPE_CONFIG = {
    individual: getTypeInfo("individual"),
    assignment: getTypeInfo("assignment"),
    permanent_group: getTypeInfo("permanent_group"),
    weekly_group: getTypeInfo("weekly_group"),
};
