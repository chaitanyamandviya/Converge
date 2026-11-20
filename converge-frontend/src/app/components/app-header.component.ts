import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header
      class="sticky top-0 inset-x-0 z-40 shrink-0 w-full backdrop-blur-md transition-all duration-200 border-b"
      [ngClass]="elevated()
        ? 'bg-[#1c1c1c]/95 border-white/[0.14]'
        : 'bg-[#1c1c1c]/85 border-transparent'">
      <div class="h-[60px] w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 flex items-center justify-between gap-4">
        <div class="flex items-center gap-4 min-w-0">
          <a [routerLink]="brandLink()" class="flex items-center gap-2.5 shrink-0 group">
            <img src="/converge-logo.svg" alt="Converge" class="w-7 h-7 object-contain shrink-0 transition-transform duration-300 group-hover:-rotate-6"/>
            <span class="font-headline text-2xl sm:text-[1.75rem] font-bold tracking-[0.02em] uppercase text-[#fff6e8] leading-none group-hover:text-[#f54e26] transition-colors">
              CONVERGE
            </span>
          </a>
          <ng-content select="[header-left]"></ng-content>
        </div>

        <div class="flex items-center gap-4 sm:gap-6 shrink-0">
          <ng-content select="[header-right]"></ng-content>
        </div>
      </div>
    </header>
  `
})
export class AppHeaderComponent {
  brandLink = input<string>('/');
  elevated = input<boolean>(false);
}
