import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RepoShare — Securely Share Private Repositories",
  description: "Self-hosted platform to create shareable proxy URLs for your private GitHub repositories. Share code without exposing credentials.",
  keywords: ["git", "github", "private repository", "share", "proxy", "self-hosted", "open source"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
