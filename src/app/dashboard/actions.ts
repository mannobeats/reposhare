"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { auth } from "@/auth"

export async function createShareLink(repoFullName: string, installationId: string, expireDays?: number) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const user = await prisma.user.findUnique({ where: { email: session.user.email! } })
  if (!user) throw new Error("User not found")

  const expiresAt = expireDays ? new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000) : null

  await prisma.share.create({
    data: {
      userId: user.id,
      repoFullName: repoFullName,
      installationId: String(installationId),
      expiresAt: expiresAt,
    }
  })

  revalidatePath("/dashboard")
}

export async function toggleShareActive(id: string, active: boolean) {
  await prisma.share.update({ where: { id }, data: { active } })
  revalidatePath("/dashboard")
}

export async function deleteShare(id: string) {
  await prisma.share.delete({ where: { id } })
  revalidatePath("/dashboard")
}

export async function flushProxies() {
  const session = await auth()
  if (!session?.user?.email) throw new Error("Unauthorized")
  
  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) throw new Error("User not found")

  await prisma.share.deleteMany({ where: { userId: user.id } })
  revalidatePath("/dashboard")
}

export async function purgeGitHubToken() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  // Reset SystemConfig strictly to unconfigured state
  await prisma.systemConfig.update({
    where: { id: "singleton" },
    data: {
      appId: "temp",
      clientId: "",
      clientSecret: "",
      webhookSecret: "",
      privateKey: ""
    }
  })
  
  // Wipe internal installation mapping
  await prisma.user.updateMany({
    data: { installationId: null }
  })
  
  revalidatePath("/dashboard")
}

export async function terminateAccount() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  
  await prisma.user.delete({ where: { id: session.user.id } })
  // Wiping the account forces a standard logout natively upon next middleware check
}
