import { type NextRequest, NextResponse } from "next/server"
import { getCanonicalBaseUrl } from "@/lib/base-url"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")

  if (!code) {
    return NextResponse.json(
      { error: "No code provided by GitHub App Manifest flow." },
      { status: 400 },
    )
  }

  try {
    const response = await fetch(
      `https://api.github.com/app-manifests/${code}/conversions`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
      },
    )

    if (!response.ok) {
      const text = await response.text()
      return NextResponse.json(
        { error: "Failed to convert manifest code", details: text },
        { status: response.status },
      )
    }

    const data = await response.json()

    // Securely upsert the GitHub configuration to the database
    await prisma.systemConfig.upsert({
      where: { id: "singleton" },
      update: {
        appId: data.id.toString(),
        clientId: data.client_id,
        clientSecret: data.client_secret,
        webhookSecret: data.webhook_secret || "",
        privateKey: data.pem,
        isSetupComplete: true,
      },
      create: {
        id: "singleton",
        appId: data.id.toString(),
        clientId: data.client_id,
        clientSecret: data.client_secret,
        webhookSecret: data.webhook_secret || "",
        privateKey: data.pem,
        isSetupComplete: true,
      },
    })

    // Now securely redirect the admin to the dashboard
    return NextResponse.redirect(
      `${await getCanonicalBaseUrl()}/dashboard?setup=success`,
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to process the GitHub manifest integration.", message },
      { status: 500 },
    )
  }
}
