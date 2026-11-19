import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 bg-ink-primary/35 backdrop-blur-xs flex items-center justify-center p-4 animate-pop-in" (click)="!busy() && cancel.emit()">
        <div class="bg-surface-container-lowest rounded-[28px] max-w-sm w-full p-6 shadow-2xl border border-surface-container-high/80 text-center" (click)="$event.stopPropagation()">
          <div
            class="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3"
            [ngClass]="tone() === 'danger' ? 'bg-coral-container/60 text-secondary' : 'bg-blue-container/70 text-primary'">
            @if (tone() === 'danger') {
              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4.5 7h15"/>
                <path d="M9.5 4.5h5a1 1 0 0 1 1 1V7h-7V5.5a1 1 0 0 1 1-1z"/>
                <path d="M6.5 7l1 12a2 2 0 0 0 2 1.8h5a2 2 0 0 0 2-1.8l1-12"/>
                <path d="M10 11v5M14 11v5"/>
              </svg>
            } @else {
              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <path d="M16 17l5-5-5-5"/>
                <path d="M21 12H9"/>
              </svg>
            }
          </div>
          <h3 class="font-headline text-lg font-bold text-ink-primary">{{ title() }}</h3>
          <p class="text-xs text-ink-secondary mt-1.5 leading-relaxed">{{ message() }}</p>
          <div class="flex items-center justify-center gap-2.5 mt-5">
            <button
              type="button"
              (click)="cancel.emit()"
              [disabled]="busy()"
              class="flex-1 h-9.5 px-4 rounded-full bg-surface-container-soft hover:bg-surface-container text-xs font-semibold text-ink-secondary cursor-pointer transition-colors disabled:opacity-50">
              {{ cancelLabel() }}
            </button>
            <button
              type="button"
              (click)="confirm.emit()"
              [disabled]="busy()"
              class="flex-1 h-9.5 px-4 rounded-full text-white text-xs font-semibold shadow-sm cursor-pointer transition-all active:scale-95 disabled:opacity-60"
              [ngClass]="tone() === 'danger' ? 'bg-secondary hover:bg-secondary-container' : 'bg-primary hover:bg-primary-container'">
              {{ busy() ? busyLabel() : confirmLabel() }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class ConfirmModalComponent {
  open = input(false);
  title = input('Confirm Action');
  message = input('');
  confirmLabel = input('Confirm');
  busyLabel = input('Working...');
  cancelLabel = input('Cancel');
  tone = input<'danger' | 'primary'>('primary');
  busy = input(false);

  confirm = output<void>();
  cancel = output<void>();
}
