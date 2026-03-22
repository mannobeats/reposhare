"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Github, Plus, Lock, Globe, Loader2, Link2, Download, Copy, Trash, Pause, Play, Activity } from "lucide-react"
import { createShareLink, toggleShareActive, deleteShare } from "./actions"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"

interface Props {
  userId: string
  installationId: string | null
  appSlug: string
  repositories: any[]
  shares: any[]
}

export default function ClientDashboard({ userId, installationId, appSlug, repositories, shares }: Props) {
  const [creating, setCreating] = useState<string | null>(null)

  const handleInstallApp = () => {
    window.location.href = `https://github.com/apps/${appSlug}/installations/new`
  }

  const handleShare = async (repoName: string) => {
    try {
      setCreating(repoName)
      await createShareLink(repoName, 7) // 7 days expiration by default for MVP
      toast.success("Repository linked successfully!")
    } catch {
      toast.error("Failed to share repository")
    } finally {
      setCreating(null)
    }
  }

  const handleCopyLink = (id: string) => {
    const link = `${window.location.origin}/share/${id}`
    navigator.clipboard.writeText(link)
    toast.success("Share link copied to clipboard", { description: link })
  }

  if (!installationId) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="max-w-xl mx-auto mt-20 p-8 rounded-3xl bg-neutral-900/50 border border-white/10 text-center space-y-6 shadow-2xl backdrop-blur-md"
      >
        <div className="mx-auto w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
          <Github className="w-8 h-8 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-medium tracking-tight text-white mb-2">Connect Your Code</h2>
          <p className="text-neutral-400 text-sm max-w-sm mx-auto">
            To generate secure sharing links, GitShare needs permission to access specific repositories on your GitHub account.
          </p>
        </div>
        <Button 
          onClick={handleInstallApp}
          className="bg-white text-black hover:bg-neutral-200 rounded-full h-12 px-8 font-medium transition-transform active:scale-95"
        >
          Select Repositories
        </Button>
      </motion.div>
    )
  }

  return (
    <div className="space-y-16">
      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Active Shares</h2>
            <p className="text-sm text-neutral-400 mt-1">Manage public links to your private code</p>
          </div>
        </div>

        {shares.length === 0 ? (
          <div className="p-12 border border-white/5 border-dashed rounded-2xl flex flex-col items-center justify-center text-center space-y-4 bg-white/[0.01]">
            <Link2 className="w-8 h-8 text-neutral-600" />
            <p className="text-neutral-500 font-medium text-sm">No active shares. Select a repository below to generated a secure link.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {shares.map(share => (
              <motion.div 
                key={share.id} 
                className="group flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl bg-neutral-950/50 hover:bg-neutral-900 border border-white/5 hover:border-white/10 transition-all font-mono text-sm"
              >
                <div className="flex items-center space-x-4 mb-4 sm:mb-0">
                  <div className={`w-2 h-2 rounded-full \${share.active ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]" : "bg-neutral-600"}`} />
                  <div>
                    <h4 className="font-semibold text-white font-sans text-base">{share.repoFullName}</h4>
                    <div className="flex items-center space-x-3 text-neutral-500 text-xs mt-1">
                      <span>Expires {share.expiresAt ? formatDistanceToNow(new Date(share.expiresAt), { addSuffix: true }) : "Never"}</span>
                      <span>&bull;</span>
                      <span className="flex items-center"><Activity className="w-3 h-3 mr-1" /> {share._count.analytics} Views</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Button 
                    variant="ghost" size="sm" 
                    onClick={() => handleCopyLink(share.id)}
                    className="hover:bg-white/10 hover:text-white rounded-xl h-9"
                  >
                    <Copy className="w-4 h-4 mr-2" /> Copy Link
                  </Button>
                  <Button 
                    variant="ghost" size="icon"
                    onClick={() => toggleShareActive(share.id, !share.active)}
                    className="hover:bg-white/10 hover:text-white rounded-xl h-9 w-9"
                  >
                    {share.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                  <Button 
                    variant="ghost" size="icon"
                    onClick={() => deleteShare(share.id)}
                    className="hover:bg-red-500/10 text-neutral-400 hover:text-red-500 rounded-xl h-9 w-9"
                  >
                    <Trash className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.section>

      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Connected Repositories</h2>
            <p className="text-sm text-neutral-400 mt-1">Repositories your GitHub App can securely proxy</p>
          </div>
          <Button variant="outline" onClick={handleInstallApp} className="rounded-xl border-white/10 hover:bg-white/5">
            Manage Access
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {repositories.map(repo => (
            <div key={repo.id} className="p-5 rounded-2xl border border-white/5 bg-neutral-900/20 backdrop-blur flex flex-col justify-between">
              <div className="space-y-3 mb-6">
                <div className="flex items-start justify-between">
                  <h3 className="font-medium text-white break-all">{repo.full_name}</h3>
                  <Badge variant="outline" className="\${repo.private ? 'border-amber-500/30 text-amber-500 bg-amber-500/5' : 'border-green-500/30 text-green-500 bg-green-500/5'} text-[10px] uppercase font-bold tracking-wider float-right ml-2 mt-1">
                    {repo.private ? <Lock className="w-3 h-3 inline mr-1 -mt-0.5" /> : <Globe className="w-3 h-3 inline mr-1 -mt-0.5" />}
                    {repo.private ? "Private" : "Public"}
                  </Badge>
                </div>
                {repo.description && (
                  <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">{repo.description}</p>
                )}
              </div>
              <Button 
                onClick={() => handleShare(repo.full_name)}
                disabled={creating === repo.full_name}
                className="w-full bg-white text-black hover:bg-neutral-200 rounded-xl font-medium transition-all active:scale-[0.98]"
              >
                {creating === repo.full_name ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-2" /> Generate Secure Link</>}
              </Button>
            </div>
          ))}
        </div>
      </motion.section>
    </div>
  )
}
