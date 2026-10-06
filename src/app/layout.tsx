import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Source_Serif_4 } from "next/font/google";
import Link from "next/link";
import { getSessionEmail } from "@/lib/session";
import { isAdmin } from "@/lib/ventures";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif-var",
  display: "swap",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-sans-var", display: "swap" });
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-var",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Foundry Studio — fountainbridge",
  description: "Bruntsfield Capital's founder-facing platform for co-created ventures.",
};

const NAV = [
  { href: "/", label: "Ventures" },
  { href: "/lanes", label: "Lanes" },
  { href: "/attention", label: "Attention" },
  { href: "/activity", label: "Activity" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const email = await getSessionEmail();
  const admin = isAdmin(email);

  return (
    <html
      lang="en"
      className={`${sourceSerif.variable} ${inter.variable} ${ibmPlexMono.variable}`}
    >
      <body>
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            minHeight: "var(--topbar-height)",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            padding: "0 1.5rem",
            background: "var(--color-paper)",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <Link
            href="/"
            style={{ display: "flex", flexDirection: "column", lineHeight: 1, textDecoration: "none" }}
          >
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontWeight: 500,
                fontSize: "1.35rem",
                letterSpacing: "-0.012em",
                color: "var(--color-ink)",
              }}
            >
              Bruntsfield
            </span>
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontWeight: 500,
                fontSize: "0.62rem",
                letterSpacing: "0.42em",
                textTransform: "uppercase",
                color: "var(--color-accent)",
              }}
            >
              Foundry
            </span>
          </Link>

          <nav style={{ display: "flex", gap: "0.4rem", marginLeft: "1rem" }}>
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="pill">
                {item.label}
              </Link>
            ))}
          </nav>

          <span className="eyebrow" style={{ marginLeft: "auto" }}>
            <span className="eyebrow-id">02</span> — Foundry
          </span>

          {email ? (
            <span style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span
                className="mono"
                style={{ fontSize: "0.72rem", color: "var(--color-ink-muted)" }}
                title={admin ? "Bruntsfield admin — sees all ventures" : "founder"}
              >
                {email}
                {admin ? " ·  admin" : ""}
              </span>
              <a href="/api/auth/logout" className="btn btn-secondary" style={{ padding: "0.35rem 0.8rem" }}>
                Sign out
              </a>
            </span>
          ) : (
            <a href="/api/auth/login" className="btn btn-primary" style={{ padding: "0.35rem 0.9rem" }}>
              Sign in
            </a>
          )}
        </header>

        <main
          style={{
            maxWidth: "var(--content-max)",
            margin: "0 auto",
            padding: "3rem 1.5rem 5rem",
          }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}
