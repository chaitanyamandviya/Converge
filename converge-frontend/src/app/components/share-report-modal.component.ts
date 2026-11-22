import { Component, OnChanges, SimpleChanges, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CampaignSummary, SharedReportRecord } from '../services/api.service';

export interface CreateShareReportPayload {
  title: string;
  campaignId?: string | null;
  campaignFilter: string;
  includeSpend: boolean;
  expiryDays: number | null;
}

@Component({
  selector: 'app-share-report-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 bg-cv-backdrop backdrop-blur-xs flex items-center justify-center p-4 animate-pop-in" (click)="close.emit()">
        <div class="bg-cv-card rounded-[6px] max-w-xl w-full p-5 sm:p-6 border border-cv-border-strong shadow-[6px_6px_0px_#f54e26] max-h-[90vh] flex flex-col gap-4"
             (click)="$event.stopPropagation()">
          <div class="flex items-start justify-between gap-3 pb-3 border-b border-cv-border shrink-0">
            <div>
              <h3 class="font-headline uppercase text-2xl font-bold text-cv-ink tracking-[0.02em] leading-none">
                SHARE LIVE CLIENT / CMO REPORT
              </h3>
              <p class="text-xs text-cv-ink-muted mt-1">
                Generate a read-only live report link for stakeholders or clients — no sign-in required.
              </p>
            </div>
            <button type="button" (click)="close.emit()" class="w-8 h-8 rounded-[4px] hover:bg-cv-hover-pill flex items-center justify-center text-cv-ink-muted hover:text-cv-ink cursor-pointer shrink-0">✕</button>
          </div>

          <div class="overflow-y-auto pr-1 space-y-4">
            <form (ngSubmit)="submitCreate()" class="p-4 rounded-[4px] bg-cv-well border border-cv-border space-y-3 text-xs">
              <div>
                <label class="block font-medium text-cv-ink mb-1">Report Title</label>
                <input [ngModel]="title()" (ngModelChange)="title.set($event)" name="repTitle"
                       placeholder="e.g. Summer Launch Executive Recap" required
                       class="w-full h-9 px-3 rounded-[4px] bg-cv-card border border-cv-border text-cv-ink placeholder:text-cv-ink-subtle focus:border-[#f54e26] focus:outline-none"/>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block font-medium text-cv-ink mb-1">Campaign Scope</label>
                  <select [ngModel]="campaignFilter()" (ngModelChange)="campaignFilter.set($event)" name="repCamp"
                          class="w-full h-9 px-2.5 rounded-[4px] bg-cv-card border border-cv-border text-cv-ink focus:border-[#f54e26] focus:outline-none">
                    <option value="ALL">All Campaigns</option>
                    @for (c of campaignsList(); track c.id) {
                      <option [value]="c.name">{{ c.name }}</option>
                    }
                    @for (c of legacyCampaignStrings(); track c) {
                      <option [value]="c">{{ c }}</option>
                    }
                  </select>
                </div>
                <div>
                  <label class="block font-medium text-cv-ink mb-1">Link Expiration</label>
                  <select [ngModel]="expiryDays()" (ngModelChange)="expiryDays.set($event)" name="repExp"
                          class="w-full h-9 px-2.5 rounded-[4px] bg-cv-card border border-cv-border text-cv-ink focus:border-[#f54e26] focus:outline-none">
                    <option value="">No expiry (stays live until revoked)</option>
                    <option value="7">Expires in 7 days</option>
                    <option value="30">Expires in 30 days</option>
                    <option value="90">Expires in 90 days</option>
                  </select>
                </div>
              </div>

              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <label class="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" [ngModel]="includeSpend()" (ngModelChange)="includeSpend.set($event)" name="repSpend"
                         class="w-4 h-4 accent-[#f54e26] rounded-[2px] cursor-pointer"/>
                  <span class="text-cv-ink font-medium">Include Budget Spend, CPV &amp; CPE</span>
                </label>

                <button type="submit" [disabled]="busy()"
                        class="h-9 px-5 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase tracking-[0.03em] text-base font-bold cursor-pointer disabled:opacity-50 transition-colors shrink-0">
                  {{ busy() ? 'GENERATING...' : '+ GENERATE LINK ↗' }}
                </button>
              </div>
            </form>

            <!-- Active Share Links List -->
            <div class="space-y-2">
              <div class="flex items-center justify-between text-xs px-0.5">
                <span class="font-headline uppercase text-base font-bold text-cv-ink tracking-[0.02em]">ACTIVE REPORT LINKS ({{ reports().length }})</span>
                @if (loadingList()) {
                  <span class="text-cv-ink-muted">Refreshing...</span>
                }
              </div>

              @if (reports().length === 0) {
                <p class="py-5 text-center text-xs text-cv-ink-muted rounded-[4px] bg-cv-well border border-dashed border-cv-border">
                  No active shared links yet. Create one above to share live stats with your client or CMO.
                </p>
              } @else {
                <div class="rounded-[4px] bg-cv-well border border-cv-border divide-y divide-cv-divide-soft">
                  @for (rep of reports(); track rep.id) {
                    <div class="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                      <div class="min-w-0 space-y-1">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="font-semibold text-cv-ink truncate">{{ rep.title }}</span>
                          <span class="px-1.5 py-0.5 rounded-[2px] bg-cv-card border border-cv-border-soft text-[10px] text-cv-ink-muted">
                            {{ rep.campaignFilter === 'ALL' ? 'All Campaigns' : rep.campaignFilter }}
                          </span>
                          <span class="px-1.5 py-0.5 rounded-[2px] text-[10px] font-medium"
                                [ngClass]="rep.includeSpend ? 'bg-[#007656]/20 text-cv-green' : 'bg-cv-card text-cv-ink-subtle'">
                            {{ rep.includeSpend ? 'Spend + CPV Visible' : 'Spend Hidden' }}
                          </span>
                        </div>
                        <p class="text-[11px] text-cv-ink-subtle truncate font-mono">{{ buildShareUrl(rep.shareToken) }}</p>
                      </div>
                      <div class="flex items-center gap-1.5 shrink-0">
                        <button type="button" (click)="copyLink.emit(buildShareUrl(rep.shareToken))"
                                class="h-7 px-2.5 rounded-[3px] bg-cv-control hover:bg-[#f54e26] hover:text-[#111111] border border-cv-border text-[11px] font-semibold text-cv-ink cursor-pointer transition-colors">
                          Copy URL
                        </button>
                        <a [href]="buildShareUrl(rep.shareToken)" target="_blank" rel="noopener noreferrer"
                           class="inline-flex items-center h-7 px-2.5 rounded-[3px] bg-cv-control hover:bg-cv-control-hover border border-cv-border text-[11px] font-medium text-cv-ink transition-colors">
                          Open ↗
                        </a>
                        <button type="button" (click)="revokeReport.emit(rep.id)"
                                class="h-7 px-2.5 rounded-[3px] bg-cv-danger-bg hover:bg-cv-danger-hover border border-[#ff5c5c]/40 text-[11px] font-medium text-cv-danger-ink cursor-pointer transition-colors">
                          Revoke
                        </button>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          </div>

          <div class="pt-3 border-t border-cv-border flex justify-end shrink-0">
            <button type="button" (click)="close.emit()" class="h-9 px-4 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border-strong text-xs font-medium text-cv-ink cursor-pointer transition-colors">
              Done
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class ShareReportModalComponent implements OnChanges {
  open = input<boolean>(false);
  brandName = input<string>('');
  campaigns = input<string[]>([]);
  campaignsList = input<CampaignSummary[]>([]);
  defaultCampaignId = input<string>('');
  defaultCampaignFilter = input<string>('ALL');
  reports = input<SharedReportRecord[]>([]);
  busy = input<boolean>(false);
  loadingList = input<boolean>(false);

  close = output<void>();
  createReport = output<CreateShareReportPayload>();
  revokeReport = output<string>();
  copyLink = output<string>();

  title = signal('');
  campaignFilter = signal('ALL');
  includeSpend = signal(true);
  expiryDays = signal('');

  legacyCampaignStrings(): string[] {
    const knownNames = new Set(this.campaignsList().map(c => c.name.trim().toLowerCase()));
    return this.campaigns().filter(c => !knownNames.has(c.trim().toLowerCase()));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open()) {
      const matchedCamp = this.defaultCampaignId()
        ? this.campaignsList().find(c => c.id === this.defaultCampaignId())
        : null;
      const defCamp = matchedCamp?.name || this.defaultCampaignFilter() || 'ALL';
      this.campaignFilter.set(defCamp);
      const baseName = this.brandName() || 'Workspace';
      this.title.set(defCamp === 'ALL' ? `${baseName} Campaign Report` : `${baseName} • ${defCamp} Recap`);
      this.includeSpend.set(true);
      this.expiryDays.set('');
    }
  }

  buildShareUrl(token: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/report/${encodeURIComponent(token)}`;
  }

  submitCreate(): void {
    if (this.busy()) return;
    const rawExp = this.expiryDays();
    const parsedExp = rawExp && Number(rawExp) > 0 ? Number(rawExp) : null;
    const chosenName = this.campaignFilter() || 'ALL';
    const matchedCamp = chosenName !== 'ALL'
      ? this.campaignsList().find(c => c.name.trim().toLowerCase() === chosenName.trim().toLowerCase())
      : null;
    this.createReport.emit({
      title: this.title().trim() || `${this.brandName() || 'Campaign'} Report`,
      campaignId: matchedCamp ? matchedCamp.id : null,
      campaignFilter: chosenName,
      includeSpend: this.includeSpend(),
      expiryDays: parsedExp
    });
  }
}
