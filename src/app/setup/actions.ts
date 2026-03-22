"use server"

import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function setupPlatform(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const publicUrl = formData.get("publicUrl") as string | null

  if (!email || !password) {
    throw new Error("Admin credentials are required")
  }

  // Pre-hash password safely
  const passwordHash = await bcrypt.hash(password, 10)

  // Configure first admin wrapper
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "ADMIN" },
    create: { email, passwordHash, role: "ADMIN", name: "Administrator" }
  })

  // Start initializing SystemConfig block to hold target URLs and setup state natively
  await prisma.systemConfig.upsert({
    where: { id: "singleton" },
    update: { publicUrl, isSetupComplete: true },
    create: {
      id: "singleton",
      publicUrl,
      isSetupComplete: true,
      appId: "temp",
      clientId: "temp",
      clientSecret: "temp",
      webhookSecret: "temp",
      privateKey: "temp",
    }
  })

  return { success: true }
}
