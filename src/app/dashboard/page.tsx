import { redirect } from "next/navigation"
import { auth, signOut } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getOctokitForInstallation } from "@/lib/github"
import { Octokit } from "@octokit/rest"
import { createAppAuth } from "@octokit/auth-app"
import ClientDashboard from "./ClientDashboard"
import { LogOut, FolderGit2 } from "lucide-react"

export default function DashboardPage() {
  return <DashboardContent />
}

async function DashboardContent() {
  const session = await auth()
  if (!session?.user?.email) redirect("/")

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) {
    // Edge case unmounted user
    await signOut()
    redirect("/")
  }

  const config = await prisma.systemConfig.findUnique({ where: { id: "singleton" } })
  const isAppConfigured = Boolean(config && config.appId !== "temp")

  let repos: any[] = []
  let appSlug = ""

  if (isAppConfigured) {
    if (!user.installationId) {
      const appOctokit = new Octokit({
        authStrategy: createAppAuth,
        auth: { appId: config!.appId, privateKey: config!.privateKey }
      })
      const appData = await appOctokit.rest.apps.getAuthenticated()
      appSlug = appData.data?.slug || ""
    } else {
      try {
        const octokit = await getOctokitForInstallation(user.installationId)
        const { data } = await octokit.rest.apps.listReposAccessibleToInstallation()
        repos = data.repositories
      } catch (e) {
        // installation might have been deleted but not registered via webhook
        await prisma.user.update({ where: { id: user.id }, data: { installationId: null }})
        redirect("/dashboard")
      }
    }
  }

  // Fetch the active shares for this user
  const shares = await prisma.share.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { analytics: true } }
    }
  })

  // Basic analytics rollups for the UI tab
  const analyticsByDate = await prisma.analyticEvent.groupBy({
    by: ['type', 'createdAt'],
    where: { share: { userId: user.id } },
    _count: true,
  })

  return (
    <div className="min-h-screen bg-black text-white selection:bg-neutral-800 pb-20">
      <nav className="border-b border-white/10 sticky top-0 bg-black/50 backdrop-blur-xl z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center text-black">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <span className="font-semibold tracking-tight text-lg">RepoShare</span>
          </div>
          <form action={async () => {
             "use server"
             await signOut()
          }}>
            <button className="flex items-center space-x-2 text-sm text-neutral-400 hover:text-white transition-colors">
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </form>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <ClientDashboard 
          userId={user.id}
          isAppConfigured={isAppConfigured}
          installationId={user.installationId} 
          appSlug={appSlug} 
          repositories={repos} 
          shares={shares} 
          analyticsData={analyticsByDate}
        />
      </main>
    </div>
  )
}
