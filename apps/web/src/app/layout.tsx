import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppNav } from "@/components/app-nav";

const displayFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const bodyFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "TasteTrail",
  description: "Passkey-first family food tracking with OpenClaw-friendly automation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>
        <div className="page-shell">
          <header className="site-header">
            <h1 className="site-title">TasteTrail</h1>
          </header>
          <AppNav />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
