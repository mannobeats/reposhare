"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { auth } from "@/auth"

async function requireUser() {
  const session = await auth()
  if (!session?.user?.email) throw new Error("Unauthorized")
  
  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) throw new Error("User not found")
  
  return user
}

export async function createShareLink(repoFullName: string, installationId: string, expireDays?: number) {
  const user = await requireUser()

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
  const user = await requireUser()
  
  // Verify the share belongs to this user
  const share = await prisma.share.findUnique({ where: { id } })
  if (!share || share.userId !== user.id) throw new Error("Unauthorized")
  
  await prisma.share.update({ where: { id }, data: { active } })
  revalidatePath("/dashboard")
}

export async function deleteShare(id: string) {
  const user = await requireUser()
  
  // Verify the share belongs to this user
  const share = await prisma.share.findUnique({ where: { id } })
  if (!share || share.userId !== user.id) throw new Error("Unauthorized")
  
  await prisma.share.delete({ where: { id } })
  revalidatePath("/dashboard")
}

export async function flushProxies() {
  const user = await requireUser()
  await prisma.share.deleteMany({ where: { userId: user.id } })
  revalidatePath("/dashboard")
}

export async function purgeGitHubToken() {
  const user = await requireUser()
  if (user.role !== "ADMIN") throw new Error("Unauthorized: Admin access required")

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
  
  await prisma.user.updateMany({
    data: { installationId: null }
  })
  
  revalidatePath("/dashboard")
}

export async function terminateAccount() {
  const user = await requireUser()
  
  // Delete all shares first (cascade should handle this, but be explicit)
  await prisma.share.deleteMany({ where: { userId: user.id } })
  await prisma.user.delete({ where: { id: user.id } })
}
