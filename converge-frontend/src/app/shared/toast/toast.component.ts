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
          <div class="toast-indicator">
            @if (toast.type === 'success') {
              <svg class="toast-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            } @else if (toast.type === 'error') {
              <svg class="toast-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            } @else {
              <svg class="toast-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            }
          </div>

          <div class="toast-content">
            <div class="toast-head-row">
              <span class="toast-badge">
                {{ toast.type === 'success' ? 'VERIFIED' : (toast.type === 'error' ? 'NOTICE' : 'UPDATE') }}
              </span>
              <span class="toast-title">{{ toast.title }}</span>
            </div>
            @if (toast.message) {
              <span class="toast-msg">{{ toast.message }}</span>
            }
          </div>

          <button type="button" class="toast-close" (click)="toastService.dismiss(toast.id)" aria-label="Close notification">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          <div
            class="toast-progress-bar"
            [style.animation-duration.ms]="toast.duration || 4500"
          ></div>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-viewport {
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      max-width: 480px;
      width: min(480px, calc(100vw - 32px));
      pointer-events: none;
    }

    .toast-item {
      pointer-events: auto;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      background: rgba(26, 29, 33, 0.96);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 14px;
      padding: 12px 14px 14px;
      box-shadow: 0 16px 40px -10px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.2);
      width: 100%;
      box-sizing: border-box;
      font-family: inherit;
      animation: toastDropSlide 340ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .toast-item:hover {
      transform: translateY(-1px);
      box-shadow: 0 20px 44px -8px rgba(0, 0, 0, 0.6);
    }

    .toast-item.toast-error {
      border-color: rgba(220, 84, 59, 0.4);
      background: rgba(30, 24, 25, 0.97);
    }

    .toast-item.toast-success {
      border-color: rgba(76, 130, 90, 0.4);
      background: rgba(22, 30, 25, 0.97);
    }

    .toast-item.toast-info {
      border-color: rgba(78, 130, 247, 0.4);
      background: rgba(22, 27, 36, 0.97);
    }

    @keyframes toastDropSlide {
      0% {
        opacity: 0;
        transform: translateY(-28px) scale(0.96);
      }
      70% {
        opacity: 1;
        transform: translateY(3px) scale(1.008);
      }
      100% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .toast-indicator {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .toast-success .toast-indicator {
      background: rgba(76, 130, 90, 0.25);
      color: #72D58E;
      border: 1px solid rgba(76, 130, 90, 0.45);
    }

    .toast-error .toast-indicator {
      background: rgba(220, 84, 59, 0.25);
      color: #FF8F7D;
      border: 1px solid rgba(220, 84, 59, 0.45);
    }

    .toast-info .toast-indicator {
      background: rgba(78, 130, 247, 0.25);
      color: #8EB7FF;
      border: 1px solid rgba(78, 130, 247, 0.45);
    }

    .toast-content {
      display: flex;
      flex-direction: column;
      gap: 3px;
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
      letter-spacing: 0.07em;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      line-height: 1.1;
    }

    .toast-success .toast-badge {
      background: rgba(76, 130, 90, 0.2);
      color: #72D58E;
    }

    .toast-error .toast-badge {
      background: rgba(220, 84, 59, 0.22);
      color: #FF8F7D;
    }

    .toast-info .toast-badge {
      background: rgba(78, 130, 247, 0.22);
      color: #8EB7FF;
    }

    .toast-title {
      font-size: 13px;
      font-weight: 600;
      color: #FFFFFF;
      line-height: 1.3;
    }

    .toast-msg {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.76);
      line-height: 1.45;
      word-break: break-word;
    }

    .toast-close {
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.45);
      cursor: pointer;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      transition: all 150ms ease;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .toast-close:hover {
      color: #FFFFFF;
      background: rgba(255, 255, 255, 0.12);
      transform: scale(1.08);
    }

    .toast-progress-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 2px;
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
      background: linear-gradient(90deg, #4C825A, #72D58E);
    }

    .toast-error .toast-progress-bar {
      background: linear-gradient(90deg, #DC543B, #FF8F7D);
    }

    .toast-info .toast-progress-bar {
      background: linear-gradient(90deg, #2C54A6, #8EB7FF);
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
