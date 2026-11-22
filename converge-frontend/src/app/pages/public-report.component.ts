import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ApiService, Creator, PublicReportBundle, ReelDeliverable } from '../services/api.service';
import { AppHeaderComponent } from '../components/app-header.component';
import { AppFooterComponent } from '../components/app-footer.component';
import { ThemeToggleComponent } from '../components/theme-toggle.component';
import {
  computeExecutiveAnalytics,
  formatCompactCount,
  formatMoney,
  resolveEffectiveCampaign
} from '../utils/campaign-analytics';
import { computeAxisBarScale, formatShortAxisDate } from '../utils/chart-axis';
import { formatPublishedDateLabel, formatReelDisplayTitle, formatReelKindLabel } from '../utils/reel-format';
import { computeReelSnapshotMetrics } from '../utils/reel-metrics';
import { safeExternalUrl } from '../utils/url-safety';

@Component({
  selector: 'app-public-report',
  standalone: true,
  imports: [CommonModule, AppHeaderComponent, AppFooterComponent, ThemeToggleComponent],
  template: `
    <div class="bg-cv-canvas text-cv-ink font-body antialiased min-h-screen flex flex-col overflow-x-clip">
      <div class="cv-print-hide">
        <app-header [elevated]="true" brandLink="/">
          <div header-left class="flex items-center gap-2 min-w-0">
            @if (bundle(); as b) {
              <span class="text-cv-ink-muted text-sm hidden sm:inline">/</span>
              <span class="px-2.5 py-0.5 rounded-[3px] bg-cv-card border border-cv-border text-xs font-semibold text-cv-ink truncate max-w-[200px]">
                {{ b.brand.name }}
              </span>
            }
          </div>
          <div header-right class="flex items-center gap-2.5 shrink-0">
            <app-theme-toggle />
            @if (bundle()) {
              <button type="button" (click)="printReport()"
                      class="h-8.5 px-3.5 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_var(--cv-shadow-ink)] font-headline uppercase tracking-[0.03em] text-sm font-bold cursor-pointer transition-all whitespace-nowrap">
                Print / Save PDF ↗
              </button>
            }
          </div>
        </app-header>
      </div>

      <main class="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 py-6 space-y-6 cv-print-sheet">
        @if (loading()) {
          <div class="py-24 flex flex-col items-center justify-center gap-3 text-sm text-cv-ink-muted">
            <svg class="w-6 h-6 animate-spin text-[#f54e26]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9"/></svg>
            <span>Loading live campaign report...</span>
          </div>
        } @else if (errorMsg()) {
          <div class="max-w-lg mx-auto my-12 bg-cv-card rounded-[6px] p-8 border border-cv-border-strong shadow-[6px_6px_0px_#f54e26] text-center space-y-3">
            <span class="px-2.5 py-0.5 rounded-[3px] bg-cv-danger-bg border border-[#ff5c5c]/40 text-cv-danger-ink text-xs font-semibold">Report Unavailable</span>
            <h1 class="font-headline uppercase text-3xl font-bold text-cv-ink tracking-[0.02em]">LINK EXPIRED OR REVOKED</h1>
            <p class="text-sm text-cv-ink-muted leading-relaxed">{{ errorMsg() }}</p>
          </div>
        } @else if (bundle(); as b) {
          @let sum = summary();

          <!-- Report Hero Banner -->
          <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-cv-border-soft">
            <div class="min-w-0 space-y-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-headline uppercase text-sm font-bold tracking-[0.04em] text-[#f54e26]">
                  {{ b.brand.name }}
                </span>
                <span class="px-2 py-0.5 rounded-[3px] bg-cv-well border border-cv-border text-[10px] font-semibold uppercase tracking-wide text-cv-ink-muted">
                  {{ b.report.campaignFilter === 'ALL' ? 'All Campaigns' : b.report.campaignFilter }}
                </span>
                <span class="px-2 py-0.5 rounded-[3px] bg-[#007656] text-[#fff6e8] text-[10px] font-bold uppercase tracking-wide">
                  Live Verified Report
                </span>
              </div>
              <h1 class="font-headline uppercase text-3xl sm:text-4xl font-bold tracking-[0.015em] text-cv-ink leading-none">
                {{ b.report.title }}
              </h1>
            </div>
            <div class="text-xs text-cv-ink-muted tabular-nums shrink-0">
              <p>{{ b.creators.length }} Creator(s) • {{ b.deliverables.length }} Tracked Deliverable(s)</p>
              <p class="text-[11px] text-cv-ink-subtle">Shared {{ b.report.createdAt | date:'MMM d, y' }}</p>
            </div>
          </div>

          <!-- Goal Progress Bar (if available) -->
          @if (sum.goalProgress; as gp) {
            <div class="rounded-[4px] bg-cv-card border border-cv-border p-4 space-y-2 tabular-nums">
              <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span class="font-headline uppercase text-base font-bold tracking-[0.02em] text-cv-ink">CAMPAIGN VIEWS GOAL</span>
                <span class="font-semibold" [ngClass]="gp.achieved ? 'text-cv-green' : 'text-[#f54e26]'">
                  {{ gp.delivered.toLocaleString('en-IN') }} / {{ gp.target.toLocaleString('en-IN') }} Views ({{ gp.rawPct }}%)
                  @if (gp.achieved) { • Goal Reached }
                </span>
              </div>
              <div class="h-2.5 w-full rounded-[2px] bg-cv-well border border-cv-border-soft overflow-hidden">
                <div class="h-full transition-all duration-300" [style.width.%]="gp.pct" [style.background]="gp.achieved ? '#007656' : '#f54e26'"></div>
              </div>
            </div>
          }

          <!-- Executive KPI Summary Cards -->
          <div class="rounded-[4px] bg-cv-card border border-cv-border grid grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-cv-divide tabular-nums"
               [ngClass]="b.report.includeSpend ? 'lg:grid-cols-4' : 'lg:grid-cols-3'">
            <div class="px-5 py-4">
              <p class="text-xs text-cv-ink-muted font-medium">Delivered Views</p>
              <p class="font-headline text-3xl font-bold text-[#f54e26] mt-1 leading-none">{{ compact(sum.totalViews) }}</p>
              <p class="text-[11px] text-cv-ink-subtle mt-1.5">{{ compact(sum.totalInteractions) }} likes &amp; comments</p>
            </div>

            @if (b.report.includeSpend) {
              <div class="px-5 py-4">
                <p class="text-xs text-cv-ink-muted font-medium">Total Spend &amp; Blended CPV</p>
                <p class="font-headline text-3xl font-bold text-cv-ink mt-1 leading-none">
                  {{ sum.totalSpend > 0 ? money(sum.totalSpend, 0) : '—' }}
                </p>
                <p class="text-[11px] text-cv-ink-subtle mt-1.5">
                  {{ sum.blendedCpv !== null ? ('CPV: ' + money(sum.blendedCpv, 2) + ' • CPE: ' + money(sum.blendedCpe, 1)) : 'Creator rates not set' }}
                </p>
              </div>
            }

            <div class="px-5 py-4">
              <p class="text-xs text-cv-ink-muted font-medium">Engagement &amp; Hook Rate</p>
              <p class="font-headline text-3xl font-bold text-cv-green mt-1 leading-none">
                {{ sum.blendedEngagementRate > 0 ? sum.blendedEngagementRate + '%' : '—' }}
                @if (sum.avgHookRatePct != null) {
                  <span class="text-lg font-semibold text-cv-gold ml-1">• {{ sum.avgHookRatePct }}% Hook</span>
                }
              </p>
              <p class="text-[11px] text-cv-ink-subtle mt-1.5">{{ sum.healthScore.label }} • {{ sum.healthScore.benchmarkNote }}</p>
            </div>

            <div class="px-5 py-4">
              <p class="text-xs text-cv-ink-muted font-medium">Top Performing Reel</p>
              @if (sum.topReel; as tr) {
                <p class="font-headline text-3xl font-bold text-cv-gold mt-1 leading-none">{{ compact(tr.reel.viewsCount) }}</p>
                <p class="text-[11px] text-cv-ink-muted truncate mt-1.5">{{ tr.creator?.handle || tr.reel.creatorHandle }}</p>
              } @else {
                <p class="font-headline text-3xl font-bold text-cv-ink-muted mt-1 leading-none">—</p>
                <p class="text-[11px] text-cv-ink-subtle mt-1.5">No deliverables yet</p>
              }
            </div>
          </div>

          <!-- Interactive Deliverable Spotlight -->
          @if (chartData(); as barChart) {
            @if (activeBarDisplay(); as activeDisp) {
              <div class="rounded-[6px] bg-cv-card border-2 border-cv-border-strong shadow-[6px_6px_0px_#f54e26] p-4 sm:p-5 space-y-4">
                <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-cv-border-soft">
                  <div class="min-w-0">
                    <span class="text-[11px] uppercase tracking-wider text-cv-ink-muted block">{{ activeDisp.reel.creatorHandle }}</span>
                    <h2 class="font-headline uppercase text-2xl font-bold text-cv-ink tracking-[0.015em] truncate">{{ displayTitle(activeDisp.reel) }}</h2>
                  </div>
                  @if (safeExternalUrl(activeDisp.reel.reelUrl, true); as safeLink) {
                    <a [href]="safeLink" target="_blank" rel="noopener noreferrer"
                       class="h-8 px-3 rounded-[4px] bg-cv-control hover:bg-[#f54e26] hover:text-[#111111] border border-cv-border text-xs font-semibold text-cv-ink inline-flex items-center transition-colors cv-print-hide">
                      Watch on Instagram ↗
                    </a>
                  }
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-cv-divide rounded-[4px] bg-cv-well border border-cv-border tabular-nums">
                  <div class="px-3.5 py-3">
                    <span class="text-[11px] text-cv-ink-muted block">Views</span>
                    <span class="font-headline text-2xl font-bold text-cv-ink">{{ activeDisp.metrics.viewsCount.toLocaleString('en-IN') }}</span>
                  </div>
                  <div class="px-3.5 py-3">
                    <span class="text-[11px] text-cv-ink-muted block">Likes</span>
                    <span class="font-headline text-2xl font-bold text-cv-gold">{{ activeDisp.metrics.likesCount.toLocaleString('en-IN') }}</span>
                  </div>
                  <div class="px-3.5 py-3">
                    <span class="text-[11px] text-cv-ink-muted block">Comments</span>
                    <span class="font-headline text-2xl font-bold text-cv-green">{{ activeDisp.metrics.commentsCount.toLocaleString('en-IN') }}</span>
                  </div>
                  <div class="px-3.5 py-3">
                    <span class="text-[11px] text-cv-ink-muted block">Eng. Rate</span>
                    <span class="font-headline text-2xl font-bold text-cv-blush">{{ activeDisp.metrics.engagementRate > 0 ? activeDisp.metrics.engagementRate + '%' : '—' }}</span>
                  </div>
                </div>

                @if (barChart.items.length > 0) {
                  <div class="px-3.5 py-3 rounded-[4px] bg-cv-well border border-cv-border-soft space-y-2.5">
                    <div class="flex items-center justify-between gap-2 text-[11px] text-cv-ink-muted">
                      <span>Hover or click bars to compare deliverables</span>
                      @if (barChart.activeBar; as ab) {
                        <span class="text-cv-ink font-medium tabular-nums truncate">{{ ab.label }} · {{ ab.value.toLocaleString('en-IN') }} {{ barChart.unit }}</span>
                      }
                    </div>
                    <div class="flex items-stretch gap-2 pt-0.5">
                      <div class="w-12 shrink-0 h-[68px] flex flex-col justify-between text-right pr-2 border-r border-cv-border text-[10px] leading-none text-cv-ink-subtle tabular-nums select-none">
                        <span>{{ barChart.yMaxLabel }}</span>
                        <span>{{ barChart.yMidLabel }}</span>
                        <span>{{ barChart.yMinLabel }}</span>
                      </div>
                      <div class="flex-1 min-w-0 flex flex-col" (mouseleave)="hoveredIdx.set(null)">
                        <div class="relative h-[68px] flex items-end gap-2 px-1 border-b border-cv-border">
                          <div aria-hidden="true" class="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-cv-border-faint"></div>
                          <div aria-hidden="true" class="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-cv-border-faint"></div>
                          @for (bar of barChart.items; track $index) {
                            <button type="button"
                                    (mouseenter)="hoveredIdx.set($index)"
                                    (click)="pinnedIdx.set($index)"
                                    class="relative z-10 flex-1 h-full flex items-end justify-center cursor-pointer focus:outline-none">
                              <span class="w-full max-w-[64px] block rounded-t-[2px] transition-all duration-150"
                                    [style.height.px]="bar.px"
                                    [style.backgroundColor]="barChart.activeIdx === $index ? '#f54e26' : '#f54e2666'">
                              </span>
                            </button>
                          }
                        </div>
                        <div class="flex items-start gap-2 px-1 pt-1.5">
                          @for (bar of barChart.items; track $index) {
                            <button type="button"
                                    (mouseenter)="hoveredIdx.set($index)"
                                    (click)="pinnedIdx.set($index)"
                                    class="flex-1 min-w-0 text-center text-[10px] leading-tight truncate cursor-pointer"
                                    [ngClass]="barChart.activeIdx === $index ? 'text-cv-ink font-semibold' : 'text-cv-ink-subtle'">
                              {{ bar.xLabel }}
                            </button>
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                }
              </div>
            }
          }

          <!-- Campaign Breakdown -->
          @if (sum.campaignBreakdowns.length > 1 || (sum.campaignBreakdowns.length === 1 && sum.campaignBreakdowns[0].campaign !== 'Untagged / General')) {
            <div class="bg-cv-card rounded-[4px] border border-cv-border p-5 space-y-3">
              <h2 class="font-headline uppercase text-lg font-bold text-cv-ink tracking-[0.02em]">CAMPAIGN BREAKDOWN</h2>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 tabular-nums">
                @for (cb of sum.campaignBreakdowns; track cb.campaign) {
                  <div class="p-3.5 rounded-[4px] bg-cv-well border border-cv-border-soft space-y-1.5 text-xs">
                    <div class="flex items-center justify-between gap-2">
                      <span class="font-semibold text-cv-ink truncate">{{ cb.campaign }}</span>
                      <span class="text-[11px] text-cv-ink-muted shrink-0">{{ cb.reelsCount }} reel(s)</span>
                    </div>
                    <div class="flex items-baseline justify-between gap-2 pt-1">
                      <span class="font-headline text-2xl font-bold text-[#f54e26]">{{ compact(cb.views) }} views</span>
                      <span class="text-cv-green font-semibold">{{ cb.engRate > 0 ? cb.engRate + '% ER' : '—' }}</span>
                    </div>
                    @if (b.report.includeSpend && cb.spend > 0) {
                      <p class="text-[11px] text-cv-ink-muted">
                        Spend: {{ money(cb.spend, 0) }} • CPV: {{ cb.cpv !== null ? money(cb.cpv, 2) : '—' }}
                      </p>
                    }
                  </div>
                }
              </div>
            </div>
          }

          <!-- Deliverables Table -->
          <div class="bg-cv-card rounded-[4px] border border-cv-border overflow-hidden">
            <div class="px-5 py-3.5 border-b border-cv-border flex items-center justify-between">
              <h2 class="font-headline uppercase text-lg font-bold text-cv-ink tracking-[0.02em]">TRACKED DELIVERABLES ({{ b.deliverables.length }})</h2>
            </div>
            @if (sortedReels().length === 0) {
              <p class="p-8 text-center text-xs text-cv-ink-muted">No deliverables match this report filter.</p>
            } @else {
              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs tabular-nums">
                  <thead class="bg-cv-card-alt text-cv-ink-muted text-[11px] font-medium border-b border-cv-divide">
                    <tr>
                      <th class="px-4 py-2.5">Creator</th>
                      <th class="px-4 py-2.5">Deliverable</th>
                      <th class="px-4 py-2.5">Campaign</th>
                      <th class="px-4 py-2.5 text-right">Views</th>
                      <th class="px-4 py-2.5 text-right">Likes</th>
                      <th class="px-4 py-2.5 text-right">Comments</th>
                      <th class="px-4 py-2.5 text-right">Eng. Rate</th>
                      <th class="px-4 py-2.5 text-right">Hook (3s)</th>
                      <th class="px-4 py-2.5 text-right cv-print-hide">Link</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-cv-divide-soft">
                    @for (r of sortedReels(); track r.id) {
                      <tr class="hover:bg-cv-hover-row transition-colors">
                        <td class="px-4 py-3 font-semibold text-cv-ink">{{ r.creatorHandle }}</td>
                        <td class="px-4 py-3 text-cv-ink-soft">{{ deliverableLabel(r) }}</td>
                        <td class="px-4 py-3 text-cv-ink-muted">{{ resolveCamp(r) || '—' }}</td>
                        <td class="px-4 py-3 text-right font-bold text-[#f54e26]">{{ (r.viewsCount || 0).toLocaleString('en-IN') }}</td>
                        <td class="px-4 py-3 text-right text-cv-gold">{{ (r.likesCount || 0).toLocaleString('en-IN') }}</td>
                        <td class="px-4 py-3 text-right text-cv-green">{{ (r.commentsCount || 0).toLocaleString('en-IN') }}</td>
                        <td class="px-4 py-3 text-right text-cv-blush">{{ r.engagementRate > 0 ? r.engagementRate + '%' : '—' }}</td>
                        <td class="px-4 py-3 text-right font-semibold text-cv-green">{{ r.hookRatePct != null ? r.hookRatePct + '%' : '—' }}</td>
                        <td class="px-4 py-3 text-right cv-print-hide">
                          @if (safeExternalUrl(r.reelUrl, true); as safeLink) {
                            <a [href]="safeLink" target="_blank" rel="noopener noreferrer" class="text-[#f54e26] hover:underline font-semibold">View ↗</a>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        }
      </main>

      <div class="cv-print-hide">
        <app-footer></app-footer>
      </div>
    </div>
  `
})
export class PublicReportComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);

  loading = signal(true);
  errorMsg = signal('');
  bundle = signal<PublicReportBundle | null>(null);
  hoveredIdx = signal<number | null>(null);
  pinnedIdx = signal<number>(0);

  readonly safeExternalUrl = safeExternalUrl;
  readonly displayTitle = formatReelDisplayTitle;

  sortedReels = computed(() => {
    const b = this.bundle();
    if (!b) return [];
    return [...b.deliverables].sort((a, c) => (c.viewsCount || 0) - (a.viewsCount || 0));
  });

  summary = computed(() => {
    const b = this.bundle();
    return computeExecutiveAnalytics({
      creators: b?.creators || [],
      deliverables: b?.deliverables || [],
      currency: b?.brand.currency,
      targetViewsGoal: b?.brand.targetViewsGoal,
      includeSpend: b?.report.includeSpend ?? true
    });
  });

  chartData = computed(() => {
    const list = this.sortedReels().slice(0, 7);
    if (list.length === 0) return null;
    const hasViews = list.some(r => (r.viewsCount || 0) > 0);
    const unit = hasViews ? 'views' : 'interactions';
    const vals = list.map(r => hasViews ? (r.viewsCount || 0) : ((r.likesCount || 0) + (r.commentsCount || 0)));
    const scale = computeAxisBarScale(vals, 68);
    const items = list.map((r, idx) => ({
      reel: r,
      label: `${r.creatorHandle} • ${this.displayTitle(r)}`,
      xLabel: r.creatorHandle || formatShortAxisDate(r.publishedAt || r.syncedAt) || `#${idx + 1}`,
      value: vals[idx],
      px: scale.heightsPx[idx]
    }));
    const hov = this.hoveredIdx();
    const pin = this.pinnedIdx();
    const activeIdx = (hov !== null && hov >= 0 && hov < items.length)
      ? hov
      : Math.min(pin, items.length - 1);
    return {
      unit,
      yMinLabel: scale.yMinLabel,
      yMidLabel: scale.yMidLabel,
      yMaxLabel: scale.yMaxLabel,
      items,
      activeIdx,
      activeBar: items[activeIdx] || null
    };
  });

  activeBarDisplay = computed(() => {
    const cd = this.chartData();
    const b = this.bundle();
    if (!cd?.activeBar || !b) return null;
    const reel = cd.activeBar.reel;
    const creator = b.creators.find(c => c.id === reel.creatorId) || null;
    const metrics = computeReelSnapshotMetrics({ reel, creator, isLatest: true });
    return { reel, creator, metrics };
  });

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token') || '';
    if (!token) {
      this.loading.set(false);
      this.errorMsg.set('Missing share report token.');
      return;
    }
    this.api.getPublicSharedReport(token).subscribe({
      next: (data) => {
        this.bundle.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.error || 'Could not load this campaign report.');
        this.loading.set(false);
      }
    });
  }

  compact(n: number): string {
    return formatCompactCount(n);
  }

  money(n: number | null | undefined, dec = 0): string {
    return formatMoney(n, this.bundle()?.brand.currency, dec);
  }

  resolveCamp(r: ReelDeliverable): string {
    const creator = this.bundle()?.creators.find(c => c.id === r.creatorId);
    return resolveEffectiveCampaign(r, creator);
  }

  deliverableLabel(r: ReelDeliverable): string {
    const kind = formatReelKindLabel(r);
    const pub = formatPublishedDateLabel(r.publishedAt);
    return pub ? `${kind} · ${pub}` : kind;
  }

  printReport(): void {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }
}
