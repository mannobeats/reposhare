import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "")
}

export function normalizePublicUrl(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return ""

  const withProtocol = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  const url = new URL(withProtocol)

  return stripTrailingSlash(url.toString())
}

export async function getConfiguredPublicUrl() {
  const envUrl = process.env.PUBLIC_URL?.trim()
  if (envUrl) return normalizePublicUrl(envUrl)

  const config = await prisma.systemConfig.findUnique({ where: { id: "singleton" } })
  if (config?.publicUrl?.trim()) return normalizePublicUrl(config.publicUrl)

  return ""
}

export async function getRequestBaseUrl() {
  const headersList = await headers()
  const host = headersList.get("x-forwarded-host") || headersList.get("host") || "localhost:3417"
  const proto = headersList.get("x-forwarded-proto") || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https")

  return `${proto}://${host}`
}

export async function getCanonicalBaseUrl() {
  return (await getConfiguredPublicUrl()) || stripTrailingSlash(await getRequestBaseUrl())
}
