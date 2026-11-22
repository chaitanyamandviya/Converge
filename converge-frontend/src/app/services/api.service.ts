import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Brand {
  id: string;
  code: string;
  name: string;
  slug: string;
  domain: string;
  region: string;
  tier: string;
  currency: string;
  locale: string;
  description: string;
  instagramHandle: string;
  contactNumber: string;
  status: 'ACTIVE' | 'PENDING' | 'DRAFT';
  managerName: string;
  managerEmail: string;
  managerRoleTitle: string;
  targetViewsGoal?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Agency {
  id: string;
  brandId: string;
  name: string;
  handle: string;
  monogram: string;
  roleBadge: string;
  scopeDescription: string;
  region: string;
  contactName: string;
  contactEmail: string;
  contactNumber?: string;
  creatorsCount: number;
  auditedReelsCount: number;
  status: string;
  connectedAt: string;
}

export interface Creator {
  id: string;
  brandId: string;
  agencyId: string | null;
  agencyName: string;
  agencyBadge: string;
  name: string;
  handle: string;
  email: string;
  avatarUrl: string | null;
  profileUrl?: string | null;
  igUserId?: string | null;
  niche: string;
  bio: string;
  followersDisplay: string;
  followersCount: number;
  followsCount?: number;
  mediaCount?: number;
  sourceType: 'DIRECT' | 'AGENCY';
  campaignName: string;
  reachCount: number;
  auditedReelsCount: number;
  engagementRate: number;
  igConnected?: boolean;
  verified?: boolean;
  category?: string;
  managementHandle?: string;
  country?: string;
  gender?: string;
  ageBracket?: string;
  creatorTraits?: string;
  previousBrandPartners?: string;
  partnershipAdCount?: number;
  accountInteractions30d?: number;
  totalViews30d?: number;
  interactionRate90d?: number;
  hookRate90d?: number;
  postedLast28Days?: boolean;
  topCollaborator?: boolean;
  predictedAdPerformance?: string;
  insightsSource?: string;
  costMode?: 'COLLECTIVE' | 'PER_DELIVERABLE';
  costQuoted?: number | null;
  currency?: string;
  lastSyncedAt?: string;
  status: string;
  demoData?: boolean;
  linkedAt: string;
}

export interface CreatorInsightsBundle {
  creator: Creator;
  deliverables: ReelDeliverable[];
  kpiSummary?: {
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalInteractions: number;
    submittedDeliverables: number;
    metricsScope: 'DELIVERABLES' | 'RECENT_MEDIA';
    postsAnalyzedCount: number;
    postsWithViewsCount: number;
    staticPhotoCount?: number;
  };
  roiBenchmarks?: {
    tier: string;
    followersCount: number;
    followersDisplay: string;
    interactionRatePct: number;
    avgViewsPerPost: number;
    avgViewsPostCount: number;
    costMode?: 'COLLECTIVE' | 'PER_DELIVERABLE';
    baseRate?: number | null;
    pricedDeliverablesCount?: number;
    costQuoted: number | null;
    currency: string;
    costPer1kFollowers: number | null;
    costPerInteraction: number | null;
    costPerView: number | null;
  };
  insightsOverview: {
    totalFollowers: number;
    totalFollowersDisplay: string;
    accountInteractions30d: number;
    accountInteractionsDisplay: string;
    interactionsWindowLabel?: string;
    totalViews30d: number;
    totalViewsDisplay: string;
    interactionRate90d: number;
  };
  recentMedia?: any[];
  demographics: {
    country: string;
    gender: string;
    ageBracket: string;
  };
  traits: string[];
  associatedBrands?: string[];
  previousBrandPartners: string[];
  metaConfigured: boolean;
}

export interface ReelSnapshotPoint {
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  savesCount?: number;
  deltaViews: number;
  deltaLikes?: number;
  capturedAt: string;
}

export interface ReelDeltaSummary {
  snapshotCount: number;
  viewsDeltaLastSync: number;
  likesDeltaLastSync: number;
  commentsDeltaLastSync: number;
  snapshots: ReelSnapshotPoint[];
}

export interface DeliverableInsightsBundle {
  deliverable: ReelDeliverable;
  creator: Creator;
  snapshots?: ReelSnapshotPoint[];
  derived: {
    totalInteractions: number;
    likeRatePct: number;
    commentRatePct: number;
    viewToFollowerRatioPct: number;
    shareOfCreatorViewsPct: number;
    engagementVsCreatorAvgPct: number;
    viewsDeltaLastSync?: number;
    likesDeltaLastSync?: number;
    commentsDeltaLastSync?: number;
    snapshotCount?: number;
    costMode?: 'COLLECTIVE' | 'PER_DELIVERABLE';
    costLabel?: string;
    costQuoted?: number | null;
    costPerView?: number | null;
    costPerInteraction?: number | null;
  };
  metaConfigured: boolean;
}

export interface ReelDeliverable {
  id: string;
  brandId: string;
  creatorId: string;
  creatorHandle: string;
  title: string;
  reelUrl: string;
  igMediaId?: string;
  shortcode?: string;
  mediaType?: string;
  caption?: string;
  thumbnailUrl?: string;
  duration: string;
  costQuoted?: number | null;
  campaignTag?: string;
  demoData?: boolean;
  viewsCount: number;
  reachCount?: number;
  likesCount: number;
  commentsCount: number;
  savesCount?: number;
  sharesCount?: number;
  avgWatchTimeMs?: number;
  engagementRate: number;
  status: string;
  metricsSource?: string;
  publishedAt?: string;
  syncedAt: string;
}

export interface SharedReportRecord {
  id: string;
  brandId: string;
  agencyId?: string | null;
  shareToken: string;
  title: string;
  campaignFilter: string;
  includeSpend: boolean;
  createdBy?: string;
  active: boolean;
  expiresAt?: string | null;
  createdAt: string;
}

export interface PublicReportBundle {
  report: {
    title: string;
    campaignFilter: string;
    includeSpend: boolean;
    createdAt: string;
    expiresAt: string;
  };
  brand: {
    name: string;
    brandName: string;
    slug: string;
    currency: string;
    targetViewsGoal?: number | null;
  };
  creators: Creator[];
  deliverables: ReelDeliverable[];
  reelDeltas?: Record<string, ReelDeltaSummary>;
}

export interface InstagramStatus {
  configured: boolean;
  hasAccessToken?: boolean;
  hasBusinessAccountId?: boolean;
  hasOAuthApp: boolean;
  hasAppSecretProof?: boolean;
  creatorMarketplaceEnabled?: boolean;
  baseUrl?: string;
  missingEnvVars?: string[];
}

export interface AuditLog {
  id: string;
  brandId: string;
  eventCode: string;
  category: string;
  title: string;
  statusBadge: string;
  description: string;
  actor: string;
  metadataTag: string;
  sha256Hash: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  searchUsersByEmail(email: string): Observable<any[]> {
    return this.http.get<any[]>('/api/users/search', { params: { email } });
  }

  listBrands(status?: string, search?: string): Observable<Brand[]> {
    let params = new HttpParams();
    if (status && status !== 'ALL') params = params.set('status', status);
    if (search) params = params.set('search', search);
    return this.http.get<Brand[]>('/api/brands', { params });
  }

  provisionBrand(payload: Partial<Brand>): Observable<Brand> {
    return this.http.post<Brand>('/api/brands', payload);
  }

  getBrandOverview(brandId: string): Observable<{
    brand: Brand;
    agencies: Agency[];
    creators: Creator[];
    recentReels: ReelDeliverable[];
    deliverables?: ReelDeliverable[];
    reelDeltas?: Record<string, ReelDeltaSummary>;
    stats: {
      totalReels: number;
      totalReach: number;
      avgEngagement: number;
      activeAgencies: number;
      totalCreators: number;
    };
  }> {
    return this.http.get<any>(`/api/brands/${brandId}`);
  }

  updateBrand(brandId: string, payload: Partial<Brand>): Observable<Brand> {
    return this.http.patch<Brand>(`/api/brands/${brandId}`, payload);
  }

  deleteBrand(brandId: string): Observable<void> {
    return this.http.delete<void>(`/api/brands/${brandId}`);
  }

  listAgencies(brandId: string): Observable<Agency[]> {
    return this.http.get<Agency[]>(`/api/brands/${brandId}/agencies`);
  }

  addAgency(brandId: string, payload: Partial<Agency>): Observable<Agency> {
    return this.http.post<Agency>(`/api/brands/${brandId}/agencies`, payload);
  }

  updateAgencyPermissions(brandId: string, agencyId: string, payload: Partial<Agency>): Observable<Agency> {
    return this.http.patch<Agency>(`/api/brands/${brandId}/agencies/${agencyId}`, payload);
  }

  deleteAgency(brandId: string, agencyId: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`/api/brands/${brandId}/agencies/${agencyId}`);
  }

  listCreators(brandId: string, filters?: { type?: string; agency?: string; search?: string }): Observable<Creator[]> {
    let params = new HttpParams();
    if (filters?.type && filters.type !== 'all') params = params.set('type', filters.type);
    if (filters?.agency && filters.agency !== 'all') params = params.set('agency', filters.agency);
    if (filters?.search) params = params.set('search', filters.search);
    return this.http.get<Creator[]>(`/api/brands/${brandId}/creators`, { params });
  }

  addDirectCreator(brandId: string, payload: Record<string, any>): Observable<Creator> {
    return this.http.post<Creator>(`/api/brands/${brandId}/creators`, payload);
  }

  getCreatorInsights(creatorId: string): Observable<CreatorInsightsBundle> {
    return this.http.get<CreatorInsightsBundle>(`/api/creators/${creatorId}/insights`);
  }

  updateCreatorInsightsProfile(creatorId: string, payload: Record<string, any>): Observable<CreatorInsightsBundle> {
    return this.http.put<CreatorInsightsBundle>(`/api/creators/${creatorId}/insights-profile`, payload);
  }

  deleteCreator(creatorId: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`/api/creators/${creatorId}`);
  }

  listCreatorDeliverables(creatorId: string): Observable<ReelDeliverable[]> {
    return this.http.get<ReelDeliverable[]>(`/api/creators/${creatorId}/deliverables`);
  }

  addReelDeliverable(creatorId: string, payload: { title: string; reelUrl: string; costQuoted?: string | number | null; campaignTag?: string }): Observable<ReelDeliverable> {
    return this.http.post<ReelDeliverable>(`/api/creators/${creatorId}/deliverables`, payload);
  }

  updateDeliverable(deliverableId: string, payload: { title?: string; costQuoted?: number | null; campaignTag?: string }): Observable<ReelDeliverable> {
    return this.http.put<ReelDeliverable>(`/api/creators/deliverables/${deliverableId}`, payload);
  }

  deleteDeliverable(deliverableId: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`/api/creators/deliverables/${deliverableId}`);
  }

  getDeliverableInsights(deliverableId: string): Observable<DeliverableInsightsBundle> {
    return this.http.get<DeliverableInsightsBundle>(`/api/creators/deliverables/${deliverableId}/insights`);
  }

  getInstagramStatus(): Observable<InstagramStatus> {
    return this.http.get<InstagramStatus>('/api/instagram/status');
  }

  lookupInstagramProfile(handle: string, refresh = false): Observable<any> {
    let params = new HttpParams().set('handle', handle);
    if (refresh) params = params.set('refresh', 'true');
    return this.http.get<any>('/api/instagram/profile', { params });
  }

  fetchInstagramMedia(handle: string, limit = 100, creatorId?: string): Observable<any[]> {
    let params = new HttpParams().set('limit', limit);
    if (handle) params = params.set('handle', handle);
    if (creatorId) params = params.set('creatorId', creatorId);
    return this.http.get<any[]>('/api/instagram/media', { params });
  }

  inspectInstagramReel(reelUrl: string, creatorHandle: string): Observable<any> {
    return this.http.post<any>('/api/instagram/inspect-reel', { reelUrl, creatorHandle });
  }

  syncCreatorInstagram(creatorId: string): Observable<CreatorInsightsBundle & { profileUpdated: boolean; verifiedDeliverables: number }> {
    return this.http.post<any>(`/api/instagram/creators/${creatorId}/sync`, {});
  }

  syncDeliverableInstagram(deliverableId: string): Observable<ReelDeliverable> {
    return this.http.post<ReelDeliverable>(`/api/instagram/deliverables/${deliverableId}/sync`, {});
  }

  syncBrandDeliverables(brandId: string, source?: 'login' | 'manual'): Observable<{ syncedCount: number; verifiedCount?: number; pendingCount?: number; metaConfigured?: boolean; status: string; syncedAt: string }> {
    let params = new HttpParams();
    if (source) params = params.set('source', source);
    return this.http.post<any>(`/api/brands/${brandId}/sync`, {}, { params });
  }

  getInstagramOAuthUrl(state?: string): Observable<{ authorizeUrl: string; redirectUri: string; scopes: string[] }> {
    let params = new HttpParams();
    if (state) params = params.set('state', state);
    return this.http.get<any>('/api/instagram/oauth/authorize-url', { params });
  }

  exchangeInstagramOAuthCode(code: string, state: string): Observable<any> {
    return this.http.post<any>('/api/instagram/oauth/callback', { code, state });
  }

  listAuditLogs(brandId: string, category?: string, search?: string, page = 0, size = 10): Observable<{
    items: AuditLog[];
    total: number;
    page: number;
    size: number;
  }> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (category && category !== 'ALL') params = params.set('category', category);
    if (search) params = params.set('search', search);
    return this.http.get<any>(`/api/brands/${brandId}/audit-logs`, { params });
  }

  exportBrandCsv(brandId: string, campaign?: string): Observable<Blob> {
    let params = new HttpParams();
    if (campaign && campaign !== 'ALL') params = params.set('campaign', campaign);
    return this.http.get(`/api/brands/${brandId}/export`, { params, responseType: 'blob' });
  }

  updateBrandWorkspaceSettings(brandId: string, payload: { targetViewsGoal: number | null }): Observable<Brand> {
    return this.http.patch<Brand>(`/api/brands/${brandId}/settings`, payload);
  }

  bulkImportDeliverables(brandId: string, payload: {
    defaultCreatorId?: string;
    defaultCampaignTag?: string;
    defaultCostQuoted?: number | string | null;
    items: Array<{ reelUrl: string; creatorHandle?: string; title?: string; costQuoted?: string | number | null; campaignTag?: string }>;
  }): Observable<{
    addedCount: number;
    skippedDuplicatesCount: number;
    failedCount: number;
    createdCreatorsCount: number;
    deliverables: ReelDeliverable[];
    errors: Array<{ row: number; reelUrl: string; reason: string }>;
  }> {
    return this.http.post<any>(`/api/brands/${brandId}/deliverables/bulk`, payload);
  }

  seedDemoCampaign(brandId: string): Observable<{ alreadyLoaded: boolean; creatorsAdded: number; reelsAdded: number }> {
    return this.http.post<any>(`/api/brands/${brandId}/demo-campaign`, {});
  }

  clearDemoCampaign(brandId: string): Observable<{ removedCreators: number; removedReels: number }> {
    return this.http.delete<any>(`/api/brands/${brandId}/demo-campaign`);
  }

  listSharedReports(brandId: string): Observable<SharedReportRecord[]> {
    return this.http.get<SharedReportRecord[]>(`/api/brands/${brandId}/share-reports`);
  }

  createSharedReport(brandId: string, payload: {
    title: string;
    campaignFilter: string;
    includeSpend: boolean;
    expiryDays?: number | null;
  }): Observable<SharedReportRecord> {
    return this.http.post<SharedReportRecord>(`/api/brands/${brandId}/share-reports`, payload);
  }

  revokeSharedReport(brandId: string, reportId: string): Observable<{ revoked: boolean }> {
    return this.http.delete<{ revoked: boolean }>(`/api/brands/${brandId}/share-reports/${reportId}`);
  }

  getPublicSharedReport(token: string): Observable<PublicReportBundle> {
    return this.http.get<PublicReportBundle>(`/api/public/reports/${encodeURIComponent(token)}`);
  }
}
