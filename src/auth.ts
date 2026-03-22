import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  let clientId = "UNCONFIGURED"
  let clientSecret = "UNCONFIGURED"
  
  try {
    const config = await prisma.systemConfig.findUnique({ where: { id: "singleton" } })
    if (config) {
      clientId = config.clientId
      clientSecret = config.clientSecret
    }
  } catch (e) {
    console.warn("Failed to load SystemConfig auth credentials.")
  }

  return {
    secret: process.env.NEXTAUTH_SECRET || "super_secret_fallback_do_not_use_in_prod",
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
          
          const mathPass = await bcrypt.compare(credentials.password as string, user.passwordHash)
          if (!mathPass) return null
          
          return { id: user.id, email: user.email, name: user.name, image: user.image }
        }
      }),
      GitHub({ 
        clientId, 
        clientSecret,
        authorization: { params: { scope: "read:user user:email read:org" } } // minimal scope, repo scope handled by app installation
      })
    ],
    callbacks: {
      async signIn({ user, account, profile }) {
        if (account?.provider === "credentials") return true
        
        if (!user.email || !profile) return false
        
        // Custom syncing to avoid needing full heavy NextAuth adapters
        await prisma.user.upsert({
          where: { email: user.email },
          update: {
            name: user.name,
            image: user.image,
            // we use the github profile string ID mapping
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
