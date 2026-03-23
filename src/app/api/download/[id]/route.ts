import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getInstallationToken } from "@/lib/github"
import { verifyShareRequestAccess } from "@/lib/share-access"
import JSZip from "jszip"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id.replace(/\.git$/, "")

  const share = await prisma.share.findUnique({
    where: { id, active: true },
  })

  // Same robust expiration and permission checking logic is enforced uniformly
  if (!share || (share.expiresAt && share.expiresAt < new Date())) {
    return NextResponse.json({ error: "Link expired or disabled." }, { status: 404 })
  }

  if (!share.allowZipDownload) {
    return NextResponse.json({ error: "ZIP downloads are disabled for this share." }, { status: 403 })
  }

  const access = await verifyShareRequestAccess(req, share)
  if (!access.ok) {
    return NextResponse.json({ error: "Password required for this share." }, { status: 401 })
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

  const repoName = share.repoFullName.split("/")[1] || "repository"

  // GitHub's zipball wraps files in a folder named "owner-repo-commitsha".
  // Repackage the zip so the root folder matches the actual repository name,
  // giving the same experience as cloning or downloading from a public repo.
  const originalBuffer = Buffer.from(await response.arrayBuffer())
  const original = await JSZip.loadAsync(originalBuffer)
  const repackaged = new JSZip()

  // Detect the GitHub-generated root folder prefix (e.g. "owner-repo-sha/")
  const firstEntry = Object.keys(original.files)[0] || ""
  const githubPrefix = firstEntry.includes("/") ? firstEntry.split("/")[0] + "/" : ""

  for (const [path, entry] of Object.entries(original.files)) {
    // Replace the GitHub prefix with the clean repo name
    const newPath = githubPrefix
      ? path.replace(githubPrefix, repoName + "/")
      : repoName + "/" + path

    if (entry.dir) {
      repackaged.folder(newPath)
    } else {
      const content = await entry.async("uint8array")
      repackaged.file(newPath, content)
    }
  }

  const zipBuffer = await repackaged.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  })

  return new NextResponse(Buffer.from(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${repoName}.zip"`,
    }
  })
}
