import type { Creator, DeliverableComplianceStatus, HashtagPerfRow, ReelDeliverable } from '../services/api.service';

export interface CampaignBreakdownRow {
  campaign: string;
  reelsCount: number;
  creatorsCount: number;
  views: number;
  interactions: number;
  spend: number;
  cpv: number | null;
  engRate: number;
  avgHookRatePct: number | null;
}

export interface ExecutiveAnalyticsSummary {
  totalViews: number;
  totalReach: number;
  totalLikes: number;
  totalComments: number;
  totalSaves: number;
  totalInteractions: number;
  totalReels: number;
  totalCreators: number;
  totalSpend: number;
  blendedCpv: number | null;
  blendedCpe: number | null;
  blendedEngagementRate: number;
  avgHookRatePct: number | null;
  hookMeasuredReelsCount: number;
  healthScore: {
    label: 'Outperforming' | 'Healthy' | 'Growing' | 'Pending Sync';
    tone: 'green' | 'gold' | 'vermilion' | 'muted';
    benchmarkNote: string;
  };
  topReel: {
    reel: ReelDeliverable;
    creator: Creator | null;
    cost: number | null;
    cpv: number | null;
    engagementRate: number;
  } | null;
  goalProgress: {
    target: number;
    delivered: number;
    pct: number;
    rawPct: number;
    remaining: number;
    achieved: boolean;
  } | null;
  campaignBreakdowns: CampaignBreakdownRow[];
}

export function resolveEffectiveCampaign(
  reel?: Partial<ReelDeliverable> | null,
  creator?: Partial<Creator> | null
): string {
  const tag = (reel?.campaignTag || '').trim();
  if (tag) return tag;
  const cName = (creator?.campaignName || '').trim();
  return cName;
}

export function extractDistinctCampaigns(
  creators: Creator[],
  deliverables: ReelDeliverable[]
): string[] {
  const creatorMap = new Map<string, Creator>();
  for (const c of creators) creatorMap.set(c.id, c);

  const seen = new Map<string, string>();
  for (const c of creators) {
    const nm = (c.campaignName || '').trim();
    if (nm && !seen.has(nm.toLowerCase())) seen.set(nm.toLowerCase(), nm);
  }
  for (const r of deliverables) {
    const nm = resolveEffectiveCampaign(r, creatorMap.get(r.creatorId));
    if (nm && !seen.has(nm.toLowerCase())) seen.set(nm.toLowerCase(), nm);
  }
  return Array.from(seen.values());
}

export function filterWorkspaceByCampaign(
  creators: Creator[],
  deliverables: ReelDeliverable[],
  campaignFilter: string
): { creators: Creator[]; deliverables: ReelDeliverable[] } {
  const active = (campaignFilter || '').trim();
  if (!active || active.toUpperCase() === 'ALL') {
    return { creators, deliverables };
  }
  const activeLower = active.toLowerCase();
  const creatorMap = new Map<string, Creator>();
  for (const c of creators) creatorMap.set(c.id, c);

  const filteredReels = deliverables.filter(r =>
    resolveEffectiveCampaign(r, creatorMap.get(r.creatorId)).toLowerCase() === activeLower
  );
  const matchingCreatorIds = new Set(filteredReels.map(r => r.creatorId));
  const filteredCreators = creators.filter(c =>
    matchingCreatorIds.has(c.id) || (c.campaignName || '').trim().toLowerCase() === activeLower
  );
  return { creators: filteredCreators, deliverables: filteredReels };
}

export function resolveCurrencySymbol(currencyStr?: string | null): string {
  const upper = (currencyStr || '').toUpperCase();
  if (upper.includes('USD') || upper.includes('$')) return '$';
  if (upper.includes('EUR') || upper.includes('€')) return '€';
  if (upper.includes('GBP') || upper.includes('£')) return '£';
  return '₹';
}

export function formatMoney(
  amount: number | null | undefined,
  currencyStr?: string | null,
  decimals = 0
): string {
  if (amount == null || Number.isNaN(amount) || amount <= 0) return '—';
  const symbol = resolveCurrencySymbol(currencyStr);
  const locale = symbol === '₹' ? 'en-IN' : 'en-US';
  return symbol + amount.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function formatCompactCount(n: number | null | undefined): string {
  const val = Number(n || 0);
  if (val >= 1_000_000) return (val / 1_000_000).toFixed(1) + 'M';
  if (val >= 1_000) return (val / 1_000).toFixed(1) + 'K';
  return String(Math.round(val));
}

export function computeCreatorScopedSpend(
  creators: Creator[],
  deliverables: ReelDeliverable[]
): { totalSpend: number; spendByCreatorId: Map<string, number> } {
  const byCreator = new Map<string, ReelDeliverable[]>();
  for (const r of deliverables) {
    const arr = byCreator.get(r.creatorId) || [];
    arr.push(r);
    byCreator.set(r.creatorId, arr);
  }

  let totalSpend = 0;
  const spendByCreatorId = new Map<string, number>();

  for (const c of creators) {
    const owned = byCreator.get(c.id) || [];
    let creatorSpend = 0;
    if (c.costMode === 'PER_DELIVERABLE') {
      for (const r of owned) {
        const dc = r.costQuoted && r.costQuoted > 0 ? r.costQuoted : (c.costQuoted && c.costQuoted > 0 ? c.costQuoted : 0);
        if (dc > 0) creatorSpend += dc;
      }
    } else if (c.costQuoted && c.costQuoted > 0) {
      creatorSpend = c.costQuoted;
    }
    if (creatorSpend > 0) {
      totalSpend += creatorSpend;
      spendByCreatorId.set(c.id, creatorSpend);
    }
  }
  return { totalSpend, spendByCreatorId };
}

export function computeExecutiveAnalytics(params: {
  creators: Creator[];
  deliverables: ReelDeliverable[];
  currency?: string | null;
  targetViewsGoal?: number | null;
  includeSpend?: boolean;
}): ExecutiveAnalyticsSummary {
  const { creators, deliverables, targetViewsGoal, includeSpend = true } = params;
  const creatorMap = new Map<string, Creator>();
  for (const c of creators) creatorMap.set(c.id, c);

  let totalViews = 0;
  let totalReach = 0;
  let totalLikes = 0;
  let totalComments = 0;
  let totalSaves = 0;

  for (const r of deliverables) {
    const v = r.viewsCount || 0;
    totalViews += v;
    totalReach += (r.reachCount && r.reachCount > 0) ? r.reachCount : v;
    totalLikes += r.likesCount || 0;
    totalComments += r.commentsCount || 0;
    totalSaves += r.savesCount || 0;
  }

  const totalInteractions = totalLikes + totalComments;
  const { totalSpend } = includeSpend
    ? computeCreatorScopedSpend(creators, deliverables)
    : { totalSpend: 0 };

  const blendedCpv = includeSpend && totalSpend > 0 && totalViews > 0
    ? Math.round((totalSpend / totalViews) * 100) / 100
    : null;
  const blendedCpe = includeSpend && totalSpend > 0 && totalInteractions > 0
    ? Math.round((totalSpend / totalInteractions) * 100) / 100
    : null;

  let blendedEngagementRate = 0;
  if (totalViews > 0 && totalInteractions > 0) {
    blendedEngagementRate = Math.round((totalInteractions * 100.0 / totalViews) * 100) / 100;
  } else {
    const totalFollowers = creators.reduce((s, c) => s + (c.followersCount || 0), 0);
    if (totalFollowers > 0 && totalInteractions > 0) {
      blendedEngagementRate = Math.round((totalInteractions * 100.0 / totalFollowers) * 100) / 100;
    } else if (creators.length > 0) {
      const sumEr = creators.reduce((s, c) => s + (c.interactionRate90d || c.engagementRate || 0), 0);
      blendedEngagementRate = Math.round((sumEr / creators.length) * 100) / 100;
    }
  }

  let healthScore: ExecutiveAnalyticsSummary['healthScore'];
  if (blendedEngagementRate >= 5.0) {
    healthScore = {
      label: 'Outperforming',
      tone: 'green',
      benchmarkNote: `${blendedEngagementRate}% ER beats 2.5% D2C avg`
    };
  } else if (blendedEngagementRate >= 2.5) {
    healthScore = {
      label: 'Healthy',
      tone: 'gold',
      benchmarkNote: `${blendedEngagementRate}% ER meets 2.5% D2C avg`
    };
  } else if (blendedEngagementRate > 0) {
    healthScore = {
      label: 'Growing',
      tone: 'vermilion',
      benchmarkNote: `${blendedEngagementRate}% ER vs 2.5% D2C benchmark`
    };
  } else {
    healthScore = {
      label: 'Pending Sync',
      tone: 'muted',
      benchmarkNote: 'Sync Reels to score campaign health'
    };
  }

  let topReelObj: ExecutiveAnalyticsSummary['topReel'] = null;
  if (deliverables.length > 0) {
    const sorted = [...deliverables].sort((a, b) => {
      const scoreA = (a.viewsCount || 0) * 1000 + (a.likesCount || 0) + (a.commentsCount || 0);
      const scoreB = (b.viewsCount || 0) * 1000 + (b.likesCount || 0) + (b.commentsCount || 0);
      return scoreB - scoreA;
    });
    const best = sorted[0];
    const parent = creatorMap.get(best.creatorId) || null;
    const bestCost = includeSpend
      ? (best.costQuoted && best.costQuoted > 0
        ? best.costQuoted
        : (parent?.costMode === 'PER_DELIVERABLE' && parent.costQuoted ? parent.costQuoted : null))
      : null;
    const bestCpv = bestCost && (best.viewsCount || 0) > 0
      ? Math.round((bestCost / best.viewsCount) * 100) / 100
      : null;
    const bestInter = (best.likesCount || 0) + (best.commentsCount || 0);
    const bestEr = (best.viewsCount || 0) > 0
      ? Math.round((bestInter * 100.0 / best.viewsCount) * 100) / 100
      : (best.engagementRate || 0);
    topReelObj = {
      reel: best,
      creator: parent,
      cost: bestCost,
      cpv: bestCpv,
      engagementRate: bestEr
    };
  }

  const goalNum = targetViewsGoal && targetViewsGoal > 0 ? Number(targetViewsGoal) : 0;
  const goalProgress = goalNum > 0
    ? {
        target: goalNum,
        delivered: totalViews,
        pct: Math.min(100, Math.round((totalViews * 1000 / goalNum)) / 10),
        rawPct: Math.round((totalViews * 1000 / goalNum)) / 10,
        remaining: Math.max(0, goalNum - totalViews),
        achieved: totalViews >= goalNum
      }
    : null;

  // Group breakdown by campaign tag
  const reelsPerCreatorCount = new Map<string, number>();
  for (const r of deliverables) {
    reelsPerCreatorCount.set(r.creatorId, (reelsPerCreatorCount.get(r.creatorId) || 0) + 1);
  }

  const groups = new Map<string, {
    label: string;
    reelsCount: number;
    creatorIds: Set<string>;
    views: number;
    interactions: number;
    spend: number;
    reels: ReelDeliverable[];
  }>();

  for (const r of deliverables) {
    const parent = creatorMap.get(r.creatorId);
    const rawCamp = resolveEffectiveCampaign(r, parent) || 'Untagged / General';
    const key = rawCamp.toLowerCase();
    const g = groups.get(key) || {
      label: rawCamp,
      reelsCount: 0,
      creatorIds: new Set<string>(),
      views: 0,
      interactions: 0,
      spend: 0,
      reels: []
    };
    g.reelsCount++;
    g.reels.push(r);
    if (r.creatorId) g.creatorIds.add(r.creatorId);
    g.views += r.viewsCount || 0;
    g.interactions += (r.likesCount || 0) + (r.commentsCount || 0);

    if (includeSpend && parent) {
      if (parent.costMode === 'PER_DELIVERABLE') {
        const rc = r.costQuoted && r.costQuoted > 0 ? r.costQuoted : (parent.costQuoted || 0);
        g.spend += rc;
      } else if (parent.costQuoted && parent.costQuoted > 0) {
        const countForCreator = reelsPerCreatorCount.get(parent.id) || 1;
        g.spend += parent.costQuoted / countForCreator;
      }
    }
    groups.set(key, g);
  }

  const campaignBreakdowns: CampaignBreakdownRow[] = Array.from(groups.values())
    .map(g => {
      const roundedSpend = Math.round(g.spend * 100) / 100;
      const cpv = includeSpend && roundedSpend > 0 && g.views > 0
        ? Math.round((roundedSpend / g.views) * 100) / 100
        : null;
      const engRate = g.views > 0 && g.interactions > 0
        ? Math.round((g.interactions * 100.0 / g.views) * 100) / 100
        : 0;
      const grpHook = computeViewWeightedHookRate(g.reels);
      return {
        campaign: g.label,
        reelsCount: g.reelsCount,
        creatorsCount: g.creatorIds.size,
        views: g.views,
        interactions: g.interactions,
        spend: roundedSpend,
        cpv,
        engRate,
        avgHookRatePct: grpHook.avgHookRatePct
      };
    })
    .sort((a, b) => b.views - a.views);

  const totalHook = computeViewWeightedHookRate(deliverables);

  return {
    totalViews,
    totalReach: totalReach > 0 ? totalReach : creators.reduce((s, c) => s + (c.reachCount || 0), 0),
    totalLikes,
    totalComments,
    totalSaves,
    totalInteractions,
    totalReels: deliverables.length,
    totalCreators: creators.length,
    totalSpend: Math.round(totalSpend),
    blendedCpv,
    blendedCpe,
    blendedEngagementRate,
    avgHookRatePct: totalHook.avgHookRatePct,
    hookMeasuredReelsCount: totalHook.hookMeasuredReelsCount,
    healthScore,
    topReel: topReelObj,
    goalProgress,
    campaignBreakdowns
  };
}

/**
 * View-weighted 3-second Hook Rate rollup across measured Reels (with simple mean fallback
 * if measured Reels currently have 0 recorded views).
 */
export function computeViewWeightedHookRate(reels: ReelDeliverable[]): {
  avgHookRatePct: number | null;
  hookMeasuredReelsCount: number;
} {
  let count = 0;
  let simpleSum = 0;
  let weightedSum = 0;
  let weightViews = 0;
  for (const r of reels) {
    if (r.hookRatePct == null || Number.isNaN(r.hookRatePct) || r.hookRatePct < 0) continue;
    const hr = Math.max(0, Math.min(100, Number(r.hookRatePct)));
    count++;
    simpleSum += hr;
    const v = Math.max(0, Number(r.viewsCount || 0));
    if (v > 0) {
      weightedSum += hr * v;
      weightViews += v;
    }
  }
  if (count === 0) return { avgHookRatePct: null, hookMeasuredReelsCount: 0 };
  const raw = weightViews > 0 ? weightedSum / weightViews : simpleSum / count;
  return {
    avgHookRatePct: Math.round(raw * 10) / 10,
    hookMeasuredReelsCount: count
  };
}

export function describeHookRate(hookRate: number | null | undefined): {
  label: string;
  tone: 'green' | 'gold' | 'vermilion' | 'muted';
} {
  if (hookRate == null || Number.isNaN(hookRate) || hookRate < 0) {
    return { label: 'Not Measured', tone: 'muted' };
  }
  if (hookRate >= 40) return { label: 'Strong Hook', tone: 'green' };
  if (hookRate >= 25) return { label: 'Avg Hook', tone: 'gold' };
  return { label: 'Weak Hook', tone: 'vermilion' };
}

const CAPTION_HASHTAG_RE = /(?<![A-Za-z0-9_])#([A-Za-z0-9_]{2,60})/g;
const DISCLOSURE_CAPTION_RE = /(?<![A-Za-z0-9_])(#ad\b|#paidpartnership\b|paid\s+partnership|#sponsored\b|#collab\b|#brandpartner\b)/i;
const DISCLOSURE_ONLY_HASHTAGS = new Set(['#ad', '#paidpartnership', '#sponsored', '#collab', '#brandpartner']);

export function extractCaptionHashtags(caption?: string | null): string[] {
  if (!caption || !caption.trim()) return [];
  const seen = new Map<string, string>();
  CAPTION_HASHTAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CAPTION_HASHTAG_RE.exec(caption)) !== null) {
    const tag = `#${match[1]}`;
    const lower = tag.toLowerCase();
    if (!seen.has(lower)) {
      seen.set(lower, tag);
    }
  }
  return Array.from(seen.values());
}

export function parseRequiredHashtags(raw?: string | null): string[] {
  if (!raw || !raw.trim()) return [];
  const seen = new Map<string, string>();
  for (const token of raw.split(/[,\s;]+/)) {
    const clean = token.trim().replace(/^#+/, '');
    if (/^[A-Za-z0-9_]{2,60}$/.test(clean)) {
      const tag = `#${clean}`;
      const lower = tag.toLowerCase();
      if (!seen.has(lower)) {
        seen.set(lower, tag);
        if (seen.size >= 15) break;
      }
    }
  }
  return Array.from(seen.values());
}

export function hasDisclosureInCaption(caption?: string | null): boolean {
  return !!caption && caption.trim().length > 0 && DISCLOSURE_CAPTION_RE.test(caption);
}

export function isDisclosureOnlyHashtag(tag?: string | null): boolean {
  return !!tag && DISCLOSURE_ONLY_HASHTAGS.has(tag.trim().toLowerCase());
}

export function evaluateCaptionCompliance(
  caption: string | null | undefined,
  requiredHashtags?: string | null,
  requireDisclosure?: boolean
): DeliverableComplianceStatus {
  const hashtags = extractCaptionHashtags(caption);
  const presentLower = new Set(hashtags.map((h) => h.toLowerCase()));
  const requiredTags = parseRequiredHashtags(requiredHashtags);
  const reqDisc = !!requireDisclosure;
  const hasRules = requiredTags.length > 0 || reqDisc;
  const captionPresent = !!(caption && caption.trim().length > 0);
  const missingTags = requiredTags.filter((req) => !presentLower.has(req.toLowerCase()));
  const hasDisclosure = hasDisclosureInCaption(caption);
  const disclosureMissing = reqDisc && !hasDisclosure;
  const compliant = !hasRules || (captionPresent && missingTags.length === 0 && !disclosureMissing);

  let status: DeliverableComplianceStatus['status'] = 'UNCONFIGURED';
  if (hasRules) {
    if (!captionPresent) status = 'NO_CAPTION';
    else if (compliant) status = 'COMPLIANT';
    else if (disclosureMissing && missingTags.length > 0) status = 'MISSING_BOTH';
    else if (disclosureMissing) status = 'MISSING_DISCLOSURE';
    else status = 'MISSING_TAGS';
  }

  return {
    hashtags,
    hasDisclosure,
    hasRules,
    captionPresent,
    requiredTags,
    missingTags,
    requireDisclosure: reqDisc,
    disclosureMissing,
    compliant,
    status,
  };
}

export function computeHashtagLeaderboard(reels: ReelDeliverable[]): HashtagPerfRow[] {
  if (!reels || reels.length === 0) return [];
  const accMap = new Map<string, {
    normalized: string;
    display: string;
    reelsCount: number;
    creators: Set<string>;
    totalViews: number;
    totalInteractions: number;
    hookWeightedSum: number;
    hookViews: number;
  }>();

  for (const r of reels) {
    const tags = extractCaptionHashtags(r.caption);
    if (tags.length === 0) continue;
    const views = Math.max(0, Number(r.viewsCount) || 0);
    const interactions = Math.max(0, Number(r.likesCount) || 0) + Math.max(0, Number(r.commentsCount) || 0);
    const hookRate = r.hookRatePct;

    for (const tag of tags) {
      if (isDisclosureOnlyHashtag(tag)) continue;
      const lower = tag.toLowerCase();
      let acc = accMap.get(lower);
      if (!acc) {
        acc = {
          normalized: lower,
          display: tag,
          reelsCount: 0,
          creators: new Set<string>(),
          totalViews: 0,
          totalInteractions: 0,
          hookWeightedSum: 0,
          hookViews: 0,
        };
        accMap.set(lower, acc);
      } else if (tag !== tag.toLowerCase() && acc.display === acc.display.toLowerCase()) {
        acc.display = tag;
      }
      acc.reelsCount += 1;
      if (r.creatorId) acc.creators.add(r.creatorId);
      acc.totalViews += views;
      acc.totalInteractions += interactions;
      if (hookRate != null && hookRate > 0 && views > 0) {
        acc.hookWeightedSum += hookRate * views;
        acc.hookViews += views;
      }
    }
  }

  return Array.from(accMap.values())
    .sort((a, b) => (b.totalViews - a.totalViews) || (b.reelsCount - a.reelsCount) || a.normalized.localeCompare(b.normalized))
    .slice(0, 30)
    .map((a) => ({
      hashtag: a.display,
      normalizedHashtag: a.normalized,
      reelsCount: a.reelsCount,
      creatorsCount: a.creators.size,
      totalViews: a.totalViews,
      avgViews: a.reelsCount > 0 ? Math.round(a.totalViews / a.reelsCount) : 0,
      totalInteractions: a.totalInteractions,
      engagementRate: a.totalViews > 0 ? Math.round((a.totalInteractions * 10000) / a.totalViews) / 100 : 0,
      avgHookRatePct: a.hookViews > 0 ? Math.round((a.hookWeightedSum / a.hookViews) * 10) / 10 : null,
    }));
}

export function matchCampaignsByCaption(
  caption: string | null | undefined,
  campaigns: Array<{ id: string; name: string; status?: string; requiredHashtags?: string | null }>
): Array<{ id: string; name: string; matchedTags: string[] }> {
  const tags = extractCaptionHashtags(caption);
  if (tags.length === 0 || !campaigns || campaigns.length === 0) return [];
  const lowerSet = new Set(tags.map((t) => t.toLowerCase()));
  const matches: Array<{ id: string; name: string; matchedTags: string[] }> = [];
  for (const camp of campaigns) {
    const reqs = parseRequiredHashtags(camp.requiredHashtags);
    if (reqs.length === 0) continue;
    const hit = reqs.filter((r) => lowerSet.has(r.toLowerCase()));
    if (hit.length > 0) {
      matches.push({ id: camp.id, name: camp.name, matchedTags: hit });
    }
  }
  return matches;
}
