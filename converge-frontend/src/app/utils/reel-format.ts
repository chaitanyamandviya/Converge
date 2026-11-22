import { ReelDeliverable } from '../services/api.service';

const SHORTCODE_SUFFIX_PATTERN = /^((?:Instagram\s+(?:Reel|Post)|Video\s+Post|Carousel\s+Post))(?:\s*[·•\-]\s*[A-Za-z0-9_-]{4,})?$/i;

export function formatReelKindLabel(
  reel?: Partial<ReelDeliverable> | null
): string {
  if (!reel) return 'Instagram Reel';
  const typeUpper = (reel.mediaType || '').toUpperCase();
  if (typeUpper === 'IMAGE' || typeUpper === 'CAROUSEL_ALBUM' || typeUpper === 'FEED') {
    return 'Instagram Post';
  }
  return typeUpper === 'VIDEO' ? 'Video Post' : 'Instagram Reel';
}

export function formatPublishedDateLabel(dateValue?: string | null): string {
  if (!dateValue) return '';
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(parsed);
}

export function formatReelMetaLabel(
  reel?: (Partial<ReelDeliverable> & { publishedAt?: string; timestamp?: string }) | null
): string {
  const kind = formatReelKindLabel(reel);
  const pub = formatPublishedDateLabel(reel?.publishedAt || reel?.timestamp);
  return pub ? `${kind} · Published ${pub}` : kind;
}

/**
 * Returns a clean display title for a tracked Reel/post using its media kind and
 * publish date — never leaking Instagram shortcodes or auto-copied captions.
 */
export function formatReelDisplayTitle(
  reel?: (Partial<ReelDeliverable> & { publishedAt?: string; timestamp?: string }) | null
): string {
  if (!reel) return 'Instagram Reel';
  const rawTitle = (reel.title || '').trim();
  const rawCaption = (reel.caption || '').trim();
  const shortcode = (reel.shortcode || '').trim();
  const typeUpper = (reel.mediaType || '').toUpperCase();
  const isPhoto = typeUpper === 'IMAGE' || typeUpper === 'CAROUSEL_ALBUM' || typeUpper === 'FEED';
  const kind = isPhoto ? 'Instagram Post' : (typeUpper === 'VIDEO' ? 'Video Post' : 'Instagram Reel');
  const published = formatPublishedDateLabel(reel.publishedAt || reel.timestamp);
  const fallback = published ? `${kind} · ${published}` : kind;

  if (!rawTitle) return fallback;
  if (SHORTCODE_SUFFIX_PATTERN.test(rawTitle)) {
    return fallback;
  }
  if (shortcode && (rawTitle.toLowerCase() === shortcode.toLowerCase() || rawTitle.includes(shortcode))) {
    const stripped = rawTitle
      .replace(new RegExp(`\\s*[·•\\-]\\s*${shortcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), '')
      .trim();
    if (!stripped || SHORTCODE_SUFFIX_PATTERN.test(stripped)) {
      return fallback;
    }
    return published ? `${stripped} · ${published}` : stripped;
  }
  if (rawCaption) {
    const normTitle = rawTitle.replace(/\s+/g, ' ').toLowerCase();
    const normCaption = rawCaption.replace(/\s+/g, ' ').toLowerCase();
    if (
      normTitle === normCaption ||
      (normTitle.length >= 16 && normCaption.startsWith(normTitle.slice(0, Math.min(normTitle.length, 40))))
    ) {
      return fallback;
    }
  }
  return rawTitle;
}
