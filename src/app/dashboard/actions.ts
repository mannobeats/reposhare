"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { auth } from "@/auth"

export async function createShareLink(repoFullName: string, expireDays?: number) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const user = await prisma.user.findUnique({ where: { email: session.user.email! } })
  if (!user?.installationId) throw new Error("GitHub App not installed")

  const expiresAt = expireDays ? new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000) : null

  await prisma.share.create({
    data: {
      userId: user.id,
      repoFullName: repoFullName,
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
