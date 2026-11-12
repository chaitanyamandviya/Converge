import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-viewport" aria-live="polite" aria-atomic="true">
      @for (toast of toastService.toasts(); track toast.id) {
        <div 
          class="toast-island-pill w-fit max-w-[min(540px,calc(100vw-32px))] bg-white/95 backdrop-blur-md text-[#191919] border border-neutral-200/80 rounded-full px-4 py-2 shadow-lg shadow-neutral-900/5 hover:shadow-xl transition-all flex items-center gap-3 select-none"
          [attr.data-type]="toast.type"
          role="status">

          <!-- Pulsing Status Glow Dot & Title -->
          <div class="flex items-center gap-2 flex-shrink-0">
            <span class="relative flex h-2.5 w-2.5 flex-shrink-0">
              <span 
                class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70"
                [ngClass]="{
                  'bg-[#34A853]': toast.type === 'success',
                  'bg-[#EA4335]': toast.type === 'error',
                  'bg-[#FBBC05]': toast.type === 'warning',
                  'bg-[#4285F4]': toast.type === 'info'
                }"></span>
              <span 
                class="relative inline-flex rounded-full h-2.5 w-2.5"
                [ngClass]="{
                  'bg-[#34A853] shadow-[0_0_8px_rgba(52,168,83,0.6)]': toast.type === 'success',
                  'bg-[#EA4335] shadow-[0_0_8px_rgba(234,67,53,0.5)]': toast.type === 'error',
                  'bg-[#FBBC05] shadow-[0_0_8px_rgba(251,188,5,0.6)]': toast.type === 'warning',
                  'bg-[#4285F4] shadow-[0_0_8px_rgba(66,133,244,0.5)]': toast.type === 'info'
                }"></span>
            </span>
            <span class="font-label-md text-label-md font-semibold text-[#191919] whitespace-nowrap">{{ toast.title }}</span>
          </div>

          <!-- Divider & Message Description -->
          @if (toast.message) {
            <span class="w-1 h-1 rounded-full bg-neutral-300 flex-shrink-0"></span>
            <span 
              class="font-label-sm text-label-sm text-neutral-600 truncate max-w-[200px] sm:max-w-[340px]" 
              [title]="toast.message">
              {{ toast.message }}
            </span>
          }

          <!-- Micro Close Button -->
          <button 
            type="button" 
            (click)="toastService.dismiss(toast.id)" 
            class="w-5 h-5 rounded-full bg-neutral-100 hover:bg-neutral-200/90 text-neutral-400 hover:text-neutral-700 transition-colors flex items-center justify-center flex-shrink-0 ml-0.5 cursor-pointer border-0 p-0" 
            aria-label="Close notification">
            <span class="material-symbols-outlined text-[12px] leading-none select-none">close</span>
          </button>

        </div>
      }
    </div>
  `,
  styles: [`
    .toast-viewport {
      position: fixed;
      top: 80px;
      right: 24px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
      pointer-events: none;
      max-width: calc(100vw - 32px);
    }

    @media (max-width: 640px) {
      .toast-viewport {
        top: 72px;
        right: 16px;
        left: 16px;
        align-items: center;
      }
    }

    .toast-island-pill {
      pointer-events: auto;
      animation: islandPillEntrance 260ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease, opacity 0.2s ease;
    }

    .toast-island-pill:hover {
      transform: translateY(-1.5px) scale(1.015);
      box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.12), 0 4px 12px -2px rgba(0, 0, 0, 0.06);
    }

    @keyframes islandPillEntrance {
      0% {
        opacity: 0;
        transform: translateY(-16px) scale(0.92);
      }
      100% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
  `]
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);
}
