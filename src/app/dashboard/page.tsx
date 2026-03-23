import { redirect } from "next/navigation"
import { auth, signOut } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getOctokitForInstallation } from "@/lib/github"
import { getBaseUrlDetails } from "@/lib/base-url"
import { Octokit } from "@octokit/rest"
import { createAppAuth } from "@octokit/auth-app"
import ClientDashboard from "./ClientDashboard"
import { LogOut, TerminalSquare } from "lucide-react"

export const dynamic = "force-dynamic"

export default function DashboardPage() {
  return <DashboardContent />
}

async function DashboardContent() {
  const session = await auth()
  if (!session?.user?.email) redirect("/")

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) {
    redirect("/")
  }

  const config = await prisma.systemConfig.findUnique({ where: { id: "singleton" } })
  const isAppConfigured = Boolean(config && config.appId !== "temp")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let repos: Record<string, any>[] = []
  let appSlug = ""
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let installations: Record<string, any>[] = []

  if (isAppConfigured) {
    const appOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: { appId: config!.appId, privateKey: config!.privateKey }
    })
    
    try {
      const appData = await appOctokit.rest.apps.getAuthenticated()
      appSlug = appData.data?.slug || ""
      
      const { data: instData } = await appOctokit.rest.apps.listInstallations()
      installations = instData.map(i => ({
        id: i.id,
        accountName: i.account?.login || "Unknown",
        type: i.account?.type || "Unknown",
        avatar: i.account?.avatar_url
      }))
      
      for (const inst of instData) {
        try {
          const octokit = await getOctokitForInstallation(inst.id)
          const { data } = await octokit.rest.apps.listReposAccessibleToInstallation()
          
          const enhancedRepos = data.repositories.map(r => ({ 
            ...r, 
            installation_id: inst.id, 
            account_login: inst.account?.login 
          }))
          repos = [...repos, ...enhancedRepos]
        } catch (subErr) {
          console.error(`Failed to fetch repos for installation ${inst.id}`, subErr)
        }
      }
    } catch (e) {
      console.error("Failed to initialize multi-installation fetch constraints.", e)
    }
  }

  const shares = await prisma.share.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { analytics: true } }
    }
  })

  const analyticsByDate = await prisma.analyticEvent.groupBy({
    by: ['type', 'createdAt'],
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
            <span className="font-bold tracking-widest text-[#5eb8ff] text-sm uppercase">REPOSHARE<span className="opacity-50">_CTRL</span></span>
          </div>
          <form action={async () => {
             "use server"
             await signOut()
          }}>
            <button className="flex items-center space-x-2 text-xs uppercase font-bold tracking-widest text-[#5eb8ff]/60 hover:text-[#000508] hover:bg-[#5eb8ff] transition-colors border border-transparent hover:border-[#5eb8ff] px-3 py-1.5">
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
          userId={user.id}
          isAppConfigured={isAppConfigured}
          installations={installations} 
          appSlug={appSlug} 
          repositories={repos} 
          shares={shares} 
          analyticsData={analyticsByDate}
        />
      </main>
    </div>
  )
}
