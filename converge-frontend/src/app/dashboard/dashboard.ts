import { Component, inject, OnInit, computed, signal, HostListener, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PortalService, Brand, Agency, Campaign } from '../services/portal.service';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { ConfirmService } from '../services/confirm.service';
import { ExcelExportService } from '../services/excel-export.service';
import { CustomSelectComponent } from '../shared/custom-select/custom-select.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, CustomSelectComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {
  private portalService = inject(PortalService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);
  private confirmService = inject(ConfirmService);
  private excelExportService = inject(ExcelExportService);
  private route = inject(ActivatedRoute);

  user = this.authService.currentUser;
  isAdmin = computed(() => this.user()?.role === 'SYSTEM_ADMIN');
  isAgency = computed(() => this.user()?.role === 'AGENCY_MANAGER');
  isBrand = computed(() => this.user()?.role === 'BRAND_MANAGER');

  overview = this.portalService.overview;
  agencies = this.portalService.agencies;
  brands = this.portalService.brands;
  campaigns = this.portalService.campaigns;
  creators = this.portalService.creators;
  contentItems = this.portalService.contentItems;
  selectedCampaignId = signal<number | null>(null);

  // Superadmin Mesh UI State
  adminTab = signal<'overview' | 'brands' | 'settings'>('overview');
  brandStatusFilter = signal<'ALL' | 'ACTIVE' | 'PENDING_APPROVAL' | 'DEACTIVATED'>('ALL');
  brandCategoryFilter = signal<string>('ALL');
  brandPage = signal(1);
  readonly brandPageSize = 10;
  selectedBrandDrawer = signal<Brand | null>(null);
  openBrandActionMenuId = signal<number | null>(null);
  isRefreshingAdmin = signal(false);
  brandModalShake = signal(false);
  adminSearchQuery = this.portalService.adminSearchQuery;
  newBrandManagerName = '';

  private lastOnboardTrigger = 0;
  private onboardEffect = effect(() => {
    const trigger = this.portalService.onboardBrandTrigger();
    if (trigger > this.lastOnboardTrigger) {
      this.lastOnboardTrigger = trigger;
      this.openBrandModal = true;
    }
  });

  activeBrandsCount = computed(() =>
    this.brands().filter(b => !b.status || b.status === 'ACTIVE').length
  );
  pendingBrandsCount = computed(() =>
    this.brands().filter(b => b.status === 'PENDING_APPROVAL').length
  );
  deactivatedBrandsCount = computed(() =>
    this.brands().filter(b => b.status === 'DEACTIVATED').length
  );
  activeAgenciesCount = computed(() =>
    this.agencies().filter(a => !a.status || a.status === 'ACTIVE').length
  );
  pendingAgenciesCount = computed(() =>
    this.agencies().filter(a => a.status === 'PENDING_APPROVAL').length
  );
  totalCreatorsMetric = computed(() =>
    this.overview().totalCreators || this.creators().length
  );
  agenciesPerBrand = computed(() => {
    const bCount = this.brands().length;
    if (bCount === 0) return '0.0';
    return (this.agencies().length / bCount).toFixed(1);
  });

  getCreatorsForBrand(brand: Brand) {
    const brandAgencies = this.getAgenciesForBrand(brand);
    const agencyNames = new Set(brandAgencies.map(a => (a.name || '').toLowerCase()).filter(Boolean));
    return this.creators().filter(c => c.agencyName && agencyNames.has(c.agencyName.toLowerCase()));
  }

  getCreatorsCountForBrand(brand: Brand): number {
    const matched = this.getCreatorsForBrand(brand).length;
    if (matched > 0) return matched;
    return this.getAgenciesForBrand(brand).reduce((sum, a) => sum + (a.creatorsCount || 0), 0);
  }

  refreshAdminMesh(): void {
    if (this.isRefreshingAdmin()) return;
    this.isRefreshingAdmin.set(true);
    this.portalService.fetchOverview(null, true).subscribe();
    this.portalService.fetchBrands(true).subscribe();
    this.portalService.fetchAgencies(true).subscribe();
    this.portalService.fetchCreators(undefined, true).subscribe();
    this.portalService.fetchCampaigns(true).subscribe();
    setTimeout(() => {
      this.isRefreshingAdmin.set(false);
      this.toast.success('Mesh Synced', 'Latest ecosystem telemetry loaded from database.');
    }, 450);
  }

  donutStats = computed(() => {
    const bCount = this.brands().length;
    const aCount = this.agencies().length;
    const cCount = this.totalCreatorsMetric();
    const total = bCount + aCount + cCount;
    const circ = 402.12; // 2 * PI * 64
    if (total === 0) {
      return {
        total: 0,
        brandsCount: 0,
        agenciesCount: 0,
        creatorsCount: 0,
        brandsPct: 0,
        agenciesPct: 0,
        creatorsPct: 0,
        brandsDash: `0 ${circ}`,
        agenciesDash: `0 ${circ}`,
        creatorsDash: `0 ${circ}`,
        brandsOffset: 0,
        agenciesOffset: 0,
        creatorsOffset: 0
      };
    }
    const bLen = (bCount / total) * circ;
    const aLen = (aCount / total) * circ;
    const cLen = (cCount / total) * circ;
    return {
      total,
      brandsCount: bCount,
      agenciesCount: aCount,
      creatorsCount: cCount,
      brandsPct: Math.round((bCount / total) * 100),
      agenciesPct: Math.round((aCount / total) * 100),
      creatorsPct: Math.round((cCount / total) * 100),
      brandsDash: `${bLen.toFixed(2)} ${circ}`,
      agenciesDash: `${aLen.toFixed(2)} ${circ}`,
      creatorsDash: `${cLen.toFixed(2)} ${circ}`,
      brandsOffset: 0,
      agenciesOffset: -bLen,
      creatorsOffset: -(bLen + aLen)
    };
  });

  filteredAdminBrands = computed(() => {
    const q = this.adminSearchQuery().trim().toLowerCase();
    const status = this.brandStatusFilter();
    const cat = this.brandCategoryFilter();
    return this.brands().filter(b => {
      const normalizedStatus = b.status || 'ACTIVE';
      if (status !== 'ALL' && normalizedStatus !== status) return false;
      if (cat !== 'ALL' && (b.category || '') !== cat) return false;
      if (q) {
        const hay = `${b.name || ''} ${b.primaryManagerEmail || ''} ${b.contactEmail || ''} ${b.category || ''} ${b.websiteUrl || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  });

  brandTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredAdminBrands().length / this.brandPageSize))
  );

  paginatedAdminBrands = computed(() => {
    const page = Math.min(this.brandPage(), this.brandTotalPages());
    const start = (page - 1) * this.brandPageSize;
    return this.filteredAdminBrands().slice(start, start + this.brandPageSize);
  });

  recentEcosystemActivity = computed(() => {
    const items: Array<{ title: string; detail: string; time: string; tone: 'emerald' | 'amber' | 'neutral' }> = [];
    for (const b of this.brands().slice(0, 3)) {
      items.push({
        title: `Brand workspace "${b.name}"`,
        detail: `${b.primaryManagerEmail || b.contactEmail} · ${b.category || 'General'}`,
        time: b.status === 'PENDING_APPROVAL' ? 'Pending' : (b.status || 'ACTIVE'),
        tone: b.status === 'PENDING_APPROVAL' ? 'amber' : 'emerald'
      });
    }
    for (const a of this.agencies().slice(0, 2)) {
      items.push({
        title: `Agency "${a.name}"`,
        detail: a.brandName ? `Linked to ${a.brandName}` : (a.email || 'Partner agency'),
        time: a.status === 'PENDING_APPROVAL' ? 'Pending' : (a.status || 'ACTIVE'),
        tone: a.status === 'PENDING_APPROVAL' ? 'amber' : 'neutral'
      });
    }
    return items.slice(0, 5);
  });

  getBrandSlug(name: string): string {
    return (name || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'brand-workspace';
  }

  setBrandStatusFilter(status: 'ALL' | 'ACTIVE' | 'PENDING_APPROVAL' | 'DEACTIVATED'): void {
    this.brandStatusFilter.set(status);
    this.brandPage.set(1);
  }

  setBrandCategoryFilter(cat: string): void {
    this.brandCategoryFilter.set(cat);
    this.brandPage.set(1);
  }

  clearBrandFilters(): void {
    this.portalService.adminSearchQuery.set('');
    this.brandStatusFilter.set('ALL');
    this.brandCategoryFilter.set('ALL');
    this.brandPage.set(1);
  }

  activeAnalyticsTab = signal<'performance' | 'agency' | 'creator'>('performance');
  setAnalyticsTab(tab: 'performance' | 'agency' | 'creator') {
    this.activeAnalyticsTab.set(tab);
  }

  brandDisplayName = computed(() => {
    return this.user()?.organizationName || 'Aster & Co.';
  });

  currentMonthYear = computed(() => {
    const now = new Date();
    return now.toLocaleDateString('en-US', { month: 'long' }).toUpperCase();
  });

  activeCampaignSubtitle = computed(() => {
    const camp = this.selectedCampaign();
    if (camp) {
      return `${camp.name} · Partnership overview`;
    }
    if (this.overview().activeCampaignName) {
      return `${this.overview().activeCampaignName} · Partnership overview`;
    }
    return 'Consolidated · Partnership overview';
  });

  chartPeriodText = computed(() => {
    const camp = this.selectedCampaign();
    if (camp?.timeframe) return camp.timeframe;
    const dates = this.chartDates();
    if (dates.length >= 2) {
      return `${dates[0]} – ${dates[dates.length - 1]}, 2026`;
    }
    return 'Current Period';
  });

  formatMetricNumber(num: number): string {
    if (!num || num === 0) return '0';
    if (num >= 1_000_000) {
      const m = num / 1_000_000;
      return (m % 1 === 0 ? m.toFixed(0) : m.toFixed(2)) + 'M';
    }
    if (num >= 10_000) {
      const k = num / 1_000;
      return (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + 'K';
    }
    if (num >= 1_000) {
      return num.toLocaleString('en-IN');
    }
    return String(num);
  }

  formattedViews = computed(() => this.formatMetricNumber(this.overview().views || 0));

  formattedEngagements = computed(() => {
    const eng = (this.overview().likes || 0) + (this.overview().comments || 0);
    return this.formatMetricNumber(eng);
  });

  formattedSpend = computed(() => this.formatInr(this.overview().spend || 0));

  totalContentCount = computed(() => this.contentItems().length);

  briefsCountText = computed(() => {
    const count = this.creators().length;
    return `${count} of ${count || 24} shared`;
  });

  urlsCountText = computed(() => {
    const added = this.contentItems().filter(i => !!i.contentUrl).length;
    const total = Math.max(this.contentItems().length, this.overview().totalContentSlots, 1);
    return `${added} of ${total} added`;
  });

  insightsCountText = computed(() => {
    const withIns = this.withInsightsCount();
    const total = Math.max(this.contentItems().length, this.overview().totalContentSlots, 1);
    return `${withIns} of ${total} available`;
  });

  followUpDescription = computed(() => {
    const missing = this.missingUrlsCount();
    const awaiting = this.awaitingInsightsCount();
    if (missing === 0 && awaiting === 0) {
      return 'All content deliverables verified with authorized insights';
    }
    const parts: string[] = [];
    if (missing > 0) parts.push(`${missing} content URLs missing`);
    if (awaiting > 0) parts.push(`${awaiting} awaiting authorized insights`);
    return parts.join(' ');
  });

  withInsightsCount = computed(() => this.contentItems().filter(i => i.status === 'WITH_INSIGHTS').length);
  missingUrlsCount = computed(() => this.contentItems().filter(i => i.status === 'MISSING_URL' || !i.contentUrl).length);
  awaitingInsightsCount = computed(() => this.contentItems().filter(i => i.status === 'AWAITING_INSIGHTS').length);
  coveragePercent = computed(() => {
    const total = this.contentItems().length;
    if (total === 0) return 0;
    return Math.round((this.withInsightsCount() / total) * 100);
  });

  deskSegments = computed(() => {
    const totalSlots = Math.max(1, this.contentItems().length, this.overview().totalContentSlots);
    const withInsights = this.withInsightsCount();
    const awaiting = this.awaitingInsightsCount();
    const missing = this.missingUrlsCount();

    if (this.contentItems().length === 0) {
      return {
        insightsWidth: 40,
        awaitingWidth: 25,
        missingWidth: 15,
        remainingWidth: 20
      };
    }

    const pWithInsights = Math.max(4, Math.round((withInsights / totalSlots) * 100));
    const pAwaiting = Math.max(4, Math.round((awaiting / totalSlots) * 100));
    const pMissing = Math.max(4, Math.round((missing / totalSlots) * 100));
    const pRemaining = Math.max(4, 100 - (pWithInsights + pAwaiting + pMissing));

    return {
      insightsWidth: pWithInsights,
      awaitingWidth: pAwaiting,
      missingWidth: pMissing,
      remainingWidth: pRemaining
    };
  });

  agencyBreakdown = computed(() => {
    const agList = this.agencies();
    const allItems = this.contentItems();
    const allCreators = this.creators();
    const totalViews = this.overview().views || 1;
    const colors = ['#3D5EAB', '#527E5A', '#E4664B', '#E5A83B', '#8B5CF6', '#06B6D4'];

    if (agList.length === 0) return [];

    return agList.map((ag, idx) => {
      const agCreators = allCreators.filter(c => c.agencyName && c.agencyName.toLowerCase() === ag.name.toLowerCase());
      const agItems = allItems.filter(i => i.agencyName && i.agencyName.toLowerCase() === ag.name.toLowerCase());
      const agViews = agItems.reduce((acc, curr) => acc + (curr.views || 0), 0);
      const agSpend = ag.spend || agCreators.reduce((acc, curr) => acc + (curr.price || 0), 0);
      const viewsShare = Math.round((agViews / Math.max(1, totalViews)) * 100);

      return {
        name: ag.name,
        creatorsCount: agCreators.length || ag.creatorsCount || 0,
        spend: agSpend,
        views: agViews,
        viewsShare: Math.min(100, Math.max(8, viewsShare)),
        color: colors[idx % colors.length]
      };
    });
  });

  creatorBreakdown = computed(() => {
    const allCreators = this.creators();
    const allItems = this.contentItems();
    const totalViews = this.overview().views || 1;
    const colors = ['#3D5EAB', '#527E5A', '#E4664B', '#E5A83B', '#8B5CF6'];

    if (allCreators.length === 0) return [];

    return allCreators.slice(0, 5).map((cr, idx) => {
      const crItems = allItems.filter(i => i.creatorHandle && i.creatorHandle.toLowerCase() === cr.handle.toLowerCase());
      const crViews = cr.views || crItems.reduce((acc, curr) => acc + (curr.views || 0), 0);
      const viewsShare = Math.round((crViews / Math.max(1, totalViews)) * 100);

      return {
        name: cr.name,
        handle: cr.handle,
        agencyName: cr.agencyName || 'Partner Agency',
        deliverablesCount: crItems.length,
        price: cr.price,
        views: crViews,
        viewsShare: Math.min(100, Math.max(10, viewsShare)),
        color: colors[idx % colors.length]
      };
    });
  });

  chartDates = computed(() => {
    const now = new Date();
    const dates: string[] = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 7 * 86400000);
      dates.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
    return dates;
  });

  viewsLinePath = computed(() => {
    const views = this.overview().views || 0;
    if (views === 0) {
      return 'M 0 100 Q 150 95, 300 90 T 600 85';
    }
    return 'M 0 105 C 100 95, 150 70, 240 65 C 320 60, 380 40, 480 32 C 540 28, 570 20, 600 15';
  });

  viewsAreaPath = computed(() => {
    const line = this.viewsLinePath();
    return `${line} L 600 120 L 0 120 Z`;
  });

  engagementsLinePath = computed(() => {
    const likes = this.overview().likes || 0;
    if (likes === 0) {
      return 'M 0 112 Q 150 110, 300 108 T 600 105';
    }
    return 'M 0 110 C 120 105, 180 92, 260 88 C 340 84, 420 75, 500 70 C 550 68, 580 62, 600 60';
  });

  async exportReport(): Promise<void> {
    if (this.isAgency()) {
      this.toast.error('Access Restricted', 'Campaign report export is reserved for Brand workspaces.');
      return;
    }
    try {
      await this.excelExportService.generateExecutiveReport({
        brandName: this.user()?.organizationName || 'Bioderma',
        campaignName: this.selectedCampaign()?.name || this.overview().activeCampaignName,
        timeframe: this.selectedCampaign()?.timeframe,
        overview: this.overview(),
        agencies: this.agencies(),
        creators: this.creators(),
        contentItems: this.contentItems(),
        campaigns: this.campaigns()
      });
      this.toast.success('MD Report Generated', 'Executive 5-Sheet Excel workbook downloaded successfully.');
    } catch (err: any) {
      this.toast.error('Export Failed', err.message || 'Could not generate report.');
    }
  }

  selectedCampaign = computed(() => {
    const id = this.selectedCampaignId();
    if (id == null) return null;
    return this.campaigns().find(c => c.id === id) || null;
  });

  selectCampaign(id: number | null) {
    this.selectedCampaignId.set(id);
    this.portalService.fetchOverview(id).subscribe();
  }

  async deleteCampaign(camp: Campaign) {
    if (!camp.id) return;
    const confirmed = await this.confirmService.confirm({
      title: 'Delete Campaign?',
      message: `Are you sure you want to delete campaign "${camp.name}"?`,
      detail: `All campaign performance analytics and deliverables will be archived.`,
      confirmText: 'Delete Campaign',
      variant: 'danger'
    });
    if (!confirmed) return;
    this.portalService.deleteCampaign(camp.id).subscribe({
      next: () => {
        this.toast.success('Campaign Deleted', `Campaign "${camp.name}" has been removed.`);
        if (this.selectedCampaignId() === camp.id) {
          this.selectCampaign(null);
        }
      },
      error: (err) => {
        this.toast.error('Delete Failed', err.message || 'Could not delete campaign.');
      }
    });
  }

  activeAgencyNames = computed(() => {
    const names = this.agencies().map(a => a.name);
    return names.length > 0 ? names.join(', ') : 'No partner agencies onboarded yet';
  });

  agenciesForBrand(brand: Brand): string {
    const matching = this.getAgenciesForBrand(brand);
    if (matching.length > 0) {
      return matching.map(a => a.name).join(', ');
    }
    return 'No agencies assigned yet';
  }

  getAgenciesForBrand(brand: Brand): Agency[] {
    return this.agencies().filter(
      a => (brand.id && a.brandId === brand.id) || (brand.name && a.brandName?.toLowerCase() === brand.name.toLowerCase())
    );
  }

  unassignedAgencies = computed(() => {
    const brandIds = new Set(this.brands().map(b => b.id).filter((id): id is number => id != null));
    const brandNames = new Set(this.brands().map(b => b.name?.toLowerCase()).filter(Boolean));
    return this.agencies().filter(
      a => (!a.brandId || !brandIds.has(a.brandId)) && (!a.brandName || !brandNames.has(a.brandName.toLowerCase()))
    );
  });

  openBrandModal = false;
  openEditBrandModal = false;
  openCampaignModal = false;

  // In-flight request locks to prevent multiple clicking
  readonly processingBrandId = signal<number | null>(null);
  readonly processingBrandAction = signal<string>('');
  readonly processingAgencyId = signal<number | null>(null);
  readonly isSubmittingBrand = signal(false);
  readonly isSubmittingEditBrand = signal(false);
  readonly isSubmittingCampaign = signal(false);

  // New Brand Form (Admin only — single Brand Manager Email)
  readonly primaryVerticals = [
    'Lifestyle & Wellness',
    'Fashion & Beauty',
    'Tech & Modern Work',
    'Creative & Culture',
    'Food & Beverage',
    'Retail & E-Commerce'
  ];

  newBrandName = '';
  newBrandWebsiteUrl = '';
  newBrandLogoUrl = '';
  newBrandManagerEmail = '';
  newBrandCategory = 'Lifestyle & Wellness';

  // Edit Brand Form (Admin only)
  editingBrandId: number | null = null;
  editBrandName = '';
  editBrandWebsiteUrl = '';
  editBrandLogoUrl = '';
  editBrandManagerEmail = '';
  editBrandCategory = 'Lifestyle & Wellness';

  extractDomain(url: string): string {
    if (!url) return '';
    return url.trim()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .split('?')[0]
      .toLowerCase();
  }

  fetchBrandLogo(target: 'new' | 'edit'): void {
    const url = target === 'new' ? this.newBrandWebsiteUrl : this.editBrandWebsiteUrl;
    const domain = this.extractDomain(url);
    if (!domain) {
      this.toast.info('Enter Website', 'Please enter a valid website URL first (e.g. bioderma.com)');
      return;
    }
    const logo = `https://unavatar.io/${domain}`;
    if (target === 'new') {
      this.newBrandLogoUrl = logo;
    } else {
      this.editBrandLogoUrl = logo;
    }
    this.toast.success('Logo Detected', `Brand logo successfully extracted for ${domain}`);
  }

  // New Campaign Form (Brand Manager only)
  newCampaignName = '';
  newCampaignStartDate = '';
  newCampaignEndDate = '';
  newCampaignTimeframe = '';
  newCampaignBudget: number | null = null;
  selectedCampaignAgencies: string[] = [];

  readonly openMenuId = signal<number | null>(null);

  toggleActionMenu(id?: number, e?: Event) {
    if (e) e.stopPropagation();
    if (!id) return;
    this.openMenuId.update(curr => (curr === id ? null : id));
  }

  closeMenu() {
    this.openMenuId.set(null);
  }

  @HostListener('document:click')
  onDocClick(): void {
    this.closeMenu();
  }

  isAgencySelectedForCampaign(name: string): boolean {
    return this.selectedCampaignAgencies.includes(name);
  }

  toggleCampaignAgency(name: string): void {
    const idx = this.selectedCampaignAgencies.indexOf(name);
    if (idx >= 0) {
      this.selectedCampaignAgencies.splice(idx, 1);
    } else {
      this.selectedCampaignAgencies.push(name);
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.openBrandModal = false;
    this.openEditBrandModal = false;
    this.openCampaignModal = false;
    this.selectedBrandDrawer.set(null);
    this.openBrandActionMenuId.set(null);
  }

  ngOnInit() {
    // 1. Fetch core view data using cache (0ms instant render if fresh)
    this.portalService.fetchOverview(null, false).subscribe();
    if (this.isAdmin()) {
      this.portalService.fetchBrands(false).subscribe();
      this.portalService.fetchAgencies(false).subscribe();
    } else {
      this.portalService.fetchAgencies(false).subscribe();
      this.portalService.fetchCampaigns(false).subscribe();
    }

    // 2. Stagger non-critical background data so we don't saturate Render's 0.1 vCPU at once
    setTimeout(() => {
      this.portalService.fetchCreators(undefined, false).subscribe();
      this.portalService.fetchContent(undefined, undefined, false).subscribe();
      if (this.isAdmin()) {
        this.portalService.fetchCampaigns(false).subscribe();
      }
    }, 400);

    this.route.queryParams.subscribe(params => {
      if (this.isAdmin()) {
        if (params['tab'] === 'brands') {
          this.adminTab.set('brands');
        } else if (params['tab'] === 'settings') {
          this.adminTab.set('settings');
        } else {
          this.adminTab.set('overview');
        }
      }
      if (params['campaignId']) {
        const id = Number(params['campaignId']);
        if (!isNaN(id)) {
          this.selectCampaign(id);
        }
      }
      if (params['tab'] === 'campaigns' || this.route.snapshot.url.some(s => s.path === 'campaigns')) {
        setTimeout(() => {
          const el = document.getElementById('campaign-desk');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 350);
      }
    });
  }

  async approveBrand(brand: Brand) {
    if (!brand.id || this.processingBrandId() === brand.id) return;
    const confirmed = await this.confirmService.confirm({
      title: 'Approve Brand Workspace?',
      message: `Approve "${brand.name}" and dispatch activation & Set-Password credentials?`,
      detail: `Manager Email: ${brand.primaryManagerEmail || brand.contactEmail}`,
      confirmText: 'Approve Brand',
      variant: 'primary'
    });
    if (!confirmed) return;
    this.processingBrandId.set(brand.id);
    this.processingBrandAction.set('approve');
    this.portalService.approveBrand(brand.id).subscribe({
      next: (updated) => {
        this.processingBrandId.set(null);
        this.processingBrandAction.set('');
        this.toast.success(
          'Brand Approved',
          `${updated.name} is now ACTIVE. Approval & Set-Password email sent to ${updated.primaryManagerEmail}.`
        );
      },
      error: (err) => {
        this.processingBrandId.set(null);
        this.processingBrandAction.set('');
        this.toast.error('Approval Failed', err.message || 'Could not approve brand.');
      }
    });
  }

  selectedBrandForEdit: Brand | null = null;

  openEditBrand(brand: Brand) {
    this.selectedBrandForEdit = brand;
    this.editingBrandId = brand.id ?? null;
    this.editBrandName = brand.name || '';
    this.editBrandWebsiteUrl = brand.websiteUrl || '';
    this.editBrandLogoUrl = brand.logoUrl || '';
    this.editBrandManagerEmail = brand.primaryManagerEmail || brand.contactEmail || '';
    this.editBrandCategory = brand.category || 'Lifestyle & Wellness';
    this.openEditBrandModal = true;
  }

  private isSystemAdminEmail(email: string): boolean {
    const clean = email.trim().toLowerCase();
    const currentEmail = this.user()?.email?.trim().toLowerCase();
    return clean === 'chaitanyamandviya7@gmail.com' || (!!currentEmail && clean === currentEmail);
  }

  async submitEditBrand() {
    if (!this.editingBrandId || !this.editBrandName || !this.editBrandManagerEmail || this.isSubmittingEditBrand()) return;
    if (this.isSystemAdminEmail(this.editBrandManagerEmail)) {
      this.toast.error('Security Policy Violation', 'System Administrator email cannot be assigned as a Brand Manager.');
      return;
    }
    const confirmed = await this.confirmService.confirm({
      title: 'Confirm Brand Update?',
      message: `Save updated organization details and manager email for "${this.editBrandName}"?`,
      detail: `Manager Email: ${this.editBrandManagerEmail} · Vertical: ${this.editBrandCategory}`,
      confirmText: 'Save Changes',
      variant: 'primary'
    });
    if (!confirmed) return;
    this.isSubmittingEditBrand.set(true);
    this.portalService.updateBrand(this.editingBrandId, {
      name: this.editBrandName,
      websiteUrl: this.editBrandWebsiteUrl,
      logoUrl: this.editBrandLogoUrl || undefined,
      primaryManagerEmail: this.editBrandManagerEmail,
      contactEmail: this.editBrandManagerEmail,
      category: this.editBrandCategory
    }).subscribe({
      next: (updated) => {
        this.isSubmittingEditBrand.set(false);
        this.openEditBrandModal = false;
        this.toast.success('Brand Updated', `${updated.name} (${updated.primaryManagerEmail}) has been updated.`);
      },
      error: (err) => {
        this.isSubmittingEditBrand.set(false);
        this.toast.error('Update Failed', err.error?.message || err.message || 'Could not update brand.');
      }
    });
  }

  async toggleBrandStatus(brand: Brand) {
    if (!brand.id || this.processingBrandId() === brand.id) return;
    const nextStatus = brand.status === 'DEACTIVATED' ? 'ACTIVE' : 'DEACTIVATED';
    const confirmed = await this.confirmService.confirm({
      title: nextStatus === 'ACTIVE' ? 'Activate Brand Workspace?' : 'Deactivate Brand Workspace?',
      message: nextStatus === 'ACTIVE'
        ? `Re-enable workspace access for "${brand.name}"?`
        : `Temporarily suspend login and campaign operations for "${brand.name}"?`,
      detail: `${brand.name} (${brand.primaryManagerEmail || brand.contactEmail})`,
      confirmText: nextStatus === 'ACTIVE' ? 'Activate Brand' : 'Deactivate Brand',
      variant: nextStatus === 'ACTIVE' ? 'primary' : 'warning'
    });
    if (!confirmed) return;
    this.processingBrandId.set(brand.id);
    this.processingBrandAction.set('status');
    this.portalService.updateBrandStatus(brand.id, nextStatus).subscribe({
      next: (updated) => {
        this.processingBrandId.set(null);
        this.processingBrandAction.set('');
        this.toast.info(
          nextStatus === 'ACTIVE' ? 'Brand Activated' : 'Brand Deactivated',
          `${updated.name} status is now ${nextStatus}.`
        );
      },
      error: (err) => {
        this.processingBrandId.set(null);
        this.processingBrandAction.set('');
        this.toast.error('Status Update Failed', err.message || 'Could not update brand status.');
      }
    });
  }

  async deleteBrand(brand: Brand) {
    if (!brand.id || this.processingBrandId() === brand.id) return;
    const confirmed = await this.confirmService.confirm({
      title: 'Permanently Delete Brand?',
      message: `Are you sure you want to permanently remove "${brand.name}" and revoke its manager account? This action cannot be undone.`,
      detail: `Brand: ${brand.name} · Manager: ${brand.primaryManagerEmail || brand.contactEmail}`,
      confirmText: 'Delete Brand',
      variant: 'danger'
    });
    if (!confirmed) return;
    this.processingBrandId.set(brand.id);
    this.processingBrandAction.set('delete');
    this.portalService.deleteBrand(brand.id).subscribe({
      next: () => {
        this.processingBrandId.set(null);
        this.processingBrandAction.set('');
        this.toast.success('Brand Deleted', `${brand.name} and its manager workspace have been removed.`);
      },
      error: (err) => {
        this.processingBrandId.set(null);
        this.processingBrandAction.set('');
        this.toast.error('Delete Failed', err.message || 'Could not delete brand.');
      }
    });
  }

  async resendBrandInvite(brand: Brand) {
    if (!brand.id || this.processingBrandId() === brand.id) return;
    const confirmed = await this.confirmService.confirm({
      title: 'Send Set-Password Email?',
      message: `Dispatch a fresh Set-Initial-Password invitation email to the Brand Manager for "${brand.name}"?`,
      detail: `Recipient: ${brand.primaryManagerEmail || brand.contactEmail}`,
      confirmText: 'Send Email',
      variant: 'primary'
    });
    if (!confirmed) return;
    this.processingBrandId.set(brand.id);
    this.processingBrandAction.set('mail');
    this.portalService.resendBrandInvite(brand.id).subscribe({
      next: () => {
        this.processingBrandId.set(null);
        this.processingBrandAction.set('');
        this.toast.success(
          'Onboarding Email Sent',
          `Set-Initial-Password link sent to ${brand.primaryManagerEmail}.`
        );
      },
      error: (err) => {
        this.processingBrandId.set(null);
        this.processingBrandAction.set('');
        this.toast.error('Email Failed', err.message || 'Could not trigger onboarding email.');
      }
    });
  }

  async approveAgency(agency: Agency) {
    if (!agency.id || this.processingAgencyId() === agency.id) return;
    const confirmed = await this.confirmService.confirm({
      title: 'Approve Partner Agency?',
      message: `Approve "${agency.name}" and enable Agency Portal access?`,
      detail: `Agency Manager: ${agency.email}`,
      confirmText: 'Approve Agency',
      variant: 'primary'
    });
    if (!confirmed) return;
    this.processingAgencyId.set(agency.id);
    this.portalService.approveAgency(agency.id).subscribe({
      next: () => {
        this.processingAgencyId.set(null);
        this.toast.success(
          'Agency Approved',
          `${agency.name} is now ACTIVE. Login enabled for ${agency.email}.`
        );
      },
      error: (err) => {
        this.processingAgencyId.set(null);
        this.toast.error('Approval Failed', err.message || 'Could not approve agency.');
      }
    });
  }

  private triggerBrandModalShake(): void {
    this.brandModalShake.set(false);
    setTimeout(() => this.brandModalShake.set(true), 10);
    setTimeout(() => this.brandModalShake.set(false), 500);
  }

  async submitBrand() {
    if (this.isSubmittingBrand()) return;
    if (!this.newBrandName.trim() || !this.newBrandManagerEmail.trim()) {
      this.triggerBrandModalShake();
      this.toast.error('Missing Fields', 'Please enter both a Brand Name and Brand Manager Email.');
      return;
    }
    const dupBrand = this.brands().some(
      b => (b.name || '').trim().toLowerCase() === this.newBrandName.trim().toLowerCase()
    );
    if (dupBrand) {
      this.triggerBrandModalShake();
      this.toast.error('Duplicate Brand Name', `A brand named "${this.newBrandName.trim()}" already exists.`);
      return;
    }
    if (this.isSystemAdminEmail(this.newBrandManagerEmail)) {
      this.triggerBrandModalShake();
      this.toast.error('Security Policy Violation', 'System Administrator email cannot be registered as a Brand Manager.');
      return;
    }
    const confirmed = await this.confirmService.confirm({
      title: 'Confirm Brand Onboarding?',
      message: `Provision a new Brand Workspace for "${this.newBrandName}" and send a Set-Password invitation email?`,
      detail: `Brand Manager: ${this.newBrandManagerEmail} · Vertical: ${this.newBrandCategory}`,
      confirmText: 'Onboard Brand',
      variant: 'primary'
    });
    if (!confirmed) return;
    this.isSubmittingBrand.set(true);

    this.portalService.createBrand({
      name: this.newBrandName,
      websiteUrl: this.newBrandWebsiteUrl || undefined,
      logoUrl: this.newBrandLogoUrl || undefined,
      contactEmail: this.newBrandManagerEmail,
      primaryManagerEmail: this.newBrandManagerEmail,
      category: this.newBrandCategory || 'Lifestyle & Wellness',
      activeCampaignsCount: 0,
      totalBudgetDeployed: 0,
      status: 'ACTIVE'
    }).subscribe({
      next: (b) => {
        this.isSubmittingBrand.set(false);
        this.openBrandModal = false;
        this.toast.success(
          'Brand Onboarded & Email Triggered',
          `Workspace created for ${b.name}. Set-Initial-Password link sent to ${this.newBrandManagerEmail}.`
        );
        this.newBrandName = '';
        this.newBrandWebsiteUrl = '';
        this.newBrandLogoUrl = '';
        this.newBrandManagerEmail = '';
      },
      error: (err) => {
        this.isSubmittingBrand.set(false);
        this.toast.error('Error', err.error?.message || err.message || 'Could not create brand.');
      }
    });
  }

  formatInr(val: number | undefined | null): string {
    return Number(val || 0).toLocaleString('en-IN');
  }

  private formatCampaignDateRange(startIso: string, endIso: string): string {
    const fmt = (iso: string) => {
      if (!iso) return '';
      const d = new Date(iso + 'T00:00:00');
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    if (startIso && endIso) {
      return `${fmt(startIso)} – ${fmt(endIso)}`;
    }
    return fmt(startIso) || fmt(endIso) || 'Current Quarter';
  }

  async submitCampaign() {
    if (!this.newCampaignName || this.isSubmittingCampaign()) return;
    if ((this.newCampaignBudget ?? 0) < 0) {
      this.toast.error('Invalid Budget', 'Total Budget cannot be negative.');
      return;
    }
    if (this.newCampaignStartDate && this.newCampaignEndDate && this.newCampaignEndDate < this.newCampaignStartDate) {
      this.toast.error('Invalid Dates', 'End Date must be on or after the Start Date.');
      return;
    }
    const name = this.newCampaignName.trim();
    const timeframe = (this.newCampaignStartDate || this.newCampaignEndDate)
      ? this.formatCampaignDateRange(this.newCampaignStartDate, this.newCampaignEndDate)
      : (this.newCampaignTimeframe || 'Current Quarter');
    const budget = Math.max(0, Number(this.newCampaignBudget) || 0);
    const confirmed = await this.confirmService.confirm({
      title: 'Launch New Campaign?',
      message: `Deploy campaign "${name}" (${timeframe})?`,
      confirmText: 'Launch Campaign',
      variant: 'primary'
    });
    if (!confirmed) return;
    const agenciesStr = this.selectedCampaignAgencies.length > 0 ? this.selectedCampaignAgencies.join(', ') : undefined;
    this.isSubmittingCampaign.set(true);

    if (this.portalService.createCampaign) {
      this.portalService.createCampaign(name, timeframe, budget, agenciesStr).subscribe({
        next: () => {
          this.isSubmittingCampaign.set(false);
          this.openCampaignModal = false;
          this.toast.success('Campaign Launched', `New campaign "${name}" is now active.`);
          this.newCampaignName = '';
          this.newCampaignStartDate = '';
          this.newCampaignEndDate = '';
          this.newCampaignTimeframe = '';
          this.newCampaignBudget = null;
          this.selectedCampaignAgencies = [];
        },
        error: () => {
          this.isSubmittingCampaign.set(false);
          this.openCampaignModal = false;
        }
      });
    } else {
      this.isSubmittingCampaign.set(false);
      this.portalService.overview.update(prev => ({
        ...prev,
        activeCampaignName: name,
        spend: budget || prev.spend
      }));
      this.openCampaignModal = false;
      this.toast.success('Campaign Launched', `New campaign "${name}" is now active.`);
      this.newCampaignName = '';
      this.newCampaignStartDate = '';
      this.newCampaignEndDate = '';
      this.newCampaignBudget = null;
    }
  }
}
