import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, Agency, AuditLog, Brand, Creator, CreatorInsightsBundle, DeliverableInsightsBundle, InstagramStatus, ReelDeliverable } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { ConfirmModalComponent } from '../components/confirm-modal.component';
import { CreatorInsightsViewComponent } from '../components/creator-insights-view.component';
import { ReelInsightsViewComponent } from '../components/reel-insights-view.component';
import { AppHeaderComponent } from '../components/app-header.component';
import { AppFooterComponent } from '../components/app-footer.component';
import { formatAuditSummary, formatAuditTitle } from '../utils/audit-format';

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModalComponent, CreatorInsightsViewComponent, ReelInsightsViewComponent, AppHeaderComponent, AppFooterComponent],
  template: `
    <div class="bg-background text-ink-primary font-body antialiased min-h-screen flex flex-col overflow-x-clip selection:bg-blue-container selection:text-ink-primary">
      <!-- Slim Unified Header -->
      <app-header brandLink="/workspace">
        <div header-left class="flex items-center gap-2 min-w-0">
          @if (currentBrand(); as b) {
            <span class="text-ink-secondary/40 text-sm hidden sm:inline">/</span>
            @if (brands().length > 1) {
              @if (brandMenuOpen()) {
                <div (click)="brandMenuOpen.set(false)" class="fixed inset-0 z-30"></div>
              }
              <div class="relative">
                <button type="button" (click)="brandMenuOpen.set(!brandMenuOpen())"
                        class="inline-flex items-center gap-1.5 h-7.5 bg-surface-container-soft hover:bg-surface-container-high text-ink-primary text-xs font-semibold px-3 rounded-full transition-colors cursor-pointer max-w-[190px] relative z-40">
                  <span class="truncate">{{ b.name }}</span>
                  <svg class="w-3.5 h-3.5 text-ink-secondary shrink-0 transition-transform" [class.rotate-180]="brandMenuOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                </button>
                @if (brandMenuOpen()) {
                  <div class="absolute left-0 mt-2 w-60 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-lg p-1.5 z-50 space-y-0.5 max-h-72 overflow-y-auto">
                    @for (item of brands(); track item.id) {
                      <button type="button" (click)="switchBrand(item.id); brandMenuOpen.set(false)"
                              class="w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer"
                              [ngClass]="selectedBrandId() === item.id ? 'bg-blue-container/60 text-primary font-semibold' : 'text-ink-primary hover:bg-surface-warm font-medium'">
                        <span class="truncate">{{ item.name }}</span>
                        @if (selectedBrandId() === item.id) {
                          <span class="text-primary font-bold shrink-0">✓</span>
                        }
                      </button>
                    }
                  </div>
                }
              </div>
            } @else {
              <span class="text-ink-secondary text-xs font-semibold truncate hidden sm:inline">{{ b.name }}</span>
            }
          }
        </div>

        <div header-right class="flex items-center gap-2 shrink-0">
          @if (currentBrand()) {
            <button type="button" (click)="triggerSync()" [disabled]="syncing()" class="h-8 px-3 rounded-full bg-surface-container text-ink-primary text-xs font-semibold hover:bg-surface-container-high active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-60">
              <svg class="w-3.5 h-3.5 shrink-0" [class.animate-spin]="syncing()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                <path d="M16 16h5v5"/>
              </svg>
              <span class="hidden sm:inline">{{ syncing() ? 'Syncing IG...' : 'Sync All IG' }}</span>
            </button>
          }
          <div class="hidden md:flex items-center gap-1.5 h-7 px-3 rounded-full bg-mint-container/75 text-xs font-semibold text-mint-green">
            <span class="w-1.5 h-1.5 rounded-full bg-mint-green"></span>
            <span class="truncate max-w-[120px]">{{ auth.currentUser()?.name || 'Brand Manager' }}</span>
          </div>
          <button type="button" (click)="showSignOutConfirm.set(true)"
                  class="h-8.5 px-4 rounded-[4px] bg-[#fff6e8] hover:bg-[#f54e26] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#f54e26] hover:shadow-[2px_2px_0px_#fff6e8] active:translate-x-[1px] active:translate-y-[1px] inline-flex items-center gap-1.5 font-headline uppercase tracking-[0.04em] text-sm font-bold cursor-pointer whitespace-nowrap transition-all">
            <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square" stroke-linejoin="miter">
              <path d="M11 4H5v16h6"/>
              <path d="M10 12h10"/>
              <path d="M16 8l4 4-4 4"/>
            </svg>
            <span>SIGN OUT</span>
          </button>
        </div>
      </app-header>

      <main class="relative flex-1 pt-5 pb-10 max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 w-full">
        <!-- Subtle Neutral Ambient Glows -->
        <div class="fixed top-12 left-1/4 w-[420px] h-[420px] pointer-events-none rounded-full bg-gradient-to-tr from-blue-container/20 via-surface-container/25 to-transparent blur-3xl -z-10"></div>
        <div class="fixed bottom-0 right-1/4 w-[360px] h-[360px] pointer-events-none rounded-full bg-blue-container/15 blur-3xl -z-10"></div>

        @if (!loaded()) {
          <div class="py-24 text-center text-sm text-ink-secondary flex flex-col items-center gap-3">
            <svg class="w-6 h-6 animate-spin text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9"/></svg>
            <span>Loading your brand workspace...</span>
          </div>
        } @else if (brands().length === 0) {
          <!-- Clean Waiting State -->
          <div class="max-w-lg mx-auto my-6 sm:my-10 p-6 sm:p-8 rounded-3xl bg-surface-container-lowest border border-surface-container-high shadow-sm text-center space-y-4 animate-fade-in-up">
            <div class="w-16 h-16 mx-auto rounded-2xl bg-[#111111] border border-white/15 flex items-center justify-center p-2.5">
              <img src="/converge-logo.svg" alt="Converge" class="w-full h-full object-contain"/>
            </div>
            <div>
              <span class="px-3 py-1 rounded-full bg-surface-container-soft text-ink-secondary text-xs font-semibold">No Brand Assigned Yet</span>
              <h1 class="font-headline text-2xl font-bold text-ink-primary mt-3">Waiting for Brand Assignment</h1>
              <p class="text-sm text-ink-secondary mt-2 leading-relaxed">
                Signed in as <strong class="text-ink-primary">{{ auth.currentUser()?.email }}</strong>. Ask your Converge System Admin to add this email when provisioning a brand—your workspace will appear here automatically.
              </p>
            </div>
            <button type="button" (click)="loadBrands()" class="h-10 px-6 rounded-full bg-primary hover:bg-primary-container text-on-primary text-xs sm:text-sm font-semibold shadow-sm cursor-pointer transition-all active:scale-95">
              Refresh Workspace
            </button>
          </div>
        } @else if (selectedReel(); as sr) {
          <app-reel-insights-view
            [reel]="sr"
            [creator]="selectedReelCreator()"
            [bundle]="selectedReelBundle()"
            [isLivePreview]="selectedReelIsLive()"
            [syncing]="syncingSingleReel()"
            [tracking]="trackingLiveReel()"
            (back)="closeReelInsights()"
            (syncReel)="syncSelectedReel($event)"
            (trackLiveReel)="trackSelectedLiveReel($event)"
            (copyUrl)="copyReelUrl($event)">
          </app-reel-insights-view>
        } @else if (inspectedCreator(); as ic) {
          <app-creator-insights-view
            [creator]="ic"
            [bundle]="inspectedBundle()"
            [reels]="creatorReels()"
            [drawerMedia]="drawerMedia()"
            [igStatus]="igStatus()"
            [loadingMedia]="loadingCreatorMedia()"
            [syncing]="syncingCreator()"
            [savingProfile]="savingInsightsProfile()"
            (close)="closeInspector()"
            (syncCreator)="syncCurrentCreator()"
            (saveProfile)="saveCreatorInsightsProfile($event)"
            (browseMedia)="loadDrawerRecentMedia($event)"
            (addReel)="submitReel($event)"
            (editDeliverable)="saveDeliverableEdit($event)"
            (syncReel)="syncSingleDeliverable($event)"
            (openReel)="openDeliverableInsights($event)"
            (openLiveMedia)="openDrawerLiveReelInsights($event)"
            (copyUrl)="copyReelUrl($event)"
            (requestDeleteReel)="deliverableToDelete.set($event)">
          </app-creator-insights-view>
        } @else {
          <!-- Workspace Header -->
          <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-surface-variant/60 animate-fade-in-up">
            <div>
              <div class="flex flex-wrap items-center gap-2 mb-1.5">
                <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-soft text-ink-secondary text-xs font-medium">
                  <span class="w-2 h-2 rounded-full bg-mint-green animate-pulse"></span>
                  <span>Brand Workspace • {{ currentBrand()?.name }}</span>
                </div>
                @if (igStatus(); as ig) {
                  <span
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                    [ngClass]="ig.configured ? 'bg-mint-container text-mint-green' : 'bg-marigold-container/75 text-tertiary'">
                    <span class="w-1.5 h-1.5 rounded-full" [ngClass]="ig.configured ? 'bg-mint-green' : 'bg-tertiary-fixed-dim'"></span>
                    {{ ig.configured ? 'Instagram Connected' : 'Instagram Setup Pending' }}
                  </span>
                }
              </div>
              <h1 class="font-headline text-2xl sm:text-3xl font-bold tracking-tight text-ink-primary">{{ viewTitle() }}</h1>
              <p class="text-ink-secondary text-xs sm:text-sm mt-1">{{ viewSubtitle() }}</p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button (click)="activeTab.set('instagram')" class="h-9.5 px-4 rounded-full bg-blue-container text-primary text-xs font-semibold hover:bg-primary hover:text-on-primary transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer">
                <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="4" y="4" width="16" height="16" rx="4.5"/>
                  <circle cx="12" cy="12" r="3.5"/>
                  <circle cx="16.8" cy="7.2" r="0.8" fill="currentColor" stroke="none"/>
                </svg>
                <span>Fetch from Instagram</span>
              </button>
              <button (click)="exportCsv()" class="h-9.5 px-4 rounded-full bg-surface-container text-ink-primary text-xs font-semibold hover:bg-surface-container-high transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer">
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>
                </svg>
                <span>Export CSV</span>
              </button>
              <button (click)="openAddCreatorModal()" class="btn-shimmer h-9.5 px-4.5 rounded-full bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-all flex items-center gap-1.5 shadow-sm cursor-pointer">
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="10" cy="8" r="3.5"/>
                  <path d="M4 19c1-3 3-4.5 6-4.5"/>
                  <path d="M18 13v6M15 16h6"/>
                </svg>
                <span>Add Creator</span>
              </button>
            </div>
          </div>

          <!-- Sub-Nav Tabs -->
          <div class="pt-4 pb-5">
            <nav class="inline-flex items-center gap-1 p-1 bg-surface-container-low border border-surface-container-high/70 rounded-full max-w-full overflow-x-auto no-scrollbar">
              <button type="button" (click)="activeTab.set('creators')" class="h-8 px-3.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      [ngClass]="activeTab() === 'creators' ? 'bg-primary text-on-primary shadow-2xs' : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-container/60'">
                <span>Creators Roster</span>
                <span class="px-1.5 py-0.5 rounded-full text-[10px] font-bold" [ngClass]="activeTab() === 'creators' ? 'bg-black/20 text-on-primary' : 'bg-surface-container-high text-ink-primary'">{{ creators().length }}</span>
              </button>
              <button type="button" (click)="activeTab.set('instagram')" class="h-8 px-3.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      [ngClass]="activeTab() === 'instagram' ? 'bg-primary text-on-primary shadow-2xs' : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-container/60'">
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="4" y="4" width="16" height="16" rx="4.5"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <span>Instagram Lookup</span>
              </button>
              <button type="button" (click)="activeTab.set('overview')" class="h-8 px-3.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      [ngClass]="activeTab() === 'overview' ? 'bg-primary text-on-primary shadow-2xs' : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-container/60'">
                <span>Overview</span>
              </button>
              <button type="button" (click)="activeTab.set('agencies')" class="h-8 px-3.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      [ngClass]="activeTab() === 'agencies' ? 'bg-primary text-on-primary shadow-2xs' : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-container/60'">
                <span>Linked Agencies</span>
                <span class="px-1.5 py-0.5 rounded-full text-[10px] font-bold" [ngClass]="activeTab() === 'agencies' ? 'bg-black/20 text-on-primary' : 'bg-surface-container-high text-ink-primary'">{{ agencies().length }}</span>
              </button>
              <button type="button" (click)="activeTab.set('audit'); loadAuditLogs()" class="h-8 px-3.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      [ngClass]="activeTab() === 'audit' ? 'bg-primary text-on-primary shadow-2xs' : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-container/60'">
                <span>Activity</span>
                <span class="w-1.5 h-1.5 rounded-full" [ngClass]="activeTab() === 'audit' ? 'bg-on-primary' : 'bg-mint-green'"></span>
              </button>
            </nav>
          </div>

          <!-- TAB: INSTAGRAM LOOKUP & CREATOR FETCHER -->
          @if (activeTab() === 'instagram') {
            <section class="space-y-5 animate-fade-in-up">
              <div class="bg-surface-container-lowest rounded-3xl p-5 sm:p-6 border border-surface-container-high shadow-sm space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 class="font-headline text-lg font-bold text-ink-primary">Fetch Creator Details from Instagram</h2>
                    <p class="text-xs text-ink-secondary mt-0.5">Look up public Creator &amp; Business profiles, followers, bio, and recent Reels.</p>
                  </div>
                  @if (igStatus(); as ig) {
                    <span class="px-3 py-1 rounded-full text-[11px] font-semibold self-start sm:self-center shrink-0"
                          [ngClass]="ig.configured ? 'bg-mint-container text-mint-green' : 'bg-marigold-container text-tertiary'">
                      {{ ig.configured ? 'Live Sync Ready' : 'Setup Pending' }}
                    </span>
                  }
                </div>

                @if (igStatus() && !igStatus()?.configured) {
                  <div class="p-3.5 rounded-2xl bg-marigold-container/45 border border-tertiary-fixed-dim/40 text-xs text-ink-primary flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <strong>Live Instagram insights are not enabled yet:</strong> You can still add creators and save Reel URLs now, and live metrics will appear automatically once Instagram access is active.
                    </div>
                    <button type="button" (click)="openAddCreatorModal(igLookupInput)" class="px-4 py-1.5 rounded-full bg-surface-container-lowest text-ink-primary font-semibold text-xs border border-surface-container-high shrink-0 cursor-pointer hover:bg-surface-cream">
                      + Add Manually Meanwhile
                    </button>
                  </div>
                }

                <form (ngSubmit)="searchInstagramProfile()" class="flex flex-col sm:flex-row gap-2.5">
                  <div class="group flex-1 flex items-center gap-2.5 h-10.5 px-4 rounded-full bg-surface-cream border border-surface-container-high focus-within:bg-surface-container-lowest focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 transition-all">
                    <svg class="doodle-svg w-4 h-4 text-secondary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="4" y="4" width="16" height="16" rx="4.5"/>
                      <circle cx="12" cy="12" r="3.5"/>
                      <circle cx="16.8" cy="7.2" r="0.8" fill="currentColor" stroke="none"/>
                    </svg>
                    <input
                      [(ngModel)]="igLookupInput"
                      name="igLookupHandle"
                      placeholder="Enter @username or https://instagram.com/username"
                      type="text"
                      required
                      class="w-full min-w-0 bg-transparent text-sm text-ink-primary placeholder:text-ink-secondary/50 focus:outline-none"/>
                  </div>
                  <button
                    type="submit"
                    [disabled]="igSearching()"
                    class="btn-shimmer h-10.5 px-6 rounded-full bg-primary hover:bg-primary-container text-on-primary text-xs sm:text-sm font-semibold shadow-sm cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 shrink-0">
                    @if (igSearching()) {
                      <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9"/></svg>
                      <span>Fetching...</span>
                    } @else {
                      <span>Fetch Creator Details</span>
                    }
                  </button>
                </form>

                @if (igSearchError()) {
                  <div class="p-3 rounded-2xl bg-coral-container/45 border border-secondary/20 text-secondary text-xs font-medium flex items-center justify-between gap-2 animate-pop-in">
                    <span>{{ igSearchError() }}</span>
                    <button type="button" (click)="igSearchError.set('')" class="cursor-pointer opacity-70 hover:opacity-100">✕</button>
                  </div>
                }
              </div>

              @if (igProfilePreview(); as p) {
                <div class="bg-surface-container-lowest rounded-3xl p-5 sm:p-6 border border-surface-container-high shadow-sm space-y-5 animate-pop-in">
                  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-surface-variant/40">
                    <div class="flex items-start sm:items-center gap-4 min-w-0">
                      @if (p.avatarUrl) {
                        <img [src]="p.avatarUrl" [alt]="p.name" (error)="p.avatarUrl = ''" class="w-16 h-16 rounded-full object-cover border border-surface-container-high shrink-0"/>
                      } @else {
                        <div class="w-16 h-16 rounded-full bg-blue-container text-primary font-headline font-bold text-xl flex items-center justify-center shrink-0">
                          {{ (p.name || p.username || 'IG').substring(0, 2).toUpperCase() }}
                        </div>
                      }
                      <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2">
                          <h3 class="font-headline text-xl font-bold text-ink-primary truncate">{{ p.name || p.username }}</h3>
                          <span class="px-2.5 py-0.5 rounded-full bg-mint-container text-mint-green text-[11px] font-semibold">{{ p.source }}</span>
                        </div>
                        <a [href]="p.profileUrl" target="_blank" rel="noopener" class="text-xs font-mono text-primary hover:underline">{{ p.handle }} ↗</a>
                        @if (p.bio) {
                          <p class="text-xs text-ink-secondary mt-1.5 max-w-2xl leading-relaxed">{{ p.bio }}</p>
                        }
                        @if (p.website) {
                          <a [href]="p.website" target="_blank" rel="noopener" class="text-[11px] text-primary hover:underline block mt-1 truncate">{{ p.website }}</a>
                        }
                      </div>
                    </div>

                    <div class="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        (click)="addFetchedCreatorToRoster(p)"
                        [disabled]="addingFetched()"
                        class="btn-shimmer h-10 px-5 rounded-full bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold shadow-sm cursor-pointer disabled:opacity-60">
                        {{ addingFetched() ? 'Saving...' : '+ Add to Brand Roster' }}
                      </button>
                    </div>
                  </div>

                  <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div class="p-3.5 rounded-2xl bg-surface-warm/70 text-center">
                      <p class="text-[11px] text-ink-secondary uppercase font-semibold">Followers</p>
                      <p class="font-headline text-xl font-bold text-ink-primary mt-0.5">{{ p.followersDisplay || formatNum(p.followersCount) }}</p>
                    </div>
                    <div class="p-3.5 rounded-2xl bg-surface-warm/70 text-center">
                      <p class="text-[11px] text-ink-secondary uppercase font-semibold">{{ (p.publicViews30d || p.totalRecentViews || 0) > 0 ? 'Reel Views' : 'Following' }}</p>
                      <p class="font-headline text-xl font-bold text-primary mt-0.5">{{ (p.publicViews30d || p.totalRecentViews || 0) > 0 ? formatNum(p.publicViews30d || p.totalRecentViews || 0) : formatNum(p.followsCount) }}</p>
                    </div>
                    <div class="p-3.5 rounded-2xl bg-surface-warm/70 text-center">
                      <p class="text-[11px] text-ink-secondary uppercase font-semibold">{{ (p.publicInteractions30d || 0) > 0 ? 'Public Inter. (30d)' : 'Recent Interactions' }}</p>
                      <p class="font-headline text-xl font-bold text-primary mt-0.5">{{ formatNum(p.publicInteractions30d || p.totalRecentInteractions || 0) }}</p>
                    </div>
                    <div class="p-3.5 rounded-2xl bg-surface-warm/70 text-center">
                      <p class="text-[11px] text-ink-secondary uppercase font-semibold">Est. Inter. Rate</p>
                      <p class="font-headline text-xl font-bold text-mint-green mt-0.5">{{ (p.estimatedInteractionRate || 0) > 0 ? p.estimatedInteractionRate + '%' : '—' }}</p>
                    </div>
                    <div class="p-3.5 rounded-2xl bg-surface-warm/70 text-center col-span-2 sm:col-span-1">
                      <p class="text-[11px] text-ink-secondary uppercase font-semibold">Activity (28d)</p>
                      <p class="font-headline text-sm font-bold text-ink-primary mt-1.5">
                        {{ p.postedLast28Days ? 'Active in 28d' : 'No posts in 28d' }}
                      </p>
                    </div>
                  </div>

                  @if (p.suggestedManagementHandle || p.detectedBrandPartners?.length) {
                    <div class="flex flex-wrap items-center gap-2 text-xs">
                      @if (p.suggestedManagementHandle) {
                        <span class="px-3 py-1 rounded-full bg-blue-container/70 text-primary font-mono font-semibold">Mgmt: {{ p.suggestedManagementHandle }}</span>
                      }
                      @if (p.detectedBrandPartners?.length) {
                        <span class="px-3 py-1 rounded-full bg-surface-warm text-ink-primary font-medium">
                          Brand partners detected: {{ p.detectedBrandPartners.join(', ') }}
                        </span>
                      }
                    </div>
                  }

                  @if (p.recentMedia?.length) {
                    <div>
                      <h4 class="font-headline text-sm font-bold text-ink-primary mb-3">Recent Public Reels &amp; Posts ({{ p.recentMedia.length }})</h4>
                      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3.5 xl:gap-4">
                        @for (m of p.recentMedia; track m.id) {
                          <div (click)="openLookupReelInsights(m, p)" class="p-3.5 rounded-2xl bg-surface-cream border border-surface-container-high/70 hover:border-primary/40 flex flex-col justify-between gap-2.5 cursor-pointer transition-colors">
                            <div class="space-y-2">
                              @if (m.thumbnailUrl) {
                                <img [src]="m.thumbnailUrl" alt="Media preview" class="w-full h-36 object-cover rounded-xl bg-surface-container"/>
                              }
                              <div class="flex items-center justify-between gap-2">
                                <span class="px-2 py-0.5 rounded-full bg-blue-container/80 text-primary text-[10px] font-bold">{{ m.mediaProductType || m.mediaType }}</span>
                                <span class="text-[11px] text-ink-secondary font-medium">
                                  @if ((m.viewsCount || 0) > 0) {
                                    <span class="text-primary font-semibold">{{ formatNum(m.viewsCount) }} views • </span>
                                  }
                                  {{ formatNum(m.likeCount) }} likes • {{ m.commentsCount }} cmts
                                </span>
                              </div>
                              <p class="text-xs text-ink-primary line-clamp-2">{{ m.caption || 'No caption' }}</p>
                            </div>
                            <div class="flex items-center justify-between pt-2 border-t border-surface-variant/30 text-[11px]" (click)="$event.stopPropagation()">
                              <button type="button" (click)="openLookupReelInsights(m, p)" class="text-primary hover:underline font-semibold cursor-pointer">Reel Insights →</button>
                              <button type="button" (click)="copyReelUrl(m.permalink)" class="text-ink-secondary hover:text-ink-primary font-semibold cursor-pointer">Copy Reel URL</button>
                            </div>
                          </div>
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            </section>
          }

          <!-- TAB: OVERVIEW -->
          @if (activeTab() === 'overview') {
            <section class="space-y-5 animate-fade-in-up">
              <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div (click)="activeTab.set('agencies')" class="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-surface-container-high shadow-2xs flex items-center justify-between cursor-pointer hover:bg-surface-cream transition-colors">
                  <div>
                    <p class="text-[11px] uppercase font-semibold text-ink-secondary tracking-wider">Partner Agencies</p>
                    <p class="font-headline text-2xl sm:text-3xl font-bold text-ink-primary mt-1">{{ agencies().length }}</p>
                  </div>
                  <div class="w-10 h-10 rounded-2xl bg-blue-container text-primary flex items-center justify-center shrink-0">
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"/><circle cx="6" cy="17" r="2"/><circle cx="18" cy="17" r="2"/><path d="M12 7v4M12 11l-6 4M12 11l6 4"/></svg>
                  </div>
                </div>
                <div (click)="activeTab.set('creators')" class="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-surface-container-high shadow-2xs flex items-center justify-between cursor-pointer hover:bg-surface-cream transition-colors">
                  <div>
                    <p class="text-[11px] uppercase font-semibold text-ink-secondary tracking-wider">Creators</p>
                    <p class="font-headline text-2xl sm:text-3xl font-bold text-ink-primary mt-1">{{ creators().length }}</p>
                  </div>
                  <div class="w-10 h-10 rounded-2xl bg-surface-warm text-ink-secondary flex items-center justify-center shrink-0">
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.8-3 2.7-4.5 5.5-4.5s4.7 1.5 5.5 4.5"/><circle cx="17" cy="9.5" r="2.2"/><path d="M16 14.5c2 0 3.7 1 4.5 3.5"/></svg>
                  </div>
                </div>
                <div class="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-surface-container-high shadow-2xs flex items-center justify-between">
                  <div>
                    <p class="text-[11px] uppercase font-semibold text-ink-secondary tracking-wider">Verified Reach</p>
                    <p class="font-headline text-2xl sm:text-3xl font-bold text-ink-primary mt-1">{{ formatNum(stats().totalReach) }}</p>
                  </div>
                  <div class="w-10 h-10 rounded-2xl bg-marigold-container/60 text-tertiary flex items-center justify-center shrink-0">
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.5"/></svg>
                  </div>
                </div>
                <div (click)="activeTab.set('audit'); loadAuditLogs()" class="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-surface-container-high shadow-2xs flex items-center justify-between cursor-pointer hover:bg-surface-cream transition-colors">
                  <div>
                    <p class="text-[11px] uppercase font-semibold text-ink-secondary tracking-wider">Deliverables</p>
                    <p class="font-headline text-2xl sm:text-3xl font-bold text-ink-primary mt-1">{{ stats().totalReels }}</p>
                  </div>
                  <div class="w-10 h-10 rounded-2xl bg-mint-container text-mint-green flex items-center justify-center shrink-0">
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div class="lg:col-span-2 bg-surface-container-lowest rounded-3xl p-5 border border-surface-container-high shadow-2xs">
                  <div class="flex items-center justify-between mb-3.5">
                    <h3 class="font-headline text-base font-bold text-ink-primary">Partner Agencies</h3>
                    <button (click)="showAgencyModal.set(true)" class="text-xs font-semibold text-primary hover:underline cursor-pointer">+ Connect Agency</button>
                  </div>
                  @if (agencies().length === 0) {
                    <p class="text-xs text-ink-secondary py-6 text-center">No partner agencies linked yet.</p>
                  } @else {
                    <div class="space-y-2.5">
                      @for (ag of agencies(); track ag.id) {
                        <div (click)="activeTab.set('agencies')" class="p-3.5 rounded-2xl bg-surface-warm/70 hover:bg-surface-container-soft transition-colors flex items-center justify-between cursor-pointer">
                          <div class="flex items-center gap-3 min-w-0">
                            <div class="w-9 h-9 rounded-2xl bg-blue-container text-primary font-bold flex items-center justify-center text-xs shrink-0">{{ ag.monogram }}</div>
                            <div class="min-w-0">
                              <p class="font-headline font-semibold text-xs text-ink-primary truncate">{{ ag.name }}</p>
                              <p class="text-[11px] text-ink-secondary truncate">{{ ag.roleBadge }} • {{ ag.region }}</p>
                            </div>
                          </div>
                          <span class="text-[11px] font-semibold text-mint-green shrink-0">{{ ag.status }}</span>
                        </div>
                      }
                    </div>
                  }
                </div>

                <div class="bg-surface-container-lowest rounded-3xl p-5 border border-surface-container-high shadow-2xs flex flex-col justify-between gap-4">
                  <div>
                    <h3 class="font-headline text-base font-bold text-ink-primary mb-2">Direct Creators</h3>
                    @if (directCreators().length === 0) {
                      <p class="text-xs text-ink-secondary py-4">No creators added yet.</p>
                    } @else {
                      <div class="space-y-2 mt-2">
                        @for (c of directCreators().slice(0, 4); track c.id) {
                          <div class="p-2.5 rounded-2xl bg-surface-warm/60 border border-surface-variant/40 flex items-center justify-between gap-2">
                            <div class="min-w-0">
                              <p class="font-headline font-semibold text-xs text-ink-primary truncate">{{ c.name }}</p>
                              <p class="text-[11px] text-ink-secondary truncate">{{ c.handle }} • {{ c.followersDisplay || '—' }}</p>
                            </div>
                            <button (click)="inspectCreator(c)" class="text-xs text-primary font-semibold hover:underline cursor-pointer shrink-0">Open</button>
                          </div>
                        }
                      </div>
                    }
                  </div>
                  <div class="flex gap-2">
                    <button (click)="activeTab.set('instagram')" class="flex-1 h-9 rounded-full bg-blue-container text-primary text-xs font-semibold cursor-pointer hover:bg-primary hover:text-on-primary transition-colors">Fetch from IG</button>
                    <button (click)="openAddCreatorModal()" class="flex-1 h-9 rounded-full bg-surface-warm hover:bg-surface-container text-ink-primary text-xs font-semibold cursor-pointer">Add Creator</button>
                  </div>
                </div>
              </div>
            </section>
          }

          <!-- TAB: LINKED AGENCIES -->
          @if (activeTab() === 'agencies') {
            <section class="space-y-5 animate-fade-in-up">
              <div class="bg-surface-container-lowest rounded-3xl p-4 sm:p-5 border border-surface-container-high shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div class="group flex-1 sm:max-w-md flex items-center gap-2.5 h-9.5 px-3.5 rounded-full bg-surface-cream border border-surface-container-high focus-within:bg-surface-container-lowest focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 transition-all">
                  <svg class="doodle-svg w-4 h-4 text-ink-secondary group-focus-within:text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>
                  <input [(ngModel)]="agencySearch" (ngModelChange)="agencySearchSig.set($event)" placeholder="Search partner agencies..." class="w-full min-w-0 bg-transparent text-xs sm:text-sm text-ink-primary placeholder:text-ink-secondary/50 focus:outline-none"/>
                </div>
                <button (click)="showAgencyModal.set(true)" class="h-10 px-4.5 rounded-full bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container flex items-center justify-center gap-1.5 cursor-pointer shrink-0">
                  <span>+ Connect Agency</span>
                </button>
              </div>

              @if (filteredAgencies().length === 0) {
                <div class="p-10 rounded-3xl bg-surface-container-lowest border border-dashed border-outline-variant text-center">
                  <p class="text-sm text-ink-secondary">No partner agencies found. Click "+ Connect Agency" to add one.</p>
                </div>
              } @else {
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 xl:gap-5">
                  @for (ag of filteredAgencies(); track ag.id) {
                    <div (click)="filterByAgency(ag.name)" class="bg-surface-container-lowest rounded-2xl p-5 border border-surface-container-high shadow-2xs flex items-center justify-between hover:bg-surface-cream transition-colors cursor-pointer">
                      <div class="flex items-center gap-3 min-w-0">
                        <div class="w-11 h-11 rounded-2xl bg-blue-container text-primary font-headline font-bold flex items-center justify-center text-sm shrink-0">{{ ag.monogram }}</div>
                        <div class="min-w-0">
                          <h4 class="font-headline font-bold text-sm text-ink-primary truncate">{{ ag.name }}</h4>
                          <p class="text-xs text-ink-secondary truncate">{{ ag.roleBadge }} • {{ ag.creatorsCount }} Creators</p>
                        </div>
                      </div>
                      <span class="px-2.5 py-0.5 rounded-full bg-mint-container text-mint-green text-[10px] font-semibold shrink-0">{{ ag.status }}</span>
                    </div>
                  }
                </div>
              }
            </section>
          }

          <!-- TAB: ASSOCIATED CREATORS -->
          @if (activeTab() === 'creators') {
            <section class="space-y-5 animate-fade-in-up">
              <div class="bg-surface-container-lowest rounded-3xl p-4 sm:p-5 border border-surface-container-high shadow-2xs space-y-3">
                <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                  <div class="group flex-1 md:max-w-lg flex items-center gap-2.5 h-9.5 px-3.5 rounded-full bg-surface-cream border border-surface-container-high focus-within:bg-surface-container-lowest focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 transition-all">
                    <svg class="doodle-svg w-4 h-4 text-ink-secondary group-focus-within:text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>
                    <input [(ngModel)]="creatorSearch" (ngModelChange)="creatorSearchSig.set($event)" placeholder="Search creators by name, @handle, or niche..." class="w-full min-w-0 bg-transparent text-xs sm:text-sm text-ink-primary placeholder:text-ink-secondary/50 focus:outline-none"/>
                  </div>
                  <div class="relative shrink-0">
                    @if (agencyMenuOpen()) {
                      <div (click)="agencyMenuOpen.set(false)" class="fixed inset-0 z-30"></div>
                    }
                    <button type="button" (click)="agencyMenuOpen.set(!agencyMenuOpen())"
                            class="h-9.5 px-4 rounded-full bg-surface-cream hover:bg-surface-container-soft border border-surface-container-high text-xs font-semibold text-ink-primary inline-flex items-center gap-2 cursor-pointer transition-colors relative z-40">
                      <span>{{ selectedAgencyFilter === 'all' ? ('All Partner Agencies (' + agencies().length + ')') : selectedAgencyFilter }}</span>
                      <svg class="w-3.5 h-3.5 text-ink-secondary shrink-0 transition-transform" [class.rotate-180]="agencyMenuOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                    @if (agencyMenuOpen()) {
                      <div class="absolute right-0 mt-2 w-64 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-lg p-1.5 z-50 space-y-0.5 max-h-72 overflow-y-auto">
                        <button type="button" (click)="selectedAgencyFilter = 'all'; selectedAgencySig.set('all'); agencyMenuOpen.set(false)"
                                class="w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer"
                                [ngClass]="selectedAgencyFilter === 'all' ? 'bg-blue-container/60 text-primary font-semibold' : 'text-ink-primary hover:bg-surface-warm font-medium'">
                          <span>All Partner Agencies ({{ agencies().length }})</span>
                          @if (selectedAgencyFilter === 'all') {
                            <span class="text-primary font-bold shrink-0">✓</span>
                          }
                        </button>
                        @for (ag of agencies(); track ag.id) {
                          <button type="button" (click)="selectedAgencyFilter = ag.name; selectedAgencySig.set(ag.name); agencyMenuOpen.set(false)"
                                  class="w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer"
                                  [ngClass]="selectedAgencyFilter === ag.name ? 'bg-blue-container/60 text-primary font-semibold' : 'text-ink-primary hover:bg-surface-warm font-medium'">
                            <span class="truncate">{{ ag.name }}</span>
                            @if (selectedAgencyFilter === ag.name) {
                              <span class="text-primary font-bold shrink-0">✓</span>
                            }
                          </button>
                        }
                      </div>
                    }
                  </div>
                </div>
                <div class="flex items-center gap-1.5 pt-2 border-t border-surface-variant/40 flex-wrap">
                  <button type="button" (click)="creatorTypeFilter.set('all')" class="h-8 px-3.5 rounded-full text-xs font-semibold cursor-pointer transition-colors"
                          [ngClass]="creatorTypeFilter() === 'all' ? 'bg-blue-container text-primary' : 'bg-surface-container-soft text-ink-secondary hover:bg-surface-container'">
                    All Creators ({{ creators().length }})
                  </button>
                  <button type="button" (click)="creatorTypeFilter.set('DIRECT')" class="h-8 px-3.5 rounded-full text-xs font-semibold cursor-pointer transition-colors"
                          [ngClass]="creatorTypeFilter() === 'DIRECT' ? 'bg-blue-container text-primary' : 'bg-surface-container-soft text-ink-secondary hover:bg-surface-container'">
                    Direct ({{ directCount() }})
                  </button>
                  <button type="button" (click)="creatorTypeFilter.set('AGENCY')" class="h-8 px-3.5 rounded-full text-xs font-semibold cursor-pointer transition-colors"
                          [ngClass]="creatorTypeFilter() === 'AGENCY' ? 'bg-blue-container text-primary' : 'bg-surface-container-soft text-ink-secondary hover:bg-surface-container'">
                    Agency Managed ({{ agencyCount() }})
                  </button>
                </div>
              </div>

              @if (filteredCreators().length === 0) {
                <div class="p-8 sm:p-10 rounded-3xl bg-surface-container-lowest border border-dashed border-outline-variant text-center space-y-3">
                  <p class="text-sm text-ink-secondary">No creators in your roster yet. Fetch a live Instagram profile or add a creator directly.</p>
                  <div class="flex flex-wrap items-center justify-center gap-2">
                    <button (click)="activeTab.set('instagram')" class="px-5 py-2 rounded-full bg-blue-container text-primary text-xs font-semibold cursor-pointer">Fetch from Instagram</button>
                    <button (click)="openAddCreatorModal()" class="px-5 py-2 rounded-full bg-primary text-on-primary text-xs font-semibold cursor-pointer">+ Add Creator</button>
                  </div>
                </div>
              } @else {
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 xl:gap-5">
                  @for (c of filteredCreators(); track c.id) {
                    <div class="bg-surface-container-lowest rounded-3xl p-5 border border-surface-container-high shadow-2xs flex flex-col justify-between hover:bg-surface-cream/60 transition-colors">
                      <div>
                        <div class="flex items-start justify-between gap-2">
                          <div (click)="inspectCreator(c)" class="flex items-center gap-3 cursor-pointer min-w-0">
                            @if (c.avatarUrl) {
                              <img [src]="c.avatarUrl" [alt]="c.name" (error)="c.avatarUrl = null" class="w-11 h-11 rounded-full object-cover border border-surface-container-high shrink-0"/>
                            } @else {
                              <div class="w-11 h-11 rounded-full bg-blue-container text-primary font-bold flex items-center justify-center shrink-0">
                                {{ c.name.substring(0, 2).toUpperCase() }}
                              </div>
                            }
                            <div class="min-w-0">
                              <div class="flex items-center gap-1.5">
                                <h4 class="font-headline font-bold text-sm text-ink-primary hover:text-primary truncate">{{ c.name }}</h4>
                                @if (c.verified) {
                                  <span class="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-primary text-on-primary text-[9px] shrink-0">✓</span>
                                }
                              </div>
                              <p class="text-xs font-mono text-ink-secondary truncate">
                                {{ c.handle }}{{ c.managementHandle ? ' • ' + c.managementHandle : '' }}
                              </p>
                              @if (c.category || c.country) {
                                <p class="text-[10px] text-ink-secondary/85 truncate mt-0.5">
                                  {{ c.category || c.niche }}{{ c.country ? ' • ' + c.country : '' }}
                                </p>
                              }
                            </div>
                          </div>
                          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                                [ngClass]="c.igConnected ? 'bg-mint-container text-mint-green' : (c.sourceType === 'DIRECT' ? 'bg-marigold-container/80 text-tertiary' : 'bg-blue-container text-primary')">
                            {{ c.igConnected ? 'Connected' : (c.sourceType === 'DIRECT' ? 'Direct' : c.agencyName) }}
                          </span>
                        </div>

                        <div (click)="inspectCreator(c)" class="mt-4 grid grid-cols-4 gap-1.5 p-2.5 rounded-2xl bg-surface-warm/70 cursor-pointer hover:bg-surface-container-soft transition-colors text-center">
                          <div>
                            <span class="text-[10px] text-ink-secondary block">Followers</span>
                            <span class="font-bold text-xs text-ink-primary">{{ c.followersDisplay || '—' }}</span>
                          </div>
                          <div>
                            <span class="text-[10px] text-ink-secondary block">{{ (c.totalViews30d || 0) > 0 ? 'Views (30d)' : 'Interactions' }}</span>
                            <span class="font-bold text-xs text-primary">{{ (c.totalViews30d || 0) > 0 ? formatNum(c.totalViews30d || 0) : ((c.accountInteractions30d || 0) > 0 ? formatNum(c.accountInteractions30d || 0) : '—') }}</span>
                          </div>
                          <div>
                            <span class="text-[10px] text-ink-secondary block">Inter. Rate</span>
                            <span class="font-bold text-xs text-mint-green">{{ (c.interactionRate90d || c.engagementRate) > 0 ? (c.interactionRate90d || c.engagementRate) + '%' : '—' }}</span>
                          </div>
                          <div>
                            <span class="text-[10px] text-ink-secondary block">Posts</span>
                            <span class="font-bold text-xs text-tertiary">{{ c.mediaCount || '—' }}</span>
                          </div>
                        </div>
                      </div>

                      <div class="mt-4 pt-3 border-t border-surface-variant/40 flex items-center justify-between gap-2">
                        <button (click)="inspectCreator(c)" class="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer">
                          <span>Insights &amp; Reels ({{ c.auditedReelsCount }}) →</span>
                        </button>
                        <div class="flex items-center gap-2">
                          <button (click)="syncCreatorRow(c)" class="text-[11px] font-semibold text-ink-secondary hover:text-primary cursor-pointer">Sync IG</button>
                          <button (click)="creatorToDelete.set(c)" class="text-[11px] font-semibold text-secondary hover:underline cursor-pointer">Remove</button>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              }
            </section>
          }

          <!-- TAB: AUDIT LOGS -->
          @if (activeTab() === 'audit') {
            <section class="space-y-5 animate-fade-in-up">
              <div class="bg-surface-container-lowest rounded-3xl p-5 border border-surface-container-high shadow-2xs">
                <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 class="font-headline text-base font-bold text-ink-primary">Live Deliverables Sync</h3>
                    <p class="text-xs text-ink-secondary">Activity history for {{ currentBrand()?.name }}</p>
                  </div>
                  <button (click)="triggerSync()" [disabled]="syncing()" class="h-9 px-4 rounded-full bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container flex items-center gap-1.5 cursor-pointer disabled:opacity-60">
                    <span>{{ syncing() ? 'Syncing...' : 'Sync All Deliverables' }}</span>
                  </button>
                </div>
                @if (auditLogs().length === 0) {
                  <p class="text-xs text-ink-secondary py-6 text-center">No activity recorded yet.</p>
                } @else {
                  <div class="space-y-2.5">
                    @for (log of auditLogs(); track log.id) {
                      <div class="p-3.5 rounded-2xl bg-surface-warm/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div class="min-w-0">
                          <p class="text-xs font-semibold text-ink-primary">{{ cleanAuditTitle(log.title) }}</p>
                          <p class="text-[11px] text-ink-secondary mt-0.5">{{ cleanAuditSummary(log.description) }}</p>
                        </div>
                        <span class="text-[11px] text-ink-secondary shrink-0">{{ log.createdAt | date:'MMM d, h:mm a' }}</span>
                      </div>
                    }
                  </div>
                }
              </div>
            </section>
          }
        }
      </main>

      <!-- Add Direct Creator Modal -->
      @if (showAddCreatorModal()) {
        <div class="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-pop-in" (click)="modalCostMenuOpen.set(false); showAddCreatorModal.set(false)">
          <div class="bg-surface-container-lowest rounded-[28px] max-w-md w-full p-6 shadow-2xl border border-surface-container-high/80" (click)="$event.stopPropagation()">
            <div class="flex items-center justify-between pb-3 border-b border-surface-container-high/60">
              <h3 class="font-headline font-bold text-base text-ink-primary">Add Direct Creator</h3>
              <button type="button" (click)="modalCostMenuOpen.set(false); showAddCreatorModal.set(false)" class="w-8 h-8 rounded-full hover:bg-surface-warm flex items-center justify-center text-ink-secondary cursor-pointer">✕</button>
            </div>
            <form (ngSubmit)="submitDirectCreator()" class="space-y-3 pt-4">
              <div>
                <label class="block text-xs font-semibold text-ink-primary mb-1">Instagram Handle</label>
                <div class="flex gap-2">
                  <input [(ngModel)]="newCreatorHandle" name="cHandle" placeholder="@handle or URL" required class="flex-1 min-w-0 h-9.5 px-3.5 rounded-xl bg-surface-cream border border-surface-container-high text-sm text-ink-primary focus:bg-surface-container-lowest focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"/>
                  <button type="button" (click)="lookupCreatorIg()" [disabled]="igFetching()" class="h-9.5 px-3.5 rounded-xl bg-blue-container text-primary text-xs font-semibold hover:bg-primary hover:text-on-primary transition-colors cursor-pointer shrink-0 disabled:opacity-60">
                    {{ igFetching() ? 'Fetching...' : 'Fetch IG' }}
                  </button>
                </div>
                @if (igLookupHint()) {
                  <p class="text-[11px] text-ink-secondary mt-1">{{ igLookupHint() }}</p>
                }
              </div>
              <div>
                <label class="block text-xs font-semibold text-ink-primary mb-1">Creator Name</label>
                <input [(ngModel)]="newCreatorName" name="cName" placeholder="Creator full name" required class="w-full h-9.5 px-3.5 rounded-xl bg-surface-cream border border-surface-container-high text-sm text-ink-primary focus:bg-surface-container-lowest focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"/>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold text-ink-primary mb-1">Campaign</label>
                  <input [(ngModel)]="newCreatorCampaign" name="cCampaign" placeholder="Summer Launch" class="w-full h-9.5 px-3.5 rounded-xl bg-surface-cream border border-surface-container-high text-sm text-ink-primary focus:bg-surface-container-lowest focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"/>
                </div>
                <div>
                  <label class="block text-xs font-semibold text-ink-primary mb-1">Category / Niche</label>
                  <input [(ngModel)]="newCreatorNiche" name="cNiche" placeholder="Artist / Skincare" class="w-full h-9.5 px-3.5 rounded-xl bg-surface-cream border border-surface-container-high text-sm text-ink-primary focus:bg-surface-container-lowest focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"/>
                </div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold text-ink-primary mb-1">Management Handle</label>
                  <input [(ngModel)]="newCreatorManagement" name="cMgmt" placeholder="@stellaartalent" class="w-full h-9.5 px-3.5 rounded-xl bg-surface-cream border border-surface-container-high text-sm text-ink-primary focus:bg-surface-container-lowest focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"/>
                </div>
                <div>
                  <label class="block text-xs font-semibold text-ink-primary mb-1">Country</label>
                  <input [(ngModel)]="newCreatorCountry" name="cCountry" placeholder="India" class="w-full h-9.5 px-3.5 rounded-xl bg-surface-cream border border-surface-container-high text-sm text-ink-primary focus:bg-surface-container-lowest focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"/>
                </div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="relative">
                  <label class="block text-xs font-semibold text-ink-primary mb-1">Pricing Model</label>
                  @if (modalCostMenuOpen()) {
                    <div (click)="modalCostMenuOpen.set(false)" class="fixed inset-0 z-40"></div>
                  }
                  <button type="button" (click)="modalCostMenuOpen.set(!modalCostMenuOpen())"
                          class="w-full h-9.5 px-3.5 rounded-xl bg-surface-cream border border-surface-container-high text-sm text-ink-primary font-medium flex items-center justify-between gap-2 hover:bg-surface-container-soft transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer relative z-50">
                    <span>{{ newCreatorCostMode === 'PER_DELIVERABLE' ? 'Cost Per Deliverable' : 'Fixed Cost' }}</span>
                    <svg class="w-4 h-4 text-ink-secondary shrink-0 transition-transform" [class.rotate-180]="modalCostMenuOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                  </button>
                  @if (modalCostMenuOpen()) {
                    <div class="absolute left-0 right-0 mt-1.5 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-lg p-1.5 z-50 space-y-1">
                      <button type="button" (click)="newCreatorCostMode = 'COLLECTIVE'; modalCostMenuOpen.set(false)"
                              class="w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer"
                              [ngClass]="newCreatorCostMode === 'COLLECTIVE' ? 'bg-blue-container/60 text-primary font-semibold' : 'text-ink-primary hover:bg-surface-warm font-medium'">
                        <div>
                          <div class="text-sm leading-tight">Fixed Cost</div>
                          <div class="text-[11px] text-ink-secondary font-normal mt-0.5">Collective fee across deliverables</div>
                        </div>
                        @if (newCreatorCostMode === 'COLLECTIVE') {
                          <span class="text-primary font-bold">✓</span>
                        }
                      </button>
                      <button type="button" (click)="newCreatorCostMode = 'PER_DELIVERABLE'; modalCostMenuOpen.set(false)"
                              class="w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer"
                              [ngClass]="newCreatorCostMode === 'PER_DELIVERABLE' ? 'bg-blue-container/60 text-primary font-semibold' : 'text-ink-primary hover:bg-surface-warm font-medium'">
                        <div>
                          <div class="text-sm leading-tight">Cost Per Deliverable</div>
                          <div class="text-[11px] text-ink-secondary font-normal mt-0.5">Individual agreed rate per Reel</div>
                        </div>
                        @if (newCreatorCostMode === 'PER_DELIVERABLE') {
                          <span class="text-primary font-bold">✓</span>
                        }
                      </button>
                    </div>
                  }
                </div>
                <div>
                  <label class="block text-xs font-semibold text-ink-primary mb-1">
                    {{ newCreatorCostMode === 'PER_DELIVERABLE' ? 'Rate Per Deliverable (₹, Optional)' : 'Fixed Cost (₹, Optional)' }}
                  </label>
                  <input [(ngModel)]="newCreatorCost" name="cCost" type="number" min="0" step="100" placeholder="100000" class="w-full h-9.5 px-3.5 rounded-xl bg-surface-cream border border-surface-container-high text-sm text-ink-primary focus:bg-surface-container-lowest focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"/>
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold text-ink-primary mb-1">Email (Optional)</label>
                <input [(ngModel)]="newCreatorEmail" name="cEmail" placeholder="creator@domain.com" type="email" class="w-full h-9.5 px-3.5 rounded-xl bg-surface-cream border border-surface-container-high text-sm text-ink-primary focus:bg-surface-container-lowest focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"/>
              </div>
              <div class="pt-3 border-t border-surface-container-high/60 flex items-center justify-end gap-2">
                <button type="button" (click)="modalCostMenuOpen.set(false); showAddCreatorModal.set(false)" class="h-9 px-4 rounded-full bg-surface-container-soft hover:bg-surface-container text-xs font-semibold text-ink-secondary cursor-pointer transition-colors">Cancel</button>
                <button type="submit" class="h-9 px-5 rounded-full bg-primary text-on-primary text-xs font-semibold cursor-pointer hover:bg-primary-container transition-all">Add Creator</button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Connect Agency Modal -->
      @if (showAgencyModal()) {
        <div class="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-pop-in" (click)="showAgencyModal.set(false)">
          <div class="bg-surface-container-lowest rounded-[28px] max-w-md w-full p-6 shadow-2xl border border-surface-container-high/80" (click)="$event.stopPropagation()">
            <div class="flex items-center justify-between pb-3 border-b border-surface-container-high/60 mb-4">
              <h3 class="font-headline font-bold text-base text-ink-primary">Connect Partner Agency</h3>
              <button type="button" (click)="showAgencyModal.set(false)" class="w-8 h-8 rounded-full hover:bg-surface-warm flex items-center justify-center text-ink-secondary cursor-pointer">✕</button>
            </div>
            <form (ngSubmit)="submitAgency()" class="space-y-3">
              <div>
                <label class="block text-xs font-semibold text-ink-primary mb-1">Agency Name</label>
                <input [(ngModel)]="newAgencyName" name="agName" placeholder="Agency Name" required class="w-full h-9.5 px-3.5 rounded-xl bg-surface-cream border border-surface-container-high text-sm text-ink-primary focus:bg-surface-container-lowest focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"/>
              </div>
              <div>
                <label class="block text-xs font-semibold text-ink-primary mb-1">Agency Lead Email</label>
                <input [(ngModel)]="newAgencyEmail" name="agEmail" placeholder="Agency Lead Email" type="email" class="w-full h-9.5 px-3.5 rounded-xl bg-surface-cream border border-surface-container-high text-sm text-ink-primary focus:bg-surface-container-lowest focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"/>
              </div>
              <div class="flex justify-end gap-2 pt-3 border-t border-surface-container-high/60">
                <button type="button" (click)="showAgencyModal.set(false)" class="h-9 px-4 rounded-full bg-surface-container-soft hover:bg-surface-container text-xs font-semibold text-ink-secondary cursor-pointer transition-colors">Cancel</button>
                <button type="submit" class="h-9 px-5 rounded-full bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold cursor-pointer transition-all">Connect</button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Toast -->
      @if (toastMsg()) {
        <div class="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-surface-container-highest text-ink-primary border border-white/15 text-xs font-semibold shadow-xl animate-pop-in">
          {{ toastMsg() }}
        </div>
      }

      <!-- Delete Creator Confirmation Modal -->
      <app-confirm-modal
        [open]="!!creatorToDelete()"
        [title]="'Remove ' + (creatorToDelete()?.name || 'creator') + '?'"
        message="This removes the creator and all synced Reel deliverables from this brand workspace."
        confirmLabel="Remove Creator"
        tone="danger"
        (confirm)="creatorToDelete() && confirmDeleteCreator(creatorToDelete()!)"
        (cancel)="creatorToDelete.set(null)">
      </app-confirm-modal>

      <!-- Delete Deliverable Confirmation Modal -->
      <app-confirm-modal
        [open]="!!deliverableToDelete()"
        title="Delete Reel Deliverable?"
        message="This removes the tracked Reel deliverable and updates creator metrics."
        confirmLabel="Delete Reel"
        tone="danger"
        (confirm)="deliverableToDelete() && confirmDeleteDeliverable(deliverableToDelete()!)"
        (cancel)="deliverableToDelete.set(null)">
      </app-confirm-modal>

      <!-- Sign Out Confirmation Modal -->
      <app-confirm-modal
        [open]="showSignOutConfirm()"
        title="Sign out of Workspace?"
        message="You will be returned to the sign-in screen."
        confirmLabel="Sign Out"
        tone="primary"
        (confirm)="logout()"
        (cancel)="showSignOutConfirm.set(false)">
      </app-confirm-modal>

      <app-footer></app-footer>
    </div>
  `
})
export class WorkspaceComponent implements OnInit {
  loaded = signal(false);
  brands = signal<Brand[]>([]);
  selectedBrandId = signal<string>('');
  currentBrand = signal<Brand | null>(null);
  agencies = signal<Agency[]>([]);
  creators = signal<Creator[]>([]);
  auditLogs = signal<AuditLog[]>([]);
  stats = signal({ totalReels: 0, totalReach: 0, avgEngagement: 0, activeAgencies: 0, totalCreators: 0 });

  activeTab = signal<'creators' | 'instagram' | 'overview' | 'agencies' | 'audit'>('creators');
  syncing = signal(false);
  igFetching = signal(false);
  igLookupHint = signal('');
  igStatus = signal<InstagramStatus | null>(null);

  igLookupInput = '';
  igSearching = signal(false);
  igSearchError = signal('');
  igProfilePreview = signal<any | null>(null);
  addingFetched = signal(false);

  drawerMedia = signal<any[]>([]);
  loadingCreatorMedia = signal(false);

  toastMsg = signal('');
  showSignOutConfirm = signal(false);
  creatorToDelete = signal<Creator | null>(null);
  deliverableToDelete = signal<ReelDeliverable | null>(null);

  agencySearch = '';
  agencySearchSig = signal('');

  creatorSearch = '';
  creatorSearchSig = signal('');
  selectedAgencyFilter = 'all';
  selectedAgencySig = signal('all');
  creatorTypeFilter = signal<'all' | 'DIRECT' | 'AGENCY'>('all');

  inspectedCreator = signal<Creator | null>(null);
  inspectedBundle = signal<CreatorInsightsBundle | null>(null);
  creatorReels = signal<ReelDeliverable[]>([]);
  syncingCreator = signal(false);
  savingInsightsProfile = signal(false);

  selectedReel = signal<(ReelDeliverable & { publishedAt?: string }) | null>(null);
  selectedReelCreator = signal<Creator | null>(null);
  selectedReelBundle = signal<DeliverableInsightsBundle | null>(null);
  selectedReelIsLive = signal(false);
  syncingSingleReel = signal(false);
  trackingLiveReel = signal(false);

  brandMenuOpen = signal(false);
  agencyMenuOpen = signal(false);
  modalCostMenuOpen = signal(false);

  showAddCreatorModal = signal(false);
  newCreatorName = '';
  newCreatorHandle = '';
  newCreatorEmail = '';
  newCreatorCampaign = '';
  newCreatorNiche = '';
  newCreatorManagement = '';
  newCreatorCountry = '';
  newCreatorCostMode: 'COLLECTIVE' | 'PER_DELIVERABLE' = 'COLLECTIVE';
  newCreatorCost = '';

  showAgencyModal = signal(false);
  newAgencyName = '';
  newAgencyEmail = '';

  directCreators = computed(() => this.creators().filter(c => c.sourceType === 'DIRECT'));
  directCount = computed(() => this.directCreators().length);
  agencyCount = computed(() => this.creators().filter(c => c.sourceType === 'AGENCY').length);

  filteredAgencies = computed(() => {
    const q = this.agencySearchSig().toLowerCase();
    return this.agencies().filter(a => !q || a.name.toLowerCase().includes(q));
  });

  filteredCreators = computed(() => {
    const q = this.creatorSearchSig().toLowerCase();
    const ag = this.selectedAgencySig();
    const tp = this.creatorTypeFilter();
    return this.creators().filter(c => {
      const mType = tp === 'all' || c.sourceType === tp;
      const mAg = ag === 'all' || c.agencyName === ag;
      const mQ = !q || c.name.toLowerCase().includes(q) || c.handle.toLowerCase().includes(q) || (c.niche || '').toLowerCase().includes(q);
      return mType && mAg && mQ;
    });
  });

  viewTitle = computed(() => {
    switch (this.activeTab()) {
      case 'instagram': return 'Instagram Creator Explorer';
      case 'overview': return this.currentBrand()?.name || 'Brand Overview';
      case 'agencies': return 'Linked Agencies Network';
      case 'audit': return 'Activity & Live Sync';
      default: return 'Creators & Reels Roster';
    }
  });

  viewSubtitle = computed(() => {
    switch (this.activeTab()) {
      case 'instagram': return 'Look up live Instagram Creator metrics, followers, bio, and recent Reels.';
      case 'overview': return `Brand Workspace overview: ${this.agencies().length} partner agencies and ${this.creators().length} creators.`;
      case 'agencies': return `Supervise ${this.agencies().length} authorized agency partners managing delegated talent.`;
      case 'audit': return 'Live Instagram sync status and deliverable verification history.';
      default: return `Fetch creator details, inspect public Reels, and track campaign reach across ${this.creators().length} creators.`;
    }
  });

  constructor(
    private api: ApiService,
    public auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const code = params['code'];
      const creatorId = params['state'];
      if (code) {
        this.api.exchangeInstagramOAuthCode(code, creatorId).subscribe({
          next: () => {
            this.showToast('Creator Instagram connected for live Insights!');
            this.router.navigate([], { replaceUrl: true, queryParams: {} });
            if (this.selectedBrandId()) this.selectBrand(this.selectedBrandId());
          },
          error: (err) => {
            this.showToast(err?.error?.error || 'Could not connect Instagram account.');
            this.router.navigate([], { replaceUrl: true, queryParams: {} });
          }
        });
      }
    });

    this.loadBrands();
    this.api.getInstagramStatus().subscribe({
      next: (st) => this.igStatus.set(st),
      error: () => {}
    });
  }

  loadBrands() {
    this.api.listBrands().subscribe({
      next: (list) => {
        this.brands.set(list);
        this.loaded.set(true);
        if (list.length > 0) {
          this.selectBrand(list[0].id);
        }
      },
      error: () => {
        this.loaded.set(true);
      }
    });
  }

  switchBrand(brandId: string) {
    this.closeReelInsights();
    this.closeInspector();
    this.selectBrand(brandId);
  }

  selectBrand(brandId: string) {
    this.selectedBrandId.set(brandId);
    this.api.getBrandOverview(brandId).subscribe(res => {
      this.currentBrand.set(res.brand);
      this.agencies.set(res.agencies);
      this.creators.set(res.creators);
      this.stats.set(res.stats);
    });
  }

  loadAuditLogs() {
    if (!this.selectedBrandId()) return;
    this.api.listAuditLogs(this.selectedBrandId()).subscribe(res => {
      this.auditLogs.set(res.items);
    });
  }

  searchInstagramProfile() {
    if (!this.igLookupInput.trim()) return;
    this.igSearching.set(true);
    this.igSearchError.set('');
    this.igProfilePreview.set(null);
    this.api.lookupInstagramProfile(this.igLookupInput).subscribe({
      next: (profile) => {
        this.igSearching.set(false);
        this.igProfilePreview.set(profile);
      },
      error: (err) => {
        this.igSearching.set(false);
        this.igSearchError.set(err?.error?.error || 'Could not fetch profile from Instagram.');
      }
    });
  }

  addFetchedCreatorToRoster(profile: any) {
    if (!this.selectedBrandId()) return;
    this.addingFetched.set(true);
    this.api.addDirectCreator(this.selectedBrandId(), {
      name: profile.name || profile.username,
      handle: profile.handle,
      bio: profile.bio || '',
      managementHandle: profile.suggestedManagementHandle || '',
      previousBrandPartners: Array.isArray(profile.detectedBrandPartners) ? profile.detectedBrandPartners.join(', ') : ''
    }).subscribe({
      next: (created) => {
        this.addingFetched.set(false);
        this.selectBrand(this.selectedBrandId());
        this.activeTab.set('creators');
        this.inspectCreator(created);
        this.showToast(`Added ${created.handle} to workspace!`);
      },
      error: (err) => {
        this.addingFetched.set(false);
        this.showToast(err?.error?.error || 'Could not add creator.');
      }
    });
  }

  openAddCreatorModal(prefillHandle?: string) {
    if (prefillHandle) this.newCreatorHandle = prefillHandle.trim();
    this.igLookupHint.set('');
    this.modalCostMenuOpen.set(false);
    this.showAddCreatorModal.set(true);
  }

  inspectCreator(c: Creator) {
    this.inspectedCreator.set(c);
    this.inspectedBundle.set(null);
    this.drawerMedia.set([]);
    this.refreshCreatorInsights(c);
  }

  private refreshCreatorInsights(c: Creator) {
    this.api.getCreatorInsights(c.id).subscribe({
      next: (bundle) => {
        this.inspectedBundle.set(bundle);
        this.inspectedCreator.set(bundle.creator);
        this.creatorReels.set(bundle.deliverables);
        if (bundle.recentMedia?.length || this.drawerMedia().length === 0) {
          this.drawerMedia.set(bundle.recentMedia || []);
        }
        this.selectBrand(this.selectedBrandId());
      },
      error: () => {
        this.api.listCreatorDeliverables(c.id).subscribe(reels => {
          this.creatorReels.set(reels);
        });
      }
    });
  }

  closeInspector() {
    this.inspectedCreator.set(null);
    this.inspectedBundle.set(null);
  }

  saveCreatorInsightsProfile(payload: Record<string, any>) {
    const ic = this.inspectedCreator();
    if (!ic) return;
    this.savingInsightsProfile.set(true);
    this.api.updateCreatorInsightsProfile(ic.id, payload).subscribe({
      next: (bundle) => {
        this.savingInsightsProfile.set(false);
        this.inspectedBundle.set(bundle);
        this.inspectedCreator.set(bundle.creator);
        this.creatorReels.set(bundle.deliverables);
        if (bundle.recentMedia) this.drawerMedia.set(bundle.recentMedia);
        this.selectBrand(this.selectedBrandId());
        this.showToast('Creator rate & tags saved!');
      },
      error: (err) => {
        this.savingInsightsProfile.set(false);
        this.showToast(err?.error?.error || 'Could not update Creator Insights.');
      }
    });
  }

  loadDrawerRecentMedia(c: Creator) {
    this.loadingCreatorMedia.set(true);
    this.api.fetchInstagramMedia(c.handle, 12, c.id).subscribe({
      next: (items) => {
        this.loadingCreatorMedia.set(false);
        this.drawerMedia.set(items);
        if (items.length === 0) this.showToast('No recent public media found.');
      },
      error: (err) => {
        this.loadingCreatorMedia.set(false);
        this.showToast(err?.error?.error || 'Could not load recent IG media.');
      }
    });
  }

  connectCreatorOAuth(c: Creator) {
    this.api.getInstagramOAuthUrl(c.id).subscribe({
      next: (res) => {
        if (res.authorizeUrl) {
          navigator.clipboard?.writeText(res.authorizeUrl);
          this.showToast('Copied creator Instagram invite link (share to connect live Insights).');
        }
      },
      error: (err) => this.showToast(err?.error?.error || 'Creator sign-in connection is not enabled yet.')
    });
  }

  submitReel(payload: { title: string; reelUrl: string; costQuoted?: string }) {
    const ic = this.inspectedCreator();
    if (!ic || !payload.reelUrl.trim()) return;
    this.api.addReelDeliverable(ic.id, payload).subscribe({
      next: (reel) => {
        const existing = this.creatorReels().filter(r => r.id !== reel.id);
        this.creatorReels.set([reel, ...existing]);
        this.refreshCreatorInsights(ic);
        this.showToast(reel.status === 'VERIFIED' ? 'Reel synced from Instagram!' : 'Reel saved (metrics will sync once Instagram access is active).');
      },
      error: (err) => {
        this.creatorReels.set([...this.creatorReels()]);
        this.showToast(err?.error?.error || 'Could not add Reel deliverable.');
      }
    });
  }

  saveDeliverableEdit(payload: { id: string; title: string; costQuoted?: number | null }) {
    const body: { title?: string; costQuoted?: number | null } = { title: payload.title };
    if (payload.costQuoted !== undefined) {
      body.costQuoted = payload.costQuoted;
    }
    this.api.updateDeliverable(payload.id, body).subscribe({
      next: () => {
        const ic = this.inspectedCreator();
        if (ic) this.inspectCreator(ic);
        this.selectBrand(this.selectedBrandId());
        this.showToast('Deliverable updated!');
      },
      error: (err) => this.showToast(err?.error?.error || 'Could not update deliverable.')
    });
  }

  lookupCreatorIg() {
    if (!this.newCreatorHandle.trim()) return;
    this.igFetching.set(true);
    this.igLookupHint.set('');
    this.api.lookupInstagramProfile(this.newCreatorHandle).subscribe({
      next: (profile) => {
        this.igFetching.set(false);
        if (profile?.name && !this.newCreatorName.trim()) {
          this.newCreatorName = profile.name;
        }
        if (profile?.suggestedManagementHandle && !this.newCreatorManagement.trim()) {
          this.newCreatorManagement = profile.suggestedManagementHandle;
        }
        this.igLookupHint.set(`Found ${profile.handle} • ${profile.followersDisplay} followers`);
      },
      error: (err) => {
        this.igFetching.set(false);
        this.igLookupHint.set(err?.error?.error || 'Instagram profile lookup unavailable.');
      }
    });
  }

  syncCreatorRow(c: Creator) {
    this.api.syncCreatorInstagram(c.id).subscribe({
      next: (res) => {
        this.selectBrand(this.selectedBrandId());
        this.showToast(res.metaConfigured
          ? `Refreshed ${c.handle} (${res.verifiedDeliverables} verified reels).`
          : 'Live Instagram sync is not enabled on this workspace yet.');
      },
      error: (err) => this.showToast(err?.error?.error || 'Sync failed.')
    });
  }

  syncCurrentCreator() {
    const ic = this.inspectedCreator();
    if (!ic) return;
    this.syncingCreator.set(true);
    this.api.syncCreatorInstagram(ic.id).subscribe({
      next: (res) => {
        this.syncingCreator.set(false);
        this.inspectedBundle.set(res);
        this.inspectedCreator.set(res.creator);
        this.creatorReels.set(res.deliverables);
        if (res.recentMedia) {
          this.drawerMedia.set(res.recentMedia);
        } else if (res.metaConfigured) {
          this.loadDrawerRecentMedia(res.creator);
        }
        this.selectBrand(this.selectedBrandId());
        this.showToast(res.metaConfigured
          ? `Synced ${res.verifiedDeliverables} verified Reel(s) & Creator Insights.`
          : 'Live Instagram sync is not enabled on this workspace yet.');
      },
      error: (err) => {
        this.syncingCreator.set(false);
        this.showToast(err?.error?.error || 'Instagram sync failed.');
      }
    });
  }

  openDeliverableInsights(r: ReelDeliverable) {
    this.selectedReel.set(r);
    this.selectedReelCreator.set(this.inspectedCreator());
    this.selectedReelBundle.set(null);
    this.selectedReelIsLive.set(false);
    this.router.navigate([], { replaceUrl: true, queryParams: { reel: r.id } });
    this.api.getDeliverableInsights(r.id).subscribe({
      next: (bundle) => {
        this.selectedReel.set(bundle.deliverable);
        this.selectedReelCreator.set(bundle.creator);
        this.selectedReelBundle.set(bundle);
      },
      error: () => {}
    });
  }

  openDrawerLiveReelInsights(m: any) {
    const ic = this.inspectedCreator();
    if (!ic) return;
    this.openLiveMediaAsReelPage(m, ic);
  }

  openLookupReelInsights(m: any, profile: any) {
    const existing = this.creators().find(c => c.handle.toLowerCase() === (profile.handle || '').toLowerCase());
    const previewCreator: Creator = existing || {
      id: '',
      brandId: this.selectedBrandId(),
      agencyId: null,
      agencyName: 'Instagram Lookup',
      agencyBadge: '',
      name: profile.name || profile.username,
      handle: profile.handle,
      email: '',
      avatarUrl: profile.avatarUrl || null,
      niche: '',
      bio: profile.bio || '',
      followersDisplay: profile.followersDisplay || '—',
      followersCount: profile.followersCount || 0,
      sourceType: 'DIRECT',
      campaignName: '',
      reachCount: 0,
      auditedReelsCount: 0,
      engagementRate: profile.estimatedInteractionRate || 0,
      interactionRate90d: profile.estimatedInteractionRate || 0,
      status: 'PREVIEW',
      linkedAt: ''
    };
    this.openLiveMediaAsReelPage(m, previewCreator);
  }

  private openLiveMediaAsReelPage(m: any, creator: Creator) {
    const followers = creator.followersCount || 0;
    const views = m.viewsCount || 0;
    const likes = m.likeCount || 0;
    const cmts = m.commentsCount || 0;
    const denom = views > 0 ? views : followers;
    const eng = denom > 0 ? Math.round(((likes + cmts) * 100.0 / denom) * 100) / 100 : 0;

    const previewReel: ReelDeliverable & { publishedAt?: string } = {
      id: m.id,
      brandId: creator.brandId,
      creatorId: creator.id,
      creatorHandle: creator.handle,
      title: m.caption ? String(m.caption).slice(0, 60) : (m.mediaProductType || 'Instagram Reel'),
      reelUrl: m.permalink || '',
      igMediaId: m.id,
      shortcode: m.shortcode || '',
      mediaType: m.mediaProductType || m.mediaType || 'REELS',
      caption: m.caption || '',
      thumbnailUrl: m.thumbnailUrl || m.mediaUrl || '',
      duration: '0:30',
      viewsCount: views,
      likesCount: likes,
      commentsCount: cmts,
      engagementRate: eng,
      status: 'LIVE_PREVIEW',
      metricsSource: 'META_BUSINESS_DISCOVERY',
      syncedAt: new Date().toISOString(),
      publishedAt: m.timestamp
    };

    this.selectedReel.set(previewReel);
    this.selectedReelCreator.set(creator);
    this.selectedReelBundle.set(null);
    this.selectedReelIsLive.set(true);
  }

  closeReelInsights() {
    this.selectedReel.set(null);
    this.selectedReelBundle.set(null);
    this.selectedReelCreator.set(null);
    this.selectedReelIsLive.set(false);
    this.router.navigate([], { replaceUrl: true, queryParams: {} });
  }

  syncSelectedReel(deliverableId: string) {
    this.syncingSingleReel.set(true);
    this.api.syncDeliverableInstagram(deliverableId).subscribe({
      next: () => {
        this.api.getDeliverableInsights(deliverableId).subscribe({
          next: (bundle) => {
            this.syncingSingleReel.set(false);
            this.selectedReel.set(bundle.deliverable);
            this.selectedReelCreator.set(bundle.creator);
            this.selectedReelBundle.set(bundle);
            const ic = this.inspectedCreator();
            if (ic) this.inspectCreator(ic);
            this.selectBrand(this.selectedBrandId());
            this.showToast('Reel Insights refreshed!');
          },
          error: () => this.syncingSingleReel.set(false)
        });
      },
      error: (err) => {
        this.syncingSingleReel.set(false);
        this.showToast(err?.error?.error || 'Could not sync Reel.');
      }
    });
  }

  trackSelectedLiveReel(reel: ReelDeliverable) {
    const creator = this.selectedReelCreator();
    if (!creator || !creator.id) {
      this.showToast('Add this creator to your Brand Roster first to track deliverables.');
      return;
    }
    this.trackingLiveReel.set(true);
    this.api.addReelDeliverable(creator.id, {
      title: reel.title || 'Verified Campaign Reel',
      reelUrl: reel.reelUrl
    }).subscribe({
      next: (saved) => {
        this.trackingLiveReel.set(false);
        this.selectedReelIsLive.set(false);
        this.openDeliverableInsights(saved);
        const ic = this.inspectedCreator();
        if (ic) this.inspectCreator(ic);
        this.selectBrand(this.selectedBrandId());
        this.showToast('Reel tracked & verified!');
      },
      error: (err) => {
        this.trackingLiveReel.set(false);
        this.showToast(err?.error?.error || 'Could not track Reel.');
      }
    });
  }

  syncSingleDeliverable(deliverableId: string) {
    this.api.syncDeliverableInstagram(deliverableId).subscribe({
      next: (updated) => {
        const ic = this.inspectedCreator();
        if (ic) this.inspectCreator(ic);
        this.selectBrand(this.selectedBrandId());
        this.showToast(updated.status === 'VERIFIED' ? 'Deliverable refreshed!' : 'Saved — waiting for live Instagram sync to be enabled.');
      },
      error: (err) => this.showToast(err?.error?.error || 'Could not sync Reel.')
    });
  }

  confirmDeleteDeliverable(r: ReelDeliverable) {
    this.api.deleteDeliverable(r.id).subscribe({
      next: () => {
        this.deliverableToDelete.set(null);
        const ic = this.inspectedCreator();
        if (ic) this.inspectCreator(ic);
        this.selectBrand(this.selectedBrandId());
        this.showToast('Deliverable deleted.');
      },
      error: () => {
        this.deliverableToDelete.set(null);
        this.showToast('Failed to delete deliverable.');
      }
    });
  }

  confirmDeleteCreator(c: Creator) {
    this.api.deleteCreator(c.id).subscribe({
      next: () => {
        this.creatorToDelete.set(null);
        if (this.inspectedCreator()?.id === c.id) {
          this.inspectedCreator.set(null);
        }
        this.selectBrand(this.selectedBrandId());
        this.showToast('Creator removed from workspace.');
      },
      error: () => {
        this.creatorToDelete.set(null);
        this.showToast('Failed to remove creator.');
      }
    });
  }

  submitDirectCreator() {
    if (!this.newCreatorHandle.trim()) return;
    this.api.addDirectCreator(this.selectedBrandId(), {
      name: this.newCreatorName.trim(),
      handle: this.newCreatorHandle.trim(),
      email: this.newCreatorEmail.trim(),
      campaignName: this.newCreatorCampaign.trim(),
      niche: this.newCreatorNiche.trim(),
      category: this.newCreatorNiche.trim(),
      managementHandle: this.newCreatorManagement.trim(),
      country: this.newCreatorCountry.trim(),
      costMode: this.newCreatorCostMode,
      costQuoted: this.newCreatorCost ? String(this.newCreatorCost).trim() : ''
    }).subscribe({
      next: () => {
        this.modalCostMenuOpen.set(false);
        this.showAddCreatorModal.set(false);
        this.newCreatorName = '';
        this.newCreatorHandle = '';
        this.newCreatorEmail = '';
        this.newCreatorCampaign = '';
        this.newCreatorNiche = '';
        this.newCreatorManagement = '';
        this.newCreatorCountry = '';
        this.newCreatorCostMode = 'COLLECTIVE';
        this.newCreatorCost = '';
        this.igLookupHint.set('');
        this.selectBrand(this.selectedBrandId());
        this.showToast('Direct creator added!');
      },
      error: (err) => this.showToast(err?.error?.error || 'Could not add creator.')
    });
  }

  submitAgency() {
    if (!this.newAgencyName.trim()) return;
    this.api.addAgency(this.selectedBrandId(), {
      name: this.newAgencyName,
      contactEmail: this.newAgencyEmail
    }).subscribe(() => {
      this.showAgencyModal.set(false);
      this.newAgencyName = '';
      this.newAgencyEmail = '';
      this.selectBrand(this.selectedBrandId());
      this.showToast('Partner agency connected!');
    });
  }

  filterByAgency(name: string) {
    this.selectedAgencyFilter = name;
    this.selectedAgencySig.set(name);
    this.activeTab.set('creators');
  }

  triggerSync() {
    if (!this.selectedBrandId()) return;
    this.syncing.set(true);
    this.api.syncBrandDeliverables(this.selectedBrandId()).subscribe({
      next: (res) => {
        this.syncing.set(false);
        this.selectBrand(this.selectedBrandId());
        if (this.activeTab() === 'audit') this.loadAuditLogs();
        this.showToast(res.metaConfigured
          ? `Instagram synced: ${res.verifiedCount ?? res.syncedCount} verified deliverables.`
          : 'Saved URLs — live Instagram sync is not enabled yet.');
      },
      error: () => this.syncing.set(false)
    });
  }

  exportCsv() {
    if (!this.selectedBrandId()) return;
    this.api.exportBrandCsv(this.selectedBrandId()).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.currentBrand()?.slug || 'workspace'}-directory.csv`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('CSV report downloaded!');
    });
  }

  copyReelUrl(url: string) {
    navigator.clipboard?.writeText(url);
    this.showToast('Reel URL copied to clipboard!');
  }

  showToast(msg: string) {
    this.toastMsg.set(msg);
    setTimeout(() => this.toastMsg.set(''), 3200);
  }

  formatNum(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  cleanAuditTitle = formatAuditTitle;
  cleanAuditSummary = formatAuditSummary;

  logout() {
    this.auth.logout();
    this.router.navigateByUrl('/auth');
  }
}
