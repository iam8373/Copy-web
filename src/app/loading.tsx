import { SkeletonBlock, SkeletonGrid, SkeletonRegion } from "@/components/Skeleton";

/** Home: featured panel plus rows of cards. */
export default function Loading() {
  return (
    <SkeletonRegion>
      <div className="flex flex-col gap-8">
        <SkeletonBlock className="h-56 rounded-xl" />
        <SkeletonGrid count={4} />
        <SkeletonGrid count={4} />
      </div>
    </SkeletonRegion>
  );
}
