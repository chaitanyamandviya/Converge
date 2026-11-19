import { Component, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="bg-background font-body text-on-surface min-h-screen relative overflow-x-hidden flex flex-col">
      <!-- Interactive cursor spotlight (desktop fine pointers) -->
      <div
        class="pointer-events-none fixed top-0 left-0 w-[500px] h-[500px] -mt-[250px] -ml-[250px] rounded-full z-[1] transition-opacity duration-500 hidden lg:block"
        [style.transform]="'translate3d(' + mouseX() + 'px, ' + mouseY() + 'px, 0)'"
        style="background: radial-gradient(circle, rgba(11, 87, 208, 0.05) 0%, rgba(254, 240, 195, 0.03) 40%, transparent 70%);">
      </div>

      <!-- Scroll Progress Indicator Bar -->
      <div
        class="fixed top-0 left-0 h-[2.5px] bg-gradient-to-r from-primary via-mint-green to-secondary z-[60] transition-all duration-150 ease-out"
        [style.width.%]="scrollProgress()">
      </div>

      <!-- Header -->
      <header
        class="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl transition-all duration-300"
        [ngClass]="scrolled() ? 'shadow-[0_4px_20px_rgba(0,0,0,0.06)] bg-surface/95 border-b border-outline-variant/30' : 'bg-surface/85 border-b border-transparent shadow-[0_1px_8px_rgba(0,0,0,0.04)]'">
        <div class="h-16 sm:h-20 w-full px-4 sm:px-margin max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div class="flex items-center gap-6 lg:gap-8">
            <a routerLink="/" class="flex items-center gap-2.5 group shrink-0">
              <img src="/converge-logo.png" alt="Converge" class="w-8 h-8 rounded-full object-contain shrink-0 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300"/>
              <span class="font-headline text-lg sm:text-xl font-bold tracking-tight text-ink-primary transition-colors group-hover:text-primary">Converge</span>
            </a>
            <nav class="hidden md:flex items-center gap-6">
              <a href="#journey" class="text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors">Solutions</a>
              <a href="#reality-check" class="text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors">Features</a>
              <a href="#pillars" class="text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors">Resources</a>
            </nav>
          </div>
          <div class="flex items-center gap-2 sm:gap-4 shrink-0">
            <a routerLink="/auth" [queryParams]="{mode: 'signin'}"
               class="inline-flex items-center text-xs sm:text-sm font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-soft/60 rounded-full active:scale-95 transition-all px-3 sm:px-4 py-2 whitespace-nowrap">
              Sign In
            </a>
            <a routerLink="/auth" [queryParams]="{mode: 'signup'}"
               class="relative overflow-hidden inline-flex items-center justify-center bg-primary text-on-primary text-xs sm:text-sm font-semibold px-4 sm:px-6 py-2 sm:py-2.5 rounded-full shadow-sm hover:bg-primary-container hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-150 group whitespace-nowrap">
              <span class="relative z-10">Get Started</span>
              <span class="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"></span>
            </a>
          </div>
        </div>
      </header>

      <main class="w-full pt-16 sm:pt-20 bg-background flex-1">
        <div class="flex flex-col w-full text-ink-primary overflow-x-hidden selection:bg-marigold-container selection:text-ink-primary">

          <!-- HERO SECTION -->
          <section class="relative w-full px-4 sm:px-margin py-5 sm:py-8 flex flex-col items-center text-center">
            <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] sm:w-[620px] h-[320px] sm:h-[620px] bg-gradient-to-tr from-blue-container/30 via-marigold-container/20 to-coral-container/20 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse"></div>

            <div class="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-surface-container-soft text-ink-secondary text-xs font-semibold mb-4 hover:scale-105 hover:bg-surface-container transition-all duration-300 cursor-default">
              <span class="text-secondary-container animate-pulse">✨</span>
              <span>THE SCREENSHOT ERA IS OVER</span>
            </div>

            <h1 class="font-headline text-3xl sm:text-5xl md:text-[52px] md:leading-[58px] font-extrabold max-w-4xl tracking-tight text-ink-primary mb-3">
              Stop chasing creators for
              <span class="relative inline-block text-secondary-container">
                screenshots.
                <svg class="absolute -bottom-1.5 sm:-bottom-2 left-0 w-full overflow-visible" fill="none" viewBox="0 0 240 12">
                  <path d="M3 8.5C70 2.5 170 2 237 8" stroke="#d9372b" stroke-linecap="round" stroke-width="3.5"></path>
                </svg>
              </span>
            </h1>

            <p class="text-sm sm:text-lg text-ink-secondary max-w-2xl mb-5 leading-relaxed px-2">
              Drop the Instagram Reel link. Converge extracts verified metrics automatically.
            </p>

            <div class="relative flex items-center justify-center mb-6 sm:mb-8">
              <a routerLink="/auth" [queryParams]="{mode: 'signup'}"
                 class="relative overflow-hidden inline-flex items-center justify-center h-11 sm:h-12 px-7 sm:px-8 rounded-full bg-primary text-on-primary text-sm font-semibold shadow-md hover:bg-primary-container hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all duration-150 group">
                <span class="relative z-10 flex items-center gap-1.5 group-hover:translate-x-0.5 transition-transform duration-200">Get Started →</span>
                <span class="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none"></span>
              </a>
            </div>

            <!-- Central Interactive Orbital Stage -->
            <div
              (mousemove)="onStageMove($event)"
              (mouseleave)="onStageLeave()"
              class="relative w-full max-w-3xl h-[290px] sm:h-[340px] mx-auto flex items-center justify-center">
              <div class="absolute w-[240px] h-[240px] sm:w-[360px] sm:h-[360px] rounded-full border border-outline-variant/30 animate-pulse pointer-events-none"></div>
              <div class="absolute w-[190px] h-[190px] sm:w-[280px] sm:h-[280px] rounded-full border border-dashed border-primary/30 pointer-events-none animate-orbit"></div>
              <div class="absolute w-[145px] h-[145px] sm:w-[230px] sm:h-[230px] rounded-full border border-dotted border-mint-green/30 pointer-events-none animate-orbit-reverse"></div>
              <div class="absolute w-[110px] h-[110px] sm:w-[180px] sm:h-[180px] rounded-full border border-primary/10 pointer-events-none animate-orbit-mid"></div>

              <div class="absolute w-[190px] h-[190px] sm:w-[280px] sm:h-[280px] rounded-full pointer-events-none animate-orbit">
                <div class="absolute top-0 left-1/2 -ml-1 -mt-1 w-2 h-2 rounded-full bg-primary animate-particle"></div>
              </div>
              <div class="absolute w-[145px] h-[145px] sm:w-[230px] sm:h-[230px] rounded-full pointer-events-none animate-orbit-reverse">
                <div class="absolute bottom-0 left-1/2 -ml-1.5 -mb-1.5 w-3 h-3 rounded-full bg-mint-green/70 animate-particle"></div>
              </div>

              <!-- Badge 1 -->
              <div
                [style.transform]="'translate3d(' + (tiltX() * 8) + 'px, ' + (tiltY() * 8) + 'px, 0)'"
                class="animate-badge-1 absolute top-3 left-2 sm:top-10 sm:left-14 flex items-center gap-1.5 sm:gap-2 py-1 sm:py-1.5 px-2.5 sm:px-3.5 rounded-full bg-mint-container text-mint-green text-xs font-semibold shadow-sm hover:scale-110 transition-all duration-200 cursor-pointer select-none">
                <span class="material-symbols-outlined text-[15px] sm:text-[18px]">verified</span>
                <span class="text-ink-primary font-bold">142K Views</span>
                <span class="text-mint-green font-bold text-[11px] hidden sm:inline">+18%</span>
              </div>

              <!-- Badge 2 -->
              <div
                [style.transform]="'translate3d(' + (tiltX() * 14) + 'px, ' + (tiltY() * 14) + 'px, 0)'"
                class="animate-badge-2 absolute top-6 right-2 sm:top-14 sm:right-16 flex items-center gap-1.5 sm:gap-2 py-1 sm:py-1.5 px-2.5 sm:px-3.5 rounded-full bg-blue-container text-primary text-xs font-semibold shadow-sm hover:scale-110 transition-all duration-200 cursor-pointer select-none">
                <span class="material-symbols-outlined text-[15px] sm:text-[18px]">thumb_up</span>
                <span class="text-ink-primary font-bold">18.4K Likes</span>
              </div>

              <!-- Badge 3 -->
              <div
                [style.transform]="'translate3d(' + (tiltX() * 12) + 'px, ' + (tiltY() * 12) + 'px, 0)'"
                class="animate-badge-3 absolute bottom-6 left-2 sm:bottom-12 sm:left-20 flex items-center gap-1.5 sm:gap-2 py-1 sm:py-1.5 px-2.5 sm:px-3.5 rounded-full bg-marigold-container text-tertiary text-xs font-semibold shadow-sm hover:scale-110 transition-all duration-200 cursor-pointer select-none">
                <span class="material-symbols-outlined text-[15px] sm:text-[18px]">bolt</span>
                <span class="text-ink-primary font-bold">Instant Sync</span>
              </div>

              <!-- Badge 4 -->
              <div
                [style.transform]="'translate3d(' + (tiltX() * 10) + 'px, ' + (tiltY() * 10) + 'px, 0)'"
                class="animate-badge-4 absolute bottom-8 right-2 sm:bottom-14 sm:right-20 flex items-center gap-1.5 sm:gap-2 py-1 sm:py-1.5 px-2.5 sm:px-3.5 rounded-full bg-surface-container-soft text-ink-secondary text-xs font-semibold shadow-sm hover:scale-110 transition-all duration-200 cursor-pointer select-none">
                <span class="material-symbols-outlined text-[15px] sm:text-[18px] text-primary">chat_bubble</span>
                <span class="text-ink-primary font-bold">1.2K Comments</span>
              </div>

              <!-- Centerpiece Orb -->
              <div
                [style.transform]="'translate3d(' + (tiltX() * 6) + 'px, ' + (tiltY() * 6) + 'px, 0)'"
                class="relative z-10 flex flex-col items-center animate-engine-float">
                <div class="relative p-2 rounded-full bg-surface-container-lowest/90 backdrop-blur-md shadow-xl hover:scale-110 transition-all duration-300 cursor-pointer group">
                  <img src="/converge-logo.png" alt="Converge" class="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-contain p-2 group-hover:rotate-12 transition-transform duration-500"/>
                  <div class="animate-status-pulse absolute bottom-1 right-1 sm:bottom-1 sm:right-2 flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-mint-green text-white shadow-md">
                    <span class="material-symbols-outlined text-[14px] sm:text-[16px]">check</span>
                  </div>
                </div>
                <span class="mt-3 text-xs font-semibold text-ink-secondary tracking-wide uppercase">Real-Time Engine</span>
              </div>

              <svg class="absolute inset-0 w-full h-full pointer-events-none hidden sm:block" fill="none" viewBox="0 0 600 400">
                <path class="animate-connecting-flow" d="M120 120 C 180 180, 220 200, 270 200" stroke="#0041a2" stroke-opacity="0.3" stroke-width="1.5"></path>
                <path class="animate-connecting-flow" d="M480 140 C 420 180, 380 200, 330 200" stroke="#34a853" stroke-opacity="0.3" stroke-width="1.5"></path>
                <path class="animate-connecting-flow" d="M160 300 C 220 260, 250 230, 280 220" stroke="#fbbc05" stroke-opacity="0.4" stroke-width="1.5"></path>
              </svg>
            </div>
          </section>

          <!-- JOURNEY SECTION -->
          <section id="journey" class="relative w-full px-4 sm:px-margin py-12 sm:py-16 flex flex-col items-center">
            <div class="text-center max-w-xl mb-10">
              <span class="text-xs uppercase tracking-widest text-primary font-bold">How It Moves</span>
              <h2 class="font-headline text-2xl sm:text-3xl font-bold text-ink-primary mt-1">From Midnight Chaos to Calm</h2>
            </div>

            <div class="relative w-full max-w-4xl flex flex-col md:flex-row items-stretch md:items-start justify-between gap-8 md:gap-6">
              <svg class="hidden md:block absolute top-12 left-16 right-16 h-8 w-[calc(100%-8rem)] pointer-events-none -z-10" fill="none" viewBox="0 0 700 24">
                <path class="animate-connecting-flow" d="M10 12 C 160 22, 280 2, 420 16 C 540 26, 620 4, 690 12" stroke="#575249" stroke-linecap="round" stroke-opacity="0.25" stroke-width="2"></path>
              </svg>

              <div class="group flex-1 flex flex-col items-center text-center p-5 rounded-3xl hover:bg-surface-container-soft/40 hover:-translate-y-1.5 transition-all duration-300">
                <div class="relative w-24 h-24 mb-4 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <div class="w-16 h-16 rounded-full bg-coral-container/50 flex items-center justify-center">
                    <span class="material-symbols-outlined text-secondary text-3xl">chat_bubble_outline</span>
                  </div>
                  <div class="absolute -top-1 -right-1 flex items-center justify-center w-8 h-8 rounded-full bg-surface-cream text-secondary shadow-sm">
                    <span class="material-symbols-outlined text-base">schedule</span>
                  </div>
                  <div class="absolute -bottom-2 -left-2 px-2 py-0.5 rounded-full bg-coral-container text-secondary text-[10px] font-bold">12:44 AM</div>
                </div>
                <h3 class="font-headline text-lg font-bold text-ink-primary mb-2 group-hover:text-secondary transition-colors">The Endless Ask</h3>
                <p class="text-sm text-ink-secondary leading-relaxed">
                  Begging creators in DMs at midnight for camera-roll screenshots that arrive cropped or blurry.
                </p>
              </div>

              <div class="group flex-1 flex flex-col items-center text-center p-5 rounded-3xl hover:bg-surface-container-soft/40 hover:-translate-y-1.5 transition-all duration-300">
                <div class="relative w-24 h-24 mb-4 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <div class="p-1.5 rounded-full bg-blue-container/40">
                    <img src="/converge-logo.png" alt="Converge" class="w-14 h-14 rounded-full object-contain p-1"/>
                  </div>
                  <div class="absolute -bottom-1 -right-2 px-2.5 py-0.5 rounded-full bg-primary text-on-primary font-mono text-[11px] shadow-sm flex items-center gap-1">
                    <span class="material-symbols-outlined text-[13px]">link</span>
                    reel.url
                  </div>
                </div>
                <h3 class="font-headline text-lg font-bold text-ink-primary mb-2 group-hover:text-primary transition-colors">Just the Link</h3>
                <p class="text-sm text-ink-secondary leading-relaxed">
                  Paste any public Reel link. Zero creator credentials needed, zero permission requests, zero waiting.
                </p>
              </div>

              <div class="group flex-1 flex flex-col items-center text-center p-5 rounded-3xl hover:bg-surface-container-soft/40 hover:-translate-y-1.5 transition-all duration-300">
                <div class="relative w-24 h-24 mb-4 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <div class="w-16 h-16 rounded-full bg-mint-container/60 flex items-center justify-center">
                    <span class="material-symbols-outlined text-mint-green text-3xl">done_all</span>
                  </div>
                  <div class="absolute -top-2 -left-1 flex items-center justify-center w-8 h-8 rounded-full bg-marigold-container text-tertiary shadow-sm">
                    <span class="material-symbols-outlined text-base">wb_sunny</span>
                  </div>
                </div>
                <h3 class="font-headline text-lg font-bold text-ink-primary mb-2 group-hover:text-mint-green transition-colors">Live Peace</h3>
                <p class="text-sm text-ink-secondary leading-relaxed">
                  One live shareable link for your client. Clean, real-time verified reach and retention.
                </p>
              </div>
            </div>
          </section>

          <!-- REALITY CHECK SECTION -->
          <section id="reality-check" class="relative w-full px-4 sm:px-margin py-12 sm:py-16 flex flex-col items-center">
            <div class="text-center max-w-2xl mb-7">
              <span class="text-xs uppercase tracking-widest text-primary font-bold">Perspective Shift</span>
              <h2 class="font-headline text-2xl sm:text-3xl font-bold text-ink-primary mt-1">The Reality Check</h2>
              <p class="text-sm sm:text-base text-ink-secondary mt-2">
                Toggle to feel the emotional friction between manual screenshots and Converge flow.
              </p>
            </div>

            <div class="relative inline-flex items-center p-1.5 rounded-full bg-surface-container-soft text-ink-secondary mb-10 overflow-hidden shadow-inner max-w-full">
              <div
                class="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-full bg-surface-cream shadow-sm transition-all duration-300 ease-out pointer-events-none"
                [style.left]="mode() === 'chaos' ? '6px' : 'calc(50% + 2px)'">
              </div>
              <button
                (click)="mode.set('chaos')"
                class="relative z-10 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors duration-200 cursor-pointer whitespace-nowrap"
                [ngClass]="mode() === 'chaos' ? 'text-ink-primary' : 'text-ink-secondary'">
                😤 Chasing Screenshots
              </button>
              <button
                (click)="mode.set('flow')"
                class="relative z-10 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors duration-200 cursor-pointer whitespace-nowrap"
                [ngClass]="mode() === 'flow' ? 'text-ink-primary' : 'text-ink-secondary'">
                ✨ Converge Flow
              </button>
            </div>

            <div class="relative w-full max-w-3xl min-h-[280px] flex items-center justify-center px-2">
              @if (mode() === 'chaos') {
                <div class="w-full flex flex-col items-center justify-center gap-6 animate-fade-in-up">
                  <div class="animate-alert-shake self-center sm:self-start sm:ml-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-coral-container text-ink-primary text-xs sm:text-sm shadow-sm text-center">
                    <span class="material-symbols-outlined text-secondary text-base animate-pulse shrink-0">warning</span>
                    <span>“Hey, any chance you can resend that? It was cropped.”</span>
                  </div>
                  <div class="flex flex-col items-center text-center">
                    <div class="font-headline text-3xl sm:text-4xl font-extrabold text-secondary tracking-tight">14 DMs sent</div>
                    <div class="text-sm text-ink-secondary mt-1 flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full bg-secondary animate-ping"></span>
                      <span>3 days waiting on average creator reply</span>
                    </div>
                  </div>
                  <div class="self-center sm:self-end sm:mr-10 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-marigold-container text-ink-primary text-xs sm:text-sm shadow-sm sm:rotate-2 text-center">
                    <span class="material-symbols-outlined text-tertiary text-base shrink-0">hourglass_top</span>
                    <span>“Sorry on vacation! Will check my insights Sunday!”</span>
                  </div>
                  <div class="text-ink-secondary/60 text-xs italic tracking-wide">
                    ∼ client report postponed for the 4th time ∼
                  </div>
                </div>
              } @else {
                <div class="w-full flex flex-col items-center justify-center gap-6 animate-fade-in-up">
                  <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-mint-container text-ink-primary text-xs sm:text-sm shadow-sm">
                    <span class="material-symbols-outlined text-mint-green text-base animate-status-pulse">verified</span>
                    <span>Direct Instagram API payload verified</span>
                  </div>
                  <div class="flex flex-col items-center text-center">
                    <div class="font-headline text-3xl sm:text-4xl font-extrabold text-primary tracking-tight">0 DMs needed</div>
                    <div class="text-sm text-ink-secondary mt-1 flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full bg-mint-green animate-pulse"></span>
                      <span>1.2s instant extraction via public URL</span>
                    </div>
                  </div>
                  <button
                    (click)="simulateExport()"
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container-soft text-ink-primary text-xs font-semibold hover:bg-surface-variant hover:-translate-y-0.5 hover:shadow-md active:scale-95 transition-all duration-150 cursor-pointer border border-outline-variant/40">
                    <span class="material-symbols-outlined text-[17px]" [ngClass]="exportState() === 'loading' ? 'animate-spin text-primary' : (exportState() === 'done' ? 'text-mint-green' : 'text-primary')">
                      {{ exportState() === 'loading' ? 'sync' : (exportState() === 'done' ? 'check' : 'file_download') }}
                    </span>
                    <span>{{ exportState() === 'loading' ? 'Exporting...' : (exportState() === 'done' ? 'Report Ready!' : 'Export reports') }}</span>
                  </button>
                  <div class="text-mint-green text-xs font-semibold tracking-wide flex items-center gap-1.5 text-center">
                    <span>✓</span><span>Client shared, branded, and updated in real-time</span>
                  </div>
                </div>
              }
            </div>
          </section>

          <!-- PILLARS SECTION -->
          <section id="pillars" class="relative w-full px-4 sm:px-margin py-12 sm:py-16 flex flex-col items-center">
            <div class="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-10 text-left">
              <div class="group flex flex-col items-start p-5 rounded-3xl hover:bg-surface-container-soft/30 hover:-translate-y-1.5 transition-all duration-300">
                <span class="text-3xl mb-3 text-primary font-headline font-bold group-hover:scale-125 transition-transform">01</span>
                <h4 class="font-headline text-lg font-bold text-ink-primary mb-2">Zero Permissions</h4>
                <p class="text-sm text-ink-secondary leading-relaxed">
                  Never request Instagram passwords, Facebook Business connections, or agency access grants. Works purely on the public post identifier.
                </p>
              </div>
              <div class="group flex flex-col items-start p-5 rounded-3xl hover:bg-surface-container-soft/30 hover:-translate-y-1.5 transition-all duration-300">
                <span class="text-3xl mb-3 text-secondary-container font-headline font-bold group-hover:scale-125 transition-transform">02</span>
                <h4 class="font-headline text-lg font-bold text-ink-primary mb-2">Tamper-Proof Data</h4>
                <p class="text-sm text-ink-secondary leading-relaxed">
                  No Photoshop alterations. No doctored views. Direct programmatic metric verification gives your clients undisputed confidence.
                </p>
              </div>
              <div class="group flex flex-col items-start p-5 rounded-3xl hover:bg-surface-container-soft/30 hover:-translate-y-1.5 transition-all duration-300">
                <span class="text-3xl mb-3 text-mint-green font-headline font-bold group-hover:scale-125 transition-transform">03</span>
                <h4 class="font-headline text-lg font-bold text-ink-primary mb-2">Agency Branded</h4>
                <p class="text-sm text-ink-secondary leading-relaxed">
                  Share sleek, role-secured interactive dashboards under your agency banner with a simple tap, keeping brand equity front and center.
                </p>
              </div>
            </div>
          </section>

          <!-- CTA FINALE -->
          <section class="relative w-full px-4 sm:px-margin py-12 sm:py-16 my-6 flex flex-col items-center text-center">
            <div class="relative mb-5 group">
              <div class="absolute inset-0 rounded-full bg-primary/10 blur-xl group-hover:bg-primary/25 transition-all duration-500"></div>
              <div class="relative z-10 w-20 h-20 sm:w-24 sm:h-24 rounded-full p-3 shadow-lg bg-surface-cream flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                <img src="/converge-logo.png" alt="Converge" class="w-full h-full object-contain rounded-full"/>
              </div>
            </div>
            <h2 class="font-headline text-3xl sm:text-4xl md:text-[48px] md:leading-[56px] font-bold text-ink-primary max-w-2xl mb-3">
              Ready to stop chasing screenshots?
            </h2>
            <p class="text-base sm:text-lg text-ink-secondary max-w-md mb-6">
              Paste your first link in seconds. Your agency hours belong to growth, not midnight DMs.
            </p>
            <div class="flex flex-wrap items-center justify-center gap-4 text-ink-secondary text-xs font-medium">
              <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[15px] text-mint-green">check_circle</span> Secure client access</span>
              <span class="text-outline-variant">•</span>
              <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[15px] text-mint-green">check_circle</span> 60-second setup</span>
              <span class="text-outline-variant">•</span>
              <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[15px] text-mint-green">check_circle</span> Instant verified metrics</span>
            </div>
          </section>
        </div>
      </main>

      <!-- Footer -->
      <footer class="w-full bg-surface-container-low py-8 border-t border-outline-variant/15">
        <div class="w-full px-4 sm:px-margin max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-on-surface-variant">
          <div class="flex items-center gap-2">
            <img src="/converge-logo.png" alt="Converge" class="w-6 h-6 rounded-full object-contain"/>
            <span class="font-headline text-base text-ink-primary font-bold">Converge</span>
          </div>
          <div class="flex flex-wrap items-center justify-center gap-6 text-xs font-semibold">
            <a routerLink="/legal" [queryParams]="{tab: 'privacy'}" class="hover:text-on-surface hover:underline transition-colors">Privacy Policy</a>
            <a routerLink="/legal" [queryParams]="{tab: 'terms'}" class="hover:text-on-surface hover:underline transition-colors">Terms of Service</a>
            <a routerLink="/auth" [queryParams]="{mode: 'signin'}" class="hover:text-on-surface hover:underline transition-colors">Sign In</a>
          </div>
          <p class="text-xs text-ink-secondary">© 2026 Converge. All rights reserved.</p>
        </div>
      </footer>
    </div>
  `
})
export class LandingComponent {
  mouseX = signal(0);
  mouseY = signal(0);
  tiltX = signal(0);
  tiltY = signal(0);
  scrollProgress = signal(0);
  scrolled = signal(false);
  mode = signal<'chaos' | 'flow'>('flow');
  exportState = signal<'idle' | 'loading' | 'done'>('idle');

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    this.mouseX.set(e.clientX);
    this.mouseY.set(e.clientY);
  }

  @HostListener('window:scroll')
  onScroll() {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    this.scrollProgress.set(total > 0 ? (window.scrollY / total) * 100 : 0);
    this.scrolled.set(window.scrollY > 20);
  }

  onStageMove(e: MouseEvent) {
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const dx = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const dy = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
    this.tiltX.set(dx);
    this.tiltY.set(dy);
  }

  onStageLeave() {
    this.tiltX.set(0);
    this.tiltY.set(0);
  }

  simulateExport() {
    if (this.exportState() !== 'idle') return;
    this.exportState.set('loading');
    setTimeout(() => {
      this.exportState.set('done');
      setTimeout(() => this.exportState.set('idle'), 2000);
    }, 700);
  }
}
