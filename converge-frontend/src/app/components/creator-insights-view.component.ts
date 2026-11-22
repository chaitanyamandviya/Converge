import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Creator, CreatorInsightsBundle, InstagramStatus, ReelDeliverable } from '../services/api.service';
import { formatReelDisplayTitle } from '../utils/reel-format';
import { safeExternalUrl } from '../utils/url-safety';

@Component({
  selector: 'app-creator-insights-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (creator; as ic) {
      <section class="space-y-5 animate-fade-in-up">
        <!-- Editorial Brutalist Top Header & Navigation -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-cv-border-soft">
          <div class="flex items-start sm:items-center gap-3.5 min-w-0">
            <button
              type="button"
              (click)="close.emit()"
              class="h-9 px-3.5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border text-cv-ink text-xs font-medium flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors">
              <span>← Back to Roster</span>
            </button>

            <div class="flex items-center gap-3 min-w-0">
              @if (ic.avatarUrl) {
                <img [src]="ic.avatarUrl" [alt]="ic.name" (error)="ic.avatarUrl = null" class="w-12 h-12 rounded-[4px] object-cover border border-cv-border shrink-0"/>
              } @else {
                <div class="w-12 h-12 rounded-[4px] bg-[#f54e26] text-[#111111] font-headline font-bold text-lg flex items-center justify-center shrink-0">
                  {{ ic.name.substring(0, 2).toUpperCase() }}
                </div>
              }
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h1 class="font-headline uppercase text-2xl sm:text-3xl font-bold text-cv-ink tracking-[0.02em] leading-none truncate">{{ ic.name }}</h1>
                  @if (ic.verified) {
                    <span title="Verified Creator" class="inline-flex items-center justify-center w-4 h-4 rounded-[3px] bg-[#f54e26] text-[#111111] text-[10px] font-bold">✓</span>
                  }
                  @if (ic.postedLast28Days) {
                    <span class="px-2 py-0.5 rounded-[3px] bg-[#007656] text-[#fff6e8] text-[10px] font-bold uppercase tracking-wide">Active in 28d</span>
                  }
                </div>
                <div class="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-cv-ink-muted mt-1 tabular-nums">
                  @if (safeExternalUrl(ic.profileUrl || 'https://www.instagram.com/' + ic.handle.replace('@', '') + '/', true); as safeCreatorProfile) {
                    <a [href]="safeCreatorProfile" target="_blank" rel="noopener noreferrer" class="text-[#f54e26] font-medium hover:underline">{{ ic.handle }} ↗</a>
                  } @else {
                    <span class="text-[#f54e26] font-medium">{{ ic.handle }}</span>
                  }
                  @if (ic.followersCount > 0) {
                    <span>• <strong class="text-cv-ink">{{ ic.followersDisplay || formatCompact(ic.followersCount) }}</strong> followers</span>
                  }
                  @if ((ic.followsCount || 0) > 0) {
                    <span>• {{ formatCount(ic.followsCount || 0) }} following</span>
                  }
                  @if ((ic.mediaCount || 0) > 0) {
                    <span>• {{ formatCount(ic.mediaCount || 0) }} posts</span>
                  }
                  @if (displayCategory(ic); as catLabel) {
                    <span>• {{ catLabel }}</span>
                  }
                  @if (ic.managementHandle) {
                    <span>• {{ ic.managementHandle }}</span>
                  }
                  @if (ic.country) {
                    <span>• {{ ic.country }}</span>
                  }
                </div>
                @if (traitsList().length > 0) {
                  <div class="flex flex-wrap gap-1.5 mt-2">
                    @for (trait of traitsList(); track trait) {
                      <span class="px-2 py-0.5 rounded-[3px] bg-cv-card border border-cv-border text-cv-ink text-[10px] font-medium">{{ trait }}</span>
                    }
                  </div>
                }
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 shrink-0">
            <button type="button" (click)="editMode.set(!editMode()); pricingMenuOpen.set(false)"
                    class="h-9 px-3.5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border text-cv-ink text-xs font-medium cursor-pointer transition-colors">
              {{ editMode() ? 'Done Editing' : 'Edit Cost & Tags' }}
            </button>
            <button type="button" (click)="syncCreator.emit()" [disabled]="syncing"
                    class="h-9 px-4 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase tracking-[0.03em] text-base font-bold cursor-pointer transition-colors disabled:opacity-60">
              {{ syncing ? 'SYNCING IG...' : 'SYNC INSTAGRAM ↻' }}
            </button>
          </div>
        </div>

        <!-- Inline Edit Commercial Rate & CRM Tags (IG metrics & Category strictly read-only) -->
        @if (editMode()) {
          @if (pricingMenuOpen()) {
            <div class="fixed inset-0 z-20" (click)="pricingMenuOpen.set(false)"></div>
          }
          <form (ngSubmit)="submitEdit()" class="relative z-30 bg-cv-card rounded-[6px] p-5 border border-cv-border-strong shadow-[4px_4px_0px_#f54e26] space-y-4 animate-pop-in">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-cv-border-soft pb-3">
              <div>
                <h2 class="font-headline uppercase text-lg font-bold text-cv-ink tracking-[0.02em]">EDIT COST QUOTED &amp; CREATOR TAGS</h2>
                <p class="text-xs text-cv-ink-muted">Agreed rate drives CPM, CPE &amp; CPV ROI benchmarks. Category &amp; Instagram metrics remain read-only.</p>
              </div>
              <div class="flex flex-wrap items-center gap-1.5 shrink-0">
                @if (displayCategory(ic); as catLabel) {
                  <span class="px-2.5 py-0.5 rounded-[3px] bg-cv-well border border-cv-border text-cv-ink-muted text-[10px] font-semibold">Category (Locked): {{ catLabel }}</span>
                }
                <span class="px-2.5 py-0.5 rounded-[3px] bg-[#5738af] text-[#fff6e8] text-[10px] font-bold uppercase tracking-wide">IG Metrics Read-Only</span>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div class="relative">
                <label class="block font-medium text-cv-ink mb-1">Pricing model</label>
                <button
                  type="button"
                  (click)="pricingMenuOpen.set(!pricingMenuOpen())"
                  class="w-full h-10 px-3 rounded-[4px] bg-cv-well hover:bg-cv-control border border-cv-border font-medium text-cv-ink flex items-center justify-between gap-2 cursor-pointer transition-colors focus:outline-none focus:border-[#f54e26]">
                  <span>{{ form.costMode === 'PER_DELIVERABLE' ? 'Cost Per Deliverable' : 'Fixed Cost' }}</span>
                  <svg class="w-4 h-4 text-cv-ink-muted transition-transform duration-150 shrink-0" [class.rotate-180]="pricingMenuOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                </button>
                @if (pricingMenuOpen()) {
                  <div class="absolute left-0 right-0 mt-1.5 rounded-[4px] bg-cv-card border border-cv-border-strong shadow-[4px_4px_0px_#f54e26] py-1 z-40">
                    <button
                      type="button"
                      (click)="selectFormCostMode('COLLECTIVE')"
                      class="w-full text-left px-3 py-2 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                      [ngClass]="form.costMode === 'COLLECTIVE' ? 'bg-cv-ink text-cv-ink-inverse font-semibold' : 'hover:bg-cv-hover-pill text-cv-ink'">
                      <div>
                        <p class="font-semibold text-xs">Fixed Cost</p>
                        <p class="text-[10px]" [ngClass]="form.costMode === 'COLLECTIVE' ? 'text-cv-ink-inverse/80' : 'text-cv-ink-muted'">Single fixed fee for the creator</p>
                      </div>
                      @if (form.costMode === 'COLLECTIVE') {
                        <span class="font-bold text-xs">✓</span>
                      }
                    </button>
                    <button
                      type="button"
                      (click)="selectFormCostMode('PER_DELIVERABLE')"
                      class="w-full text-left px-3 py-2 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                      [ngClass]="form.costMode === 'PER_DELIVERABLE' ? 'bg-cv-ink text-cv-ink-inverse font-semibold' : 'hover:bg-cv-hover-pill text-cv-ink'">
                      <div>
                        <p class="font-semibold text-xs">Cost Per Deliverable</p>
                        <p class="text-[10px]" [ngClass]="form.costMode === 'PER_DELIVERABLE' ? 'text-cv-ink-inverse/80' : 'text-cv-ink-muted'">Rate applied per tracked Reel</p>
                      </div>
                      @if (form.costMode === 'PER_DELIVERABLE') {
                        <span class="font-bold text-xs">✓</span>
                      }
                    </button>
                  </div>
                }
              </div>

              <div>
                <label class="block font-medium text-cv-ink mb-1">{{ form.costMode === 'PER_DELIVERABLE' ? 'Rate Per Deliverable (₹ INR)' : 'Fixed Cost (₹ INR)' }}</label>
                <input [(ngModel)]="form.costQuoted" name="cCost" type="number" min="0" step="100" placeholder="e.g. 100000" class="w-full h-10 px-3 rounded-[4px] bg-cv-well border border-cv-border text-cv-ink placeholder:text-cv-ink-subtle focus:border-[#f54e26] focus:outline-none tabular-nums"/>
              </div>
              <div>
                <label class="block font-medium text-cv-ink mb-1">Management handle</label>
                <input [(ngModel)]="form.managementHandle" name="cMgmt" placeholder="@talentagency" class="w-full h-10 px-3 rounded-[4px] bg-cv-well border border-cv-border text-cv-ink placeholder:text-cv-ink-subtle focus:border-[#f54e26] focus:outline-none"/>
              </div>
              <div>
                <label class="block font-medium text-cv-ink mb-1">Country</label>
                <input [(ngModel)]="form.country" name="cCountry" placeholder="India" class="w-full h-10 px-3 rounded-[4px] bg-cv-well border border-cv-border text-cv-ink placeholder:text-cv-ink-subtle focus:border-[#f54e26] focus:outline-none"/>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end text-xs">
              <div class="sm:col-span-1 lg:col-span-3">
                <label class="block font-medium text-cv-ink mb-1">Tags</label>
                <input [(ngModel)]="form.creatorTraits" name="cTraits" placeholder="Skincare, Lifestyle" class="w-full h-10 px-3 rounded-[4px] bg-cv-well border border-cv-border text-cv-ink placeholder:text-cv-ink-subtle focus:border-[#f54e26] focus:outline-none"/>
              </div>
              <div class="flex justify-end gap-2">
                <button type="button" (click)="editMode.set(false); pricingMenuOpen.set(false)" class="h-10 px-4 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border text-xs font-medium text-cv-ink-muted hover:text-cv-ink cursor-pointer transition-colors">Cancel</button>
                <button type="submit" [disabled]="savingProfile" class="h-10 px-5 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase tracking-[0.03em] text-base font-bold cursor-pointer disabled:opacity-60 transition-colors">
                  {{ savingProfile ? 'SAVING...' : 'SAVE COST & TAGS' }}
                </button>
              </div>
            </div>
          </form>
        }

        <!-- Interactive Performance Breakdown Pie Chart -->
        @let chart = chartBreakdown();
        @let active = findActiveSlice(chart.slices);
        <div class="bg-cv-card rounded-[4px] p-5 border border-cv-border space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-cv-border-faint">
              <div>
                <h2 class="font-headline uppercase text-lg font-bold text-cv-ink tracking-[0.02em]">TRACKED PERFORMANCE BREAKDOWN</h2>
                <p class="text-xs text-cv-ink-muted">Hover or click slices to inspect tracked Reel share &amp; engagement mix</p>
              </div>
              <div class="inline-flex items-center p-1 rounded-[4px] bg-cv-well border border-cv-border self-start sm:self-center shrink-0">
                <button type="button" (click)="selectChartTab('views')"
                        class="px-3 py-1 rounded-[3px] text-xs font-medium cursor-pointer transition-colors"
                        [ngClass]="chart.mode === 'views' ? 'bg-[#f54e26] text-[#111111] font-bold' : 'text-cv-ink-muted hover:text-cv-ink'">
                  Views
                </button>
                <button type="button" (click)="selectChartTab('interactions')"
                        class="px-3 py-1 rounded-[3px] text-xs font-medium cursor-pointer transition-colors"
                        [ngClass]="chart.mode === 'interactions' ? 'bg-[#f54e26] text-[#111111] font-bold' : 'text-cv-ink-muted hover:text-cv-ink'">
                  By Reel
                </button>
                <button type="button" (click)="selectChartTab('mix')"
                        class="px-3 py-1 rounded-[3px] text-xs font-medium cursor-pointer transition-colors"
                        [ngClass]="chart.mode === 'mix' ? 'bg-[#f54e26] text-[#111111] font-bold' : 'text-cv-ink-muted hover:text-cv-ink'">
                  Likes vs Cmts
                </button>
              </div>
            </div>

            @if (chart.slices.length === 0) {
              <div class="flex flex-col sm:flex-row items-center gap-5 py-2">
                <div class="relative w-44 h-44 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 180 180" class="w-44 h-44">
                    <circle cx="90" cy="90" r="72" fill="none" stroke="var(--cv-ring-track)" stroke-width="20" stroke-dasharray="10 8"/>
                  </svg>
                  <div class="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-8">
                    <span class="font-headline text-lg font-bold text-cv-ink-muted">—</span>
                    <span class="text-[9px] uppercase tracking-[0.03em] leading-[1.15] text-cv-ink-muted mt-1 max-w-[84px] break-words">{{ chart.unitLabel }}</span>
                  </div>
                </div>
                <div class="space-y-2.5 text-center sm:text-left">
                  <p class="text-xs text-cv-ink-muted leading-relaxed">{{ chart.emptyReason }}</p>
                  @if (igStatus?.configured && !showReelPicker()) {
                    <button type="button" (click)="toggleReelPicker(ic)" class="h-8 px-3.5 rounded-[4px] bg-cv-control hover:bg-[#f54e26] border border-cv-border hover:border-[#f54e26] text-cv-ink hover:text-[#111111] text-xs font-semibold cursor-pointer transition-colors">
                      + Pick from IG ({{ drawerMedia.length || ic.mediaCount || 0 }})
                    </button>
                  }
                </div>
              </div>
            } @else {
              <div class="flex flex-col sm:flex-row items-center gap-5">
                <div class="relative w-44 h-44 shrink-0">
                  <svg viewBox="0 0 180 180" class="w-44 h-44 select-none">
                    <circle cx="90" cy="90" r="72" fill="none" stroke="var(--cv-ring-track)" stroke-width="22"/>
                    <g transform="rotate(-90 90 90)">
                      @for (s of chart.slices; track s.id) {
                        <circle
                          cx="90"
                          cy="90"
                          r="72"
                          fill="none"
                          [attr.stroke]="s.color"
                          [attr.stroke-width]="activeSliceId() === s.id ? 26 : 22"
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
                  <div class="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-8 tabular-nums">
                    @if (active) {
                      <span class="font-headline text-2xl font-bold leading-none text-cv-ink">{{ active.pctLabel }}</span>
                      <span class="font-bold text-xs text-cv-ink mt-1">{{ formatCount(active.value) }}</span>
                      <span class="text-[9px] font-semibold uppercase tracking-[0.03em] text-cv-ink-muted truncate max-w-[84px] mt-0.5">
                        {{ chart.mode === 'mix' ? active.label : (chart.mode === 'views' ? 'Views' : 'Likes + Cmts') }}
                      </span>
                    } @else {
                      <span class="font-headline text-2xl font-bold text-cv-ink leading-none">{{ chart.totalLabel }}</span>
                      <span class="text-[9px] font-semibold uppercase tracking-[0.03em] leading-[1.15] text-cv-ink-muted mt-1 max-w-[84px] break-words">{{ chart.unitLabel }}</span>
                      <span class="text-[9px] text-cv-ink-subtle mt-0.5">{{ chart.slices.length }} slice(s)</span>
                    }
                  </div>
                </div>

                <div class="flex-1 w-full min-w-0 space-y-2">
                  @for (s of chart.slices; track s.id) {
                    <div
                      (mouseenter)="hoveredSliceId.set(s.id)"
                      (mouseleave)="hoveredSliceId.set(null)"
                      (click)="togglePinSlice(s.id)"
                      class="w-full text-left px-3 py-2 rounded-[4px] border transition-colors cursor-pointer"
                      [ngClass]="activeSliceId() === s.id ? 'bg-cv-well border-[#f54e26]' : 'bg-cv-well border-cv-border-soft hover:border-cv-border-bright'">
                      <div class="flex items-center justify-between gap-2 text-xs">
                        <div class="flex items-center gap-2 min-w-0">
                          <span class="w-2.5 h-2.5 rounded-[2px] shrink-0" [style.background]="s.color"></span>
                          <span class="font-semibold text-cv-ink truncate">{{ s.label }}</span>
                        </div>
                        <div class="flex items-center gap-2 shrink-0 tabular-nums">
                          <span class="font-bold text-cv-ink">{{ formatCount(s.value) }} · {{ s.pctLabel }}</span>
                          @if (s.reel; as rowReel) {
                            <button type="button" (click)="$event.stopPropagation(); openReel.emit(rowReel)" class="text-[11px] font-semibold text-[#f54e26] hover:underline cursor-pointer">
                              Insights ↗
                            </button>
                          }
                        </div>
                      </div>
                      <div class="mt-1.5 h-1.5 w-full rounded-[2px] bg-cv-control overflow-hidden">
                        <div class="h-full transition-all duration-300" [style.width.%]="s.pct" [style.background]="s.color"></div>
                      </div>
                    </div>
                  }

                  <div class="min-h-[26px] flex items-center justify-between gap-2 px-1 pt-0.5 text-[11px] text-cv-ink-muted">
                    <span class="truncate">{{ active ? active.subtitle : 'Hover or click a slice or row to pin details' }}</span>
                    @if (pinnedSliceId()) {
                      <button type="button" (click)="pinnedSliceId.set(null)" class="text-[11px] font-semibold text-cv-ink hover:text-[#f54e26] shrink-0 cursor-pointer">
                        Clear
                      </button>
                    }
                  </div>
                </div>
              </div>
            }
          </div>

        <!-- Top 4 Official KPI Cards (Tracked Reels Only) -->
        @let kpis = computedKpis();
        <div class="space-y-2">
          <div class="flex items-center justify-between px-0.5">
            <p class="text-[11px] font-semibold uppercase tracking-[0.04em] text-cv-ink-muted">
              TRACKED REELS INSIGHTS
              @if (kpis.submittedDeliverables > 0) {
                <span> • AGGREGATED ACROSS {{ kpis.submittedDeliverables }} TRACKED ITEM(S)</span>
              } @else {
                <span> • ADD REELS BELOW TO TRACK INSIGHTS</span>
              }
            </p>
          </div>
          <div class="rounded-[4px] bg-cv-card border border-cv-border grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-cv-divide tabular-nums">
            <div class="px-5 py-4">
              <p class="text-xs text-cv-ink-muted font-medium">Total Views</p>
              <p class="font-headline text-3xl font-bold text-[#f54e26] mt-1 leading-none">{{ formatCount(kpis.totalViews) }}</p>
              <p class="text-[11px] text-cv-ink-subtle mt-1.5">
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

            <div class="px-5 py-4">
              <p class="text-xs text-cv-ink-muted font-medium">Engagements (Likes)</p>
              <p class="font-headline text-3xl font-bold text-cv-ink mt-1 leading-none">{{ kpis.totalLikes >= 0 ? kpis.totalLikes.toLocaleString('en-IN') : '0' }}</p>
              <p class="text-[11px] text-cv-ink-subtle mt-1.5">{{ kpis.totalLikes > 0 ? 'From tracked deliverable(s)' : 'No likes recorded yet' }}</p>
            </div>

            <div class="px-5 py-4">
              <p class="text-xs text-cv-ink-muted font-medium">Comments</p>
              <p class="font-headline text-3xl font-bold text-cv-gold mt-1 leading-none">{{ kpis.totalComments.toLocaleString('en-IN') }}</p>
              <p class="text-[11px] text-cv-ink-subtle mt-1.5">Across tracked deliverable(s)</p>
            </div>

            <div class="px-5 py-4">
              <p class="text-xs text-cv-ink-muted font-medium">Tracked Reels</p>
              <p class="font-headline text-3xl font-bold text-cv-green mt-1 leading-none">{{ kpis.submittedDeliverables }}</p>
              <p class="text-[11px] text-cv-ink-subtle mt-1.5">{{ ic.mediaCount ? formatCount(ic.mediaCount) + ' total IG posts' : 'Tracked campaign slots' }}</p>
            </div>
          </div>
        </div>

        <!-- Influencer ROI & Performance Benchmarks (Tracked Reels + Cost Quoted Only) -->
        @let roi = computedRoi();
        <div class="bg-cv-card rounded-[4px] p-5 border border-cv-border space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cv-border-faint">
            <div>
              <h2 class="font-headline uppercase text-lg font-bold text-cv-ink tracking-[0.02em]">INFLUENCER ROI &amp; PERFORMANCE BENCHMARKS</h2>
              <p class="text-xs text-cv-ink-muted">Calculated exclusively from tracked Reels, Instagram followers, and {{ roi.costMode === 'PER_DELIVERABLE' ? 'per-deliverable pricing' : 'fixed creator rate' }}</p>
            </div>
            <div class="flex flex-wrap items-center gap-2 shrink-0">
              @if (roi.tier && roi.tier !== '—') {
                <span class="px-2.5 py-1 rounded-[3px] bg-cv-well border border-cv-border text-xs font-semibold text-cv-ink">{{ roi.tier }} Creator</span>
              }
              <span class="px-2.5 py-1 rounded-[3px] bg-[#5738af] text-[#fff6e8] text-xs font-semibold">
                {{ roi.costMode === 'PER_DELIVERABLE' ? 'Cost Per Deliverable' : 'Fixed Cost' }}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3.5 tabular-nums">
            <div class="p-4 rounded-[4px] bg-cv-well border border-cv-border-soft">
              <p class="text-[10px] uppercase tracking-[0.04em] font-semibold text-cv-ink-muted">IR % (Interaction Rate)</p>
              <p class="font-headline text-2xl font-bold text-cv-green mt-1 leading-none">{{ roi.interactionRatePct > 0 ? roi.interactionRatePct + '%' : '—' }}</p>
              <p class="text-[11px] text-cv-ink-subtle mt-1">Tracked likes+cmts / followers</p>
            </div>

            <div class="p-4 rounded-[4px] bg-cv-well border border-cv-border-soft">
              <p class="text-[10px] uppercase tracking-[0.04em] font-semibold text-cv-ink-muted">Avg Views / Reel</p>
              <p class="font-headline text-2xl font-bold text-cv-ink mt-1 leading-none">{{ roi.avgViewsPerPost > 0 ? formatCount(roi.avgViewsPerPost) : '—' }}</p>
              <p class="text-[11px] text-cv-ink-subtle mt-1">{{ roi.avgViewsPostCount > 0 ? 'Across ' + roi.avgViewsPostCount + ' tracked Reel(s)' : 'Track a Video Reel for views' }}</p>
            </div>

            <div class="p-4 rounded-[4px] bg-cv-well border border-cv-border-soft">
              <p class="text-[10px] uppercase tracking-[0.04em] font-semibold text-cv-ink-muted">{{ roi.costMode === 'PER_DELIVERABLE' ? 'Total Deliverable Cost' : 'Fixed Cost' }}</p>
              <p class="font-headline text-2xl font-bold text-cv-gold mt-1 leading-none">{{ roi.costQuoted ? formatInr(roi.costQuoted, 0) : (roi.costMode === 'PER_DELIVERABLE' && roi.baseRate ? formatInr(roi.baseRate, 0) + '/reel' : '—') }}</p>
              <p class="text-[11px] text-cv-ink-subtle mt-1">
                @if (roi.costMode === 'PER_DELIVERABLE') {
                  <span>{{ (roi.pricedDeliverablesCount || 0) > 0 ? 'Across ' + roi.pricedDeliverablesCount + ' deliverable(s)' : 'Set cost in Edit Cost & Tags or per Reel' }}</span>
                } @else {
                  <span>{{ roi.costQuoted ? 'Fixed creator fee' : 'Set via Edit Cost & Tags above' }}</span>
                }
              </p>
            </div>

            <div class="p-4 rounded-[4px] bg-cv-well border border-cv-border-soft">
              <p class="text-[10px] uppercase tracking-[0.04em] font-semibold text-cv-ink-muted">Cost / 1,000 Followers</p>
              <p class="font-headline text-2xl font-bold text-cv-ink mt-1 leading-none">{{ roi.costPer1kFollowers ? formatInr(roi.costPer1kFollowers, 0) : '—' }}</p>
              <p class="text-[11px] text-cv-ink-subtle mt-1">CPM audience reach</p>
            </div>

            <div class="p-4 rounded-[4px] bg-cv-well border border-cv-border-soft">
              <p class="text-[10px] uppercase tracking-[0.04em] font-semibold text-cv-ink-muted">Cost / Interaction (CPE)</p>
              <p class="font-headline text-2xl font-bold text-cv-ink mt-1 leading-none">{{ roi.costPerInteraction ? formatInr(roi.costPerInteraction, 1) : '—' }}</p>
              <p class="text-[11px] text-cv-ink-subtle mt-1">Per verified like/comment</p>
            </div>

            <div class="p-4 rounded-[4px] bg-cv-well border border-cv-border-soft">
              <p class="text-[10px] uppercase tracking-[0.04em] font-semibold text-cv-ink-muted">CPV (Cost Per View)</p>
              <p class="font-headline text-2xl font-bold text-[#f54e26] mt-1 leading-none">{{ roi.costPerView ? formatInr(roi.costPerView, 2) : '—' }}</p>
              <p class="text-[11px] text-cv-ink-subtle mt-1">Cost per tracked view</p>
            </div>
          </div>
        </div>

        <!-- Tracked Reels & Deliverables -->
        <div class="bg-cv-card rounded-[4px] p-5 border border-cv-border space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-2.5 flex-wrap">
              <h2 class="font-headline uppercase text-lg font-bold text-cv-ink tracking-[0.02em]">TRACKED REELS &amp; DELIVERABLES</h2>
              <span class="px-2.5 py-0.5 rounded-[3px] bg-cv-well border border-cv-border text-xs font-semibold text-cv-ink-muted tabular-nums">{{ reels.length }} Tracked</span>
            </div>
            @if (igStatus?.configured) {
              <button type="button" (click)="toggleReelPicker(ic)"
                      class="h-8.5 px-3.5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border text-cv-ink text-xs font-semibold cursor-pointer transition-colors self-start sm:self-center">
                {{ showReelPicker() ? 'Hide IG Picker' : (loadingMedia ? 'Loading IG Posts...' : '+ Pick from IG (' + onlyReelsFromFeed().length + ' Reels / ' + (drawerMedia.length || ic.mediaCount || 0) + ' Posts)') }}
              </button>
            }
          </div>

          <form (ngSubmit)="submitReelForm()" class="p-3.5 rounded-[4px] bg-cv-well border border-cv-border grid grid-cols-1 gap-2.5 items-center" [ngClass]="roi.costMode === 'PER_DELIVERABLE' ? 'sm:grid-cols-6' : 'sm:grid-cols-5'">
            <input [(ngModel)]="newReelTitle" name="reelTitle" placeholder="Deliverable title" required class="sm:col-span-2 h-10 px-3 rounded-[4px] bg-cv-card border border-cv-border text-xs text-cv-ink placeholder:text-cv-ink-subtle focus:border-[#f54e26] focus:outline-none"/>
            <input [(ngModel)]="newReelUrl" (ngModelChange)="duplicateReelNotice.set('')" name="reelUrl" placeholder="https://www.instagram.com/reel/..." required class="sm:col-span-2 h-10 px-3 rounded-[4px] bg-cv-card border border-cv-border text-xs text-cv-ink placeholder:text-cv-ink-subtle focus:border-[#f54e26] focus:outline-none"/>
            @if (roi.costMode === 'PER_DELIVERABLE') {
              <input [(ngModel)]="newReelCost" name="reelCost" type="number" min="0" step="100" placeholder="Deliverable Cost ₹" class="h-10 px-3 rounded-[4px] bg-cv-card border border-cv-border text-xs text-cv-ink placeholder:text-cv-ink-subtle focus:border-[#f54e26] focus:outline-none tabular-nums"/>
            }
            <button type="submit" class="h-10 px-4 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase tracking-[0.03em] text-base font-bold cursor-pointer transition-colors">VERIFY &amp; ADD REEL</button>
          </form>
          @if (duplicateReelNotice()) {
            <p class="text-xs font-semibold text-cv-danger-ink bg-cv-danger-bg border border-[#ff5c5c]/40 rounded-[4px] px-3.5 py-2">{{ duplicateReelNotice() }}</p>
          }

          <!-- On-Demand IG Reel & Post Picker -->
          @if (showReelPicker()) {
            @let igReels = onlyReelsFromFeed();
            @let feedVideos = feedVideosFromFeed();
            @let pickerItems = displayedPickerMedia();
            <div class="p-4 rounded-[4px] bg-cv-well border border-cv-border space-y-3 animate-pop-in">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-cv-border-faint">
                <div>
                  <p class="text-xs font-bold text-cv-ink">Pick from {{ ic.handle }}'s Instagram ({{ pickerItems.length }} shown of {{ drawerMedia.length }} loaded posts)</p>
                  <p class="text-[11px] text-cv-ink-muted">Sorted by publish date (Instagram Pinned Reels appear at their publish date; for Collab Reels uploaded by a brand/co-author, paste the Reel URL above).</p>
                </div>
                <div class="flex items-center gap-2 flex-wrap shrink-0">
                  <div class="inline-flex items-center p-0.5 rounded-[4px] bg-cv-card border border-cv-border">
                    <button type="button" (click)="pickerFilter.set('reels')"
                            class="px-2.5 py-1 rounded-[3px] text-[11px] font-medium cursor-pointer transition-colors"
                            [ngClass]="pickerFilter() === 'reels' ? 'bg-[#f54e26] text-[#111111] font-bold' : 'text-cv-ink-muted hover:text-cv-ink'">
                      Reels ({{ igReels.length }})
                    </button>
                    @if (feedVideos.length > 0) {
                      <button type="button" (click)="pickerFilter.set('videos')"
                              class="px-2.5 py-1 rounded-[3px] text-[11px] font-medium cursor-pointer transition-colors"
                              [ngClass]="pickerFilter() === 'videos' ? 'bg-[#f54e26] text-[#111111] font-bold' : 'text-cv-ink-muted hover:text-cv-ink'">
                        IGTV / Videos ({{ feedVideos.length }})
                      </button>
                    }
                    <button type="button" (click)="pickerFilter.set('all')"
                            class="px-2.5 py-1 rounded-[3px] text-[11px] font-medium cursor-pointer transition-colors"
                            [ngClass]="pickerFilter() === 'all' ? 'bg-[#f54e26] text-[#111111] font-bold' : 'text-cv-ink-muted hover:text-cv-ink'">
                      All IG Posts ({{ drawerMedia.length }})
                    </button>
                  </div>
                  <button type="button" (click)="browseMedia.emit(ic)" class="h-7 px-2.5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border text-xs font-medium text-cv-ink cursor-pointer shrink-0 transition-colors">
                    {{ loadingMedia ? 'Refreshing...' : 'Refresh IG' }}
                  </button>
                </div>
              </div>
              @if (pickerItems.length === 0) {
                <p class="text-xs text-cv-ink-muted py-4 text-center">
                  {{ loadingMedia ? 'Loading Instagram posts...' : 'No public Reels/Posts found in this filter. Switch to "All IG Posts" or paste any Reel URL above.' }}
                </p>
              } @else {
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 max-h-[420px] overflow-y-auto pr-1">
                  @for (m of pickerItems; track m.id) {
                    @let alreadyTracked = isMediaAlreadyTracked(m);
                    <div class="p-3 rounded-[4px] border flex items-center justify-between gap-3 text-xs transition-colors"
                         [ngClass]="alreadyTracked ? 'bg-[#007656]/15 border-[#007656]/50' : 'bg-cv-card border-cv-border-soft hover:border-cv-border-bright'">
                      <div class="flex items-center gap-2.5 min-w-0">
                        @if (m.thumbnailUrl) {
                          <img [src]="m.thumbnailUrl" alt="Post preview" (error)="m.thumbnailUrl = ''" class="w-11 h-11 rounded-[4px] object-cover border border-cv-border-soft shrink-0"/>
                        } @else {
                          <div class="w-11 h-11 rounded-[4px] bg-cv-control text-cv-ink-muted text-[10px] font-bold flex items-center justify-center shrink-0">
                            {{ isReelMedia(m) ? 'REEL' : (isFeedVideoMedia(m) ? 'VIDEO' : 'POST') }}
                          </div>
                        }
                        <div class="min-w-0">
                          <div class="flex items-center gap-1.5">
                            <span class="px-1.5 py-0.2 rounded-[2px] text-[9px] font-bold uppercase shrink-0"
                                  [ngClass]="isReelMedia(m) ? 'bg-[#f54e26]/20 text-[#f54e26]' : (isFeedVideoMedia(m) ? 'bg-[#5738af]/25 text-cv-periwinkle' : 'bg-cv-hover-pill text-cv-ink-muted')">
                              {{ isReelMedia(m) ? 'Reel' : (isFeedVideoMedia(m) ? 'Video' : (m.mediaType === 'CAROUSEL_ALBUM' ? 'Carousel' : 'Photo')) }}
                            </span>
                            <p class="font-medium text-cv-ink truncate tabular-nums">{{ m.shortcode || (isReelMedia(m) ? 'Instagram Reel' : (isFeedVideoMedia(m) ? 'Video Post' : 'Instagram Post')) }}</p>
                          </div>
                          <p class="text-[11px] text-cv-ink-muted truncate mt-0.5 tabular-nums">
                            @if (isReelMedia(m) || (m.viewsCount || 0) > 0) {
                              <strong class="text-[#f54e26]">{{ formatCount(m.viewsCount || 0) }} views</strong> •
                            }
                            {{ formatCount(m.likeCount || 0) }} likes • {{ formatCount(m.commentsCount || 0) }} cmts
                          </p>
                          <div class="flex items-center gap-1.5 text-[10px] text-cv-ink-subtle mt-0.5 tabular-nums">
                            @if (m.timestamp) {
                              <span>{{ m.timestamp | date:'MMM d, y' }}</span>
                            }
                            @if (safeExternalUrl(m.permalink, true); as safeMediaUrl) {
                              <span>•</span>
                              <a [href]="safeMediaUrl" target="_blank" rel="noopener noreferrer" class="text-cv-ink-muted hover:text-[#f54e26] hover:underline">View ↗</a>
                            }
                          </div>
                        </div>
                      </div>
                      @if (alreadyTracked) {
                        <span class="px-2 py-1 rounded-[3px] bg-[#007656] text-[#fff6e8] text-[10px] font-bold shrink-0 select-none">✓ Tracked</span>
                      } @else {
                        <button type="button" (click)="selectMediaForTrack(m)" class="px-2.5 py-1 rounded-[3px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] text-[11px] font-bold transition-colors shrink-0 cursor-pointer">+ Track</button>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }

          @if (reels.length === 0) {
            <p class="text-xs text-cv-ink-muted py-6 text-center bg-cv-well rounded-[4px] border border-dashed border-cv-border">No Reels added for tracking yet. Paste an Instagram Reel URL above or click "+ Pick from IG" to choose one.</p>
          } @else {
            <div class="space-y-3">
              @for (r of reels; track r.id) {
                <div class="rounded-[4px] bg-cv-well border border-cv-border hover:border-cv-border-bright transition-colors p-4">
                  <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div (click)="openReel.emit(r)" class="flex items-center gap-3.5 min-w-0 cursor-pointer flex-1">
                      @if (r.thumbnailUrl) {
                        <img [src]="r.thumbnailUrl" alt="Reel cover" (error)="r.thumbnailUrl = ''" class="w-12 h-12 rounded-[4px] object-cover border border-cv-border shrink-0"/>
                      } @else {
                        <div class="w-12 h-12 rounded-[4px] bg-cv-control text-[#f54e26] font-headline text-xs font-bold flex items-center justify-center shrink-0">REEL</div>
                      }
                      <div class="min-w-0">
                        <p class="text-sm font-bold text-cv-ink truncate hover:text-[#f54e26] transition-colors">{{ displayReelTitle(r) }}</p>
                        <p class="text-xs text-cv-ink-muted truncate mt-0.5 tabular-nums">
                          {{ formatMediaLabel(r) }}
                          @if (r.publishedAt) {
                            <span> • Published {{ r.publishedAt | date:'MMM y' }}</span>
                          }
                          @if (roi.costMode === 'PER_DELIVERABLE') {
                            @if ((r.costQuoted || 0) > 0) {
                              <span class="font-semibold text-cv-gold"> • {{ formatInr(r.costQuoted || 0, 0) }}</span>
                            } @else if ((roi.baseRate || 0) > 0) {
                              <span class="font-medium text-cv-gold"> • {{ formatInr(roi.baseRate || 0, 0) }} (rate)</span>
                            } @else {
                              <button type="button" (click)="$event.stopPropagation(); startEditDeliverable(r)" class="ml-1.5 text-[#f54e26] hover:underline font-semibold cursor-pointer">• + Set cost ₹</button>
                            }
                          }
                        </p>
                      </div>
                    </div>

                    <div class="flex flex-wrap items-center gap-4 sm:gap-6 shrink-0">
                      <div (click)="openReel.emit(r)" class="flex items-center gap-5 cursor-pointer tabular-nums">
                        <div class="text-center" [title]="isStaticPhotoPost(r) && !r.viewsCount ? 'Static photo/carousel posts do not include video views' : 'Instagram Reel views'">
                          @if (r.viewsCount > 0) {
                            <p class="font-headline text-base font-bold text-[#f54e26] leading-tight">{{ r.viewsCount.toLocaleString('en-IN') }}</p>
                            <p class="text-[10px] uppercase font-semibold text-cv-ink-muted">Views</p>
                          } @else if (isStaticPhotoPost(r)) {
                            <p class="font-headline text-xs font-bold text-cv-ink-muted">Photo</p>
                            <p class="text-[10px] uppercase font-semibold text-cv-ink-subtle">No IG Views</p>
                          } @else {
                            <p class="font-headline text-base font-bold text-cv-ink-muted leading-tight">0</p>
                            <p class="text-[10px] uppercase font-semibold text-cv-ink-muted">Views</p>
                          }
                        </div>
                        <div class="text-center">
                          <p class="font-headline text-base font-bold text-cv-ink leading-tight">{{ r.likesCount.toLocaleString('en-IN') }}</p>
                          <p class="text-[10px] uppercase font-semibold text-cv-ink-muted">Likes</p>
                        </div>
                        <div class="text-center">
                          <p class="font-headline text-base font-bold text-cv-gold leading-tight">{{ r.commentsCount.toLocaleString('en-IN') }}</p>
                          <p class="text-[10px] uppercase font-semibold text-cv-ink-muted">Comments</p>
                        </div>
                      </div>

                      <div class="flex items-center gap-1.5 flex-wrap">
                        <button type="button" (click)="openReel.emit(r)" class="h-8 px-3 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] text-xs font-bold transition-colors cursor-pointer">
                          Live Insights
                        </button>
                        @if (safeExternalUrl(r.reelUrl, true); as safeReelLink) {
                          <a [href]="safeReelLink" target="_blank" rel="noopener noreferrer" class="inline-flex items-center h-8 px-3 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border text-xs font-medium text-cv-ink transition-colors">
                            View ↗
                          </a>
                        }
                        <button type="button" (click)="startEditDeliverable(r)" class="h-8 px-3 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border text-xs font-medium text-cv-ink cursor-pointer transition-colors">
                          Edit
                        </button>
                        <button type="button" (click)="syncReel.emit(r.id)" class="h-8 px-3 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border text-xs font-medium text-cv-ink cursor-pointer transition-colors">
                          Sync
                        </button>
                        <button type="button" (click)="requestDeleteReel.emit(r)" class="h-8 px-3 rounded-[4px] bg-cv-danger-bg hover:bg-cv-danger-hover border border-[#ff5c5c]/40 text-xs font-medium text-cv-danger-ink cursor-pointer transition-colors">
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>

                  @if (editingDeliverableId() === r.id) {
                    <form (ngSubmit)="saveDeliverableEdit(r.id)" class="mt-3 pt-3 border-t border-cv-border-soft grid grid-cols-1 gap-2.5 items-center animate-pop-in" [ngClass]="roi.costMode === 'PER_DELIVERABLE' ? 'sm:grid-cols-5' : 'sm:grid-cols-4'">
                      <input [(ngModel)]="editDelTitle" name="editDelTitle" placeholder="Deliverable title" required class="sm:col-span-2 h-9 px-3 rounded-[4px] bg-cv-card border border-cv-border text-xs text-cv-ink focus:border-[#f54e26] focus:outline-none"/>
                      @if (roi.costMode === 'PER_DELIVERABLE') {
                        <input [(ngModel)]="editDelCost" name="editDelCost" type="number" min="0" step="100" placeholder="Deliverable Cost ₹" class="h-9 px-3 rounded-[4px] bg-cv-card border border-cv-border text-xs text-cv-ink focus:border-[#f54e26] focus:outline-none tabular-nums"/>
                      }
                      <button type="submit" class="h-9 px-4 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase tracking-[0.03em] text-sm font-bold cursor-pointer transition-colors">SAVE</button>
                      <button type="button" (click)="editingDeliverableId.set(null)" class="h-9 px-3 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border text-xs font-medium text-cv-ink-muted hover:text-cv-ink cursor-pointer transition-colors">Cancel</button>
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
  pickerFilter = signal<'reels' | 'videos' | 'all'>('reels');
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
        this.pickerFilter.set('reels');
        this.editingDeliverableId.set(null);
        this.duplicateReelNotice.set('');
        this.pendingTrackKeys.set(new Set());
        this.chartTab.set(null);
        this.hoveredSliceId.set(null);
        this.pinnedSliceId.set(null);
      }
    }
  }

  displayCategory(ic: Creator): string {
    const raw = (ic.category || ic.niche || '').trim();
    if (ic.sourceType === 'AGENCY' && ic.agencyName && (!raw || raw === 'Direct / Independent')) {
      return ic.agencyName;
    }
    return raw;
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
    const palette = ['#f54e26', '#fabf29', '#007656', '#4ade80', '#5738af', '#d0d5ff'];
    const C = 2 * Math.PI * 72;

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
        label: this.displayReelTitle(r),
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
        label: this.displayReelTitle(x.reel),
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
        ? (item.id === 'mix-likes' ? '#f54e26' : '#fabf29')
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
    this.editDelTitle = this.displayReelTitle(r);
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

    const kind = this.isReelMedia(m) ? 'Instagram Reel' : (this.isFeedVideoMedia(m) ? 'Video Post' : 'Instagram Post');
    const title = m.shortcode ? `${kind} · ${m.shortcode}` : kind;
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
    if (this.showReelPicker() && (this.drawerMedia.length === 0 || (ic.mediaCount && this.drawerMedia.length < Math.min(ic.mediaCount, 100)))) {
      this.browseMedia.emit(ic);
    }
  }

  isReelMedia(m: any): boolean {
    if (!m) return false;
    if (m.isReel === true || m.mediaProductType === 'REELS') return true;
    const link = String(m.permalink || '').toLowerCase();
    return link.includes('/reel/') || link.includes('/reels/');
  }

  isFeedVideoMedia(m: any): boolean {
    return !!m && !this.isReelMedia(m) && m.mediaType === 'VIDEO';
  }

  onlyReelsFromFeed(): any[] {
    return (this.drawerMedia || []).filter(m => this.isReelMedia(m));
  }

  feedVideosFromFeed(): any[] {
    return (this.drawerMedia || []).filter(m => this.isFeedVideoMedia(m));
  }

  displayedPickerMedia(): any[] {
    const mode = this.pickerFilter();
    if (mode === 'all') return this.drawerMedia || [];
    if (mode === 'videos') return this.feedVideosFromFeed();
    return this.onlyReelsFromFeed();
  }

  isStaticPhotoPost(r: ReelDeliverable): boolean {
    const t = (r?.mediaType || '').toUpperCase();
    return t === 'IMAGE' || t === 'CAROUSEL_ALBUM' || t === 'FEED';
  }

  readonly displayReelTitle = formatReelDisplayTitle;

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

  readonly safeExternalUrl = safeExternalUrl;

  formatInr(n: number, decimals = 0): string {
    if (n === null || n === undefined || n <= 0) return '—';
    return '₹' + n.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }
}
