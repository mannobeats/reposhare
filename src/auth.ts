import bcrypt from "bcryptjs"
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { getRequiredAppSecret } from "@/lib/app-secret"
import { prisma } from "@/lib/prisma"

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  return {
    secret: getRequiredAppSecret(),
    trustHost: true,
    providers: [
      Credentials({
        name: "Admin Login",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          if (!credentials?.email || !credentials?.password) return null

          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
          })
          if (!user || !user.passwordHash) return null

          const matchPass = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash,
          )
          if (!matchPass) return null

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          }
        },
      }),
    ],
    callbacks: {
      async session({ session, token }) {
        if (session.user && token.sub) {
          session.user.id = token.sub
        }
        return session
      },
    },
  }
})
