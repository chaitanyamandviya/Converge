import { Component, inject } from '@angular/core';
import { ThemeService } from '../services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  template: `
    <button
      type="button"
      (click)="themeService.toggle()"
      [attr.aria-label]="themeService.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
      [title]="themeService.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
      class="h-8.5 px-2.5 sm:px-3 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border-strong text-cv-ink inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors shrink-0">
      @if (themeService.theme() === 'dark') {
        <svg class="w-3.5 h-3.5 text-cv-gold shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
        </svg>
        <span class="hidden sm:inline">Light</span>
      } @else {
        <svg class="w-3.5 h-3.5 text-[#5738af] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
        </svg>
        <span class="hidden sm:inline">Dark</span>
      }
    </button>
  `
})
export class ThemeToggleComponent {
  readonly themeService = inject(ThemeService);
}
