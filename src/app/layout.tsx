import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "RepoShare — Securely Share Private Repositories",
  description:
    "Self-hosted platform to create shareable proxy URLs for your private GitHub repositories. Share code without exposing credentials.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
    apple: ["/icon.svg"],
  },
  keywords: [
    "git",
    "github",
    "private repository",
    "share",
    "proxy",
    "self-hosted",
    "open source",
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
