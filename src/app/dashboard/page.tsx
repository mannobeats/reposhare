import { createAppAuth } from "@octokit/auth-app"
import { Octokit } from "@octokit/rest"
import { LogOut, TerminalSquare } from "lucide-react"
import { redirect } from "next/navigation"
import { auth, signOut } from "@/auth"
import { getBaseUrlDetails } from "@/lib/base-url"
import { getOctokitForInstallation } from "@/lib/github"
import { prisma } from "@/lib/prisma"
import ClientDashboard from "./ClientDashboard"

export const dynamic = "force-dynamic"

type DashboardPageProps = {
  searchParams: Promise<{ tab?: string }>
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  return <DashboardContent searchParams={searchParams} />
}

async function DashboardContent({ searchParams }: DashboardPageProps) {
  const session = await auth()
  if (!session?.user?.email) redirect("/")
  const resolvedSearchParams = await searchParams

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  })
  if (!user) {
    redirect("/")
  }

  const config = await prisma.systemConfig.findUnique({
    where: { id: "singleton" },
  })
  const isAppConfigured = Boolean(config && config.appId !== "temp")

  let repos: Record<string, any>[] = []
  let appSlug = ""
  let installations: Record<string, any>[] = []

  if (isAppConfigured) {
    const appOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: { appId: config?.appId, privateKey: config?.privateKey },
    })

    try {
      const appData = await appOctokit.rest.apps.getAuthenticated()
      appSlug = appData.data?.slug || ""

      const instData = await appOctokit.paginate(
        appOctokit.rest.apps.listInstallations,
        { per_page: 100 },
      )
      installations = instData.map((i) => ({
        id: i.id,
        accountName: i.account?.login || "Unknown",
        type: i.account?.type || "Unknown",
        avatar: i.account?.avatar_url,
      }))

      for (const inst of instData) {
        try {
          const octokit = await getOctokitForInstallation(inst.id)
          const allRepos = await octokit.paginate(
            octokit.rest.apps.listReposAccessibleToInstallation,
            { per_page: 100 },
            (response) => response.data,
          )

          const enhancedRepos = allRepos.map((r) => ({
            ...r,
            installation_id: inst.id,
            account_login: inst.account?.login,
          }))
          repos = [...repos, ...enhancedRepos]
        } catch (subErr) {
          console.error(
            `Failed to fetch repos for installation ${inst.id}`,
            subErr,
          )
        }
      }
    } catch (e) {
      console.error(
        "Failed to initialize multi-installation fetch constraints.",
        e,
      )
    }
  }

  const shares = await prisma.share.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { analytics: true } },
    },
  })

  const analyticsByDate = await prisma.analyticEvent.groupBy({
    by: ["type", "createdAt"],
    where: { share: { userId: user.id } },
    _count: true,
  })

  const baseUrlDetails = await getBaseUrlDetails()

  return (
    <div className="min-h-screen bg-[#000508] text-[#5eb8ff] selection:bg-[#5eb8ff]/30 font-mono pb-20">
      <nav className="border-b border-[#5eb8ff]/40 sticky top-0 bg-[#000508] z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 border border-[#5eb8ff] flex items-center justify-center text-[#5eb8ff]">
              <TerminalSquare className="w-4 h-4" />
            </div>
            <span className="font-bold tracking-widest text-[#5eb8ff] text-sm uppercase">
              REPOSHARE<span className="opacity-50">_CTRL</span>
            </span>
          </div>
          <form
            action={async () => {
              "use server"
              await signOut()
            }}
          >
            <button
              type="submit"
              className="flex items-center space-x-2 text-xs uppercase font-bold tracking-widest text-[#5eb8ff]/60 hover:text-[#000508] hover:bg-[#5eb8ff] transition-colors border border-transparent hover:border-[#5eb8ff] px-3 py-1.5"
            >
              <LogOut className="w-3 h-3" />
              <span>Terminate Session</span>
            </button>
          </form>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <ClientDashboard
          baseUrl={baseUrlDetails.activeUrl}
          baseUrlDetails={baseUrlDetails}
          initialTab={resolvedSearchParams.tab}
          userId={user.id}
          isAppConfigured={isAppConfigured}
          installations={installations}
          appSlug={appSlug}
          repositories={repos}
          shares={shares.map((share) => ({
            ...share,
            passwordProtected: Boolean(share.passwordHash),
          }))}
          analyticsData={analyticsByDate}
        />
      </main>
    </div>
  )
}
