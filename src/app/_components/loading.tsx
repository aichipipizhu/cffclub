function SkeletonLine({ width = "100%" }: { width?: string }) {
  return <span className="skeleton-line" style={{ width }} />;
}

function SkeletonCard() {
  return (
    <div className="panel skeleton-card" aria-hidden="true">
      <SkeletonLine width="38%" />
      <SkeletonLine />
      <SkeletonLine width="72%" />
      <div className="skeleton-grid">
        <SkeletonLine />
        <SkeletonLine />
        <SkeletonLine />
      </div>
    </div>
  );
}

export function MobileSkeleton() {
  return (
    <main className="app-shell mobile-shell">
      <div className="page mobile-page grid" aria-label="加载中">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </main>
  );
}

export function AdminSkeleton() {
  return (
    <main className="app-shell admin-shell">
      <div className="page admin-page grid" aria-label="加载中">
        <section className="stats">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </section>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </main>
  );
}
