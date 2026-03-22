"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Github, Server, Lock, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function SetupPage() {
  const [isLoading, setIsLoading] = useState(false)

  const handleSetup = async () => {
    setIsLoading(true)
    // Redirects to API route which then redirects to GitHub Manifest Flow
    window.location.href = "/api/github/manifest-redirect"
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
        <div className="bg-neutral-950/50 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl overflow-hidden relative">
          {/* Subtle glow effect */}
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-white/5 rounded-full blur-[100px]" />
          
          <div className="flex flex-col items-center text-center space-y-6 relative z-10">
            <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center text-black shadow-[0_0_40px_rgba(255,255,255,0.2)]">
              <Github className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-3xl font-medium tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                Initialize GitShare Workspace
              </h1>
              <p className="text-neutral-400 text-sm max-w-sm mx-auto">
                No environment variables required. Link your domain cleanly and natively with a single click.
              </p>
            </div>

            <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-3 py-6">
              {[
                { icon: Zap, text: "Zero Configuration" },
                { icon: Lock, text: "End-to-End Encrypted" },
                { icon: Server, text: "Self-Hosted Edge" }
              ].map((item, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="bg-white/5 rounded-xl p-4 flex flex-col items-center justify-center space-y-2 border border-white/5"
                >
                  <item.icon className="w-5 h-5 text-neutral-300" />
                  <span className="text-xs text-neutral-400 font-medium">{item.text}</span>
                </motion.div>
              ))}
            </div>

            <div className="w-full pt-4 border-t border-white/10">
              <Button 
                onClick={handleSetup} 
                disabled={isLoading}
                className="w-full bg-white text-black hover:bg-neutral-200 h-12 rounded-xl font-medium text-sm transition-all duration-300 active:scale-[0.98]"
              >
                {isLoading ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center space-x-2"
                  >
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    <span>Preparing Environment...</span>
                  </motion.div>
                ) : (
                  <span>Register GitHub Application</span>
                )}
              </Button>
            </div>
          </div>
        </div>
        
        <p className="text-center text-xs text-neutral-600 mt-6 font-medium">
          Automatically configures OAuth and Webhook endpoints.
        </p>
      </motion.div>
    </div>
  )
}
