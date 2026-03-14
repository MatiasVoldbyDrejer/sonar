import type { ReactNode } from "react";

export function PageHeader({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 16px",
        height: 54,
        boxSizing: "border-box",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>
        {title}
      </span>
      {children}
    </div>
  );
}
