import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AppHeaderComponent } from '../components/app-header.component';
import { AppFooterComponent } from '../components/app-footer.component';
import { ThemeToggleComponent } from '../components/theme-toggle.component';

@Component({
  selector: 'app-legal',
  standalone: true,
  imports: [CommonModule, RouterLink, AppHeaderComponent, AppFooterComponent, ThemeToggleComponent],
  template: `
    <div class="bg-cv-canvas font-body text-cv-ink min-h-screen flex flex-col justify-between overflow-x-clip selection:bg-[#f54e26]/25 selection:text-cv-ink">
      <app-header [elevated]="true">
        <div header-right class="flex items-center gap-2.5 shrink-0">
          <a routerLink="/" class="inline-flex items-center gap-1.5 h-8.5 px-3.5 rounded-[4px] border border-cv-border bg-cv-control hover:bg-cv-control-hover text-cv-ink text-xs font-medium transition-colors whitespace-nowrap group">
            <span class="transition-transform duration-200 group-hover:-translate-x-0.5">←</span>
            <span class="hidden sm:inline">Home</span>
          </a>
          <app-theme-toggle />
          @if (auth.isAuthenticated()) {
            <a [routerLink]="auth.currentUser()?.role === 'SYSTEM_ADMIN' ? '/admin' : '/workspace'"
               class="inline-flex items-center justify-center h-8.5 px-4 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_var(--cv-shadow-ink)] font-headline uppercase tracking-[0.04em] text-sm font-bold transition-all whitespace-nowrap">
              {{ auth.currentUser()?.role === 'SYSTEM_ADMIN' ? 'ADMIN ↗' : 'WORKSPACE ↗' }}
            </a>
          } @else {
            <a routerLink="/auth" [queryParams]="{mode: 'signin'}" class="inline-flex items-center justify-center h-8.5 px-3 text-xs font-medium text-cv-ink-muted hover:text-cv-ink transition-colors whitespace-nowrap">
              Sign In
            </a>
            <a routerLink="/auth" [queryParams]="{mode: 'signup'}" class="inline-flex items-center justify-center h-8.5 px-4 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_var(--cv-shadow-ink)] font-headline uppercase tracking-[0.04em] text-sm font-bold transition-all whitespace-nowrap">
              GET STARTED ↗
            </a>
          }
        </div>
      </app-header>

      <main class="w-full py-6 sm:py-8 flex-1 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
        <div class="flex flex-col items-start gap-3 pb-5 border-b border-cv-border-soft">
          <h1 class="font-headline uppercase text-4xl sm:text-5xl font-bold text-cv-ink tracking-[0.015em] leading-none">
            PRIVACY <span class="text-[#f54e26]">&amp; TERMS</span>
          </h1>
          <p class="text-sm text-cv-ink-muted leading-relaxed max-w-2xl">
            Plain rules for how Converge handles creator links, campaign reports, and your workspace data.
          </p>

          <div class="w-full pt-2 flex flex-wrap items-center justify-between gap-3">
            <div class="inline-flex items-center gap-1 p-1 bg-cv-well border border-cv-border rounded-[4px]">
              <button
                type="button"
                (click)="switchTab('privacy')"
                class="h-8 px-4 rounded-[3px] font-headline uppercase tracking-[0.03em] text-base font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                [ngClass]="activeTab() === 'privacy' ? 'bg-cv-ink text-cv-ink-inverse' : 'text-cv-ink-muted hover:text-cv-ink'">
                <span>PRIVACY POLICY</span>
              </button>
              <button
                type="button"
                (click)="switchTab('terms')"
                class="h-8 px-4 rounded-[3px] font-headline uppercase tracking-[0.03em] text-base font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                [ngClass]="activeTab() === 'terms' ? 'bg-cv-ink text-cv-ink-inverse' : 'text-cv-ink-muted hover:text-cv-ink'">
                <span>TERMS OF SERVICE</span>
              </button>
            </div>

            <div class="flex items-center gap-2">
              <button type="button" (click)="printDoc()" class="h-8.5 px-3.5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border text-cv-ink flex items-center gap-1.5 cursor-pointer text-xs font-medium transition-colors">
                <span>Print</span>
              </button>
              <button type="button" (click)="copyLink()" class="h-8.5 px-3.5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border text-cv-ink text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors">
                <span>{{ copied() ? 'Copied ✓' : 'Copy Link' }}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <aside class="hidden lg:block lg:col-span-4 xl:col-span-3 sticky top-6">
            <div class="p-4 rounded-[4px] bg-cv-card border border-cv-border flex flex-col gap-1.5">
              <div class="flex items-center justify-between pb-2.5 border-b border-cv-border-soft mb-1">
                <span class="text-xs font-semibold text-cv-ink-muted">Sections</span>
                <span class="text-[11px] font-medium text-[#f54e26]">
                  {{ activeTab() === 'privacy' ? 'Privacy' : 'Terms' }}
                </span>
              </div>
              @for (item of currentSections(); track item.id; let i = $index) {
                <button
                  type="button"
                  (click)="scrollToSection(item.id)"
                  class="w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-[4px] text-xs font-medium transition-colors cursor-pointer"
                  [ngClass]="activeSectionId() === item.id ? 'bg-cv-ink text-cv-ink-inverse font-semibold' : 'text-cv-ink-muted hover:text-cv-ink hover:bg-cv-hover-row'">
                  <span class="font-headline font-bold shrink-0">0{{ i + 1 }}</span>
                  <span class="truncate">{{ item.title }}</span>
                </button>
              }
            </div>
          </aside>

          <div class="lg:col-span-8 xl:col-span-9 rounded-[4px] bg-cv-card border border-cv-border divide-y divide-cv-divide">
            @for (item of currentSections(); track item.id; let i = $index) {
              <section [id]="item.id" class="scroll-mt-6 p-5 sm:p-6">
                <span class="text-xs text-[#f54e26] font-semibold">0{{ i + 1 }}</span>
                <h2 class="font-headline uppercase text-2xl font-bold text-cv-ink tracking-[0.015em] mt-1 mb-2">{{ item.title }}</h2>
                <p class="text-sm text-cv-ink-muted leading-relaxed">{{ item.body }}</p>
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

  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(p => {
      if (p['tab'] === 'terms' || p['tab'] === 'privacy') {
        this.applyTab(p['tab']);
      } else {
        this.applyTab('privacy');
      }
    });
  }

  switchTab(tab: 'privacy' | 'terms') {
    if (this.activeTab() === tab) return;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab }
    });
  }

  private applyTab(tab: 'privacy' | 'terms') {
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
