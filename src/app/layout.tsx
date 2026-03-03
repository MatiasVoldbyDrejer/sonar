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
      </body>
    </html>
  );
}
