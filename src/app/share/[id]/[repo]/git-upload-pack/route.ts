import type { NextRequest } from "next/server"
import { resolveGitUploadPackResponse } from "@/app/share/[id]/git-upload-pack/route"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; repo: string }> },
) {
  const { id } = await params
  return resolveGitUploadPackResponse(req, id.replace(/\.git$/, ""))
}
