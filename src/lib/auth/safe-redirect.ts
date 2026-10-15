// Guards every post-auth redirect target that can be influenced by a URL
// query param (an invite link's "sign in, then come back here" flow) against
// becoming an open redirect. Only a same-site relative path is ever allowed:
// no absolute URL, no protocol-relative "//host" path, no backslash variant
// a browser would still treat as protocol-relative.
export function safeRedirectPath(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
