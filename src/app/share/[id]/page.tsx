import { prisma } from "@/lib/prisma"
import { getShareRepoName } from "@/lib/share-access"
import { redirect } from "next/navigation"

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}

export default async function ShareRedirectPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const resolvedSearchParams = await searchParams
  const cleanId = id.replace(/\.git$/, "")

  const share = await prisma.share.findUnique({
    where: { id: cleanId, active: true },
    select: { repoFullName: true },
  })

  if (!share) {
    return (
      <div className="flex items-center justify-center min-h-screen text-primary p-6">
        <div className="border border-red-500 bg-red-500/10 p-6 max-w-lg w-full">
           <span className="text-red-500 font-bold uppercase tracking-widest text-sm mb-2 block">&gt; FATAL ERROR: 404</span>
           <span className="text-red-500/70 text-xs uppercase tracking-widest block">The requested repository could not be resolved. It may have expired or been purged.</span>
        </div>
      </div>
    )
  }

  const repoName = getShareRepoName(share.repoFullName)
  const query = resolvedSearchParams.error ? `?error=${resolvedSearchParams.error}` : ""
  redirect(`/share/${cleanId}/${repoName}${query}`)
}
