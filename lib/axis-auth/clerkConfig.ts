export function hasValidClerkPublishableKey() {
  return /^pk_(test|live)_/.test(
    (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "").trim()
  )
}

export function hasValidClerkSecretKey() {
  return /^sk_(test|live)_/.test((process.env.CLERK_SECRET_KEY || "").trim())
}

export function hasValidClerkServerConfig() {
  return hasValidClerkPublishableKey() && hasValidClerkSecretKey()
}
