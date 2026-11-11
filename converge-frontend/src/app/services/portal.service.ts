import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap, of } from 'rxjs';
import { getApiBaseUrl } from '../config/api.config';

export interface OverviewMetrics {
  spend: number;
  views: number;
  likes: number;
  comments: number;
  onboardedAgencies: number;
  totalAgencies: number;
  totalCreators: number;
  contentSlotsFilled: number;
  totalContentSlots: number;
  missingUrlsCount: number;
  awaitingInsightsCount: number;
  coveragePercent: number;
  activeCampaignName: string;
}

export interface Agency {
  id?: number;
  name: string;
  email: string;
  category: string;
  creatorsCount: number;
  contentSlots: string;
  spend: number;
  status: string;
  joinedDate: string;
  avatarColor: string;
  websiteUrl?: string;
  logoUrl?: string;
  brandId?: number;
  brandName?: string;
}

export interface Campaign {
  id?: number;
  name: string;
  brandName?: string;
  status: string;
  timeframe: string;
  totalAgreedSpend: number;
  totalViews?: number;
  totalLikes?: number;
  totalComments?: number;
  totalAgencies?: number;
  totalCreators?: number;
  contentWithInsights?: string;
  assignedAgencyNames?: string;
}

export interface Creator {
  id?: number;
  handle: string;
  name: string;
  agencyName: string;
  campaignId?: number;
  campaignName?: string;
  avatarInitials: string;
  avatarUrl?: string;
  contentSlots: string;
  views: number;
  likes: number;
  comments: number;
  price: number;
  minPrice?: number;
  maxPrice?: number;
  pricingModel?: string;
  platform: string;
  category: string;
  profileUrl: string;
  followersCount?: number;
  followsCount?: number;
  mediaCount?: number;
  tier?: string;
  creatorType?: string;
  audienceFit?: number;
  contentQuality?: number;
  authenticityRisk?: string;
  contentUrls?: string[];
}

export interface Brand {
  id?: number;
  name: string;
  contactEmail: string;
  primaryManagerEmail: string;
  category: string;
  activeCampaignsCount: number;
  totalBudgetDeployed: number;
  status: string;
  websiteUrl?: string;
  logoUrl?: string;
}

export interface ContentItem {
  id?: number;
  creatorHandle: string;
  agencyName: string;
  campaignId?: number;
  campaignName?: string;
  title: string;
  contentUrl: string;
  format: string;
  publishedDate: string;
  views: number;
  likes: number;
  comments: number;
  finalPrice?: number;
  thumbnailUrl?: string;
  status: 'WITH_INSIGHTS' | 'MISSING_URL' | 'AWAITING_INSIGHTS' | string;
}

export interface CreatorDetailResponse {
  creator: Creator;
  contentItems: ContentItem[];
}

@Injectable({
  providedIn: 'root'
})
export class PortalService {
  private http = inject(HttpClient);
  private apiUrl = getApiBaseUrl();

  readonly overview = signal<OverviewMetrics>({
    spend: 0,
    views: 0,
    likes: 0,
    comments: 0,
    onboardedAgencies: 0,
    totalAgencies: 0,
    totalCreators: 0,
    contentSlotsFilled: 0,
    totalContentSlots: 0,
    missingUrlsCount: 0,
    awaitingInsightsCount: 0,
    coveragePercent: 0,
    activeCampaignName: 'No Active Campaign'
  });

  readonly agencies = signal<Agency[]>([]);
  readonly brands = signal<Brand[]>([]);
  readonly creators = signal<Creator[]>([]);
  readonly contentItems = signal<ContentItem[]>([]);
  readonly selectedCreator = signal<Creator | null>(null);
  readonly selectedCreatorContent = signal<ContentItem[]>([]);
  readonly campaigns = signal<Campaign[]>([]);
  readonly activeCampaignId = signal<number | null>(null);

  private lastFetchTime: Record<string, number> = {};
  private readonly CACHE_TTL_MS = 60_000; // 60s client-side cache

  private isFresh(key: string): boolean {
    const last = this.lastFetchTime[key];
    return !!last && (Date.now() - last < this.CACHE_TTL_MS);
  }

  invalidateCache(keyPrefix?: string): void {
    if (!keyPrefix) {
      this.lastFetchTime = {};
      return;
    }
    const lowerPrefix = keyPrefix.toLowerCase();
    for (const k of Object.keys(this.lastFetchTime)) {
      if (k.toLowerCase().startsWith(lowerPrefix)) {
        delete this.lastFetchTime[k];
      }
    }
  }

  resetState(): void {
    this.lastFetchTime = {};
    this.overview.set({
      spend: 0,
      views: 0,
      likes: 0,
      comments: 0,
      onboardedAgencies: 0,
      totalAgencies: 0,
      totalCreators: 0,
      contentSlotsFilled: 0,
      totalContentSlots: 0,
      missingUrlsCount: 0,
      awaitingInsightsCount: 0,
      coveragePercent: 0,
      activeCampaignName: 'No Active Campaign'
    });
    this.agencies.set([]);
    this.brands.set([]);
    this.creators.set([]);
    this.contentItems.set([]);
    this.selectedCreator.set(null);
    this.selectedCreatorContent.set([]);
    this.campaigns.set([]);
    this.activeCampaignId.set(null);
  }

  fetchOverview(campaignId?: number | null, force = false): Observable<any> {
    const key = `overview_${campaignId ?? 'all'}`;
    if (!force && this.isFresh(key) && (this.overview().spend > 0 || this.overview().totalAgencies > 0 || this.overview().totalCreators > 0)) {
      return of(this.overview());
    }

    let params = new HttpParams();
    if (campaignId != null) {
      params = params.set('campaignId', String(campaignId));
    }
    return this.http.get<any>(`${this.apiUrl}/overview`, { params }).pipe(
      tap(dto => {
        let filledSlots = 0;
        let totalSlots = 0;
        if (dto.contentRatio && dto.contentRatio.includes('/')) {
          const parts = dto.contentRatio.split('/');
          filledSlots = parseInt(parts[0].trim(), 10) || 0;
          totalSlots = parseInt(parts[1].trim(), 10) || 0;
        }

        this.overview.set({
          spend: dto.totalAgreedSpend || 0,
          views: dto.views || 0,
          likes: dto.likes || 0,
          comments: dto.comments || 0,
          onboardedAgencies: dto.agenciesCount || 0,
          totalAgencies: dto.agenciesCount || 0,
          totalCreators: dto.creatorsCount || 0,
          contentSlotsFilled: filledSlots,
          totalContentSlots: totalSlots,
          missingUrlsCount: dto.missingUrlsCount || 0,
          awaitingInsightsCount: dto.awaitingInsightsCount || 0,
          coveragePercent: dto.coveragePercent || 0,
          activeCampaignName: dto.campaignName || 'No Active Campaign'
        });

        if (dto.campaigns) {
          this.campaigns.set(dto.campaigns);
        }
        this.activeCampaignId.set(dto.activeCampaignId ?? null);
        this.lastFetchTime[key] = Date.now();
      })
    );
  }

  fetchCampaigns(force = false): Observable<Campaign[]> {
    const key = 'campaigns';
    if (!force && this.isFresh(key) && this.campaigns().length > 0) {
      return of(this.campaigns());
    }
    return this.http.get<Campaign[]>(`${this.apiUrl}/campaigns`).pipe(
      tap(data => {
        this.campaigns.set(data);
        this.lastFetchTime[key] = Date.now();
      })
    );
  }

  createCampaign(name: string, timeframe: string, totalAgreedSpend: number, assignedAgencyNames?: string): Observable<any> {
    this.invalidateCache('campaign');
    this.invalidateCache('overview');
    return this.http.post<any>(`${this.apiUrl}/campaigns`, {
      name,
      timeframe,
      totalAgreedSpend,
      assignedAgencyNames,
      status: 'ACTIVE'
    }).pipe(
      tap(created => {
        this.fetchCampaigns(true).subscribe();
        this.fetchOverview(created?.id, true).subscribe();
      })
    );
  }

  updateCampaign(id: number, payload: Partial<Campaign>): Observable<Campaign> {
    this.invalidateCache('campaign');
    this.invalidateCache('overview');
    return this.http.put<Campaign>(`${this.apiUrl}/campaigns/${id}`, payload).pipe(
      tap(() => {
        this.fetchCampaigns(true).subscribe();
        this.fetchOverview(this.activeCampaignId(), true).subscribe();
      })
    );
  }

  deleteCampaign(id: number): Observable<any> {
    this.invalidateCache('campaign');
    this.invalidateCache('overview');
    return this.http.delete<any>(`${this.apiUrl}/campaigns/${id}`).pipe(
      tap(() => {
        this.fetchCampaigns(true).subscribe();
        this.fetchOverview(null, true).subscribe();
      })
    );
  }

  fetchBrands(force = false): Observable<Brand[]> {
    const key = 'brands';
    if (!force && this.isFresh(key) && this.brands().length > 0) {
      return of(this.brands());
    }
    return this.http.get<Brand[]>(`${this.apiUrl}/brands`).pipe(
      tap(data => {
        this.brands.set(data);
        this.lastFetchTime[key] = Date.now();
      })
    );
  }

  createBrand(brand: Partial<Brand>): Observable<Brand> {
    this.invalidateCache('brand');
    return this.http.post<Brand>(`${this.apiUrl}/brands`, brand).pipe(
      tap(() => {
        this.fetchBrands(true).subscribe();
      })
    );
  }

  updateBrand(id: number, payload: Partial<Brand>): Observable<Brand> {
    this.invalidateCache('brand');
    return this.http.put<Brand>(`${this.apiUrl}/brands/${id}`, payload).pipe(
      tap(() => {
        this.fetchBrands(true).subscribe();
      })
    );
  }

  updateBrandStatus(id: number, status: string): Observable<Brand> {
    this.invalidateCache('brand');
    return this.http.patch<Brand>(`${this.apiUrl}/brands/${id}/status`, { status }).pipe(
      tap(() => {
        this.fetchBrands(true).subscribe();
      })
    );
  }

  deleteBrand(id: number): Observable<any> {
    this.invalidateCache('brand');
    this.invalidateCache('agency');
    this.invalidateCache('overview');
    return this.http.delete<any>(`${this.apiUrl}/brands/${id}`).pipe(
      tap(() => {
        this.fetchBrands(true).subscribe();
      })
    );
  }

  resendBrandInvite(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/brands/${id}/resend-invite`, {});
  }

  approveBrand(brandId: number): Observable<Brand> {
    this.invalidateCache('brand');
    return this.http.post<Brand>(`${this.apiUrl}/brands/${brandId}/approve`, {}).pipe(
      tap(() => {
        this.fetchBrands(true).subscribe();
      })
    );
  }

  approveAgency(agencyId: number): Observable<any> {
    this.invalidateCache('agency');
    this.invalidateCache('overview');
    return this.http.post<any>(`${this.apiUrl}/agencies/${agencyId}/approve`, {}).pipe(
      tap(() => {
        this.fetchAgencies(true).subscribe();
        this.fetchOverview(null, true).subscribe();
      })
    );
  }

  fetchAgencies(force = false): Observable<any[]> {
    const key = 'agencies';
    if (!force && this.isFresh(key) && this.agencies().length > 0) {
      return of(this.agencies());
    }
    return this.http.get<any[]>(`${this.apiUrl}/agencies`).pipe(
      tap(data => {
        const mapped: Agency[] = data.map(item => ({
          id: item.id,
          name: item.name,
          email: item.contactEmail || '',
          category: item.category || 'Creator Representation',
          creatorsCount: item.creatorCount ?? item.creatorsCount ?? 0,
          contentSlots: item.insightsSlots || item.slotsRatio || '0 / 0',
          spend: item.agreedSpend || 0,
          status: item.status || 'ACTIVE',
          joinedDate: '2026',
          avatarColor: item.badgeColor || '#243F82',
          websiteUrl: item.websiteUrl || '',
          logoUrl: item.logoUrl || '',
          brandId: item.brandId,
          brandName: item.brandName || ''
        }));
        this.agencies.set(mapped);
        this.lastFetchTime[key] = Date.now();
      })
    );
  }

  inviteAgency(name: string, email: string, category: string, websiteUrl = '', brandId?: number, brandName?: string, logoUrl?: string): Observable<any> {
    this.invalidateCache('agency');
    this.invalidateCache('overview');
    const payload = { name, contactEmail: email, category, websiteUrl, logoUrl, brandId, brandName };
    return this.http.post<any>(`${this.apiUrl}/agencies/invite`, payload).pipe(
      tap(saved => {
        if (saved) {
          const newAgency: Agency = {
            id: saved.id,
            name: saved.name || name,
            email: saved.contactEmail || email,
            category: saved.category || category,
            creatorsCount: saved.creatorsCount || 0,
            contentSlots: saved.contentSlots || '0 / 0',
            spend: saved.agreedSpend || saved.spend || 0,
            status: saved.status || 'ACTIVE',
            joinedDate: '2026',
            avatarColor: saved.avatarColor || saved.badgeColor || '#243F82',
            websiteUrl: saved.websiteUrl || websiteUrl,
            logoUrl: saved.logoUrl || logoUrl || '',
            brandId: saved.brandId ?? brandId,
            brandName: saved.brandName ?? brandName
          };
          this.agencies.update(prev => {
            const exists = prev.some(a => a.id === newAgency.id || a.email.toLowerCase() === newAgency.email.toLowerCase());
            return exists ? prev.map(a => a.id === newAgency.id ? newAgency : a) : [newAgency, ...prev];
          });
        }
        this.fetchOverview(null, true).subscribe();
      })
    );
  }

  updateAgency(id: number, payload: Partial<Agency>): Observable<any> {
    this.invalidateCache('agency');
    this.invalidateCache('overview');
    // Optimistic UI update for instant 0ms user feedback
    this.agencies.update(prev => prev.map(a => a.id === id ? { ...a, ...payload } : a));
    return this.http.put<any>(`${this.apiUrl}/agencies/${id}`, payload).pipe(
      tap(() => {
        this.fetchOverview(null, true).subscribe();
      })
    );
  }

  updateAgencyStatus(id: number, status: string): Observable<any> {
    this.invalidateCache('agency');
    this.agencies.update(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    return this.http.patch<any>(`${this.apiUrl}/agencies/${id}/status`, { status });
  }

  deleteAgency(id: number): Observable<any> {
    this.invalidateCache('agency');
    this.invalidateCache('overview');
    this.invalidateCache('creator');
    const previous = this.agencies();
    // Optimistic UI removal — instantly disappears from table in 0ms!
    this.agencies.update(prev => prev.filter(a => a.id !== id));
    return this.http.delete<any>(`${this.apiUrl}/agencies/${id}`).pipe(
      tap({
        next: () => {
          this.fetchOverview(null, true).subscribe();
        },
        error: () => {
          this.agencies.set(previous);
        }
      })
    );
  }

  resendAgencyInvite(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/agencies/${id}/resend-invite`, {});
  }

  fetchCreators(agency?: string, force = false): Observable<Creator[]> {
    const key = `creators_${agency || 'all'}`;
    if (!force && this.isFresh(key) && this.creators().length > 0) {
      return of(this.creators());
    }
    let params = new HttpParams();
    if (agency && agency !== 'All') {
      params = params.set('agency', agency);
    }
    return this.http.get<Creator[]>(`${this.apiUrl}/creators`, { params }).pipe(
      tap(data => {
        this.creators.set(data);
        this.lastFetchTime[key] = Date.now();
      })
    );
  }

  fetchCreatorDetail(handle: string, force = false): Observable<CreatorDetailResponse> {
    const formatted = handle.startsWith('@') ? handle : `@${handle}`;
    const key = `creator_${formatted.toLowerCase()}`;
    const current = this.selectedCreator();
    if (!force && this.isFresh(key) && current && current.handle.toLowerCase() === formatted.toLowerCase()) {
      return of({ creator: current, contentItems: this.selectedCreatorContent() });
    }
    return this.http.get<CreatorDetailResponse>(`${this.apiUrl}/creators/${encodeURIComponent(formatted)}`).pipe(
      tap(resp => {
        this.selectedCreator.set(resp.creator);
        this.selectedCreatorContent.set(resp.contentItems || []);
        this.lastFetchTime[key] = Date.now();
      })
    );
  }

  lookupCreatorByHandle(handle: string, agency?: string, save = false): Observable<Creator> {
    let params = new HttpParams()
      .set('handle', handle.trim())
      .set('save', String(save));
    if (agency && agency !== 'All') {
      params = params.set('agency', agency);
    }
    return this.http.get<Creator>(`${this.apiUrl}/creators/lookup`, { params }).pipe(
      tap(() => {
        if (save) {
          this.invalidateCache('creator');
          this.invalidateCache('overview');
          this.fetchCreators(undefined, true).subscribe();
        }
      })
    );
  }

  fetchContent(status?: string, agency?: string, force = false): Observable<ContentItem[]> {
    const key = `content_${status || 'all'}_${agency || 'all'}`;
    if (!force && this.isFresh(key) && this.contentItems().length > 0) {
      return of(this.contentItems());
    }
    let params = new HttpParams();
    if (status && status !== 'ALL') {
      params = params.set('status', status);
    }
    if (agency && agency !== 'ALL') {
      params = params.set('agency', agency);
    }

    return this.http.get<ContentItem[]>(`${this.apiUrl}/content`, { params }).pipe(
      tap(data => {
        this.contentItems.set(data);
        this.lastFetchTime[key] = Date.now();
      })
    );
  }

  addContentItem(item: Partial<ContentItem>): Observable<ContentItem> {
    this.invalidateCache('content');
    this.invalidateCache('creator');
    this.invalidateCache('overview');
    const payload = {
      creatorHandle: item.creatorHandle,
      agencyName: item.agencyName,
      title: item.title,
      contentUrl: item.contentUrl,
      format: item.format,
      views: item.views || 0,
      likes: item.likes || 0,
      comments: item.comments || 0,
      finalPrice: item.finalPrice || 0
    };
    return this.http.post<ContentItem>(`${this.apiUrl}/content`, payload).pipe(
      tap(saved => {
        this.contentItems.update(prev => [saved, ...prev]);
        this.fetchOverview(null, true).subscribe();
      })
    );
  }

  updateContentItem(id: number, item: Partial<ContentItem>): Observable<ContentItem> {
    this.invalidateCache('content');
    this.invalidateCache('creator');
    this.invalidateCache('overview');
    return this.http.put<ContentItem>(`${this.apiUrl}/content/${id}`, item).pipe(
      tap(updated => {
        this.contentItems.update(prev => prev.map(c => c.id === updated.id ? updated : c));
        this.selectedCreatorContent.update(prev => prev.map(c => c.id === updated.id ? updated : c));
        this.fetchOverview(null, true).subscribe();
      })
    );
  }

  deleteContentItem(id: number): Observable<any> {
    this.invalidateCache('content');
    this.invalidateCache('creator');
    this.invalidateCache('overview');
    return this.http.delete<any>(`${this.apiUrl}/content/${id}`).pipe(
      tap(() => {
        this.contentItems.update(prev => prev.filter(c => c.id !== id));
        this.selectedCreatorContent.update(prev => prev.filter(c => c.id !== id));
        this.fetchOverview(null, true).subscribe();
      })
    );
  }

  addCreator(creator: Partial<Creator>): Observable<Creator> {
    this.invalidateCache('creator');
    this.invalidateCache('overview');
    return this.http.post<Creator>(`${this.apiUrl}/creators`, creator).pipe(
      tap(saved => {
        if (saved) {
          this.creators.update(prev => [saved, ...prev.filter(c => c.handle.toLowerCase() !== saved.handle.toLowerCase())]);
        }
        this.fetchOverview(null, true).subscribe();
      })
    );
  }

  updateCreator(id: number, creator: Partial<Creator>): Observable<Creator> {
    this.invalidateCache('creator');
    this.invalidateCache('overview');
    // Optimistic UI updates
    this.creators.update(prev => prev.map(c => c.id === id ? { ...c, ...creator } : c));
    if (this.selectedCreator()?.id === id) {
      this.selectedCreator.update(c => c ? { ...c, ...creator } : null);
    }
    return this.http.put<Creator>(`${this.apiUrl}/creators/${id}`, creator).pipe(
      tap(updated => {
        if (updated) {
          this.selectedCreator.set(updated);
          this.creators.update(prev => prev.map(c => c.id === updated.id ? updated : c));
        }
        this.fetchOverview(null, true).subscribe();
      })
    );
  }

  deleteCreator(id: number): Observable<any> {
    this.invalidateCache('creator');
    this.invalidateCache('content');
    this.invalidateCache('overview');
    const previous = this.creators();
    // Optimistic UI removal — instantly disappears from roster in 0ms!
    this.creators.update(prev => prev.filter(c => c.id !== id));
    return this.http.delete<any>(`${this.apiUrl}/creators/${id}`).pipe(
      tap({
        next: () => {
          this.fetchOverview(null, true).subscribe();
        },
        error: () => {
          this.creators.set(previous);
        }
      })
    );
  }

  syncInstagram(contentId: number): Observable<ContentItem> {
    this.invalidateCache('content');
    this.invalidateCache('creator');
    this.invalidateCache('overview');
    return this.http.post<ContentItem>(`${this.apiUrl}/content/${contentId}/sync-instagram`, {}).pipe(
      tap(updated => {
        this.contentItems.update(prev => prev.map(c => c.id === updated.id ? updated : c));
        this.fetchOverview(null, true).subscribe();
      })
    );
  }
}
