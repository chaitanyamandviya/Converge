import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Agency } from '../services/api.service';

@Component({
  selector: 'app-agency-details-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (agency(); as ag) {
      <div class="fixed inset-0 z-50 bg-cv-backdrop backdrop-blur-xs flex items-center justify-center p-4 animate-pop-in" (click)="close.emit()">
        <div class="bg-cv-card rounded-[6px] max-w-lg w-full p-6 border border-cv-border-strong shadow-[6px_6px_0px_#f54e26] space-y-5" (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="flex items-start justify-between gap-3 pb-4 border-b border-cv-border-soft">
            <div class="flex items-center gap-3.5 min-w-0">
              <div class="w-12 h-12 rounded-[4px] bg-[#5738af] text-[#fff6e8] font-headline font-bold text-xl flex items-center justify-center shrink-0">
                {{ ag.monogram }}
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="font-headline uppercase text-2xl font-bold text-cv-ink tracking-[0.02em] truncate leading-none">{{ ag.name }}</h3>
                  <span class="px-2 py-0.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wide"
                        [ngClass]="ag.status === 'DRAFT' ? 'bg-[#fabf29] text-[#111111]' : 'bg-[#007656] text-[#fff6e8]'">
                    {{ ag.status === 'DRAFT' ? 'Draft' : 'Connected' }}
                  </span>
                </div>
                <p class="text-xs text-cv-ink-muted mt-1">{{ ag.handle }} • {{ ag.roleBadge || 'Partner Agency' }}</p>
              </div>
            </div>
            <button type="button" (click)="close.emit()" class="w-8 h-8 rounded-[4px] hover:bg-cv-hover-pill flex items-center justify-center text-cv-ink-muted hover:text-cv-ink cursor-pointer shrink-0">✕</button>
          </div>

          <!-- Agency Manager Details -->
          <div class="bg-cv-well rounded-[4px] border border-cv-border divide-y divide-cv-divide-soft">
            <div class="px-4 py-2.5 flex items-center justify-between">
              <span class="font-headline uppercase text-sm font-bold text-[#f54e26] tracking-[0.03em]">AGENCY MANAGER</span>
              @if (ag.connectedAt) {
                <span class="text-[11px] text-cv-ink-muted">Added {{ ag.connectedAt | date:'MMM d, y' }}</span>
              }
            </div>
            <div class="px-4 py-3 flex items-center justify-between gap-3 text-xs">
              <span class="text-cv-ink-muted">Manager name</span>
              <span class="font-semibold text-cv-ink truncate">{{ ag.contactName || 'Not set' }}</span>
            </div>
            <div class="px-4 py-3 flex items-center justify-between gap-3 text-xs">
              <span class="text-cv-ink-muted">Manager email</span>
              @if (ag.contactEmail) {
                <a [href]="'mailto:' + ag.contactEmail" class="font-medium text-cv-ink hover:text-[#f54e26] truncate transition-colors">{{ ag.contactEmail }}</a>
              } @else {
                <span class="text-cv-ink-subtle">Not set</span>
              }
            </div>
            <div class="px-4 py-3 flex items-center justify-between gap-3 text-xs">
              <span class="text-cv-ink-muted">Contact number</span>
              @if (ag.contactNumber) {
                <a [href]="'tel:' + ag.contactNumber" class="font-medium text-cv-ink hover:text-[#f54e26] tabular-nums transition-colors">{{ ag.contactNumber }}</a>
              } @else {
                <span class="text-cv-ink-subtle">Not set</span>
              }
            </div>
          </div>

          <!-- Stats & Scope -->
          <div class="grid grid-cols-2 gap-3 tabular-nums">
            <div class="px-4 py-3 rounded-[4px] bg-cv-well border border-cv-border-soft">
              <span class="text-[11px] text-cv-ink-muted block">Linked Creators</span>
              <span class="font-headline text-2xl font-bold text-cv-ink leading-tight">{{ ag.creatorsCount }}</span>
            </div>
            <div class="px-4 py-3 rounded-[4px] bg-cv-well border border-cv-border-soft">
              <span class="text-[11px] text-cv-ink-muted block">Tracked Reels</span>
              <span class="font-headline text-2xl font-bold text-cv-green leading-tight">{{ ag.auditedReelsCount }}</span>
            </div>
          </div>

          @if (ag.scopeDescription) {
            <p class="text-xs text-cv-ink-muted leading-relaxed">{{ ag.scopeDescription }}</p>
          }

          <!-- Actions -->
          <div class="pt-4 border-t border-cv-border-soft flex flex-wrap items-center justify-between gap-2.5">
            @if (canManage()) {
              <button type="button" (click)="remove.emit(ag)"
                      class="h-9 px-3.5 rounded-[4px] bg-cv-danger-bg hover:bg-cv-danger-hover border border-[#ff5c5c]/40 text-cv-danger-ink text-xs font-medium cursor-pointer transition-colors">
                Remove Agency
              </button>
            } @else {
              <span></span>
            }

            <div class="flex flex-wrap items-center gap-2">
              @if (showFilterCreators()) {
                <button type="button" (click)="filterCreators.emit(ag)"
                        class="h-9 px-3.5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border text-xs font-medium text-cv-ink cursor-pointer transition-colors">
                  View Creators
                </button>
              }
              @if (canManage()) {
                @if (ag.status === 'DRAFT') {
                  <button type="button" (click)="activate.emit(ag)"
                          class="h-9 px-3.5 rounded-[4px] bg-[#007656] hover:bg-[#008d67] text-[#fff6e8] text-xs font-semibold cursor-pointer transition-colors">
                    Activate
                  </button>
                }
                <button type="button" (click)="edit.emit(ag)"
                        class="h-9 px-5 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase tracking-[0.03em] text-base font-bold cursor-pointer transition-colors">
                  EDIT AGENCY ↗
                </button>
              } @else {
                <button type="button" (click)="close.emit()"
                        class="h-9 px-5 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase tracking-[0.03em] text-base font-bold cursor-pointer transition-colors">
                  CLOSE
                </button>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class AgencyDetailsModalComponent {
  agency = input<Agency | null>(null);
  showFilterCreators = input<boolean>(false);
  canManage = input<boolean>(true);

  close = output<void>();
  edit = output<Agency>();
  activate = output<Agency>();
  filterCreators = output<Agency>();
  remove = output<Agency>();
}
