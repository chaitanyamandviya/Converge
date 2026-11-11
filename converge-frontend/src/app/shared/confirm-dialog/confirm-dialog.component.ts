import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmService } from '../../services/confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (confirmService.activeDialog(); as dialog) {
      <div class="confirm-backdrop" (click)="confirmService.cancel()" role="dialog" aria-modal="true">
        <div class="confirm-card" (click)="$event.stopPropagation()">
          <h3 class="confirm-title">{{ dialog.title }}</h3>
          <p class="confirm-message">{{ dialog.message }}</p>

          <div class="confirm-actions">
            <button type="button" class="btn-confirm-cancel" (click)="confirmService.cancel()">
              {{ dialog.cancelText || 'Cancel' }}
            </button>
            <button
              type="button"
              class="btn-confirm-accept"
              [ngClass]="dialog.variant || 'primary'"
              (click)="confirmService.accept()"
            >
              {{ dialog.confirmText || 'Confirm' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .confirm-backdrop {
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: rgba(18, 32, 68, 0.45);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: cfFadeIn 0.14s ease-out;
    }

    .confirm-card {
      width: 100%;
      max-width: 380px;
      background: #FFFFFF;
      border: 1px solid rgba(0, 0, 0, 0.14);
      border-radius: 14px;
      padding: 22px 24px;
      box-shadow: 0 20px 44px rgba(18, 32, 68, 0.22);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      animation: cfPopIn 0.16s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .confirm-title {
      margin: 0 0 8px 0;
      font-size: 16px;
      font-weight: 800;
      color: #0077ED;
      letter-spacing: -0.01em;
    }

    .confirm-message {
      margin: 0;
      font-size: 13.5px;
      line-height: 1.5;
      color: rgba(27, 49, 102, 0.75);
    }

    .confirm-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 20px;
    }

    .btn-confirm-cancel {
      padding: 9px 18px;
      border-radius: 999px;
      border: 1px solid rgba(0, 0, 0, 0.2);
      background: #FFFFFF;
      color: #1D1D1F;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .btn-confirm-cancel:hover {
      background: #FFFFFF;
      border-color: #0071E3;
      transform: translateY(-1px);
    }

    .btn-confirm-cancel:active {
      transform: scale(0.96) translateY(0);
    }

    .btn-confirm-accept {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 9px 20px;
      border-radius: 999px;
      border: none;
      font-size: 13px;
      font-weight: 700;
      color: #FFFFFF;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
      transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .btn-confirm-accept:hover {
      transform: translateY(-1.5px);
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
    }

    .btn-confirm-accept:active {
      transform: scale(0.96) translateY(0);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .btn-confirm-accept.primary {
      background: #0071E3;
    }

    .btn-confirm-accept.primary:hover {
      background: #0077ED;
    }

    .btn-confirm-accept.warning {
      background: #D97706;
      box-shadow: 0 4px 14px rgba(217, 119, 6, 0.25);
    }

    .btn-confirm-accept.warning:hover {
      background: #B45309;
      box-shadow: 0 6px 18px rgba(217, 119, 6, 0.35);
    }

    .btn-confirm-accept.danger {
      background: #B91C1C;
      box-shadow: 0 4px 14px rgba(185, 28, 28, 0.25);
    }

    .btn-confirm-accept.danger:hover {
      background: #991B1B;
      box-shadow: 0 6px 18px rgba(185, 28, 28, 0.35);
    }

    @keyframes cfFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes cfPopIn {
      from { opacity: 0; transform: scale(0.96) translateY(4px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
  `]
})
export class ConfirmDialogComponent {
  readonly confirmService = inject(ConfirmService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.confirmService.activeDialog()) {
      this.confirmService.cancel();
    }
  }
}
