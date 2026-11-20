import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AppHeaderComponent } from '../components/app-header.component';
import { AppFooterComponent } from '../components/app-footer.component';

@Component({
  selector: 'app-legal',
  standalone: true,
  imports: [CommonModule, RouterLink, AppHeaderComponent, AppFooterComponent],
  template: `
    <div class="bg-background font-body text-on-surface min-h-screen flex flex-col justify-between overflow-x-clip selection:bg-blue-container selection:text-ink-primary">
      <app-header>
        <span header-left class="hidden sm:inline-flex px-2.5 py-0.5 rounded-full bg-surface-container-soft text-ink-secondary text-[11px] font-semibold">
          Legal &amp; Trust
        </span>

        <div header-right class="flex items-center gap-2 shrink-0">
          <a routerLink="/" class="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-surface-container-high bg-surface-container-lowest hover:bg-surface-container-low text-ink-secondary hover:text-ink-primary text-xs font-semibold active:scale-95 transition-all whitespace-nowrap group">
            <svg class="w-3.5 h-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>
            </svg>
            <span class="hidden sm:inline">Back to Home</span>
            <span class="sm:hidden">Home</span>
          </a>
          @if (auth.isAuthenticated()) {
            <a [routerLink]="auth.currentUser()?.role === 'SYSTEM_ADMIN' ? '/admin' : '/workspace'"
               class="cta-pill-orange btn-shimmer inline-flex items-center justify-center h-8 px-4 rounded-full text-on-primary text-xs font-bold active:scale-95 transition-all whitespace-nowrap">
              {{ auth.currentUser()?.role === 'SYSTEM_ADMIN' ? 'Admin Console' : 'Open Workspace' }}
            </a>
          } @else {
            <a routerLink="/auth" [queryParams]="{mode: 'signin'}" class="inline-flex items-center justify-center h-8 px-3 rounded-full text-xs font-semibold text-ink-secondary hover:text-ink-primary hover:bg-surface-container-soft active:scale-95 transition-all whitespace-nowrap">
              Sign In
            </a>
            <a routerLink="/auth" [queryParams]="{mode: 'signup'}" class="cta-pill-orange btn-shimmer inline-flex items-center justify-center h-8 px-4 rounded-full text-on-primary text-xs font-bold active:scale-95 transition-all whitespace-nowrap">
              Get Started
            </a>
          }
        </div>
      </app-header>

      <main class="w-full py-8 sm:py-10 max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 flex-1">
        <div class="flex flex-col items-start gap-3 max-w-4xl">
          <h1 class="font-headline uppercase text-4xl sm:text-5xl font-bold text-ink-primary tracking-[0.015em]">PRIVACY &amp; TERMS</h1>
          <p class="text-sm sm:text-base text-ink-secondary leading-relaxed max-w-2xl">
            Plain rules for how Converge handles creator links, campaign reports, and your workspace data.
          </p>

          <div class="w-full pt-2 flex flex-wrap items-center justify-between gap-3">
            <div class="inline-flex items-center gap-1 p-1 bg-surface-container-low border border-surface-container-high/70 rounded-full">
              <button
                type="button"
                (click)="switchTab('privacy')"
                class="h-8 px-4 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                [ngClass]="activeTab() === 'privacy' ? 'bg-primary text-on-primary shadow-2xs' : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-container/60'">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 3.5l7 2.8v5.2c0 4.6-3 8.1-7 9.5-4-1.4-7-4.9-7-9.5V6.3l7-2.8z"/>
                </svg>
                <span>Privacy Policy</span>
              </button>
              <button
                type="button"
                (click)="switchTab('terms')"
                class="h-8 px-4 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                [ngClass]="activeTab() === 'terms' ? 'bg-primary text-on-primary shadow-2xs' : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-container/60'">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 4l6 6-8 8-6-6 8-8z"/><path d="M4 20h10"/>
                </svg>
                <span>Terms of Service</span>
              </button>
            </div>

            <div class="flex items-center gap-2">
              <button type="button" (click)="printDoc()" class="h-8.5 px-3.5 rounded-full bg-surface-container-lowest border border-surface-container-high hover:bg-surface-cream text-ink-secondary hover:text-ink-primary flex items-center gap-1.5 cursor-pointer text-xs font-semibold transition-colors">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M6 9V4h12v5"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M6 15h12v5H6z"/>
                </svg>
                <span>Print</span>
              </button>
              <button type="button" (click)="copyLink()" class="h-8.5 px-3.5 rounded-full bg-surface-container-lowest border border-surface-container-high hover:bg-surface-cream text-ink-secondary hover:text-ink-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/>
                  <path d="M8.3 13.2l7.4 4.6M15.7 6.2l-7.4 4.6"/>
                </svg>
                <span>{{ copied() ? 'Copied!' : 'Share Policy' }}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-start">
          <aside class="hidden lg:block lg:col-span-4 xl:col-span-3 sticky top-20">
            <div class="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container-high/80 shadow-2xs flex flex-col gap-2">
              <div class="flex items-center justify-between pb-2 border-b border-surface-container-high/60 mb-1">
                <span class="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">On this document</span>
                <span class="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-container text-primary font-semibold">
                  {{ activeTab() === 'privacy' ? 'Privacy Policy' : 'Terms of Service' }}
                </span>
              </div>
              @for (item of currentSections(); track item.id; let i = $index) {
                <button
                  type="button"
                  (click)="scrollToSection(item.id)"
                  class="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer"
                  [ngClass]="activeSectionId() === item.id ? 'bg-blue-container/70 text-primary' : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-warm'">
                  <span class="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                        [ngClass]="activeSectionId() === item.id ? 'bg-primary text-on-primary' : 'bg-surface-container text-ink-primary'">
                    0{{ i + 1 }}
                  </span>
                  <span class="truncate">{{ item.title }}</span>
                </button>
              }
            </div>
          </aside>

          <div class="lg:col-span-8 xl:col-span-9 space-y-4">
            @for (item of currentSections(); track item.id; let i = $index) {
              <section [id]="item.id" class="scroll-mt-20 p-5 sm:p-6 rounded-3xl bg-surface-container-lowest border border-surface-container-high/80 shadow-2xs">
                <span class="text-[11px] text-primary uppercase tracking-wider font-bold">Section 0{{ i + 1 }}</span>
                <h2 class="font-headline text-lg sm:text-xl font-bold text-ink-primary mt-1 mb-2">{{ item.title }}</h2>
                <p class="text-sm text-ink-secondary leading-relaxed">{{ item.body }}</p>
              </section>
            }
          </div>
        </div>
      </main>

      <app-footer [showHomeLink]="true"></app-footer>
    </div>
  `
})
export class LegalComponent implements OnInit {
  readonly auth = inject(AuthService);

  activeTab = signal<'privacy' | 'terms'>('privacy');
  activeSectionId = signal<string>('p1');
  copied = signal(false);

  privacySections = [
    { id: 'p1', title: 'Zero Private Logins', body: 'Converge never asks for or stores creator Instagram passwords or private inbox access. Everything works using public Reel links and authorized brand workspaces.' },
    { id: 'p2', title: 'Public Reel Insights', body: 'When a public Instagram Reel URL is added, Converge gathers publicly available engagement numbers (views, likes, comments, saves, and publish time) into a clean report.' },
    { id: 'p3', title: 'Tamper-Proof Reports', body: 'Every campaign deliverable and creator affiliation is recorded cleanly with its update history so brands and agencies can review results without manual screenshots.' },
    { id: 'p4', title: 'Strict Privacy Protection', body: 'We never sell creator, brand, or agency analytics to third parties. All workspace traffic and stored campaign records stay protected and private.' }
  ];

  termsSections = [
    { id: 't1', title: 'Permitted Agency Use', body: 'Authorized agencies and brand managers may use Converge solely to verify deliverables for active creator collaborations and share verified reports with stakeholders.' },
    { id: 't2', title: 'Fair Use Policy', body: 'Users may not attempt to bypass rate limits, collect private user data, or use Converge for unauthorized automated harvesting.' },
    { id: 't3', title: 'Report Accuracy', body: 'Shared summaries and exported CSV reports reflect verified official metrics recorded at the time of each campaign sync.' },
    { id: 't4', title: 'Service Reliability', body: 'Converge is monitored continuously to keep every brand and partner agency workspace fast, accurate, and dependable.' }
  ];

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(p => {
      if (p['tab'] === 'terms' || p['tab'] === 'privacy') {
        this.switchTab(p['tab']);
      }
    });
  }

  switchTab(tab: 'privacy' | 'terms') {
    this.activeTab.set(tab);
    this.activeSectionId.set(tab === 'privacy' ? 'p1' : 't1');
  }

  scrollToSection(id: string) {
    this.activeSectionId.set(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  currentSections() {
    return this.activeTab() === 'privacy' ? this.privacySections : this.termsSections;
  }

  printDoc() {
    window.print();
  }

  copyLink() {
    navigator.clipboard?.writeText(window.location.href);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }
}
