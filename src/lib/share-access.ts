import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { cookies } from "next/headers"
import { NextRequest } from "next/server"

type ShareAccessResult = {
  ok: boolean
  reason?: "missing-password" | "invalid-password"
}

type ProtectedShare = {
  id: string
  passwordHash: string | null
}

const SHARE_ACCESS_COOKIE_PREFIX = "reposhare-share-access"
const SHARE_ACCESS_DURATION_SECONDS = 60 * 60 * 12

function getJwtSecret() {
  return process.env.APP_SECRET || process.env.PUBLIC_URL || process.cwd()
}

export function getShareAccessCookieName(shareId: string) {
  return `${SHARE_ACCESS_COOKIE_PREFIX}-${shareId}`
}

export function getShareRepoName(repoFullName: string) {
  return repoFullName.split("/")[1] || "repository"
}

export function buildShareClonePath(baseUrl: string, shareId: string, repoFullName: string) {
  const repoName = getShareRepoName(repoFullName)
  return `${baseUrl}/share/${shareId}/${repoName}.git`
}

function createShareAccessToken(shareId: string) {
  return jwt.sign({ shareId }, getJwtSecret(), {
    expiresIn: SHARE_ACCESS_DURATION_SECONDS,
  })
}

function verifyShareAccessToken(token: string, shareId: string) {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { shareId?: string }
    return decoded.shareId === shareId
  } catch {
    return false
  }
}

function parseBasicAuthPassword(headerValue: string | null) {
  if (!headerValue?.startsWith("Basic ")) return ""

  try {
    const decoded = Buffer.from(headerValue.slice(6), "base64").toString("utf8")
    const separatorIndex = decoded.indexOf(":")
    if (separatorIndex === -1) return ""
    return decoded.slice(separatorIndex + 1)
  } catch {
    return ""
  }
}

async function hasCookieAccess(shareId: string) {
  const cookieStore = await cookies()
  const token = cookieStore.get(getShareAccessCookieName(shareId))?.value
  if (!token) return false
  return verifyShareAccessToken(token, shareId)
}

export async function verifyShareBrowserAccess(share: ProtectedShare): Promise<ShareAccessResult> {
  if (!share.passwordHash) {
    return { ok: true }
  }

  const allowed = await hasCookieAccess(share.id)
  return allowed ? { ok: true } : { ok: false, reason: "missing-password" }
}

export async function verifyShareRequestAccess(req: NextRequest, share: ProtectedShare): Promise<ShareAccessResult> {
  if (!share.passwordHash) {
    return { ok: true }
  }

  const cookieToken = req.cookies.get(getShareAccessCookieName(share.id))?.value
  if (cookieToken && verifyShareAccessToken(cookieToken, share.id)) {
    return { ok: true }
  }

  const password = parseBasicAuthPassword(req.headers.get("authorization"))
  if (!password) {
    return { ok: false, reason: "missing-password" }
  }

  const matches = await bcrypt.compare(password, share.passwordHash)
  if (!matches) {
    return { ok: false, reason: "invalid-password" }
  }

  return { ok: true }
}

export async function unlockBrowserShareAccess(shareId: string, passwordHash: string, password: string) {
  const matches = await bcrypt.compare(password, passwordHash)
  if (!matches) return false

  const cookieStore = await cookies()
  cookieStore.set(getShareAccessCookieName(shareId), createShareAccessToken(shareId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SHARE_ACCESS_DURATION_SECONDS,
    path: "/",
  })

  return true
}
