"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  PieChart,
  Clock,
  CalendarClock,
  SquarePen,
  ListTree,
  Settings,
  type LucideIcon,
} from "lucide-react";

/* ── Nav config ─────────────────────────────────────────── */

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const navGroups: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Investing",
    items: [
      { href: "/", label: "Dashboard", icon: BarChart3 },
      { href: "/deepdive", label: "Deepdive", icon: PieChart },
    ],
  },
  {
    heading: "Analyze",
    items: [
      { href: "/chat", label: "New Thread", icon: SquarePen },
      { href: "/history", label: "History", icon: Clock },
      { href: "/tasks", label: "Tasks", icon: CalendarClock },
    ],
  },
  {
    heading: "Account",
    items: [
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/traces", label: "Traces", icon: ListTree },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/chat") return false;
  return pathname.startsWith(href);
}

/* ── Shared styles ──────────────────────────────────────── */

const pillStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  borderRadius: "var(--radius-md)",
  background: "var(--background-subtle-color)",
};

const PAD = 12;

const linkStyle: React.CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  gap: PAD,
  borderRadius: "var(--radius-md)",
  padding: `6px ${PAD}px`,
  fontSize: 14,
  fontWeight: 500,
  color: "var(--foreground)",
  textDecoration: "none",
  marginBottom: 2,
};

const headingStyle: React.CSSProperties = {
  padding: `0 ${PAD}px`,
  marginBottom: 4,
  fontSize: 12,
  fontWeight: 500,
  color: "var(--foreground-quiet-color)",
};

/* ── Component ──────────────────────────────────────────── */

function NavLink({
  item,
  active,
  hovered,
  onHover,
}: {
  item: NavItem;
  active: boolean;
  hovered: boolean;
  onHover: (href: string | null) => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onMouseEnter={() => onHover(item.href)}
      onMouseLeave={() => onHover(null)}
      style={linkStyle}
    >
      {active && (
        <motion.div
          layoutId="nav-indicator"
          style={pillStyle}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1.0] }}
        />
      )}
      <AnimatePresence>
        {!active && hovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={pillStyle}
          />
        )}
      </AnimatePresence>
      <Icon style={{ position: "relative", width: 16, height: 16 }} />
      <span style={{ position: "relative" }}>{item.label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);

  return (
    <aside
      className="glass"
      style={{
        width: 200,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: `16px ${PAD / 2}px`,
        height: "100vh",
        position: "sticky",
        top: 0,
      }}
    >
      <div style={{ padding: `0 ${PAD}px`, marginBottom: "12px",}}>
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Sonar" style={{ height: 18 }} />
        </Link>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {navGroups.map((group) => (
          <div key={group.heading}>
            <div style={headingStyle}>{group.heading}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(pathname, item.href)}
                hovered={hoveredHref === item.href}
                onHover={setHoveredHref}
              />
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
