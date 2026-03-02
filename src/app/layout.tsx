import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/header";
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background`}
      >
        <Header />
        <PositionLookupProvider>
          <main className="container mx-auto px-4 py-6 max-w-7xl">
            {children}
          </main>
        </PositionLookupProvider>
        <Toaster />
      </body>
    </html>
  );
}
