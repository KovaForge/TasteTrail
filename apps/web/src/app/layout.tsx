import type { Metadata } from "next";
import "./globals.css";
import { AppNav } from "@/components/app-nav";

export const metadata: Metadata = {
  title: "TasteTrail",
  description: "Passkey-first family food tracking with OpenClaw-friendly automation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="page-shell">
          <header className="site-header">
            <div>
              <p className="eyebrow">TasteTrail</p>
              <h1 className="site-title">Vercel + Neon rearchitecture</h1>
            </div>
            <div className="header-meta">
              <span>Passkey-first family food tracking</span>
            </div>
          </header>
          <AppNav />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
