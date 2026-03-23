import path from "node:path"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function resolveSqlitePath(databaseUrl: string) {
  if (databaseUrl === ":memory:") return databaseUrl

  if (!databaseUrl.startsWith("file:")) {
    throw new Error("RepoShare requires DATABASE_URL to use the sqlite file: format.")
  }

  const rawPath = decodeURIComponent(databaseUrl.slice("file:".length))
  if (!rawPath) {
    throw new Error("RepoShare requires DATABASE_URL to point at a sqlite file.")
  }

  return path.isAbsolute(rawPath) ? rawPath : path.resolve(/* turbopackIgnore: true */ process.cwd(), rawPath)
}

function getDatabasePath() {
  const configuredUrl = process.env.DATABASE_URL || "file:./prisma/dev.db"

  try {
    return resolveSqlitePath(configuredUrl)
  } catch {
    console.warn(`Invalid DATABASE_URL "${configuredUrl}" detected. Falling back to local sqlite storage.`)
    return resolveSqlitePath("file:./prisma/dev.db")
  }
}

const adapter = new PrismaBetterSqlite3({ url: getDatabasePath() })

export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
