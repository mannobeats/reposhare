"use server"

import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function setupPlatform(formData: FormData) {
  // Guard: do not allow re-initialization once an admin exists
  const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } })
  if (existingAdmin) {
    throw new Error("Platform is already initialized. Cannot re-run setup.")
  }

  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const confirmPassword = formData.get("confirmPassword") as string

  if (!email || !password || !confirmPassword) {
    throw new Error("Admin credentials are required")
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters long")
  }

  if (password !== confirmPassword) {
    throw new Error("Passwords do not match")
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
    update: { publicUrl: null, isSetupComplete: true },
    create: {
      id: "singleton",
      publicUrl: null,
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
