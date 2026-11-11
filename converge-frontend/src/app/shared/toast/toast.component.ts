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
        <div class="toast-item" [ngClass]="'toast-' + toast.type" role="alert">
          <div class="toast-header-row">
            <div class="toast-app-info">
              <span class="toast-app-icon">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </span>
              <span class="toast-app-name">CONVERGE</span>
              <span class="toast-time-dot">•</span>
              <span class="toast-time-label">now</span>
            </div>
            <button type="button" class="toast-close" (click)="toastService.dismiss(toast.id)" aria-label="Close notification">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="toast-body">
            <div class="toast-status-icon">
              @if (toast.type === 'success') {
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34C759" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              } @else if (toast.type === 'error') {
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              } @else {
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0071E3" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
              }
            </div>
            <div class="toast-text-col">
              <span class="toast-title">{{ toast.title }}</span>
              @if (toast.message) {
                <span class="toast-msg">{{ toast.message }}</span>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-viewport {
      position: fixed;
      top: 18px;
      right: 20px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
      max-width: 350px;
      width: min(350px, calc(100vw - 32px));
      pointer-events: none;
    }

    .toast-item {
      pointer-events: auto;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      gap: 6px;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(25px) saturate(180%);
      -webkit-backdrop-filter: blur(25px) saturate(180%);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 16px;
      padding: 10px 14px 12px;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04);
      width: 100%;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", sans-serif;
      animation: macosToastSlide 340ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .toast-item:hover {
      transform: translateY(-1px);
      box-shadow: 0 14px 34px rgba(0, 0, 0, 0.12);
    }

    @keyframes macosToastSlide {
      0% {
        opacity: 0;
        transform: translateX(36px) scale(0.96);
      }
      100% {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
    }

    .toast-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      line-height: 1;
    }

    .toast-app-info {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .toast-app-icon {
      width: 16px;
      height: 16px;
      border-radius: 4px;
      background: #1D1D1F;
      color: #FFFFFF;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .toast-app-name {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: rgba(0, 0, 0, 0.55);
    }

    .toast-time-dot {
      font-size: 8px;
      color: rgba(0, 0, 0, 0.3);
    }

    .toast-time-label {
      font-size: 11px;
      color: rgba(0, 0, 0, 0.42);
      font-weight: 400;
    }

    .toast-close {
      background: rgba(0, 0, 0, 0.04);
      border: none;
      color: rgba(0, 0, 0, 0.45);
      cursor: pointer;
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 150ms ease;
      padding: 0;
    }

    .toast-close:hover {
      background: rgba(0, 0, 0, 0.1);
      color: #1D1D1F;
    }

    .toast-body {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-top: 2px;
    }

    .toast-status-icon {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.03);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .toast-text-col {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }

    .toast-title {
      font-size: 13px;
      font-weight: 600;
      color: #1D1D1F;
      line-height: 1.25;
    }

    .toast-msg {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.65);
      line-height: 1.35;
      word-break: break-word;
    }
  `]
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);
}
