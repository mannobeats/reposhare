import { NextResponse, NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  // Use the inbound request URL to generate dynamic webhook and callback URLs
  const baseUrl = new URL(req.url).origin
  
  const manifest = {
    name: "GitShare Platform",
    url: baseUrl,
    hook_attributes: {
      url: `${baseUrl}/api/github/webhook`
    },
    redirect_url: `${baseUrl}/api/github/setup`,
    callback_urls: [`${baseUrl}/api/auth/callback/github`],
    public: false,
    default_permissions: {
      contents: "read",
      metadata: "read",
      emails: "read"
    },
    default_events: [
      "installation",
      "installation_repositories", 
      "meta"
    ]
  }

  // Construct HTML that quietly auto-submits the form to GitHub Developer settings
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
        <span>Configuring Environment...</span>
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
