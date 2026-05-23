import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
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
  title: "Court Notice Gateway",
  description:
    "Ingest PACER / CM-ECF notices, validate authenticity, classify, extract operative facts, and route to case timelines and tasks.",
};

const nav = [
  { href: "/", label: "Inbox" },
  { href: "/review", label: "Review Queue" },
  { href: "/cases", label: "Cases" },
  { href: "/metrics", label: "Metrics" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <div className="flex min-h-screen">
          <aside className="w-56 shrink-0 border-r bg-muted/30 px-4 py-6 flex flex-col gap-1">
            <div className="px-2 pb-6">
              <div className="font-semibold tracking-tight">
                Court Notice Gateway
              </div>
              <div className="text-xs text-muted-foreground">
                PACER / CM-ECF ingest
              </div>
            </div>
            <nav className="flex flex-col gap-1">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-2 py-1.5 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto px-2 pt-6 text-xs text-muted-foreground">
              <div>Glade FDE application build</div>
              <div className="font-mono">v0.1.0</div>
            </div>
          </aside>
          <main className="flex-1 flex flex-col">{children}</main>
        </div>
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
