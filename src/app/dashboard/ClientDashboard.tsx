"use client"

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Github, Lock, Globe, Loader2, Link2, Copy, Trash, Pause, Play, Activity, Terminal, Database, ShieldAlert, Cpu, Settings, User, Search, Save } from "lucide-react"
import { createShareLink, toggleShareActive, deleteShare, flushProxies, purgeGitHubToken, terminateAccount, updatePublicUrlOverride } from "./actions"
import { toast } from "sonner"
import { formatDistanceToNow, format } from "date-fns"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import type { ActionResult } from "./actions"
import type { BaseUrlDetails } from "@/lib/base-url"

interface Props {
  baseUrl: string
  baseUrlDetails: BaseUrlDetails
  userId: string
  isAppConfigured: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  installations: Record<string, any>[]
  appSlug: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  repositories: Record<string, any>[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  shares: Record<string, any>[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  analyticsData: Record<string, any>[]
}

export default function ClientDashboard({ baseUrl, baseUrlDetails, userId, isAppConfigured, installations, appSlug, repositories, shares, analyticsData }: Props) {
  const [creating, setCreating] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"connections" | "shares" | "analytics" | "system">("connections")
  const [searchQuery, setSearchQuery] = useState("")
  const [publicUrlInput, setPublicUrlInput] = useState(baseUrlDetails.overrideUrl)
  const [savingPublicUrl, setSavingPublicUrl] = useState(false)

  const [modalState, setModalState] = useState<{ isOpen: boolean, actionFn: (() => Promise<ActionResult>) | null, warningText: string, successMessage: string }>({
    isOpen: false,
    actionFn: null,
    warningText: "",
    successMessage: "",
  })

  useEffect(() => {
    setPublicUrlInput(baseUrlDetails.overrideUrl)
  }, [baseUrlDetails.overrideUrl])

  const chartData = useMemo(() => {
    const buckets: Record<string, number> = {}
    analyticsData.forEach(event => {
      const day = format(new Date(event.createdAt), "MMM d")
      buckets[day] = (buckets[day] || 0) + event._count
    })
    
    return Object.entries(buckets).map(([date, views]) => ({ date, views }))
  }, [analyticsData])

  const filteredRepositories = repositories.filter(repo => 
    repo.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateManifest = () => window.location.href = "/api/github/manifest-redirect"
  const handleInstallApp = () => window.location.href = `https://github.com/apps/${appSlug}/installations/new`

  const handleShare = async (repoName: string, installationId: string) => {
    try {
      setCreating(repoName)
      const result = await createShareLink(repoName, installationId, 7)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success("Repository matrix link established")
    } catch {
      toast.error("Failed to create the share link")
    } finally {
      setCreating(null)
    }
  }

  const handleToggleShare = async (id: string, active: boolean) => {
    const result = await toggleShareActive(id, active)
    if (!result.ok) {
      toast.error(result.error)
    }
  }

  const handleDeleteShare = async (id: string) => {
    const result = await deleteShare(id)
    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success("Share deleted")
  }

  const handleCopyLink = (id: string) => {
    const link = `${baseUrl}/share/${id}`
    navigator.clipboard.writeText(link)
    toast.success("Data-stream copied to memory buffer")
  }

  const tabs = [
    { id: "connections", label: "GITHUB_CONNECTIONS", icon: Database },
    { id: "shares", label: "ACTIVE_PROXY_LINKS", icon: Terminal },
    { id: "analytics", label: "TELEMETRY", icon: Activity },
    { id: "system", label: "SYSTEM_DIAGNOSTICS", icon: Settings },
  ] as const

  const promptDestructiveAction = (actionFn: () => Promise<ActionResult>, warningText: string, successMessage: string) => {
    setModalState({ isOpen: true, actionFn, warningText, successMessage })
  }

  const confirmAction = async () => {
    if (modalState.actionFn) {
      try {
        const result = await modalState.actionFn()
        if (!result.ok) {
          toast.error(result.error)
          return
        }

        toast.success(modalState.successMessage)
        if (result.redirectTo) {
          window.location.href = result.redirectTo
        }
      } catch {
        toast.error("Execution failed: Authorization required or system locked")
      } finally {
        setModalState((current) => ({ ...current, isOpen: false }))
      }
    }
  }

  const handleSavePublicUrl = async () => {
    try {
      setSavingPublicUrl(true)
      const result = await updatePublicUrlOverride(publicUrlInput)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(publicUrlInput.trim() ? "Public URL override saved" : "Public URL override cleared")
      window.location.reload()
    } catch {
      toast.error("Failed to update the public URL")
    } finally {
      setSavingPublicUrl(false)
    }
  }

  return (
    <div className="space-y-12 font-mono text-primary">
      {/* Alert Modal Overlay */}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-background border border-red-500 max-w-md w-full p-6 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
            <div className="flex items-center space-x-3 mb-6">
              <ShieldAlert className="w-8 h-8 text-red-500 animate-pulse" />
              <h3 className="text-red-500 font-bold uppercase tracking-widest text-lg">Critical Override</h3>
            </div>
            <div className="mb-8">
               <p className="text-red-500/80 text-xs uppercase tracking-widest leading-relaxed">
                 WARNING: {modalState.warningText}
               </p>
               <p className="text-red-500/80 text-xs uppercase tracking-widest leading-relaxed mt-4 font-bold">
                 THIS ACTION IS PERMANENT. PROCEED WITH SYSTEM DESTRUCTION?
               </p>
            </div>
            <div className="flex items-center space-x-4">
              <Button onClick={() => setModalState({ ...modalState, isOpen: false })} className="flex-1 bg-transparent border border-primary text-primary hover:bg-primary hover:text-background rounded-none uppercase tracking-widest text-xs h-12 font-bold transition-all">
                ABORT SEQUENCE
              </Button>
              <Button onClick={confirmAction} className="flex-1 bg-red-500 border border-red-500 text-white hover:bg-red-600 hover:border-red-600 rounded-none uppercase tracking-widest text-xs h-12 font-bold transition-all">
                CONFIRM DELETION
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Top Terminal Header Component */}
      <div className="flex border border-[#5eb8ff]/40 bg-[#000508] relative overflow-hidden screen-scanline">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center space-x-3 px-6 py-4 text-xs tracking-widest transition-colors ${
              activeTab === tab.id 
                ? "bg-[#5eb8ff] text-[#000508] font-bold scanline-active" 
                : "text-[#5eb8ff]/70 hover:bg-[#5eb8ff]/20"
            }`}
          >
            <tab.icon className={`${activeTab === tab.id ? 'w-4 h-4' : 'w-4 h-4'}`} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "connections" && (
          <motion.div key="connections" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-8">
             <div className="flex justify-between items-end border-b border-[#5eb8ff]/40 pb-4">
                <div>
                  <h2 className="text-xl text-[#5eb8ff] tracking-widest flex items-center">
                    <Cpu className="w-5 h-5 mr-3" /> System Architecture
                  </h2>
                </div>
             </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Master Config Card */}
                <div className="p-6 border border-[#5eb8ff]/40 bg-[#000508]">
                  <h3 className="text-xs text-[#5eb8ff] tracking-widest mb-6 flex items-center uppercase">
                    <ShieldAlert className="w-4 h-4 mr-2" /> Master GitHub Node
                  </h3>
                  {isAppConfigured ? (
                    <div className="space-y-6">
                      <div className="flex items-center text-xs bg-[#5eb8ff]/20 text-[#5eb8ff] px-4 py-3 border border-[#5eb8ff]/40 uppercase tracking-widest">
                        <div className="w-2 h-2 bg-[#5eb8ff] mr-3" />
                        Secure GitHub Manifest Bound
                      </div>
                      <Button className="w-full h-12 text-xs tracking-widest border border-[#5eb8ff] text-[#5eb8ff] bg-transparent hover:bg-[#5eb8ff] hover:text-[#000508] rounded-none scanline-button uppercase" onClick={handleCreateManifest}>
                        &gt; RECREATE MASTER GITHUB APP
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                       <p className="text-xs text-[#5eb8ff]/70 leading-relaxed uppercase tracking-wide">&gt; No Master GitHub App detected. You must create the initial System GitHub Application to begin generating proxies.</p>
                       <Button className="w-full h-12 border border-[#5eb8ff] bg-[#5eb8ff] text-[#000508] text-xs font-bold hover:bg-[#4ea0e6] rounded-none scanline-button uppercase tracking-widest" onClick={handleCreateManifest}>
                         &gt; BIND MASTER GITHUB APP
                       </Button>
                    </div>
                  )}
                </div>

                {/* Installations List Card */}
                <div className="p-6 border border-[#5eb8ff]/40 bg-[#000508] flex flex-col">
                  <h3 className="text-xs text-[#5eb8ff] tracking-widest mb-6 flex items-center uppercase">
                    <Globe className="w-4 h-4 mr-2" /> Installed GitHub Accounts
                  </h3>

                  {!isAppConfigured ? (
                     <div className="flex-1 flex items-center justify-center text-xs text-[#5eb8ff]/40 text-center p-4 border border-dashed border-[#5eb8ff]/40 uppercase">
                       &gt; WAITING FOR MASTER APP CONFIG
                     </div>
                  ) : (
                    <div className="flex-1 flex flex-col space-y-4">
                      {installations.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-[#5eb8ff]/40 bg-[#5eb8ff]/10 p-4 text-center">
                           <p className="text-xs text-[#5eb8ff]/70 mb-4 uppercase tracking-widest">&gt; NO LINKED GITHUB ACCOUNTS</p>
                           <Button onClick={handleInstallApp} className="border border-[#5eb8ff] bg-[#5eb8ff] text-[#000508] hover:bg-[#4ea0e6] text-xs h-10 px-6 rounded-none tracking-widest uppercase">
                              &gt; LINK GITHUB ACCOUNT ORG
                           </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-col space-y-3 overflow-y-auto max-h-[160px] custom-scrollbar pr-2">
                            {installations.map(inst => (
                              <div key={inst.id} className="flex items-center justify-between p-3 border border-[#5eb8ff]/40 bg-[#5eb8ff]/5">
                                <div className="flex items-center space-x-3">
                                  {inst.avatar ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={inst.avatar} alt="org" className="w-8 h-8 border border-[#5eb8ff]/60" style={{ filter: 'sepia(100%) hue-rotate(180deg) saturate(300%) opacity(0.8)' }} />
                                  ) : (
                                    <div className="w-8 h-8 border border-[#5eb8ff]/60 flex justify-center items-center"><Github className="w-4 h-4 text-[#5eb8ff]" /></div>
                                  )}
                                  <div>
                                    <h4 className="text-sm font-bold text-[#5eb8ff]">{inst.accountName}</h4>
                                    <span className="text-[10px] text-[#5eb8ff]/60 uppercase tracking-widest">{inst.type}</span>
                                  </div>
                                </div>
                                <span className="text-[#000508] text-[10px] font-bold tracking-widest uppercase px-2 py-1 bg-[#5eb8ff]">CONNECTED</span>
                              </div>
                            ))}
                          </div>
                          <Button onClick={handleInstallApp} className="w-full border border-[#5eb8ff]/60 bg-transparent text-[#5eb8ff] hover:bg-[#5eb8ff] hover:text-[#000508] text-[10px] h-10 rounded-none mt-auto tracking-widest uppercase font-bold">
                            + CONNECT ANOTHER ACCOUNT
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
             </div>
          </motion.div>
        )}

        {activeTab === "shares" && (
          <motion.div key="shares" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-12">
            
            {/* Active Proxies Section */}
            <section className="space-y-6">
              <div className="border-b border-[#5eb8ff]/40 pb-4">
                <h2 className="text-xl tracking-widest text-[#5eb8ff] uppercase">&gt; Active Proxy Endpoints</h2>
              </div>

              {shares.length === 0 ? (
                <div className="p-12 border border-dashed border-[#5eb8ff]/40 flex flex-col items-center justify-center text-center space-y-4 bg-[#5eb8ff]/5">
                  <Link2 className="w-8 h-8 text-[#5eb8ff]/50" />
                  <p className="text-[#5eb8ff]/70 text-xs tracking-widest uppercase">&gt; 0 ACTIVE STREAMS CONFIGURED</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {shares.map(share => (
                    <div key={share.id} className="relative p-5 bg-[#000508] border border-[#5eb8ff]/40 transition-colors flex flex-col md:flex-row justify-between md:items-center space-y-4 md:space-y-0 relative">
                      <div className={`absolute top-0 left-0 w-2 h-full ${share.active ? "bg-[#5eb8ff]" : "bg-[#000508] border-r border-[#5eb8ff]/40"}`} />
                      
                      <div className="pl-4">
                        <div className="flex flex-col">
                           <h4 className="text-[#5eb8ff] font-bold text-base tracking-wide flex items-center">
                             <span className="text-[#5eb8ff]/50 mr-2">SYS_ID:</span> {share.repoFullName}
                           </h4>
                           <div className="text-xs text-[#5eb8ff]/70 tracking-widest uppercase mt-2 flex items-center space-x-4">
                             <span className="flex items-center">
                               {share.expiresAt ? `TTL: ${formatDistanceToNow(new Date(share.expiresAt))}` : "TTL: INFINITE"}
                             </span>
                             <span className="flex items-center text-[#5eb8ff] bg-[#5eb8ff]/20 px-2 py-0.5 border border-[#5eb8ff]/30">
                               {share._count.analytics} HITS
                             </span>
                           </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 pl-4">
                        <Button variant="outline" size="sm" onClick={() => handleCopyLink(share.id)} className="h-9 rounded-none border-[#5eb8ff]/50 text-[#5eb8ff] bg-transparent hover:bg-[#5eb8ff] hover:text-[#000508] font-bold uppercase text-[10px] tracking-widest">
                          <Copy className="w-3 h-3 mr-2" /> BUFFER URI
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => handleToggleShare(share.id, !share.active)} className={`h-9 w-9 rounded-none border-[#5eb8ff]/50 bg-transparent ${share.active ? "text-[#5eb8ff] hover:bg-[#5eb8ff] hover:text-[#000508]" : "text-[#5eb8ff]/40 hover:text-[#5eb8ff]"}`}>
                          {share.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => handleDeleteShare(share.id)} className="h-9 w-9 rounded-none border-[#5eb8ff]/50 text-[#5eb8ff]/50 bg-transparent hover:bg-[#5eb8ff] hover:text-[#000508]">
                          <Trash className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Repositories Matrix List */}
            <section className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#5eb8ff]/40 pb-4 space-y-4 md:space-y-0">
                <h2 className="text-xl text-[#5eb8ff] tracking-widest uppercase">&gt; Available Matrices [{repositories.length}]</h2>
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#5eb8ff]/50" />
                  <input
                    type="text"
                    placeholder="SEARCH PROTOCOLS..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#000508] border border-[#5eb8ff]/40 text-[#5eb8ff] placeholder:text-[#5eb8ff]/30 pl-10 pr-4 py-2 text-xs tracking-widest uppercase outline-none focus:border-[#5eb8ff]"
                  />
                </div>
              </div>

              {repositories.length === 0 ? (
                <div className="p-8 border border-dashed border-[#5eb8ff]/40 text-center flex flex-col items-center justify-center bg-[#5eb8ff]/5">
                   <p className="text-[#5eb8ff]/60 text-xs tracking-widest uppercase">&gt; NO TARGET REPOSITORIES MAPPED WITHIN ACTIVE NODES</p>
                </div>
              ) : filteredRepositories.length === 0 ? (
                <div className="p-8 border border-dashed border-[#5eb8ff]/40 text-center flex flex-col items-center justify-center bg-[#5eb8ff]/5">
                   <p className="text-[#5eb8ff]/60 text-xs tracking-widest uppercase">&gt; QUERY YIELDED ZERO RESULTS</p>
                </div>
              ) : (
                <div className="flex flex-col border border-[#5eb8ff]/40 bg-[#000508]">
                  <div className="flex items-center px-4 py-3 border-b border-[#5eb8ff]/40 bg-[#5eb8ff] text-[#000508] font-bold tracking-widest text-[10px] uppercase">
                     <span className="w-16">STATUS</span>
                     <span className="flex-1">IDENTIFIER</span>
                     <span className="w-48 text-right">ACTION COMMAND</span>
                  </div>
                  <div className="flex flex-col max-h-[500px] overflow-y-auto custom-scrollbar">
                    {filteredRepositories.map((repo, idx) => (
                      <div key={repo.id} className={`flex items-center px-4 py-3 hover:bg-[#5eb8ff]/10 transition-colors ${idx !== filteredRepositories.length - 1 ? 'border-b border-[#5eb8ff]/20' : ''}`}>
                         <span className="w-16">
                           <span className={`${repo.private ? 'text-amber-400' : 'text-[#5eb8ff]'} text-[10px] uppercase font-bold tracking-widest flex items-center`}>
                             {repo.private ? <Lock className="w-3 h-3 mr-1" /> : <Globe className="w-3 h-3 mr-1" />}
                           </span>
                         </span>
                         
                         <span className="flex-1 text-sm tracking-wide text-[#5eb8ff] truncate pr-4">
                           {repo.full_name}
                         </span>
                         
                         <span className="w-48 text-right">
                           <Button 
                             onClick={() => handleShare(repo.full_name, repo.installation_id)}
                             disabled={creating === repo.full_name}
                             className="h-8 px-4 rounded-none border border-[#5eb8ff] bg-transparent text-[#5eb8ff] hover:bg-[#5eb8ff] hover:text-[#000508] uppercase text-[10px] tracking-widest font-bold"
                           >
                             {creating === repo.full_name ? <Loader2 className="w-3 h-3 animate-spin" /> : "GEN TUNNEL"}
                           </Button>
                         </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </motion.div>
        )}

        {activeTab === "analytics" && (
           <motion.div key="analytics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-6">
             <div className="border-b border-[#5eb8ff]/40 pb-4">
                <h2 className="text-xl text-[#5eb8ff] tracking-widest uppercase flex items-center">&gt; Telemetry Output</h2>
             </div>
             
             <div className="border border-[#5eb8ff]/40 p-6 bg-[#000508] relative">
               <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(94,184,255,0.1)_1px,transparent_1px)]" style={{ backgroundSize: '100% 4px' }} />
               {chartData.length === 0 ? (
                 <div className="h-[400px] flex items-center justify-center text-[#5eb8ff]/50 text-xs tracking-widest uppercase animate-pulse">
                   &lt; / WAITING FOR INBOUND TELEMETRY &gt;
                 </div>
               ) : (
                 <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#5eb8ff" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#5eb8ff" stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(94, 184, 255, 0.2)" vertical={false} />
                        <XAxis dataKey="date" stroke="#5eb8ff" strokeOpacity={0.8} fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#5eb8ff" strokeOpacity={0.8} fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#000508', borderColor: 'rgba(94, 184, 255, 0.5)', borderRadius: '0px', fontSize: '12px' }}
                          itemStyle={{ color: '#5eb8ff' }}
                          cursor={{ stroke: 'rgba(94, 184, 255, 0.5)', strokeWidth: 1, strokeDasharray: "5 5" }}
                        />
                        <Area type="step" dataKey="views" name="Bandwidth" stroke="#5eb8ff" strokeWidth={2} fillOpacity={1} fill="url(#colorViews)" />
                      </AreaChart>
                    </ResponsiveContainer>
                 </div>
               )}
             </div>
           </motion.div>
        )}

        {activeTab === "system" && (
           <motion.div key="system" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-8 max-w-2xl">
             <div className="border-b border-[#5eb8ff]/40 pb-4">
                <h2 className="text-xl text-[#5eb8ff] tracking-widest uppercase">&gt; System Configuration</h2>
             </div>

             <div className="p-6 border border-[#5eb8ff]/40 bg-[#000508]">
                <h3 className="text-xs text-[#5eb8ff] tracking-widest mb-6 flex items-center uppercase">
                  <User className="w-4 h-4 mr-2" /> Administrator Profile
                </h3>
                <div className="flex items-center space-x-6">
                  <div className="w-16 h-16 border border-[#5eb8ff]/60 bg-[#5eb8ff]/10 flex items-center justify-center text-[#5eb8ff]">
                     <Terminal className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-[#5eb8ff] tracking-widest font-bold">OPERATOR ID: {userId.substring(0,8).toUpperCase()}</h4>
                    <p className="text-[#5eb8ff]/50 text-xs tracking-widest uppercase mt-1">ACCESS LEVEL: OMNI_ADMIN</p>
                  </div>
                </div>
             </div>

             <div className="p-6 border border-[#5eb8ff]/40 bg-[#000508] space-y-6">
                <h3 className="text-xs text-[#5eb8ff] tracking-widest flex items-center uppercase">
                  <Globe className="w-4 h-4 mr-2" /> Network Identity
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border border-[#5eb8ff]/30 bg-[#5eb8ff]/5 p-4">
                    <div className="text-[10px] uppercase tracking-widest text-[#5eb8ff]/50">Active URL</div>
                    <div className="mt-2 text-xs text-[#5eb8ff] break-all">{baseUrlDetails.activeUrl}</div>
                  </div>
                  <div className="border border-[#5eb8ff]/30 bg-[#5eb8ff]/5 p-4">
                    <div className="text-[10px] uppercase tracking-widest text-[#5eb8ff]/50">Source</div>
                    <div className="mt-2 text-xs text-[#5eb8ff] uppercase tracking-widest">
                      {baseUrlDetails.source === "override" ? "Dashboard Override" : baseUrlDetails.source === "environment" ? "Installer / Environment" : "Request Detection"}
                    </div>
                  </div>
                  <div className="border border-[#5eb8ff]/30 bg-[#5eb8ff]/5 p-4">
                    <div className="text-[10px] uppercase tracking-widest text-[#5eb8ff]/50">Detected URL</div>
                    <div className="mt-2 text-xs text-[#5eb8ff] break-all">{baseUrlDetails.detectedUrl}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-[#5eb8ff]/60 block">
                    Dashboard URL Override
                  </label>
                  <input
                    type="text"
                    value={publicUrlInput}
                    onChange={(e) => setPublicUrlInput(e.target.value)}
                    placeholder={baseUrlDetails.envUrl || baseUrlDetails.detectedUrl}
                    className="w-full bg-[#000508] border border-[#5eb8ff]/40 px-4 py-3 text-[#5eb8ff] placeholder:text-[#5eb8ff]/20 outline-none text-xs tracking-widest focus:border-[#5eb8ff] transition-colors"
                  />
                  <p className="text-[10px] text-[#5eb8ff]/45 uppercase tracking-wider leading-relaxed">
                    Leave this blank to use the installer URL or the detected request URL. Save a value here if you move RepoShare to a new domain and want to update links from the dashboard.
                  </p>
                </div>

                <div className="space-y-3 border border-[#5eb8ff]/20 bg-[#5eb8ff]/5 p-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-[#5eb8ff]/50">Installer / Environment URL</div>
                    <div className="mt-2 text-xs text-[#5eb8ff] break-all">{baseUrlDetails.envUrl || "Not set"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-[#5eb8ff]/50">Saved Dashboard Override</div>
                    <div className="mt-2 text-xs text-[#5eb8ff] break-all">{baseUrlDetails.overrideUrl || "Not set"}</div>
                  </div>
                </div>

                <Button
                  onClick={handleSavePublicUrl}
                  disabled={savingPublicUrl}
                  className="w-full h-12 rounded-none border border-[#5eb8ff] bg-[#5eb8ff] text-[#000508] hover:bg-[#4ea0e6] uppercase tracking-widest text-xs font-bold"
                >
                  {savingPublicUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  {savingPublicUrl ? "SAVING..." : "SAVE NETWORK URL"}
                </Button>
             </div>

             <div className="p-6 border border-[#5eb8ff]/40 bg-[#000508]">
                <h3 className="text-xs text-[#5eb8ff] tracking-widest mb-4 flex items-center uppercase text-red-500">
                  <ShieldAlert className="w-4 h-4 mr-2" /> Destructive Protocols
                </h3>
                <p className="text-xs text-[#5eb8ff]/60 mb-6 leading-relaxed uppercase tracking-wider">
                  Warning: Executive overrides below will permanently flush proxy routing tables and revoke authentication tokens without recovery.
                </p>
                <div className="space-y-4">
                  <Button 
                    variant="outline" 
                    onClick={() => promptDestructiveAction(flushProxies, "THIS WILL DELETE ALL ACTIVE PROXY TUNNELS AND REVOKE ACCESS.", "All proxies flushed successfully")}
                    className="w-full justify-start h-12 rounded-none border-red-500/40 text-red-500 bg-transparent hover:bg-red-500 hover:text-white uppercase tracking-widest text-xs font-bold"
                  >
                    [EXECUTE] FLUSH ALL ACTIVE PROXIES
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => promptDestructiveAction(purgeGitHubToken, "THIS WILL PURGE GITHUB MASTER TOKENS AND DISCONNECT ALL ORGS.", "GitHub Tokens Purged. Re-auth required.")}
                    className="w-full justify-start h-12 rounded-none border-red-500/40 text-red-500 bg-transparent hover:bg-red-500 hover:text-white uppercase tracking-widest text-xs font-bold"
                  >
                    [EXECUTE] PURGE GITHUB OAUTH TOKEN
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => promptDestructiveAction(terminateAccount, "THIS WILL DELETE YOUR ACCOUNT COMPLETELY AND KICK YOU OFFLINE.", "Account terminated. Session closed.")}
                    className="w-full justify-start h-12 rounded-none border-red-500 text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white uppercase tracking-widest text-xs font-bold"
                  >
                    [CRITICAL] TERMINATE ROOT ACCOUNT
                  </Button>
                </div>
             </div>

           </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(94, 184, 255, 0.05); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(94, 184, 255, 0.4); }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(94, 184, 255, 0.8); }

        .scanline-active {
           background-image: repeating-linear-gradient(transparent, transparent 1px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 2px);
           background-size: 100% 4px;
        }

        .scanline-button {
           background-image: repeating-linear-gradient(transparent, transparent 2px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 4px);
           background-size: 100% 4px;
        }

        .screen-scanline::after {
           content: " ";
           display: block;
           position: absolute;
           top: 0;
           left: 0;
           bottom: 0;
           right: 0;
           background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
           z-index: 2;
           background-size: 100% 4px, 6px 100%;
           pointer-events: none;
        }
      `}</style>
    </div>
  )
}
