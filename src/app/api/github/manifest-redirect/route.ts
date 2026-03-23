import { NextResponse } from "next/server"
import { getCanonicalBaseUrl } from "@/lib/base-url"

export async function GET() {
  let baseUrl = await getCanonicalBaseUrl()
  if (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1)

  const isPublicUrl =
    baseUrl.startsWith("https://") &&
    !baseUrl.includes("localhost") &&
    !baseUrl.includes("127.0.0.1")

  const manifest: {
    name: string
    url: string
    redirect_url: string
    public: boolean
    default_permissions: Record<string, string>
    hook_attributes?: {
      url: string
    }
  } = {
    name: "RepoShare",
    url: baseUrl,
    redirect_url: `${baseUrl}/api/github/setup`,
    public: true, // MUST be true for users to install it on isolated unlinked accounts/orgs
    default_permissions: {
      contents: "read",
      metadata: "read",
      emails: "read",
    },
  }

  // GitHub strictly blocks localhost hook_attributes and throws "Hook is invalid"
  if (isPublicUrl) {
    manifest.hook_attributes = {
      url: `${baseUrl}/api/github/webhook`,
    }
  }

  // We explicitly do NOT specify `default_events`.
  // Selecting "installation" without administration permission breaks the GitHub Manifest flow natively.
  // We can let the user optionally click those later, or they are auto-applied by github intelligently if hooks are present.

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Redirecting to GitHub</title>
      <style>body { background-color: #000; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: -apple-system, sans-serif; }</style>
    </head>
    <body onload="document.getElementById('manifestForm').submit()">
      <div style="text-align: center;">
        <div class="loader" style="border: 2px solid rgba(255,255,255,0.1); border-top: 2px solid white; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin: 0 auto 16px;"></div>
        <span>Configuring External Environment...</span>
      </div>
      <form id="manifestForm" action="https://github.com/settings/apps/new" method="post">
        <input type="hidden" name="manifest" id="manifest" value='${JSON.stringify(manifest).replace(/'/g, "&#39;")}' />
        <input type="hidden" name="state" id="state" value="${Date.now().toString()}" />
      </form>
      <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
    </body>
    </html>
  `

  return new NextResponse(html, { headers: { "Content-Type": "text/html" } })
}
