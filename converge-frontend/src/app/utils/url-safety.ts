const INSTAGRAM_HOSTS = new Set([
  'instagram.com',
  'www.instagram.com',
  'm.instagram.com',
  'instagr.am'
]);

/**
 * Validates external URLs before binding to [href] so unsafe schemes (e.g. javascript:, data:)
 * or spoofed Instagram links are never rendered as clickable links.
 */
export function safeExternalUrl(rawUrl: string | null | undefined, requireInstagramHost = false): string | null {
  const raw = String(rawUrl || '').trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (requireInstagramHost) {
      if (parsed.protocol !== 'https:' || !INSTAGRAM_HOSTS.has(parsed.hostname.toLowerCase())) {
        return null;
      }
      return parsed.toString();
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
