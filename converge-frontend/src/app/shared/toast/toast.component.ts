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
          <div class="toast-glow"></div>

          <div class="toast-indicator">
            @if (toast.type === 'success') {
              <svg class="toast-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                <path class="draw-path" d="M20 6L9 17l-5-5"></path>
              </svg>
            } @else if (toast.type === 'error') {
              <svg class="toast-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9"></circle>
                <line class="draw-path" x1="12" y1="8" x2="12" y2="12.5"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            } @else {
              <svg class="toast-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9"></circle>
                <line class="draw-path" x1="12" y1="16" x2="12" y2="11.5"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            }
          </div>

          <div class="toast-content">
            <div class="toast-head-row">
              <span class="toast-badge">
                {{ toast.type === 'success' ? 'VERIFIED' : (toast.type === 'error' ? 'ALERT' : 'UPDATE') }}
              </span>
              <span class="toast-title">{{ toast.title }}</span>
            </div>
            @if (toast.message) {
              <span class="toast-msg">{{ toast.message }}</span>
            }
          </div>

          <button type="button" class="toast-close" (click)="toastService.dismiss(toast.id)" aria-label="Close notification">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>

          <div
            class="toast-progress-bar"
            [style.animation-duration.ms]="toast.duration || 4200"
          ></div>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-viewport {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 430px;
      width: calc(100vw - 48px);
      pointer-events: none;
    }

    .toast-item {
      pointer-events: auto;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: flex-start;
      gap: 14px;
      background: rgba(255, 255, 255, 0.97);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(36, 63, 130, 0.14);
      border-radius: 16px;
      padding: 15px 16px 18px;
      box-shadow: 0 18px 40px -8px rgba(24, 39, 75, 0.18), 0 4px 14px -2px rgba(24, 39, 75, 0.08);
      font-family: inherit;
      animation: toastSpringIn 320ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }

    .toast-item.toast-error {
      border-color: rgba(220, 86, 72, 0.35);
      animation: toastSpringIn 280ms cubic-bezier(0.22, 1, 0.36, 1) forwards, toastErrorShake 420ms 120ms ease;
    }

    .toast-item.toast-success {
      border-color: rgba(82, 126, 90, 0.35);
    }

    .toast-glow {
      position: absolute;
      top: -30px;
      left: -30px;
      width: 90px;
      height: 90px;
      border-radius: 50%;
      filter: blur(24px);
      opacity: 0.22;
      pointer-events: none;
    }

    .toast-success .toast-glow {
      background: #527E5A;
    }

    .toast-error .toast-glow {
      background: #DC5648;
    }

    .toast-info .toast-glow {
      background: #3D5EAB;
    }

    @keyframes toastSpringIn {
      from {
        opacity: 0;
        transform: translateY(20px) scale(0.94);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @keyframes toastErrorShake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      50% { transform: translateX(5px); }
      75% { transform: translateX(-3px); }
    }

    .toast-indicator {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      animation: iconPop 360ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    @keyframes iconPop {
      from { transform: scale(0.5); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    .draw-path {
      stroke-dasharray: 32;
      stroke-dashoffset: 32;
      animation: drawStroke 380ms 100ms ease-out forwards;
    }

    @keyframes drawStroke {
      to { stroke-dashoffset: 0; }
    }

    .toast-success .toast-indicator {
      background: linear-gradient(135deg, rgba(82, 126, 90, 0.18), rgba(82, 126, 90, 0.08));
      color: #3E6B46;
      border: 1px solid rgba(82, 126, 90, 0.25);
    }

    .toast-error .toast-indicator {
      background: linear-gradient(135deg, rgba(220, 86, 72, 0.18), rgba(220, 86, 72, 0.08));
      color: #C83E30;
      border: 1px solid rgba(220, 86, 72, 0.25);
    }

    .toast-info .toast-indicator {
      background: linear-gradient(135deg, rgba(61, 94, 171, 0.18), rgba(61, 94, 171, 0.08));
      color: #243F82;
      border: 1px solid rgba(61, 94, 171, 0.25);
    }

    .toast-content {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      min-width: 0;
    }

    .toast-head-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .toast-badge {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.08em;
      padding: 2px 6px;
      border-radius: 999px;
    }

    .toast-success .toast-badge {
      background: rgba(82, 126, 90, 0.15);
      color: #3E6B46;
    }

    .toast-error .toast-badge {
      background: rgba(220, 86, 72, 0.15);
      color: #C83E30;
    }

    .toast-info .toast-badge {
      background: rgba(61, 94, 171, 0.14);
      color: #243F82;
    }

    .toast-title {
      font-size: 13.5px;
      font-weight: 700;
      color: #1E293B;
      line-height: 1.3;
    }

    .toast-msg {
      font-size: 12.5px;
      color: #475569;
      line-height: 1.45;
      word-break: break-word;
    }

    .toast-close {
      background: transparent;
      border: none;
      color: #94A3B8;
      cursor: pointer;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      transition: all 150ms ease;
      flex-shrink: 0;
    }

    .toast-close:hover {
      color: #1E293B;
      background: rgba(36, 63, 130, 0.08);
      transform: rotate(90deg);
    }

    .toast-progress-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      width: 100%;
      transform-origin: left center;
      animation-name: toastProgressShrink;
      animation-timing-function: linear;
      animation-fill-mode: forwards;
    }

    .toast-item:hover .toast-progress-bar {
      animation-play-state: paused;
    }

    .toast-success .toast-progress-bar {
      background: linear-gradient(90deg, #527E5A, #77A880);
    }

    .toast-error .toast-progress-bar {
      background: linear-gradient(90deg, #DC5648, #F08070);
    }

    .toast-info .toast-progress-bar {
      background: linear-gradient(90deg, #243F82, #6395EE);
    }

    @keyframes toastProgressShrink {
      from { transform: scaleX(1); }
      to { transform: scaleX(0); }
    }
  `]
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);
}
