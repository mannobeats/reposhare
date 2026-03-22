import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getInstallationToken } from "@/lib/github"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rawId = (await params).id
  const id = rawId.replace(/\.git$/, "")

  const share = await prisma.share.findUnique({
    where: { id, active: true },
    include: { user: true }
  })

  if (!share || (share.expiresAt && share.expiresAt < new Date())) {
    return new NextResponse("Repository not found or link expired", { status: 404 })
  }

  if (!share.user.installationId) {
    return new NextResponse("Server configuration error", { status: 500 })
  }

  prisma.analyticEvent.create({
    data: { shareId: share.id, type: "GIT_CLONE_UPLOAD", ipHash: "anonymized_via_edge" }
  }).catch(() => {})

  const token = await getInstallationToken(share.user.installationId)
  const gitUrl = `https://github.com/${share.repoFullName}.git/git-upload-pack`

  // Forward the binary payload pack request from the Git client directly to GitHub
  const gitResponse = await fetch(gitUrl, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`,
      "Content-Type": req.headers.get("content-type") || "application/x-git-upload-pack-request",
      "Accept": req.headers.get("accept") || "application/x-git-upload-pack-result",
      "User-Agent": "RepoShare Proxy",
    },
    body: req.body, // Standard streaming forwarding
    // @ts-ignore - Required for native Node fetch body streaming 
    duplex: "half"
  })

  return new NextResponse(gitResponse.body, {
    status: gitResponse.status,
    headers: {
      "Content-Type": gitResponse.headers.get("content-type") || "application/x-git-upload-pack-result",
      "Cache-Control": "no-cache",
    }
  })
}
