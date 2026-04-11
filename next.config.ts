import path from "node:path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", "bcryptjs", "better-sqlite3"],
  turbopack: {
    root: path.resolve(process.cwd()),
  },
}

export default nextConfig
