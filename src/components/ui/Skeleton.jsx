export function SkeletonBlock({ className = "" }) {
  return <div className={`animate-pulse rounded-2xl bg-slate-200/80 ${className}`} />;
}

export function PageSkeleton({ cards = 4 }) {
  return (
    <div className="space-y-6">
      <SkeletonBlock className="h-40 w-full rounded-[2rem]" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: cards }, (_, index) => (
          <SkeletonBlock key={index} className="h-36 w-full" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <SkeletonBlock className="h-80 w-full" />
        <SkeletonBlock className="h-80 w-full" />
      </div>
    </div>
  );
}
