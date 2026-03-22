# GitShare Open Source Clone: Architecture & Implementation Plan (2026 Edition)

By utilizing the **GitHub App Manifest flow** alongside the absolute latest modern toolchain, this product will provide a completely turnkey, high-performance sharing experience, allowing direct `git clone` access to private repositories.

## 1. Core Platform Capabilities

The platform allows a self-hosted instance owner to securely expose their private repositories via a beautiful web UI, or directly via native Git CLI commands.

### Features
- **Zero-Config Setup**: Automated 1-Click creation of a dedicated GitHub App for the self-hosted instance. No `.env` tampering.
- **Web Interface Sharing**: Clean, read-only UI for viewers to see the `README.md`, file tree, and download a ZIP, with password and expiration controls.
- **Native Git Clone Access (Proxy)**: Give someone a link, and they can run `git clone https://your-domain.com/share/XYZ123.git` perfectly, without ever needing a GitHub account or SSH keys.
- **Analytics Dashboard**: Track UI page views, direct ZIP downloads, and `git clone` events using Recharts.

---

## 2. Approach: Sharing Workflows

### The "Zero-Config" Admin Setup
1. On first run, the admin visits the platform and clicks **"Register GitHub App"**.
2. A manifest is passed quietly to GitHub configuring permissions, OAuth callbacks, and Webhook URLs to their specific self-hosted domain.
3. Upon approval on GitHub, the instance receives the `App ID`, `Client Secret`, and `Private Key (PEM)` automatically under the hood via the API. Configuration done.

### Generating The Output (Dashboard)
When a user wants to share a private repository, they get a single shareable URL: `https://my-domain.com/share/XYZ123`

The viewer can use this URL in two ways:
1. **Paste it into a Browser**: They see the Next.js Web UI showing the README, files, and a "Download ZIP" button.
2. **Paste it into the Terminal**: They run `git clone https://my-domain.com/share/XYZ123.git` seamlessly.

### The Native Git Smart HTTP Proxy Workflow
This is where the magic happens. When someone runs `git clone https://my-domain.com/share/XYZ123.git`:
1. The Git CLI automatically makes requests in the background (e.g., `GET /share/XYZ123.git/info/refs?service=git-upload-pack`).
2. Our Next.js server intercepts these routes.
3. It verifies the share link `XYZ123` (checking for expiration or paused links).
4. If valid, our backend uses its GitHub App Private Key to silently generate a short-lived **Installation Access Token** specifically for that repository.
5. Our Next.js server then forwards/proxies the Git traffic directly to the real `https://github.com/owner/repo.git` using that authenticated token, and streams the Git objects back to the user's terminal.
6. The terminal completes the `git clone` exactly as if it were a public repository, entirely bypassing the need for the viewer to have GitHub credentials.

*(Note: If the owner enables a password on the link, the user's `git clone` command will simply prompt them for a username and password in the terminal, which our Next.js backend will validate before proxying!)*

---

## 3. Technology Stack Recommendation (2026 Latest)

- **Framework:** **Next.js 16.2+ (App Router)** - Leveraging the new Turbopack engine for 400% faster development times and deeply optimized Route Handlers for the Git proxy streaming.
- **Frontend Core:** **React 19** - Native form actions and the `use` hook.
- **Styling:** **Tailwind CSS 4.0** - Utilizing the zero-config CSS engine, paired heavily with **Shadcn UI (v2)**.
- **Database & State:** **PostgreSQL + Prisma ORM 6+** - Predictable, auto-migrating, highly scalable persistence layer.
- **Authentication:** **Auth.js v5 (NextAuth)** - Providing native edge-compatible OAuth configurations.
- **SDKs:** **@octokit/rest** - The official GitHub API client to handle the authentication.
- **Infra:** **Docker Compose** - A single `.yml` to stand up the Stack.

---

## 4. Modern Database Schema (Conceptual)

```prisma
// This table holds the singleton configuration from the App Manifest Flow
model SystemConfig {
  id              String   @id @default("singleton")
  appId           String
  clientId        String
  clientSecret    String   // Encrypted
  webhookSecret   String   // Encrypted
  privateKey      String   // Encrypted PEM
  isSetupComplete Boolean  @default(true)
}

model User {
  id              String   @id @default(cuid())
  name            String?
  email           String?  @unique
  image           String?
  installationId  String?  // GitHub App Installation Reference
  shares          Share[]
}

model Share {
  id              String    @id @default(uuid())
  repoFullName    String    // e.g. "facebook/react"
  createdAt       DateTime  @default(now())
  expiresAt       DateTime?
  passwordHash    String?   // For Web UI locks or Git Basic Auth
  active          Boolean   @default(true)
  
  allowGitClone   Boolean   @default(true)
  
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  analytics       AnalyticEvent[]
}

model AnalyticEvent {
  id        String   @id @default(cuid())
  shareId   String
  share     Share    @relation(fields: [shareId], references: [id], onDelete: Cascade)
  type      String   // "PAGE_VIEW", "WEB_DOWNLOAD", "GIT_CLONE"
  ipHash    String   // Anonymized tracking
  createdAt DateTime @default(now())
}
```

## 5. Next Steps for Implementation

1. **Bootstrap Core**: Run `npx create-next-app@latest` (which will pull Next.js 16, React 19, and Tailwind 4).
2. **Setup Proxy Environment**: Implement the Prisma container inside Docker alongside the Next app.
3. **The Manifest Engine**: Build the `/api/github/manifest-redirect` endpoints that completely automate the creation of the GitHub developer credentials.
4. **Dashboard & Share UI**: Create the Next 16 Server Components to render the repository viewer with Shadcn UI components.
5. **Git Smart HTTP Proxy**: Build the Route Handlers (`app/share/[uuid]/info/refs/route.ts` and `app/share/[uuid]/git-upload-pack/route.ts`) to intercept and stream Git CLI traffic securely.
