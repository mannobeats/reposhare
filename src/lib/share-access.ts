import crypto from "node:crypto"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { cookies, headers } from "next/headers"
import type { NextRequest } from "next/server"
import { getRequiredAppSecret } from "@/lib/app-secret"

type ShareAccessResult = {
  ok: boolean
  reason?: "missing-password" | "invalid-password" | "rate-limited"
}

type ProtectedShare = {
  id: string
  passwordHash: string | null
}

const SHARE_ACCESS_COOKIE_PREFIX = "reposhare-share-access"
const SHARE_ACCESS_DURATION_SECONDS = 60 * 60 * 12
const PASSWORD_ATTEMPT_WINDOW_MS = 15 * 60 * 1000
const PASSWORD_ATTEMPT_BLOCK_MS = 15 * 60 * 1000
const PASSWORD_ATTEMPT_MAX_FAILURES = 8

type PasswordAttemptState = {
  blockedUntil: number
  failures: number
  windowStartedAt: number
}

const passwordAttemptState = new Map<string, PasswordAttemptState>()

export function getShareAccessCookieName(shareId: string) {
  return `${SHARE_ACCESS_COOKIE_PREFIX}-${shareId}`
}

export function getShareRepoName(repoFullName: string) {
  return repoFullName.split("/")[1] || "repository"
}

export function buildShareClonePath(
  baseUrl: string,
  shareId: string,
  repoFullName: string,
) {
  const repoName = getShareRepoName(repoFullName)
  return `${baseUrl}/share/${shareId}/${repoName}.git`
}

function createShareAccessBinding(shareId: string, passwordHash: string) {
  return crypto
    .createHmac("sha256", getRequiredAppSecret())
    .update(`${shareId}:${passwordHash}`)
    .digest("hex")
}

function createShareAccessToken(share: ProtectedShare) {
  return jwt.sign(
    {
      shareId: share.id,
      binding: share.passwordHash
        ? createShareAccessBinding(share.id, share.passwordHash)
        : null,
    },
    getRequiredAppSecret(),
    {
      expiresIn: SHARE_ACCESS_DURATION_SECONDS,
    },
  )
}

function verifyShareAccessToken(token: string, share: ProtectedShare) {
  if (!share.passwordHash) {
    return false
  }

  try {
    const decoded = jwt.verify(token, getRequiredAppSecret()) as {
      binding?: string
      shareId?: string
    }

    return (
      decoded.shareId === share.id &&
      decoded.binding === createShareAccessBinding(share.id, share.passwordHash)
    )
  } catch {
    return false
  }
}

function getClientAddress(
  source:
    | Pick<Headers, "get">
    | {
        get(name: string): string | null
      },
) {
  const forwardedFor = source.get("x-forwarded-for")
  if (forwardedFor) {
    const forwardedClient = forwardedFor
      .split(",")
      .map((value) => value.trim())
      .find(Boolean)

    if (forwardedClient) {
      return forwardedClient
    }
  }

  return (
    source.get("x-real-ip") ||
    source.get("cf-connecting-ip") ||
    "unknown-client"
  )
}

function getPasswordAttemptKey(shareId: string, clientAddress: string) {
  return `${shareId}:${clientAddress}`
}

function isPasswordAttemptAllowed(shareId: string, clientAddress: string) {
  const attemptKey = getPasswordAttemptKey(shareId, clientAddress)
  const state = passwordAttemptState.get(attemptKey)
  const now = Date.now()

  if (!state) {
    return true
  }

  if (state.blockedUntil > now) {
    return false
  }

  if (now - state.windowStartedAt > PASSWORD_ATTEMPT_WINDOW_MS) {
    passwordAttemptState.delete(attemptKey)
    return true
  }

  return true
}

function recordPasswordFailure(shareId: string, clientAddress: string) {
  const attemptKey = getPasswordAttemptKey(shareId, clientAddress)
  const now = Date.now()
  const currentState = passwordAttemptState.get(attemptKey)

  if (
    !currentState ||
    now - currentState.windowStartedAt > PASSWORD_ATTEMPT_WINDOW_MS
  ) {
    passwordAttemptState.set(attemptKey, {
      blockedUntil: 0,
      failures: 1,
      windowStartedAt: now,
    })
    return
  }

  const failures = currentState.failures + 1
  passwordAttemptState.set(attemptKey, {
    blockedUntil:
      failures >= PASSWORD_ATTEMPT_MAX_FAILURES
        ? now + PASSWORD_ATTEMPT_BLOCK_MS
        : currentState.blockedUntil,
    failures,
    windowStartedAt: currentState.windowStartedAt,
  })
}

function clearPasswordFailures(shareId: string, clientAddress: string) {
  passwordAttemptState.delete(getPasswordAttemptKey(shareId, clientAddress))
}

export async function getServerActionClientAddress() {
  const headerStore = await headers()
  return getClientAddress(headerStore)
}

async function hasCookieAccess(share: ProtectedShare) {
  if (!share.passwordHash) {
    return false
  }

  const cookieStore = await cookies()
  const token = cookieStore.get(getShareAccessCookieName(share.id))?.value
  if (!token) return false
  return verifyShareAccessToken(token, share)
}

export function getExpectedShareRepoSlug(repoFullName: string) {
  return getShareRepoName(repoFullName).replace(/\.git$/, "")
}

export function isExpectedShareRepoSlug(
  requestedRepo: string,
  repoFullName: string,
) {
  return (
    requestedRepo.replace(/\.git$/, "") ===
    getExpectedShareRepoSlug(repoFullName)
  )
}

export function createCanonicalSharePath(
  shareId: string,
  repoFullName: string,
) {
  return `/share/${shareId}/${getExpectedShareRepoSlug(repoFullName)}`
}

export function createCanonicalShareGitPath(
  shareId: string,
  repoFullName: string,
) {
  return `${createCanonicalSharePath(shareId, repoFullName)}.git`
}

export async function verifyShareBrowserAccess(
  share: ProtectedShare,
): Promise<ShareAccessResult> {
  if (!share.passwordHash) {
    return { ok: true }
  }

  const allowed = await hasCookieAccess(share)
  return allowed ? { ok: true } : { ok: false, reason: "missing-password" }
}

export async function verifyShareRequestAccess(
  req: NextRequest,
  share: ProtectedShare,
): Promise<ShareAccessResult> {
  if (!share.passwordHash) {
    return { ok: true }
  }

  const cookieToken = req.cookies.get(getShareAccessCookieName(share.id))?.value
  if (cookieToken && verifyShareAccessToken(cookieToken, share)) {
    return { ok: true }
  }

  const clientAddress = getClientAddress(req.headers)
  if (!isPasswordAttemptAllowed(share.id, clientAddress)) {
    return { ok: false, reason: "rate-limited" }
  }

  const password = parseBasicAuthPassword(req.headers.get("authorization"))
  if (!password) {
    return { ok: false, reason: "missing-password" }
  }

  const matches = await bcrypt.compare(password, share.passwordHash)
  if (!matches) {
    recordPasswordFailure(share.id, clientAddress)
    return { ok: false, reason: "invalid-password" }
  }

  clearPasswordFailures(share.id, clientAddress)
  return { ok: true }
}

export async function unlockBrowserShareAccess(
  share: ProtectedShare,
  password: string,
  clientAddress: string,
) {
  if (!share.passwordHash) {
    return { ok: false, reason: "missing-password" } as ShareAccessResult
  }

  if (!isPasswordAttemptAllowed(share.id, clientAddress)) {
    return { ok: false, reason: "rate-limited" } as ShareAccessResult
  }

  const matches = await bcrypt.compare(password, share.passwordHash)
  if (!matches) {
    recordPasswordFailure(share.id, clientAddress)
    return { ok: false, reason: "invalid-password" } as ShareAccessResult
  }

  clearPasswordFailures(share.id, clientAddress)

  const cookieStore = await cookies()
  cookieStore.set(
    getShareAccessCookieName(share.id),
    createShareAccessToken(share),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: SHARE_ACCESS_DURATION_SECONDS,
      path: "/",
    },
  )

  return { ok: true } as ShareAccessResult
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
