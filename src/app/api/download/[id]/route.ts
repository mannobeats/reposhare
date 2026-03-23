import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getInstallationToken } from "@/lib/github"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id.replace(/\.git$/, "")

  const share = await prisma.share.findUnique({
    where: { id, active: true },
  })

  // Same robust expiration and permission checking logic is enforced uniformly
  if (!share || (share.expiresAt && share.expiresAt < new Date())) {
    return NextResponse.json({ error: "Link expired or disabled." }, { status: 404 })
  }

  if (!share.installationId) {
    return NextResponse.json({ error: "Installation not configured for this share." }, { status: 500 })
  }

  // Record that a manual UI download was initiated
  prisma.analyticEvent.create({
    data: { shareId: share.id, type: "WEB_DOWNLOAD", ipHash: "anonymized" }
  }).catch(console.error)

  // Use the share's own installationId — not the user's, which may be null
  const token = await getInstallationToken(share.installationId)

  // Tell GitHub to create a ZIP bundle of this repository
  const response = await fetch(`https://api.github.com/repos/${share.repoFullName}/zipball`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "RepoShare Platform",
    },
    // Prevent Next.js from aggressively caching the binary blob stream
    cache: "no-store",
  })

  if (!response.ok) {
    return NextResponse.json({ error: "Failed to assemble ZIP bundle from source." }, { status: 500 })
  }

  // Stream the response back so massive repos don't consume memory
  return new NextResponse(response.body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${share.repoFullName.split("/")[1]}-shared.zip"`,
    }
  })
}
