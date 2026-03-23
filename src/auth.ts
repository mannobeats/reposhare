import NextAuth from "next-auth"
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
      })
    ],
    callbacks: {
      async session({ session, token }) {
        if (session.user && token.sub) {
          session.user.id = token.sub
        }
        return session
      }
    }
  }
})
