import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { auth, signIn } from "@/auth"
import { Terminal } from "lucide-react"
import { AuthError } from "next-auth"

export const dynamic = "force-dynamic"

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const config = await prisma.systemConfig.findUnique({ where: { id: "singleton" } })
  if (!config?.isSetupComplete) {
    redirect("/setup")
  }

  const session = await auth()
  if (session?.user) {
    redirect("/dashboard")
  }

  const params = await searchParams
  const loginError = params.error === "credentials" ? "Invalid email or password." : null

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4 screen-scanline">
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(var(--primary)_1px,transparent_1px)]" style={{ backgroundSize: '100% 4px' }} />

      <main className="z-10 flex flex-col items-center max-w-2xl px-6 w-full relative">
        <div className="mb-12 flex flex-col items-center">
          <Terminal className="w-16 h-16 text-primary mb-6 animate-pulse" />
          <h1 className="text-4xl md:text-5xl font-bold tracking-[0.2em] mb-4 text-primary uppercase text-center">
            RepoShare
          </h1>
          <p className="text-sm text-primary/70 max-w-lg leading-relaxed uppercase tracking-widest text-center">
            &gt; Securely share private repositories via proxy tunnels.
          </p>
        </div>

        <div className="w-full max-w-sm space-y-8">
          <form action={async (formData) => {
            "use server"
            try {
              await signIn("credentials", formData)
            } catch (error) {
              if (error instanceof AuthError && error.type === "CredentialsSignin") {
                redirect("/?error=credentials")
              }

              throw error
            }
          }} className="space-y-6 p-8 border border-primary/40 bg-background shadow-[0_0_30px_rgba(94,184,255,0.05)] relative">
            <div className="absolute top-0 left-0 w-2 h-full bg-primary" />
            
            <h2 className="text-sm font-bold text-primary mb-6 uppercase tracking-widest flex items-center">
              Admin Login
            </h2>
            
            <div className="space-y-4">
              {loginError ? (
                <div className="border border-red-500/60 bg-red-500/10 px-4 py-3 text-[10px] uppercase tracking-widest text-red-400">
                  &gt; {loginError}
                </div>
              ) : null}

              <div>
                <label className="text-[10px] uppercase text-primary/60 tracking-widest block mb-2">Email:</label>
                <input 
                  name="email" 
                  type="email" 
                  placeholder="admin@example.com" 
                  required 
                  className="w-full bg-background border border-primary/40 px-4 py-3 placeholder:text-primary/30 outline-none text-primary uppercase tracking-widest font-bold focus:border-primary transition-colors text-xs"
                />
              </div>
              
              <div>
                <label className="text-[10px] uppercase text-primary/60 tracking-widest block mb-2">Password:</label>
                <input 
                  name="password" 
                  type="password" 
                  placeholder="••••••••" 
                  required 
                  className="w-full bg-background border border-primary/40 px-4 py-3 placeholder:text-primary/30 outline-none text-primary uppercase tracking-widest font-bold focus:border-primary transition-colors text-xs"
                />
              </div>
            </div>

            <button className="w-full bg-primary text-background font-bold py-4 uppercase tracking-widest text-xs hover:bg-[#4ea0e6] transition-all scanline-button mt-4">
              Authenticate
            </button>
          </form>
        </div>

        <div className="mt-20 w-full flex flex-col items-center">
           <span className="text-[10px] text-primary/40 tracking-[0.3em] uppercase block mb-2">SYSTEM STATUS: ONLINE</span>
           <span className="text-[10px] text-primary/40 tracking-[0.3em] uppercase">RepoShare v1.0.0</span>
        </div>
      </main>
    </div>
  )
}
