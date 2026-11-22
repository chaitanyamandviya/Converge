import { Creator, DeliverableInsightsBundle, ReelDeliverable, ReelSnapshotPoint } from '../services/api.service';

export interface ResolvedReelMetrics {
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  engagementRate: number;
  totalInteractions: number;
  likeRatePct: number;
  commentRatePct: number;
  viewToFollowerRatioPct: number;
  shareOfCreatorViewsPct: number;
  engagementVsCreatorAvgPct: number;
  costMode: 'COLLECTIVE' | 'PER_DELIVERABLE';
  costLabel: string;
  costQuoted: number | null;
  costPerView: number | null;
  costPerInteraction: number | null;
  viewsDelta: number;
  isSnapshotPreview: boolean;
}

/**
 * Computes consistent Reel KPIs and ROI ratios for either the live/latest deliverable
 * or a specific hovered/pinned historical sync snapshot.
 */
export function computeReelSnapshotMetrics(params: {
  reel: ReelDeliverable;
  creator?: Creator | null;
  snapshot?: ReelSnapshotPoint | null;
  isLatest: boolean;
  bundleDerived?: DeliverableInsightsBundle['derived'] | null;
  viewsDeltaLastSync?: number;
}): ResolvedReelMetrics {
  const { reel, creator, snapshot, isLatest, bundleDerived, viewsDeltaLastSync = 0 } = params;
  const usingSnapshot = !isLatest && !!snapshot;

  const views = usingSnapshot ? (snapshot!.viewsCount || 0) : (reel.viewsCount || 0);
  const likes = usingSnapshot ? (snapshot!.likesCount || 0) : (reel.likesCount || 0);
  const comments = usingSnapshot ? (snapshot!.commentsCount || 0) : (reel.commentsCount || 0);
  const saves = usingSnapshot
    ? (snapshot!.savesCount ?? reel.savesCount ?? 0)
    : (reel.savesCount || 0);

  const followers = creator?.followersCount || 0;
  const creatorAvg = creator?.interactionRate90d || creator?.engagementRate || 0;
  const totalInteractions = likes + comments;
  const denom = views > 0 ? views : followers;
  const computedEng = denom > 0 && totalInteractions > 0
    ? Math.round((totalInteractions * 100.0 / denom) * 100) / 100
    : 0;
  const engagementRate = usingSnapshot ? computedEng : (reel.engagementRate || computedEng);

  const costMode: 'COLLECTIVE' | 'PER_DELIVERABLE' = bundleDerived?.costMode
    ?? (creator?.costMode === 'PER_DELIVERABLE' ? 'PER_DELIVERABLE' : 'COLLECTIVE');
  const costQuoted = bundleDerived?.costQuoted !== undefined
    ? bundleDerived.costQuoted
    : (costMode === 'PER_DELIVERABLE'
      ? (reel.costQuoted ?? creator?.costQuoted ?? null)
      : (creator?.costQuoted ?? null));
  const costLabel = bundleDerived?.costLabel
    ?? (costMode === 'PER_DELIVERABLE'
      ? (reel.costQuoted ? 'Deliverable cost' : 'Per-deliverable rate')
      : 'Fixed creator cost');

  if (!usingSnapshot && bundleDerived) {
    return {
      viewsCount: views,
      likesCount: likes,
      commentsCount: comments,
      savesCount: saves,
      engagementRate,
      totalInteractions: bundleDerived.totalInteractions ?? totalInteractions,
      likeRatePct: bundleDerived.likeRatePct ?? (views > 0 ? Math.round((likes * 100.0 / views) * 100) / 100 : 0),
      commentRatePct: bundleDerived.commentRatePct ?? (views > 0 ? Math.round((comments * 100.0 / views) * 100) / 100 : 0),
      viewToFollowerRatioPct: bundleDerived.viewToFollowerRatioPct ?? (followers > 0 && views > 0 ? Math.round((views * 100.0 / followers) * 10) / 10 : 0),
      shareOfCreatorViewsPct: bundleDerived.shareOfCreatorViewsPct ?? 0,
      engagementVsCreatorAvgPct: bundleDerived.engagementVsCreatorAvgPct ?? (creatorAvg > 0 ? Math.round((engagementRate - creatorAvg) * 10) / 10 : 0),
      costMode,
      costLabel,
      costQuoted: costQuoted ?? null,
      costPerView: bundleDerived.costPerView ?? (costQuoted && views > 0 ? Math.round((costQuoted / views) * 100) / 100 : null),
      costPerInteraction: bundleDerived.costPerInteraction ?? (costQuoted && totalInteractions > 0 ? Math.round((costQuoted / totalInteractions) * 100) / 100 : null),
      viewsDelta: bundleDerived.viewsDeltaLastSync ?? viewsDeltaLastSync,
      isSnapshotPreview: false
    };
  }

  return {
    viewsCount: views,
    likesCount: likes,
    commentsCount: comments,
    savesCount: saves,
    engagementRate,
    totalInteractions,
    likeRatePct: views > 0 ? Math.round((likes * 100.0 / views) * 100) / 100 : 0,
    commentRatePct: views > 0 ? Math.round((comments * 100.0 / views) * 100) / 100 : 0,
    viewToFollowerRatioPct: followers > 0 && views > 0 ? Math.round((views * 100.0 / followers) * 10) / 10 : 0,
    shareOfCreatorViewsPct: 0,
    engagementVsCreatorAvgPct: creatorAvg > 0 ? Math.round((engagementRate - creatorAvg) * 10) / 10 : 0,
    costMode,
    costLabel,
    costQuoted: costQuoted ?? null,
    costPerView: costQuoted && views > 0 ? Math.round((costQuoted / views) * 100) / 100 : null,
    costPerInteraction: costQuoted && totalInteractions > 0 ? Math.round((costQuoted / totalInteractions) * 100) / 100 : null,
    viewsDelta: usingSnapshot ? (snapshot!.deltaViews || 0) : viewsDeltaLastSync,
    isSnapshotPreview: usingSnapshot
  };
}
