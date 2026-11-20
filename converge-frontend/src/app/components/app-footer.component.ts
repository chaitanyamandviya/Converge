import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <footer class="shrink-0 w-full bg-[#1c1c1c] border-t border-white/[0.12]">
      <div class="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-[#a7a9be] text-xs font-body">
        <p>© 2026 Converge</p>
        <div class="flex items-center gap-5">
          @if (showHomeLink()) {
            <a routerLink="/" class="hover:text-[#fff6e8] transition-colors">Home</a>
          }
          <a routerLink="/legal" [queryParams]="{tab: 'privacy'}" class="hover:text-[#fff6e8] transition-colors">Privacy Policy</a>
          <a routerLink="/legal" [queryParams]="{tab: 'terms'}" class="hover:text-[#fff6e8] transition-colors">Terms of Service</a>
        </div>
      </div>
    </footer>
  `
})
export class AppFooterComponent {
  showHomeLink = input<boolean>(false);
}
