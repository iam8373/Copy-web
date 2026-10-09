import { SkeletonBlock, SkeletonGrid, SkeletonRegion } from "@/components/Skeleton";

/**
 * Home: featured panel plus rows of cards. Lives in the (home) route group so
 * it does not wrap other routes: a loading boundary above a page that calls
 * notFound() makes the response stream with status 200 instead of 404.
 */
export default function Loading() {
  return (
    <SkeletonRegion>
      <div className="flex flex-col gap-8">
        <SkeletonBlock className="h-56 rounded-card" />
        <SkeletonGrid count={4} />
        <SkeletonGrid count={4} />
      </div>
    </SkeletonRegion>
  );
}
