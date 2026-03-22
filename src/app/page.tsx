import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { auth, signIn } from "@/auth"
import { Github, Code, Terminal, Combine } from "lucide-react"

export default async function LandingPage() {
  const config = await prisma.systemConfig.findUnique({ where: { id: "singleton" } })
  if (!config?.isSetupComplete) {
    redirect("/setup")
  }

  const session = await auth()
  if (session?.user) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900 via-black to-black opacity-60" />

      <main className="z-10 flex flex-col items-center text-center max-w-2xl px-6">
        <div className="mb-8 p-3 rounded-2xl bg-white/5 border border-white/10 ring-1 ring-white/5 shadow-2xl backdrop-blur-xl">
          <Combine className="w-12 h-12 text-white" />
        </div>
        
        <h1 className="text-5xl font-semibold tracking-tighter mb-4">
          RepoShare <span className="text-neutral-500">Platform</span>
        </h1>
        
        <p className="text-lg text-neutral-400 mb-10 max-w-lg leading-relaxed font-medium">
          A secure, self-hosted proxy for selectively sharing private GitHub repositories natively through web interfaces and terminal environments.
        </p>

        <div className="w-full max-w-sm space-y-4">
          <form action={async (formData) => {
            "use server"
            await signIn("credentials", formData)
          }} className="space-y-4 p-6 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl">
            <h2 className="text-xl font-medium text-white mb-2 text-left">Admin Login</h2>
            <input 
              name="email" 
              type="email" 
              placeholder="Email Address" 
              required 
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 placeholder:text-neutral-600 focus:ring-1 focus:ring-white/20 outline-none transition-all"
            />
            <input 
              name="password" 
              type="password" 
              placeholder="Password" 
              required 
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 placeholder:text-neutral-600 focus:ring-1 focus:ring-white/20 outline-none transition-all"
            />
            <button className="w-full bg-white text-black font-medium py-3 rounded-xl hover:bg-neutral-200 active:scale-95 transition-all">
              Sign In to Dashboard
            </button>
          </form>

          <form action={async () => {
            "use server"
            await signIn("github")
          }}>
            <button className="group relative flex items-center justify-center space-x-3 w-full py-4 bg-transparent border border-white/10 hover:bg-white/5 text-white rounded-2xl font-medium transition-all hover:scale-[1.02] active:scale-[0.98]">
              <Github className="w-5 h-5 text-neutral-400 group-hover:text-white transition-colors" />
              <span>Continue with GitHub</span>
            </button>
          </form>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6 w-full text-left">
          <div className="space-y-2 p-5 rounded-2xl bg-white/[0.02] border border-white/5">
            <Code className="w-5 h-5 text-neutral-400 mb-3" />
            <h3 className="font-medium text-white">Browser Proxying</h3>
            <p className="text-sm text-neutral-500">Read READMEs and download fully authenticated ZIP packages transparently.</p>
          </div>
          <div className="space-y-2 p-5 rounded-2xl bg-white/[0.02] border border-white/5">
            <Terminal className="w-5 h-5 text-neutral-400 mb-3" />
            <h3 className="font-medium text-white">Native CLI Integration</h3>
            <p className="text-sm text-neutral-500">Execute direct <code>git clone</code> commands on generated links without credentials.</p>
          </div>
        </div>
      </main>
    </div>
  )
}
