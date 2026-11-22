import { Component, OnChanges, SimpleChanges, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Campaign, CampaignSummary } from '../services/api.service';
import { resolveCurrencySymbol } from '../utils/campaign-analytics';

export interface CampaignFormPayload {
  name: string;
  status: 'ACTIVE' | 'PLANNING' | 'COMPLETED' | 'DRAFT';
  budgetAmount: number | null;
  targetViewsGoal: number | null;
  startDate: string | null;
  endDate: string | null;
  briefNotes: string;
}

@Component({
  selector: 'app-campaign-form-modal',
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
                {{ campaign() ? 'EDIT CAMPAIGN' : 'NEW CAMPAIGN' }}
              </h3>
              <p class="text-xs text-cv-ink-muted mt-1">
                {{ campaign() ? 'Update budget, target views, timeline, or brief details.' : 'Create a campaign workspace to group creators, budgets, and Reels.' }}
              </p>
            </div>
            <button type="button" (click)="close.emit()" class="w-8 h-8 rounded-[4px] hover:bg-cv-hover-pill flex items-center justify-center text-cv-ink-muted hover:text-cv-ink cursor-pointer shrink-0">✕</button>
          </div>

          <form (ngSubmit)="submitForm()" class="overflow-y-auto pr-1 space-y-4 text-xs">
            @if (localError() || errorMsg()) {
              <div class="px-3.5 py-2.5 rounded-[4px] bg-cv-danger-bg border border-[#ff5c5c]/40 text-cv-danger-ink font-medium">
                {{ localError() || errorMsg() }}
              </div>
            }

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="sm:col-span-2">
                <label class="block font-medium text-cv-ink mb-1">Campaign Name</label>
                <input [ngModel]="name()" (ngModelChange)="name.set($event); localError.set('')" name="campName"
                       placeholder="e.g. Diwali Hero Launch" required
                       class="w-full h-10 px-3 rounded-[4px] bg-cv-well border border-cv-border-strong text-sm text-cv-ink placeholder:text-cv-ink-subtle focus:border-[#f54e26] focus:outline-none"/>
              </div>
              <div>
                <label class="block font-medium text-cv-ink mb-1">Status</label>
                <select [ngModel]="status()" (ngModelChange)="status.set($event)" name="campStatus"
                        class="w-full h-10 px-2.5 rounded-[4px] bg-cv-well border border-cv-border-strong text-xs text-cv-ink focus:border-[#f54e26] focus:outline-none">
                  <option value="ACTIVE">Active</option>
                  <option value="PLANNING">Planning</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="DRAFT">Draft (Hidden from Agencies)</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-medium text-cv-ink mb-1">Planned Budget ({{ currencySymbol() }})</label>
                <input [ngModel]="budgetAmount()" (ngModelChange)="budgetAmount.set($event)" name="campBudget"
                       type="number" min="0" step="500" placeholder="e.g. 250000"
                       class="w-full h-10 px-3 rounded-[4px] bg-cv-well border border-cv-border text-sm text-cv-ink placeholder:text-cv-ink-subtle tabular-nums focus:border-[#f54e26] focus:outline-none"/>
              </div>
              <div>
                <label class="block font-medium text-cv-ink mb-1">Views Milestone Goal</label>
                <input [ngModel]="targetViewsGoal()" (ngModelChange)="targetViewsGoal.set($event)" name="campGoal"
                       type="number" min="0" step="10000" placeholder="e.g. 1500000"
                       class="w-full h-10 px-3 rounded-[4px] bg-cv-well border border-cv-border text-sm text-cv-ink placeholder:text-cv-ink-subtle tabular-nums focus:border-[#f54e26] focus:outline-none"/>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-medium text-cv-ink mb-1">Start Date (optional)</label>
                <input [ngModel]="startDate()" (ngModelChange)="startDate.set($event); localError.set('')" name="campStart"
                       type="date"
                       class="w-full h-10 px-3 rounded-[4px] bg-cv-well border border-cv-border text-xs text-cv-ink focus:border-[#f54e26] focus:outline-none"/>
              </div>
              <div>
                <label class="block font-medium text-cv-ink mb-1">End Date (optional)</label>
                <input [ngModel]="endDate()" (ngModelChange)="endDate.set($event); localError.set('')" name="campEnd"
                       type="date"
                       class="w-full h-10 px-3 rounded-[4px] bg-cv-well border border-cv-border text-xs text-cv-ink focus:border-[#f54e26] focus:outline-none"/>
              </div>
            </div>

            <div>
              <label class="block font-medium text-cv-ink mb-1">Campaign Brief &amp; Deliverable Notes</label>
              <textarea [ngModel]="briefNotes()" (ngModelChange)="briefNotes.set($event)" name="campBrief" rows="3"
                        placeholder="Key product talking points, CTA tags, deliverable format (e.g. 1x 45s Reel + link in bio)..."
                        class="w-full p-3 rounded-[4px] bg-cv-well border border-cv-border text-xs text-cv-ink placeholder:text-cv-ink-subtle focus:border-[#f54e26] focus:outline-none leading-relaxed"></textarea>
            </div>

            <div class="pt-3 border-t border-cv-border flex items-center justify-end gap-2.5">
              <button type="button" (click)="close.emit()" class="h-10 px-4 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border-strong text-xs font-medium text-cv-ink-muted hover:text-cv-ink cursor-pointer transition-colors">
                Cancel
              </button>
              <button type="submit" [disabled]="busy()"
                      class="h-10 px-5 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase tracking-[0.03em] text-base font-bold cursor-pointer disabled:opacity-50 transition-colors">
                {{ busy() ? 'SAVING...' : (campaign() ? 'SAVE CAMPAIGN' : 'CREATE CAMPAIGN ↗') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `
})
export class CampaignFormModalComponent implements OnChanges {
  open = input<boolean>(false);
  campaign = input<Campaign | CampaignSummary | null>(null);
  currency = input<string>('INR');
  busy = input<boolean>(false);
  errorMsg = input<string>('');

  close = output<void>();
  save = output<CampaignFormPayload>();

  name = signal('');
  status = signal<'ACTIVE' | 'PLANNING' | 'COMPLETED' | 'DRAFT'>('ACTIVE');
  budgetAmount = signal('');
  targetViewsGoal = signal('');
  startDate = signal('');
  endDate = signal('');
  briefNotes = signal('');
  localError = signal('');

  currencySymbol = computed(() => resolveCurrencySymbol(this.currency()));

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] || changes['campaign']) {
      if (this.open()) {
        const c = this.campaign();
        this.localError.set('');
        this.name.set(c?.name || '');
        this.status.set((c?.status as any) || 'ACTIVE');
        this.budgetAmount.set(c?.budgetAmount && c.budgetAmount > 0 ? String(c.budgetAmount) : '');
        this.targetViewsGoal.set(c?.targetViewsGoal && c.targetViewsGoal > 0 ? String(c.targetViewsGoal) : '');
        this.startDate.set(c?.startDate || '');
        this.endDate.set(c?.endDate || '');
        this.briefNotes.set(c?.briefNotes || '');
      }
    }
  }

  submitForm(): void {
    if (this.busy()) return;
    const trimmedName = this.name().trim();
    if (trimmedName.length < 2) {
      this.localError.set('Campaign name must be at least 2 characters.');
      return;
    }
    const sd = this.startDate().trim() || null;
    const ed = this.endDate().trim() || null;
    if (sd && ed && ed < sd) {
      this.localError.set('End date cannot be earlier than start date.');
      return;
    }
    const rawBudget = String(this.budgetAmount() || '').trim();
    const budgetVal = rawBudget && Number(rawBudget) > 0 ? Number(rawBudget) : null;
    const rawGoal = String(this.targetViewsGoal() || '').trim();
    const goalVal = rawGoal && Number(rawGoal) > 0 ? Math.round(Number(rawGoal)) : null;

    this.save.emit({
      name: trimmedName,
      status: this.status(),
      budgetAmount: budgetVal,
      targetViewsGoal: goalVal,
      startDate: sd,
      endDate: ed,
      briefNotes: this.briefNotes().trim()
    });
  }
}
