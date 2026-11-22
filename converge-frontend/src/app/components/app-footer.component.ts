import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <footer class="shrink-0 w-full bg-cv-canvas border-t border-cv-border-soft transition-colors">
      <div class="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-cv-ink-muted text-xs font-body">
        <p>© 2026 Converge</p>
        <div class="flex items-center gap-5">
          @if (showHomeLink()) {
            <a routerLink="/" class="hover:text-cv-ink transition-colors">Home</a>
          }
          <a routerLink="/legal" [queryParams]="{tab: 'privacy'}" class="hover:text-cv-ink transition-colors">Privacy Policy</a>
          <a routerLink="/legal" [queryParams]="{tab: 'terms'}" class="hover:text-cv-ink transition-colors">Terms of Service</a>
        </div>
      </div>
    </footer>
  `
})
export class AppFooterComponent {
  showHomeLink = input<boolean>(false);
}
