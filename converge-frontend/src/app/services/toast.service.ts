import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  readonly toasts = signal<ToastMessage[]>([]);
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  show(toast: Omit<ToastMessage, 'id'>): void {
    const duration = toast.duration ?? (toast.type === 'error' ? 6000 : 4200);

    // Deduplicate identical active toasts so rapid clicks never stack duplicate banners
    const existing = this.toasts().find(
      t => t.type === toast.type && t.title === toast.title && t.message === toast.message
    );
    if (existing) {
      this.scheduleDismiss(existing.id, duration);
      return;
    }

    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastMessage = { ...toast, id, duration };

    // Keep at most 3 toasts visible at once (Hick's Law / clean viewport)
    this.toasts.update(current => [newToast, ...current].slice(0, 3));
    this.scheduleDismiss(id, duration);
  }

  private scheduleDismiss(id: string, duration: number): void {
    const prev = this.timers.get(id);
    if (prev) {
      clearTimeout(prev);
    }
    if (duration > 0) {
      const handle = setTimeout(() => this.dismiss(id), duration);
      this.timers.set(id, handle);
    }
  }

  success(title: string, message?: string): void {
    this.show({ type: 'success', title, message, duration: 4200 });
  }

  error(title: string, message?: string): void {
    this.show({ type: 'error', title, message, duration: 6000 });
  }

  info(title: string, message?: string): void {
    this.show({ type: 'info', title, message, duration: 4200 });
  }

  warning(title: string, message?: string): void {
    this.show({ type: 'warning', title, message, duration: 4800 });
  }

  dismiss(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.toasts.update(current => current.filter(t => t.id !== id));
  }
}
