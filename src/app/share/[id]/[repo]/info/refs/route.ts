import { NextRequest } from "next/server"
import { resolveInfoRefsResponse } from "@/app/share/[id]/info/refs/route"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; repo: string }> }) {
  const { id } = await params
  return resolveInfoRefsResponse(req, id.replace(/\.git$/, ""))
}
