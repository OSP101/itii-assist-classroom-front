"use client";

// The tab UI lives in ./classroom-detail-page so that this route file exports
// nothing but the default component.
//
// It used to be defined here and re-exported as `ClassroomDetailPage` for the
// 14 sibling tab routes to import. Next.js only permits a fixed set of exports
// from a page file, and any extra one fails the generated type check with
// "does not satisfy the constraint '{ [x: string]: never; }'". Turbopack never
// surfaced it; `next build --webpack` does.
import { ClassroomDetailPage } from "./classroom-detail-page";

export default function ClassroomDetailDefaultPage() {
    return <ClassroomDetailPage initialTab="overview" />;
}
