export function SkeletonShimmer({
  style,
}: {
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="shimmer"
      style={{
        borderRadius: "var(--radius-md)",
        background: "var(--muted)",
        ...style,
      }}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <SkeletonShimmer style={{ height: 48, width: 256 }} />
        <SkeletonShimmer style={{ height: 20, width: 160 }} />
        <SkeletonShimmer style={{ height: 16, width: 224 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonShimmer key={i} style={{ height: 48, width: "100%" }} />
        ))}
      </div>
    </div>
  );
}

export function PulseSkeleton() {
  return (
    <div
      style={{
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border)",
        background: "var(--card)",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <SkeletonShimmer style={{ height: 16, width: "75%" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SkeletonShimmer
          style={{ height: 80, width: "100%", borderRadius: "var(--radius-lg)" }}
        />
        <SkeletonShimmer
          style={{ height: 80, width: "100%", borderRadius: "var(--radius-lg)" }}
        />
      </div>
    </div>
  );
}

export function InstrumentSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <SkeletonShimmer style={{ height: 16, width: 80 }} />
        <SkeletonShimmer style={{ height: 32, width: 288 }} />
        <SkeletonShimmer style={{ height: 16, width: 192 }} />
      </div>
      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(2, 1fr)",
        }}
      >
        <SkeletonShimmer style={{ height: 192 }} />
        <SkeletonShimmer style={{ height: 192 }} />
      </div>
      <SkeletonShimmer style={{ height: 400 }} />
    </div>
  );
}
