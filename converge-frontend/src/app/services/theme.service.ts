import { Injectable, effect, signal } from '@angular/core';

export type AppTheme = 'dark' | 'light';

const STORAGE_KEY = 'converge-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<AppTheme>(this.readInitialTheme());

  constructor() {
    effect(() => {
      const current = this.theme();
      this.applyToDocument(current);
      this.persistTheme(current);
    });
  }

  toggle(): void {
    this.theme.update(t => (t === 'dark' ? 'light' : 'dark'));
  }

  setTheme(next: AppTheme): void {
    this.theme.set(next);
  }

  private readInitialTheme(): AppTheme {
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch {
      // Ignore storage access errors in restricted frames
    }
    return 'dark';
  }

  private persistTheme(theme: AppTheme): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, theme);
      }
    } catch {
      // Ignore storage access errors
    }
  }

  private applyToDocument(theme: AppTheme): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
  }
}
