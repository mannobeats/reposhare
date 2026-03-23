import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json({
      ok: true,
      database: "reachable",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"

    return NextResponse.json(
      {
        ok: false,
        database: "unreachable",
        message,
      },
      { status: 503 }
    )
  }
}
