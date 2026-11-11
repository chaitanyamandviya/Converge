import { Injectable, signal } from '@angular/core';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  detail?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'primary' | 'warning' | 'danger';
}

interface ActiveConfirmState extends ConfirmDialogOptions {
  resolve: (confirmed: boolean) => void;
}

@Injectable({
  providedIn: 'root',
})
export class ConfirmService {
  readonly activeDialog = signal<ActiveConfirmState | null>(null);

  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    const existing = this.activeDialog();
    if (existing) {
      existing.resolve(false);
    }

    return new Promise<boolean>((resolve) => {
      this.activeDialog.set({
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        variant: 'primary',
        ...options,
        resolve,
      });
    });
  }

  accept(): void {
    const current = this.activeDialog();
    if (current) {
      this.activeDialog.set(null);
      current.resolve(true);
    }
  }

  cancel(): void {
    const current = this.activeDialog();
    if (current) {
      this.activeDialog.set(null);
      current.resolve(false);
    }
  }
}
