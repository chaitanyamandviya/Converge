export interface ParsedBulkReelRow {
  rowNum: number;
  reelUrl: string;
  creatorHandle: string;
  title: string;
  costQuoted: string;
  campaignTag: string;
  valid: boolean;
  reason?: string;
}

const IG_URL_PATTERN = /^https:\/\/(?:www\.|m\.)?instagram\.com\/(?:([A-Za-z0-9._]{1,30})\/)?(?:p|reels?|tv)\/([A-Za-z0-9_-]{4,64})(?:\/|\?|$)/i;
const HEADER_START_PATTERN = /^(?:url|reel_url|reelurl|instagram_url|instagram_link|link)\b/i;

export function extractInstagramShortcodeClient(rawUrl: string): string | null {
  const m = rawUrl.trim().match(IG_URL_PATTERN);
  return m ? m[2] : null;
}

export function extractOwnerFromInstagramUrlClient(rawUrl: string): string {
  const m = rawUrl.trim().match(IG_URL_PATTERN);
  if (!m || !m[1]) return '';
  return '@' + m[1].toLowerCase();
}

function splitRowColumns(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map(s => s.trim());
  if (line.includes('|')) return line.split('|').map(s => s.trim());
  // Split CSV respecting quotes
  const cols: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      cols.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  cols.push(cur.trim());
  return cols;
}

/**
 * Parses pasted lines or CSV rows into validated bulk import entries.
 * Supported row formats:
 *   1. https://www.instagram.com/reel/...
 *   2. https://www.instagram.com/@handle/reel/...
 *   3. url, @handle, title, cost, campaignTag
 */
export function parseBulkReelLines(rawText: string, hasDefaultCreator = false): ParsedBulkReelRow[] {
  if (!rawText || !rawText.trim()) return [];
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rows: ParsedBulkReelRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const cols = splitRowColumns(lines[i]);
    if (cols.length === 0) continue;

    // Skip CSV header rows gracefully
    if (i === 0 && HEADER_START_PATTERN.test(cols[0].replace(/^"|"$/g, ''))) {
      continue;
    }

    const reelUrl = (cols[0] || '').trim();
    const shortcode = extractInstagramShortcodeClient(reelUrl);
    if (!shortcode) {
      rows.push({
        rowNum: i + 1,
        reelUrl,
        creatorHandle: cols[1] || '',
        title: cols[2] || '',
        costQuoted: cols[3] || '',
        campaignTag: cols[4] || '',
        valid: false,
        reason: 'Invalid public https://www.instagram.com/reel/... or /p/... URL'
      });
      continue;
    }

    let creatorHandle = (cols[1] || '').trim().replace(/^@+/, '');
    if (!creatorHandle) {
      creatorHandle = extractOwnerFromInstagramUrlClient(reelUrl).replace(/^@+/, '');
    }
    if (creatorHandle && !/^[a-zA-Z0-9._]{1,30}$/.test(creatorHandle)) {
      rows.push({
        rowNum: i + 1,
        reelUrl,
        creatorHandle,
        title: cols[2] || '',
        costQuoted: cols[3] || '',
        campaignTag: cols[4] || '',
        valid: false,
        reason: `Invalid creator handle "@${creatorHandle}"`
      });
      continue;
    }

    const formattedHandle = creatorHandle ? '@' + creatorHandle.toLowerCase() : '';
    if (!formattedHandle && !hasDefaultCreator) {
      rows.push({
        rowNum: i + 1,
        reelUrl,
        creatorHandle: '',
        title: cols[2] || '',
        costQuoted: cols[3] || '',
        campaignTag: cols[4] || '',
        valid: false,
        reason: 'Pick a default creator or include @handle in CSV'
      });
      continue;
    }

    // Flexible optional column parsing: if col[1] was numeric cost on 2-col input? Wait: keep strict positional: url, handle, title, cost, campaign
    const title = (cols[2] || '').trim();
    const rawCost = (cols[3] || '').replace(/[,₹$\s]/g, '').trim();
    if (rawCost && (Number.isNaN(Number(rawCost)) || Number(rawCost) <= 0)) {
      rows.push({
        rowNum: i + 1,
        reelUrl,
        creatorHandle: formattedHandle,
        title,
        costQuoted: rawCost,
        campaignTag: (cols[4] || '').trim(),
        valid: false,
        reason: 'Cost must be a positive number'
      });
      continue;
    }

    rows.push({
      rowNum: i + 1,
      reelUrl,
      creatorHandle: formattedHandle,
      title,
      costQuoted: rawCost,
      campaignTag: (cols[4] || '').trim(),
      valid: true
    });
  }

  return rows;
}
