import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getInstallationToken } from "@/lib/github"
import { verifyShareRequestAccess } from "@/lib/share-access"

async function resolveInfoRefsResponse(req: NextRequest, shareId: string) {
  const url = new URL(req.url)
  const service = url.searchParams.get("service")
  if (!service) return NextResponse.json({ error: "No git service requested" }, { status: 400 })

  const share = await prisma.share.findUnique({
    where: { id: shareId, active: true }
  })

  if (!share || (share.expiresAt && share.expiresAt < new Date())) {
    return new NextResponse("Repository not found or link expired", { status: 404 })
  }

  if (!share.allowGitClone) {
    return new NextResponse("Git clone is disabled for this share", { status: 403 })
  }

  const access = await verifyShareRequestAccess(req, share)
  if (!access.ok) {
    return new NextResponse("Authentication required for this share", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="RepoShare"' },
    })
  }

  if (!share.installationId) {
    return new NextResponse("Server configuration error", { status: 500 })
  }

  prisma.analyticEvent.create({
    data: {
      shareId: share.id,
      type: "GIT_CLONE_REFS",
      ipHash: "anonymized",
    }
  }).catch(console.error)

  const token = await getInstallationToken(share.installationId)
  const gitUrl = `https://github.com/${share.repoFullName}.git/info/refs?service=${service}`

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rawId = (await params).id
  const id = rawId.replace(/\.git$/, "")
  return resolveInfoRefsResponse(req, id)
}

export { resolveInfoRefsResponse }
