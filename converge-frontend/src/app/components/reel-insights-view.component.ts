import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Creator, DeliverableInsightsBundle, ReelDeliverable } from '../services/api.service';
import { formatReelDisplayTitle, formatReelMetaLabel } from '../utils/reel-format';
import { computeAxisBarScale, formatShortAxisDate, formatSyncAxisLabel } from '../utils/chart-axis';
import { describeHookRate } from '../utils/campaign-analytics';
import { computeReelSnapshotMetrics } from '../utils/reel-metrics';
import { safeExternalUrl } from '../utils/url-safety';

@Component({
  selector: 'app-reel-insights-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="space-y-5 animate-fade-in-up">
      <!-- Top Breadcrumb & Actions -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-cv-border-soft">
        <div class="flex items-center gap-3 min-w-0">
          <button
            type="button"
            (click)="back.emit()"
            class="h-9 px-3.5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border text-cv-ink text-xs font-medium flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors">
            <span>{{ isLivePreview && !creator?.id ? '← Back to Lookup' : '← Back to Creator' }}</span>
          </button>
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-2 py-0.5 rounded-[3px] bg-[#5738af] text-[#fff6e8] text-[10px] font-bold uppercase tracking-wide">{{ reel.mediaType || 'REELS' }}</span>
              <span
                class="px-2 py-0.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wide"
                [ngClass]="reel.status === 'VERIFIED' ? 'bg-[#007656] text-[#fff6e8]' : (reel.status === 'LIVE_PREVIEW' ? 'bg-cv-well border border-cv-border text-[#f54e26]' : 'bg-[#fabf29] text-[#111111]')">
                {{ reel.status }}
              </span>
              @if (reel.publishedAt) {
                <span class="text-xs text-cv-ink-muted tabular-nums">Published {{ reel.publishedAt | date:'MMM d, y' }}</span>
              }
            </div>
            <h1 class="font-headline uppercase text-2xl sm:text-3xl font-bold text-cv-ink tracking-[0.02em] leading-none truncate mt-1">{{ displayReelTitle(reel) }}</h1>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 shrink-0">
          @if (isLivePreview) {
            @if (canManage) {
              <button
                type="button"
                (click)="trackLiveReel.emit(reel)"
                [disabled]="tracking"
                class="h-9 px-4 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase tracking-[0.03em] text-base font-bold cursor-pointer transition-colors disabled:opacity-60">
                {{ tracking ? 'TRACKING...' : '+ TRACK AS DELIVERABLE' }}
              </button>
            } @else {
              <span class="px-3 py-1.5 rounded-[4px] bg-cv-well border border-cv-border text-cv-ink-muted text-xs font-medium">
                Agency Managed · View Only
              </span>
            }
          } @else if (canManage) {
            <button
              type="button"
              (click)="syncReel.emit(reel.id)"
              [disabled]="syncing"
              class="h-9 px-4 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase tracking-[0.03em] text-base font-bold cursor-pointer transition-colors disabled:opacity-60">
              {{ syncing ? 'SYNCING IG...' : 'SYNC REEL IG ↻' }}
            </button>
          }
          <button
            type="button"
            (click)="copyUrl.emit(reel.reelUrl)"
            class="h-9 px-3.5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border text-cv-ink text-xs font-medium cursor-pointer transition-colors">
            Copy URL
          </button>
          @if (safeExternalUrl(reel.reelUrl, true); as safeReelHref) {
            <a
              [href]="safeReelHref"
              target="_blank"
              rel="noopener noreferrer"
              class="h-9 px-3.5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border text-cv-ink text-xs font-medium flex items-center gap-1 transition-colors">
              <span>Open on Instagram ↗</span>
            </a>
          }
        </div>
      </div>

      <!-- Hero Content Preview & Official Metrics -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:items-start">
        <div class="lg:col-span-4 bg-cv-card rounded-[4px] p-4 border border-cv-border flex flex-col gap-3">
          @if (reel.thumbnailUrl) {
            <img [src]="reel.thumbnailUrl" [alt]="displayReelTitle(reel)" (error)="reel.thumbnailUrl = ''" class="w-full aspect-[4/5] max-h-[360px] object-cover rounded-[4px] bg-cv-well border border-cv-border-soft"/>
          } @else {
            <div class="w-full aspect-[4/5] max-h-[340px] rounded-[4px] bg-cv-well border border-cv-border-soft flex flex-col items-center justify-center text-cv-ink-muted text-xs gap-1">
              <span class="font-headline uppercase font-bold text-lg text-[#f54e26]">{{ reel.mediaType || 'REELS' }}</span>
              <span>{{ reel.publishedAt ? (reel.publishedAt | date:'MMM d, y') : 'Instagram Reel' }}</span>
            </div>
          }

          <!-- Public URL Bar + Quick Refresh (Hero Parity) -->
          <div class="flex items-center justify-between gap-2 px-3 py-2 rounded-[4px] bg-cv-well border border-cv-border-soft">
            <div class="flex items-center gap-2 min-w-0 text-xs">
              <span class="w-2 h-2 rounded-full shrink-0" [ngClass]="reel.status === 'VERIFIED' ? 'bg-cv-green' : 'bg-[#fabf29]'"></span>
              <span class="text-cv-ink font-medium truncate">{{ reelMetaLabel(reel) }}</span>
            </div>
            @if (!isLivePreview && canManage) {
              <button
                type="button"
                (click)="syncReel.emit(reel.id)"
                [disabled]="syncing"
                class="shrink-0 px-2.5 py-1 rounded-[3px] bg-cv-control hover:bg-[#f54e26] hover:text-[#111111] text-cv-ink text-[10px] font-semibold transition-colors cursor-pointer disabled:opacity-50">
                {{ syncing ? 'Updating...' : 'Refresh ↻' }}
              </button>
            }
          </div>

          <!-- Real Snapshot Sync Momentum -->
          @let snaps = snapshotList;
          @if (snaps.length > 0) {
            <div class="px-3 py-2.5 rounded-[4px] bg-cv-well border border-cv-border-soft space-y-2">
              <div class="flex items-center justify-between gap-2 text-[11px]">
                <span class="text-cv-ink-muted">Sync momentum</span>
                @if ((derived.viewsDeltaLastSync || 0) > 0) {
                  <span class="px-1.5 py-0.5 rounded-[3px] bg-[#f54e26] text-[#111111] text-[10px] font-bold uppercase tracking-wide tabular-nums">
                    +{{ formatCompact(derived.viewsDeltaLastSync || 0) }} LAST SYNC
                  </span>
                } @else if (snaps.length >= 2) {
                  <span class="text-[10px] font-semibold text-cv-green tabular-nums">{{ snaps.length }} synced snapshots</span>
                } @else {
                  <span class="text-[10px] text-cv-ink-subtle">Baseline synced</span>
                }
              </div>

              @if (activeSnapshot; as snap) {
                <div class="flex items-center justify-between text-[10px] text-cv-ink-muted tabular-nums">
                  <span>Sync #{{ activeSnapIndex + 1 }} · {{ snap.capturedAt | date:'MMM d, h:mm a' }}</span>
                  <span class="text-cv-ink font-semibold">
                    @if (hasSnapshotViews) {
                      {{ snap.viewsCount.toLocaleString('en-IN') }} views
                      @if (snap.deltaViews > 0) {
                        <span class="text-cv-green">(+{{ formatCompact(snap.deltaViews) }})</span>
                      }
                    } @else {
                      {{ ((snap.likesCount || 0) + (snap.commentsCount || 0)).toLocaleString('en-IN') }} interactions
                    }
                  </span>
                </div>
              }

              @let snapChart = snapshotChartData;
              <div class="flex items-stretch gap-1.5 pt-1">
                <div class="w-10 shrink-0 h-[52px] flex flex-col justify-between text-right pr-1.5 border-r border-cv-border text-[9px] leading-none text-cv-ink-subtle tabular-nums select-none">
                  <span>{{ snapChart.yMaxLabel }}</span>
                  <span>{{ snapChart.yMidLabel }}</span>
                  <span>{{ snapChart.yMinLabel }}</span>
                </div>
                <div class="flex-1 min-w-0 flex flex-col" (mouseleave)="hoveredSnapIdx = null">
                  <div class="relative h-[52px] flex items-end gap-1.5 px-1 border-b border-cv-border">
                    <div aria-hidden="true" class="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-cv-border-faint"></div>
                    <div aria-hidden="true" class="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-cv-border-faint"></div>
                    @for (bar of snapChart.bars; track $index) {
                      <button
                        type="button"
                        (mouseenter)="hoveredSnapIdx = $index"
                        (click)="togglePinSnap($index)"
                        class="relative z-10 flex-1 h-full flex items-end justify-center cursor-pointer focus:outline-none"
                        [attr.title]="'Sync #' + ($index + 1) + ' — ' + bar.xLabel"
                        [attr.aria-label]="'Sync snapshot ' + ($index + 1)">
                        <span
                          class="w-full max-w-[44px] block rounded-t-[2px] transition-all duration-150"
                          [style.height.px]="bar.px"
                          [style.backgroundColor]="activeSnapIndex === $index ? '#f54e26' : '#f54e2677'">
                        </span>
                      </button>
                    }
                  </div>
                  <div class="flex items-start gap-1.5 px-1 pt-1">
                    @for (bar of snapChart.bars; track $index) {
                      <button
                        type="button"
                        (mouseenter)="hoveredSnapIdx = $index"
                        (click)="togglePinSnap($index)"
                        class="flex-1 min-w-0 text-center text-[9px] leading-tight truncate cursor-pointer transition-colors"
                        [ngClass]="activeSnapIndex === $index ? 'text-cv-ink font-semibold' : 'text-cv-ink-subtle'">
                        {{ bar.xLabel }}
                      </button>
                    }
                  </div>
                </div>
              </div>
              @if (snaps.length === 1) {
                <p class="text-[10px] text-cv-ink-subtle">Sync again later to plot view growth across checks.</p>
              }
            </div>
          }

          <div class="flex items-center justify-between gap-2 text-[11px] text-cv-ink-muted px-1 pt-0.5 border-t border-cv-border-faint tabular-nums">
            <span>{{ reel.metricsSource === 'META_GRAPH_INSIGHTS' ? 'Creator OAuth API' : 'Public IG Discovery' }}</span>
            @if (reel.publishedAt) {
              <span>Published {{ reel.publishedAt | date:'mediumDate' }}</span>
            } @else if (reel.syncedAt) {
              <span>Synced {{ reel.syncedAt | date:'short' }}</span>
            }
          </div>
        </div>

        <!-- Right 2 Columns: Creator Header + Official Performance + Cost ROI -->
        <div class="lg:col-span-8 space-y-4">
          @if (creator; as c) {
            <div class="bg-cv-card rounded-[4px] p-5 border border-cv-border">
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  @if (c.avatarUrl) {
                    <img [src]="c.avatarUrl" [alt]="c.name" class="w-10 h-10 rounded-[4px] object-cover border border-cv-border shrink-0"/>
                  } @else {
                    <div class="w-10 h-10 rounded-[4px] bg-[#f54e26] text-[#111111] font-headline font-bold flex items-center justify-center shrink-0">
                      {{ c.name.substring(0, 2).toUpperCase() }}
                    </div>
                  }
                  <div class="min-w-0">
                    <p class="font-headline uppercase font-bold text-lg text-cv-ink truncate leading-tight">{{ c.name }}</p>
                    <p class="text-xs text-cv-ink-muted truncate tabular-nums">{{ c.handle }} • {{ c.followersDisplay || formatCompact(c.followersCount) }} followers</p>
                  </div>
                </div>
                @if (c.campaignName) {
                  <span class="px-2.5 py-1 rounded-[3px] bg-cv-well border border-cv-border text-cv-ink text-xs font-semibold shrink-0">{{ c.campaignName }}</span>
                }
              </div>
            </div>
          }

          <!-- Reel Performance Metrics -->
          @let dm = displayedMetrics;
          <div class="bg-cv-card rounded-[4px] p-5 border border-cv-border space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 class="font-headline uppercase text-lg font-bold text-cv-ink tracking-[0.02em]">REEL PERFORMANCE METRICS</h2>
              @if (dm.isSnapshotPreview && activeSnapshot; as snap) {
                <div class="flex items-center gap-2 text-[11px] tabular-nums">
                  <span class="px-2 py-0.5 rounded-[3px] bg-cv-well border border-[#f54e26] text-[#f54e26] font-semibold">
                    Sync #{{ activeSnapIndex + 1 }} · {{ snap.capturedAt | date:'MMM d, h:mm a' }}
                  </span>
                  @if (pinnedSnapIdx !== null) {
                    <button type="button" (click)="pinnedSnapIdx = null" class="text-[11px] font-semibold text-cv-ink-muted hover:text-cv-ink underline cursor-pointer">
                      Latest
                    </button>
                  }
                </div>
              }
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
              <div class="p-3.5 rounded-[4px] bg-cv-well border border-cv-border-soft">
                <p class="font-headline text-2xl font-bold text-[#f54e26] leading-none">{{ dm.viewsCount > 0 ? dm.viewsCount.toLocaleString('en-IN') : (reel.mediaType === 'IMAGE' || reel.mediaType === 'CAROUSEL_ALBUM' || reel.mediaType === 'FEED' ? 'Photo' : '0') }}</p>
                <p class="text-[11px] font-semibold text-cv-ink mt-1">Reel views</p>
                <p class="text-[10px] text-cv-ink-subtle">
                  {{ dm.viewsCount > 0 ? 'Instagram Reel views' : (reel.mediaType === 'IMAGE' || reel.mediaType === 'CAROUSEL_ALBUM' || reel.mediaType === 'FEED' ? 'No views on photo posts' : 'Instagram Reel views') }}
                </p>
              </div>
              <div class="p-3.5 rounded-[4px] bg-cv-well border border-cv-border-soft">
                <p class="font-headline text-2xl font-bold text-cv-ink leading-none">{{ dm.likesCount.toLocaleString('en-IN') }}</p>
                <p class="text-[11px] font-semibold text-cv-ink mt-1">Likes</p>
                <p class="text-[10px] text-cv-ink-subtle">Post likes</p>
              </div>
              <div class="p-3.5 rounded-[4px] bg-cv-well border border-cv-border-soft">
                <p class="font-headline text-2xl font-bold text-cv-gold leading-none">{{ dm.commentsCount.toLocaleString('en-IN') }}</p>
                <p class="text-[11px] font-semibold text-cv-ink mt-1">Comments</p>
                <p class="text-[10px] text-cv-ink-subtle">Audience comments</p>
              </div>
              <div class="p-3.5 rounded-[4px] bg-cv-well border border-cv-border-soft">
                <p class="font-headline text-2xl font-bold text-cv-green leading-none">{{ dm.engagementRate > 0 ? dm.engagementRate + '%' : '—' }}</p>
                <p class="text-[11px] font-semibold text-cv-ink mt-1">Engagement rate</p>
                @if (dm.engagementVsCreatorAvgPct !== 0) {
                  <p class="text-[10px]" [ngClass]="dm.engagementVsCreatorAvgPct >= 0 ? 'text-cv-green' : 'text-cv-ink-muted'">
                    {{ dm.engagementVsCreatorAvgPct >= 0 ? '+' : '' }}{{ dm.engagementVsCreatorAvgPct }}% vs creator avg
                  </p>
                } @else {
                  <p class="text-[10px] text-cv-ink-subtle">Likes + Comments ratio</p>
                }
              </div>
            </div>
            @if ((reel.reachCount || 0) > 0 || dm.savesCount > 0 || (reel.sharesCount || 0) > 0 || (reel.avgWatchTimeMs || 0) > 0 || dm.hookRatePct != null) {
              <div class="grid grid-cols-2 gap-3 pt-3 border-t border-cv-border-faint tabular-nums" [ngClass]="dm.hookRatePct != null ? 'sm:grid-cols-3 lg:grid-cols-5' : 'sm:grid-cols-4'">
                <div class="p-3 rounded-[4px] bg-cv-well border border-cv-border-soft">
                  <p class="font-headline text-xl font-bold text-cv-ink leading-none">{{ (reel.reachCount || 0) > 0 ? (reel.reachCount || 0).toLocaleString('en-IN') : '—' }}</p>
                  <p class="text-[10px] uppercase font-semibold text-cv-ink-muted mt-1">Accounts Reached</p>
                </div>
                <div class="p-3 rounded-[4px] bg-cv-well border border-cv-border-soft">
                  <p class="font-headline text-xl font-bold text-cv-blush leading-none">{{ dm.savesCount.toLocaleString('en-IN') }}</p>
                  <p class="text-[10px] uppercase font-semibold text-cv-ink-muted mt-1">Saves</p>
                </div>
                <div class="p-3 rounded-[4px] bg-cv-well border border-cv-border-soft">
                  <p class="font-headline text-xl font-bold text-cv-ink leading-none">{{ (reel.sharesCount || 0).toLocaleString('en-IN') }}</p>
                  <p class="text-[10px] uppercase font-semibold text-cv-ink-muted mt-1">Shares</p>
                </div>
                <div class="p-3 rounded-[4px] bg-cv-well border border-cv-border-soft">
                  <p class="font-headline text-xl font-bold text-cv-ink leading-none">{{ formatWatchTime(reel.avgWatchTimeMs || 0) }}</p>
                  <p class="text-[10px] uppercase font-semibold text-cv-ink-muted mt-1">Avg Watch Time</p>
                </div>
                @if (dm.hookRatePct != null) {
                  @let hookDesc = hookBadge(dm.hookRatePct);
                  <div class="p-3 rounded-[4px] bg-cv-well border border-cv-border-soft">
                    <div class="flex items-center justify-between gap-1.5">
                      <p class="font-headline text-xl font-bold leading-none"
                         [ngClass]="hookDesc.tone === 'green' ? 'text-cv-green' : (hookDesc.tone === 'gold' ? 'text-cv-gold' : 'text-[#f54e26]')">
                        {{ dm.hookRatePct }}%
                      </p>
                      <span class="px-1.5 py-0.5 rounded-[2px] text-[9px] font-bold uppercase"
                            [ngClass]="hookDesc.tone === 'green' ? 'bg-[#007656] text-[#fff6e8]' : (hookDesc.tone === 'gold' ? 'bg-[#fabf29] text-[#111111]' : 'bg-[#f54e26] text-[#111111]')">
                        {{ hookDesc.label }}
                      </span>
                    </div>
                    <p class="text-[10px] uppercase font-semibold text-cv-ink-muted mt-1">Hook Rate (3s)</p>
                    <p class="text-[10px] text-cv-ink-subtle mt-0.5">
                      Skip {{ dm.skipRatePct != null ? dm.skipRatePct : ((100 - dm.hookRatePct).toFixed(1)) }}% · {{ dm.hookRateSource === 'MANUAL' ? 'Manual' : 'Meta Insights' }}
                    </p>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Official Ratio & Cost Efficiency Signals -->
          <div class="bg-cv-card rounded-[4px] p-5 border border-cv-border space-y-3">
            <h2 class="font-headline uppercase text-lg font-bold text-cv-ink tracking-[0.02em]">REEL RATIOS &amp; COST ROI</h2>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs tabular-nums">
              <div class="p-3.5 rounded-[4px] bg-cv-well border border-cv-border-soft">
                <span class="text-[10px] uppercase tracking-[0.04em] font-semibold text-cv-ink-muted">Total Interactions</span>
                <p class="font-headline text-xl font-bold text-cv-ink mt-1 leading-none">{{ dm.totalInteractions.toLocaleString('en-IN') }}</p>
                <p class="text-[10px] text-cv-ink-subtle mt-1">Likes + Comments</p>
              </div>
              <div class="p-3.5 rounded-[4px] bg-cv-well border border-cv-border-soft">
                <span class="text-[10px] uppercase tracking-[0.04em] font-semibold text-cv-ink-muted">Like-to-View Rate</span>
                <p class="font-headline text-xl font-bold text-cv-ink mt-1 leading-none">{{ dm.likeRatePct > 0 ? dm.likeRatePct + '%' : '—' }}</p>
                <p class="text-[10px] text-cv-ink-subtle mt-1">Likes / Views</p>
              </div>
              <div class="p-3.5 rounded-[4px] bg-cv-well border border-cv-border-soft">
                <span class="text-[10px] uppercase tracking-[0.04em] font-semibold text-cv-ink-muted">Comment Rate</span>
                <p class="font-headline text-xl font-bold text-cv-ink mt-1 leading-none">{{ dm.commentRatePct > 0 ? dm.commentRatePct + '%' : '—' }}</p>
                <p class="text-[10px] text-cv-ink-subtle mt-1">Comments / Views</p>
              </div>
              <div class="p-3.5 rounded-[4px] bg-cv-well border border-cv-border-soft">
                <span class="text-[10px] uppercase tracking-[0.04em] font-semibold text-cv-ink-muted">View / Follower Ratio</span>
                <p class="font-headline text-xl font-bold text-cv-green mt-1 leading-none">{{ dm.viewToFollowerRatioPct > 0 ? dm.viewToFollowerRatioPct + '%' : '—' }}</p>
                <p class="text-[10px] text-cv-ink-subtle mt-1">Views / Followers</p>
              </div>
              <div class="p-3.5 rounded-[4px] bg-cv-well border border-cv-border-soft">
                <span class="text-[10px] uppercase tracking-[0.04em] font-semibold text-cv-ink-muted">CPV (Cost Per View)</span>
                <p class="font-headline text-xl font-bold text-[#f54e26] mt-1 leading-none">{{ dm.costPerView ? formatInr(dm.costPerView, 2) : '—' }}</p>
                <p class="text-[10px] text-cv-ink-subtle mt-1">{{ dm.costQuoted ? formatInr(dm.costQuoted, 0) + (dm.costLabel ? ' • ' + dm.costLabel : '') : (dm.costLabel || 'Set cost on creator or reel') }}</p>
              </div>
              <div class="p-3.5 rounded-[4px] bg-cv-well border border-cv-border-soft">
                <span class="text-[10px] uppercase tracking-[0.04em] font-semibold text-cv-ink-muted">CPE (Cost / Interaction)</span>
                <p class="font-headline text-xl font-bold text-cv-gold mt-1 leading-none">{{ dm.costPerInteraction ? formatInr(dm.costPerInteraction, 1) : '—' }}</p>
                <p class="text-[10px] text-cv-ink-subtle mt-1">Per like or comment</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `
})
export class ReelInsightsViewComponent implements OnChanges {
  @Input({ required: true }) reel!: ReelDeliverable & { publishedAt?: string };
  @Input() creator: Creator | null = null;
  @Input() bundle: DeliverableInsightsBundle | null = null;
  @Input() isLivePreview = false;
  @Input() canManage = true;
  @Input() syncing = false;
  @Input() tracking = false;

  @Output() back = new EventEmitter<void>();
  @Output() syncReel = new EventEmitter<string>();
  @Output() trackLiveReel = new EventEmitter<ReelDeliverable>();
  @Output() copyUrl = new EventEmitter<string>();

  hoveredSnapIdx: number | null = null;
  pinnedSnapIdx: number | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    const prevId = changes['reel']?.previousValue?.id;
    const nextId = changes['reel']?.currentValue?.id;
    if (changes['reel'] && prevId !== nextId) {
      this.hoveredSnapIdx = null;
      this.pinnedSnapIdx = null;
    }
  }

  togglePinSnap(idx: number): void {
    this.pinnedSnapIdx = this.pinnedSnapIdx === idx ? null : idx;
  }

  get snapshotList() {
    const raw = this.bundle?.snapshots || [];
    return raw.slice(-7);
  }

  get activeSnapIndex(): number {
    const list = this.snapshotList;
    if (list.length === 0) return 0;
    if (this.hoveredSnapIdx !== null && this.hoveredSnapIdx >= 0 && this.hoveredSnapIdx < list.length) {
      return this.hoveredSnapIdx;
    }
    if (this.pinnedSnapIdx !== null && this.pinnedSnapIdx >= 0 && this.pinnedSnapIdx < list.length) {
      return this.pinnedSnapIdx;
    }
    return list.length - 1;
  }

  get activeSnapshot() {
    const list = this.snapshotList;
    return list.length > 0 ? list[this.activeSnapIndex] : null;
  }

  get hasSnapshotViews(): boolean {
    return this.snapshotList.some(s => (s.viewsCount || 0) > 0);
  }

  get displayedMetrics() {
    const list = this.snapshotList;
    const isLatest = list.length === 0 || this.activeSnapIndex === list.length - 1;
    return computeReelSnapshotMetrics({
      reel: this.reel,
      creator: this.creator,
      snapshot: this.activeSnapshot,
      isLatest,
      bundleDerived: this.bundle?.derived || null
    });
  }

  get snapshotChartData() {
    const list = this.snapshotList;
    const useViews = this.hasSnapshotViews;
    const vals = list.map(s =>
      useViews ? (s.viewsCount || 0) : ((s.likesCount || 0) + (s.commentsCount || 0))
    );
    const scale = computeAxisBarScale(vals, 52);
    const dayKeys = new Set(
      list
        .map(s => formatShortAxisDate(s.capturedAt))
        .filter((d): d is string => Boolean(d))
    );
    const sameDay = dayKeys.size <= 1;
    return {
      yMinLabel: scale.yMinLabel,
      yMidLabel: scale.yMidLabel,
      yMaxLabel: scale.yMaxLabel,
      bars: list.map((s, idx) => ({
        px: scale.heightsPx[idx],
        xLabel: formatSyncAxisLabel(idx, s.capturedAt, sameDay),
      })),
    };
  }

  get derived() {
    if (this.bundle?.derived) return this.bundle.derived;
    const base = computeReelSnapshotMetrics({
      reel: this.reel,
      creator: this.creator,
      isLatest: true
    });
    return {
      totalInteractions: base.totalInteractions,
      likeRatePct: base.likeRatePct,
      commentRatePct: base.commentRatePct,
      viewToFollowerRatioPct: base.viewToFollowerRatioPct,
      shareOfCreatorViewsPct: base.shareOfCreatorViewsPct,
      engagementVsCreatorAvgPct: base.engagementVsCreatorAvgPct,
      viewsDeltaLastSync: 0,
      likesDeltaLastSync: 0,
      commentsDeltaLastSync: 0,
      snapshotCount: 0,
      costMode: base.costMode,
      costLabel: base.costLabel,
      costQuoted: base.costQuoted,
      costPerView: base.costPerView,
      costPerInteraction: base.costPerInteraction,
      hookRatePct: base.hookRatePct,
      skipRatePct: base.skipRatePct,
      hookRateSource: base.hookRateSource
    };
  }

  formatCompact(n: number): string {
    if (!n || n <= 0) return '—';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  formatWatchTime(ms: number): string {
    if (!ms || ms <= 0) return '—';
    const secs = Math.round(ms / 100) / 10;
    return `${secs}s`;
  }

  readonly safeExternalUrl = safeExternalUrl;
  readonly displayReelTitle = formatReelDisplayTitle;
  readonly reelMetaLabel = formatReelMetaLabel;
  readonly hookBadge = describeHookRate;

  formatInr(n: number, decimals = 0): string {
    if (!n || n <= 0) return '—';
    return '₹' + n.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }
}
