const MIN_APP_SECRET_LENGTH = 32

export function getRequiredAppSecret() {
  const secret = process.env.APP_SECRET?.trim()

  if (!secret || secret.length < MIN_APP_SECRET_LENGTH) {
    throw new Error(
      `APP_SECRET must be set and at least ${MIN_APP_SECRET_LENGTH} characters long.`,
    )
  }

  return secret
}
