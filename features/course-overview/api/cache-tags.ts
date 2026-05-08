/**
 * Course Overview — cache tags for this feature.
 * Re-exported for convenience so feature code doesn't import from lib/ directly.
 */

export {
  cacheTags as courseOverviewTags,
} from "@/lib/cache/cache-tags";

export {
  revalidateCourseDetail,
  revalidateCourseSettings,
  revalidateCourseMembers,
} from "@/lib/cache/revalidate";
