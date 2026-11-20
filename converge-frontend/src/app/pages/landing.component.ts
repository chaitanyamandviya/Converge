import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AppHeaderComponent } from '../components/app-header.component';

interface WorkflowItem {
  id: string;
  title: string;
  primaryTag: string;
  tags: string[];
  previewHandle: string;
  previewStat: string;
  previewDelta: string;
  previewNote: string;
  accent: string;
}

interface SampleCreatorReel {
  id: string;
  handle: string;
  campaign: string;
  reelTitle: string;
  url: string;
  views: number;
  likes: number;
  comments: number;
  saves: number;
  accent: string;
  bars: number[];
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppHeaderComponent],
  template: `
    <div class="min-h-screen flex flex-col bg-[#1c1c1c] text-[#fff6e8] overflow-x-clip selection:bg-[#f54e26]/30 selection:text-[#fff6e8]">
      <!-- Minimal Top Navigation -->
      <app-header [elevated]="elevatedHeader()">
        <div header-right class="flex items-center gap-4 sm:gap-6">
          <button (click)="scrollTo('story')"
                  class="hidden sm:inline-block text-sm text-[#a7a9be] hover:text-[#fff6e8] transition-colors cursor-pointer">
            Calculator
          </button>
          <button (click)="scrollTo('how-it-works')"
                  class="hidden sm:inline-block text-sm text-[#a7a9be] hover:text-[#fff6e8] transition-colors cursor-pointer">
            How it works
          </button>
          <button (click)="scrollTo('workflows')"
                  class="hidden sm:inline-block text-sm text-[#a7a9be] hover:text-[#fff6e8] transition-colors cursor-pointer">
            Workflows
          </button>
          @if (auth.isAuthenticated()) {
            <a [routerLink]="dashboardRoute()"
               class="h-8.5 px-4 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#fff6e8] font-headline uppercase tracking-[0.04em] text-sm font-bold inline-flex items-center transition-all">
              WORKSPACE ↗
            </a>
          } @else {
            <a routerLink="/auth"
               class="text-sm text-[#fff6e8] hover:text-[#f54e26] transition-colors font-medium">
              Sign in
            </a>
            <a routerLink="/auth" [queryParams]="{mode: 'signup'}"
               class="h-8.5 px-4 rounded-[4px] bg-[#fff6e8] hover:bg-[#f54e26] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#f54e26] font-headline uppercase tracking-[0.04em] text-sm font-bold hidden sm:inline-flex items-center transition-all">
              GET STARTED ↗
            </a>
          }
        </div>
      </app-header>

      <main class="flex-1">
        <!-- ================= BAND 1: INTERACTIVE HERO WORKSPACE + TILTED RIBBON ================= -->
        <section class="relative pt-10 sm:pt-14 pb-16 sm:pb-24 overflow-hidden">
          <div class="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <!-- Left Column: Human Hook + Actions -->
            <div class="lg:col-span-6 flex flex-col items-start">
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-[4px] bg-[#5738af] text-[#fff6e8] text-xs font-semibold mb-5 select-none -rotate-1 shadow-[3px_3px_0px_#111111]">
                <span class="w-1.5 h-1.5 rounded-full bg-[#fabf29]"></span>
                <span>0 DMS ◆ 100% REAL POST NUMBERS</span>
              </div>

              <h1 class="font-headline font-bold uppercase tracking-[0.01em] text-[2.85rem] sm:text-[3.8rem] lg:text-[4.2rem] xl:text-[4.75rem] leading-[0.95] text-[#fff6e8]">
                SKIP
                <button type="button"
                        (click)="wordStrikeActive.set(!wordStrikeActive())"
                        title="No more screenshots"
                        class="group/word relative inline-block text-[#fabf29] cursor-pointer text-left uppercase transition-transform duration-200 hover:-rotate-2 hover:scale-[1.03] focus:outline-none"
                        [class.is-active]="wordStrikeActive()">
                  <span>SCREENSHOTS.</span>
                  <!-- Animated hand-drawn brush strike-out doodle -->
                  <svg aria-hidden="true" class="pointer-events-none absolute left-0 right-0 top-[46%] w-full h-4 -translate-y-1/2 overflow-visible" viewBox="0 0 220 18" preserveAspectRatio="none" fill="none">
                    <path d="M4 11 C 55 3, 120 15, 216 7" stroke="#f54e26" stroke-width="5" stroke-linecap="round" class="doodle-draw-hover"/>
                  </svg>
                  <span class="doodle-pop-hover pointer-events-none hidden sm:inline-block absolute -top-3.5 -right-2 px-1.5 py-0.5 rounded-[3px] bg-[#f54e26] text-[#111111] font-headline text-[11px] font-bold tracking-wider border border-[#111111] shadow-[2px_2px_0px_#fff6e8]">
                    0 NEEDED!
                  </span>
                </button>
                <br/>
                PASTE ONE
                <button type="button"
                        (click)="cycleSampleFromText()"
                        title="Click to switch creator Reel"
                        class="group/word relative inline-block text-[#007656] cursor-pointer text-left uppercase transition-transform duration-200 hover:rotate-1 hover:scale-[1.03] focus:outline-none">
                  <span>REEL LINK.</span>
                  <!-- Animated gold sparkles + curved loop underline -->
                  <svg aria-hidden="true" class="pointer-events-none absolute left-0 right-0 -bottom-1 w-full h-3 overflow-visible" viewBox="0 0 180 14" preserveAspectRatio="none" fill="none">
                    <path d="M3 8 Q 45 14 90 7 T 177 8" stroke="#fabf29" stroke-width="3.2" stroke-linecap="round" class="doodle-draw-hover"/>
                  </svg>
                  <svg aria-hidden="true" class="doodle-pop-hover pointer-events-none absolute -top-3 -right-5 w-6 h-6" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2Z" fill="#fabf29"/>
                  </svg>
                </button>
                <br/>
                GET
                <button type="button"
                        (click)="simulateRefresh()"
                        title="Click to refresh live numbers"
                        class="group/word relative inline-block text-[#f54e26] cursor-pointer text-left uppercase transition-transform duration-200 hover:-translate-y-0.5 hover:scale-[1.03] focus:outline-none">
                  <span>LIVE NUMBERS.</span>
                  <svg aria-hidden="true" class="pointer-events-none absolute left-0 right-0 -bottom-1.5 w-full h-3.5 overflow-visible" viewBox="0 0 220 14" preserveAspectRatio="none" fill="none">
                    <path d="M4 9 C 60 2, 140 13, 214 5" stroke="#fff6e8" stroke-width="2.8" stroke-linecap="round" class="doodle-draw-hover"/>
                  </svg>
                  <svg aria-hidden="true" class="pointer-events-none inline-block w-6 h-6 ml-1 -mt-2 text-[#fabf29] transition-transform duration-300 group-hover/word:translate-x-1 group-hover/word:-translate-y-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 17l6-6 4 4 6-7"/>
                    <path d="M15 8h5v5"/>
                  </svg>
                </button>
              </h1>

              <p class="mt-5 text-sm sm:text-base text-[#a7a9be] leading-relaxed max-w-lg">
                Track views, likes, saves, and campaign totals straight from any public Instagram Reel—no creator passwords, no cropped phone captures, and no Friday DM chasing.
              </p>

              <div class="mt-7 flex flex-wrap items-center gap-4">
                @if (auth.isAuthenticated()) {
                  <a [routerLink]="dashboardRoute()"
                     class="font-headline uppercase tracking-[0.03em] text-xl font-bold px-7 py-3 rounded-[4px] bg-[#f54e26] text-[#111111] border-2 border-[#111111] shadow-[4px_4px_0px_#fff6e8] hover:bg-[#ff643e] active:translate-x-[2px] active:translate-y-[2px] transition-all">
                    OPEN WORKSPACE ↗
                  </a>
                } @else {
                  <a routerLink="/auth" [queryParams]="{mode: 'signup'}"
                     class="font-headline uppercase tracking-[0.03em] text-xl font-bold px-7 py-3 rounded-[4px] bg-[#f54e26] text-[#111111] border-2 border-[#111111] shadow-[4px_4px_0px_#fff6e8] hover:bg-[#ff643e] active:translate-x-[2px] active:translate-y-[2px] transition-all">
                    START FREE WORKSPACE ↗
                  </a>
                }
                <button type="button" (click)="scrollTo('story')"
                        class="font-headline uppercase tracking-[0.03em] text-lg font-bold px-4 py-3 text-[#ffccde] hover:text-[#fff6e8] transition-colors cursor-pointer">
                  CALCULATE TIME SAVED ↓
                </button>
              </div>

              <!-- Playful Hand-Drawn Hint Doodle Pointing to Interactive Workspace -->
              <div class="hidden lg:flex items-center gap-2 mt-5 text-xs text-[#a7a9be] select-none animate-float-slow">
                <span>Hover any colored word above or try the live demo</span>
                <svg aria-hidden="true" class="w-10 h-5 text-[#fabf29]" viewBox="0 0 48 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 14 C 14 14, 24 6, 42 8"/>
                  <path d="M36 3l8 5-7 6"/>
                </svg>
              </div>
            </div>

            <!-- Right Column: Live Interactive Reel Demo Card Above the Fold -->
            <div class="lg:col-span-6 w-full">
              <div class="rounded-[6px] bg-[#161616] border-2 border-white/[0.18] shadow-[8px_8px_0px_#f54e26] p-4 sm:p-5">
                <!-- Interactive Creator Selector + View Switcher -->
                <div class="flex flex-wrap items-center justify-between gap-2 pb-3.5 border-b border-white/[0.12]">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    @for (sample of sampleReels(); track sample.id) {
                      <button type="button"
                              (click)="selectSample(sample.id)"
                              class="px-2.5 py-1 rounded-[4px] text-xs font-medium transition-colors cursor-pointer"
                              [ngClass]="selectedSampleId() === sample.id
                                ? 'bg-[#fff6e8] text-[#111111] font-semibold'
                                : 'bg-[#111111] border border-white/[0.14] text-[#a7a9be] hover:text-[#fff6e8]'">
                        {{ sample.handle }}
                      </button>
                    }
                  </div>

                  <div class="inline-flex items-center p-0.5 rounded-[4px] bg-[#111111] border border-white/[0.14] text-[11px]">
                    <button type="button" (click)="demoView.set('card')"
                            class="px-2.5 py-1 rounded-[3px] font-medium cursor-pointer transition-colors"
                            [ngClass]="demoView() === 'card' ? 'bg-[#f54e26] text-[#111111] font-semibold' : 'text-[#a7a9be] hover:text-[#fff6e8]'">
                      Live Stats
                    </button>
                    <button type="button" (click)="demoView.set('csv')"
                            class="px-2.5 py-1 rounded-[3px] font-medium cursor-pointer transition-colors"
                            [ngClass]="demoView() === 'csv' ? 'bg-[#f54e26] text-[#111111] font-semibold' : 'text-[#a7a9be] hover:text-[#fff6e8]'">
                      CSV Recap
                    </button>
                  </div>
                </div>

                @if (demoView() === 'card') {
                  <!-- Interactive Single-Reel Inspector View -->
                  @if (activeSample(); as reel) {
                    <div class="pt-4 space-y-4">
                      <!-- Public URL Bar + Interactive Refresh Button -->
                      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 rounded-[4px] bg-[#111111] border border-white/[0.12]">
                        <div class="flex items-center gap-2 min-w-0 text-xs">
                          <span class="w-2 h-2 rounded-full bg-[#4ade80] shrink-0"></span>
                          <span class="text-[#fff6e8] font-medium truncate">{{ reel.url }}</span>
                        </div>
                        <button type="button"
                                (click)="simulateRefresh()"
                                class="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] bg-[#242424] hover:bg-[#f54e26] hover:text-[#111111] text-[#fff6e8] text-[11px] font-semibold transition-colors cursor-pointer">
                          <svg class="w-3 h-3" [class.animate-spin]="demoRefreshing()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>
                          </svg>
                          <span>{{ demoRefreshing() ? 'Updating...' : 'Simulate Refresh' }}</span>
                        </button>
                      </div>

                      <!-- Title + Live Delta Note -->
                      <div class="flex items-center justify-between gap-3">
                        <div class="min-w-0">
                          <span class="text-[11px] uppercase tracking-wider text-[#a7a9be]">{{ reel.campaign }}</span>
                          <h3 class="font-headline uppercase text-2xl font-bold text-[#fff6e8] tracking-[0.015em] truncate">{{ reel.reelTitle }}</h3>
                        </div>
                        <span class="text-[11px] font-medium text-[#4ade80] shrink-0">{{ refreshNote() }}</span>
                      </div>

                      <!-- Unified Hairline Metric Grid -->
                      <div class="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.12] rounded-[4px] bg-[#111111] border border-white/[0.14] tabular-nums">
                        <div class="px-3.5 py-3">
                          <span class="text-[11px] text-[#a7a9be] block">Views</span>
                          <span class="font-headline text-2xl font-bold text-[#fff6e8]">{{ formatCompact(reel.views) }}</span>
                        </div>
                        <div class="px-3.5 py-3">
                          <span class="text-[11px] text-[#a7a9be] block">Likes</span>
                          <span class="font-headline text-2xl font-bold text-[#fabf29]">{{ formatCompact(reel.likes) }}</span>
                        </div>
                        <div class="px-3.5 py-3">
                          <span class="text-[11px] text-[#a7a9be] block">Saves</span>
                          <span class="font-headline text-2xl font-bold text-[#ffccde]">{{ formatCompact(reel.saves) }}</span>
                        </div>
                        <div class="px-3.5 py-3">
                          <span class="text-[11px] text-[#a7a9be] block">Comments</span>
                          <span class="font-headline text-2xl font-bold text-[#4ade80]">{{ reel.comments }}</span>
                        </div>
                      </div>

                      <!-- Interactive Day-by-Day Bar Chart -->
                      <div class="px-3.5 py-3 rounded-[4px] bg-[#111111] border border-white/[0.12]">
                        <div class="flex items-center justify-between text-[11px] text-[#a7a9be] mb-2">
                          <span>Hover bars to inspect daily view momentum</span>
                          <span class="text-[#fff6e8] font-medium tabular-nums">
                            Day {{ hoveredBarIdx() + 1 }}: +{{ formatCompact(reel.bars[hoveredBarIdx()] * 180) }} views
                          </span>
                        </div>
                        <div class="grid grid-cols-7 gap-2 items-end h-14">
                          @for (val of reel.bars; track $index) {
                            <button type="button"
                                    (mouseenter)="hoveredBarIdx.set($index)"
                                    (click)="hoveredBarIdx.set($index)"
                                    class="w-full rounded-t-[2px] transition-all duration-150 cursor-pointer"
                                    [style.height.%]="val"
                                    [style.backgroundColor]="hoveredBarIdx() === $index ? '#f54e26' : (reel.accent + '88')"
                                    [attr.aria-label]="'Day ' + ($index + 1) + ' momentum'">
                            </button>
                          }
                        </div>
                      </div>
                    </div>
                  }
                } @else {
                  <!-- Interactive Campaign CSV Export Preview -->
                  <div class="pt-4 space-y-3">
                    <div class="rounded-[4px] bg-[#111111] border border-white/[0.12] divide-y divide-white/[0.08] text-xs tabular-nums overflow-hidden">
                      <div class="grid grid-cols-12 px-3 py-2 text-[11px] text-[#a7a9be] font-medium bg-[#181818]">
                        <span class="col-span-5">Creator</span>
                        <span class="col-span-3 text-right">Views</span>
                        <span class="col-span-2 text-right">Likes</span>
                        <span class="col-span-2 text-right">Saves</span>
                      </div>
                      @for (r of sampleReels(); track r.id) {
                        <div (click)="selectSample(r.id); demoView.set('card')"
                             class="grid grid-cols-12 px-3 py-2.5 items-center hover:bg-white/[0.04] cursor-pointer transition-colors">
                          <span class="col-span-5 font-medium text-[#fff6e8] truncate">{{ r.handle }}</span>
                          <span class="col-span-3 text-right text-[#f54e26] font-semibold">{{ formatCompact(r.views) }}</span>
                          <span class="col-span-2 text-right text-[#fabf29]">{{ formatCompact(r.likes) }}</span>
                          <span class="col-span-2 text-right text-[#ffccde]">{{ formatCompact(r.saves) }}</span>
                        </div>
                      }
                    </div>
                    <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span class="text-xs text-[#a7a9be]">No manual copy-pasting from screenshots.</span>
                      <button type="button"
                              (click)="downloadSampleCsv()"
                              class="h-8 px-3.5 rounded-[4px] bg-[#007656] hover:bg-[#058c68] text-[#fff6e8] text-xs font-semibold cursor-pointer transition-colors">
                        {{ csvDownloaded() ? 'Downloaded sample CSV ✓' : 'Download Sample CSV ↓' }}
                      </button>
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Crossing Diagonal Ribbons -->
          <div class="relative mt-14 sm:mt-20 select-none pointer-events-none">
            <div class="w-[112%] -ml-[6%] h-12 sm:h-14 bg-[#262626] rotate-[2.2deg] translate-y-6 opacity-90"></div>
            <div class="w-[112%] -ml-[6%] -mt-9 bg-[#f54e26] -rotate-[2.4deg] py-2.5 sm:py-3 overflow-hidden shadow-[0_14px_34px_rgba(0,0,0,0.45)]">
              <div class="animate-marquee font-headline uppercase font-bold text-xl sm:text-[1.75rem] tracking-[0.04em] text-[#fff6e8] leading-none flex items-center gap-6 whitespace-nowrap">
                <span>NO CREATOR PASSWORDS</span>
                <span>◆</span>
                <span>ONE PUBLIC REEL LINK</span>
                <span>◆</span>
                <span>REAL VIEWS &amp; SAVES</span>
                <span>◆</span>
                <span>ZERO FOLLOW-UP DMS</span>
                <span>◆</span>
                <span>CLEAN SPREADSHEETS</span>
                <span>◆</span>
                <span>NO CROPPED SCREENSHOTS</span>
                <span>◆</span>
                <span>NO CREATOR PASSWORDS</span>
                <span>◆</span>
                <span>ONE PUBLIC REEL LINK</span>
                <span>◆</span>
                <span>REAL VIEWS &amp; SAVES</span>
                <span>◆</span>
                <span>ZERO FOLLOW-UP DMS</span>
                <span>◆</span>
                <span>CLEAN SPREADSHEETS</span>
                <span>◆</span>
                <span>NO CROPPED SCREENSHOTS</span>
                <span>◆</span>
              </div>
            </div>
          </div>
        </section>

        <!-- ================= BAND 2: STORY + INTERACTIVE FRIDAY RECAP CALCULATOR ================= -->
        <section id="story" class="py-16 sm:py-24 px-4 sm:px-6 lg:px-10">
          <div class="max-w-[1320px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
            <!-- Left Bold Typographic Story -->
            <div class="lg:col-span-6">
              <h2 class="font-headline uppercase font-bold text-3xl sm:text-5xl leading-[1.02] tracking-[0.01em] text-[#fff6e8]">
                BUILT SO BRAND TEAMS<br/>
                NEVER BEG CREATORS<br/>
                <span class="group/word relative inline-block text-[#f54e26] cursor-default transition-transform duration-200 hover:-rotate-1">
                  FOR A SCREENSHOT
                  <svg aria-hidden="true" class="pointer-events-none absolute left-0 right-0 -bottom-1 w-full h-3 overflow-visible" viewBox="0 0 220 14" preserveAspectRatio="none" fill="none">
                    <path d="M4 9 C 60 3, 150 13, 214 6" stroke="#fabf29" stroke-width="3.2" stroke-linecap="round" class="doodle-draw-hover"/>
                  </svg>
                </span><br/>
                <span class="inline-block text-[#d0d5ff] transition-transform duration-200 hover:translate-x-1">EVER AGAIN.</span>
              </h2>
              <p class="mt-5 text-sm sm:text-base text-[#a7a9be] leading-[1.7] max-w-lg">
                Every launch ends the same way: ten open DM threads, cropped phone screenshots with missing counts, and a Friday afternoon deadline. Slide the number of creators in your campaign to see how much chasing Converge removes.
              </p>

              <!-- Overlapping circular badges row with springy hover doodles -->
              <div class="mt-6 flex items-center -space-x-2.5 select-none">
                <div class="w-11 h-11 rounded-full bg-[#f54e26] text-[#fff6e8] flex items-center justify-center border-2 border-[#1c1c1c] font-headline font-bold text-sm transition-transform duration-200 hover:-translate-y-1.5 hover:z-10">
                  IG
                </div>
                <div class="w-11 h-11 rounded-full bg-[#5738af] text-[#fff6e8] flex items-center justify-center border-2 border-[#1c1c1c] font-headline font-bold text-xs transition-transform duration-200 hover:-translate-y-1.5 hover:z-10">
                  142K
                </div>
                <div class="w-11 h-11 rounded-full bg-[#fabf29] text-[#111111] flex items-center justify-center border-2 border-[#1c1c1c] font-headline font-bold text-xs transition-transform duration-200 hover:-translate-y-1.5 hover:z-10">
                  SAVE
                </div>
                <div class="w-11 h-11 rounded-full bg-[#007656] text-[#fff6e8] flex items-center justify-center border-2 border-[#1c1c1c] font-headline font-bold text-xs transition-transform duration-200 hover:-translate-y-1.5 hover:z-10">
                  CSV
                </div>
              </div>
            </div>

            <!-- Right Interactive Time-Saver Calculator -->
            <div class="lg:col-span-6 relative">
              <!-- Playful Tilted Sticker -->
              <div class="inline-flex items-center mb-4 select-none">
                <div class="px-2.5 py-1 bg-[#5738af] text-[#fff6e8] font-headline font-bold text-lg tracking-wide -rotate-12 -mr-2 z-10 shadow-md">
                  NO DMS!
                </div>
                <div class="w-12 h-12 rounded-full bg-[#242424] border border-white/15 flex items-center justify-center shadow-lg">
                  <div class="flex items-center gap-1.5">
                    <span class="w-2.5 h-3.5 rounded-full bg-[#fff6e8] flex items-center justify-end pr-0.5"><span class="w-1 h-1 rounded-full bg-[#111111]"></span></span>
                    <span class="w-2.5 h-3.5 rounded-full bg-[#fff6e8] flex items-center justify-end pr-0.5"><span class="w-1 h-1 rounded-full bg-[#111111]"></span></span>
                  </div>
                </div>
              </div>

              <div class="rounded-[6px] bg-[#161616] border border-white/[0.16] shadow-[6px_6px_0px_#fabf29] p-5 sm:p-6">
                <div class="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-white/[0.12]">
                  <div>
                    <span class="text-xs text-[#a7a9be] block">Campaign Size</span>
                    <h3 class="font-headline uppercase text-2xl font-bold text-[#fff6e8] leading-tight">
                      <span class="text-[#fabf29]">{{ creatorCount() }}</span> CREATORS IN LAUNCH
                    </h3>
                  </div>
                  <div class="flex items-center gap-1.5">
                    @for (preset of [5, 15, 30, 50]; track preset) {
                      <button type="button"
                              (click)="creatorCount.set(preset)"
                              class="px-2.5 py-1 rounded-[4px] text-xs font-medium cursor-pointer transition-colors tabular-nums"
                              [ngClass]="creatorCount() === preset
                                ? 'bg-[#fabf29] text-[#111111] font-semibold'
                                : 'bg-[#111111] border border-white/[0.14] text-[#a7a9be] hover:text-[#fff6e8]'">
                        {{ preset }}
                      </button>
                    }
                  </div>
                </div>

                <div class="py-5">
                  <input
                    type="range"
                    min="3"
                    max="60"
                    [ngModel]="creatorCount()"
                    (ngModelChange)="creatorCount.set(+$event)"
                    aria-label="Number of creators in campaign"
                    class="w-full accent-[#f54e26] cursor-pointer"/>
                  <div class="flex justify-between text-[11px] text-[#a7a9be] mt-1 tabular-nums">
                    <span>3 creators</span>
                    <span>30 creators</span>
                    <span>60 creators</span>
                  </div>
                </div>

                <div class="grid grid-cols-3 divide-x divide-white/[0.12] rounded-[4px] bg-[#111111] border border-white/[0.14] tabular-nums text-center">
                  <div class="py-3 px-2">
                    <span class="font-headline text-2xl sm:text-3xl font-bold text-[#f54e26] block leading-none">{{ followUpDmsSaved() }}</span>
                    <span class="text-[11px] text-[#a7a9be] mt-1 block">DMs skipped</span>
                  </div>
                  <div class="py-3 px-2">
                    <span class="font-headline text-2xl sm:text-3xl font-bold text-[#fabf29] block leading-none">{{ hoursSavedMonthly() }}h</span>
                    <span class="text-[11px] text-[#a7a9be] mt-1 block">Recap time saved</span>
                  </div>
                  <div class="py-3 px-2">
                    <span class="font-headline text-2xl sm:text-3xl font-bold text-[#4ade80] block leading-none">0</span>
                    <span class="text-[11px] text-[#a7a9be] mt-1 block">Logins asked</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ================= BAND 3: INTERACTIVE VENN DIAGRAM + LINKED 4-STEP ACCORDION ================= -->
        <section id="how-it-works" class="py-16 sm:py-24 px-4 sm:px-6 lg:px-10">
          <div class="max-w-[1320px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <!-- Left: Bold Condensed Statement + Responsive SVG Venn -->
            <div class="lg:col-span-5">
              <h2 class="font-headline uppercase font-bold text-3xl sm:text-5xl leading-[1.03] tracking-[0.01em] text-[#fff6e8]">
                ONE LINK IN. REAL NUMBERS, CLEAN CAMPAIGNS, READY REPORTS.
              </h2>

              <!-- Interactive Venn Diagram linked to openAccordionId() -->
              <div class="mt-8 relative w-72 sm:w-80 mx-auto lg:mx-0 select-none">
                <svg class="w-full h-auto" viewBox="0 0 340 220" fill="none">
                  <g transform="translate(8, 128)">
                    <circle cx="28" cy="28" r="24" fill="#fff6e8"/>
                    <circle cx="28" cy="28" r="17" stroke="#fabf29" stroke-width="2.2"/>
                    <ellipse cx="28" cy="28" rx="9" ry="17" stroke="#fabf29" stroke-width="2"/>
                    <line x1="11" y1="28" x2="45" y2="28" stroke="#fabf29" stroke-width="2"/>
                  </g>

                  <g transform="rotate(-14 170 112)">
                    <rect x="64" y="42" width="212" height="126" rx="63"
                          [attr.fill]="openAccordionId() === 'export' ? '#04966e' : '#007656'"
                          class="transition-all duration-300"/>
                    <!-- Left Venn Circle: CREATORS -->
                    <circle cx="128" cy="105" r="50" stroke="#fabf29"
                            [attr.stroke-width]="openAccordionId() === 'link' ? 6 : 3.5"
                            class="transition-all duration-300 cursor-pointer"
                            (click)="toggleAccordion('link')"/>
                    <text x="113" y="109" text-anchor="middle"
                          [attr.fill]="openAccordionId() === 'link' ? '#fff6e8' : '#a7a9be'"
                          font-size="11" font-weight="600" font-family="DM Sans, sans-serif">CREATORS</text>

                    <!-- Right Venn Circle: BRANDS -->
                    <circle cx="212" cy="105" r="50" stroke="#ffccde"
                            [attr.stroke-width]="openAccordionId() === 'organize' ? 6 : 3.5"
                            class="transition-all duration-300 cursor-pointer"
                            (click)="toggleAccordion('organize')"/>
                    <text x="228" y="109" text-anchor="middle"
                          [attr.fill]="openAccordionId() === 'organize' ? '#fff6e8' : '#a7a9be'"
                          font-size="11" font-weight="600" font-family="DM Sans, sans-serif">BRANDS</text>

                    <!-- Center Intersection Lens: REELS -->
                    <path d="M170 65 A 50 50 0 0 1 170 145 A 50 50 0 0 1 170 65 Z"
                          [attr.fill]="openAccordionId() === 'metrics' ? '#ff643e' : '#f54e26'"
                          class="transition-all duration-300 cursor-pointer"
                          (click)="toggleAccordion('metrics')"/>
                    <text x="170" y="109" text-anchor="middle" fill="#fff6e8" font-size="11" font-weight="700" font-family="DM Sans, sans-serif">REELS</text>
                  </g>

                  <g transform="translate(262, 14)" class="cursor-pointer" (click)="toggleAccordion('link')">
                    <polygon points="34,0 41,20 62,14 50,32 68,45 47,48 53,68 35,54 22,70 21,49 0,51 15,35 3,18 24,23" fill="#5738af"/>
                    <path d="M26 42 L40 28 M30 28 H40 V38" stroke="#fff6e8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                  </g>

                  <g transform="translate(205, 166) rotate(24)" class="cursor-pointer" (click)="toggleAccordion('export')">
                    <rect x="0" y="0" width="28" height="28" rx="3" fill="#ffccde"/>
                    <path d="M14 5 L16.5 11.5 L23 14 L16.5 16.5 L14 23 L11.5 16.5 L5 14 L11.5 11.5 Z" fill="#5738af"/>
                  </g>
                </svg>
                <p class="text-xs text-[#a7a9be] mt-2 text-center lg:text-left">
                  Click any step on the right or circle above to inspect how they connect.
                </p>
              </div>
            </div>

            <!-- Right: Clean Hairline Accordion -->
            <div class="lg:col-span-7 border-t border-white/[0.16]">
              @for (item of accordionItems; track item.id) {
                <div class="border-b border-white/[0.16]">
                  <button type="button"
                          (click)="openAccordionId.set(item.id)"
                          class="w-full py-5 sm:py-6 flex items-center justify-between gap-4 text-left cursor-pointer group">
                    <span class="font-headline uppercase font-bold text-2xl sm:text-3xl tracking-[0.02em] transition-colors"
                          [ngClass]="openAccordionId() === item.id ? 'text-[#f54e26]' : 'text-[#fff6e8]/85 group-hover:text-[#fff6e8]'">
                      {{ item.title }}
                    </span>
                    <span class="text-2xl font-light text-[#a7a9be] group-hover:text-[#fff6e8] transition-colors shrink-0 leading-none">
                      {{ openAccordionId() === item.id ? '−' : '+' }}
                    </span>
                  </button>
                  @if (openAccordionId() === item.id) {
                    <div class="pb-6 pr-8 text-sm sm:text-base text-[#a7a9be] leading-relaxed animate-fade-in-up">
                      {{ item.body }}
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </section>

        <!-- ================= BAND 4: INTERACTIVE WORKFLOW EXPLORER ================= -->
        <section id="workflows" class="py-16 sm:py-24 px-4 sm:px-6 lg:px-10">
          <div class="max-w-[1320px] mx-auto">
            <div class="flex items-center justify-center mb-12 relative">
              <div class="relative inline-block text-center">
                <h2 class="font-headline uppercase font-bold text-4xl sm:text-5xl lg:text-[3.5rem] leading-[1.02] tracking-[0.01em] text-[#fff6e8]">
                  HOW CONVERGE HELPS<br/>
                  TEAMS EVERY WEEK
                </h2>
                <svg class="hidden sm:block w-24 h-16 absolute -right-14 top-1/2 -translate-y-1/2 rotate-[-10deg] pointer-events-none" viewBox="0 0 110 76" fill="none">
                  <ellipse cx="52" cy="40" rx="44" ry="28" stroke="#5738af" stroke-width="2.6" fill="rgba(87,56,175,0.18)"/>
                  <ellipse cx="52" cy="40" rx="22" ry="28" stroke="#5738af" stroke-width="2.2"/>
                  <line x1="8" y1="40" x2="96" y2="40" stroke="#5738af" stroke-width="2.2"/>
                  <line x1="20" y1="24" x2="84" y2="24" stroke="#5738af" stroke-width="1.8"/>
                  <line x1="20" y1="56" x2="84" y2="56" stroke="#5738af" stroke-width="1.8"/>
                  <path d="M76 22 L78 27 L83 29 L78 31 L76 36 L74 31 L69 29 L74 27 Z" fill="#fabf29"/>
                  <path d="M90 12 L91.5 16 L95.5 17.5 L91.5 19 L90 23 L88.5 19 L84.5 17.5 L88.5 16 Z" fill="#fabf29"/>
                </svg>
              </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <!-- Click/Hover Index Rows -->
              <div class="lg:col-span-7 border-t border-white/[0.16]">
                @for (row of workflows; track row.id) {
                  <button
                    type="button"
                    (mouseenter)="selectedWorkflowId.set(row.id)"
                    (click)="selectedWorkflowId.set(row.id)"
                    class="w-full text-left py-6 sm:py-7 px-3 border-b border-white/[0.16] flex items-center justify-between gap-4 group transition-colors cursor-pointer"
                    [ngClass]="selectedWorkflowId() === row.id ? 'bg-white/[0.03]' : 'hover:bg-white/[0.015]'">
                    <div class="min-w-0">
                      <h3 class="font-headline uppercase font-bold text-3xl sm:text-4xl leading-[1] tracking-[0.01em] transition-colors"
                          [ngClass]="selectedWorkflowId() === row.id ? 'text-[#f54e26]' : 'text-[#fff6e8] group-hover:text-[#f54e26]'">
                        {{ row.title }}
                      </h3>
                      <div class="mt-3 flex flex-wrap items-center gap-2">
                        <span class="px-2.5 py-0.5 rounded-[4px] bg-[#5738af] text-[#fff6e8] text-xs font-semibold">
                          {{ row.primaryTag }}
                        </span>
                        @for (t of row.tags; track t) {
                          <span class="px-2.5 py-0.5 rounded-[4px] bg-[#141414] border border-white/[0.14] text-[#e8e8ee] text-xs font-medium">
                            {{ t }}
                          </span>
                        }
                      </div>
                    </div>
                    <span class="font-headline text-2xl shrink-0 transition-transform"
                          [ngClass]="selectedWorkflowId() === row.id ? 'text-[#f54e26] translate-x-1' : 'text-[#a7a9be]'">→</span>
                  </button>
                }
              </div>

              <!-- Sticky Live Workflow Preview Card -->
              <div class="lg:col-span-5 lg:sticky lg:top-24">
                @if (activeWorkflow(); as wf) {
                  <div class="rounded-[6px] bg-[#161616] border-2 border-white/[0.18] p-6 transition-all duration-200"
                       [style.boxShadow]="'8px 8px 0px ' + wf.accent">
                    <div class="flex items-center justify-between gap-2 pb-4 border-b border-white/[0.12] text-xs">
                      <span class="text-[#a7a9be] font-medium">{{ wf.previewHandle }}</span>
                      <span class="px-2 py-0.5 rounded-[3px] text-[11px] font-bold text-[#111111]" [style.backgroundColor]="wf.accent">
                        {{ wf.previewDelta }}
                      </span>
                    </div>
                    <p class="font-headline uppercase text-4xl sm:text-5xl font-bold text-[#fff6e8] tracking-wide mt-5 leading-none">
                      {{ wf.previewStat }}
                    </p>
                    <p class="text-sm text-[#a7a9be] mt-3 leading-relaxed">
                      {{ wf.previewNote }}
                    </p>
                    <div class="mt-6 pt-4 border-t border-white/[0.12] flex items-center justify-between">
                      <span class="text-xs text-[#a7a9be]">Ready in your brand workspace</span>
                      <a routerLink="/auth" [queryParams]="{mode: 'signup'}" class="font-headline uppercase text-base font-bold text-[#f54e26] hover:text-[#fff6e8] transition-colors">
                        TRY THIS WORKFLOW ↗
                      </a>
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        </section>

        <!-- ================= BAND 5: BEFORE / AFTER SWITCHER + COLOR-BLOCKED CARDS ================= -->
        <section class="py-12 sm:py-20 overflow-hidden">
          <div class="py-5 overflow-hidden select-none">
            <div class="animate-marquee-slow font-headline uppercase font-bold text-4xl sm:text-6xl tracking-[0.02em] text-[#2b2b2e] whitespace-nowrap flex items-center gap-8">
              <span>NO MORE SCREENSHOTS.</span>
              <span>ONE PUBLIC LINK.</span>
              <span>RESPECT CREATORS TIME.</span>
              <span>TRUST THE NUMBERS.</span>
              <span>GET FRIDAYS BACK.</span>
              <span>NO MORE SCREENSHOTS.</span>
              <span>ONE PUBLIC LINK.</span>
              <span>RESPECT CREATORS TIME.</span>
              <span>TRUST THE NUMBERS.</span>
              <span>GET FRIDAYS BACK.</span>
            </div>
          </div>

          <div class="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 mt-8 mb-10 flex flex-col items-center text-center">
            <div class="relative inline-block">
              <div class="hidden sm:flex w-11 h-10 rounded-t-2xl rounded-br-2xl bg-[#007656] text-[#ffccde] font-headline font-bold text-2xl items-center justify-center -rotate-12 absolute -left-10 -top-6 shadow-md select-none">
                “”
              </div>
              <h2 class="font-headline uppercase font-bold text-4xl sm:text-5xl tracking-[0.01em] text-[#fff6e8]">
                WHY TEAMS ACTUALLY SWITCHED
              </h2>
            </div>

            <!-- Interactive Before / After Comparison Switch -->
            <div class="mt-6 inline-grid grid-cols-2 p-1 rounded-[4px] bg-[#111111] border border-white/[0.18]">
              <button type="button" (click)="compareMode.set('after')"
                      class="px-4 py-2 rounded-[3px] font-headline uppercase text-base tracking-[0.03em] font-bold cursor-pointer transition-colors"
                      [ngClass]="compareMode() === 'after' ? 'bg-[#f54e26] text-[#111111]' : 'text-[#a7a9be] hover:text-[#fff6e8]'">
                WITH CONVERGE
              </button>
              <button type="button" (click)="compareMode.set('before')"
                      class="px-4 py-2 rounded-[3px] font-headline uppercase text-base tracking-[0.03em] font-bold cursor-pointer transition-colors"
                      [ngClass]="compareMode() === 'before' ? 'bg-[#fff6e8] text-[#111111]' : 'text-[#a7a9be] hover:text-[#fff6e8]'">
                THE OLD WAY (DMS)
              </button>
            </div>
          </div>

          <div class="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              @for (card of activeCompareCards(); track card.tag) {
                <div class="rounded-2xl text-[#1b1b1b] p-6 sm:p-7 flex flex-col justify-between min-h-[235px] card-hover transition-all duration-200"
                     [style.backgroundColor]="card.bg">
                  <div>
                    <h3 class="font-headline uppercase font-bold text-2xl leading-tight">
                      {{ card.title }}
                    </h3>
                    <p class="mt-3 text-sm leading-relaxed text-[#1b1b1b]/85">
                      {{ card.body }}
                    </p>
                  </div>
                  <div class="mt-6 flex items-center gap-2.5">
                    <span class="px-2.5 py-0.5 rounded-[4px] bg-[#5738af] text-[#fff6e8] text-[11px] font-semibold">{{ card.tag }}</span>
                    <span class="text-xs font-medium text-[#1b1b1b]/75">{{ card.note }}</span>
                  </div>
                </div>
              }
            </div>
          </div>
        </section>

        <!-- ================= BAND 6: COMPACT FINAL CTA ================= -->
        <section class="py-14 sm:py-20 px-4 sm:px-6 lg:px-10 text-center">
          <div class="max-w-[960px] mx-auto">
            <p class="font-headline uppercase font-bold text-3xl sm:text-5xl leading-[1.15] tracking-[0.01em] text-[#fff6e8]">
              PASTE ONE
              <button type="button" (click)="jumpToDemo('card')" class="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#e940a5] text-[#fff6e8] text-sm align-middle mx-1 -rotate-6 shadow-md hover:scale-125 hover:rotate-6 transition-transform duration-200 cursor-pointer">IG</button>
              REEL URL, KEEP
              <button type="button" (click)="scrollTo('workflows')" class="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#fabf29] text-[#111111] text-sm align-middle mx-1 rotate-6 shadow-md hover:scale-125 hover:-rotate-6 transition-transform duration-200 cursor-pointer">✓</button>
              REAL NUMBERS FRESH, EXPORT CLEAN
              <button type="button" (click)="jumpToDemo('csv')" class="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#007656] text-[#fff6e8] text-xs align-middle mx-1 -rotate-3 shadow-md hover:scale-125 hover:rotate-6 transition-transform duration-200 cursor-pointer">CSV</button>
              RECAPS.
            </p>

            <div class="mt-14">
              @if (auth.isAuthenticated()) {
                <a [routerLink]="dashboardRoute()"
                   class="inline-flex items-center justify-center px-8 py-4 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] border-2 border-[#111111] shadow-[6px_6px_0px_#fff6e8] font-headline uppercase font-bold text-2xl sm:text-3xl tracking-[0.03em] transition-all">
                  OPEN WORKSPACE ↗
                </a>
              } @else {
                <a routerLink="/auth" [queryParams]="{mode: 'signup'}"
                   class="inline-flex items-center justify-center px-8 py-4 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] border-2 border-[#111111] shadow-[6px_6px_0px_#fff6e8] font-headline uppercase font-bold text-2xl sm:text-3xl tracking-[0.03em] transition-all">
                  GET STARTED FREE ↗
                </a>
              }
            </div>
          </div>
        </section>
      </main>

      <!-- ================= BAND 7: FULL-BLEED #F54E26 BRUTALIST FOOTER ================= -->
      <footer class="w-full bg-[#f54e26] text-[#111111] pt-12 pb-10 px-4 sm:px-6 lg:px-10">
        <div class="max-w-[1440px] mx-auto">
          <div class="flex flex-col md:flex-row items-start justify-between gap-8 pb-10">
            <a routerLink="/" class="font-headline uppercase font-bold text-4xl sm:text-5xl tracking-[0.02em] text-[#111111] leading-none">
              CONVERGE
            </a>

            <div class="grid grid-cols-2 gap-x-12 gap-y-2.5 text-sm font-medium text-[#111111]">
              <button (click)="scrollTo('story')" class="text-left hover:underline cursor-pointer">Calculator</button>
              <a routerLink="/legal" [queryParams]="{tab: 'privacy'}" class="hover:underline">Privacy Policy</a>
              <button (click)="scrollTo('how-it-works')" class="text-left hover:underline cursor-pointer">How it works</button>
              <a routerLink="/legal" [queryParams]="{tab: 'terms'}" class="hover:underline">Terms of Service</a>
              <button (click)="scrollTo('workflows')" class="text-left hover:underline cursor-pointer">Workflows</button>
              <a routerLink="/auth" class="hover:underline">Sign In</a>
            </div>

            <div class="flex flex-col md:items-end gap-3">
              @if (auth.isAuthenticated()) {
                <a [routerLink]="dashboardRoute()"
                   class="inline-flex items-center justify-center px-6 py-3 rounded-[4px] bg-[#1c1c1c] text-[#fff6e8] font-headline uppercase font-bold text-xl tracking-[0.03em] hover:bg-[#111111] transition-colors">
                  OPEN WORKSPACE ↗
                </a>
              } @else {
                <a routerLink="/auth" [queryParams]="{mode: 'signup'}"
                   class="inline-flex items-center justify-center px-6 py-3 rounded-[4px] bg-[#1c1c1c] text-[#fff6e8] font-headline uppercase font-bold text-xl tracking-[0.03em] hover:bg-[#111111] transition-colors">
                  GET IN &amp; TRY IT ↗
                </a>
              }
            </div>
          </div>

          <div class="border-t border-black/15 pt-8 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
            <div>
              <div class="flex items-center gap-3 mb-4">
                <span class="w-10 h-10 rounded-full bg-[#111111] text-[#fff6e8] font-headline font-bold text-xs flex items-center justify-center border-2 border-[#fff6e8]/40">
                  0 DMs
                </span>
                <p class="font-headline uppercase font-bold text-base sm:text-lg leading-tight text-[#111111]">
                  BUILT FOR CREATORS &amp; BRANDS<br/>
                  <span class="text-[#111111]/75">0 PASSWORDS ◆ 100% REAL NUMBERS</span>
                </p>
              </div>
              <p class="text-xs text-[#111111]/80 font-medium">
                © 2026 Converge. Built by humans for humans who are tired of chasing screenshots.
              </p>
            </div>

            <div class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#fff6e8] border-2 border-[#111111] shadow-[0_6px_0_#111111] select-none -rotate-2">
              <span class="font-headline uppercase font-bold text-lg tracking-tight text-[#f54e26] leading-none">
                no screenshot club
              </span>
              <span class="w-6 h-6 rounded-full bg-[#f54e26] border-2 border-[#111111] text-[#111111] text-xs font-black flex items-center justify-center">
                ☺
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  `
})
export class LandingComponent {
  readonly auth = inject(AuthService);
  elevatedHeader = signal(false);

  // Interactive Hero State
  selectedSampleId = signal<string>('sarah');
  demoView = signal<'card' | 'csv'>('card');
  demoRefreshing = signal(false);
  refreshNote = signal('Live Reel numbers');
  hoveredBarIdx = signal(4);
  csvDownloaded = signal(false);
  wordStrikeActive = signal(false);

  sampleReels = signal<SampleCreatorReel[]>([
    {
      id: 'sarah',
      handle: '@sarah.creates',
      campaign: 'Summer Glow Drop',
      reelTitle: 'Morning SPF Routine',
      url: 'instagram.com/reel/C8xK2pLm',
      views: 142800,
      likes: 8420,
      comments: 318,
      saves: 1940,
      accent: '#f54e26',
      bars: [28, 46, 72, 64, 92, 84, 78]
    },
    {
      id: 'kiran',
      handle: '@kiran.daily',
      campaign: 'Hydration Week',
      reelTitle: '3-Step Night Reset',
      url: 'instagram.com/reel/D1mQ9rTv',
      views: 89400,
      likes: 5120,
      comments: 194,
      saves: 1210,
      accent: '#fabf29',
      bars: [35, 58, 86, 94, 76, 62, 68]
    },
    {
      id: 'devon',
      handle: '@devon.lifts',
      campaign: 'Recovery Series',
      reelTitle: 'Post-Run Electrolytes',
      url: 'instagram.com/reel/B7nP4zKw',
      views: 214500,
      likes: 12900,
      comments: 482,
      saves: 3420,
      accent: '#007656',
      bars: [22, 40, 60, 88, 98, 90, 85]
    }
  ]);

  activeSample = computed(
    () => this.sampleReels().find(s => s.id === this.selectedSampleId()) || this.sampleReels()[0]
  );

  // Interactive Calculator State
  creatorCount = signal(15);
  followUpDmsSaved = computed(() => this.creatorCount() * 3);
  hoursSavedMonthly = computed(() => Math.max(1, Math.round((this.creatorCount() * 14) / 60 * 10) / 10));

  // Interactive Accordion & Workflow Explorer State
  openAccordionId = signal<string>('link');
  selectedWorkflowId = signal<string>('live');
  compareMode = signal<'after' | 'before'>('after');

  readonly accordionItems = [
    {
      id: 'link',
      title: 'DROP ONE PUBLIC LINK',
      body: 'Copy a published Instagram Reel URL and paste it into your workspace. Creators never connect private accounts or hand over passwords.'
    },
    {
      id: 'metrics',
      title: 'GET REAL POST NUMBERS',
      body: 'Views, likes, saves, and comments pull straight from the live post so nobody squints at cropped screenshots or outdated counts.'
    },
    {
      id: 'organize',
      title: 'ORGANIZE BRANDS & AGENCIES',
      body: 'Keep each brand workspace, partner agency roster, and creator list separated cleanly instead of buried under long chat threads.'
    },
    {
      id: 'export',
      title: 'DOWNLOAD CLEAN SPREADSHEETS',
      body: 'Need numbers for a client recap or Friday review? Export your full campaign table into a tidy CSV file in one click.'
    }
  ];

  readonly workflows: WorkflowItem[] = [
    {
      id: 'live',
      title: 'BEFORE ANY CLIENT CALL',
      primaryTag: 'Live Metrics',
      tags: ['Views', 'Likes', 'Saves', 'Comments'],
      previewHandle: '@sarah.creates',
      previewStat: '142.8K VIEWS',
      previewDelta: '+6.4K TODAY',
      previewNote: 'Updated directly from the live Reel right before your client review starts.',
      accent: '#f54e26'
    },
    {
      id: 'creators',
      title: 'ZERO FOLLOW-UP DMS',
      primaryTag: 'For Creators',
      tags: ['Public Link Only', 'No Passwords', 'Zero Apps'],
      previewHandle: 'Zero Back-And-Forth',
      previewStat: '0 SCREENSHOTS',
      previewDelta: 'NO PASSWORDS',
      previewNote: 'Creators simply share the live Reel link and get back to creating.',
      accent: '#fabf29'
    },
    {
      id: 'workspaces',
      title: 'BRANDS & PARTNER AGENCIES',
      primaryTag: 'Workspaces',
      tags: ['Multiple Brands', 'Agency Rosters', 'Shared Access'],
      previewHandle: 'Clean Separation',
      previewStat: 'ONE QUIET HOME',
      previewDelta: 'ACTIVE WORKSPACES',
      previewNote: 'Keep direct creators and agency-managed deliverables organized per brand.',
      accent: '#007656'
    },
    {
      id: 'csv',
      title: 'FRIDAY RECAP SPREADSHEETS',
      primaryTag: 'Exports',
      tags: ['One-Click CSV', 'Creator Handles', 'Ready to Share'],
      previewHandle: 'friday-recap.csv',
      previewStat: '1-CLICK DOWNLOAD',
      previewDelta: 'EXCEL READY',
      previewNote: 'Every creator view, like, and campaign total ready for finance or leadership.',
      accent: '#ffccde'
    }
  ];

  activeWorkflow = computed(
    () => this.workflows.find(w => w.id === this.selectedWorkflowId()) || this.workflows[0]
  );

  activeCompareCards = computed(() => {
    if (this.compareMode() === 'before') {
      return [
        {
          bg: '#fabf29',
          title: 'THREE DMS FOR ONE SCREENSHOT',
          body: 'Brand managers spend Friday mornings nudging creators over DM just to get cropped stats from a phone screen.',
          tag: 'Old Way',
          note: 'Slow & awkward'
        },
        {
          bg: '#d6d3cb',
          title: 'ASKING FOR ACCOUNT LOGINS',
          body: 'Creators hesitate to join tools that demand private Instagram credentials or third-party app installs.',
          tag: 'Friction',
          note: 'Privacy worry'
        },
        {
          bg: '#a7b2db',
          title: 'NUMBERS FROZEN ON DAY TWO',
          body: 'A screenshot taken on Tuesday is already wrong when a Reel picks up momentum before Friday.',
          tag: 'Stale Data',
          note: 'Wrong totals'
        },
        {
          bg: '#ffccde',
          title: 'TYPING NUMBERS INTO EXCEL BY HAND',
          body: 'Someone has to squint at fifteen screenshots and manually type every view and comment count.',
          tag: 'Manual Work',
          note: 'Error-prone'
        }
      ];
    }
    return [
      {
        bg: '#fabf29',
        title: 'NO MORE AWKWARD DM CHASING',
        body: 'Paste the Reel link once when the post goes live. Open Converge anytime without sending a single reminder.',
        tag: 'Brand Teams',
        note: 'Campaign Ops'
      },
      {
        bg: '#d6d3cb',
        title: 'CREATORS KEEP THEIR PASSWORDS',
        body: 'If the Reel is public, pasting the URL is all you need—zero creator logins or setup steps required.',
        tag: 'Creators',
        note: 'Zero setup'
      },
      {
        bg: '#a7b2db',
        title: 'VIEWS STILL GROW AFTER DAY ONE',
        body: 'Click refresh before Monday’s review and see current views, likes, saves, and comments immediately.',
        tag: 'Live Numbers',
        note: 'Client Ready'
      },
      {
        bg: '#ffccde',
        title: 'ONE SPREADSHEET ON FRIDAY',
        body: 'Click export once and download a clean CSV with every creator, handle, and Reel total ready to send.',
        tag: 'Reporting',
        note: 'CSV in 1 click'
      }
    ];
  });

  @HostListener('window:scroll')
  onWindowScroll() {
    this.elevatedHeader.set(window.scrollY > 12);
  }

  selectSample(id: string) {
    this.selectedSampleId.set(id);
    this.refreshNote.set('Live Reel numbers');
  }

  cycleSampleFromText() {
    const list = this.sampleReels();
    const idx = list.findIndex(item => item.id === this.selectedSampleId());
    const next = list[(idx + 1) % list.length];
    this.selectSample(next.id);
    this.demoView.set('card');
  }

  jumpToDemo(view: 'card' | 'csv') {
    this.demoView.set(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  simulateRefresh() {
    if (this.demoRefreshing()) return;
    this.demoRefreshing.set(true);
    const targetId = this.selectedSampleId();
    setTimeout(() => {
      this.sampleReels.update(list => list.map(item => {
        if (item.id !== targetId) return item;
        const deltaViews = 1400 + Math.floor(Math.random() * 900);
        const deltaLikes = 85 + Math.floor(Math.random() * 60);
        const deltaSaves = 24 + Math.floor(Math.random() * 20);
        return {
          ...item,
          views: item.views + deltaViews,
          likes: item.likes + deltaLikes,
          saves: item.saves + deltaSaves,
          comments: item.comments + 6
        };
      }));
      this.refreshNote.set('Updated just now ✓');
      this.demoRefreshing.set(false);
    }, 350);
  }

  downloadSampleCsv() {
    const rows = ['Creator,Campaign,Reel,Views,Likes,Saves,Comments'];
    for (const r of this.sampleReels()) {
      rows.push(`${r.handle},"${r.campaign}","${r.reelTitle}",${r.views},${r.likes},${r.saves},${r.comments}`);
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'converge-sample-recap.csv';
    a.click();
    URL.revokeObjectURL(url);
    this.csvDownloaded.set(true);
    setTimeout(() => this.csvDownloaded.set(false), 2600);
  }

  formatCompact(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  toggleAccordion(id: string) {
    this.openAccordionId.update(curr => curr === id ? '' : id);
  }

  dashboardRoute(): string {
    return this.auth.currentUser()?.role === 'SYSTEM_ADMIN' ? '/admin' : '/workspace';
  }

  scrollTo(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
