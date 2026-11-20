const TITLE_REWRITES: Record<string, string> = {
  'Genesis Workspace Provisioning': 'Brand Created',
  'Brand Workspace Updated': 'Brand Details Updated',
  'Direct Creator Associated': 'Creator Added',
  'Instagram Reel Verified': 'Reel Verified',
  'Reel Queued for Meta Sync': 'Reel Saved',
  'Creator Profile & Rate Updated': 'Creator Details Updated',
  'Creator Instagram Sync': 'Creator Stats Refreshed',
  'Instagram OAuth Connected': 'Creator Account Connected',
  'Live API Deliverables Sync': 'Reels Refreshed'
};

export function formatAuditTitle(rawTitle?: string | null): string {
  const t = (rawTitle || '').trim();
  if (!t) return 'Activity';
  return TITLE_REWRITES[t] || t;
}

export function formatAuditSummary(rawDesc?: string | null): string {
  let d = (rawDesc || '').trim();
  if (!d) return '';
  d = d
    .replace(/\s+via\s+META_[A-Z_]+/gi, '')
    .replace(/\s*\(PENDING_META_API\)/gi, '')
    .replace(/\s*\(META_[A-Z_]+\)/gi, '')
    .replace(/\s+with live Meta profile metrics\s*/gi, ' ')
    .replace(/Updated non-metric CRM\s*\/\s*commercial metadata/gi, 'Updated profile and rate details')
    .replace(/reach\/views/gi, 'views')
    .replace(/Brand workspace\s+[A-Z]+-\d+\s+provisioned and assigned directly to\s+/gi, 'Workspace assigned to ')
    .replace(/Brand profile metadata updated/gi, 'Updated brand details')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return d;
}
