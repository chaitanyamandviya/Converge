import { ReelDeliverable } from '../services/api.service';

/**
 * Returns a clean display title for a tracked Reel/post without leaking long
 * auto-copied Instagram captions across dashboard headings, legends, or charts.
 */
export function formatReelDisplayTitle(reel?: Partial<ReelDeliverable> | null): string {
  if (!reel) return 'Instagram Reel';
  const rawTitle = (reel.title || '').trim();
  const rawCaption = (reel.caption || '').trim();
  const shortcode = (reel.shortcode || '').trim();
  const typeUpper = (reel.mediaType || '').toUpperCase();
  const isPhoto = typeUpper === 'IMAGE' || typeUpper === 'CAROUSEL_ALBUM' || typeUpper === 'FEED';
  const kind = isPhoto ? 'Instagram Post' : (typeUpper === 'VIDEO' ? 'Video Post' : 'Instagram Reel');
  const fallback = shortcode ? `${kind} · ${shortcode}` : kind;

  if (!rawTitle) return fallback;
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
