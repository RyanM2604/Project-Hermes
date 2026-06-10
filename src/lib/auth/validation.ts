export function isUWaterlooEmail(email: string) {
  return /^[^@\s]+@uwaterloo\.ca$/i.test(email.trim());
}

export function getSafeRedirectPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.includes("\\")) {
    return "/events";
  }

  const baseUrl = "https://hermes.local";
  const redirectUrl = new URL(value, baseUrl);

  if (redirectUrl.origin !== baseUrl) {
    return "/events";
  }

  return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
}
