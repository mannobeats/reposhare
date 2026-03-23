"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { auth, signOut } from "@/auth"

export type ActionResult = {
  ok: boolean
  error?: string
  redirectTo?: string
}

function success(redirectTo?: string): ActionResult {
  return { ok: true, redirectTo }
}

function failure(error: string): ActionResult {
  return { ok: false, error }
}

async function requireUser() {
  const session = await auth()
  if (!session?.user?.email) return failure("Your session expired. Please sign in again.")
  
  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return failure("Your account no longer exists. Please sign in again.")
  
  return user as typeof user | ActionResult
}

export async function createShareLink(repoFullName: string, installationId: string, expireDays?: number): Promise<ActionResult> {
  const user = await requireUser()
  if ("ok" in user) return user

  const expiresAt = expireDays ? new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000) : null

  try {
    await prisma.share.create({
      data: {
        userId: user.id,
        repoFullName: repoFullName,
        installationId: String(installationId),
        expiresAt: expiresAt,
      }
    })

    revalidatePath("/dashboard")
    return success()
  } catch {
    return failure("Failed to create the share link.")
  }
}

export async function toggleShareActive(id: string, active: boolean): Promise<ActionResult> {
  const user = await requireUser()
  if ("ok" in user) return user
  
  // Verify the share belongs to this user
  const share = await prisma.share.findUnique({ where: { id } })
  if (!share || share.userId !== user.id) return failure("You cannot modify that share.")
  
  try {
    await prisma.share.update({ where: { id }, data: { active } })
    revalidatePath("/dashboard")
    return success()
  } catch {
    return failure("Failed to update the share.")
  }
}

export async function deleteShare(id: string): Promise<ActionResult> {
  const user = await requireUser()
  if ("ok" in user) return user
  
  // Verify the share belongs to this user
  const share = await prisma.share.findUnique({ where: { id } })
  if (!share || share.userId !== user.id) return failure("You cannot delete that share.")
  
  try {
    await prisma.share.delete({ where: { id } })
    revalidatePath("/dashboard")
    return success()
  } catch {
    return failure("Failed to delete the share.")
  }
}

export async function flushProxies(): Promise<ActionResult> {
  const user = await requireUser()
  if ("ok" in user) return user

  try {
    await prisma.share.deleteMany({ where: { userId: user.id } })
    revalidatePath("/dashboard")
    return success()
  } catch {
    return failure("Failed to flush active proxies.")
  }
}

export async function purgeGitHubToken(): Promise<ActionResult> {
  const user = await requireUser()
  if ("ok" in user) return user
  if (user.role !== "ADMIN") return failure("Admin access is required.")

  try {
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
    return success()
  } catch {
    return failure("Failed to reset the GitHub app configuration.")
  }
}

export async function terminateAccount(): Promise<ActionResult> {
  const user = await requireUser()
  if ("ok" in user) return user
  
  try {
    await prisma.share.deleteMany({ where: { userId: user.id } })
    await prisma.user.delete({ where: { id: user.id } })
    await signOut({ redirect: false })
    return success("/")
  } catch {
    return failure("Failed to delete the account.")
  }
}
