import fs from "node:fs"
import path from "node:path"
import Database from "better-sqlite3"

function resolveSqlitePath(databaseUrl) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.")
  }

  if (databaseUrl === ":memory:") {
    return databaseUrl
  }

  if (!databaseUrl.startsWith("file:")) {
    throw new Error("RepoShare requires DATABASE_URL to use sqlite file: URLs.")
  }

  const rawPath = decodeURIComponent(databaseUrl.slice("file:".length))
  if (!rawPath) {
    throw new Error("DATABASE_URL must point to a sqlite file.")
  }

  return path.isAbsolute(rawPath)
    ? rawPath
    : path.resolve(process.cwd(), rawPath)
}

const databaseUrl = process.env.DATABASE_URL || "file:./prisma/dev.db"
const databasePath = resolveSqlitePath(databaseUrl)

if (databasePath !== ":memory:") {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true })
}

const db = new Database(databasePath)
db.pragma("journal_mode = WAL")

db.exec(`
  CREATE TABLE IF NOT EXISTS "_reposhare_migrations" (
    "name" TEXT PRIMARY KEY,
    "appliedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`)

const migrationsDir = path.join(process.cwd(), "prisma", "migrations")
if (!fs.existsSync(migrationsDir)) {
  console.log(
    "No migrations directory found, skipping database initialization.",
  )
  db.close()
  process.exit(0)
}

const migrations = fs
  .readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

for (const migrationName of migrations) {
  const alreadyApplied = db
    .prepare(`SELECT 1 FROM "_reposhare_migrations" WHERE "name" = ?`)
    .get(migrationName)

  if (alreadyApplied) {
    continue
  }

  const migrationPath = path.join(migrationsDir, migrationName, "migration.sql")
  if (!fs.existsSync(migrationPath)) {
    continue
  }

  const sql = fs.readFileSync(migrationPath, "utf8")

  const applyMigration = db.transaction(() => {
    db.exec(sql)
    db.prepare(`INSERT INTO "_reposhare_migrations" ("name") VALUES (?)`).run(
      migrationName,
    )
  })

  applyMigration()
  console.log(`Applied migration: ${migrationName}`)
}

db.close()
