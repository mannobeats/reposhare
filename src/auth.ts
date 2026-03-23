import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import crypto from "crypto"

function getAuthSecret(): string {
  const envSecret = process.env.APP_SECRET
  if (envSecret && envSecret.length >= 32) return envSecret

  if (process.env.NODE_ENV !== "production") {
    return "reposhare-local-dev-secret-change-me"
  }

  const fallbackSeed = `${process.env.PUBLIC_URL || "reposhare"}:${process.cwd()}`
  return crypto.createHash("sha256").update(`reposhare-auth-${fallbackSeed}`).digest("hex")
}

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  let clientId = "UNCONFIGURED"
  let clientSecret = "UNCONFIGURED"
  
  try {
    const config = await prisma.systemConfig.findUnique({ where: { id: "singleton" } })
    if (config && config.appId !== "temp") {
      clientId = config.clientId
      clientSecret = config.clientSecret
    }
  } catch {
    console.warn("Failed to load SystemConfig auth credentials.")
  }

  return {
    secret: getAuthSecret(),
    trustHost: true,
    providers: [
      Credentials({
        name: "Admin Login",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" }
        },
        async authorize(credentials) {
          if (!credentials?.email || !credentials?.password) return null
          
          const user = await prisma.user.findUnique({ where: { email: credentials.email as string } })
          if (!user || (!user.passwordHash)) return null
          
          const matchPass = await bcrypt.compare(credentials.password as string, user.passwordHash)
          if (!matchPass) return null
          
          return { id: user.id, email: user.email, name: user.name, image: user.image }
        }
      }),
      ...(clientId !== "UNCONFIGURED" ? [GitHub({ 
        clientId, 
        clientSecret,
        authorization: { params: { scope: "read:user user:email read:org" } }
      })] : [])
    ],
    callbacks: {
      async signIn({ user, account, profile }) {
        if (account?.provider === "credentials") return true
        
        if (!user.email || !profile) return false
        
        await prisma.user.upsert({
          where: { email: user.email },
          update: {
            name: user.name,
            image: user.image,
            id: profile.id?.toString() || user.id
          },
          create: {
            id: profile.id?.toString() || user.id || "unknown",
            email: user.email,
            name: user.name,
            image: user.image,
          }
        })
        
        return true
      },
      async session({ session, token }) {
        if (session.user && token.sub) {
          session.user.id = token.sub
        }
        return session
      }
    }
  }
})
