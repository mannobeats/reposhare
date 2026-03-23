"use server"

import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { auth, signOut } from "@/auth"
import { normalizePublicUrl } from "@/lib/base-url"
import { prisma } from "@/lib/prisma"

export type ActionResult = {
  ok: boolean
  error?: string
  redirectTo?: string
  shareId?: string
}

function success(redirectTo?: string, shareId?: string): ActionResult {
  return { ok: true, redirectTo, shareId }
}

function failure(error: string): ActionResult {
  return { ok: false, error }
}

async function requireUser() {
  const session = await auth()
  if (!session?.user?.email)
    return failure("Your session expired. Please sign in again.")

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  })
  if (!user)
    return failure("Your account no longer exists. Please sign in again.")

  return user as typeof user | ActionResult
}

export type ShareOptionsInput = {
  repoFullName: string
  installationId: string
  expiresInDays?: number | null
  password?: string
  allowGitClone?: boolean
  allowZipDownload?: boolean
}

export async function createShareLink(
  options: ShareOptionsInput,
): Promise<ActionResult> {
  const user = await requireUser()
  if ("ok" in user) return user

  if (options.allowGitClone === false && options.allowZipDownload === false) {
    return failure("Enable at least one access method for the share.")
  }

  if (options.password?.trim() && options.password.trim().length < 4) {
    return failure("Share passwords must be at least 4 characters long.")
  }

  const expiresAt = options.expiresInDays
    ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
    : null
  const passwordHash = options.password?.trim()
    ? await bcrypt.hash(options.password.trim(), 10)
    : null

  try {
    const share = await prisma.share.create({
      data: {
        userId: user.id,
        repoFullName: options.repoFullName,
        installationId: String(options.installationId),
        expiresAt,
        passwordHash,
        allowGitClone: options.allowGitClone ?? true,
        allowZipDownload: options.allowZipDownload ?? true,
      },
    })

    revalidatePath("/dashboard")
    return success(undefined, share.id)
  } catch {
    return failure("Failed to create the share link.")
  }
}

export type ShareUpdateInput = {
  id: string
  expiresInDays?: number | null
  password?: string
  clearPassword?: boolean
  allowGitClone?: boolean
  allowZipDownload?: boolean
}

export async function toggleShareActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const user = await requireUser()
  if ("ok" in user) return user

  // Verify the share belongs to this user
  const share = await prisma.share.findUnique({ where: { id } })
  if (!share || share.userId !== user.id)
    return failure("You cannot modify that share.")

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
  if (!share || share.userId !== user.id)
    return failure("You cannot delete that share.")

  try {
    await prisma.share.delete({ where: { id } })
    revalidatePath("/dashboard")
    return success()
  } catch {
    return failure("Failed to delete the share.")
  }
}

export async function updateShareSettings(
  input: ShareUpdateInput,
): Promise<ActionResult> {
  const user = await requireUser()
  if ("ok" in user) return user

  const share = await prisma.share.findUnique({ where: { id: input.id } })
  if (!share || share.userId !== user.id)
    return failure("You cannot modify that share.")

  if (input.allowGitClone === false && input.allowZipDownload === false) {
    return failure("Enable at least one access method for the share.")
  }

  if (input.password?.trim() && input.password.trim().length < 4) {
    return failure("Share passwords must be at least 4 characters long.")
  }

  const nextPasswordHash = input.clearPassword
    ? null
    : input.password?.trim()
      ? await bcrypt.hash(input.password.trim(), 10)
      : undefined

  try {
    await prisma.share.update({
      where: { id: input.id },
      data: {
        expiresAt: input.expiresInDays
          ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
          : null,
        allowGitClone: input.allowGitClone ?? share.allowGitClone,
        allowZipDownload: input.allowZipDownload ?? share.allowZipDownload,
        ...(nextPasswordHash !== undefined
          ? { passwordHash: nextPasswordHash }
          : {}),
      },
    })
    revalidatePath("/dashboard")
    revalidatePath(`/share/${input.id}`, "layout")
    return success()
  } catch {
    return failure("Failed to update the share settings.")
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
        privateKey: "",
      },
    })

    await prisma.user.updateMany({
      data: { installationId: null },
    })

    revalidatePath("/dashboard")
    return success()
  } catch {
    return failure("Failed to reset the GitHub app configuration.")
  }
}

export async function updatePublicUrlOverride(
  publicUrl: string,
): Promise<ActionResult> {
  const user = await requireUser()
  if ("ok" in user) return user
  if (user.role !== "ADMIN") return failure("Admin access is required.")

  const trimmed = publicUrl.trim()
  const normalized = trimmed ? normalizePublicUrl(trimmed) : null

  try {
    await prisma.systemConfig.upsert({
      where: { id: "singleton" },
      update: { publicUrl: normalized },
      create: {
        id: "singleton",
        publicUrl: normalized,
        isSetupComplete: true,
        appId: "temp",
        clientId: "temp",
        clientSecret: "temp",
        webhookSecret: "temp",
        privateKey: "temp",
      },
    })

    revalidatePath("/")
    revalidatePath("/dashboard")
    return success()
  } catch {
    return failure("Failed to update the public URL.")
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
