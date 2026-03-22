"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Github, Globe, Mail, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { setupPlatform } from "./actions"
import { toast } from "sonner"

export default function SetupPage() {
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    
    const formData = new FormData(e.currentTarget)
    try {
      await setupPlatform(formData)
      // Redirects to Home page for login
      window.location.href = "/"
    } catch (err: any) {
      toast.error(err.message || "Failed to initialize platform")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 selection:bg-neutral-800">
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-neutral-900 via-black to-black pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-xl z-10"
      >
        <div className="bg-neutral-950/50 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl relative">
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-white/5 rounded-full blur-[100px]" />
          
          <div className="flex flex-col items-center text-center space-y-4 mb-8">
            <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center text-black shadow-[0_0_40px_rgba(255,255,255,0.2)]">
              <Github className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-medium tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                Initialize RepoShare Workspace
              </h1>
              <p className="text-neutral-400 text-sm max-w-sm mx-auto mt-2">
                Create your administrative account and configure your platform network settings.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-neutral-300">Public Domain URL (Optional)</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-3 h-5 w-5 text-neutral-500" />
                <Input 
                  name="publicUrl"
                  placeholder="https://reposhare.my-domain.com" 
                  className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-neutral-600 focus-visible:ring-1 focus-visible:ring-white/30 rounded-xl"
                />
              </div>
              <p className="text-xs text-neutral-500">Leaving this empty or using localhost will disable GitHub Webhook syncing.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-neutral-300">Admin Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-neutral-500" />
                  <Input 
                    name="email"
                    type="email"
                    required
                    placeholder="admin@example.com" 
                    className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-neutral-600 focus-visible:ring-1 focus-visible:ring-white/30 rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-neutral-300">Admin Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-neutral-500" />
                  <Input 
                    name="password"
                    type="password"
                    required
                    placeholder="••••••••" 
                    minLength={8}
                    className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-neutral-600 focus-visible:ring-1 focus-visible:ring-white/30 rounded-xl"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 mt-6">
              <Button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-white text-black hover:bg-neutral-200 h-12 rounded-xl font-medium text-base transition-all duration-300 active:scale-[0.98]"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    <span>Configuring Platform...</span>
                  </div>
                ) : (
                  <span>Create Administrative Account</span>
                )}
              </Button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
