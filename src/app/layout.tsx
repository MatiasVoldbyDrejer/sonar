import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/sidebar";
import { PositionLookupProvider } from "@/hooks/use-position-lookup";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sonar — Personal Investment Analyst",
  description: "Track your portfolio with AI-powered market intelligence",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable}`}
        style={{
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          background: "var(--background)",
          color: "var(--foreground)",
        }}
      >
        <div style={{ display: "flex", height: "100vh" }}>
          <Sidebar />
          <PositionLookupProvider>
            <main style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
              {children}
            </main>
          </PositionLookupProvider>
        </div>
        <Toaster />
        {/* Global SVG filter for monochrome logo rendering */}
        <svg
          style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
          aria-hidden="true"
        >
          <defs>
            <filter id="mono" colorInterpolationFilters="sRGB">
              <feColorMatrix
                type="matrix"
                values="
                  0.2126 0.7152 0.0722 0 0
                  0.2126 0.7152 0.0722 0 0
                  0.2126 0.7152 0.0722 0 0
                  0      0      0      1 0
                "
              />
              <feComponentTransfer>
                <feFuncR type="linear" slope="0.65" intercept="0.15" />
                <feFuncG type="linear" slope="0.65" intercept="0.15" />
                <feFuncB type="linear" slope="0.65" intercept="0.15" />
              </feComponentTransfer>
            </filter>
          </defs>
        </svg>
      </body>
    </html>
  );
}
