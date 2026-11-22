import { Component, OnChanges, SimpleChanges, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Campaign,
  CampaignDetailBundle,
  Creator,
  ReelDeliverable
} from '../services/api.service';
import {
  extractCaptionHashtags,
  formatCompactCount,
  formatMoney,
  isDisclosureOnlyHashtag,
  resolveCurrencySymbol
} from '../utils/campaign-analytics';
import {
  formatPublishedDateLabel,
  formatReelDisplayTitle,
  formatReelKindLabel
} from '../utils/reel-format';
import { safeExternalUrl } from '../utils/url-safety';

export interface AssignCreatorPayload {
  creatorId: string;
  agreedCost: number | null;
  expectedReels: number;
  notes: string;
}

@Component({
  selector: 'app-campaign-detail-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (bundle(); as b) {
      @let camp = b.campaign;
      @let st = b.stats;
      <section class="space-y-5 animate-fade-in-up">
        <!-- Top Navigation & Actions -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-cv-border-soft">
          <div class="flex items-start sm:items-center gap-3.5 min-w-0">
            <button type="button" (click)="back.emit()"
                    class="h-9 px-3.5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border text-cv-ink text-xs font-medium flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors">
              <span>← Back to Campaigns</span>
            </button>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h1 class="font-headline uppercase text-2xl sm:text-3xl font-bold text-cv-ink tracking-[0.02em] leading-none truncate">
                  {{ camp.name }}
                </h1>
                <span class="px-2 py-0.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wide shrink-0"
                      [ngClass]="statusClass(camp.status)">
                  {{ camp.status }}
                </span>
                @if (camp.startDate || camp.endDate) {
                  <span class="text-xs text-cv-ink-muted tabular-nums">
                    {{ camp.startDate || 'Start' }} → {{ camp.endDate || 'Ongoing' }}
                  </span>
                }
              </div>
              @if (camp.briefNotes) {
                <p class="text-xs text-cv-ink-muted mt-1 max-w-2xl line-clamp-2">{{ camp.briefNotes }}</p>
              }
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 shrink-0">
            @if (manageableCreators().length > 0) {
              <button type="button" (click)="showAssignForm.set(!showAssignForm())"
                      class="h-9 px-3.5 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase tracking-[0.03em] text-sm font-bold cursor-pointer transition-colors">
                {{ showAssignForm() ? 'Hide Assign' : '+ ASSIGN CREATOR' }}
              </button>
            }
            <button type="button" (click)="bulkImportToCampaign.emit(camp)"
                    class="h-9 px-3.5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border-strong text-xs font-medium text-cv-ink cursor-pointer transition-colors">
              + Bulk Import Reels
            </button>
            <button type="button" (click)="shareCampaignReport.emit(camp)"
                    class="h-9 px-3.5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border-strong text-xs font-medium text-cv-ink cursor-pointer transition-colors">
              Share Report ↗
            </button>
            <button type="button" (click)="exportCampaignPdf.emit(camp)"
                    class="h-9 px-3.5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border-strong text-xs font-medium text-cv-ink cursor-pointer transition-colors">
              PDF Recap
            </button>
            @if (canManageCampaign()) {
              <button type="button" (click)="editCampaign.emit(camp)"
                      class="h-9 px-3.5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border-strong text-xs font-medium text-cv-ink cursor-pointer transition-colors">
                Edit
              </button>
              <button type="button" (click)="deleteCampaign.emit(camp)"
                      class="h-9 px-3 rounded-[4px] bg-cv-danger-bg hover:bg-cv-danger-hover border border-[#ff5c5c]/40 text-xs font-medium text-cv-danger-ink cursor-pointer transition-colors">
                Delete
              </button>
            }
          </div>
        </div>

        <!-- Goal & Budget Dual Progress Bars -->
        @if ((camp.targetViewsGoal && camp.targetViewsGoal > 0) || (camp.budgetAmount && camp.budgetAmount > 0 && canManageCampaign())) {
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 tabular-nums">
            @if (camp.targetViewsGoal && camp.targetViewsGoal > 0) {
              @let gPct = Math.min(100, st.goalProgressPct || 0);
              @let gRaw = st.goalProgressPct || 0;
              <div class="rounded-[4px] bg-cv-card border border-cv-border p-4 space-y-2">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-headline uppercase text-base font-bold text-cv-ink tracking-[0.02em]">VIEWS MILESTONE</span>
                  <span class="font-semibold" [ngClass]="gRaw >= 100 ? 'text-cv-green' : 'text-[#f54e26]'">
                    {{ st.viewsDelivered.toLocaleString('en-IN') }} / {{ camp.targetViewsGoal.toLocaleString('en-IN') }} ({{ gRaw }}%)
                  </span>
                </div>
                <div class="h-2.5 w-full rounded-[2px] bg-cv-well border border-cv-border-soft overflow-hidden">
                  <div class="h-full transition-all duration-300" [style.width.%]="gPct" [style.background]="gRaw >= 100 ? '#007656' : '#f54e26'"></div>
                </div>
              </div>
            }
            @if (camp.budgetAmount && camp.budgetAmount > 0 && canManageCampaign()) {
              @let bPct = Math.min(100, st.budgetUtilizationPct || 0);
              @let bRaw = st.budgetUtilizationPct || 0;
              <div class="rounded-[4px] bg-cv-card border border-cv-border p-4 space-y-2">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-headline uppercase text-base font-bold text-cv-ink tracking-[0.02em]">BUDGET UTILIZATION</span>
                  <span class="font-semibold" [ngClass]="bRaw > 100 ? 'text-cv-danger-ink' : 'text-cv-ink'">
                    {{ money(st.totalSpend, 0) }} / {{ money(camp.budgetAmount, 0) }} ({{ bRaw }}%)
                  </span>
                </div>
                <div class="h-2.5 w-full rounded-[2px] bg-cv-well border border-cv-border-soft overflow-hidden">
                  <div class="h-full transition-all duration-300" [style.width.%]="bPct" [style.background]="bRaw > 100 ? '#ff5c5c' : '#fabf29'"></div>
                </div>
              </div>
            }
          </div>
        }

        <!-- 4-Column Campaign KPI Grid -->
        <div class="rounded-[4px] bg-cv-card border border-cv-border grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-cv-divide tabular-nums">
          <div class="px-5 py-3.5">
            <p class="text-xs text-cv-ink-muted font-medium">Delivered Views</p>
            <p class="font-headline text-3xl font-bold text-[#f54e26] mt-1 leading-none">{{ compact(st.viewsDelivered) }}</p>
            <p class="text-[11px] text-cv-ink-subtle mt-1.5">{{ compact(st.totalInteractions) }} likes &amp; comments</p>
          </div>
          <div class="px-5 py-3.5">
            <p class="text-xs text-cv-ink-muted font-medium">Campaign Spend &amp; CPV</p>
            <p class="font-headline text-3xl font-bold text-cv-ink mt-1 leading-none">
              {{ st.totalSpend > 0 ? money(st.totalSpend, 0) : '—' }}
            </p>
            <p class="text-[11px] text-cv-ink-subtle mt-1.5">
              {{ st.blendedCpv !== null && st.blendedCpv !== undefined ? ('CPV: ' + money(st.blendedCpv, 2) + (st.blendedCpe ? ' • CPE: ' + money(st.blendedCpe, 1) : '')) : 'Assign fees for ROI' }}
            </p>
          </div>
          <div class="px-5 py-3.5">
            <p class="text-xs text-cv-ink-muted font-medium">Engagement &amp; Hook Rate</p>
            <p class="font-headline text-3xl font-bold text-cv-green mt-1 leading-none">
              {{ st.engagementRate > 0 ? st.engagementRate + '%' : '—' }}
              @if (st.avgHookRatePct != null) {
                <span class="text-lg font-semibold text-cv-gold ml-1">• {{ st.avgHookRatePct }}% Hook</span>
              }
            </p>
            <p class="text-[11px] text-cv-ink-subtle mt-1.5">
              {{ st.avgHookRatePct != null ? ('3s Hook across ' + (st.hookMeasuredReelsCount || 0) + ' Reel(s)') : 'Across campaign Reels' }}
            </p>
          </div>
          <div class="px-5 py-3.5">
            <p class="text-xs text-cv-ink-muted font-medium">Deliverables Status</p>
            <p class="font-headline text-3xl font-bold text-cv-gold mt-1 leading-none">
              {{ st.deliverablesCount }} / {{ Math.max(st.deliverablesCount, st.expectedReelsCount) }}
            </p>
            <p class="text-[11px] text-cv-ink-subtle mt-1.5">{{ st.postedCreatorsCount }} of {{ st.assignedCreatorsCount }} creator(s) posted</p>
          </div>
        </div>

        <!-- Inline Assign Creator Panel (Pre-Post Booking) -->
        @if (showAssignForm()) {
          <form (ngSubmit)="submitAssign()" class="bg-cv-card rounded-[6px] p-5 border border-cv-border-strong shadow-[4px_4px_0px_#f54e26] space-y-3.5 animate-pop-in text-xs">
            <div class="flex items-center justify-between pb-2.5 border-b border-cv-border-soft">
              <div>
                <h3 class="font-headline uppercase text-lg font-bold text-cv-ink tracking-[0.02em]">ASSIGN CREATOR TO {{ camp.name }}</h3>
                <p class="text-cv-ink-muted">Book creators into this campaign before Reels go live to track deliverables and agreed budget.</p>
              </div>
              <button type="button" (click)="showAssignForm.set(false)" class="text-cv-ink-muted hover:text-cv-ink cursor-pointer">✕</button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div class="lg:col-span-2">
                <label class="block font-medium text-cv-ink mb-1">Creator</label>
                <select [ngModel]="assignCreatorId()" (ngModelChange)="onSelectCreatorForAssign($event)" name="assignCid" required
                        class="w-full h-9 px-2.5 rounded-[4px] bg-cv-well border border-cv-border text-cv-ink focus:border-[#f54e26] focus:outline-none">
                  <option value="">Select manageable creator...</option>
                  @for (c of manageableCreators(); track c.id) {
                    <option [value]="c.id">{{ c.handle }} — {{ c.name }} ({{ c.followersDisplay || '—' }})</option>
                  }
                </select>
              </div>
              <div>
                <label class="block font-medium text-cv-ink mb-1">Agreed Fee ({{ currencySymbol() }}, opt)</label>
                <input [ngModel]="assignCost()" (ngModelChange)="assignCost.set($event)" name="assignCost"
                       type="number" min="0" step="500" placeholder="e.g. 45000"
                       class="w-full h-9 px-3 rounded-[4px] bg-cv-well border border-cv-border text-cv-ink tabular-nums focus:border-[#f54e26] focus:outline-none"/>
              </div>
              <div>
                <label class="block font-medium text-cv-ink mb-1">Expected Reels</label>
                <input [ngModel]="assignExpected()" (ngModelChange)="assignExpected.set($event)" name="assignExp"
                       type="number" min="1" max="50"
                       class="w-full h-9 px-3 rounded-[4px] bg-cv-well border border-cv-border text-cv-ink tabular-nums focus:border-[#f54e26] focus:outline-none"/>
              </div>
              <div>
                <button type="submit" [disabled]="assigningBusy() || !assignCreatorId()"
                        class="w-full h-9 px-4 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase tracking-[0.03em] text-sm font-bold cursor-pointer disabled:opacity-50 transition-colors">
                  {{ assigningBusy() ? 'SAVING...' : 'ASSIGN TO CAMPAIGN' }}
                </button>
              </div>
            </div>
            <div>
              <input [ngModel]="assignNotes()" (ngModelChange)="assignNotes.set($event)" name="assignNotes"
                     placeholder="Brief note (optional, e.g. 1x Unboxing Reel + Story link before Nov 28)"
                     class="w-full h-9 px-3 rounded-[4px] bg-cv-well border border-cv-border text-cv-ink placeholder:text-cv-ink-subtle focus:border-[#f54e26] focus:outline-none"/>
            </div>
          </form>
        }

        @if (b.complianceSummary?.hasRules || (b.hashtagAnalytics?.length || 0) > 0) {
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
            @if (b.complianceSummary; as cs) {
              @if (cs.hasRules) {
                <div class="bg-cv-card rounded-[4px] p-4 border border-cv-border space-y-2.5"
                     [ngClass]="(b.hashtagAnalytics?.length || 0) > 0 ? 'lg:col-span-5' : 'lg:col-span-12'">
                  <div class="flex items-center justify-between gap-2">
                    <h2 class="font-headline uppercase text-base font-bold text-cv-ink tracking-[0.02em]">HASHTAG &amp; DISCLOSURE COMPLIANCE</h2>
                    @if (cs.evaluableReels > 0) {
                      <span class="px-2 py-0.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wide"
                            [ngClass]="cs.nonCompliantCount === 0 ? 'bg-[#007656] text-[#fff6e8]' : 'bg-[#fabf29] text-[#111111]'">
                        {{ cs.nonCompliantCount === 0 ? ('All ' + cs.compliantCount + ' Compliant ✓') : (cs.compliantCount + ' / ' + cs.evaluableReels + ' Compliant') }}
                      </span>
                    }
                  </div>
                  @if (cs.requiredTags.length > 0) {
                    <div class="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span class="text-cv-ink-muted font-medium">Required:</span>
                      @for (tag of cs.requiredTags; track tag) {
                        <span class="px-2 py-0.5 rounded-[3px] bg-cv-well border border-cv-border font-medium text-cv-ink">{{ tag }}</span>
                      }
                    </div>
                  }
                  <div class="flex flex-wrap items-center gap-2 text-[11px] text-cv-ink-muted">
                    @if (cs.requireDisclosure) {
                      <span class="px-2 py-0.5 rounded-[3px] bg-cv-well border border-cv-border text-cv-ink">ASCI Rule: #ad / #paidpartnership required</span>
                    }
                    @if (cs.nonCompliantCount > 0) {
                      <span class="text-[#f54e26] font-semibold">
                        {{ cs.nonCompliantCount }} Reel{{ cs.nonCompliantCount === 1 ? '' : 's' }} flagged
                        @if (cs.missingDisclosureCount > 0) { ({{ cs.missingDisclosureCount }} missing disclosure) }
                      </span>
                    } @else if (cs.noCaptionCount > 0 && cs.evaluableReels === 0) {
                      <span>Sync Deliverables from Instagram to verify captions.</span>
                    }
                  </div>
                </div>
              }
            }

            @if ((b.hashtagAnalytics?.length || 0) > 0) {
              <div class="bg-cv-card rounded-[4px] p-4 border border-cv-border space-y-2.5"
                   [ngClass]="b.complianceSummary?.hasRules ? 'lg:col-span-7' : 'lg:col-span-12'">
                <div class="flex items-center justify-between gap-2">
                  <h2 class="font-headline uppercase text-base font-bold text-cv-ink tracking-[0.02em]">TOP CAMPAIGN HASHTAGS</h2>
                  <span class="text-[11px] text-cv-ink-muted">Ranked by views delivered</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 tabular-nums">
                  @for (ht of (b.hashtagAnalytics || []).slice(0, 6); track ht.hashtag) {
                    <div class="p-2.5 rounded-[4px] bg-cv-well border border-cv-border-soft flex items-center justify-between gap-2">
                      <div class="min-w-0">
                        <p class="text-xs font-bold text-cv-ink truncate">{{ ht.hashtag }}</p>
                        <p class="text-[10px] text-cv-ink-muted">{{ ht.reelsCount }} reel{{ ht.reelsCount === 1 ? '' : 's' }} · {{ ht.engagementRate }}% ER</p>
                      </div>
                      <div class="text-right shrink-0">
                        <p class="font-headline text-base font-bold text-[#f54e26] leading-none">{{ compact(ht.totalViews) }}</p>
                        <p class="text-[9px] uppercase text-cv-ink-subtle">views</p>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        }

        <!-- Assigned Creators Roster -->
        <div class="bg-cv-card rounded-[4px] border border-cv-border overflow-hidden">
          <div class="px-5 py-3.5 border-b border-cv-border flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 class="font-headline uppercase text-lg font-bold text-cv-ink tracking-[0.02em]">
                CAMPAIGN CREATORS ({{ b.assignedCreators.length }})
              </h2>
              <p class="text-[11px] text-cv-ink-muted">Click any creator to manage deliverables or paste Reel URLs.</p>
            </div>
          </div>

          @if (b.assignedCreators.length === 0) {
            <div class="p-8 text-center space-y-2.5">
              <p class="text-xs text-cv-ink-muted">No creators assigned to this campaign yet.</p>
              @if (manageableCreators().length > 0) {
                <button type="button" (click)="showAssignForm.set(true)"
                        class="h-8 px-4 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase text-sm font-bold cursor-pointer">
                  + ASSIGN CREATOR TO CAMPAIGN
                </button>
              }
            </div>
          } @else {
            <div class="divide-y divide-cv-divide-soft">
              @for (row of b.assignedCreators; track row.creator.id) {
                <div class="px-5 py-3.5 hover:bg-cv-hover-subtle transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div (click)="openCreator.emit(row.creator)" class="flex items-center gap-3 min-w-0 cursor-pointer flex-1">
                    @if (row.creator.avatarUrl) {
                      <img [src]="row.creator.avatarUrl" [alt]="row.creator.name" (error)="row.creator.avatarUrl = null" class="w-10 h-10 rounded-[4px] object-cover border border-cv-border shrink-0"/>
                    } @else {
                      <div class="w-10 h-10 rounded-[4px] bg-[#f54e26] text-[#111111] font-headline font-bold text-base flex items-center justify-center shrink-0">
                        {{ row.creator.name.substring(0, 2).toUpperCase() }}
                      </div>
                    }
                    <div class="min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-headline uppercase text-lg font-bold text-cv-ink hover:text-[#f54e26] truncate transition-colors">{{ row.creator.name }}</span>
                        <span class="px-2 py-0.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wide"
                              [ngClass]="row.status === 'POSTED' ? 'bg-[#007656] text-[#fff6e8]' : 'bg-[#fabf29] text-[#111111]'">
                          {{ row.status === 'POSTED' ? 'Posted' : 'Pending Deliverable' }}
                        </span>
                        @if (row.creator.sourceType === 'AGENCY' && row.creator.agencyName) {
                          <span class="px-1.5 py-0.5 rounded-[2px] bg-cv-well border border-cv-border text-[10px] text-cv-ink-muted">
                            {{ row.creator.agencyName }}
                          </span>
                        }
                      </div>
                      <p class="text-xs text-cv-ink-muted truncate tabular-nums">
                        <span class="text-[#f54e26] font-medium">{{ row.creator.handle }}</span>
                        • {{ row.creator.followersDisplay || '—' }} followers
                        @if (row.assignment?.notes) { • {{ row.assignment!.notes }} }
                      </p>
                    </div>
                  </div>

                  <div class="flex flex-wrap items-center gap-5 shrink-0 tabular-nums text-xs">
                    <div class="text-center">
                      <p class="font-headline text-base font-bold text-[#f54e26]">{{ compact(row.viewsCount) }}</p>
                      <p class="text-[10px] uppercase text-cv-ink-muted">Views</p>
                    </div>
                    <div class="text-center">
                      <p class="font-headline text-base font-bold text-cv-ink">{{ row.reelsCount }} / {{ row.expectedReels }}</p>
                      <p class="text-[10px] uppercase text-cv-ink-muted">Reels</p>
                    </div>
                    @if (row.hookRatePct != null) {
                      <div class="text-center">
                        <p class="font-headline text-base font-bold text-cv-green">{{ row.hookRatePct }}%</p>
                        <p class="text-[10px] uppercase text-cv-ink-muted">Hook (3s)</p>
                      </div>
                    }
                    <div class="text-center">
                      <p class="font-headline text-base font-bold text-cv-gold">{{ row.calculatedSpend ? money(row.calculatedSpend, 0) : '—' }}</p>
                      <p class="text-[10px] uppercase text-cv-ink-muted">Agreed / Spend</p>
                    </div>
                    <div class="flex items-center gap-1.5">
                      <button type="button" (click)="openCreator.emit(row.creator)"
                              class="h-8 px-3 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] text-xs font-bold cursor-pointer transition-colors">
                        Insights &amp; Reels →
                      </button>
                      @if (isManageableCreator(row.creator) && row.assignment) {
                        <button type="button" (click)="removeCreator.emit({ campaignId: camp.id, creatorId: row.creator.id })"
                                class="h-8 px-2.5 rounded-[4px] bg-cv-danger-bg hover:bg-cv-danger-hover border border-[#ff5c5c]/40 text-cv-danger-ink text-xs font-medium cursor-pointer transition-colors">
                          Unlink
                        </button>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Campaign Deliverables List -->
        <div class="bg-cv-card rounded-[4px] border border-cv-border overflow-hidden">
          <div class="px-5 py-3.5 border-b border-cv-border flex items-center justify-between gap-2">
            <h2 class="font-headline uppercase text-lg font-bold text-cv-ink tracking-[0.02em]">
              CAMPAIGN REELS &amp; DELIVERABLES ({{ b.deliverables.length }})
            </h2>
          </div>

          @if (b.deliverables.length === 0) {
            <p class="p-8 text-center text-xs text-cv-ink-muted">
              No Reels linked to this campaign yet. Open an assigned creator above or use "+ Bulk Import Reels".
            </p>
          } @else {
            <div class="divide-y divide-cv-divide-soft">
              @for (r of b.deliverables; track r.id) {
                <div class="px-5 py-3.5 hover:bg-cv-hover-subtle transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div (click)="openReel.emit(r)" class="flex items-center gap-3 min-w-0 cursor-pointer flex-1">
                    @if (r.thumbnailUrl) {
                      <img [src]="r.thumbnailUrl" alt="Reel preview" (error)="r.thumbnailUrl = ''" class="w-11 h-11 rounded-[4px] object-cover border border-cv-border shrink-0"/>
                    } @else {
                      <div class="w-11 h-11 rounded-[4px] bg-cv-control text-[#f54e26] font-headline text-xs font-bold flex items-center justify-center shrink-0">REEL</div>
                    }
                    <div class="min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <p class="text-sm font-bold text-cv-ink truncate hover:text-[#f54e26] transition-colors">{{ displayTitle(r) }}</p>
                        @let comp = b.deliverableCompliance?.[r.id];
                        @if (comp?.hasRules) {
                          @if (comp!.status === 'COMPLIANT') {
                            <span class="px-1.5 py-0.5 rounded-[3px] bg-[#007656]/20 text-cv-green border border-[#007656]/30 text-[10px] font-bold uppercase tracking-wide">✓ Compliant</span>
                          } @else if (comp!.status === 'NO_CAPTION') {
                            <span class="px-1.5 py-0.5 rounded-[3px] bg-cv-well border border-cv-border text-cv-ink-subtle text-[10px] font-medium">Caption pending sync</span>
                          } @else {
                            <span class="px-1.5 py-0.5 rounded-[3px] bg-[#fabf29]/20 text-cv-gold border border-[#fabf29]/40 text-[10px] font-bold">
                              @if (comp!.disclosureMissing && comp!.missingTags.length > 0) {
                                Missing #ad &amp; {{ comp!.missingTags.join(', ') }}
                              } @else if (comp!.disclosureMissing) {
                                Missing #ad
                              } @else {
                                Missing {{ comp!.missingTags.join(', ') }}
                              }
                            </span>
                          }
                        }
                      </div>
                      <p class="text-xs text-cv-ink-muted truncate tabular-nums">
                        <span class="text-[#f54e26]">{{ r.creatorHandle }}</span> • {{ reelMeta(r) }}
                      </p>
                      @let rTags = reelTags(r);
                      @if (rTags.length > 0) {
                        <div class="flex flex-wrap gap-1 mt-1">
                          @for (tag of rTags.slice(0, 5); track tag) {
                            <span class="px-1.5 py-0.2 rounded-[2px] text-[10px] font-medium"
                                  [ngClass]="isDisclosureTag(tag) ? 'bg-[#007656]/15 text-cv-green' : 'bg-cv-well border border-cv-border-soft text-cv-ink-muted'">
                              {{ tag }}
                            </span>
                          }
                        </div>
                      }
                    </div>
                  </div>

                  <div class="flex flex-wrap items-center gap-5 shrink-0 tabular-nums text-xs">
                    <div class="text-center">
                      <p class="font-headline text-base font-bold text-[#f54e26]">{{ (r.viewsCount || 0).toLocaleString('en-IN') }}</p>
                      <p class="text-[10px] uppercase text-cv-ink-muted">Views</p>
                    </div>
                    <div class="text-center">
                      <p class="font-headline text-base font-bold text-cv-ink">{{ (r.likesCount || 0).toLocaleString('en-IN') }}</p>
                      <p class="text-[10px] uppercase text-cv-ink-muted">Likes</p>
                    </div>
                    <div class="text-center">
                      <p class="font-headline text-base font-bold text-cv-gold">{{ (r.commentsCount || 0).toLocaleString('en-IN') }}</p>
                      <p class="text-[10px] uppercase text-cv-ink-muted">Cmts</p>
                    </div>
                    @if (r.hookRatePct != null) {
                      <div class="text-center">
                        <p class="font-headline text-base font-bold text-cv-green">{{ r.hookRatePct }}%</p>
                        <p class="text-[10px] uppercase text-cv-ink-muted">Hook</p>
                      </div>
                    }
                    <div class="flex items-center gap-1.5">
                      <button type="button" (click)="openReel.emit(r)"
                              class="h-8 px-3 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] text-xs font-bold cursor-pointer transition-colors">
                        Live Insights
                      </button>
                      @if (safeExternalUrl(r.reelUrl, true); as safeLink) {
                        <a [href]="safeLink" target="_blank" rel="noopener noreferrer"
                           class="inline-flex items-center h-8 px-3 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border text-xs font-medium text-cv-ink transition-colors">
                          View ↗
                        </a>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </section>
    } @else {
      <div class="py-20 flex flex-col items-center justify-center gap-3 text-sm text-cv-ink-muted">
        <svg class="w-6 h-6 animate-spin text-[#f54e26]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9"/></svg>
        <span>Loading campaign workspace...</span>
      </div>
    }
  `
})
export class CampaignDetailViewComponent implements OnChanges {
  bundle = input<CampaignDetailBundle | null>(null);
  manageableCreators = input<Creator[]>([]);
  canManageCampaign = input<boolean>(false);
  assigningBusy = input<boolean>(false);

  back = output<void>();
  editCampaign = output<Campaign>();
  deleteCampaign = output<Campaign>();
  assignCreator = output<{ campaignId: string; payload: AssignCreatorPayload }>();
  removeCreator = output<{ campaignId: string; creatorId: string }>();
  openCreator = output<Creator>();
  openReel = output<ReelDeliverable>();
  bulkImportToCampaign = output<Campaign>();
  shareCampaignReport = output<Campaign>();
  exportCampaignPdf = output<Campaign>();

  readonly Math = Math;
  readonly safeExternalUrl = safeExternalUrl;
  readonly displayTitle = formatReelDisplayTitle;

  showAssignForm = signal(false);
  assignCreatorId = signal('');
  assignCost = signal('');
  assignExpected = signal('1');
  assignNotes = signal('');

  manageableCreatorIds = computed(() => new Set(this.manageableCreators().map(c => c.id)));
  currencySymbol = computed(() => resolveCurrencySymbol(this.bundle()?.brand.currency));

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['bundle']) {
      const prevId = changes['bundle'].previousValue?.campaign?.id;
      const curId = this.bundle()?.campaign?.id;
      if (prevId !== curId) {
        this.showAssignForm.set(false);
        this.assignCreatorId.set('');
        this.assignCost.set('');
        this.assignExpected.set('1');
        this.assignNotes.set('');
      }
    }
  }

  isManageableCreator(c: Creator): boolean {
    return !!c?.id && this.manageableCreatorIds().has(c.id);
  }

  onSelectCreatorForAssign(creatorId: string): void {
    this.assignCreatorId.set(creatorId);
    const existing = this.bundle()?.assignedCreators.find(a => a.creator.id === creatorId);
    if (existing?.assignment) {
      this.assignCost.set(existing.assignment.agreedCost ? String(existing.assignment.agreedCost) : '');
      this.assignExpected.set(String(existing.assignment.expectedReels || 1));
      this.assignNotes.set(existing.assignment.notes || '');
    } else {
      const creator = this.manageableCreators().find(c => c.id === creatorId);
      this.assignCost.set(creator?.costQuoted ? String(creator.costQuoted) : '');
      this.assignExpected.set('1');
      this.assignNotes.set('');
    }
  }

  submitAssign(): void {
    const campId = this.bundle()?.campaign.id;
    const cid = this.assignCreatorId();
    if (!campId || !cid || this.assigningBusy()) return;
    const rawCost = String(this.assignCost() || '').trim();
    const costVal = rawCost && Number(rawCost) > 0 ? Number(rawCost) : null;
    const exp = Math.max(1, Math.min(50, Number(this.assignExpected()) || 1));
    this.assignCreator.emit({
      campaignId: campId,
      payload: {
        creatorId: cid,
        agreedCost: costVal,
        expectedReels: exp,
        notes: this.assignNotes().trim()
      }
    });
    this.assignCreatorId.set('');
    this.assignCost.set('');
    this.assignExpected.set('1');
    this.assignNotes.set('');
    this.showAssignForm.set(false);
  }

  statusClass(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'ACTIVE': return 'bg-[#007656] text-[#fff6e8]';
      case 'PLANNING': return 'bg-[#5738af] text-[#fff6e8]';
      case 'COMPLETED': return 'bg-cv-ink text-cv-ink-inverse';
      default: return 'bg-[#fabf29] text-[#111111]';
    }
  }

  compact(n: number): string {
    return formatCompactCount(n);
  }

  money(n: number | null | undefined, dec = 0): string {
    return formatMoney(n, this.bundle()?.brand.currency, dec);
  }

  reelMeta(r: ReelDeliverable): string {
    const kind = formatReelKindLabel(r);
    const pub = formatPublishedDateLabel(r.publishedAt);
    return pub ? `${kind} · Published ${pub}` : kind;
  }

  reelTags(r: ReelDeliverable): string[] {
    return extractCaptionHashtags(r.caption);
  }

  readonly isDisclosureTag = isDisclosureOnlyHashtag;
}
