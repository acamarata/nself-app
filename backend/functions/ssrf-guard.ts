// Purpose: SSRF prevention — validate outbound URLs against an allowlist
// Inputs: url string to validate
// Outputs: throws Error if URL is blocked; returns void if allowed
// Constraints: Must block RFC 1918, loopback, link-local, metadata service IPs
// SPORT: F08 notify-dispatch SSRF surface

const ALLOWED_HOSTS = [
  'fcm.googleapis.com',
  'fcm.google.com',
  'api.push.apple.com',
  'api.sandbox.push.apple.com',
];

const BLOCKED_IP_PATTERNS = [
  /^127\./,                                             // loopback
  /^10\./,                                              // RFC 1918 class A
  /^172\.(1[6-9]|2[0-9]|3[01])\./,                    // RFC 1918 class B
  /^192\.168\./,                                        // RFC 1918 class C
  /^169\.254\./,                                        // link-local / AWS metadata
  /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./,  // CGNAT
  /^::1$/,                                              // IPv6 loopback
  /^fc00:/,                                             // IPv6 ULA
  /^fe80:/,                                             // IPv6 link-local
];

export function validateOutboundUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`SSRF_GUARD: invalid URL: ${url}`);
  }

  // Only allow https
  if (parsed.protocol !== 'https:') {
    throw new Error(`SSRF_GUARD: only https URLs allowed, got: ${parsed.protocol}`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // Check against allowlist
  if (!ALLOWED_HOSTS.includes(hostname)) {
    throw new Error(`SSRF_GUARD: host not in allowlist: ${hostname}`);
  }

  // Block IP addresses that match RFC 1918 / loopback / metadata patterns
  for (const pattern of BLOCKED_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new Error(`SSRF_GUARD: blocked IP range: ${hostname}`);
    }
  }
}
