"use client"

import { motion } from "framer-motion"
import { Lock, Mail, Shield, Terminal } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { setupPlatform } from "./actions"

export default function SetupForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [passwordMismatch, setPasswordMismatch] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)
    const password = (formData.get("password") as string) || ""
    const confirmPassword = (formData.get("confirmPassword") as string) || ""

    if (password !== confirmPassword) {
      setPasswordMismatch(true)
      toast.error("Passwords do not match")
      return
    }

    setPasswordMismatch(false)
    setIsLoading(true)

    try {
      await setupPlatform(formData)
      window.location.href = "/"
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to initialize platform"
      toast.error(message)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#000508] text-[#5eb8ff] flex items-center justify-center p-4 font-mono screen-scanline selection:bg-[#5eb8ff]/20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-xl z-10"
      >
        <div className="border border-[#5eb8ff]/40 bg-[#000508] p-8 relative">
          <div className="absolute top-0 left-0 w-2 h-full bg-[#5eb8ff]" />

          <div className="flex flex-col items-center text-center space-y-4 mb-8 pl-4">
            <div className="h-16 w-16 border border-[#5eb8ff] flex items-center justify-center text-[#5eb8ff]">
              <Terminal className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-[0.2em] text-[#5eb8ff] uppercase">
                Initialize RepoShare
              </h1>
              <p className="text-[#5eb8ff]/60 text-xs max-w-sm mx-auto mt-3 uppercase tracking-widest leading-relaxed">
                &gt; Create your administrative account to bring the control
                plane online.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 pl-4">
            <div className="space-y-2">
              <label
                htmlFor="setup-email"
                className="text-[10px] uppercase text-[#5eb8ff]/60 tracking-widest block"
              >
                Admin Email:
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-[#5eb8ff]/40" />
                <input
                  id="setup-email"
                  name="email"
                  type="email"
                  required
                  placeholder="admin@example.com"
                  className="w-full bg-[#000508] border border-[#5eb8ff]/40 pl-10 pr-4 py-3 text-[#5eb8ff] placeholder:text-[#5eb8ff]/20 outline-none text-xs tracking-widest focus:border-[#5eb8ff] transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="setup-password"
                  className="text-[10px] uppercase text-[#5eb8ff]/60 tracking-widest block"
                >
                  Admin Password:
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-[#5eb8ff]/40" />
                  <input
                    id="setup-password"
                    name="password"
                    type="password"
                    required
                    placeholder="••••••••"
                    minLength={8}
                    className="w-full bg-[#000508] border border-[#5eb8ff]/40 pl-10 pr-4 py-3 text-[#5eb8ff] placeholder:text-[#5eb8ff]/20 outline-none text-xs tracking-widest focus:border-[#5eb8ff] transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="setup-confirm-password"
                  className="text-[10px] uppercase text-[#5eb8ff]/60 tracking-widest block"
                >
                  Confirm Password:
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-[#5eb8ff]/40" />
                  <input
                    id="setup-confirm-password"
                    name="confirmPassword"
                    type="password"
                    required
                    placeholder="••••••••"
                    minLength={8}
                    className="w-full bg-[#000508] border border-[#5eb8ff]/40 pl-10 pr-4 py-3 text-[#5eb8ff] placeholder:text-[#5eb8ff]/20 outline-none text-xs tracking-widest focus:border-[#5eb8ff] transition-colors"
                  />
                </div>
              </div>
            </div>

            {passwordMismatch ? (
              <div className="border border-red-500/60 bg-red-500/10 px-4 py-3 text-[10px] uppercase tracking-widest text-red-400">
                &gt; Passwords do not match.
              </div>
            ) : null}

            <div className="pt-4 border-t border-[#5eb8ff]/20 mt-6">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#5eb8ff] text-[#000508] hover:bg-[#4ea0e6] h-12 rounded-none font-bold text-xs uppercase tracking-widest transition-all scanline-button"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-[#000508]/30 border-t-[#000508] rounded-full animate-spin" />
                    <span>Configuring Platform...</span>
                  </div>
                ) : (
                  <span>&gt; Create Administrative Account</span>
                )}
              </Button>
            </div>
          </form>

          <div className="mt-8 text-center pl-4">
            <div className="flex items-center justify-center space-x-2 text-[#5eb8ff]/30 text-[10px] uppercase tracking-[0.3em]">
              <Shield className="w-3 h-3" />
              <span>RepoShare v1.0.0</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
