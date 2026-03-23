import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import SetupForm from "./SetupForm"

export const dynamic = "force-dynamic"

export default async function SetupPage() {
  // Guard: if already configured with a real admin, redirect to login
  const config = await prisma.systemConfig.findUnique({ where: { id: "singleton" } })
  if (config?.isSetupComplete) {
    const adminExists = await prisma.user.findFirst({ where: { role: "ADMIN" } })
    if (adminExists) {
      redirect("/")
    }
  }

  return <SetupForm />
}
