import { Component, OnChanges, SimpleChanges, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CampaignSummary, Creator } from '../services/api.service';
import { ParsedBulkReelRow, parseBulkReelLines } from '../utils/bulk-import';
import { resolveCurrencySymbol } from '../utils/campaign-analytics';

export interface BulkImportSubmitPayload {
  defaultCreatorId?: string;
  defaultCampaignId?: string | null;
  defaultCampaignTag?: string;
  defaultCostQuoted?: number | null;
  items: Array<{
    reelUrl: string;
    creatorHandle?: string;
    title?: string;
    costQuoted?: string | number | null;
    campaignTag?: string;
  }>;
}

export interface BulkImportResult {
  addedCount: number;
  skippedDuplicatesCount: number;
  failedCount: number;
  createdCreatorsCount: number;
  errors: Array<{ row: number; reelUrl: string; reason: string }>;
}

@Component({
  selector: 'app-bulk-import-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 bg-cv-backdrop backdrop-blur-xs flex items-center justify-center p-4 animate-pop-in" (click)="close.emit()">
        <div class="bg-cv-card rounded-[6px] max-w-2xl w-full p-5 sm:p-6 border border-cv-border-strong shadow-[6px_6px_0px_#f54e26] max-h-[90vh] flex flex-col gap-4"
             (click)="$event.stopPropagation()">
          <div class="flex items-start justify-between gap-3 pb-3 border-b border-cv-border shrink-0">
            <div>
              <h3 class="font-headline uppercase text-2xl font-bold text-cv-ink tracking-[0.02em] leading-none">
                BULK IMPORT INSTAGRAM REELS
              </h3>
              <p class="text-xs text-cv-ink-muted mt-1">
                Paste up to 50 Instagram Reel / Post URLs at once, or upload a CSV to auto-create creators and sync views.
              </p>
            </div>
            <button type="button" (click)="close.emit()" class="w-8 h-8 rounded-[4px] hover:bg-cv-hover-pill flex items-center justify-center text-cv-ink-muted hover:text-cv-ink cursor-pointer shrink-0">✕</button>
          </div>

          <div class="overflow-y-auto pr-1 space-y-4">
            @if (errorMsg()) {
              <div class="px-3.5 py-2.5 rounded-[4px] bg-cv-danger-bg border border-[#ff5c5c]/40 text-xs text-cv-danger-ink font-medium">
                {{ errorMsg() }}
              </div>
            }

            @if (result(); as res) {
              <div class="p-3.5 rounded-[4px] bg-cv-well border space-y-2 text-xs"
                   [ngClass]="res.failedCount > 0 ? 'border-cv-gold' : 'border-cv-green'">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span class="font-bold text-cv-ink">
                    Imported {{ res.addedCount }} deliverable(s)
                    @if (res.createdCreatorsCount > 0) { • {{ res.createdCreatorsCount }} new creator(s) added }
                    @if (res.skippedDuplicatesCount > 0) { • {{ res.skippedDuplicatesCount }} duplicate(s) skipped }
                  </span>
                  @if (res.failedCount > 0) {
                    <span class="text-cv-gold font-semibold">{{ res.failedCount }} skipped with errors</span>
                  }
                </div>
                @if (res.errors.length > 0) {
                  <ul class="space-y-1 text-[11px] text-cv-danger-ink max-h-28 overflow-y-auto pt-1 border-t border-cv-border-faint">
                    @for (err of res.errors; track err.row) {
                      <li>Row {{ err.row }}: {{ err.reason }} @if (err.reelUrl) { ({{ err.reelUrl }}) }</li>
                    }
                  </ul>
                }
              </div>
            }

            <!-- Optional Defaults Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label class="block font-medium text-cv-ink mb-1">Default Creator (optional)</label>
                <select [ngModel]="defaultCreatorId()" (ngModelChange)="defaultCreatorId.set($event)"
                        class="w-full h-9 px-2.5 rounded-[4px] bg-cv-well border border-cv-border text-cv-ink text-xs focus:border-[#f54e26] focus:outline-none">
                  <option value="">Auto-detect @handle from URL / CSV</option>
                  @for (c of manageableCreators(); track c.id) {
                    <option [value]="c.id">{{ c.handle }} ({{ c.name }})</option>
                  }
                </select>
              </div>
              <div>
                <label class="block font-medium text-cv-ink mb-1">Campaign (optional)</label>
                <select [ngModel]="selectedCampaignId()" (ngModelChange)="onSelectCampaign($event)"
                        class="w-full h-9 px-2.5 rounded-[4px] bg-cv-well border border-cv-border text-cv-ink text-xs focus:border-[#f54e26] focus:outline-none">
                  <option value="">No Campaign / Use CSV column</option>
                  @for (camp of campaigns(); track camp.id) {
                    <option [value]="camp.id">{{ camp.name }}</option>
                  }
                </select>
              </div>
              <div>
                <label class="block font-medium text-cv-ink mb-1">Default Cost / Reel ({{ currencySymbol() }})</label>
                <input [ngModel]="defaultCost()" (ngModelChange)="defaultCost.set($event)"
                       type="number" min="0" step="100" placeholder="e.g. 25000"
                       class="w-full h-9 px-3 rounded-[4px] bg-cv-well border border-cv-border text-cv-ink placeholder:text-cv-ink-subtle text-xs focus:border-[#f54e26] focus:outline-none tabular-nums"/>
              </div>
            </div>

            <!-- URL Paste / CSV Upload -->
            <div class="space-y-1.5">
              <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
                <label class="font-medium text-cv-ink">Instagram URLs or CSV Rows <span class="text-cv-ink-muted font-normal">(1 per line, max 50)</span></label>
                <div class="flex items-center gap-2">
                  <label class="px-2.5 py-1 rounded-[3px] bg-cv-control hover:bg-cv-control-hover border border-cv-border text-[11px] font-medium text-cv-ink cursor-pointer transition-colors">
                    Upload .CSV
                    <input type="file" accept=".csv,.txt" class="hidden" (change)="onCsvFileSelected($event)"/>
                  </label>
                  @if (rawInput().trim()) {
                    <button type="button" (click)="rawInput.set('')" class="text-[11px] text-cv-ink-muted hover:text-cv-ink underline cursor-pointer">Clear</button>
                  }
                </div>
              </div>
              <textarea
                [ngModel]="rawInput()"
                (ngModelChange)="rawInput.set($event)"
                rows="6"
                placeholder="Paste Reel links or CSV rows:&#10;https://www.instagram.com/aman.gulabani/reel/DHyTOkXBzZ.../&#10;https://www.instagram.com/reel/C8xYz.../, @creatorhandle, Launch Video, 25000, Summer Drop"
                class="w-full p-3 rounded-[4px] bg-cv-well border border-cv-border-strong text-xs text-cv-ink placeholder:text-cv-ink-subtle focus:border-[#f54e26] focus:outline-none font-mono leading-relaxed"></textarea>
              <p class="text-[11px] text-cv-ink-muted">
                CSV Format (optional columns): <code class="text-cv-ink">instagram_url, @handle, title, cost, campaign</code>. URLs formatted like <code class="text-cv-ink">instagram.com/username/reel/...</code> automatically detect the creator.
              </p>
            </div>

            <!-- Live Preview Table -->
            @if (parsedRows().length > 0) {
              <div class="rounded-[4px] bg-cv-well border border-cv-border divide-y divide-cv-divide-soft text-xs">
                <div class="px-3 py-2 flex items-center justify-between bg-cv-card-alt">
                  <span class="font-semibold text-cv-ink">Parsed Preview ({{ parsedRows().length }} rows)</span>
                  <div class="flex items-center gap-2 text-[11px] tabular-nums">
                    <span class="text-cv-green font-semibold">{{ validRows().length }} ready</span>
                    @if (invalidRows().length > 0) {
                      <span class="text-cv-danger-ink font-semibold">• {{ invalidRows().length }} invalid</span>
                    }
                  </div>
                </div>
                <div class="max-h-40 overflow-y-auto divide-y divide-cv-divide-soft">
                  @for (row of parsedRows(); track $index) {
                    <div class="px-3 py-1.5 flex items-center justify-between gap-2 text-[11px]">
                      <div class="flex items-center gap-2 min-w-0">
                        <span class="w-1.5 h-1.5 rounded-full shrink-0" [ngClass]="row.valid ? 'bg-cv-green' : 'bg-cv-red'"></span>
                        <span class="truncate text-cv-ink font-medium max-w-[220px]">{{ row.reelUrl }}</span>
                        @if (row.creatorHandle || defaultCreatorLabel()) {
                          <span class="text-[#f54e26] shrink-0">{{ row.creatorHandle || defaultCreatorLabel() }}</span>
                        }
                        @if (row.campaignTag || defaultCampaignTag()) {
                          <span class="px-1.5 py-0.2 rounded-[2px] bg-cv-card border border-cv-border-soft text-cv-ink-muted shrink-0">
                            {{ row.campaignTag || defaultCampaignTag() }}
                          </span>
                        }
                      </div>
                      <span class="shrink-0 tabular-nums" [ngClass]="row.valid ? 'text-cv-ink-muted' : 'text-cv-danger-ink'">
                        {{ row.valid ? (row.costQuoted ? currencySymbol() + row.costQuoted : 'Ready') : row.reason }}
                      </span>
                    </div>
                  }
                </div>
              </div>
            }
          </div>

          <div class="pt-3 border-t border-cv-border flex items-center justify-between gap-2.5 shrink-0">
            <span class="text-[11px] text-cv-ink-muted">Duplicates already in workspace are skipped automatically.</span>
            <div class="flex items-center gap-2">
              <button type="button" (click)="close.emit()" class="h-9 px-4 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border-strong text-xs font-medium text-cv-ink-muted hover:text-cv-ink cursor-pointer transition-colors">
                Close
              </button>
              <button
                type="button"
                (click)="submitImport()"
                [disabled]="busy() || validRows().length === 0 || validRows().length > 50"
                class="h-9 px-5 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase tracking-[0.03em] text-base font-bold cursor-pointer disabled:opacity-50 transition-colors">
                {{ busy() ? 'IMPORTING & SYNCING...' : ('IMPORT ' + validRows().length + ' REEL(S) ↗') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class BulkImportModalComponent implements OnChanges {
  open = input<boolean>(false);
  manageableCreators = input<Creator[]>([]);
  campaigns = input<CampaignSummary[]>([]);
  preselectedCampaignId = input<string>('');
  currency = input<string>('INR');
  busy = input<boolean>(false);
  errorMsg = input<string>('');
  result = input<BulkImportResult | null>(null);

  close = output<void>();
  importSubmit = output<BulkImportSubmitPayload>();

  rawInput = signal('');
  defaultCreatorId = signal('');
  selectedCampaignId = signal('');
  defaultCampaignTag = signal('');
  defaultCost = signal('');

  currencySymbol = computed(() => resolveCurrencySymbol(this.currency()));

  defaultCreatorLabel = computed(() => {
    const id = this.defaultCreatorId();
    if (!id) return '';
    return this.manageableCreators().find(c => c.id === id)?.handle || '';
  });

  parsedRows = computed<ParsedBulkReelRow[]>(() =>
    parseBulkReelLines(this.rawInput(), !!this.defaultCreatorId())
  );

  validRows = computed(() => this.parsedRows().filter(r => r.valid));
  invalidRows = computed(() => this.parsedRows().filter(r => !r.valid));

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['open'] || changes['preselectedCampaignId']) && this.open()) {
      const preId = this.preselectedCampaignId() || '';
      this.onSelectCampaign(preId);
    }
  }

  onSelectCampaign(cid: string): void {
    this.selectedCampaignId.set(cid || '');
    const matched = this.campaigns().find(c => c.id === cid);
    this.defaultCampaignTag.set(matched ? matched.name : '');
  }

  onCsvFileSelected(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      if (content) {
        this.rawInput.set(content);
      }
      inputEl.value = '';
    };
    reader.readAsText(file);
  }

  submitImport(): void {
    const rows = this.validRows();
    if (rows.length === 0 || rows.length > 50 || this.busy()) return;
    const parsedDefaultCost = this.defaultCost() && Number(this.defaultCost()) > 0
      ? Number(this.defaultCost())
      : null;

    this.importSubmit.emit({
      defaultCreatorId: this.defaultCreatorId() || undefined,
      defaultCampaignId: this.selectedCampaignId() || undefined,
      defaultCampaignTag: this.defaultCampaignTag().trim() || undefined,
      defaultCostQuoted: parsedDefaultCost,
      items: rows.map(r => ({
        reelUrl: r.reelUrl,
        creatorHandle: r.creatorHandle || undefined,
        title: r.title || undefined,
        costQuoted: r.costQuoted || undefined,
        campaignTag: r.campaignTag || undefined
      }))
    });
  }
}
