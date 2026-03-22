"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Github, Plus, Lock, Globe, Loader2, Link2, Copy, Trash, Pause, Play, Activity, Folders, BarChart3, Settings } from "lucide-react"
import { createShareLink, toggleShareActive, deleteShare } from "./actions"
import { toast } from "sonner"
import { formatDistanceToNow, format } from "date-fns"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface Props {
  userId: string
  isAppConfigured: boolean
  installationId: string | null
  appSlug: string
  repositories: any[]
  shares: any[]
  analyticsData: any[]
}

export default function ClientDashboard({ isAppConfigured, installationId, appSlug, repositories, shares, analyticsData }: Props) {
  const [creating, setCreating] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"shares" | "analytics" | "settings">("shares")

  // Roll up raw analytics into daily buckets for the Shadcn-style Recharts graph
  const chartData = useMemo(() => {
    const buckets: Record<string, number> = {}
    analyticsData.forEach(event => {
      const day = format(new Date(event.createdAt), "MMM d")
      buckets[day] = (buckets[day] || 0) + event._count
    })
    
    return Object.entries(buckets).map(([date, views]) => ({ date, views }))
  }, [analyticsData])

  const handleCreateManifest = () => {
    window.location.href = "/api/github/manifest-redirect"
  }

  const handleInstallApp = () => {
    window.location.href = `https://github.com/apps/\${appSlug}/installations/new`
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
    const link = `\${window.location.origin}/share/\${id}`
    navigator.clipboard.writeText(link)
    toast.success("Share link copied to clipboard", { description: link })
  }

  const tabs = [
    { id: "shares", label: "Shares", icon: Folders },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: Settings },
  ] as const

  return (
    <div className="space-y-10">
      <div className="flex items-center space-x-2 border-b border-white/10 pb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors \${activeTab === tab.id ? "bg-white/10 text-white" : "text-neutral-400 hover:text-white hover:bg-white/5"}`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        
        {activeTab === "shares" && (
          <motion.div key="shares" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-12">
            
            {/* Active Links Section */}
            <section className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Active Share Links</h2>
                <p className="text-sm text-neutral-400 mt-1">Manage public links and granular access controls</p>
              </div>

              {shares.length === 0 ? (
                <div className="p-12 border border-white/5 border-dashed rounded-2xl flex flex-col items-center justify-center text-center space-y-4 bg-white/[0.01]">
                  <Link2 className="w-8 h-8 text-neutral-600" />
                  <p className="text-neutral-500 font-medium text-sm">No active shares yet. Start by generating a link below.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {shares.map(share => (
                    <div key={share.id} className="group flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl bg-neutral-950/50 border border-white/5 font-mono text-sm shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
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
                        <Button variant="ghost" size="sm" onClick={() => handleCopyLink(share.id)} className="hover:bg-white/10 hover:text-white rounded-xl h-9">
                          <Copy className="w-4 h-4 mr-2" /> Copy
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => toggleShareActive(share.id, !share.active)} className="hover:bg-white/10 hover:text-white rounded-xl h-9 w-9">
                          {share.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteShare(share.id)} className="hover:bg-red-500/10 text-neutral-400 hover:text-red-500 rounded-xl h-9 w-9">
                          <Trash className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Repositories Section */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">Remote Repositories</h2>
                  <p className="text-sm text-neutral-400 mt-1">GitHub repositories accessible by RepoShare</p>
                </div>
                {isAppConfigured && installationId && (
                  <Button variant="outline" onClick={handleInstallApp} className="rounded-xl border-white/10 hover:bg-white/5 text-xs h-9">
                    Manage GitHub Access
                  </Button>
                )}
              </div>

              {!isAppConfigured ? (
                <div className="p-8 border border-white/10 bg-white/5 rounded-3xl flex flex-col items-center justify-center text-center space-y-4">
                  <Github className="w-10 h-10 text-neutral-400" />
                  <div>
                    <h3 className="text-lg font-medium text-white">GitHub Environment Unconfigured</h3>
                    <p className="text-sm text-neutral-400 max-w-sm mt-1">Connect your workspace to GitHub to automatically import and proxy private repositories.</p>
                  </div>
                  <Button onClick={handleCreateManifest} className="bg-white text-black hover:bg-neutral-200 rounded-xl font-medium px-6 mt-2">
                    Connect GitHub Platform
                  </Button>
                </div>
              ) : !installationId ? (
                <div className="p-8 border border-white/10 bg-white/5 rounded-3xl flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                    <Github className="w-6 h-6 text-black" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-white">Application Ready</h3>
                    <p className="text-sm text-neutral-400 max-w-xs mx-auto mt-1">The RepoShare App was generated. Install it on your personal GitHub Account.</p>
                  </div>
                  <Button onClick={handleInstallApp} className="bg-white text-black hover:bg-neutral-200 rounded-xl font-medium px-6 mt-2">
                    Authorize Repositories
                  </Button>
                </div>
              ) : repositories.length === 0 ? (
                <div className="p-8 border border-white/5 border-dashed rounded-2xl flex items-center justify-center text-center text-neutral-500 text-sm">
                  No repositories found. Either the GitHub App has zero access or all permissions were revoked.
                </div>
              ) : (
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
                      <Button onClick={() => handleShare(repo.full_name)} disabled={creating === repo.full_name} className="w-full bg-white text-black hover:bg-neutral-200 rounded-xl font-medium transition-all active:scale-[0.98]">
                        {creating === repo.full_name ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-2" /> Share Repository</>}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </motion.div>
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && (
           <motion.div key="analytics" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-6">
             <h2 className="text-2xl font-semibold tracking-tight">Platform Analytics</h2>
             <div className="border border-white/10 rounded-3xl p-6 bg-neutral-900/20 shadow-2xl overflow-hidden">
               {chartData.length === 0 ? (
                 <div className="h-[400px] flex items-center justify-center text-neutral-500 font-medium">
                   No analytics data captured yet.
                 </div>
               ) : (
                 <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#fff" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#fff" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#111', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Area type="monotone" dataKey="views" name="Platform Hits" stroke="#fff" strokeWidth={3} fillOpacity={1} fill="url(#colorViews)" />
                      </AreaChart>
                    </ResponsiveContainer>
                 </div>
               )}
             </div>
           </motion.div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
           <motion.div key="settings" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6 max-w-xl">
             <h2 className="text-2xl font-semibold tracking-tight">Global Configurations</h2>
             <div className="space-y-4">
                <div className="p-5 border border-white/10 rounded-2xl bg-white/[0.02]">
                  <h3 className="font-semibold text-white">GitHub Integration Core</h3>
                  <p className="text-sm text-neutral-400 mt-1 mb-4">Connect or remap the primary OAuth Application to a different target.</p>
                  {isAppConfigured ? (
                    <div className="flex space-x-3">
                      <div className="flex items-center text-green-500 text-sm font-medium bg-green-500/10 px-3 rounded-lg border border-green-500/20">
                        Active App Installed
                      </div>
                      <Button variant="outline" className="h-9 hover:bg-white/5 border-white/10" onClick={handleCreateManifest}>Remap Application</Button>
                    </div>
                  ) : (
                    <Button onClick={handleCreateManifest} className="bg-white text-black hover:bg-neutral-200">Connect GitHub Platform</Button>
                  )}
                </div>
                
                <div className="p-5 border border-white/10 rounded-2xl bg-white/[0.02]">
                  <h3 className="font-semibold text-white text-red-500">Danger Zone</h3>
                  <p className="text-sm text-neutral-400 mt-1 mb-4">Purge all platform data and sharing links.</p>
                  <Button variant="destructive" className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 transition-all font-medium">Full Factory Reset</Button>
                </div>
             </div>
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
