import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { getOctokitForInstallation } from "@/lib/github"
import { Github, FolderGit2, Calendar, FileText, Download, Terminal, AlignLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { format } from "date-fns"

export default async function SharedRepositoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cleanId = id.replace(/\.git$/, "")

  const share = await prisma.share.findUnique({
    where: { id: cleanId, active: true },
    include: { user: true }
  })

  if (!share || (share.expiresAt && share.expiresAt < new Date())) {
    notFound()
  }

  // Increment view counter analytics
  prisma.analyticEvent.create({
    data: { shareId: share.id, type: "PAGE_VIEW", ipHash: "anonymized_via_edge" }
  }).catch(() => {})

  const octokit = await getOctokitForInstallation(share.user.installationId!)
  const [owner, repo] = share.repoFullName.split("/")
  
  let readme = ""
  let repoData: any = null

  try {
    const { data } = await octokit.rest.repos.get({ owner, repo })
    repoData = data
    const { data: readmeContent } = await octokit.rest.repos.getReadme({
      owner, repo,
      mediaType: { format: "raw" }
    })
    readme = readmeContent as unknown as string
  } catch (e) {
    console.error("Failed fetching GitHub repo details", e)
  }

  // Generate dynamic connection string
  // If the origin proxy is not possible universally without SSR headers, we fallback to a native template string
  const cloneCmd = `git clone ${process.env.NEXT_PUBLIC_SITE_URL || "https://reposhare.domain"}/share/${cleanId}.git`

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-neutral-800 pb-20 font-sans">
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-neutral-900/50 to-transparent pointer-events-none" />

      <main className="max-w-4xl mx-auto px-6 pt-24 relative z-10">
        <header className="space-y-6 mb-12">
          <div className="flex items-center space-x-4 mb-8">
            <div className="w-12 h-12 bg-white rounded-xl text-black flex items-center justify-center shadow-2xl">
              <FolderGit2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{repo}</h1>
              <p className="text-neutral-500 font-mono text-sm tracking-tight">{owner}/{repo}</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex bg-neutral-900/50 backdrop-blur-md rounded-2xl p-1 border border-white/10 w-full sm:w-auto overflow-hidden shadow-2xl">
               <div className="bg-black text-neutral-400 font-mono text-sm px-4 py-3 rounded-xl flex items-center w-full select-all">
                  <Terminal className="w-4 h-4 mr-3 text-neutral-600" />
                  <span className="opacity-70 mr-2">$</span> {cloneCmd}
               </div>
            </div>
            
            <a href={`/api/download/${cleanId}`} download>
             <Button className="h-[52px] px-8 rounded-2xl bg-white text-black hover:bg-neutral-200 transition-transform active:scale-95 shadow-xl font-medium">
               <Download className="w-5 h-5 mr-2" /> Download Source ZIP
             </Button>
            </a>
          </div>
        </header>

        {repoData && (
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 text-sm text-neutral-400">
             <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center space-y-2">
               <Calendar className="w-5 h-5 text-neutral-500" />
               <span className="font-medium text-white">{format(new Date(repoData.pushed_at), "MMM d, yyyy")}</span>
               <span className="text-xs">Last Updated</span>
             </div>
             <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center space-y-2">
               <FileText className="w-5 h-5 text-neutral-500" />
               <span className="font-medium text-white">{(repoData.size / 1024).toFixed(1)} MB</span>
               <span className="text-xs">Repository Size</span>
             </div>
             <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center space-y-2">
               <Github className="w-5 h-5 text-neutral-500" />
               <span className="font-medium text-white">{repoData.default_branch}</span>
               <span className="text-xs">Default Branch</span>
             </div>
             <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center space-y-2">
               <AlignLeft className="w-5 h-5 text-neutral-500" />
               <span className="font-medium text-white">{readme ? "Available" : "Missing"}</span>
               <span className="text-xs">README.md</span>
             </div>
           </div>
        )}

        {readme ? (
          <article className="prose prose-invert prose-neutral max-w-none prose-pre:bg-neutral-900/80 prose-pre:border-white/10 prose-pre:border prose-a:text-blue-400 hover:prose-a:text-blue-300 bg-neutral-950/40 p-10 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-xl">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {readme}
            </ReactMarkdown>
          </article>
        ) : (
          <div className="text-center p-20 bg-neutral-900/20 border border-white/10 rounded-3xl">
            <p className="text-neutral-500">No README.md available for this repository.</p>
          </div>
        )}
      </main>
    </div>
  )
}
