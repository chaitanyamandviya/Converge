import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-pop-in" (click)="!busy() && cancel.emit()">
        <div
          class="bg-[#161616] rounded-[8px] max-w-sm w-full p-6 border border-white/[0.18] text-center"
          [ngClass]="tone() === 'danger' ? 'shadow-[6px_6px_0px_#ff5c5c]' : 'shadow-[6px_6px_0px_#f54e26]'"
          (click)="$event.stopPropagation()">
          <div
            class="w-12 h-12 mx-auto rounded-[4px] border-2 border-[#111111] shadow-[3px_3px_0px_#fff6e8] flex items-center justify-center mb-4 text-[#111111]"
            [ngClass]="tone() === 'danger' ? 'bg-[#ff5c5c]' : 'bg-[#f54e26]'">
            @if (tone() === 'danger') {
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4.5 7h15"/>
                <path d="M9.5 4.5h5a1 1 0 0 1 1 1V7h-7V5.5a1 1 0 0 1 1-1z"/>
                <path d="M6.5 7l1 12a2 2 0 0 0 2 1.8h5a2 2 0 0 0 2-1.8l1-12"/>
                <path d="M10 11v5M14 11v5"/>
              </svg>
            } @else {
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square" stroke-linejoin="miter">
                <path d="M11 4H5v16h6"/>
                <path d="M10 12h10"/>
                <path d="M16 8l4 4-4 4"/>
              </svg>
            }
          </div>
          <h3 class="font-headline uppercase text-2xl font-bold tracking-[0.02em] text-[#fff6e8]">{{ title() }}</h3>
          <p class="text-xs text-[#a7a9be] mt-1.5 leading-relaxed">{{ message() }}</p>
          <div class="flex items-center justify-center gap-2.5 mt-5">
            <button
              type="button"
              (click)="cancel.emit()"
              [disabled]="busy()"
              class="flex-1 h-10 px-4 rounded-[4px] bg-[#242424] hover:bg-[#2c2c2c] border border-white/[0.16] text-xs font-medium text-[#a7a9be] hover:text-[#fff6e8] cursor-pointer transition-colors disabled:opacity-50">
              {{ cancelLabel() }}
            </button>
            <button
              type="button"
              (click)="confirm.emit()"
              [disabled]="busy()"
              class="flex-1 h-10 px-4 rounded-[4px] font-headline uppercase tracking-[0.03em] text-lg font-bold cursor-pointer transition-colors disabled:opacity-60"
              [ngClass]="tone() === 'danger' ? 'bg-[#ff5c5c] hover:bg-[#ff7373] text-[#111111]' : 'bg-[#f54e26] hover:bg-[#ff643e] text-[#111111]'">
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
