import { prisma } from "@/lib/prisma"
import { getOctokitForInstallation } from "@/lib/github"
import { FolderGit2, Calendar, FileText, Download, Terminal, AlignLeft, GitBranch, Shield, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { format } from "date-fns"
import { getCanonicalBaseUrl } from "@/lib/base-url"
import { buildShareClonePath, getShareRepoName, unlockBrowserShareAccess, verifyShareBrowserAccess } from "@/lib/share-access"
import { redirect } from "next/navigation"

type PageProps = {
  params: Promise<{ id: string; repo: string }>
  searchParams: Promise<{ error?: string }>
}

export default async function SharedRepositoryPage({ params, searchParams }: PageProps) {
  const { id, repo: _repo } = await params
  const resolvedSearchParams = await searchParams
  const cleanId = id.replace(/\.git$/, "")

  const share = await prisma.share.findUnique({
    where: { id: cleanId, active: true },
    include: { user: true }
  })

  if (!share || (share.expiresAt && share.expiresAt < new Date())) {
    return (
      <div className="flex items-center justify-center min-h-screen text-primary p-6">
        <div className="border border-red-500 bg-red-500/10 p-6 max-w-lg w-full">
           <span className="text-red-500 font-bold uppercase tracking-widest text-sm mb-2 block">&gt; FATAL ERROR: 404</span>
           <span className="text-red-500/70 text-xs uppercase tracking-widest block">The requested repository could not be resolved. It may have expired or been purged.</span>
        </div>
      </div>
    )
  }

  const resolvedShare = share
  const repoName = getShareRepoName(share.repoFullName)

  const [owner, repo] = share.repoFullName.split("/")

  async function unlockShare(formData: FormData) {
    "use server"

    const password = (formData.get("password") as string | null)?.trim() || ""
    if (!resolvedShare.passwordHash || !password) {
      redirect(`/share/${cleanId}/${repoName}?error=invalid-password`)
    }

    const unlocked = await unlockBrowserShareAccess(cleanId, resolvedShare.passwordHash, password)
    if (!unlocked) {
      redirect(`/share/${cleanId}/${repoName}?error=invalid-password`)
    }

    redirect(`/share/${cleanId}/${repoName}`)
  }

  const browserAccess = await verifyShareBrowserAccess(resolvedShare)
  if (!browserAccess.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 screen-scanline font-mono text-primary">
        <div className="w-full max-w-xl border border-primary/40 bg-background p-8 space-y-6">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 border border-primary bg-primary flex items-center justify-center text-background">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-widest uppercase">{repo}</h1>
              <p className="text-primary/50 text-xs tracking-widest uppercase">{owner}/{repo}</p>
            </div>
          </div>

          <div className="border border-primary/30 bg-primary/5 p-4 text-xs uppercase tracking-widest text-primary/70 leading-relaxed">
            This share is password protected. Enter the access password to view the repository page and download the source archive. Git clone remains available through HTTP authentication.
          </div>

          {resolvedSearchParams.error === "invalid-password" ? (
            <div className="border border-red-500/60 bg-red-500/10 px-4 py-3 text-[10px] uppercase tracking-widest text-red-400">
              &gt; Invalid password. Try again.
            </div>
          ) : null}

          <form action={unlockShare} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-primary/60 block">Share Password</label>
              <input
                name="password"
                type="password"
                required
                className="w-full bg-background border border-primary/40 px-4 py-3 text-primary outline-none text-xs tracking-widest focus:border-primary transition-colors"
              />
            </div>
            <Button className="w-full h-12 rounded-none border border-primary bg-primary text-background hover:bg-transparent hover:text-primary uppercase tracking-widest text-xs font-bold">
              &gt; Unlock Share
            </Button>
          </form>
        </div>
      </div>
    )
  }

  prisma.analyticEvent.create({
    data: { shareId: resolvedShare.id, type: "PAGE_VIEW", ipHash: "anonymized" }
  }).catch(console.error)

  if (!resolvedShare.installationId) {
    return (
      <div className="flex items-center justify-center min-h-screen text-primary p-6">
        <div className="border border-red-500 bg-red-500/10 p-6 max-w-lg w-full">
           <span className="text-red-500 font-bold uppercase tracking-widest text-sm mb-2 block">&gt; SYSTEM ERROR: 500</span>
           <span className="text-red-500/70 text-xs uppercase tracking-widest block">Origin node installation invalid. Please regenerate the proxy tunnel.</span>
        </div>
      </div>
    )
  }

  const octokit = await getOctokitForInstallation(resolvedShare.installationId)
  let readme = ""
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let repoData: Record<string, any> | null = null

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

  const baseUrl = await getCanonicalBaseUrl()
  const cloneCmd = `git clone ${buildShareClonePath(baseUrl, cleanId, resolvedShare.repoFullName)}`

  const formatSize = (sizeKb: number) => {
    if (sizeKb < 1024) return `${sizeKb} KB`
    return `${(sizeKb / 1024).toFixed(1)} MB`
  }

  return (
    <div className="min-h-screen flex flex-col p-6 screen-scanline font-mono text-primary">
      <main className="max-w-5xl mx-auto w-full pt-16 relative z-10">
        <header className="space-y-6 mb-12">
          <div className="flex items-center space-x-4 mb-8">
            <div className="w-12 h-12 border border-primary bg-primary flex items-center justify-center text-background">
              <FolderGit2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-widest uppercase">{repo}</h1>
              <p className="text-primary/50 text-xs tracking-widest uppercase">{owner}/{repo}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-4 items-stretch">
            {resolvedShare.allowGitClone ? (
              <div className="flex bg-background border border-primary w-full overflow-hidden">
                 <div className="text-primary text-xs px-4 py-3 flex items-center w-full select-all">
                    <Terminal className="w-4 h-4 mr-3 opacity-50 shrink-0" />
                    <span className="opacity-50 mr-2 shrink-0">&gt;</span>
                    <span className="truncate">{cloneCmd}</span>
                 </div>
              </div>
            ) : (
              <div className="flex bg-background border border-primary/30 w-full overflow-hidden text-primary/50 text-xs px-4 py-3 items-center uppercase tracking-widest">
                <Lock className="w-4 h-4 mr-3 shrink-0" />
                Git clone has been disabled for this share.
              </div>
            )}

            {resolvedShare.allowZipDownload ? (
              <a href={`/api/download/${cleanId}`} download className="w-full xl:w-auto">
               <Button className="w-full h-[42px] px-8 rounded-none border border-primary bg-primary text-background hover:bg-transparent hover:text-primary transition-colors text-xs uppercase tracking-widest font-bold scanline-button">
                 <Download className="w-4 h-4 mr-2" /> Download Source
               </Button>
              </a>
            ) : (
              <div className="w-full xl:w-auto">
                <Button disabled className="w-full h-[42px] px-8 rounded-none border border-primary/30 bg-transparent text-primary/40 text-xs uppercase tracking-widest font-bold">
                  <Lock className="w-4 h-4 mr-2" /> Download Disabled
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-widest">
            <span className="border border-primary/30 bg-primary/10 px-3 py-2">
              Repo: {getShareRepoName(resolvedShare.repoFullName)}
            </span>
            <span className="border border-primary/30 bg-primary/10 px-3 py-2">
              Clone: {resolvedShare.allowGitClone ? "Enabled" : "Disabled"}
            </span>
            <span className="border border-primary/30 bg-primary/10 px-3 py-2">
              ZIP: {resolvedShare.allowZipDownload ? "Enabled" : "Disabled"}
            </span>
            <span className="border border-primary/30 bg-primary/10 px-3 py-2">
              Access: {resolvedShare.passwordHash ? "Password Protected" : "Link Only"}
            </span>
          </div>

          {resolvedShare.passwordHash && resolvedShare.allowGitClone ? (
            <div className="border border-primary/30 bg-primary/5 px-4 py-3 text-[10px] uppercase tracking-widest text-primary/65">
              This clone URL is password protected. Git clients can authenticate with any username and the share password when prompted.
            </div>
          ) : null}

          {(!repoData && !readme) && (
            <div className="border border-red-500 bg-red-500/10 p-4 mt-6">
               <span className="text-red-500 text-xs uppercase tracking-widest block">&gt; WARNING: Partial resolution failure. GitHub API returned empty payloads. Rate limits or deletion detected.</span>
            </div>
          )}
        </header>

        {repoData && (
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 text-xs uppercase tracking-widest">
             <div className="border border-primary/40 bg-background p-4 flex flex-col items-center justify-center space-y-2">
               <Calendar className="w-4 h-4 text-primary/60" />
               <span className="font-bold">{format(new Date(repoData.pushed_at), "MMM d, yyyy")}</span>
               <span className="text-[10px] text-primary/50">Last Push</span>
             </div>
             <div className="border border-primary/40 bg-background p-4 flex flex-col items-center justify-center space-y-2">
               <FileText className="w-4 h-4 text-primary/60" />
               <span className="font-bold">{formatSize(repoData.size)}</span>
               <span className="text-[10px] text-primary/50">Data Size</span>
             </div>
             <div className="border border-primary/40 bg-background p-4 flex flex-col items-center justify-center space-y-2">
               <GitBranch className="w-4 h-4 text-primary/60" />
               <span className="font-bold">{repoData.default_branch}</span>
               <span className="text-[10px] text-primary/50">Root Branch</span>
             </div>
             <div className="border border-primary/40 bg-background p-4 flex flex-col items-center justify-center space-y-2">
               <AlignLeft className="w-4 h-4 text-primary/60" />
               <span className="font-bold">{readme ? "OK" : "ERR"}</span>
               <span className="text-[10px] text-primary/50">Readme Chunk</span>
             </div>
           </div>
        )}

        {readme ? (
          <article className="prose prose-invert prose-p:text-primary prose-a:text-primary prose-strong:text-primary max-w-none bg-background p-8 border border-primary/40 text-sm font-sans tracking-wide">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {readme}
            </ReactMarkdown>
          </article>
        ) : (
          <div className="text-center p-12 bg-background border border-primary/40 border-dashed">
            <p className="text-primary/50 text-xs uppercase tracking-widest">&gt; NO DOCUMENTATION DATASTREAM FOUND</p>
          </div>
        )}

        <footer className="mt-16 mb-8 text-center">
          <div className="flex items-center justify-center space-x-2 text-primary/30 text-[10px] uppercase tracking-[0.3em]">
            <Shield className="w-3 h-3" />
            <span>Powered by RepoShare</span>
          </div>
        </footer>
      </main>
    </div>
  )
}
