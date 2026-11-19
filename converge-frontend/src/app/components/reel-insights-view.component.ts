import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Creator, DeliverableInsightsBundle, ReelDeliverable } from '../services/api.service';

@Component({
  selector: 'app-reel-insights-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="space-y-5 animate-fade-in-up">
      <!-- Top Breadcrumb & Actions -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-surface-variant/60">
        <div class="flex items-center gap-3 min-w-0">
          <button
            type="button"
            (click)="back.emit()"
            class="h-9 px-4 rounded-full bg-surface-container-lowest border border-surface-container-high hover:bg-surface-cream text-ink-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors">
            <span>← Back to Creator</span>
          </button>
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-2.5 py-0.5 rounded-full bg-blue-container text-primary text-[11px] font-bold">{{ reel.mediaType || 'REELS' }}</span>
              <span
                class="px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                [ngClass]="reel.status === 'VERIFIED' ? 'bg-mint-container text-[#137333]' : (reel.status === 'LIVE_PREVIEW' ? 'bg-blue-container/60 text-primary' : 'bg-marigold-container text-tertiary')">
                {{ reel.status }}
              </span>
              @if (reel.shortcode) {
                <span class="font-mono text-xs text-ink-secondary">{{ reel.shortcode }}</span>
              }
            </div>
            <h1 class="font-headline text-xl sm:text-2xl font-bold text-ink-primary truncate mt-1">{{ reel.title }}</h1>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 shrink-0">
          @if (isLivePreview) {
            <button
              type="button"
              (click)="trackLiveReel.emit(reel)"
              [disabled]="tracking"
              class="btn-shimmer h-9 px-4 rounded-full bg-primary hover:bg-primary-container text-white text-xs font-semibold cursor-pointer disabled:opacity-60">
              {{ tracking ? 'Tracking...' : '+ Track as Deliverable' }}
            </button>
          } @else {
            <button
              type="button"
              (click)="syncReel.emit(reel.id)"
              [disabled]="syncing"
              class="h-9 px-4 rounded-full bg-primary hover:bg-primary-container text-white text-xs font-semibold cursor-pointer disabled:opacity-60">
              {{ syncing ? 'Syncing IG...' : 'Sync Reel IG' }}
            </button>
          }
          <button
            type="button"
            (click)="copyUrl.emit(reel.reelUrl)"
            class="h-9 px-4 rounded-full bg-surface-container text-ink-primary hover:bg-surface-container-high text-xs font-semibold cursor-pointer">
            Copy URL
          </button>
          <a
            [href]="reel.reelUrl"
            target="_blank"
            rel="noopener"
            class="h-9 px-4 rounded-full bg-blue-container text-primary hover:bg-primary hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors">
            <span>Open on Instagram ↗</span>
          </a>
        </div>
      </div>

      <!-- Hero Content Preview & Official Metrics -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div class="bg-surface-container-lowest rounded-3xl p-4 border border-surface-container-high shadow-2xs flex flex-col gap-3">
          @if (reel.thumbnailUrl) {
            <img [src]="reel.thumbnailUrl" [alt]="reel.title" (error)="reel.thumbnailUrl = ''" class="w-full h-72 object-cover rounded-2xl bg-surface-warm"/>
          } @else {
            <div class="w-full h-56 rounded-2xl bg-surface-warm flex flex-col items-center justify-center text-ink-secondary text-xs gap-1">
              <span class="font-mono font-bold text-sm text-primary">{{ reel.mediaType || 'REELS' }}</span>
              <span>{{ reel.shortcode || 'Instagram Reel' }}</span>
            </div>
          }
          <div class="flex items-center justify-between text-[11px] text-ink-secondary px-1">
            <span>Synced from Instagram</span>
            @if (reel.publishedAt) {
              <span>Published {{ reel.publishedAt | date:'mediumDate' }}</span>
            } @else if (reel.syncedAt) {
              <span>Synced {{ reel.syncedAt | date:'short' }}</span>
            }
          </div>
        </div>

        <!-- Right 2 Columns: Creator Header + Official Performance + Cost ROI -->
        <div class="lg:col-span-2 space-y-4">
          <div class="bg-surface-container-lowest rounded-3xl p-5 border border-surface-container-high shadow-2xs space-y-3">
            @if (creator; as c) {
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  @if (c.avatarUrl) {
                    <img [src]="c.avatarUrl" [alt]="c.name" class="w-10 h-10 rounded-full object-cover border border-surface-container-high shrink-0"/>
                  } @else {
                    <div class="w-10 h-10 rounded-full bg-blue-container text-primary font-headline font-bold flex items-center justify-center shrink-0">
                      {{ c.name.substring(0, 2).toUpperCase() }}
                    </div>
                  }
                  <div class="min-w-0">
                    <p class="font-headline font-bold text-sm text-ink-primary truncate">{{ c.name }}</p>
                    <p class="text-xs font-mono text-ink-secondary truncate">{{ c.handle }} • {{ c.followersDisplay || formatCompact(c.followersCount) }} followers</p>
                  </div>
                </div>
                @if (c.campaignName) {
                  <span class="px-3 py-1 rounded-full bg-surface-warm text-ink-primary text-xs font-semibold shrink-0">{{ c.campaignName }}</span>
                }
              </div>
            }
            @if (reel.caption) {
              <p class="text-xs text-ink-secondary leading-relaxed whitespace-pre-line border-t border-surface-variant/30 pt-3">{{ reel.caption }}</p>
            }
          </div>

          <!-- Reel Performance Metrics -->
          <div class="bg-surface-container-lowest rounded-3xl p-5 border border-surface-container-high shadow-2xs space-y-3">
            <h2 class="font-headline text-sm font-bold text-ink-primary">Reel performance metrics</h2>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="p-3.5 rounded-2xl bg-surface-warm/65">
                <p class="font-headline text-2xl font-bold text-primary">{{ reel.viewsCount > 0 ? reel.viewsCount.toLocaleString('en-IN') : (reel.mediaType === 'IMAGE' || reel.mediaType === 'CAROUSEL_ALBUM' || reel.mediaType === 'FEED' ? 'Photo' : '0') }}</p>
                <p class="text-[11px] font-semibold text-ink-primary mt-0.5">Reel views</p>
                <p class="text-[10px] text-ink-secondary">
                  {{ reel.viewsCount > 0 ? 'Instagram Reel views' : (reel.mediaType === 'IMAGE' || reel.mediaType === 'CAROUSEL_ALBUM' || reel.mediaType === 'FEED' ? 'No views on photo posts' : 'Instagram Reel views') }}
                </p>
              </div>
              <div class="p-3.5 rounded-2xl bg-surface-warm/65">
                <p class="font-headline text-2xl font-bold text-ink-primary">{{ reel.likesCount.toLocaleString('en-IN') }}</p>
                <p class="text-[11px] font-semibold text-ink-primary mt-0.5">Likes</p>
                <p class="text-[10px] text-ink-secondary">Post likes</p>
              </div>
              <div class="p-3.5 rounded-2xl bg-surface-warm/65">
                <p class="font-headline text-2xl font-bold text-ink-primary">{{ reel.commentsCount.toLocaleString('en-IN') }}</p>
                <p class="text-[11px] font-semibold text-ink-primary mt-0.5">Comments</p>
                <p class="text-[10px] text-ink-secondary">Audience comments</p>
              </div>
              <div class="p-3.5 rounded-2xl bg-surface-warm/65">
                <p class="font-headline text-2xl font-bold text-[#137333]">{{ reel.engagementRate > 0 ? reel.engagementRate + '%' : '—' }}</p>
                <p class="text-[11px] font-semibold text-ink-primary mt-0.5">Engagement rate</p>
                @if (derived.engagementVsCreatorAvgPct !== 0) {
                  <p class="text-[10px]" [ngClass]="derived.engagementVsCreatorAvgPct >= 0 ? 'text-[#137333]' : 'text-ink-secondary'">
                    {{ derived.engagementVsCreatorAvgPct >= 0 ? '+' : '' }}{{ derived.engagementVsCreatorAvgPct }}% vs creator avg
                  </p>
                } @else {
                  <p class="text-[10px] text-ink-secondary">Likes + Comments ratio</p>
                }
              </div>
            </div>
          </div>

          <!-- Official Ratio & Cost Efficiency Signals -->
          <div class="bg-surface-container-lowest rounded-3xl p-5 border border-surface-container-high shadow-2xs space-y-3">
            <h2 class="font-headline text-sm font-bold text-ink-primary">Reel ratios &amp; cost ROI</h2>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div class="p-3 rounded-2xl bg-surface-cream">
                <span class="text-[10px] uppercase font-bold text-ink-secondary">Total Interactions</span>
                <p class="font-headline text-lg font-bold text-ink-primary mt-0.5">{{ derived.totalInteractions.toLocaleString('en-IN') }}</p>
                <p class="text-[10px] text-ink-secondary">Likes + Comments</p>
              </div>
              <div class="p-3 rounded-2xl bg-surface-cream">
                <span class="text-[10px] uppercase font-bold text-ink-secondary">Like-to-View Rate</span>
                <p class="font-headline text-lg font-bold text-ink-primary mt-0.5">{{ derived.likeRatePct > 0 ? derived.likeRatePct + '%' : '—' }}</p>
                <p class="text-[10px] text-ink-secondary">Likes / Views</p>
              </div>
              <div class="p-3 rounded-2xl bg-surface-cream">
                <span class="text-[10px] uppercase font-bold text-ink-secondary">Comment Rate</span>
                <p class="font-headline text-lg font-bold text-ink-primary mt-0.5">{{ derived.commentRatePct > 0 ? derived.commentRatePct + '%' : '—' }}</p>
                <p class="text-[10px] text-ink-secondary">Comments / Views</p>
              </div>
              <div class="p-3 rounded-2xl bg-surface-cream">
                <span class="text-[10px] uppercase font-bold text-ink-secondary">View / Follower Ratio</span>
                <p class="font-headline text-lg font-bold text-primary mt-0.5">{{ derived.viewToFollowerRatioPct > 0 ? derived.viewToFollowerRatioPct + '%' : '—' }}</p>
                <p class="text-[10px] text-ink-secondary">Views / Followers</p>
              </div>
              <div class="p-3 rounded-2xl bg-surface-cream">
                <span class="text-[10px] uppercase font-bold text-ink-secondary">CPV (Cost Per View)</span>
                <p class="font-headline text-lg font-bold text-primary mt-0.5">{{ derived.costPerView ? formatInr(derived.costPerView, 2) : '—' }}</p>
                <p class="text-[10px] text-ink-secondary">{{ derived.costQuoted ? formatInr(derived.costQuoted, 0) + (derived.costLabel ? ' • ' + derived.costLabel : '') : (derived.costLabel || 'Set cost on creator or reel') }}</p>
              </div>
              <div class="p-3 rounded-2xl bg-surface-cream">
                <span class="text-[10px] uppercase font-bold text-ink-secondary">CPE (Cost / Interaction)</span>
                <p class="font-headline text-lg font-bold text-ink-primary mt-0.5">{{ derived.costPerInteraction ? formatInr(derived.costPerInteraction, 1) : '—' }}</p>
                <p class="text-[10px] text-ink-secondary">Per like or comment</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `
})
export class ReelInsightsViewComponent {
  @Input({ required: true }) reel!: ReelDeliverable & { publishedAt?: string };
  @Input() creator: Creator | null = null;
  @Input() bundle: DeliverableInsightsBundle | null = null;
  @Input() isLivePreview = false;
  @Input() syncing = false;
  @Input() tracking = false;

  @Output() back = new EventEmitter<void>();
  @Output() syncReel = new EventEmitter<string>();
  @Output() trackLiveReel = new EventEmitter<ReelDeliverable>();
  @Output() copyUrl = new EventEmitter<string>();

  get derived() {
    if (this.bundle?.derived) return this.bundle.derived;
    const views = this.reel?.viewsCount || 0;
    const likes = this.reel?.likesCount || 0;
    const comments = this.reel?.commentsCount || 0;
    const totalInt = likes + comments;
    const followers = this.creator?.followersCount || 0;
    const creatorAvg = this.creator?.interactionRate90d || 0;
    const eng = this.reel?.engagementRate || (followers > 0 && totalInt > 0 ? Math.round((totalInt * 100.0 / followers) * 100) / 100 : 0);
    const mode: 'COLLECTIVE' | 'PER_DELIVERABLE' =
      this.creator?.costMode === 'PER_DELIVERABLE' ? 'PER_DELIVERABLE' : 'COLLECTIVE';
    const cost = mode === 'PER_DELIVERABLE'
      ? (this.reel?.costQuoted || this.creator?.costQuoted || null)
      : (this.creator?.costQuoted || null);

    return {
      totalInteractions: totalInt,
      likeRatePct: views > 0 ? Math.round((likes * 100.0 / views) * 100) / 100 : 0,
      commentRatePct: views > 0 ? Math.round((comments * 100.0 / views) * 100) / 100 : 0,
      viewToFollowerRatioPct: followers > 0 && views > 0 ? Math.round((views * 100.0 / followers) * 10) / 10 : 0,
      shareOfCreatorViewsPct: 0,
      engagementVsCreatorAvgPct: creatorAvg > 0 ? Math.round((eng - creatorAvg) * 10) / 10 : 0,
      costMode: mode,
      costLabel: mode === 'PER_DELIVERABLE' ? (this.reel?.costQuoted ? 'Deliverable cost' : 'Per-deliverable rate') : 'Fixed creator cost',
      costQuoted: cost,
      costPerView: cost && views > 0 ? Math.round((cost / views) * 100) / 100 : null,
      costPerInteraction: cost && totalInt > 0 ? Math.round((cost / totalInt) * 100) / 100 : null
    };
  }

  formatCompact(n: number): string {
    if (!n || n <= 0) return '—';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  formatInr(n: number, decimals = 0): string {
    if (!n || n <= 0) return '—';
    return '₹' + n.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }
}
