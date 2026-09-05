// Keep the existing policy and add only Clerk's documented resource hosts.
export function withClerkCsp(policy, publishableKey) {
  let origin = "https://clerk.rapidcv.app";
  if (publishableKey) {
    try {
      const host = atob(publishableKey.replace(/^pk_(test|live)_/, "")).replace(/\$$/, "");
      if (/^[a-z0-9.-]+$/i.test(host)) origin = `https://${host}`;
    } catch { /* The frontend build validates its publishable key. */ }
  }
  const additions = {
    "script-src": `${origin} https://challenges.cloudflare.com https://*.protect.clerk.com`,
    "connect-src": `${origin} https://*.protect.clerk.com:*`,
    "img-src": "https://img.clerk.com",
    "frame-src": "https://challenges.cloudflare.com https://*.protect.clerk.com",
  };
  return policy.split(";").map(part => {
    const directive = part.trim().split(/\s+/)[0];
    return additions[directive] ? `${part.trim()} ${additions[directive]}` : part.trim();
  }).filter(Boolean).join("; ") + "; worker-src 'self' blob:";
}
