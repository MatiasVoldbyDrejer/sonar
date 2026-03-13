"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { BarChart3, PieChart, Clock, CalendarClock, SquarePen, User, Settings } from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/deepdive", label: "Deepdive", icon: PieChart },
  { href: "/history", label: "History", icon: Clock },
  { href: "/tasks", label: "Tasks", icon: CalendarClock },
  { href: "/chat", label: "New Thread", icon: SquarePen },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/chat") return false;
  return pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="glass"
      style={{
        width: 224,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
      }}
    >
      <div style={{ padding: "12px 20px", marginTop: 8 }}>
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Sonar" style={{ height: 14 }} />
        </Link>
      </div>

      <nav style={{ padding: "0 8px" }}>
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 8,
                borderRadius: "var(--radius-md)",
                padding: "6px 12px",
                fontSize: 14,
                fontWeight: 500,
                color: active
                  ? "var(--foreground)"
                  : "var(--muted-foreground)",
                transition: "color 150ms",
                textDecoration: "none",
                marginBottom: 2,
              }}
              {...(!active ? { "data-hover": "nav-link" } : {})}
            >
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "var(--radius-md)",
                    background: "rgba(255, 255, 255, 0.06)",
                  }}
                  transition={{
                    duration: 0.2,
                    ease: [0.25, 0.1, 0.25, 1.0],
                  }}
                />
              )}
              <Icon style={{ position: "relative", width: 16, height: 16 }} />
              <span style={{ position: "relative" }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
