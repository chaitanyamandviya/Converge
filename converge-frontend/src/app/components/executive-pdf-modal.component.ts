import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Creator, ReelDeliverable } from '../services/api.service';
import {
  ExecutiveAnalyticsSummary,
  formatCompactCount,
  formatMoney,
  resolveEffectiveCampaign
} from '../utils/campaign-analytics';
import { formatPublishedDateLabel, formatReelKindLabel } from '../utils/reel-format';

@Component({
  selector: 'app-executive-pdf-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 bg-cv-backdrop backdrop-blur-xs flex items-center justify-center p-4 animate-pop-in cv-print-modal-backdrop" (click)="close.emit()">
        <div class="bg-[#ffffff] text-[#141414] rounded-[6px] max-w-4xl w-full border-2 border-[#111111] shadow-[6px_6px_0px_#f54e26] max-h-[92vh] flex flex-col cv-print-sheet"
             (click)="$event.stopPropagation()">
          <!-- Modal Toolbar (hidden in printed PDF) -->
          <div class="px-6 py-3.5 bg-[#161616] text-[#fff6e8] flex items-center justify-between gap-3 rounded-t-[4px] shrink-0 cv-print-hide">
            <div class="flex items-center gap-2.5">
              <span class="font-headline uppercase text-lg font-bold tracking-[0.03em] text-[#f54e26]">EXECUTIVE PDF RECAP</span>
              <span class="text-xs text-[#a7a9be]">• Ready to print or save as PDF</span>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" (click)="printReport()"
                      class="h-8.5 px-4 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase tracking-[0.03em] text-sm font-bold cursor-pointer transition-colors">
                Print / Save as PDF ↗
              </button>
              <button type="button" (click)="close.emit()"
                      class="w-8 h-8 rounded-[4px] hover:bg-white/10 flex items-center justify-center text-[#fff6e8] cursor-pointer">✕</button>
            </div>
          </div>

          <!-- Printable White-Paper Executive Sheet -->
          <div class="overflow-y-auto p-6 sm:p-8 space-y-6 cv-print-body">
            <!-- Header Banner -->
            <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b-2 border-[#141414]">
              <div class="flex items-center gap-3.5">
                <img src="/converge-logo.png" alt="Converge" class="w-10 h-10 rounded-[6px] object-contain border border-[#141414]/20 shrink-0"/>
                <div>
                  <p class="text-[11px] font-bold uppercase tracking-[0.08em] text-[#f54e26]">
                    CONVERGE • {{ campaignFilter() === 'ALL' ? 'CAMPAIGN PERFORMANCE RECAP' : campaignFilter().toUpperCase() }}
                  </p>
                  <h1 class="font-headline uppercase text-3xl font-bold tracking-[0.02em] text-[#141414] leading-none mt-1">
                    {{ workspaceTitle() }}
                  </h1>
                </div>
              </div>
              <div class="text-left sm:text-right text-xs text-[#52535c] tabular-nums">
                <p class="font-semibold text-[#141414]">Generated {{ todayLabel }}</p>
                <p>{{ creators().length }} Creator(s) • {{ deliverables().length }} Tracked Deliverable(s)</p>
              </div>
            </div>

            <!-- Goal Progress Bar (if set) -->
            @if (summary().goalProgress; as gp) {
              <div class="p-4 rounded-[4px] bg-[#faf7f2] border border-[#141414]/20 space-y-2 tabular-nums">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-bold uppercase tracking-wide text-[#141414]">Campaign Views Target Progress</span>
                  <span class="font-bold" [style.color]="gp.achieved ? '#007656' : '#f54e26'">
                    {{ gp.delivered.toLocaleString('en-IN') }} / {{ gp.target.toLocaleString('en-IN') }} Views ({{ gp.rawPct }}%)
                  </span>
                </div>
                <div class="h-2.5 w-full rounded-[2px] bg-[#e7e0d2] overflow-hidden">
                  <div class="h-full transition-all" [style.width.%]="gp.pct" [style.background]="gp.achieved ? '#007656' : '#f54e26'"></div>
                </div>
              </div>
            }

            <!-- Executive KPI Cards -->
            <div class="grid grid-cols-2 sm:grid-cols-4 border border-[#141414]/20 rounded-[4px] divide-y sm:divide-y-0 sm:divide-x divide-[#141414]/15 bg-[#faf7f2] tabular-nums">
              <div class="p-4">
                <p class="text-[10px] font-bold uppercase tracking-wider text-[#52535c]">Delivered Views</p>
                <p class="font-headline text-3xl font-bold text-[#f54e26] mt-1 leading-none">{{ compact(summary().totalViews) }}</p>
                <p class="text-[11px] text-[#52535c] mt-1">{{ compact(summary().totalInteractions) }} likes &amp; comments</p>
              </div>
              <div class="p-4">
                <p class="text-[10px] font-bold uppercase tracking-wider text-[#52535c]">Spend &amp; Blended CPV</p>
                <p class="font-headline text-3xl font-bold text-[#141414] mt-1 leading-none">
                  {{ summary().totalSpend > 0 ? money(summary().totalSpend, 0) : '—' }}
                </p>
                <p class="text-[11px] text-[#52535c] mt-1">
                  {{ summary().blendedCpv !== null ? ('CPV: ' + money(summary().blendedCpv, 2) + ' • CPE: ' + money(summary().blendedCpe, 1)) : 'Add creator rates for ROI' }}
                </p>
              </div>
              <div class="p-4">
                <p class="text-[10px] font-bold uppercase tracking-wider text-[#52535c]">Campaign Health &amp; Hook</p>
                <p class="font-headline text-3xl font-bold text-[#007656] mt-1 leading-none">
                  {{ summary().blendedEngagementRate > 0 ? summary().blendedEngagementRate + '%' : '—' }}
                  @if (summary().avgHookRatePct != null) {
                    <span class="text-base font-bold text-[#b45309] ml-1">• {{ summary().avgHookRatePct }}% Hook</span>
                  }
                </p>
                <p class="text-[11px] text-[#52535c] mt-1">{{ summary().healthScore.label }} • {{ summary().healthScore.benchmarkNote }}</p>
              </div>
              <div class="p-4">
                <p class="text-[10px] font-bold uppercase tracking-wider text-[#52535c]">Top Performing Reel</p>
                @if (summary().topReel; as tr) {
                  <p class="font-headline text-3xl font-bold text-[#b45309] mt-1 leading-none">{{ compact(tr.reel.viewsCount) }}</p>
                  <p class="text-[11px] text-[#141414] font-semibold truncate mt-1">{{ tr.creator?.handle || tr.reel.creatorHandle }}</p>
                } @else {
                  <p class="font-headline text-3xl font-bold text-[#52535c] mt-1 leading-none">—</p>
                  <p class="text-[11px] text-[#52535c] mt-1">No Reels tracked yet</p>
                }
              </div>
            </div>

            <!-- Campaign Breakdown (if multiple or named campaigns) -->
            @if (summary().campaignBreakdowns.length > 0 && (summary().campaignBreakdowns.length > 1 || summary().campaignBreakdowns[0].campaign !== 'Untagged / General')) {
              <div class="space-y-2">
                <h2 class="font-headline uppercase text-lg font-bold tracking-[0.02em] text-[#141414]">CAMPAIGN ROI BREAKDOWN</h2>
                <div class="border border-[#141414]/20 rounded-[4px] overflow-x-auto">
                  <table class="w-full text-left text-xs tabular-nums">
                    <thead class="bg-[#f0ebe1] text-[#52535c] text-[10px] uppercase tracking-wider">
                      <tr>
                        <th class="px-3 py-2 font-semibold">Campaign</th>
                        <th class="px-3 py-2 font-semibold text-right">Reels</th>
                        <th class="px-3 py-2 font-semibold text-right">Views</th>
                        <th class="px-3 py-2 font-semibold text-right">Spend</th>
                        <th class="px-3 py-2 font-semibold text-right">Blended CPV</th>
                        <th class="px-3 py-2 font-semibold text-right">Eng. Rate</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-[#141414]/10">
                      @for (cb of summary().campaignBreakdowns; track cb.campaign) {
                        <tr>
                          <td class="px-3 py-2 font-semibold text-[#141414]">{{ cb.campaign }}</td>
                          <td class="px-3 py-2 text-right">{{ cb.reelsCount }}</td>
                          <td class="px-3 py-2 text-right font-bold text-[#f54e26]">{{ compact(cb.views) }}</td>
                          <td class="px-3 py-2 text-right">{{ cb.spend > 0 ? money(cb.spend, 0) : '—' }}</td>
                          <td class="px-3 py-2 text-right font-semibold">{{ cb.cpv !== null ? money(cb.cpv, 2) : '—' }}</td>
                          <td class="px-3 py-2 text-right text-[#007656] font-semibold">{{ cb.engRate > 0 ? cb.engRate + '%' : '—' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }

            <!-- Tracked Deliverables Roster -->
            <div class="space-y-2">
              <h2 class="font-headline uppercase text-lg font-bold tracking-[0.02em] text-[#141414]">DELIVERABLES PERFORMANCE LEDGER</h2>
              @if (sortedReels().length === 0) {
                <p class="text-xs text-[#52535c] py-4 border border-dashed border-[#141414]/20 rounded-[4px] text-center">
                  No tracked deliverables in the selected scope.
                </p>
              } @else {
                <div class="border border-[#141414]/20 rounded-[4px] overflow-x-auto">
                  <table class="w-full text-left text-xs tabular-nums">
                    <thead class="bg-[#f0ebe1] text-[#52535c] text-[10px] uppercase tracking-wider">
                      <tr>
                        <th class="px-3 py-2 font-semibold">Creator</th>
                        <th class="px-3 py-2 font-semibold">Deliverable</th>
                        <th class="px-3 py-2 font-semibold">Campaign</th>
                        <th class="px-3 py-2 font-semibold text-right">Views</th>
                        <th class="px-3 py-2 font-semibold text-right">Likes</th>
                        <th class="px-3 py-2 font-semibold text-right">Cmts</th>
                        <th class="px-3 py-2 font-semibold text-right">Eng.</th>
                        @if (summary().avgHookRatePct != null) {
                          <th class="px-3 py-2 font-semibold text-right">Hook (3s)</th>
                        }
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-[#141414]/10">
                      @for (r of sortedReels(); track r.id) {
                        <tr>
                          <td class="px-3 py-2 font-semibold text-[#141414]">{{ r.creatorHandle }}</td>
                          <td class="px-3 py-2 text-[#2c2d33]">{{ deliverableLabel(r) }}</td>
                          <td class="px-3 py-2 text-[#52535c]">{{ resolveCamp(r) || '—' }}</td>
                          <td class="px-3 py-2 text-right font-bold text-[#f54e26]">{{ (r.viewsCount || 0).toLocaleString('en-IN') }}</td>
                          <td class="px-3 py-2 text-right">{{ (r.likesCount || 0).toLocaleString('en-IN') }}</td>
                          <td class="px-3 py-2 text-right">{{ (r.commentsCount || 0).toLocaleString('en-IN') }}</td>
                          <td class="px-3 py-2 text-right font-semibold text-[#007656]">{{ r.engagementRate > 0 ? r.engagementRate + '%' : '—' }}</td>
                          @if (summary().avgHookRatePct != null) {
                            <td class="px-3 py-2 text-right font-semibold text-[#b45309]">{{ r.hookRatePct != null ? r.hookRatePct + '%' : '—' }}</td>
                          }
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>

            <div class="pt-3 border-t border-[#141414]/15 flex items-center justify-between text-[10px] text-[#6e6f7a]">
              <span>Verified via Converge • No Screenshot Club</span>
              <span>Instagram Graph Analytics &amp; ROI Summary</span>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class ExecutivePdfModalComponent {
  open = input<boolean>(false);
  workspaceTitle = input<string>('Workspace');
  campaignFilter = input<string>('ALL');
  currency = input<string>('INR');
  creators = input<Creator[]>([]);
  deliverables = input<ReelDeliverable[]>([]);
  summary = input.required<ExecutiveAnalyticsSummary>();

  close = output<void>();

  readonly todayLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date());

  sortedReels = computed(() =>
    [...this.deliverables()].sort((a, b) => (b.viewsCount || 0) - (a.viewsCount || 0))
  );

  compact(n: number): string {
    return formatCompactCount(n);
  }

  money(n: number | null | undefined, dec = 0): string {
    return formatMoney(n, this.currency(), dec);
  }

  resolveCamp(r: ReelDeliverable): string {
    const c = this.creators().find(item => item.id === r.creatorId);
    return resolveEffectiveCampaign(r, c);
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
