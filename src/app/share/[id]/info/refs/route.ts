import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getInstallationToken } from "@/lib/github"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const url = new URL(req.url)
  const service = url.searchParams.get("service")
  if (!service) return NextResponse.json({ error: "No git service requested" }, { status: 400 })

  const rawId = (await params).id
  const id = rawId.replace(/\.git$/, "")

  const share = await prisma.share.findUnique({
    where: { id, active: true },
    include: { user: true }
  })

  // Expiration check
  if (!share || (share.expiresAt && share.expiresAt < new Date())) {
    return new NextResponse("Repository not found or link expired", { status: 404 })
  }

  // Auth checking for password protections can be implemented via Git Basic Auth headers here if needed.

  if (!share.user.installationId) {
    return new NextResponse("Server configuration error", { status: 500 })
  }

  // Log hit to analytics asynchronously
  prisma.analyticEvent.create({
    data: {
      shareId: share.id,
      type: "GIT_CLONE_REFS",
      ipHash: "anonymized_via_edge", 
    }
  }).catch(() => {})

  const token = await getInstallationToken(share.user.installationId)
  const gitUrl = `https://github.com/${share.repoFullName}.git/info/refs?service=${service}`

  // Proxy the request securely to GitHub
  const gitResponse = await fetch(gitUrl, {
    headers: {
      "Authorization": `Basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`,
      "User-Agent": "RepoShare Proxy",
      "Git-Protocol": req.headers.get("git-protocol") || "version=2"
    }
  })

  return new NextResponse(gitResponse.body, {
    status: gitResponse.status,
    headers: {
      "Content-Type": gitResponse.headers.get("content-type") || `application/x-${service}-advertisement`,
      "Cache-Control": "no-cache",
    }
  })
}
