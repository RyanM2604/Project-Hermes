import { getPublicAppOrigin } from "@/lib/public-origin";

export function isUWaterlooEmail(email: string) {
  return /^[^@\s]+@uwaterloo\.ca$/i.test(email.trim());
}

export function isValidPassword(password: string) {
  return password.length >= 8;
}

export function getSafeRedirectPath(value: string | null) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/events";
  }

  const baseUrl = getPublicAppOrigin();
  const redirectUrl = new URL(value, baseUrl);

  if (redirectUrl.origin !== baseUrl) {
    return "/events";
  }

  return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
}
