import { type NextRequest, NextResponse } from "next/server"
import { getInstallationToken } from "@/lib/github"
import { prisma } from "@/lib/prisma"
import { verifyShareRequestAccess } from "@/lib/share-access"

async function resolveGitUploadPackResponse(req: NextRequest, shareId: string) {
  const share = await prisma.share.findUnique({
    where: { id: shareId, active: true },
  })

  if (!share || (share.expiresAt && share.expiresAt < new Date())) {
    return new NextResponse("Repository not found or link expired", {
      status: 404,
    })
  }

  if (!share.allowGitClone) {
    return new NextResponse("Git clone is disabled for this share", {
      status: 403,
    })
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

  prisma.analyticEvent
    .create({
      data: {
        shareId: share.id,
        type: "GIT_CLONE_UPLOAD",
        ipHash: "anonymized",
      },
    })
    .catch(console.error)

  const token = await getInstallationToken(share.installationId)
  const gitUrl = `https://github.com/${share.repoFullName}.git/git-upload-pack`
  const bodyBuffer = Buffer.from(await req.arrayBuffer())

  const headers: Record<string, string> = {
    Authorization: `Basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`,
    "Content-Type":
      req.headers.get("content-type") ||
      "application/x-git-upload-pack-request",
    Accept: req.headers.get("accept") || "application/x-git-upload-pack-result",
    "User-Agent": "RepoShare Proxy",
  }

  const gitProtocol = req.headers.get("git-protocol")
  if (gitProtocol) {
    headers["Git-Protocol"] = gitProtocol
  }

  const gitResponse = await fetch(gitUrl, {
    method: "POST",
    headers,
    body: bodyBuffer,
  })

  return new NextResponse(gitResponse.body, {
    status: gitResponse.status,
    headers: {
      "Content-Type":
        gitResponse.headers.get("content-type") ||
        "application/x-git-upload-pack-result",
      "Cache-Control": "no-cache",
    },
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rawId = (await params).id
  const id = rawId.replace(/\.git$/, "")
  return resolveGitUploadPackResponse(req, id)
}

export { resolveGitUploadPackResponse }
