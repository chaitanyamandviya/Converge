import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-legal',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="bg-background font-body text-on-surface min-h-screen flex flex-col justify-between overflow-x-hidden">
      <header class="fixed top-0 inset-x-0 z-50 bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div class="h-16 sm:h-20 w-full px-4 sm:px-margin max-w-7xl mx-auto flex items-center justify-between gap-4">
          <a routerLink="/" class="flex items-center gap-2.5 text-primary shrink-0">
            <img src="/converge-logo.png" alt="Converge" class="w-8 h-8 rounded-full object-contain shrink-0"/>
            <span class="font-headline text-lg sm:text-xl text-ink-primary font-bold tracking-tight">Converge</span>
          </a>
          <div class="flex items-center gap-2 sm:gap-3 shrink-0">
            <a routerLink="/auth" [queryParams]="{mode: 'signin'}" class="px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-semibold text-on-surface-variant hover:text-on-surface whitespace-nowrap">Sign In</a>
            <a routerLink="/auth" [queryParams]="{mode: 'signup'}" class="h-9 sm:h-10 px-4 sm:px-6 rounded-full bg-primary text-on-primary text-xs sm:text-sm font-semibold flex items-center justify-center hover:bg-primary-container transition-all whitespace-nowrap">Get Started</a>
          </div>
        </div>
      </header>

      <main class="w-full pt-24 pb-20 px-4 sm:px-margin max-w-7xl mx-auto flex-1">
        <div class="flex flex-col items-start gap-4 max-w-3xl">
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-soft text-primary text-xs font-semibold">
              <span class="material-symbols-outlined text-[16px]">verified_user</span>
              Legal &amp; Transparency
            </span>
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-ink-secondary text-xs font-semibold">
              <span class="w-1.5 h-1.5 rounded-full bg-mint-green"></span>
              Last updated: November 2026
            </span>
          </div>
          <h1 class="font-headline text-3xl sm:text-4xl font-bold text-ink-primary tracking-tight">Trust, by Design.</h1>
          <p class="text-base sm:text-lg text-ink-secondary leading-relaxed max-w-2xl">
            We built Converge around zero credentials, public-only metric extraction, and tamper-proof client transparency.
          </p>

          <div class="w-full pt-2 flex flex-wrap items-center justify-between gap-4">
            <div class="inline-flex items-center p-1.5 bg-surface-container-soft rounded-full">
              <button
                (click)="activeTab.set('privacy')"
                class="px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer"
                [ngClass]="activeTab() === 'privacy' ? 'bg-primary text-on-primary shadow-sm' : 'text-ink-secondary hover:text-ink-primary'">
                <span class="material-symbols-outlined text-[18px]">privacy_tip</span>
                <span>Privacy Policy</span>
              </button>
              <button
                (click)="activeTab.set('terms')"
                class="px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer"
                [ngClass]="activeTab() === 'terms' ? 'bg-primary text-on-primary shadow-sm' : 'text-ink-secondary hover:text-ink-primary'">
                <span class="material-symbols-outlined text-[18px]">gavel</span>
                <span>Terms of Service</span>
              </button>
            </div>
            <div class="flex items-center gap-2">
              <button (click)="printDoc()" class="h-10 px-4 rounded-full bg-surface-container-soft hover:bg-surface-container text-ink-secondary hover:text-ink-primary flex items-center gap-2 cursor-pointer text-xs font-semibold">
                <span class="material-symbols-outlined text-[18px]">print</span>
                <span>Print</span>
              </button>
              <button (click)="copyLink()" class="h-10 px-4 rounded-full bg-surface-container-soft hover:bg-surface-container text-ink-secondary hover:text-ink-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                <span class="material-symbols-outlined text-[18px]">share</span>
                <span>{{ copied() ? 'Copied!' : 'Share Policy' }}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <aside class="hidden lg:block lg:col-span-4 sticky top-28">
            <div class="p-6 rounded-3xl bg-surface-warm flex flex-col gap-3">
              <div class="flex items-center justify-between pb-2">
                <span class="text-xs font-semibold uppercase tracking-wider text-ink-secondary">On this document</span>
                <span class="text-xs px-2.5 py-0.5 rounded-full bg-blue-container text-primary font-semibold">
                  {{ activeTab() === 'privacy' ? 'Privacy Policy' : 'Terms of Service' }}
                </span>
              </div>
              @for (item of currentSections(); track item.id; let i = $index) {
                <a [href]="'#' + item.id" class="flex items-center gap-2.5 px-3.5 py-2 rounded-full text-ink-secondary hover:text-ink-primary hover:bg-surface-container text-xs font-semibold transition-all">
                  <span class="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-xs">0{{ i + 1 }}</span>
                  <span>{{ item.title }}</span>
                </a>
              }
            </div>
          </aside>

          <div class="lg:col-span-8 space-y-6">
            @for (item of currentSections(); track item.id; let i = $index) {
              <section [id]="item.id" class="p-6 sm:p-7 rounded-3xl bg-surface-container-lowest border border-surface-container-high/60 shadow-sm">
                <span class="text-xs text-primary uppercase tracking-wider font-bold">Section 0{{ i + 1 }}</span>
                <h2 class="font-headline text-xl sm:text-2xl font-bold text-ink-primary mt-1 mb-3">{{ item.title }}</h2>
                <p class="text-sm sm:text-base text-ink-secondary leading-relaxed">{{ item.body }}</p>
              </section>
            }
          </div>
        </div>
      </main>

      <footer class="w-full bg-surface-container-low py-6 border-t border-outline-variant/15">
        <div class="max-w-7xl mx-auto px-4 sm:px-margin flex flex-col sm:flex-row items-center justify-between gap-2 text-ink-secondary text-xs">
          <span>© 2026 Converge. All rights reserved.</span>
          <a routerLink="/" class="text-primary hover:underline font-semibold">Return to Home</a>
        </div>
      </footer>
    </div>
  `
})
export class LegalComponent implements OnInit {
  activeTab = signal<'privacy' | 'terms'>('privacy');
  copied = signal(false);

  privacySections = [
    { id: 'p1', title: 'Zero Credentials Setup', body: 'Converge never requests, collects, or stores creator Instagram passwords, Facebook Business tokens, or private account credentials. Verification operates exclusively via public Reel identifiers and authorized brand-level API handshakes.' },
    { id: 'p2', title: 'Public Reel Extraction', body: 'When a public Instagram Reel URL is submitted, Converge retrieves publicly accessible engagement metrics (views, likes, comments, timestamps) and records an immutable verification snapshot.' },
    { id: 'p3', title: 'Tamper-Proof Snapshots', body: 'Every audited deliverable and creator affiliation is hashed with SHA-256 ledger seals so brands and agencies can prove metric authenticity without manual screenshots.' },
    { id: 'p4', title: 'No Resale & Encryption', body: 'We never sell creator, brand, or agency analytics to third parties. All data in transit and at rest is encrypted using TLS 1.3 and AES-256.' }
  ];

  termsSections = [
    { id: 't1', title: 'Permitted Agency Use', body: 'Authorized agencies and brand managers may use Converge solely to verify deliverables for active creator collaborations and share verified reports with stakeholders.' },
    { id: 't2', title: 'Zero Scraping Policy', body: 'Users may not attempt to bypass rate limits, extract private user data, or use Converge for unauthorized automated harvesting.' },
    { id: 't3', title: 'Snapshot Integrity', body: 'Audit certificates and exported CSV reports reflect real-time verified Meta Graph API payloads at the time of sync.' },
    { id: 't4', title: 'Service Availability & SLA', body: 'Converge maintains 99.8% API uptime and automated webhook health monitoring across all enterprise brand workspaces.' }
  ];

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(p => {
      if (p['tab'] === 'terms' || p['tab'] === 'privacy') {
        this.activeTab.set(p['tab']);
      }
    });
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
