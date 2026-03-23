import crypto from "node:crypto"
import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Helper to verify GitHub signature
async function verifySignature(req: NextRequest, secret: string) {
  const signature = req.headers.get("x-hub-signature-256")
  if (!signature) return false

  const body = await req.clone().text()
  const expectedSignature = `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    )
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const event = req.headers.get("x-github-event")
  if (!event)
    return NextResponse.json({ error: "Missing event metric" }, { status: 400 })

  const config = await prisma.systemConfig.findUnique({
    where: { id: "singleton" },
  })
  if (!config)
    return NextResponse.json({ error: "System unconfigured" }, { status: 500 })

  if (!(await verifySignature(req, config.webhookSecret))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  const payload = await req.json()

  // On new installation, attempt to map installation ID back to the user's Github account
  if (event === "installation" && payload.action === "created") {
    const senderId = payload.sender.id.toString()
    const installationId = payload.installation.id.toString()

    // We update the user if they've already logged in via OAuth beforehand
    // Or if they login later, they won't have the installationId right away unless they link it
    // Wait, the sender.id perfectly matches the NextAuth profile.id
    try {
      await prisma.user.updateMany({
        where: { id: senderId },
        data: { installationId },
      })
    } catch (e) {
      console.error("Failed mapping installed app to user", e)
    }
  }

  if (event === "installation" && payload.action === "deleted") {
    const installationId = payload.installation.id.toString()
    await prisma.user.updateMany({
      where: { installationId },
      data: { installationId: null },
    })
  }

  return NextResponse.json({ success: true })
}
