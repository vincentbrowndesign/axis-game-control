const DEFAULT_AXIS_AUTH_ORIGIN = "https://ontheaxis.com"

export function getAxisAuthOrigin() {
  return (
    process.env.NEXT_PUBLIC_AXIS_AUTH_ORIGIN?.trim().replace(/\/$/, "") ||
    DEFAULT_AXIS_AUTH_ORIGIN
  )
}

export function getAxisSignInUrl() {
  return `${getAxisAuthOrigin()}/sign-in`
}

export function getAxisSignUpUrl() {
  return `${getAxisAuthOrigin()}/`
}

export function getAxisHomeUrl() {
  return `${getAxisAuthOrigin()}/`
}
