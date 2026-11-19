import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Creator, CreatorInsightsBundle, InstagramStatus, ReelDeliverable } from '../services/api.service';

@Component({
  selector: 'app-creator-insights-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (creator; as ic) {
      <section class="space-y-5 animate-fade-in-up">
        <!-- Whole-Page Top Header & Navigation -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-surface-variant/60">
          <div class="flex items-start sm:items-center gap-3.5 min-w-0">
            <button
              type="button"
              (click)="close.emit()"
              class="h-9.5 px-4 rounded-full bg-surface-container-lowest border border-surface-container-high hover:bg-surface-cream text-ink-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors">
              <span>← Back to Roster</span>
            </button>

            <div class="flex items-center gap-3 min-w-0">
              @if (ic.avatarUrl) {
                <img [src]="ic.avatarUrl" [alt]="ic.name" (error)="ic.avatarUrl = null" class="w-12 h-12 rounded-full object-cover border border-surface-container-high shrink-0"/>
              } @else {
                <div class="w-12 h-12 rounded-full bg-blue-container text-primary font-headline font-bold text-base flex items-center justify-center shrink-0">
                  {{ ic.name.substring(0, 2).toUpperCase() }}
                </div>
              }
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h1 class="font-headline text-xl sm:text-2xl font-bold text-ink-primary truncate">{{ ic.name }}</h1>
                  @if (ic.verified) {
                    <span title="Verified Creator" class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white text-[10px]">✓</span>
                  }
                  @if (ic.postedLast28Days) {
                    <span class="px-2.5 py-0.5 rounded-full bg-mint-container text-[#137333] text-[10px] font-bold">Active in 28d</span>
                  }
                </div>
                <div class="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-ink-secondary mt-0.5">
                  <a [href]="ic.profileUrl || 'https://www.instagram.com/' + ic.handle.replace('@', '') + '/'" target="_blank" rel="noopener" class="font-mono text-primary hover:underline">{{ ic.handle }} ↗</a>
                  @if (ic.followersCount > 0) {
                    <span>• <strong class="text-ink-primary">{{ ic.followersDisplay || formatCompact(ic.followersCount) }}</strong> followers</span>
                  }
                  @if ((ic.followsCount || 0) > 0) {
                    <span>• {{ formatCount(ic.followsCount || 0) }} following</span>
                  }
                  @if ((ic.mediaCount || 0) > 0) {
                    <span>• {{ formatCount(ic.mediaCount || 0) }} posts</span>
                  }
                  @if (ic.category || ic.niche) {
                    <span>• {{ ic.category || ic.niche }}</span>
                  }
                  @if (ic.managementHandle) {
                    <span class="font-mono">• {{ ic.managementHandle }}</span>
                  }
                  @if (ic.country) {
                    <span>• {{ ic.country }}</span>
                  }
                </div>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 shrink-0">
            <button type="button" (click)="editMode.set(!editMode()); pricingMenuOpen.set(false)" class="h-9.5 px-4 rounded-full bg-surface-container text-ink-primary hover:bg-surface-container-high text-xs font-semibold cursor-pointer transition-colors">
              {{ editMode() ? 'Done Editing' : 'Edit Cost & Tags' }}
            </button>
            <button type="button" (click)="syncCreator.emit()" [disabled]="syncing" class="btn-shimmer h-9.5 px-5 rounded-full bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold cursor-pointer disabled:opacity-60">
              {{ syncing ? 'Syncing IG...' : 'Sync Instagram' }}
            </button>
          </div>
        </div>

        <!-- Inline Edit Commercial Rate & CRM Tags (IG metrics & Category strictly read-only) -->
        @if (editMode()) {
          @if (pricingMenuOpen()) {
            <div class="fixed inset-0 z-20" (click)="pricingMenuOpen.set(false)"></div>
          }
          <form (ngSubmit)="submitEdit()" class="relative z-30 bg-surface-container-lowest rounded-3xl p-5 sm:p-6 border border-primary/25 shadow-sm space-y-4 animate-pop-in">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-surface-variant/40 pb-3">
              <div>
                <h2 class="font-headline text-sm font-bold text-ink-primary">Edit Cost Quoted &amp; Creator Tags</h2>
                <p class="text-xs text-ink-secondary">Agreed rate drives CPM, CPE &amp; CPV ROI benchmarks. Category &amp; Instagram metrics remain read-only.</p>
              </div>
              <div class="flex flex-wrap items-center gap-1.5 shrink-0">
                @if (ic.category || ic.niche) {
                  <span class="px-2.5 py-0.5 rounded-full bg-surface-warm border border-surface-container-high text-ink-secondary text-[10px] font-semibold">Category (Locked): {{ ic.category || ic.niche }}</span>
                }
                <span class="px-2.5 py-0.5 rounded-full bg-blue-container text-primary text-[10px] font-bold">IG Metrics Read-Only</span>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div class="relative">
                <label class="block font-semibold text-ink-secondary mb-1">Pricing Model</label>
                <button
                  type="button"
                  (click)="pricingMenuOpen.set(!pricingMenuOpen())"
                  class="w-full h-9.5 px-3.5 rounded-xl bg-surface-warm hover:bg-surface-container-soft border border-surface-container-high/80 font-semibold text-ink-primary flex items-center justify-between gap-2 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary">
                  <span>{{ form.costMode === 'PER_DELIVERABLE' ? 'Cost Per Deliverable' : 'Fixed Cost' }}</span>
                  <svg class="w-4 h-4 text-ink-secondary transition-transform duration-150 shrink-0" [class.rotate-180]="pricingMenuOpen()" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/>
                  </svg>
                </button>
                @if (pricingMenuOpen()) {
                  <div class="absolute left-0 right-0 mt-1.5 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-xl p-1.5 z-40 space-y-1 animate-pop-in">
                    <button
                      type="button"
                      (click)="selectFormCostMode('COLLECTIVE')"
                      class="w-full text-left px-3 py-2 rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-colors"
                      [ngClass]="form.costMode === 'COLLECTIVE' ? 'bg-blue-container/70 text-primary' : 'hover:bg-surface-warm text-ink-primary'">
                      <div>
                        <p class="font-semibold text-xs">Fixed Cost</p>
                        <p class="text-[10px] text-ink-secondary">Single fixed fee for the creator</p>
                      </div>
                      @if (form.costMode === 'COLLECTIVE') {
                        <span class="text-primary font-bold text-xs">✓</span>
                      }
                    </button>
                    <button
                      type="button"
                      (click)="selectFormCostMode('PER_DELIVERABLE')"
                      class="w-full text-left px-3 py-2 rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-colors"
                      [ngClass]="form.costMode === 'PER_DELIVERABLE' ? 'bg-blue-container/70 text-primary' : 'hover:bg-surface-warm text-ink-primary'">
                      <div>
                        <p class="font-semibold text-xs">Cost Per Deliverable</p>
                        <p class="text-[10px] text-ink-secondary">Rate applied per tracked Reel</p>
                      </div>
                      @if (form.costMode === 'PER_DELIVERABLE') {
                        <span class="text-primary font-bold text-xs">✓</span>
                      }
                    </button>
                  </div>
                }
              </div>

              <div>
                <label class="block font-semibold text-ink-secondary mb-1">{{ form.costMode === 'PER_DELIVERABLE' ? 'Rate Per Deliverable (₹ INR)' : 'Fixed Cost (₹ INR)' }}</label>
                <input [(ngModel)]="form.costQuoted" name="cCost" type="number" min="0" step="100" placeholder="e.g. 100000" class="w-full h-9.5 px-3.5 rounded-xl bg-surface-warm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"/>
              </div>
              <div>
                <label class="block font-semibold text-ink-secondary mb-1">Management Handle</label>
                <input [(ngModel)]="form.managementHandle" name="cMgmt" placeholder="@talentagency" class="w-full h-9.5 px-3.5 rounded-xl bg-surface-warm focus:outline-none focus:ring-2 focus:ring-primary"/>
              </div>
              <div>
                <label class="block font-semibold text-ink-secondary mb-1">Country</label>
                <input [(ngModel)]="form.country" name="cCountry" placeholder="India" class="w-full h-9.5 px-3.5 rounded-xl bg-surface-warm focus:outline-none focus:ring-2 focus:ring-primary"/>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end text-xs">
              <div class="sm:col-span-1 lg:col-span-3">
                <label class="block font-semibold text-ink-secondary mb-1">Tags</label>
                <input [(ngModel)]="form.creatorTraits" name="cTraits" placeholder="Skincare, Lifestyle" class="w-full h-9.5 px-3.5 rounded-xl bg-surface-warm focus:outline-none focus:ring-2 focus:ring-primary"/>
              </div>
              <div class="flex justify-end gap-2">
                <button type="button" (click)="editMode.set(false); pricingMenuOpen.set(false)" class="px-4 py-2 rounded-full text-xs font-semibold text-ink-secondary cursor-pointer">Cancel</button>
                <button type="submit" [disabled]="savingProfile" class="px-5 py-2 rounded-full bg-primary hover:bg-primary-container text-white text-xs font-semibold cursor-pointer disabled:opacity-60">
                  {{ savingProfile ? 'Saving...' : 'Save Cost &amp; Tags' }}
                </button>
              </div>
            </div>
          </form>
        }

        <!-- Creator Bio & Tags + Interactive Performance Breakdown Pie Chart -->
        @let chart = chartBreakdown();
        @let active = findActiveSlice(chart.slices);
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
          @if (ic.bio || traitsList().length > 0) {
            <div class="lg:col-span-2 bg-surface-container-lowest rounded-3xl p-5 border border-surface-container-high shadow-2xs space-y-3 flex flex-col justify-between">
              <div class="space-y-2.5">
                <h2 class="font-headline text-sm font-bold text-ink-primary">Creator Bio &amp; Tags</h2>
                @if (ic.bio) {
                  <p class="text-xs sm:text-sm text-ink-secondary leading-relaxed whitespace-pre-line">{{ ic.bio }}</p>
                }
              </div>
              @if (traitsList().length > 0) {
                <div class="flex flex-wrap gap-1.5 pt-1">
                  @for (trait of traitsList(); track trait) {
                    <span class="px-2.5 py-1 rounded-full bg-surface-warm border border-surface-container-high text-ink-primary text-[11px] font-medium">{{ trait }}</span>
                  }
                </div>
              }
            </div>
          }

          <div [ngClass]="(ic.bio || traitsList().length > 0) ? 'lg:col-span-3' : 'lg:col-span-5'"
               class="bg-surface-container-lowest rounded-3xl p-5 border border-surface-container-high shadow-2xs space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h2 class="font-headline text-sm font-bold text-ink-primary">Tracked Performance Breakdown</h2>
                <p class="text-[11px] text-ink-secondary">Hover or click slices to inspect tracked Reel share &amp; engagement mix</p>
              </div>
              <div class="inline-flex items-center p-1 rounded-full bg-surface-warm border border-surface-container-high/70 self-start sm:self-center shrink-0">
                <button type="button" (click)="selectChartTab('views')"
                        class="px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-colors"
                        [ngClass]="chart.mode === 'views' ? 'bg-primary text-white shadow-2xs' : 'text-ink-secondary hover:text-ink-primary'">
                  Views
                </button>
                <button type="button" (click)="selectChartTab('interactions')"
                        class="px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-colors"
                        [ngClass]="chart.mode === 'interactions' ? 'bg-primary text-white shadow-2xs' : 'text-ink-secondary hover:text-ink-primary'">
                  By Reel
                </button>
                <button type="button" (click)="selectChartTab('mix')"
                        class="px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-colors"
                        [ngClass]="chart.mode === 'mix' ? 'bg-primary text-white shadow-2xs' : 'text-ink-secondary hover:text-ink-primary'">
                  Likes vs Cmts
                </button>
              </div>
            </div>

            @if (chart.slices.length === 0) {
              <div class="flex flex-col sm:flex-row items-center gap-5 py-2">
                <div class="relative w-36 h-36 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 180 180" class="w-36 h-36">
                    <circle cx="90" cy="90" r="64" fill="none" stroke="#efe9df" stroke-width="24" stroke-dasharray="10 8"/>
                  </svg>
                  <div class="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <span class="font-headline text-lg font-bold text-ink-secondary">—</span>
                    <span class="text-[10px] uppercase tracking-wide text-ink-secondary/80 mt-0.5">{{ chart.unitLabel }}</span>
                  </div>
                </div>
                <div class="space-y-2 text-center sm:text-left">
                  <p class="text-xs text-ink-secondary leading-relaxed">{{ chart.emptyReason }}</p>
                  @if (igStatus?.configured && !showReelPicker()) {
                    <button type="button" (click)="toggleReelPicker(ic)" class="px-3.5 py-1.5 rounded-full bg-blue-container text-primary hover:bg-primary hover:text-white text-xs font-semibold cursor-pointer transition-colors">
                      + Pick Reel from IG
                    </button>
                  }
                </div>
              </div>
            } @else {
              <div class="flex flex-col sm:flex-row items-center gap-5">
                <div class="relative w-40 h-40 shrink-0">
                  <svg viewBox="0 0 180 180" class="w-40 h-40 select-none">
                    <circle cx="90" cy="90" r="64" fill="none" stroke="#f2ede4" stroke-width="26"/>
                    <g transform="rotate(-90 90 90)">
                      @for (s of chart.slices; track s.id) {
                        <circle
                          cx="90"
                          cy="90"
                          r="64"
                          fill="none"
                          [attr.stroke]="s.color"
                          [attr.stroke-width]="activeSliceId() === s.id ? 31 : 26"
                          [attr.stroke-dasharray]="s.dashArray"
                          [attr.stroke-dashoffset]="s.dashOffset"
                          [style.opacity]="activeSliceId() && activeSliceId() !== s.id ? 0.42 : 1"
                          class="transition-all duration-200 cursor-pointer"
                          (mouseenter)="hoveredSliceId.set(s.id)"
                          (mouseleave)="hoveredSliceId.set(null)"
                          (click)="togglePinSlice(s.id)"/>
                      }
                    </g>
                  </svg>
                  <div class="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-5">
                    @if (active) {
                      <span class="font-headline text-xl font-bold leading-none" [style.color]="active.color">{{ active.pctLabel }}</span>
                      <span class="font-headline text-xs font-bold text-ink-primary mt-1">{{ formatCount(active.value) }}</span>
                      <span class="text-[10px] text-ink-secondary truncate max-w-[92px] mt-0.5">{{ active.label }}</span>
                    } @else {
                      <span class="font-headline text-xl font-bold text-ink-primary leading-none">{{ chart.totalLabel }}</span>
                      <span class="text-[10px] font-semibold uppercase tracking-wide text-ink-secondary mt-1">{{ chart.unitLabel }}</span>
                      <span class="text-[9px] text-ink-secondary/80 mt-0.5">{{ chart.slices.length }} slice(s)</span>
                    }
                  </div>
                </div>

                <div class="flex-1 w-full min-w-0 space-y-2">
                  @for (s of chart.slices; track s.id) {
                    <div
                      (mouseenter)="hoveredSliceId.set(s.id)"
                      (mouseleave)="hoveredSliceId.set(null)"
                      (click)="togglePinSlice(s.id)"
                      class="w-full text-left px-3 py-2 rounded-2xl border transition-colors cursor-pointer"
                      [ngClass]="activeSliceId() === s.id ? 'bg-surface-warm border-primary/40' : 'bg-surface-cream/60 border-surface-container-high/70 hover:bg-surface-warm/70'">
                      <div class="flex items-center justify-between gap-2 text-xs">
                        <div class="flex items-center gap-2 min-w-0">
                          <span class="w-2.5 h-2.5 rounded-full shrink-0" [style.background]="s.color"></span>
                          <span class="font-semibold text-ink-primary truncate">{{ s.label }}</span>
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                          <span class="font-mono font-bold text-ink-primary">{{ formatCount(s.value) }} · {{ s.pctLabel }}</span>
                          @if (s.reel; as rowReel) {
                            <button type="button" (click)="$event.stopPropagation(); openReel.emit(rowReel)" class="text-[10px] font-semibold text-primary hover:underline cursor-pointer">
                              Insights ↗
                            </button>
                          }
                        </div>
                      </div>
                      <div class="mt-1.5 h-1.5 w-full rounded-full bg-surface-container-soft overflow-hidden">
                        <div class="h-full rounded-full transition-all duration-300" [style.width.%]="s.pct" [style.background]="s.color"></div>
                      </div>
                    </div>
                  }

                  <div class="min-h-[30px] flex items-center justify-between gap-2 px-1 pt-0.5 text-[11px] text-ink-secondary">
                    <span class="truncate">{{ active ? active.subtitle : 'Hover or click a slice or row to pin details' }}</span>
                    @if (pinnedSliceId()) {
                      <button type="button" (click)="pinnedSliceId.set(null)" class="text-[11px] font-semibold text-ink-secondary hover:text-ink-primary shrink-0 cursor-pointer">
                        Clear
                      </button>
                    }
                  </div>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Top 4 Official KPI Cards (Tracked Reels Only) -->
        @let kpis = computedKpis();
        <div class="space-y-2">
          <div class="flex items-center justify-between px-1">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
              Tracked Reels Insights
              @if (kpis.submittedDeliverables > 0) {
                <span> • Aggregated across {{ kpis.submittedDeliverables }} tracked item(s)</span>
              } @else {
                <span> • Add Reels below to track insights</span>
              }
            </p>
          </div>
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-surface-container-lowest rounded-3xl p-5 border border-surface-container-high shadow-2xs">
              <p class="text-[11px] uppercase tracking-wider font-bold text-ink-secondary">Total Views</p>
              <p class="font-headline text-2xl sm:text-3xl font-bold text-ink-primary mt-1.5">{{ formatCount(kpis.totalViews) }}</p>
              <p class="text-[11px] text-ink-secondary mt-1">
                @if (kpis.totalViews > 0) {
                  <span>Across {{ kpis.postsWithViewsCount }} tracked Reel(s)</span>
                } @else if ((kpis.staticPhotoCount || 0) > 0 && kpis.submittedDeliverables > 0) {
                  <span>Photo posts have no video views — track a Reel</span>
                } @else if (kpis.submittedDeliverables > 0) {
                  <span>Click Sync to refresh Instagram Reel views</span>
                } @else {
                  <span>Track campaign Reels below</span>
                }
              </p>
            </div>

            <div class="bg-surface-container-lowest rounded-3xl p-5 border border-surface-container-high shadow-2xs">
              <p class="text-[11px] uppercase tracking-wider font-bold text-ink-secondary">Engagements (Likes)</p>
              <p class="font-headline text-2xl sm:text-3xl font-bold text-ink-primary mt-1.5">{{ kpis.totalLikes >= 0 ? kpis.totalLikes.toLocaleString('en-IN') : '0' }}</p>
              <p class="text-[11px] text-ink-secondary mt-1">{{ kpis.totalLikes > 0 ? 'From tracked deliverable(s)' : 'No likes recorded yet' }}</p>
            </div>

            <div class="bg-surface-container-lowest rounded-3xl p-5 border border-surface-container-high shadow-2xs">
              <p class="text-[11px] uppercase tracking-wider font-bold text-ink-secondary">Comments</p>
              <p class="font-headline text-2xl sm:text-3xl font-bold text-ink-primary mt-1.5">{{ kpis.totalComments.toLocaleString('en-IN') }}</p>
              <p class="text-[11px] text-ink-secondary mt-1">Across tracked deliverable(s)</p>
            </div>

            <div class="bg-surface-container-lowest rounded-3xl p-5 border border-surface-container-high shadow-2xs">
              <p class="text-[11px] uppercase tracking-wider font-bold text-ink-secondary">Tracked Reels</p>
              <p class="font-headline text-2xl sm:text-3xl font-bold text-ink-primary mt-1.5">{{ kpis.submittedDeliverables }}</p>
              <p class="text-[11px] text-ink-secondary mt-1">{{ ic.mediaCount ? formatCount(ic.mediaCount) + ' total IG posts' : 'Tracked campaign slots' }}</p>
            </div>
          </div>
        </div>

        <!-- Influencer ROI & Performance Benchmarks (Tracked Reels + Cost Quoted Only) -->
        @let roi = computedRoi();
        <div class="bg-surface-container-lowest rounded-3xl p-5 sm:p-6 border border-surface-container-high shadow-2xs space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 class="font-headline text-base font-bold text-ink-primary">Influencer ROI &amp; Performance Benchmarks</h2>
              <p class="text-xs text-ink-secondary">Calculated exclusively from tracked Reels, Instagram followers, and {{ roi.costMode === 'PER_DELIVERABLE' ? 'per-deliverable pricing' : 'fixed creator rate' }}</p>
            </div>
            <div class="flex flex-wrap items-center gap-2 shrink-0">
              @if (roi.tier && roi.tier !== '—') {
                <span class="px-3 py-1 rounded-full bg-surface-warm border border-surface-container-high text-xs font-semibold text-ink-primary">{{ roi.tier }} Creator</span>
              }
              <span class="px-3 py-1 rounded-full bg-blue-container/75 border border-primary/15 text-primary text-xs font-semibold">
                {{ roi.costMode === 'PER_DELIVERABLE' ? 'Cost Per Deliverable' : 'Fixed Cost' }}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
            <div class="p-4 rounded-2xl bg-surface-cream border border-surface-container-high/60">
              <p class="text-[10px] uppercase tracking-wider font-bold text-ink-secondary">IR % (Interaction Rate)</p>
              <p class="font-headline text-xl font-bold text-primary mt-1">{{ roi.interactionRatePct > 0 ? roi.interactionRatePct + '%' : '—' }}</p>
              <p class="text-[11px] text-ink-secondary mt-0.5">Tracked likes+cmts / followers</p>
            </div>

            <div class="p-4 rounded-2xl bg-surface-cream border border-surface-container-high/60">
              <p class="text-[10px] uppercase tracking-wider font-bold text-ink-secondary">Avg Views / Reel</p>
              <p class="font-headline text-xl font-bold text-ink-primary mt-1">{{ roi.avgViewsPerPost > 0 ? formatCount(roi.avgViewsPerPost) : '—' }}</p>
              <p class="text-[11px] text-ink-secondary mt-0.5">{{ roi.avgViewsPostCount > 0 ? 'Across ' + roi.avgViewsPostCount + ' tracked Reel(s)' : 'Track a Video Reel for views' }}</p>
            </div>

            <div class="p-4 rounded-2xl bg-surface-cream border border-surface-container-high/60">
              <p class="text-[10px] uppercase tracking-wider font-bold text-ink-secondary">{{ roi.costMode === 'PER_DELIVERABLE' ? 'Total Deliverable Cost' : 'Fixed Cost' }}</p>
              <p class="font-headline text-xl font-bold text-ink-primary mt-1">{{ roi.costQuoted ? formatInr(roi.costQuoted, 0) : (roi.costMode === 'PER_DELIVERABLE' && roi.baseRate ? formatInr(roi.baseRate, 0) + '/reel' : '—') }}</p>
              <p class="text-[11px] text-ink-secondary mt-0.5">
                @if (roi.costMode === 'PER_DELIVERABLE') {
                  <span>{{ (roi.pricedDeliverablesCount || 0) > 0 ? 'Across ' + roi.pricedDeliverablesCount + ' deliverable(s)' : 'Set cost in Edit Cost & Tags or per Reel' }}</span>
                } @else {
                  <span>{{ roi.costQuoted ? 'Fixed creator fee' : 'Set via Edit Cost & Tags above' }}</span>
                }
              </p>
            </div>

            <div class="p-4 rounded-2xl bg-surface-cream border border-surface-container-high/60">
              <p class="text-[10px] uppercase tracking-wider font-bold text-ink-secondary">Cost / 1,000 Followers</p>
              <p class="font-headline text-xl font-bold text-ink-primary mt-1">{{ roi.costPer1kFollowers ? formatInr(roi.costPer1kFollowers, 0) : '—' }}</p>
              <p class="text-[11px] text-ink-secondary mt-0.5">CPM audience reach</p>
            </div>

            <div class="p-4 rounded-2xl bg-surface-cream border border-surface-container-high/60">
              <p class="text-[10px] uppercase tracking-wider font-bold text-ink-secondary">Cost / Interaction (CPE)</p>
              <p class="font-headline text-xl font-bold text-ink-primary mt-1">{{ roi.costPerInteraction ? formatInr(roi.costPerInteraction, 1) : '—' }}</p>
              <p class="text-[11px] text-ink-secondary mt-0.5">Per verified like/comment</p>
            </div>

            <div class="p-4 rounded-2xl bg-surface-cream border border-surface-container-high/60">
              <p class="text-[10px] uppercase tracking-wider font-bold text-ink-secondary">CPV (Cost Per View)</p>
              <p class="font-headline text-xl font-bold text-primary mt-1">{{ roi.costPerView ? formatInr(roi.costPerView, 2) : '—' }}</p>
              <p class="text-[11px] text-ink-secondary mt-0.5">Cost per tracked view</p>
            </div>
          </div>
        </div>

        <!-- Tracked Reels & Deliverables (Only the Reels Added for Tracking) -->
        <div class="bg-surface-container-lowest rounded-3xl p-5 sm:p-6 border border-surface-container-high shadow-2xs space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-2.5 flex-wrap">
              <h2 class="font-headline text-base font-bold text-ink-primary">Tracked Reels &amp; Deliverables</h2>
              <span class="px-2.5 py-0.5 rounded-full bg-surface-warm border border-surface-container-high text-xs font-semibold text-ink-secondary">{{ reels.length }} Tracked</span>
            </div>
            @if (igStatus?.configured) {
              <button type="button" (click)="toggleReelPicker(ic)" class="h-8.5 px-4 rounded-full bg-blue-container text-primary hover:bg-primary hover:text-white text-xs font-semibold cursor-pointer transition-colors self-start sm:self-center">
                {{ showReelPicker() ? 'Hide IG Reel Picker' : (loadingMedia ? 'Loading IG Reels...' : '+ Pick Reel from IG (' + videoReelsFromFeed().length + ')') }}
              </button>
            }
          </div>

          <form (ngSubmit)="submitReelForm()" class="p-3.5 rounded-2xl bg-blue-container/25 border border-primary/20 grid grid-cols-1 gap-2.5 items-center" [ngClass]="roi.costMode === 'PER_DELIVERABLE' ? 'sm:grid-cols-6' : 'sm:grid-cols-5'">
            <input [(ngModel)]="newReelTitle" name="reelTitle" placeholder="Deliverable title" required class="sm:col-span-2 h-9.5 px-3.5 rounded-xl bg-white text-xs focus:outline-none focus:ring-2 focus:ring-primary"/>
            <input [(ngModel)]="newReelUrl" (ngModelChange)="duplicateReelNotice.set('')" name="reelUrl" placeholder="https://www.instagram.com/reel/..." required class="sm:col-span-2 h-9.5 px-3.5 rounded-xl bg-white text-xs focus:outline-none focus:ring-2 focus:ring-primary"/>
            @if (roi.costMode === 'PER_DELIVERABLE') {
              <input [(ngModel)]="newReelCost" name="reelCost" type="number" min="0" step="100" placeholder="Deliverable Cost ₹" class="h-9.5 px-3.5 rounded-xl bg-white text-xs focus:outline-none focus:ring-2 focus:ring-primary"/>
            }
            <button type="submit" class="h-9.5 px-4 rounded-xl bg-primary text-white text-xs font-semibold cursor-pointer hover:bg-primary-container">Verify &amp; Add Reel</button>
          </form>
          @if (duplicateReelNotice()) {
            <p class="text-xs font-semibold text-secondary bg-coral-container/35 border border-secondary/20 rounded-xl px-3.5 py-2">{{ duplicateReelNotice() }}</p>
          }

          <!-- Optional On-Demand IG Reel Picker (Shows Only Video/Reels with Official View Counts) -->
          @if (showReelPicker()) {
            @let igReels = videoReelsFromFeed();
            <div class="p-4 rounded-2xl bg-surface-warm/70 border border-surface-container-high space-y-3 animate-pop-in">
              <div class="flex items-center justify-between gap-2">
                <div>
                  <p class="text-xs font-bold text-ink-primary">Pick a Video Reel from {{ ic.handle }}'s Instagram ({{ igReels.length }})</p>
                  <p class="text-[11px] text-ink-secondary">Showing Instagram Reels &amp; Videos only so every tracked Reel includes Instagram view counts.</p>
                </div>
                <button type="button" (click)="browseMedia.emit(ic)" class="text-xs font-semibold text-primary hover:underline cursor-pointer shrink-0">
                  {{ loadingMedia ? 'Refreshing...' : 'Refresh IG' }}
                </button>
              </div>
              @if (igReels.length === 0) {
                <p class="text-xs text-ink-secondary py-3 text-center">No recent public Reels/Videos returned in the last 25 posts. You can still paste any older Reel URL in the bar above.</p>
              } @else {
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  @for (m of igReels; track m.id) {
                    @let alreadyTracked = isMediaAlreadyTracked(m);
                    <div class="p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-colors"
                         [ngClass]="alreadyTracked ? 'bg-mint-container/25 border-[#137333]/25' : 'bg-white border-surface-container-high'">
                      <div class="flex items-center gap-2.5 min-w-0">
                        @if (m.thumbnailUrl) {
                          <img [src]="m.thumbnailUrl" alt="Reel preview" (error)="m.thumbnailUrl = ''" class="w-11 h-11 rounded-lg object-cover shrink-0"/>
                        }
                        <div class="min-w-0">
                          <p class="font-semibold text-ink-primary truncate">{{ m.caption || 'Instagram Reel' }}</p>
                          <p class="text-[11px] text-ink-secondary truncate mt-0.5">
                            <strong class="text-primary">{{ formatCount(m.viewsCount || 0) }} views</strong> • {{ formatCount(m.likeCount || 0) }} likes • {{ formatCount(m.commentsCount || 0) }} cmts
                          </p>
                        </div>
                      </div>
                      @if (alreadyTracked) {
                        <span class="px-2.5 py-1.5 rounded-full bg-mint-container text-[#137333] text-[10px] font-bold shrink-0 select-none">✓ Already Added</span>
                      } @else {
                        <button type="button" (click)="selectMediaForTrack(m)" class="px-2.5 py-1.5 rounded-full bg-blue-container text-primary text-[10px] font-bold hover:bg-primary hover:text-white transition-colors shrink-0 cursor-pointer">+ Track</button>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }

          @if (reels.length === 0) {
            <p class="text-xs text-ink-secondary py-6 text-center bg-surface-cream rounded-2xl border border-dashed border-surface-variant">No Reels added for tracking yet. Paste an Instagram Reel URL above or click "+ Pick Reel from IG" to choose one.</p>
          } @else {
            <div class="space-y-3">
              @for (r of reels; track r.id) {
                <div class="rounded-2xl bg-surface-cream border border-surface-container-high hover:border-primary/40 transition-colors p-4">
                  <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div (click)="openReel.emit(r)" class="flex items-center gap-3.5 min-w-0 cursor-pointer flex-1">
                      @if (r.thumbnailUrl) {
                        <img [src]="r.thumbnailUrl" alt="Reel cover" (error)="r.thumbnailUrl = ''" class="w-12 h-12 rounded-xl object-cover border border-surface-container-high shrink-0"/>
                      } @else {
                        <div class="w-12 h-12 rounded-xl bg-blue-container/60 text-primary font-mono text-xs font-bold flex items-center justify-center shrink-0">REEL</div>
                      }
                      <div class="min-w-0">
                        <p class="text-sm font-bold text-ink-primary truncate hover:text-primary transition-colors">{{ r.title }}</p>
                        <p class="text-xs text-ink-secondary truncate mt-0.5">
                          {{ formatMediaLabel(r) }}
                          @if (r.publishedAt) {
                            <span> • Published {{ r.publishedAt | date:'MMM y' }}</span>
                          }
                          @if (roi.costMode === 'PER_DELIVERABLE') {
                            @if ((r.costQuoted || 0) > 0) {
                              <span class="font-semibold text-ink-primary"> • {{ formatInr(r.costQuoted || 0, 0) }}</span>
                            } @else if ((roi.baseRate || 0) > 0) {
                              <span class="font-medium text-ink-primary"> • {{ formatInr(roi.baseRate || 0, 0) }} (rate)</span>
                            } @else {
                              <button type="button" (click)="$event.stopPropagation(); startEditDeliverable(r)" class="ml-1.5 text-primary hover:underline font-semibold cursor-pointer">• + Set cost ₹</button>
                            }
                          }
                        </p>
                      </div>
                    </div>

                    <div class="flex flex-wrap items-center gap-4 sm:gap-6 shrink-0">
                      <div (click)="openReel.emit(r)" class="flex items-center gap-5 cursor-pointer">
                        <div class="text-center" [title]="isStaticPhotoPost(r) && !r.viewsCount ? 'Static photo/carousel posts do not include video views' : 'Instagram Reel views'">
                          @if (r.viewsCount > 0) {
                            <p class="font-headline text-sm font-bold text-primary">{{ r.viewsCount.toLocaleString('en-IN') }}</p>
                            <p class="text-[10px] uppercase font-semibold text-ink-secondary">Views</p>
                          } @else if (isStaticPhotoPost(r)) {
                            <p class="font-headline text-xs font-bold text-ink-secondary/80">Photo</p>
                            <p class="text-[10px] uppercase font-semibold text-ink-secondary/70">No IG Views</p>
                          } @else {
                            <p class="font-headline text-sm font-bold text-ink-secondary">0</p>
                            <p class="text-[10px] uppercase font-semibold text-ink-secondary">Views</p>
                          }
                        </div>
                        <div class="text-center">
                          <p class="font-headline text-sm font-bold text-ink-primary">{{ r.likesCount.toLocaleString('en-IN') }}</p>
                          <p class="text-[10px] uppercase font-semibold text-ink-secondary">Likes</p>
                        </div>
                        <div class="text-center">
                          <p class="font-headline text-sm font-bold text-ink-primary">{{ r.commentsCount.toLocaleString('en-IN') }}</p>
                          <p class="text-[10px] uppercase font-semibold text-ink-secondary">Comments</p>
                        </div>
                      </div>

                      <div class="flex items-center gap-2 flex-wrap">
                        <button type="button" (click)="openReel.emit(r)" class="px-3 py-1 rounded-full bg-surface-container-lowest border border-surface-container-high hover:border-primary/40 text-[10px] font-bold text-ink-primary uppercase tracking-wide cursor-pointer">
                          Live Insights
                        </button>
                        <a [href]="r.reelUrl" target="_blank" rel="noopener" class="px-2.5 py-1 rounded-lg bg-surface-container-lowest border border-surface-container-high text-xs font-semibold text-ink-primary hover:text-primary">
                          View ↗
                        </a>
                        <button type="button" (click)="startEditDeliverable(r)" class="px-2.5 py-1 rounded-lg bg-surface-container-lowest border border-surface-container-high text-xs font-semibold text-ink-primary hover:text-primary cursor-pointer">
                          Edit
                        </button>
                        <button type="button" (click)="syncReel.emit(r.id)" class="px-2.5 py-1 rounded-lg bg-surface-container-lowest border border-surface-container-high text-xs font-semibold text-primary hover:bg-blue-container/40 cursor-pointer">
                          Sync
                        </button>
                        <button type="button" (click)="requestDeleteReel.emit(r)" class="px-2.5 py-1 rounded-lg bg-surface-container-lowest border border-surface-container-high text-xs font-semibold text-secondary hover:bg-coral-container/40 cursor-pointer">
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>

                  @if (editingDeliverableId() === r.id) {
                    <form (ngSubmit)="saveDeliverableEdit(r.id)" class="mt-3 pt-3 border-t border-surface-variant/40 grid grid-cols-1 gap-2.5 items-center animate-pop-in" [ngClass]="roi.costMode === 'PER_DELIVERABLE' ? 'sm:grid-cols-5' : 'sm:grid-cols-4'">
                      <input [(ngModel)]="editDelTitle" name="editDelTitle" placeholder="Deliverable title" required class="sm:col-span-2 h-9 px-3 rounded-xl bg-white text-xs focus:outline-none focus:ring-2 focus:ring-primary"/>
                      @if (roi.costMode === 'PER_DELIVERABLE') {
                        <input [(ngModel)]="editDelCost" name="editDelCost" type="number" min="0" step="100" placeholder="Deliverable Cost ₹" class="h-9 px-3 rounded-xl bg-white text-xs focus:outline-none focus:ring-2 focus:ring-primary"/>
                      }
                      <button type="submit" class="h-9 px-4 rounded-xl bg-primary text-white text-xs font-semibold cursor-pointer">Save</button>
                      <button type="button" (click)="editingDeliverableId.set(null)" class="h-9 px-3 rounded-xl bg-surface-warm text-xs font-semibold text-ink-secondary cursor-pointer">Cancel</button>
                    </form>
                  }
                </div>
              }
            </div>
          }
        </div>
      </section>
    }
  `
})
export class CreatorInsightsViewComponent implements OnChanges {
  @Input() creator: Creator | null = null;
  @Input() bundle: CreatorInsightsBundle | null = null;
  @Input() reels: ReelDeliverable[] = [];
  @Input() drawerMedia: any[] = [];
  @Input() igStatus: InstagramStatus | null = null;
  @Input() loadingMedia = false;
  @Input() syncing = false;
  @Input() savingProfile = false;

  @Output() close = new EventEmitter<void>();
  @Output() syncCreator = new EventEmitter<void>();
  @Output() saveProfile = new EventEmitter<Record<string, any>>();
  @Output() browseMedia = new EventEmitter<Creator>();
  @Output() addReel = new EventEmitter<{ title: string; reelUrl: string; costQuoted?: string }>();
  @Output() editDeliverable = new EventEmitter<{ id: string; title: string; costQuoted?: number | null }>();
  @Output() syncReel = new EventEmitter<string>();
  @Output() openReel = new EventEmitter<ReelDeliverable>();
  @Output() openLiveMedia = new EventEmitter<any>();
  @Output() copyUrl = new EventEmitter<string>();
  @Output() requestDeleteReel = new EventEmitter<ReelDeliverable>();

  editMode = signal(false);
  pricingMenuOpen = signal(false);
  showReelPicker = signal(false);
  editingDeliverableId = signal<string | null>(null);
  duplicateReelNotice = signal('');
  pendingTrackKeys = signal<Set<string>>(new Set());
  chartTab = signal<'views' | 'interactions' | 'mix' | null>(null);
  hoveredSliceId = signal<string | null>(null);
  pinnedSliceId = signal<string | null>(null);

  newReelTitle = '';
  newReelUrl = '';
  newReelCost = '';
  editDelTitle = '';
  editDelCost = '';

  form = {
    costMode: 'COLLECTIVE' as 'COLLECTIVE' | 'PER_DELIVERABLE',
    costQuoted: '',
    managementHandle: '',
    country: '',
    creatorTraits: ''
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['reels']) {
      this.pendingTrackKeys.set(new Set());
      this.duplicateReelNotice.set('');
    }
    if (changes['creator'] && this.creator) {
      this.form = {
        costMode: this.creator.costMode === 'PER_DELIVERABLE' ? 'PER_DELIVERABLE' : 'COLLECTIVE',
        costQuoted: this.creator.costQuoted ? String(this.creator.costQuoted) : '',
        managementHandle: this.creator.managementHandle || '',
        country: this.creator.country || '',
        creatorTraits: this.creator.creatorTraits || ''
      };
      if (changes['creator'].previousValue?.id !== this.creator.id) {
        this.editMode.set(false);
        this.pricingMenuOpen.set(false);
        this.showReelPicker.set(false);
        this.editingDeliverableId.set(null);
        this.duplicateReelNotice.set('');
        this.pendingTrackKeys.set(new Set());
        this.chartTab.set(null);
        this.hoveredSliceId.set(null);
        this.pinnedSliceId.set(null);
      }
    }
  }

  computedKpis() {
    if (this.bundle?.kpiSummary) return this.bundle.kpiSummary;
    const totalViews = this.reels.reduce((s, r) => s + (r.viewsCount || 0), 0);
    const totalLikes = this.reels.reduce((s, r) => s + (r.likesCount || 0), 0);
    const totalComments = this.reels.reduce((s, r) => s + (r.commentsCount || 0), 0);
    const postsWithViews = this.reels.filter(r => (r.viewsCount || 0) > 0).length;
    const staticPhotoCount = this.reels.filter(r => !(r.viewsCount > 0) && this.isStaticPhotoPost(r)).length;

    return {
      totalViews,
      totalLikes,
      totalComments,
      totalInteractions: totalLikes + totalComments,
      submittedDeliverables: this.reels.length,
      metricsScope: 'DELIVERABLES' as const,
      postsAnalyzedCount: this.reels.length,
      postsWithViewsCount: postsWithViews,
      staticPhotoCount
    };
  }

  computedRoi() {
    if (this.bundle?.roiBenchmarks) return this.bundle.roiBenchmarks;
    const kpis = this.computedKpis();
    const followers = this.creator?.followersCount || 0;
    const mode: 'COLLECTIVE' | 'PER_DELIVERABLE' =
      this.creator?.costMode === 'PER_DELIVERABLE' ? 'PER_DELIVERABLE' : 'COLLECTIVE';
    const baseRate = this.creator?.costQuoted && this.creator.costQuoted > 0 ? this.creator.costQuoted : null;
    let pricedCount = 0;
    let delCostSum = 0;
    for (const r of this.reels) {
      const dc = (r.costQuoted && r.costQuoted > 0) ? r.costQuoted : (mode === 'PER_DELIVERABLE' ? baseRate : null);
      if (dc && dc > 0) {
        delCostSum += dc;
        pricedCount++;
      }
    }
    const cost = mode === 'PER_DELIVERABLE'
      ? (delCostSum > 0 ? delCostSum : null)
      : baseRate;
    const interactions = kpis.totalLikes + kpis.totalComments;

    const irPct = followers > 0 && interactions > 0
      ? Math.round((interactions * 100.0 / followers) * 100) / 100
      : 0;
    const avgViews = kpis.postsWithViewsCount > 0 && kpis.totalViews > 0
      ? Math.round(kpis.totalViews / kpis.postsWithViewsCount)
      : 0;

    return {
      tier: this.computeTier(followers),
      followersCount: followers,
      followersDisplay: followers > 0 ? (this.creator?.followersDisplay || this.formatCompact(followers)) : '—',
      interactionRatePct: irPct,
      avgViewsPerPost: avgViews,
      avgViewsPostCount: kpis.postsWithViewsCount,
      costMode: mode,
      baseRate,
      pricedDeliverablesCount: pricedCount,
      costQuoted: cost,
      currency: this.creator?.currency || 'INR',
      costPer1kFollowers: cost && followers > 0 ? Math.round((cost / (followers / 1000)) * 100) / 100 : null,
      costPerInteraction: cost && interactions > 0 ? Math.round((cost / interactions) * 100) / 100 : null,
      costPerView: cost && kpis.totalViews > 0 ? Math.round((cost / kpis.totalViews) * 100) / 100 : null
    };
  }

  traitsList(): string[] {
    if (this.bundle?.traits?.length) return this.bundle.traits;
    const raw = this.creator?.creatorTraits || '';
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }

  selectChartTab(mode: 'views' | 'interactions' | 'mix') {
    this.chartTab.set(mode);
    this.hoveredSliceId.set(null);
    this.pinnedSliceId.set(null);
  }

  effectiveChartMode(): 'views' | 'interactions' | 'mix' {
    const chosen = this.chartTab();
    if (chosen) return chosen;
    const kpis = this.computedKpis();
    if (kpis.totalViews > 0) return 'views';
    if (kpis.totalInteractions > 0) return 'interactions';
    return 'views';
  }

  togglePinSlice(id: string) {
    this.pinnedSliceId.set(this.pinnedSliceId() === id ? null : id);
  }

  activeSliceId(): string | null {
    return this.hoveredSliceId() || this.pinnedSliceId();
  }

  findActiveSlice(slices: {
    id: string;
    label: string;
    value: number;
    pct: number;
    pctLabel: string;
    color: string;
    dashArray: string;
    dashOffset: number;
    subtitle: string;
    reel?: ReelDeliverable;
  }[]) {
    const id = this.activeSliceId();
    return id ? (slices.find(s => s.id === id) || null) : null;
  }

  chartBreakdown() {
    const mode = this.effectiveChartMode();
    const kpis = this.computedKpis();
    const palette = ['#1a56db', '#0d9488', '#d97706', '#7c3aed', '#e11d48', '#64748b'];
    const C = 2 * Math.PI * 64;

    type RawItem = { id: string; label: string; value: number; subtitle: string; reel?: ReelDeliverable };
    let items: RawItem[] = [];
    let unitLabel = 'Total Views';
    let emptyReason = 'Add or sync a Video Reel below to explore per-Reel views breakdown.';

    if (mode === 'views') {
      const sorted = [...this.reels]
        .filter(r => (r.viewsCount || 0) > 0)
        .sort((a, b) => (b.viewsCount || 0) - (a.viewsCount || 0));
      const top = sorted.slice(0, 5);
      const rest = sorted.slice(5);
      items = top.map(r => ({
        id: 'reel-' + r.id,
        label: r.title || 'Campaign Reel',
        value: r.viewsCount || 0,
        subtitle: `${(r.likesCount || 0).toLocaleString('en-IN')} likes • ${(r.commentsCount || 0).toLocaleString('en-IN')} cmts`,
        reel: r
      }));
      if (rest.length > 0) {
        items.push({
          id: 'other-views',
          label: `Other ${rest.length} Reel(s)`,
          value: rest.reduce((s, r) => s + (r.viewsCount || 0), 0),
          subtitle: 'Combined remaining Reels'
        });
      }
      unitLabel = 'Tracked Views';
      emptyReason = this.reels.length > 0
        ? 'No video views recorded on tracked items yet. Try switching to Interactions or sync a Video Reel.'
        : 'Add or pick a Video Reel below to visualize views distribution.';
    } else if (mode === 'interactions') {
      const sorted = [...this.reels]
        .map(r => ({ reel: r, total: (r.likesCount || 0) + (r.commentsCount || 0) }))
        .filter(x => x.total > 0)
        .sort((a, b) => b.total - a.total);
      const top = sorted.slice(0, 5);
      const rest = sorted.slice(5);
      items = top.map(x => ({
        id: 'int-' + x.reel.id,
        label: x.reel.title || 'Campaign Reel',
        value: x.total,
        subtitle: `${(x.reel.likesCount || 0).toLocaleString('en-IN')} likes • ${(x.reel.commentsCount || 0).toLocaleString('en-IN')} cmts`,
        reel: x.reel
      }));
      if (rest.length > 0) {
        items.push({
          id: 'other-int',
          label: `Other ${rest.length} Item(s)`,
          value: rest.reduce((s, x) => s + x.total, 0),
          subtitle: 'Combined remaining deliverables'
        });
      }
      unitLabel = 'Interactions';
      emptyReason = 'No likes or comments recorded on tracked items yet.';
    } else {
      if (kpis.totalLikes > 0) {
        items.push({
          id: 'mix-likes',
          label: 'Likes',
          value: kpis.totalLikes,
          subtitle: `Across ${kpis.submittedDeliverables} tracked item(s)`
        });
      }
      if (kpis.totalComments > 0) {
        items.push({
          id: 'mix-comments',
          label: 'Comments',
          value: kpis.totalComments,
          subtitle: `Across ${kpis.submittedDeliverables} tracked item(s)`
        });
      }
      unitLabel = 'Engagement Mix';
      emptyReason = 'Track Reels below to compare Likes vs Comments share.';
    }

    const total = items.reduce((s, i) => s + i.value, 0);
    let cumulative = 0;
    const gap = items.length > 1 ? 2.5 : 0;

    const slices = items.map((item, idx) => {
      const fraction = total > 0 ? item.value / total : 0;
      const pct = Math.round(fraction * 1000) / 10;
      const arcLen = fraction * C;
      const dash = items.length === 1 ? C : Math.max(1.5, arcLen - gap);
      const offset = -cumulative;
      cumulative += arcLen;
      const color = mode === 'mix'
        ? (item.id === 'mix-likes' ? '#1a56db' : '#d97706')
        : palette[idx % palette.length];
      return {
        id: item.id,
        label: item.label,
        value: item.value,
        pct,
        pctLabel: (pct >= 10 || pct === 0 ? pct.toFixed(0) : pct.toFixed(1)) + '%',
        color,
        dashArray: `${dash} ${Math.max(0, C - dash)}`,
        dashOffset: offset,
        subtitle: item.subtitle,
        reel: item.reel
      };
    });

    return {
      mode,
      total,
      totalLabel: total > 0 ? this.formatCount(total) : '0',
      unitLabel,
      slices,
      emptyReason
    };
  }

  selectFormCostMode(mode: 'COLLECTIVE' | 'PER_DELIVERABLE') {
    this.form.costMode = mode;
    this.pricingMenuOpen.set(false);
  }

  submitEdit() {
    const costNum = String(this.form.costQuoted || '').trim();
    const payload: Record<string, any> = {
      costMode: this.form.costMode,
      costQuoted: costNum ? Number(costNum) : null,
      managementHandle: this.form.managementHandle,
      country: this.form.country,
      creatorTraits: this.form.creatorTraits
    };
    this.saveProfile.emit(payload);
    this.pricingMenuOpen.set(false);
    this.editMode.set(false);
  }

  startEditDeliverable(r: ReelDeliverable) {
    if (this.editingDeliverableId() === r.id) {
      this.editingDeliverableId.set(null);
      return;
    }
    this.editingDeliverableId.set(r.id);
    this.editDelTitle = r.title;
    this.editDelCost = r.costQuoted ? String(r.costQuoted) : '';
  }

  saveDeliverableEdit(deliverableId: string) {
    const rawCost = String(this.editDelCost || '').trim();
    const out: { id: string; title: string; costQuoted?: number | null } = {
      id: deliverableId,
      title: this.editDelTitle.trim()
    };
    if (this.computedRoi().costMode === 'PER_DELIVERABLE') {
      out.costQuoted = rawCost ? Number(rawCost) : null;
    }
    this.editDeliverable.emit(out);
    this.editingDeliverableId.set(null);
  }

  selectMediaForTrack(m: any) {
    if (!m?.permalink || this.isMediaAlreadyTracked(m)) return;
    const keys = new Set(this.pendingTrackKeys());
    if (m.id) keys.add(String(m.id));
    if (m.shortcode) keys.add(String(m.shortcode).toLowerCase());
    const norm = this.normalizeReelUrl(m.permalink);
    if (norm) keys.add(norm);
    this.pendingTrackKeys.set(keys);

    const title = m.caption ? String(m.caption).slice(0, 60) : (m.mediaProductType || 'Campaign Reel');
    this.addReel.emit({ title, reelUrl: m.permalink });
  }

  submitReelForm() {
    const cleanUrl = this.newReelUrl.trim();
    if (!cleanUrl) return;
    if (this.isUrlAlreadyTracked(cleanUrl)) {
      this.duplicateReelNotice.set('This Reel is already added to this creator’s tracked deliverables.');
      return;
    }
    this.duplicateReelNotice.set('');
    this.addReel.emit({
      title: this.newReelTitle || 'Verified Campaign Reel',
      reelUrl: cleanUrl,
      costQuoted: this.newReelCost ? String(this.newReelCost) : undefined
    });
    this.newReelTitle = '';
    this.newReelUrl = '';
    this.newReelCost = '';
  }

  isMediaAlreadyTracked(m: any): boolean {
    if (!m) return false;
    const mId = m.id ? String(m.id) : '';
    const mSc = (m.shortcode ? String(m.shortcode) : this.extractShortcode(m.permalink)).toLowerCase();
    const mNorm = this.normalizeReelUrl(m.permalink);
    const pending = this.pendingTrackKeys();
    if ((mId && pending.has(mId)) || (mSc && pending.has(mSc)) || (mNorm && pending.has(mNorm))) {
      return true;
    }
    return this.reels.some(r => {
      if (mId && r.igMediaId && String(r.igMediaId) === mId) return true;
      const rSc = (r.shortcode || this.extractShortcode(r.reelUrl)).toLowerCase();
      if (mSc && rSc && rSc === mSc) return true;
      const rNorm = this.normalizeReelUrl(r.reelUrl);
      return !!mNorm && !!rNorm && rNorm === mNorm;
    });
  }

  isUrlAlreadyTracked(url: string): boolean {
    const sc = this.extractShortcode(url).toLowerCase();
    const norm = this.normalizeReelUrl(url);
    return this.reels.some(r => {
      const rSc = (r.shortcode || this.extractShortcode(r.reelUrl)).toLowerCase();
      if (sc && rSc && rSc === sc) return true;
      return !!norm && this.normalizeReelUrl(r.reelUrl) === norm;
    });
  }

  extractShortcode(url?: string | null): string {
    if (!url) return '';
    const m = String(url).match(/\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i);
    return m ? m[1] : '';
  }

  normalizeReelUrl(url?: string | null): string {
    if (!url) return '';
    return String(url).trim().split('#')[0].split('?')[0].replace(/\/+$/, '').toLowerCase();
  }

  toggleReelPicker(ic: Creator) {
    this.showReelPicker.set(!this.showReelPicker());
    if (this.showReelPicker() && this.drawerMedia.length === 0) {
      this.browseMedia.emit(ic);
    }
  }

  videoReelsFromFeed(): any[] {
    return (this.drawerMedia || []).filter(m =>
      m?.mediaProductType === 'REELS' || m?.mediaType === 'VIDEO' || (m?.viewsCount || 0) > 0
    );
  }

  isStaticPhotoPost(r: ReelDeliverable): boolean {
    const t = (r?.mediaType || '').toUpperCase();
    return t === 'IMAGE' || t === 'CAROUSEL_ALBUM' || t === 'FEED';
  }

  formatMediaLabel(r: ReelDeliverable): string {
    const t = (r?.mediaType || '').toUpperCase();
    if (t === 'REELS' || !t) return 'Instagram Reel';
    if (t === 'VIDEO') return 'Instagram Video';
    if (t === 'CAROUSEL_ALBUM') return 'Carousel Photo Post';
    if (t === 'IMAGE') return 'Photo Post';
    return 'Instagram ' + r.mediaType;
  }

  computeTier(followers: number): string {
    if (followers >= 1_000_000) return 'Mega';
    if (followers >= 500_000) return 'Macro';
    if (followers >= 100_000) return 'Mid-Tier';
    if (followers >= 10_000) return 'Micro';
    if (followers > 0) return 'Nano';
    return '—';
  }

  formatDemographics(ic: Creator): string {
    return ic.country || '';
  }

  formatCount(n: number): string {
    if (!n || n <= 0) return '0';
    if (n >= 10_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    return n.toLocaleString('en-IN');
  }

  formatCompact(n: number): string {
    if (!n || n <= 0) return '—';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
  }

  formatInr(n: number, decimals = 0): string {
    if (n === null || n === undefined || n <= 0) return '—';
    return '₹' + n.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }
}
