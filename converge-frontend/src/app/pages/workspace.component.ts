import { Component, DestroyRef, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiService, Agency, AuditLog, Brand, Creator, CreatorInsightsBundle, DeliverableInsightsBundle, InstagramStatus, ReelDeliverable, ReelDeltaSummary, ReelSnapshotPoint } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { DashboardExitAware, DashboardExitController } from '../services/auth.guard';
import { ConfirmModalComponent } from '../components/confirm-modal.component';
import { AgencyFormModalComponent, AgencyFormPayload } from '../components/agency-form-modal.component';
import { AgencyDetailsModalComponent } from '../components/agency-details-modal.component';
import { CreatorInsightsViewComponent } from '../components/creator-insights-view.component';
import { ReelInsightsViewComponent } from '../components/reel-insights-view.component';
import { AppHeaderComponent } from '../components/app-header.component';
import { AppFooterComponent } from '../components/app-footer.component';
import { ThemeToggleComponent } from '../components/theme-toggle.component';
import { formatAuditSummary, formatAuditTitle } from '../utils/audit-format';
import { formatPublishedDateLabel, formatReelDisplayTitle, formatReelMetaLabel } from '../utils/reel-format';
import { computeAxisBarScale, formatShortAxisDate, formatSyncAxisLabel } from '../utils/chart-axis';
import { computeReelSnapshotMetrics } from '../utils/reel-metrics';
import { safeExternalUrl } from '../utils/url-safety';

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModalComponent, AgencyFormModalComponent, AgencyDetailsModalComponent, CreatorInsightsViewComponent, ReelInsightsViewComponent, AppHeaderComponent, AppFooterComponent, ThemeToggleComponent],
  template: `
    <div class="bg-cv-canvas text-cv-ink font-body antialiased min-h-screen flex flex-col overflow-x-clip selection:bg-[#f54e26]/25 selection:text-cv-ink">
      <!-- Editorial Header -->
      <app-header [elevated]="true" brandLink="/workspace">
        <div header-left class="flex items-center gap-2.5 min-w-0">
          @if (currentBrand(); as b) {
            @if (brands().length > 1) {
              <span class="text-cv-ink-muted text-sm hidden sm:inline">/</span>
              @if (brandMenuOpen()) {
                <div (click)="brandMenuOpen.set(false)" class="fixed inset-0 z-30"></div>
              }
              <div class="relative">
                <button type="button" (click)="brandMenuOpen.set(!brandMenuOpen())"
                        class="inline-flex items-center gap-1.5 h-8 bg-cv-card hover:bg-cv-control border border-cv-border-strong text-cv-ink text-xs font-medium px-3 rounded-[4px] transition-colors cursor-pointer max-w-[190px] relative z-40">
                  <span class="truncate">{{ b.name }}</span>
                  <svg class="w-3.5 h-3.5 text-cv-ink-muted shrink-0 transition-transform" [class.rotate-180]="brandMenuOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                </button>
                @if (brandMenuOpen()) {
                  <div class="absolute left-0 mt-1.5 w-60 rounded-[4px] bg-cv-card border border-cv-border-strong shadow-[4px_4px_0px_#f54e26] py-1 z-50 max-h-72 overflow-y-auto">
                    @for (item of brands(); track item.id) {
                      <button type="button" (click)="switchBrand(item.id); brandMenuOpen.set(false)"
                              class="w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer"
                              [ngClass]="selectedBrandId() === item.id ? 'bg-cv-ink text-cv-ink-inverse font-semibold' : 'text-cv-ink hover:bg-cv-hover-pill'">
                        <span class="truncate">{{ item.name }}</span>
                        @if (selectedBrandId() === item.id) {
                          <span class="font-bold shrink-0">✓</span>
                        }
                      </button>
                    }
                  </div>
                }
              </div>
            }
          }
        </div>

        <div header-right class="flex items-center gap-2.5 shrink-0">
          <app-theme-toggle />
          <button type="button" (click)="showSignOutConfirm.set(true)"
                  class="h-8.5 px-4 rounded-[4px] bg-cv-ink hover:bg-[#f54e26] text-cv-ink-inverse hover:text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#f54e26] hover:shadow-[2px_2px_0px_var(--cv-shadow-ink)] active:translate-x-[1px] active:translate-y-[1px] inline-flex items-center gap-1.5 font-headline uppercase tracking-[0.04em] text-sm font-bold cursor-pointer whitespace-nowrap transition-all">
            <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square" stroke-linejoin="miter">
              <path d="M11 4H5v16h6"/>
              <path d="M10 12h10"/>
              <path d="M16 8l4 4-4 4"/>
            </svg>
            <span>SIGN OUT</span>
          </button>
        </div>
      </app-header>

      <main class="relative flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-5 lg:py-6 flex flex-col">
        @if (!loaded()) {
          <div class="flex-1 flex flex-col items-center justify-center py-20 text-center text-sm text-cv-ink-muted gap-3">
            <svg class="w-6 h-6 animate-spin text-[#f54e26]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9"/></svg>
            <span>Loading your workspace...</span>
          </div>
        } @else if (brands().length === 0) {
          <!-- Brutalist Waiting State (Fits Cleanly in 1 Viewport) -->
          <div class="flex-1 flex items-center justify-center py-4">
            <div class="w-full max-w-[500px] bg-cv-card rounded-[8px] border border-cv-border-strong shadow-[6px_6px_0px_#f54e26] p-6 sm:p-8 text-center animate-fade-in-up">
              <!-- Playful VSK Lockup -->
              <div class="inline-flex items-center mb-5 select-none">
                <div class="px-2.5 py-1 bg-[#5738af] text-[#fff6e8] font-headline uppercase font-bold text-base tracking-[0.03em] -rotate-12 -mr-1.5 z-10 shadow-md">
                  HELLO!
                </div>
                <div class="w-12 h-12 rounded-xl bg-cv-well border border-cv-border flex items-center justify-center p-1.5 shadow-lg">
                  <img src="/converge-logo.svg" alt="Converge" class="w-full h-full object-contain"/>
                </div>
                <div class="w-8 h-8 rounded-full bg-[#007656] border-2 border-cv-card flex items-center justify-center -ml-2 -mt-6 shadow-md">
                  <div class="flex items-center gap-1">
                    <span class="w-1.5 h-2 rounded-full bg-[#fff6e8] flex items-center justify-end pr-0.5"><span class="w-0.5 h-0.5 rounded-full bg-[#111111]"></span></span>
                    <span class="w-1.5 h-2 rounded-full bg-[#fff6e8] flex items-center justify-end pr-0.5"><span class="w-0.5 h-0.5 rounded-full bg-[#111111]"></span></span>
                  </div>
                </div>
              </div>

              <div>
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-[4px] bg-cv-well border border-cv-border text-cv-gold text-xs font-semibold">
                  <span class="w-1.5 h-1.5 rounded-full bg-cv-gold"></span>
                  <span>Workspace Not Ready</span>
                </span>
                <h1 class="font-headline uppercase text-3xl sm:text-4xl font-bold text-cv-ink tracking-[0.015em] leading-[0.98] mt-4">
                  YOUR WORKSPACE IS<br/><span class="text-[#f54e26]">NOT READY YET</span>
                </h1>
                <p class="text-sm text-cv-ink-muted mt-3 leading-relaxed max-w-md mx-auto">
                  Signed in as <strong class="text-cv-ink">{{ auth.currentUser()?.email }}</strong>. Ask your administrator or brand manager to link and activate your brand or agency workspace—it will appear here automatically.
                </p>
              </div>

              <div class="mt-6 flex flex-col items-center gap-3">
                <button
                  type="button"
                  (click)="loadBrands(true)"
                  [disabled]="refreshingWorkspace()"
                  class="h-11 px-7 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] border-2 border-[#111111] shadow-[3px_3px_0px_var(--cv-shadow-ink)] active:translate-x-[1px] active:translate-y-[1px] font-headline uppercase tracking-[0.03em] text-xl font-bold inline-flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-60">
                  @if (refreshingWorkspace()) {
                    <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9"/></svg>
                    <span>CHECKING...</span>
                  } @else {
                    <span>REFRESH WORKSPACE ↻</span>
                  }
                </button>
                <p class="text-xs text-cv-ink-muted">
                  Wrong email?
                  <button type="button" (click)="showSignOutConfirm.set(true)" class="underline text-cv-ink hover:text-[#f54e26] cursor-pointer ml-1 transition-colors">Switch account</button>
                </p>
              </div>
            </div>
          </div>
        } @else if (selectedReel(); as sr) {
          <app-reel-insights-view
            [reel]="sr"
            [creator]="selectedReelCreator()"
            [bundle]="selectedReelBundle()"
            [isLivePreview]="selectedReelIsLive()"
            [canManage]="canManageCreatorDeliverables(selectedReelCreator())"
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
            [canManage]="canManageCreatorDeliverables(ic)"
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
          <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-cv-border-soft animate-fade-in-up">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap mb-1">
                <span class="font-headline uppercase text-base sm:text-lg font-bold tracking-[0.03em] text-[#f54e26] leading-none truncate">
                  {{ currentPartnerAgency()?.name || currentBrand()?.name }}
                </span>
              </div>
              <h1 class="font-headline uppercase text-3xl sm:text-4xl font-bold tracking-[0.015em] text-cv-ink leading-none">{{ viewTitle() }}</h1>
            </div>
            <div class="flex flex-wrap items-center gap-2 shrink-0">
              <button type="button" (click)="triggerSync()" [disabled]="syncing()"
                      class="h-9 px-3.5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border-strong text-cv-ink text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60">
                <svg class="w-3.5 h-3.5 shrink-0" [class.animate-spin]="syncing()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                  <path d="M16 16h5v5"/>
                </svg>
                <span>{{ syncing() ? 'Refreshing...' : 'Refresh Reels' }}</span>
              </button>
              <button type="button" (click)="openCsvRecapView()"
                      class="h-9 px-3.5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border-strong text-cv-ink text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer">
                <span>CSV Recap</span>
              </button>
              <button type="button" (click)="exportCsv()" class="h-9 px-3.5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border-strong text-cv-ink text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer">
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <!-- Editorial Underline Sub-Nav Tabs -->
          <div class="pt-3 pb-5">
            <nav class="flex items-center gap-6 border-b border-cv-border-soft overflow-x-auto no-scrollbar">
              <button type="button" (click)="switchTab('overview')"
                      class="pb-2.5 -mb-px border-b-2 font-headline uppercase tracking-[0.03em] text-lg font-bold whitespace-nowrap transition-colors cursor-pointer"
                      [ngClass]="activeTab() === 'overview' ? 'border-[#f54e26] text-cv-ink' : 'border-transparent text-cv-ink-muted hover:text-cv-ink'">
                OVERVIEW
              </button>
              <button type="button" (click)="switchTab('creators')"
                      class="pb-2.5 -mb-px border-b-2 font-headline uppercase tracking-[0.03em] text-lg font-bold whitespace-nowrap transition-colors inline-flex items-center gap-2 cursor-pointer"
                      [ngClass]="activeTab() === 'creators' ? 'border-[#f54e26] text-cv-ink' : 'border-transparent text-cv-ink-muted hover:text-cv-ink'">
                <span>CREATORS ROSTER</span>
                <span class="font-body text-xs font-normal text-cv-ink-muted">({{ creators().length }})</span>
              </button>
              <button type="button" (click)="switchTab('instagram')"
                      class="pb-2.5 -mb-px border-b-2 font-headline uppercase tracking-[0.03em] text-lg font-bold whitespace-nowrap transition-colors cursor-pointer"
                      [ngClass]="activeTab() === 'instagram' ? 'border-[#f54e26] text-cv-ink' : 'border-transparent text-cv-ink-muted hover:text-cv-ink'">
                INSTAGRAM LOOKUP
              </button>
              @if (canManageAgencies()) {
                <button type="button" (click)="switchTab('agencies')"
                        class="pb-2.5 -mb-px border-b-2 font-headline uppercase tracking-[0.03em] text-lg font-bold whitespace-nowrap transition-colors inline-flex items-center gap-2 cursor-pointer"
                        [ngClass]="activeTab() === 'agencies' ? 'border-[#f54e26] text-cv-ink' : 'border-transparent text-cv-ink-muted hover:text-cv-ink'">
                  <span>LINKED AGENCIES</span>
                  <span class="font-body text-xs font-normal text-cv-ink-muted">({{ agencies().length }})</span>
                </button>
              }
              <button type="button" (click)="switchTab('audit')"
                      class="pb-2.5 -mb-px border-b-2 font-headline uppercase tracking-[0.03em] text-lg font-bold whitespace-nowrap transition-colors cursor-pointer"
                      [ngClass]="activeTab() === 'audit' ? 'border-[#f54e26] text-cv-ink' : 'border-transparent text-cv-ink-muted hover:text-cv-ink'">
                ACTIVITY
              </button>
            </nav>
          </div>

          <!-- TAB: INSTAGRAM LOOKUP & CREATOR FETCHER -->
          @if (activeTab() === 'instagram') {
            <section class="space-y-5 animate-fade-in-up">
              <div class="bg-cv-card rounded-[6px] p-5 border border-cv-border-strong space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 class="font-headline uppercase text-xl font-bold text-cv-ink tracking-[0.02em]">FETCH CREATOR DETAILS</h2>
                    <p class="text-xs text-cv-ink-muted mt-0.5">Look up public Creator profiles, followers, bio, and recent Reels.</p>
                  </div>
                  @if (igStatus(); as ig) {
                    <span class="px-2.5 py-0.5 rounded-[3px] text-[11px] font-semibold self-start sm:self-center shrink-0"
                          [ngClass]="ig.configured ? 'bg-[#007656] text-[#fff6e8]' : 'bg-[#fabf29] text-[#111111]'">
                      {{ ig.configured ? 'Live Sync Ready' : 'Setup Pending' }}
                    </span>
                  }
                </div>

                @if (igStatus() && !igStatus()?.configured) {
                  <div class="p-3.5 rounded-[4px] bg-cv-well border border-cv-border text-xs text-cv-ink-muted flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <strong class="text-cv-ink">Live profile lookup is not enabled yet:</strong> Add creators and save Reel URLs directly meanwhile.
                    </div>
                    <button type="button" (click)="openAddCreatorModal(igLookupInput)" class="px-3.5 py-1.5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover text-cv-ink font-semibold text-xs border border-cv-border-strong shrink-0 cursor-pointer transition-colors">
                      + Add Manually
                    </button>
                  </div>
                }

                <form (ngSubmit)="searchInstagramProfile()" class="flex flex-col sm:flex-row gap-2.5">
                  <div class="group flex-1 flex items-center gap-2.5 h-10 px-3 rounded-[4px] bg-cv-well border border-cv-border-strong focus-within:border-[#f54e26] transition-colors">
                    <svg class="doodle-svg w-4 h-4 text-cv-ink-muted group-focus-within:text-[#f54e26] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="4" y="4" width="16" height="16" rx="4"/>
                      <circle cx="12" cy="12" r="3.5"/>
                      <circle cx="16.8" cy="7.2" r="0.8" fill="currentColor" stroke="none"/>
                    </svg>
                    <input
                      [(ngModel)]="igLookupInput"
                      name="igLookupHandle"
                      placeholder="Enter @username or https://instagram.com/username"
                      type="text"
                      required
                      class="w-full min-w-0 bg-transparent text-sm text-cv-ink placeholder:text-cv-ink-subtle focus:outline-none"/>
                  </div>
                  <button
                    type="submit"
                    [disabled]="igSearching()"
                    class="h-10 px-6 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase tracking-[0.03em] text-lg font-bold cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 shrink-0 transition-colors">
                    @if (igSearching()) {
                      <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9"/></svg>
                      <span>FETCHING...</span>
                    } @else {
                      <span>FETCH PROFILE ↗</span>
                    }
                  </button>
                </form>

                @if (igSearchError()) {
                  <div class="p-3 rounded-[4px] bg-cv-danger-bg border border-cv-red/40 text-cv-danger-ink text-xs font-medium flex items-center justify-between gap-2 animate-pop-in">
                    <span>{{ igSearchError() }}</span>
                    <button type="button" (click)="igSearchError.set('')" class="cursor-pointer opacity-70 hover:opacity-100">✕</button>
                  </div>
                }
              </div>

              @if (igProfilePreview(); as p) {
                <div class="bg-cv-card rounded-[6px] p-5 border border-cv-border-strong space-y-5 animate-pop-in">
                  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-cv-border-soft">
                    <div class="flex items-start sm:items-center gap-4 min-w-0">
                      @if (p.avatarUrl) {
                        <img [src]="p.avatarUrl" [alt]="p.name" (error)="p.avatarUrl = ''" class="w-14 h-14 rounded-[4px] object-cover border border-cv-border-strong shrink-0"/>
                      } @else {
                        <div class="w-14 h-14 rounded-[4px] bg-[#f54e26] text-[#111111] font-headline font-bold text-xl flex items-center justify-center shrink-0">
                          {{ (p.name || p.username || 'IG').substring(0, 2).toUpperCase() }}
                        </div>
                      }
                      <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2">
                          <h3 class="font-headline uppercase text-2xl font-bold text-cv-ink truncate">{{ p.name || p.username }}</h3>
                          <span class="px-2 py-0.5 rounded-[3px] bg-[#007656] text-[#fff6e8] text-[10px] font-semibold">Verified</span>
                        </div>
                        @if (safeExternalUrl(p.profileUrl, true); as safeProfile) {
                          <a [href]="safeProfile" target="_blank" rel="noopener noreferrer" class="text-xs text-[#f54e26] hover:underline">{{ p.handle }} ↗</a>
                        } @else {
                          <span class="text-xs text-[#f54e26]">{{ p.handle }}</span>
                        }
                        @if (p.bio) {
                          <p class="text-xs text-cv-ink-muted mt-1.5 max-w-2xl leading-relaxed">{{ p.bio }}</p>
                        }
                        @if (safeExternalUrl(p.website, false); as safeSite) {
                          <a [href]="safeSite" target="_blank" rel="noopener noreferrer" class="text-[11px] text-cv-blush hover:underline block mt-1 truncate">{{ p.website }}</a>
                        }
                      </div>
                    </div>

                    <div class="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        (click)="searchInstagramProfile(true)"
                        [disabled]="igSearching()"
                        class="h-10 px-4 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border-strong text-cv-ink text-xs font-medium cursor-pointer disabled:opacity-60 transition-colors">
                        {{ igSearching() ? 'Refreshing...' : 'Refresh IG ↻' }}
                      </button>
                      <button
                        type="button"
                        (click)="addFetchedCreatorToRoster(p)"
                        [disabled]="addingFetched()"
                        class="h-10 px-5 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase tracking-[0.03em] text-base font-bold cursor-pointer disabled:opacity-60 transition-colors">
                        {{ addingFetched() ? 'SAVING...' : '+ ADD TO ROSTER' }}
                      </button>
                    </div>
                  </div>

                  <div class="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-cv-divide rounded-[4px] bg-cv-well border border-cv-border tabular-nums text-center">
                    <div class="p-3">
                      <p class="text-[11px] text-cv-ink-muted font-medium">Followers</p>
                      <p class="font-headline text-2xl font-bold text-cv-ink mt-0.5">{{ p.followersDisplay || formatNum(p.followersCount) }}</p>
                    </div>
                    <div class="p-3">
                      <p class="text-[11px] text-cv-ink-muted font-medium">{{ (p.publicViews30d || p.totalRecentViews || 0) > 0 ? 'Reel Views' : 'Following' }}</p>
                      <p class="font-headline text-2xl font-bold text-[#f54e26] mt-0.5">{{ (p.publicViews30d || p.totalRecentViews || 0) > 0 ? formatNum(p.publicViews30d || p.totalRecentViews || 0) : formatNum(p.followsCount) }}</p>
                    </div>
                    <div class="p-3">
                      <p class="text-[11px] text-cv-ink-muted font-medium">{{ (p.publicInteractions30d || 0) > 0 ? 'Public Inter. (30d)' : 'Recent Interactions' }}</p>
                      <p class="font-headline text-2xl font-bold text-cv-gold mt-0.5">{{ formatNum(p.publicInteractions30d || p.totalRecentInteractions || 0) }}</p>
                    </div>
                    <div class="p-3">
                      <p class="text-[11px] text-cv-ink-muted font-medium">Est. Inter. Rate</p>
                      <p class="font-headline text-2xl font-bold text-cv-green mt-0.5">{{ (p.estimatedInteractionRate || 0) > 0 ? p.estimatedInteractionRate + '%' : '—' }}</p>
                    </div>
                    <div class="p-3 col-span-2 sm:col-span-1">
                      <p class="text-[11px] text-cv-ink-muted font-medium">Activity (28d)</p>
                      <p class="font-headline text-base font-bold text-cv-ink mt-1.5">
                        {{ p.postedLast28Days ? 'Active in 28d' : 'No posts in 28d' }}
                      </p>
                    </div>
                  </div>

                  @if (p.suggestedManagementHandle || p.detectedBrandPartners?.length) {
                    <div class="flex flex-wrap items-center gap-2 text-xs">
                      @if (p.suggestedManagementHandle) {
                        <span class="px-2.5 py-1 rounded-[4px] bg-cv-well border border-cv-border text-[#f54e26] font-medium">Mgmt: {{ p.suggestedManagementHandle }}</span>
                      }
                      @if (p.detectedBrandPartners?.length) {
                        <span class="px-2.5 py-1 rounded-[4px] bg-cv-well border border-cv-border text-cv-ink font-medium">
                          Brand partners detected: {{ p.detectedBrandPartners.join(', ') }}
                        </span>
                      }
                    </div>
                  }

                  @if (p.recentMedia?.length) {
                    @let lookupReelList = lookupReels(p.recentMedia);
                    @let lookupShown = displayedLookupMedia(p.recentMedia);
                    <div class="space-y-3">
                      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div>
                          <h4 class="font-headline uppercase text-base font-bold text-cv-ink tracking-[0.02em]">
                            {{ lookupMediaFilter() === 'reels' ? ('RECENT PUBLIC REELS (' + lookupReelList.length + ')') : ('RECENT PUBLIC POSTS & REELS (' + p.recentMedia.length + ')') }}
                          </h4>
                          <p class="text-[11px] text-cv-ink-muted">Sorted by publish date (Instagram Pinned Reels appear at their publish date).</p>
                        </div>
                        <div class="inline-flex items-center p-0.5 rounded-[4px] bg-cv-well border border-cv-border self-start sm:self-center shrink-0">
                          <button type="button" (click)="lookupMediaFilter.set('reels')"
                                  class="px-3 py-1 rounded-[3px] text-xs font-medium cursor-pointer transition-colors"
                                  [ngClass]="lookupMediaFilter() === 'reels' ? 'bg-[#f54e26] text-[#111111] font-bold' : 'text-cv-ink-muted hover:text-cv-ink'">
                            Reels ({{ lookupReelList.length }})
                          </button>
                          <button type="button" (click)="lookupMediaFilter.set('all')"
                                  class="px-3 py-1 rounded-[3px] text-xs font-medium cursor-pointer transition-colors"
                                  [ngClass]="lookupMediaFilter() === 'all' ? 'bg-[#f54e26] text-[#111111] font-bold' : 'text-cv-ink-muted hover:text-cv-ink'">
                            All Posts ({{ p.recentMedia.length }})
                          </button>
                        </div>
                      </div>

                      @if (lookupShown.length === 0) {
                        <p class="text-xs text-cv-ink-muted py-4 text-center bg-cv-well rounded-[4px] border border-dashed border-cv-border">
                          No Reels found in the recent media batch. Switch to "All Posts" to view Photo &amp; Carousel posts.
                        </p>
                      } @else {
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                          @for (m of lookupShown; track m.id) {
                            <div (click)="openLookupReelInsights(m, p)" class="p-3.5 rounded-[4px] bg-cv-well border border-cv-border hover:border-[#f54e26] flex flex-col justify-between gap-2.5 cursor-pointer transition-colors">
                              <div class="space-y-2">
                                @if (m.thumbnailUrl) {
                                  <img [src]="m.thumbnailUrl" alt="Media preview" (error)="m.thumbnailUrl = ''" class="w-full h-36 object-cover rounded-[4px] bg-cv-control"/>
                                }
                                <div class="flex items-center justify-between gap-2">
                                  <span class="px-2 py-0.5 rounded-[3px] text-[10px] font-bold uppercase"
                                        [ngClass]="isLookupReel(m) ? 'bg-[#f54e26]/20 text-[#f54e26]' : 'bg-cv-control text-cv-ink'">
                                    {{ isLookupReel(m) ? 'REEL' : (m.mediaType === 'CAROUSEL_ALBUM' ? 'CAROUSEL' : (m.mediaType === 'VIDEO' ? 'VIDEO' : 'PHOTO')) }}
                                  </span>
                                  <span class="text-[11px] text-cv-ink-muted font-medium tabular-nums">
                                    @if ((m.viewsCount || 0) > 0) {
                                      <span class="text-[#f54e26] font-semibold">{{ formatNum(m.viewsCount) }} views • </span>
                                    }
                                    {{ formatNum(m.likeCount) }} likes • {{ m.commentsCount }} cmts
                                  </span>
                                </div>
                                <div class="flex items-center justify-between gap-2 text-[10px] text-cv-ink-subtle tabular-nums">
                                  @if (m.timestamp) {
                                    <span>Published {{ m.timestamp | date:'MMM d, y' }}</span>
                                  } @else {
                                    <span>Instagram {{ isLookupReel(m) ? 'Reel' : 'Post' }}</span>
                                  }
                                  <span>{{ isLookupReel(m) ? 'Instagram Reel' : (m.mediaType === 'VIDEO' ? 'Video Post' : 'Instagram Post') }}</span>
                                </div>
                              </div>
                              <div class="flex items-center justify-between pt-2 border-t border-cv-border-faint text-[11px]" (click)="$event.stopPropagation()">
                                <button type="button" (click)="openLookupReelInsights(m, p)" class="text-[#f54e26] hover:underline font-semibold cursor-pointer">
                                  {{ isLookupReel(m) ? 'Reel Insights →' : 'Post Insights →' }}
                                </button>
                                <div class="flex items-center gap-2">
                                  @if (safeExternalUrl(m.permalink, true); as safeMediaLink) {
                                    <a [href]="safeMediaLink" target="_blank" rel="noopener noreferrer" class="text-cv-ink-muted hover:text-cv-ink font-medium">View ↗</a>
                                  }
                                  <button type="button" (click)="copyReelUrl(m.permalink)" class="text-cv-ink-muted hover:text-cv-ink font-medium cursor-pointer">Copy URL</button>
                                </div>
                              </div>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </section>
          }

          <!-- TAB: OVERVIEW -->
          @if (activeTab() === 'overview') {
            <section class="space-y-5 animate-fade-in-up">
              <div class="rounded-[4px] bg-cv-card border border-cv-border grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-cv-divide tabular-nums">
                @if (canManageAgencies()) {
                  <div (click)="switchTab('agencies')" class="px-5 py-3.5 cursor-pointer hover:bg-cv-hover-subtle transition-colors">
                    <p class="text-xs text-cv-ink-muted font-medium">Partner Agencies</p>
                    <p class="font-headline text-3xl font-bold text-cv-ink mt-1 leading-none">{{ agencies().length }}</p>
                  </div>
                } @else {
                  <div class="px-5 py-3.5">
                    <p class="text-xs text-cv-ink-muted font-medium">Avg. Engagement</p>
                    <p class="font-headline text-3xl font-bold text-cv-ink mt-1 leading-none">{{ stats().avgEngagement }}%</p>
                  </div>
                }
                <div (click)="switchTab('creators')" class="px-5 py-3.5 cursor-pointer hover:bg-cv-hover-subtle transition-colors">
                  <p class="text-xs text-cv-ink-muted font-medium">Creators</p>
                  <p class="font-headline text-3xl font-bold text-cv-gold mt-1 leading-none">{{ creators().length }}</p>
                </div>
                <div class="px-5 py-3.5">
                  <p class="text-xs text-cv-ink-muted font-medium">Total Reach</p>
                  <p class="font-headline text-3xl font-bold text-[#f54e26] mt-1 leading-none">{{ formatNum(stats().totalReach) }}</p>
                </div>
                <div (click)="switchTab('audit')" class="px-5 py-3.5 cursor-pointer hover:bg-cv-hover-subtle transition-colors">
                  <p class="text-xs text-cv-ink-muted font-medium">Tracked Reels</p>
                  <p class="font-headline text-3xl font-bold text-cv-green mt-1 leading-none">{{ stats().totalReels }}</p>
                </div>
              </div>

              <!-- Live Reel Spotlight & Interactive CSV Recap (1:1 Landing Hero Parity, Real Data Only) -->
              <div class="rounded-[6px] bg-cv-card border-2 border-cv-border-strong shadow-[6px_6px_0px_#f54e26] p-4 sm:p-5 space-y-4">
                <div class="flex flex-wrap items-center justify-between gap-2 pb-3.5 border-b border-cv-border-soft">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    @for (c of creators().slice(0, 6); track c.id) {
                      <button type="button"
                              (click)="selectSpotlightCreator(c.id)"
                              class="px-2.5 py-1 rounded-[4px] text-xs font-medium transition-colors cursor-pointer"
                              [ngClass]="spotlightCreator()?.id === c.id
                                ? 'bg-cv-ink text-cv-ink-inverse font-semibold'
                                : 'bg-cv-well border border-cv-border text-cv-ink-muted hover:text-cv-ink'">
                        {{ c.handle }}
                      </button>
                    }
                    @if (creators().length === 0) {
                      <span class="font-headline uppercase text-base font-bold text-cv-ink tracking-[0.02em]">REEL SPOTLIGHT &amp; RECAP</span>
                    }
                  </div>

                  <div class="inline-flex items-center p-0.5 rounded-[4px] bg-cv-well border border-cv-border text-[11px] shrink-0">
                    <button type="button" (click)="overviewMode.set('live')"
                            class="px-2.5 py-1 rounded-[3px] font-medium cursor-pointer transition-colors"
                            [ngClass]="overviewMode() === 'live' ? 'bg-[#f54e26] text-[#111111] font-semibold' : 'text-cv-ink-muted hover:text-cv-ink'">
                      Live Stats
                    </button>
                    <button type="button" (click)="overviewMode.set('csv')"
                            class="px-2.5 py-1 rounded-[3px] font-medium cursor-pointer transition-colors"
                            [ngClass]="overviewMode() === 'csv' ? 'bg-[#f54e26] text-[#111111] font-semibold' : 'text-cv-ink-muted hover:text-cv-ink'">
                      CSV Recap
                    </button>
                  </div>
                </div>

                @if (overviewMode() === 'live') {
                  @if (spotlightCreator(); as sc) {
                    @if (spotlightCreatorReels().length > 1) {
                      <div class="flex items-center gap-1.5 flex-wrap">
                        @for (r of spotlightCreatorReels().slice(0, 5); track r.id) {
                          <button type="button"
                                  (click)="selectSpotlightReel(r.id)"
                                  class="px-2 py-0.5 rounded-[3px] text-[11px] font-medium truncate max-w-[190px] cursor-pointer transition-colors"
                                  [ngClass]="activeSpotlightReel()?.id === r.id
                                    ? 'bg-cv-control border border-[#f54e26] text-cv-ink'
                                    : 'bg-cv-well border border-cv-border-soft text-cv-ink-muted hover:text-cv-ink'">
                            {{ displayReelTitle(r) }}
                          </button>
                        }
                      </div>
                    }

                    @if (spotlightDisplay(); as disp) {
                      @let deltaInfo = activeSpotlightDelta();
                      @let barChart = spotlightMomentumBars();
                      <div class="space-y-4">
                        <!-- Public URL Bar + Inline Refresh Button -->
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 rounded-[4px] bg-cv-well border border-cv-border-soft">
                          <div class="flex items-center gap-2 min-w-0 text-xs">
                            <span class="w-2 h-2 rounded-full shrink-0" [ngClass]="disp.reel.status === 'VERIFIED' ? 'bg-cv-green' : 'bg-cv-gold'"></span>
                            <span class="text-cv-ink font-medium truncate">{{ reelMetaLabel(disp.reel) }}</span>
                          </div>
                          <div class="flex items-center gap-1.5 shrink-0">
                            @if (canManageCreatorDeliverables(disp.creator)) {
                              <button type="button"
                                      (click)="refreshSpotlightReel(disp.reel.id)"
                                      [disabled]="syncingSpotlightReel()"
                                      class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] bg-cv-control hover:bg-[#f54e26] hover:text-[#111111] text-cv-ink text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50">
                                <svg class="w-3 h-3" [class.animate-spin]="syncingSpotlightReel()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                  <path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>
                                </svg>
                                <span>{{ syncingSpotlightReel() ? 'Updating...' : 'Refresh Reel' }}</span>
                              </button>
                            }
                            <button type="button"
                                    (click)="openDeliverableInsights(disp.reel)"
                                    class="px-2.5 py-1 rounded-[3px] bg-cv-control hover:bg-cv-ink hover:text-cv-ink-inverse text-cv-ink-muted text-[11px] font-semibold transition-colors cursor-pointer">
                              Insights →
                            </button>
                          </div>
                        </div>

                        <!-- Campaign / Title + Real Sync Delta -->
                        <div class="flex flex-wrap items-center justify-between gap-3">
                          <div class="min-w-0">
                            <span class="text-[11px] uppercase tracking-wider text-cv-ink-muted block truncate">{{ disp.subLabel }}</span>
                            <h3 class="font-headline uppercase text-2xl font-bold text-cv-ink tracking-[0.015em] truncate">{{ displayReelTitle(disp.reel) }}</h3>
                          </div>
                          @if (disp.metrics.isSnapshotPreview && disp.snapshotLabel) {
                            <div class="flex items-center gap-2 shrink-0">
                              <span class="px-2 py-0.5 rounded-[3px] bg-cv-well border border-[#f54e26] text-[#f54e26] text-[11px] font-bold uppercase tracking-wide tabular-nums">
                                {{ disp.snapshotLabel }}
                              </span>
                              @if (disp.isPinnedSnapshot) {
                                <button type="button" (click)="pinnedSpotlightSnapIdx.set(null)" class="text-[11px] font-semibold text-cv-ink-muted hover:text-cv-ink underline cursor-pointer">
                                  Latest
                                </button>
                              }
                            </div>
                          } @else if (disp.metrics.viewsDelta > 0) {
                            <span class="px-2.5 py-0.5 rounded-[3px] bg-[#f54e26] text-[#111111] text-[11px] font-bold uppercase tracking-wide shrink-0 tabular-nums">
                              +{{ formatNum(disp.metrics.viewsDelta) }} LAST SYNC
                            </span>
                          } @else {
                            <span class="text-[11px] font-medium text-cv-green shrink-0">
                              {{ disp.reel.status === 'VERIFIED' ? 'Live Reel numbers' : 'Saved URL · sync pending' }}
                            </span>
                          }
                        </div>

                        <!-- 4-Column Unified Hairline Metric Strip -->
                        <div class="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-cv-divide rounded-[4px] bg-cv-well border border-cv-border tabular-nums">
                          <div class="px-3.5 py-3">
                            <span class="text-[11px] text-cv-ink-muted block">Views</span>
                            <span class="font-headline text-2xl font-bold text-cv-ink">{{ disp.metrics.viewsCount.toLocaleString('en-IN') }}</span>
                          </div>
                          <div class="px-3.5 py-3">
                            <span class="text-[11px] text-cv-ink-muted block">Likes</span>
                            <span class="font-headline text-2xl font-bold text-cv-gold">{{ disp.metrics.likesCount.toLocaleString('en-IN') }}</span>
                          </div>
                          <div class="px-3.5 py-3">
                            <span class="text-[11px] text-cv-ink-muted block">Comments</span>
                            <span class="font-headline text-2xl font-bold text-cv-green">{{ disp.metrics.commentsCount.toLocaleString('en-IN') }}</span>
                          </div>
                          <div class="px-3.5 py-3">
                            @if (disp.reel.metricsSource === 'META_GRAPH_INSIGHTS' || disp.metrics.savesCount > 0) {
                              <span class="text-[11px] text-cv-ink-muted block">Saves (OAuth)</span>
                              <span class="font-headline text-2xl font-bold text-cv-blush">{{ disp.metrics.savesCount.toLocaleString('en-IN') }}</span>
                            } @else {
                              <span class="text-[11px] text-cv-ink-muted block">Eng. Rate</span>
                              <span class="font-headline text-2xl font-bold text-cv-blush">{{ disp.metrics.engagementRate > 0 ? disp.metrics.engagementRate + '%' : '—' }}</span>
                            }
                          </div>
                        </div>

                        <!-- Real Momentum Bar Chart (Snapshots or Tracked Reels) -->
                        <div class="px-3.5 py-3 rounded-[4px] bg-cv-well border border-cv-border-soft space-y-2.5">
                          <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-cv-ink-muted">
                            <div class="flex items-center gap-2">
                              <span>{{ barChart.subtitle }}</span>
                              @if ((deltaInfo?.snapshots?.length || 0) >= 2 && deliverables().length > 1) {
                                <div class="inline-flex items-center p-0.5 rounded-[3px] bg-cv-card border border-cv-border-soft text-[10px]">
                                  <button type="button" (click)="setSpotlightChartMode('snapshots')"
                                          class="px-1.5 py-0.5 rounded-[2px] cursor-pointer"
                                          [ngClass]="barChart.mode === 'snapshots' ? 'bg-cv-ink text-cv-ink-inverse font-semibold' : 'text-cv-ink-muted'">
                                    Snapshots
                                  </button>
                                  <button type="button" (click)="setSpotlightChartMode('reels')"
                                          class="px-1.5 py-0.5 rounded-[2px] cursor-pointer"
                                          [ngClass]="barChart.mode === 'reels' ? 'bg-cv-ink text-cv-ink-inverse font-semibold' : 'text-cv-ink-muted'">
                                    By Reel
                                  </button>
                                </div>
                              }
                            </div>
                            @if (barChart.activeBar; as ab) {
                              <span class="text-cv-ink font-medium tabular-nums truncate max-w-[320px]">
                                {{ ab.label }} · {{ ab.value.toLocaleString('en-IN') }} {{ barChart.unit }}
                                @if ((ab.delta || 0) > 0) {
                                  <span class="text-cv-green">(+{{ formatNum(ab.delta!) }})</span>
                                }
                              </span>
                            }
                          </div>
                          @if (barChart.items.length > 0) {
                            <div class="flex items-stretch gap-2 pt-0.5">
                              <!-- Y-Axis -->
                              <div class="w-12 shrink-0 h-[68px] flex flex-col justify-between text-right pr-2 border-r border-cv-border text-[10px] leading-none text-cv-ink-subtle tabular-nums select-none">
                                <span>{{ barChart.yMaxLabel }}</span>
                                <span>{{ barChart.yMidLabel }}</span>
                                <span>{{ barChart.yMinLabel }}</span>
                              </div>
                              <!-- Plot Gridlines, Bars & X-Axis -->
                              <div class="flex-1 min-w-0 flex flex-col" (mouseleave)="hoveredSpotlightBarIdx.set(null)">
                                <div class="relative h-[68px] flex items-end gap-2 px-1 border-b border-cv-border">
                                  <div aria-hidden="true" class="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-cv-border-faint"></div>
                                  <div aria-hidden="true" class="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-cv-border-faint"></div>
                                  @for (bar of barChart.items; track $index) {
                                    <button type="button"
                                            (mouseenter)="hoveredSpotlightBarIdx.set($index)"
                                            (click)="onSpotlightBarClick($index, bar)"
                                            class="relative z-10 group flex-1 h-full flex items-end justify-center cursor-pointer focus:outline-none"
                                            [attr.title]="bar.label + ' — ' + bar.value.toLocaleString('en-IN') + ' ' + barChart.unit"
                                            [attr.aria-label]="bar.label">
                                      <span class="w-full max-w-[64px] block rounded-t-[2px] transition-all duration-150"
                                            [style.height.px]="bar.px"
                                            [style.backgroundColor]="barChart.activeIdx === $index ? '#f54e26' : '#f54e2666'">
                                      </span>
                                    </button>
                                  }
                                </div>
                                <div class="flex items-start gap-2 px-1 pt-1.5">
                                  @for (bar of barChart.items; track $index) {
                                    <button type="button"
                                            (mouseenter)="hoveredSpotlightBarIdx.set($index)"
                                            (click)="onSpotlightBarClick($index, bar)"
                                            class="flex-1 min-w-0 text-center text-[10px] leading-tight truncate cursor-pointer transition-colors"
                                            [ngClass]="barChart.activeIdx === $index ? 'text-cv-ink font-semibold' : 'text-cv-ink-subtle hover:text-cv-ink'">
                                      {{ bar.xLabel }}
                                    </button>
                                  }
                                </div>
                              </div>
                            </div>
                          }
                        </div>
                      </div>
                    } @else {
                      <div class="py-5 px-4 rounded-[4px] bg-cv-well border border-cv-border-soft flex flex-wrap items-center justify-between gap-3">
                        <p class="text-xs text-cv-ink-muted">
                          @if (canManageCreatorDeliverables(sc)) {
                            No Reels tracked yet for <span class="text-cv-ink font-medium">{{ sc.handle }}</span>. Track a Reel to inspect live stats and snapshot momentum.
                          } @else {
                            No Reels tracked yet for <span class="text-cv-ink font-medium">{{ sc.handle }}</span>. Deliverables are managed by {{ sc.agencyName || 'the partner agency' }}.
                          }
                        </p>
                        <button type="button" (click)="inspectCreator(sc)" class="h-8 px-3.5 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase text-sm font-bold cursor-pointer transition-colors">
                          {{ canManageCreatorDeliverables(sc) ? 'OPEN CREATOR & PICK REELS →' : 'VIEW CREATOR →' }}
                        </button>
                      </div>
                    }
                  } @else {
                    <div class="py-5 px-4 rounded-[4px] bg-cv-well border border-cv-border-soft flex flex-wrap items-center justify-between gap-3">
                      <p class="text-xs text-cv-ink-muted">Onboard creators via Instagram Lookup to unlock Live Reel Spotlight and CSV Recap.</p>
                      <button type="button" (click)="switchTab('instagram')" class="h-8 px-3.5 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase text-sm font-bold cursor-pointer transition-colors">
                        FETCH FROM INSTAGRAM ↗
                      </button>
                    </div>
                  }
                } @else {
                  <!-- Interactive Campaign CSV Recap Preview Table -->
                  <div class="space-y-3">
                    @if (csvRecapRows().length === 0) {
                      <p class="py-6 text-center text-xs text-cv-ink-muted">No creator stats available in this workspace yet.</p>
                    } @else {
                      <div class="rounded-[4px] bg-cv-well border border-cv-border-soft divide-y divide-cv-divide-soft text-xs tabular-nums overflow-x-auto">
                        <div class="grid grid-cols-12 min-w-[520px] px-3.5 py-2 text-[11px] text-cv-ink-muted font-medium bg-cv-card-alt">
                          <span class="col-span-4">Creator</span>
                          <span class="col-span-2 text-right">Reels</span>
                          <span class="col-span-2 text-right">Views</span>
                          <span class="col-span-2 text-right">Likes</span>
                          <span class="col-span-2 text-right">Engagement</span>
                        </div>
                        @for (row of csvRecapRows(); track row.creator.id) {
                          <div (click)="inspectCreator(row.creator)"
                               class="grid grid-cols-12 min-w-[520px] px-3.5 py-2.5 items-center hover:bg-cv-hover-row cursor-pointer transition-colors">
                            <div class="col-span-4 min-w-0 pr-2">
                              <span class="font-medium text-cv-ink truncate block">{{ row.creator.handle }}</span>
                              <span class="text-[10px] text-cv-ink-subtle truncate block">{{ row.creator.campaignName || row.creator.name }}</span>
                            </div>
                            <span class="col-span-2 text-right text-cv-ink-muted">{{ row.reelsCount }}</span>
                            <span class="col-span-2 text-right text-[#f54e26] font-semibold">{{ formatNum(row.views) }}</span>
                            <span class="col-span-2 text-right text-cv-gold">{{ formatNum(row.likes) }}</span>
                            <span class="col-span-2 text-right text-cv-green">{{ row.engRate > 0 ? row.engRate + '%' : '—' }}</span>
                          </div>
                        }
                      </div>
                    }
                    <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span class="text-xs text-cv-ink-muted">Click any row to open full creator insights, or export full CSV.</span>
                      <button type="button"
                              (click)="exportCsv()"
                              class="h-8 px-3.5 rounded-[4px] bg-[#007656] hover:bg-[#058c68] text-[#fff6e8] text-xs font-semibold cursor-pointer transition-colors">
                        Download Full CSV ↓
                      </button>
                    </div>
                  </div>
                }
              </div>

              @if (canManageAgencies()) {
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <div class="lg:col-span-2 bg-cv-card rounded-[4px] border border-cv-border divide-y divide-cv-divide">
                    <div class="px-5 py-3 flex items-center justify-between">
                      <h3 class="font-headline uppercase text-lg font-bold text-cv-ink tracking-[0.02em]">PARTNER AGENCIES</h3>
                      <button (click)="openAgencyCreateModal()" class="text-xs font-semibold text-[#f54e26] hover:underline cursor-pointer">+ Onboard Agency</button>
                    </div>
                    @if (agencies().length === 0) {
                      <p class="text-xs text-cv-ink-muted py-6 text-center">No partner agencies linked yet.</p>
                    } @else {
                      @for (ag of agencies(); track ag.id) {
                        <div (click)="viewedAgency.set(ag)" class="px-5 py-3 hover:bg-cv-hover-subtle transition-colors flex items-center justify-between gap-3 cursor-pointer">
                          <div class="flex items-center gap-3 min-w-0">
                            <div class="w-8 h-8 rounded-[4px] bg-[#5738af] text-[#fff6e8] font-headline font-bold flex items-center justify-center text-sm shrink-0">{{ ag.monogram }}</div>
                            <div class="min-w-0">
                              <p class="font-medium text-sm text-cv-ink truncate">{{ ag.name }}</p>
                              <p class="text-xs text-cv-ink-muted truncate">
                                {{ ag.contactName || ag.roleBadge }}
                                @if (ag.contactEmail) { • {{ ag.contactEmail }} }
                                @if (ag.contactNumber) { • {{ ag.contactNumber }} }
                              </p>
                            </div>
                          </div>
                          <div class="flex items-center gap-2.5 shrink-0">
                            <span class="text-xs font-medium" [ngClass]="ag.status === 'DRAFT' ? 'text-cv-gold' : 'text-cv-green'">
                              {{ ag.status === 'DRAFT' ? 'Draft' : 'Connected' }}
                            </span>
                            <button type="button" (click)="openAgencyEditModal(ag); $event.stopPropagation()" class="h-7 px-2.5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border-strong text-[11px] font-medium text-cv-ink cursor-pointer transition-colors">Edit</button>
                          </div>
                        </div>
                      }
                    }
                  </div>

                  <div class="bg-cv-card rounded-[4px] border border-cv-border divide-y divide-cv-divide flex flex-col justify-between">
                    <div>
                      <div class="px-5 py-3 border-b border-cv-divide">
                        <h3 class="font-headline uppercase text-lg font-bold text-cv-ink tracking-[0.02em]">DIRECT CREATORS</h3>
                      </div>
                      @if (directCreators().length === 0) {
                        <p class="px-5 py-4 text-xs text-cv-ink-muted">No creators added yet.</p>
                      } @else {
                        <div class="divide-y divide-cv-divide-soft">
                          @for (c of directCreators().slice(0, 4); track c.id) {
                            <div class="px-5 py-2.5 flex items-center justify-between gap-2">
                              <div class="min-w-0">
                                <p class="font-medium text-xs text-cv-ink truncate">{{ c.name }}</p>
                                <p class="text-[11px] text-cv-ink-muted truncate">{{ c.handle }} • {{ c.followersDisplay || '—' }}</p>
                              </div>
                              <button (click)="inspectCreator(c)" class="text-xs text-[#f54e26] font-semibold hover:underline cursor-pointer shrink-0">Open</button>
                            </div>
                          }
                        </div>
                      }
                    </div>
                    <div class="p-4 flex gap-2">
                      <button (click)="switchTab('instagram')" class="w-full h-9 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase tracking-[0.03em] text-base font-bold cursor-pointer transition-colors">FETCH FROM INSTAGRAM ↗</button>
                    </div>
                  </div>
                </div>
              } @else {
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  @if (currentPartnerAgency(); as ag) {
                    <div class="bg-cv-card rounded-[4px] border border-cv-border divide-y divide-cv-divide">
                      <div class="px-5 py-3 flex items-center justify-between gap-2">
                        <h3 class="font-headline uppercase text-lg font-bold text-cv-ink tracking-[0.02em]">AGENCY DETAILS</h3>
                        <span class="px-2 py-0.5 rounded-[3px] bg-[#007656] text-[#fff6e8] text-[10px] font-bold uppercase tracking-wide">Connected</span>
                      </div>
                      <div class="p-5 space-y-4">
                        <div class="flex items-center gap-3">
                          <div class="w-10 h-10 rounded-[4px] bg-[#5738af] text-[#fff6e8] font-headline font-bold text-base flex items-center justify-center shrink-0">
                            {{ ag.monogram }}
                          </div>
                          <div class="min-w-0">
                            <h4 class="font-headline uppercase text-lg font-bold text-cv-ink truncate leading-tight">{{ ag.name }}</h4>
                            <p class="text-xs text-cv-ink-muted truncate">{{ ag.handle }} • {{ ag.roleBadge || 'Partner Agency' }}</p>
                          </div>
                        </div>
                        <div class="pt-3 border-t border-cv-border-faint space-y-1.5 text-xs">
                          <p class="text-cv-ink-muted uppercase tracking-[0.04em] text-[10px] font-semibold">Agency Manager</p>
                          <p class="text-cv-ink font-medium truncate">{{ ag.contactName || '—' }}</p>
                          <p class="text-cv-ink-muted truncate">{{ ag.contactEmail || '—' }}</p>
                          @if (ag.contactNumber) {
                            <p class="text-cv-ink-muted truncate tabular-nums">{{ ag.contactNumber }}</p>
                          }
                        </div>
                      </div>
                    </div>
                  }

                  <div [ngClass]="currentPartnerAgency() ? 'lg:col-span-2' : 'lg:col-span-3'" class="bg-cv-card rounded-[4px] border border-cv-border divide-y divide-cv-divide flex flex-col justify-between">
                    <div>
                      <div class="px-5 py-3 flex items-center justify-between gap-3">
                        <h3 class="font-headline uppercase text-lg font-bold text-cv-ink tracking-[0.02em]">AGENCY CREATORS</h3>
                        <button (click)="switchTab('instagram')" class="text-xs font-semibold text-[#f54e26] hover:underline cursor-pointer">Fetch from Instagram ↗</button>
                      </div>
                      @if (creators().length === 0) {
                        <p class="px-5 py-6 text-xs text-cv-ink-muted text-center">No creators onboarded by your agency yet. Use Instagram Lookup to fetch and onboard creators.</p>
                      } @else {
                        <div class="divide-y divide-cv-divide-soft">
                          @for (c of creators().slice(0, 6); track c.id) {
                            <div class="px-5 py-3 flex items-center justify-between gap-3">
                              <div class="min-w-0">
                                <p class="font-medium text-sm text-cv-ink truncate">{{ c.name }}</p>
                                <p class="text-xs text-cv-ink-muted truncate">{{ c.handle }} • {{ c.followersDisplay || '—' }} followers</p>
                              </div>
                              <button (click)="inspectCreator(c)" class="text-xs text-[#f54e26] font-semibold hover:underline cursor-pointer shrink-0">Insights &amp; Reels →</button>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  </div>
                </div>
              }
            </section>
          }

          <!-- TAB: LINKED AGENCIES -->
          @if (activeTab() === 'agencies' && canManageAgencies()) {
            <section class="space-y-5 animate-fade-in-up">
              <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div class="group flex-1 sm:max-w-md flex items-center gap-2.5 h-10 px-3 rounded-[4px] bg-cv-well border border-cv-border-strong focus-within:border-[#f54e26] transition-colors">
                  <svg class="doodle-svg w-4 h-4 text-cv-ink-muted group-focus-within:text-[#f54e26] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>
                  <input [(ngModel)]="agencySearch" (ngModelChange)="agencySearchSig.set($event)" placeholder="Search agencies by name, manager, email, or phone..." class="w-full min-w-0 bg-transparent text-sm text-cv-ink placeholder:text-cv-ink-subtle focus:outline-none"/>
                </div>
                @if (canManageAgencies()) {
                  <button (click)="openAgencyCreateModal()" class="h-10 px-5 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase tracking-[0.03em] text-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0 transition-colors">
                    <span>+ ONBOARD AGENCY</span>
                  </button>
                }
              </div>

              @if (filteredAgencies().length === 0) {
                <div class="p-10 rounded-[4px] bg-cv-card border border-dashed border-cv-border-strong text-center">
                  <p class="text-sm text-cv-ink-muted">No partner agencies found.</p>
                </div>
              } @else {
                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  @for (ag of filteredAgencies(); track ag.id) {
                    <article (click)="viewedAgency.set(ag)" class="bg-cv-card rounded-[4px] p-4 border border-cv-border hover:border-[#f54e26] transition-colors cursor-pointer flex flex-col justify-between gap-3.5">
                      <div class="flex items-start justify-between gap-3">
                        <div class="flex items-center gap-3 min-w-0">
                          <div class="w-10 h-10 rounded-[4px] bg-[#5738af] text-[#fff6e8] font-headline font-bold flex items-center justify-center text-base shrink-0">{{ ag.monogram }}</div>
                          <div class="min-w-0">
                            <h4 class="font-headline uppercase text-lg font-bold text-cv-ink truncate leading-tight">{{ ag.name }}</h4>
                            <p class="text-xs text-cv-ink-muted truncate">{{ ag.handle }} • {{ ag.creatorsCount }} Creators</p>
                          </div>
                        </div>
                        <span class="text-xs font-medium shrink-0" [ngClass]="ag.status === 'DRAFT' ? 'text-cv-gold' : 'text-cv-green'">
                          {{ ag.status === 'DRAFT' ? 'Draft' : 'Connected' }}
                        </span>
                      </div>

                      <div class="pt-3 border-t border-cv-border-faint space-y-1 text-xs">
                        <p class="text-cv-ink-muted uppercase tracking-[0.04em] text-[10px] font-semibold">Agency Manager</p>
                        <p class="text-cv-ink font-medium truncate">{{ ag.contactName || 'Manager not assigned' }}</p>
                        <p class="text-cv-ink-muted truncate">{{ ag.contactEmail || '—' }}</p>
                        <p class="text-cv-ink-muted truncate tabular-nums">{{ ag.contactNumber || '—' }}</p>
                      </div>

                      <div class="pt-2.5 border-t border-cv-border-faint flex items-center justify-between gap-2">
                        <span class="text-[11px] text-cv-ink-subtle truncate">{{ ag.roleBadge || 'Partner Agency' }}</span>
                        <div class="flex items-center gap-2 shrink-0">
                          <button type="button" (click)="viewedAgency.set(ag); $event.stopPropagation()" class="h-8 px-3 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border-strong text-xs font-medium text-cv-ink cursor-pointer transition-colors">
                            View
                          </button>
                          @if (canManageAgencies()) {
                            <button type="button" (click)="openAgencyEditModal(ag); $event.stopPropagation()" class="h-8 px-3 rounded-[4px] bg-cv-control hover:bg-[#f54e26] border border-cv-border-strong hover:border-[#f54e26] text-xs font-medium text-cv-ink hover:text-[#111111] cursor-pointer transition-colors">
                              Edit
                            </button>
                          }
                        </div>
                      </div>
                    </article>
                  }
                </div>
              }
            </section>
          }

          <!-- TAB: ASSOCIATED CREATORS -->
          @if (activeTab() === 'creators') {
            <section class="space-y-5 animate-fade-in-up">
              <div class="bg-cv-card rounded-[4px] p-4 border border-cv-border space-y-3">
                <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                  <div class="group flex-1 md:max-w-lg flex items-center gap-2.5 h-10 px-3 rounded-[4px] bg-cv-well border border-cv-border-strong focus-within:border-[#f54e26] transition-colors">
                    <svg class="doodle-svg w-4 h-4 text-cv-ink-muted group-focus-within:text-[#f54e26] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>
                    <input [(ngModel)]="creatorSearch" (ngModelChange)="creatorSearchSig.set($event)" placeholder="Search creators by name, @handle, or niche..." class="w-full min-w-0 bg-transparent text-sm text-cv-ink placeholder:text-cv-ink-subtle focus:outline-none"/>
                  </div>
                  @if (canManageAgencies()) {
                    <div class="relative shrink-0">
                      @if (agencyMenuOpen()) {
                        <div (click)="agencyMenuOpen.set(false)" class="fixed inset-0 z-30"></div>
                      }
                      <button type="button" (click)="agencyMenuOpen.set(!agencyMenuOpen())"
                              class="h-10 px-4 rounded-[4px] bg-cv-well hover:bg-cv-control border border-cv-border-strong text-xs font-medium text-cv-ink inline-flex items-center gap-2 cursor-pointer transition-colors relative z-40">
                        <span>{{ selectedAgencyFilter === 'all' ? ('All Partner Agencies (' + agencies().length + ')') : selectedAgencyFilter }}</span>
                        <svg class="w-3.5 h-3.5 text-cv-ink-muted shrink-0 transition-transform" [class.rotate-180]="agencyMenuOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                      </button>
                      @if (agencyMenuOpen()) {
                        <div class="absolute right-0 mt-1.5 w-64 rounded-[4px] bg-cv-card border border-cv-border-strong shadow-[4px_4px_0px_#f54e26] py-1 z-50 max-h-72 overflow-y-auto">
                          <button type="button" (click)="selectedAgencyFilter = 'all'; selectedAgencySig.set('all'); agencyMenuOpen.set(false)"
                                  class="w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer"
                                  [ngClass]="selectedAgencyFilter === 'all' ? 'bg-cv-ink text-cv-ink-inverse font-semibold' : 'text-cv-ink hover:bg-cv-hover-pill'">
                            <span>All Partner Agencies ({{ agencies().length }})</span>
                            @if (selectedAgencyFilter === 'all') {
                              <span class="font-bold shrink-0">✓</span>
                            }
                          </button>
                          @for (ag of agencies(); track ag.id) {
                            <button type="button" (click)="selectedAgencyFilter = ag.name; selectedAgencySig.set(ag.name); agencyMenuOpen.set(false)"
                                    class="w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer"
                                    [ngClass]="selectedAgencyFilter === ag.name ? 'bg-cv-ink text-cv-ink-inverse font-semibold' : 'text-cv-ink hover:bg-cv-hover-pill'">
                              <span class="truncate">{{ ag.name }}</span>
                              @if (selectedAgencyFilter === ag.name) {
                                <span class="font-bold shrink-0">✓</span>
                              }
                            </button>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
                @if (canManageAgencies()) {
                  <div class="flex items-center gap-1.5 pt-2.5 border-t border-cv-border-soft flex-wrap">
                    <button type="button" (click)="creatorTypeFilter.set('all')" class="h-8 px-3.5 rounded-[4px] text-xs font-medium cursor-pointer transition-colors"
                            [ngClass]="creatorTypeFilter() === 'all' ? 'bg-cv-ink text-cv-ink-inverse font-semibold' : 'bg-cv-well border border-cv-border text-cv-ink-muted hover:text-cv-ink'">
                      All Creators ({{ creators().length }})
                    </button>
                    <button type="button" (click)="creatorTypeFilter.set('DIRECT')" class="h-8 px-3.5 rounded-[4px] text-xs font-medium cursor-pointer transition-colors"
                            [ngClass]="creatorTypeFilter() === 'DIRECT' ? 'bg-cv-ink text-cv-ink-inverse font-semibold' : 'bg-cv-well border border-cv-border text-cv-ink-muted hover:text-cv-ink'">
                      Direct ({{ directCount() }})
                    </button>
                    <button type="button" (click)="creatorTypeFilter.set('AGENCY')" class="h-8 px-3.5 rounded-[4px] text-xs font-medium cursor-pointer transition-colors"
                            [ngClass]="creatorTypeFilter() === 'AGENCY' ? 'bg-cv-ink text-cv-ink-inverse font-semibold' : 'bg-cv-well border border-cv-border text-cv-ink-muted hover:text-cv-ink'">
                      Agency Managed ({{ agencyCount() }})
                    </button>
                  </div>
                }
              </div>

              @if (filteredCreators().length === 0) {
                <div class="p-8 sm:p-10 rounded-[4px] bg-cv-card border border-dashed border-cv-border-strong text-center space-y-3">
                  <p class="text-sm text-cv-ink-muted">No creators in your roster yet. Use Instagram Lookup to fetch a live creator profile.</p>
                  <div class="flex flex-wrap items-center justify-center gap-2">
                    <button (click)="switchTab('instagram')" class="h-9 px-5 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase text-base font-bold cursor-pointer transition-colors">FETCH FROM INSTAGRAM ↗</button>
                  </div>
                </div>
              } @else {
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                  @for (c of filteredCreators(); track c.id) {
                    <div class="bg-cv-card rounded-[4px] p-4 border border-cv-border flex flex-col justify-between hover:border-cv-border-bright transition-colors">
                      <div>
                        <div class="flex items-start justify-between gap-2">
                          <div (click)="inspectCreator(c)" class="flex items-center gap-3 cursor-pointer min-w-0">
                            @if (c.avatarUrl) {
                              <img [src]="c.avatarUrl" [alt]="c.name" (error)="c.avatarUrl = null" class="w-10 h-10 rounded-[4px] object-cover border border-cv-border shrink-0"/>
                            } @else {
                              <div class="w-10 h-10 rounded-[4px] bg-[#f54e26] text-[#111111] font-headline font-bold text-lg flex items-center justify-center shrink-0">
                                {{ c.name.substring(0, 2).toUpperCase() }}
                              </div>
                            }
                            <div class="min-w-0">
                              <div class="flex items-center gap-1.5">
                                <h4 class="font-headline uppercase text-lg font-bold text-cv-ink hover:text-[#f54e26] truncate leading-tight transition-colors">{{ c.name }}</h4>
                                @if (c.verified) {
                                  <span class="inline-flex items-center justify-center w-3.5 h-3.5 rounded-[3px] bg-[#f54e26] text-[#111111] text-[9px] font-bold shrink-0">✓</span>
                                }
                              </div>
                              <p class="text-xs text-[#f54e26] truncate">
                                {{ c.handle }}{{ c.managementHandle ? ' • ' + c.managementHandle : '' }}
                              </p>
                              @if (c.category || c.country) {
                                <p class="text-[11px] text-cv-ink-muted truncate mt-0.5">
                                  {{ c.category || c.niche }}{{ c.country ? ' • ' + c.country : '' }}
                                </p>
                              }
                            </div>
                          </div>
                          <span class="text-[11px] text-cv-ink-muted shrink-0">
                            {{ c.igConnected ? 'Connected' : (c.sourceType === 'DIRECT' ? 'Direct' : c.agencyName) }}
                          </span>
                        </div>

                        <div (click)="inspectCreator(c)" class="mt-3.5 grid grid-cols-4 divide-x divide-cv-divide rounded-[4px] bg-cv-well border border-cv-border-soft cursor-pointer hover:border-cv-border-bright transition-colors text-center tabular-nums">
                          <div class="py-2 px-1">
                            <span class="text-[10px] text-cv-ink-muted block">Followers</span>
                            <span class="font-bold text-xs text-cv-ink">{{ c.followersDisplay || '—' }}</span>
                          </div>
                          <div class="py-2 px-1">
                            <span class="text-[10px] text-cv-ink-muted block">{{ (c.totalViews30d || 0) > 0 ? 'Views' : 'Inter.' }}</span>
                            <span class="font-bold text-xs text-[#f54e26]">{{ (c.totalViews30d || 0) > 0 ? formatNum(c.totalViews30d || 0) : ((c.accountInteractions30d || 0) > 0 ? formatNum(c.accountInteractions30d || 0) : '—') }}</span>
                          </div>
                          <div class="py-2 px-1">
                            <span class="text-[10px] text-cv-ink-muted block">Eng.</span>
                            <span class="font-bold text-xs text-cv-green">{{ (c.interactionRate90d || c.engagementRate) > 0 ? (c.interactionRate90d || c.engagementRate) + '%' : '—' }}</span>
                          </div>
                          <div class="py-2 px-1">
                            <span class="text-[10px] text-cv-ink-muted block">Posts</span>
                            <span class="font-bold text-xs text-cv-gold">{{ c.mediaCount || '—' }}</span>
                          </div>
                        </div>
                      </div>

                      <div class="mt-3.5 pt-2.5 border-t border-cv-border-faint flex items-center justify-between gap-2">
                        <button (click)="inspectCreator(c)" class="text-xs font-semibold text-cv-ink hover:text-[#f54e26] flex items-center gap-1 cursor-pointer transition-colors">
                          <span>Insights &amp; Reels ({{ c.auditedReelsCount }}) →</span>
                        </button>
                        <div class="flex items-center gap-2.5">
                          @if (canManageCreatorDeliverables(c)) {
                            <button (click)="syncCreatorRow(c)" class="text-[11px] font-medium text-cv-ink-muted hover:text-cv-ink cursor-pointer">Refresh</button>
                          }
                          <button (click)="creatorToDelete.set(c)" class="text-[11px] font-medium text-cv-red-soft hover:underline cursor-pointer">Remove</button>
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
            <section class="animate-fade-in-up">
              <div class="bg-cv-card rounded-[4px] border border-cv-border divide-y divide-cv-divide">
                <div class="px-5 py-3 flex items-center justify-between gap-3">
                  <h3 class="font-headline uppercase text-lg font-bold text-cv-ink tracking-[0.02em]">RECENT ACTIVITY</h3>
                  <span class="text-xs text-cv-ink-muted tabular-nums">{{ auditLogs().length }} events</span>
                </div>
                @if (auditLogs().length === 0) {
                  <p class="px-5 py-8 text-xs text-cv-ink-muted text-center">No activity recorded yet.</p>
                } @else {
                  @for (log of auditLogs(); track log.id) {
                    <div class="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-cv-hover-subtle transition-colors">
                      <div class="flex items-start gap-3 min-w-0">
                        <span class="w-2 h-2 rounded-full mt-1.5 shrink-0"
                              [ngClass]="log.category === 'REEL_AUDIT' ? 'bg-[#f54e26]' : (log.category === 'CREATOR_LINK' ? 'bg-cv-green' : 'bg-cv-gold')"></span>
                        <div class="min-w-0">
                          <p class="text-sm font-medium text-cv-ink">{{ cleanAuditTitle(log.title) }}</p>
                          <p class="text-xs text-cv-ink-muted mt-0.5">{{ cleanAuditSummary(log.description) }}</p>
                        </div>
                      </div>
                      <span class="text-xs text-cv-ink-muted pl-5 sm:pl-0 shrink-0 tabular-nums">{{ log.createdAt | date:'MMM d, h:mm a' }}</span>
                    </div>
                  }
                }
              </div>
            </section>
          }
        }
      </main>

      <!-- Add Direct Creator Modal -->
      @if (showAddCreatorModal()) {
        <div class="fixed inset-0 z-50 bg-cv-backdrop backdrop-blur-xs flex items-center justify-center p-4 animate-pop-in" (click)="modalCostMenuOpen.set(false); showAddCreatorModal.set(false)">
          <div class="bg-cv-card rounded-[6px] max-w-md w-full p-6 border border-cv-border-strong shadow-[6px_6px_0px_#f54e26]" (click)="$event.stopPropagation()">
            <div class="flex items-center justify-between pb-3 border-b border-cv-border">
              <h3 class="font-headline uppercase text-2xl font-bold text-cv-ink tracking-[0.02em]">ADD DIRECT CREATOR</h3>
              <button type="button" (click)="modalCostMenuOpen.set(false); showAddCreatorModal.set(false)" class="w-8 h-8 rounded-[4px] hover:bg-cv-hover-pill flex items-center justify-center text-cv-ink-muted cursor-pointer">✕</button>
            </div>
            <form (ngSubmit)="submitDirectCreator()" class="space-y-3 pt-4">
              <div>
                <label class="block text-xs font-medium text-cv-ink mb-1">Instagram handle</label>
                <div class="flex gap-2">
                  <input [(ngModel)]="newCreatorHandle" name="cHandle" placeholder="@handle or URL" required class="flex-1 min-w-0 h-10 px-3 rounded-[4px] bg-cv-well border border-cv-border-strong text-sm text-cv-ink placeholder:text-cv-ink-subtle focus:border-[#f54e26] focus:outline-none"/>
                  <button type="button" (click)="lookupCreatorIg()" [disabled]="igFetching()" class="h-10 px-3.5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border-strong text-cv-ink text-xs font-medium transition-colors cursor-pointer shrink-0 disabled:opacity-60">
                    {{ igFetching() ? 'Fetching...' : 'Fetch IG' }}
                  </button>
                </div>
                @if (igLookupHint()) {
                  <p class="text-[11px] text-cv-ink-muted mt-1">{{ igLookupHint() }}</p>
                }
              </div>
              <div>
                <label class="block text-xs font-medium text-cv-ink mb-1">Creator name</label>
                <input [(ngModel)]="newCreatorName" name="cName" placeholder="Creator full name" required class="w-full h-10 px-3 rounded-[4px] bg-cv-well border border-cv-border-strong text-sm text-cv-ink placeholder:text-cv-ink-subtle focus:border-[#f54e26] focus:outline-none"/>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-cv-ink mb-1">Campaign</label>
                  <input [(ngModel)]="newCreatorCampaign" name="cCampaign" placeholder="Summer Launch" class="w-full h-10 px-3 rounded-[4px] bg-cv-well border border-cv-border-strong text-sm text-cv-ink placeholder:text-cv-ink-subtle focus:border-[#f54e26] focus:outline-none"/>
                </div>
                <div>
                  <label class="block text-xs font-medium text-cv-ink mb-1">Category / Niche</label>
                  <input [(ngModel)]="newCreatorNiche" name="cNiche" placeholder="Artist / Skincare" class="w-full h-10 px-3 rounded-[4px] bg-cv-well border border-cv-border-strong text-sm text-cv-ink placeholder:text-cv-ink-subtle focus:border-[#f54e26] focus:outline-none"/>
                </div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-cv-ink mb-1">Management handle</label>
                  <input [(ngModel)]="newCreatorManagement" name="cMgmt" placeholder="@stellaartalent" class="w-full h-10 px-3 rounded-[4px] bg-cv-well border border-cv-border-strong text-sm text-cv-ink placeholder:text-cv-ink-subtle focus:border-[#f54e26] focus:outline-none"/>
                </div>
                <div>
                  <label class="block text-xs font-medium text-cv-ink mb-1">Country</label>
                  <input [(ngModel)]="newCreatorCountry" name="cCountry" placeholder="India" class="w-full h-10 px-3 rounded-[4px] bg-cv-well border border-cv-border-strong text-sm text-cv-ink placeholder:text-cv-ink-subtle focus:border-[#f54e26] focus:outline-none"/>
                </div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="relative">
                  <label class="block text-xs font-medium text-cv-ink mb-1">Pricing model</label>
                  @if (modalCostMenuOpen()) {
                    <div (click)="modalCostMenuOpen.set(false)" class="fixed inset-0 z-40"></div>
                  }
                  <button type="button" (click)="modalCostMenuOpen.set(!modalCostMenuOpen())"
                          class="w-full h-10 px-3 rounded-[4px] bg-cv-well border border-cv-border-strong text-sm text-cv-ink font-medium flex items-center justify-between gap-2 hover:bg-cv-control-hover transition-colors focus:outline-none focus:border-[#f54e26] cursor-pointer relative z-50">
                    <span>{{ newCreatorCostMode === 'PER_DELIVERABLE' ? 'Cost Per Deliverable' : 'Fixed Cost' }}</span>
                    <svg class="w-4 h-4 text-cv-ink-muted shrink-0 transition-transform" [class.rotate-180]="modalCostMenuOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                  </button>
                  @if (modalCostMenuOpen()) {
                    <div class="absolute left-0 right-0 mt-1.5 rounded-[4px] bg-cv-card border border-cv-border-strong shadow-[4px_4px_0px_#f54e26] py-1 z-50">
                      <button type="button" (click)="newCreatorCostMode = 'COLLECTIVE'; modalCostMenuOpen.set(false)"
                              class="w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer"
                              [ngClass]="newCreatorCostMode === 'COLLECTIVE' ? 'bg-cv-ink text-cv-ink-inverse font-semibold' : 'text-cv-ink hover:bg-cv-hover-pill'">
                        <div>
                          <div class="text-xs leading-tight font-semibold">Fixed Cost</div>
                          <div class="text-[11px] font-normal mt-0.5" [ngClass]="newCreatorCostMode === 'COLLECTIVE' ? 'text-cv-ink-inverse opacity-80' : 'text-cv-ink-muted'">Collective fee across deliverables</div>
                        </div>
                        @if (newCreatorCostMode === 'COLLECTIVE') {
                          <span class="font-bold">✓</span>
                        }
                      </button>
                      <button type="button" (click)="newCreatorCostMode = 'PER_DELIVERABLE'; modalCostMenuOpen.set(false)"
                              class="w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer"
                              [ngClass]="newCreatorCostMode === 'PER_DELIVERABLE' ? 'bg-cv-ink text-cv-ink-inverse font-semibold' : 'text-cv-ink hover:bg-cv-hover-pill'">
                        <div>
                          <div class="text-xs leading-tight font-semibold">Cost Per Deliverable</div>
                          <div class="text-[11px] font-normal mt-0.5" [ngClass]="newCreatorCostMode === 'PER_DELIVERABLE' ? 'text-cv-ink-inverse opacity-80' : 'text-cv-ink-muted'">Individual agreed rate per Reel</div>
                        </div>
                        @if (newCreatorCostMode === 'PER_DELIVERABLE') {
                          <span class="font-bold">✓</span>
                        }
                      </button>
                    </div>
                  }
                </div>
                <div>
                  <label class="block text-xs font-medium text-cv-ink mb-1">
                    {{ newCreatorCostMode === 'PER_DELIVERABLE' ? 'Rate / Reel (₹, Optional)' : 'Fixed Cost (₹, Optional)' }}
                  </label>
                  <input [(ngModel)]="newCreatorCost" name="cCost" type="number" min="0" step="100" placeholder="100000" class="w-full h-10 px-3 rounded-[4px] bg-cv-well border border-cv-border-strong text-sm text-cv-ink placeholder:text-cv-ink-subtle focus:border-[#f54e26] focus:outline-none"/>
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-cv-ink mb-1">Email (Optional)</label>
                <input [(ngModel)]="newCreatorEmail" name="cEmail" placeholder="creator@domain.com" type="email" class="w-full h-10 px-3 rounded-[4px] bg-cv-well border border-cv-border-strong text-sm text-cv-ink placeholder:text-cv-ink-subtle focus:border-[#f54e26] focus:outline-none"/>
              </div>
              <div class="pt-4 border-t border-cv-border flex items-center justify-end gap-2.5">
                <button type="button" (click)="modalCostMenuOpen.set(false); showAddCreatorModal.set(false)" class="h-10 px-4 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border-strong text-xs font-medium text-cv-ink-muted hover:text-cv-ink cursor-pointer transition-colors">Cancel</button>
                <button type="submit" class="h-10 px-5 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase tracking-[0.03em] text-lg font-bold cursor-pointer transition-colors">ADD CREATOR ↗</button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Onboard / Edit Partner Agency Modal -->
      <app-agency-form-modal
        [open]="showAgencyModal()"
        [agency]="editingAgency()"
        [existingAgencies]="agencies()"
        [busy]="agencySaving()"
        [errorMsg]="agencyFormError()"
        (close)="closeAgencyFormModal()"
        (save)="saveAgency($event)">
      </app-agency-form-modal>

      <!-- View Partner Agency Details Modal -->
      <app-agency-details-modal
        [agency]="viewedAgency()"
        [showFilterCreators]="true"
        [canManage]="canManageAgencies()"
        (close)="viewedAgency.set(null)"
        (edit)="openAgencyEditModal($event)"
        (activate)="activateAgency($event)"
        (filterCreators)="viewedAgency.set(null); filterByAgency($event.name)"
        (remove)="agencyToDelete.set($event)">
      </app-agency-details-modal>

      <!-- Remove Agency Confirmation Modal -->
      <app-confirm-modal
        [open]="!!agencyToDelete()"
        [title]="'Remove ' + (agencyToDelete()?.name || 'agency') + '?'"
        message="Linked creators will be kept as Direct Creators and the partner agency link will be removed."
        confirmLabel="Remove Agency"
        tone="danger"
        (confirm)="agencyToDelete() && confirmDeleteAgency(agencyToDelete()!)"
        (cancel)="agencyToDelete.set(null)">
      </app-confirm-modal>

      <!-- Toast -->
      @if (toastMsg()) {
        <div class="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-[4px] bg-cv-toast-bg text-cv-toast-ink border-2 border-[#111111] shadow-[4px_4px_0px_#f54e26] text-xs font-bold animate-pop-in">
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
        [title]="exitCtrl.promptVisible() ? 'Sign out &amp; leave Workspace?' : 'Sign out of Workspace?'"
        [message]="exitCtrl.promptVisible() ? 'Going back to the home page will sign you out of your current session.' : 'You will be returned to the sign-in screen.'"
        confirmLabel="Sign Out"
        [cancelLabel]="exitCtrl.promptVisible() ? 'Stay Here' : 'Cancel'"
        tone="primary"
        (confirm)="confirmSignOutModal()"
        (cancel)="cancelSignOutModal()">
      </app-confirm-modal>

      <app-footer></app-footer>
    </div>
  `
})
export class WorkspaceComponent implements OnInit, OnDestroy, DashboardExitAware {
  readonly exitCtrl = new DashboardExitController();
  loaded = signal(false);
  refreshingWorkspace = signal(false);
  brands = signal<Brand[]>([]);
  selectedBrandId = signal<string>('');
  currentBrand = signal<Brand | null>(null);
  agencies = signal<Agency[]>([]);
  creators = signal<Creator[]>([]);
  deliverables = signal<ReelDeliverable[]>([]);
  reelDeltas = signal<Record<string, ReelDeltaSummary>>({});
  auditLogs = signal<AuditLog[]>([]);
  stats = signal({ totalReels: 0, totalReach: 0, avgEngagement: 0, activeAgencies: 0, totalCreators: 0 });

  activeTab = signal<'overview' | 'creators' | 'instagram' | 'agencies' | 'audit'>('overview');
  overviewMode = signal<'live' | 'csv'>('live');
  spotlightCreatorId = signal<string>('');
  spotlightReelId = signal<string>('');
  spotlightChartMode = signal<'auto' | 'snapshots' | 'reels'>('auto');
  hoveredSpotlightBarIdx = signal<number | null>(null);
  pinnedSpotlightSnapIdx = signal<number | null>(null);
  syncingSpotlightReel = signal(false);
  syncing = signal(false);
  igFetching = signal(false);
  igLookupHint = signal('');
  igStatus = signal<InstagramStatus | null>(null);

  igLookupInput = '';
  igSearching = signal(false);
  igSearchError = signal('');
  igProfilePreview = signal<any | null>(null);
  lookupMediaFilter = signal<'reels' | 'all'>('reels');
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
  editingAgency = signal<Agency | null>(null);
  viewedAgency = signal<Agency | null>(null);
  agencyToDelete = signal<Agency | null>(null);
  agencySaving = signal(false);
  agencyFormError = signal('');

  directCreators = computed(() => this.creators().filter(c => c.sourceType === 'DIRECT'));
  directCount = computed(() => this.directCreators().length);
  agencyCount = computed(() => this.creators().filter(c => c.sourceType === 'AGENCY').length);

  canManageAgencies = computed(() => {
    const user = this.auth.currentUser();
    const brand = this.currentBrand();
    if (!user || !brand) return false;
    if (user.role === 'SYSTEM_ADMIN') return true;
    return !!brand.managerEmail && brand.managerEmail.trim().toLowerCase() === user.email.trim().toLowerCase();
  });

  currentPartnerAgency = computed(() => {
    const user = this.auth.currentUser();
    if (!user || this.canManageAgencies()) return null;
    const email = user.email.trim().toLowerCase();
    return this.agencies().find(a => a.contactEmail?.trim().toLowerCase() === email && a.status !== 'DRAFT') || null;
  });

  isAgencyManagedCreator(c: Creator | null | undefined): boolean {
    return !!c && (c.sourceType === 'AGENCY' || !!c.agencyId);
  }

  canManageCreatorDeliverables(c: Creator | null | undefined): boolean {
    if (!c) return false;
    // Live lookup previews without a persisted creator record are not agency-owned yet.
    if (!c.id) return true;
    if (this.isAgencyManagedCreator(c)) {
      return !!this.currentPartnerAgency();
    }
    return !this.currentPartnerAgency();
  }

  readonly Math = Math;

  spotlightCreator = computed(() => {
    const list = this.creators();
    if (list.length === 0) return null;
    const picked = this.spotlightCreatorId();
    return list.find(c => c.id === picked) || list[0];
  });

  spotlightCreatorReels = computed(() => {
    const sc = this.spotlightCreator();
    if (!sc) return [];
    return this.deliverables().filter(r => r.creatorId === sc.id);
  });

  activeSpotlightReel = computed(() => {
    const list = this.spotlightCreatorReels();
    if (list.length === 0) return null;
    const picked = this.spotlightReelId();
    return list.find(r => r.id === picked) || list[0];
  });

  activeSpotlightDelta = computed(() => {
    const sr = this.activeSpotlightReel();
    if (!sr?.id) return null;
    return this.reelDeltas()[sr.id] || null;
  });

  spotlightMomentumBars = computed(() => {
    const deltaInfo = this.activeSpotlightDelta();
    const snaps = deltaInfo?.snapshots || [];
    const pref = this.spotlightChartMode();
    const useSnapshots = (pref === 'snapshots' && snaps.length > 0)
      || (pref === 'auto' && snaps.length >= 2);

    type BarItem = {
      label: string;
      xLabel: string;
      value: number;
      px: number;
      delta?: number;
      reel?: ReelDeliverable;
      snapshot?: ReelSnapshotPoint;
      isLatest?: boolean;
    };
    let items: BarItem[] = [];
    const mode: 'snapshots' | 'reels' = useSnapshots ? 'snapshots' : 'reels';
    let unit = 'views';
    let subtitle = useSnapshots ? 'Hover or click bars to inspect sync growth' : 'Hover or click bars to compare tracked Reel views';
    let scale = computeAxisBarScale([], 68);

    if (useSnapshots) {
      const slice = snaps.slice(-7);
      const hasSnapViews = slice.some(s => (s.viewsCount || 0) > 0);
      unit = hasSnapViews ? 'views' : 'interactions';
      subtitle = hasSnapViews
        ? 'Hover bars to inspect sync view growth'
        : 'Hover bars to inspect sync engagement growth';
      const vals = slice.map(s => hasSnapViews ? (s.viewsCount || 0) : ((s.likesCount || 0) + (s.commentsCount || 0)));
      scale = computeAxisBarScale(vals, 68);
      const dayLabels = new Set(slice.map(s => formatShortAxisDate(s.capturedAt)).filter(Boolean));
      const sameDay = dayLabels.size <= 1;
      items = slice.map((s, idx) => ({
        label: `Sync #${idx + 1}`,
        xLabel: formatSyncAxisLabel(idx, s.capturedAt, sameDay),
        value: vals[idx],
        px: scale.heightsPx[idx],
        delta: hasSnapViews ? (s.deltaViews || 0) : 0,
        snapshot: s,
        isLatest: idx === slice.length - 1
      }));
    } else {
      const sourceReels = this.spotlightCreatorReels().length > 1
        ? this.spotlightCreatorReels()
        : this.deliverables();
      const topReels = sourceReels.slice(0, 7);
      const hasViews = topReels.some(r => (r.viewsCount || 0) > 0);
      unit = hasViews ? 'views' : 'interactions';
      subtitle = hasViews
        ? 'Hover or click bars to switch between tracked Reels'
        : 'Hover or click bars to compare Post likes & comments';
      const vals = topReels.map(r => hasViews ? (r.viewsCount || 0) : ((r.likesCount || 0) + (r.commentsCount || 0)));
      scale = computeAxisBarScale(vals, 68);
      const distinctCreators = new Set(topReels.map(r => r.creatorHandle).filter(Boolean)).size;
      items = topReels.map((r, idx) => {
        const dt = formatShortAxisDate(r.publishedAt || r.syncedAt);
        const xLabel = distinctCreators > 1
          ? (r.creatorHandle || `#${idx + 1}`)
          : (dt || `Item ${idx + 1}`);
        return {
          label: `${r.creatorHandle || ''} • ${this.displayReelTitle(r)}`.replace(/^\s*•\s*/, ''),
          xLabel,
          value: vals[idx],
          px: scale.heightsPx[idx],
          delta: hasViews ? (this.reelDeltas()[r.id]?.viewsDeltaLastSync || 0) : 0,
          reel: r
        };
      });
    }

    const hovered = this.hoveredSpotlightBarIdx();
    const pinnedSnap = mode === 'snapshots' ? this.pinnedSpotlightSnapIdx() : null;
    const activeReelId = this.activeSpotlightReel()?.id;
    let activeIdx = 0;
    if (hovered !== null && hovered >= 0 && hovered < items.length) {
      activeIdx = hovered;
    } else if (pinnedSnap !== null && pinnedSnap >= 0 && pinnedSnap < items.length) {
      activeIdx = pinnedSnap;
    } else if (mode === 'reels' && activeReelId) {
      const matched = items.findIndex(i => i.reel?.id === activeReelId);
      activeIdx = matched >= 0 ? matched : 0;
    } else if (items.length > 0) {
      activeIdx = items.length - 1;
    }
    const activeBar = items.length > 0 ? items[activeIdx] : null;
    return {
      mode,
      unit,
      subtitle,
      yMinLabel: scale.yMinLabel,
      yMidLabel: scale.yMidLabel,
      yMaxLabel: scale.yMaxLabel,
      items,
      activeIdx,
      activeBar
    };
  });

  spotlightDisplay = computed(() => {
    const sc = this.spotlightCreator();
    const sr = this.activeSpotlightReel();
    if (!sc || !sr) return null;

    const barChart = this.spotlightMomentumBars();
    const activeBar = barChart.activeBar;

    if (barChart.mode === 'reels' && activeBar?.reel) {
      const displayReel = activeBar.reel;
      const displayCreator = this.creators().find(c => c.id === displayReel.creatorId) || sc;
      const deltaInfo = displayReel.id ? (this.reelDeltas()[displayReel.id] || null) : null;
      const metrics = computeReelSnapshotMetrics({
        reel: displayReel,
        creator: displayCreator,
        isLatest: true,
        viewsDeltaLastSync: deltaInfo?.viewsDeltaLastSync || 0
      });
      const subLabel = displayCreator.id !== sc.id
        ? (displayCreator.handle || displayReel.creatorHandle)
        : (displayCreator.campaignName || displayCreator.handle);
      return {
        reel: displayReel,
        creator: displayCreator,
        subLabel,
        metrics,
        snapshotLabel: '',
        isPinnedSnapshot: false
      };
    }

    const deltaInfo = this.activeSpotlightDelta();
    const isLatest = barChart.mode !== 'snapshots' || !activeBar?.snapshot || !!activeBar.isLatest;
    const metrics = computeReelSnapshotMetrics({
      reel: sr,
      creator: sc,
      snapshot: activeBar?.snapshot || null,
      isLatest,
      viewsDeltaLastSync: deltaInfo?.viewsDeltaLastSync || 0
    });
    const stamp = activeBar?.xLabel.replace(/^#\d+\s*(?:·\s*)?/, '').trim() || '';
    const snapshotLabel = metrics.isSnapshotPreview && activeBar
      ? (stamp ? `${activeBar.label} · ${stamp}` : activeBar.label)
      : '';
    const isPinnedSnapshot = barChart.mode === 'snapshots'
      && this.hoveredSpotlightBarIdx() === null
      && this.pinnedSpotlightSnapIdx() !== null
      && !isLatest;

    return {
      reel: sr,
      creator: sc,
      subLabel: sc.campaignName || sc.handle,
      metrics,
      snapshotLabel,
      isPinnedSnapshot
    };
  });

  csvRecapRows = computed(() => {
    const deliv = this.deliverables();
    return this.creators().map(c => {
      const owned = deliv.filter(r => r.creatorId === c.id);
      const views = owned.length > 0
        ? owned.reduce((s, r) => s + (r.viewsCount || 0), 0)
        : (c.totalViews30d || 0);
      const likes = owned.reduce((s, r) => s + (r.likesCount || 0), 0);
      const engRate = c.interactionRate90d || c.engagementRate || 0;
      return {
        creator: c,
        reelsCount: owned.length > 0 ? owned.length : (c.auditedReelsCount || 0),
        views,
        likes,
        engRate
      };
    });
  });

  filteredAgencies = computed(() => {
    const q = this.agencySearchSig().toLowerCase().trim();
    return this.agencies().filter(a =>
      !q
      || a.name.toLowerCase().includes(q)
      || (a.contactName || '').toLowerCase().includes(q)
      || (a.contactEmail || '').toLowerCase().includes(q)
      || (a.contactNumber || '').toLowerCase().includes(q)
    );
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
      case 'creators': return 'Creators & Reels';
      case 'instagram': return 'Instagram Lookup';
      case 'agencies': return 'Linked Agencies';
      case 'audit': return 'Activity';
      case 'overview':
      default: return this.currentPartnerAgency() ? 'Agency Overview' : 'Brand Overview';
    }
  });

  private readonly destroyRef = inject(DestroyRef);
  private pendingQueryParams: Params = {};
  private handledOAuthCode = '';
  private auditLoadedBrandId = '';
  private loadedIgHandle = '';

  constructor(
    private api: ApiService,
    public auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.pendingQueryParams = params || {};
        this.closeTransientModals();

        const code = params['code'];
        const state = params['state'];
        if (code && code !== this.handledOAuthCode) {
          this.handledOAuthCode = code;
          if (!state) {
            this.showToast('Missing OAuth verification state. Please generate a fresh Creator connect link.');
            this.navigateWorkspace({ brand: this.selectedBrandId() || undefined, tab: 'creators' }, true);
            return;
          }
          this.api.exchangeInstagramOAuthCode(code, state).subscribe({
            next: () => {
              this.showToast('Creator Instagram connected for live Insights!');
              this.navigateWorkspace({ brand: this.selectedBrandId() || undefined, tab: 'creators' }, true);
              if (this.selectedBrandId()) this.selectBrand(this.selectedBrandId());
            },
            error: (err) => {
              this.showToast(err?.error?.error || 'Could not connect Instagram account.');
              this.navigateWorkspace({ brand: this.selectedBrandId() || undefined, tab: 'creators' }, true);
            }
          });
          return;
        }

        if (this.loaded() && this.brands().length > 0) {
          this.applyWorkspaceRouteState(this.brands(), this.pendingQueryParams);
        }
      });

    this.loadBrands();
    this.api.getInstagramStatus().subscribe({
      next: (st) => this.igStatus.set(st),
      error: () => {}
    });
  }

  private closeTransientModals(): void {
    this.showAddCreatorModal.set(false);
    this.showAgencyModal.set(false);
    this.editingAgency.set(null);
    this.viewedAgency.set(null);
    this.agencyToDelete.set(null);
    this.agencyFormError.set('');
    if (!this.exitCtrl.promptVisible()) {
      this.showSignOutConfirm.set(false);
    }
    this.creatorToDelete.set(null);
    this.deliverableToDelete.set(null);
    this.brandMenuOpen.set(false);
    this.agencyMenuOpen.set(false);
    this.modalCostMenuOpen.set(false);
  }

  private normalizeWorkspaceTab(raw: string | undefined): 'overview' | 'creators' | 'instagram' | 'agencies' | 'audit' {
    switch (raw) {
      case 'creators':
      case 'instagram':
      case 'overview':
      case 'audit':
        return raw;
      case 'agencies':
        return this.canManageAgencies() ? 'agencies' : 'overview';
      default:
        return 'overview';
    }
  }

  private navigateWorkspace(next: {
    brand?: string;
    tab?: string;
    creator?: string;
    reel?: string;
    liveReel?: string;
    igHandle?: string;
  }, replaceUrl = false): void {
    const queryParams: Record<string, string> = {};
    if (next.brand) queryParams['brand'] = next.brand;
    if (next.tab) queryParams['tab'] = next.tab;
    if (next.creator) queryParams['creator'] = next.creator;
    if (next.reel) queryParams['reel'] = next.reel;
    if (next.liveReel) queryParams['liveReel'] = next.liveReel;
    if (next.igHandle) queryParams['igHandle'] = next.igHandle;
    this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl });
  }

  switchTab(tab: 'overview' | 'creators' | 'instagram' | 'agencies' | 'audit'): void {
    if (tab === 'agencies' && !this.canManageAgencies()) {
      tab = 'overview';
    }
    const brandId = this.selectedBrandId();
    if (!brandId) {
      this.activeTab.set(tab);
      return;
    }
    const existingHandle = tab === 'instagram'
      ? (this.pendingQueryParams['igHandle'] || (this.igProfilePreview()?.username ? String(this.igProfilePreview().username) : ''))
      : '';
    this.navigateWorkspace({
      brand: brandId,
      tab,
      ...(existingHandle ? { igHandle: existingHandle } : {})
    });
  }

  loadBrands(manualRefresh = false) {
    if (manualRefresh) {
      this.refreshingWorkspace.set(true);
    }
    this.api.listBrands().subscribe({
      next: (list) => {
        this.brands.set(list);
        this.loaded.set(true);
        this.refreshingWorkspace.set(false);
        if (list.length > 0) {
          const requestedBrand = this.pendingQueryParams['brand'];
          const resolvedBrand = list.some(b => b.id === requestedBrand) ? requestedBrand : list[0].id;
          if (!requestedBrand || requestedBrand !== resolvedBrand) {
            this.navigateWorkspace({
              brand: resolvedBrand,
              tab: this.normalizeWorkspaceTab(this.pendingQueryParams['tab']),
              creator: this.pendingQueryParams['creator'],
              reel: this.pendingQueryParams['reel'],
              liveReel: this.pendingQueryParams['liveReel'],
              igHandle: this.pendingQueryParams['igHandle']
            }, true);
          }
          this.applyWorkspaceRouteState(list, { ...this.pendingQueryParams, brand: resolvedBrand });
        } else if (manualRefresh) {
          this.showToast('Checked for brand updates.');
        }
      },
      error: () => {
        this.loaded.set(true);
        this.refreshingWorkspace.set(false);
      }
    });
  }

  private applyWorkspaceRouteState(brandList: Brand[], params: Params): void {
    if (brandList.length === 0) return;

    const targetBrand = brandList.find(b => b.id === params['brand']) || brandList[0];
    const brandId = targetBrand.id;

    if (this.selectedBrandId() !== brandId || !this.currentBrand()) {
      this.currentBrand.set(targetBrand);
      this.auditLoadedBrandId = '';
      this.selectBrand(brandId);
    }

    const tab = this.normalizeWorkspaceTab(params['tab']);
    const creatorId = params['creator'] ? String(params['creator']) : '';
    const reelId = params['reel'] ? String(params['reel']) : '';
    const liveReel = params['liveReel'] ? String(params['liveReel']) : '';
    const igHandle = params['igHandle'] ? String(params['igHandle']).trim() : '';

    this.activeTab.set(tab);
    if (params['tab'] === 'agencies' && tab !== 'agencies') {
      this.navigateWorkspace({ brand: brandId, tab }, true);
    }
    if (tab === 'audit' && this.auditLoadedBrandId !== brandId) {
      this.auditLoadedBrandId = brandId;
      this.loadAuditLogs(brandId);
    }

    if (tab === 'instagram' && igHandle && this.loadedIgHandle.toLowerCase() !== igHandle.toLowerCase()) {
      this.igLookupInput = igHandle.startsWith('@') ? igHandle : `@${igHandle}`;
      this.fetchInstagramPreviewFromRoute(igHandle, liveReel);
    }

    if (creatorId) {
      if (this.inspectedCreator()?.id !== creatorId) {
        this.loadCreatorInsightsById(creatorId);
      }
    } else if (this.inspectedCreator() !== null) {
      this.inspectedCreator.set(null);
      this.inspectedBundle.set(null);
      this.creatorReels.set([]);
    }

    if (reelId) {
      if (this.selectedReel()?.id !== reelId || this.selectedReelIsLive()) {
        this.loadDeliverableInsightsById(reelId);
      }
    } else if (liveReel) {
      this.restoreLiveMediaReel(liveReel, creatorId);
    } else if (this.selectedReel() !== null) {
      this.selectedReel.set(null);
      this.selectedReelBundle.set(null);
      this.selectedReelCreator.set(null);
      this.selectedReelIsLive.set(false);
    }
  }

  switchBrand(brandId: string) {
    this.navigateWorkspace({ brand: brandId, tab: 'overview' });
  }

  selectBrand(brandId: string, skipAutoLoginSync = false) {
    this.selectedBrandId.set(brandId);
    this.auditLoadedBrandId = '';
    this.api.getBrandOverview(brandId).subscribe({
      next: (res) => {
        this.currentBrand.set(res.brand);
        this.agencies.set(res.agencies);
        this.creators.set(res.creators);
        const list = res.deliverables || res.recentReels || [];
        this.deliverables.set(list);
        this.reelDeltas.set(res.reelDeltas || {});
        this.stats.set(res.stats);
        if (this.activeTab() === 'agencies' && !this.canManageAgencies()) {
          this.switchTab('overview');
        } else if (this.activeTab() === 'audit') {
          this.loadAuditLogs(brandId);
        }
        if (!skipAutoLoginSync && this.auth.shouldAutoSyncBrandOnVisit(brandId) && (list.length > 0 || (res.creators?.length || 0) > 0)) {
          this.triggerAutoSyncOnLogin(brandId);
        }
      },
      error: (err) => {
        this.showToast(err?.error?.error || 'Could not load brand overview.');
      }
    });
  }

  private triggerAutoSyncOnLogin(brandId: string): void {
    if (this.syncing()) return;
    this.syncing.set(true);
    this.api.syncBrandDeliverables(brandId, 'login').subscribe({
      next: (res) => {
        this.syncing.set(false);
        if (res.status !== 'RECENTLY_SYNCED' && (res.syncedCount || 0) > 0 && this.selectedBrandId() === brandId) {
          this.selectBrand(brandId, true);
          if (this.activeTab() === 'audit') {
            this.loadAuditLogs(brandId);
          }
        }
      },
      error: () => {
        this.syncing.set(false);
      }
    });
  }

  loadAuditLogs(brandId = this.selectedBrandId()) {
    if (!brandId) return;
    this.auditLoadedBrandId = brandId;
    this.api.listAuditLogs(brandId).subscribe({
      next: (res) => this.auditLogs.set(res.items),
      error: () => {}
    });
  }

  searchInstagramProfile(forceRefresh = false) {
    const raw = this.igLookupInput.trim();
    if (!raw) return;
    const clean = raw.replace(/^https?:\/\/(www\.|m\.)?instagram\.com\//i, '').split(/[/?#]/)[0].replace(/^@+/, '');
    if (clean && this.selectedBrandId()) {
      this.navigateWorkspace({
        brand: this.selectedBrandId(),
        tab: 'instagram',
        igHandle: clean
      });
    }
    this.fetchInstagramPreviewFromRoute(raw, '', forceRefresh);
  }

  private fetchInstagramPreviewFromRoute(handle: string, pendingLiveReel = '', forceRefresh = false): void {
    this.igSearching.set(true);
    this.igSearchError.set('');
    if (!forceRefresh) {
      this.igProfilePreview.set(null);
    }
    this.api.lookupInstagramProfile(handle, forceRefresh).subscribe({
      next: (profile) => {
        this.igSearching.set(false);
        this.loadedIgHandle = String(profile?.username || handle).replace(/^@+/, '');
        this.igProfilePreview.set(profile);
        if (pendingLiveReel) {
          this.restoreLiveMediaReel(pendingLiveReel, '');
        }
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
        this.navigateWorkspace({
          brand: this.selectedBrandId(),
          tab: 'creators',
          creator: created.id
        });
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
    if (!this.selectedBrandId()) {
      this.loadCreatorInsightsById(c.id, c);
      return;
    }
    this.navigateWorkspace({
      brand: this.selectedBrandId(),
      tab: this.activeTab(),
      creator: c.id
    });
  }

  private loadCreatorInsightsById(creatorId: string, initialCreator?: Creator) {
    const existing = initialCreator || this.creators().find(item => item.id === creatorId) || null;
    if (existing) {
      this.inspectedCreator.set(existing);
    }
    this.inspectedBundle.set(null);
    this.drawerMedia.set([]);
    this.refreshCreatorInsightsById(creatorId);
  }

  private refreshCreatorInsights(c: Creator) {
    this.refreshCreatorInsightsById(c.id);
  }

  private refreshCreatorInsightsById(creatorId: string) {
    this.api.getCreatorInsights(creatorId).subscribe({
      next: (bundle) => {
        this.inspectedBundle.set(bundle);
        this.inspectedCreator.set(bundle.creator);
        this.creatorReels.set(bundle.deliverables);
        if (bundle.recentMedia?.length || this.drawerMedia().length === 0) {
          this.drawerMedia.set(bundle.recentMedia || []);
        }
        const pendingLive = this.pendingQueryParams['liveReel'];
        if (pendingLive && !this.selectedReel()) {
          this.restoreLiveMediaReel(String(pendingLive), creatorId);
        }
      },
      error: (err) => {
        this.api.listCreatorDeliverables(creatorId).subscribe({
          next: (reels) => this.creatorReels.set(reels),
          error: () => {
            this.showToast(err?.error?.error || 'Could not load creator details.');
            if (this.selectedBrandId()) {
              this.navigateWorkspace({ brand: this.selectedBrandId(), tab: this.activeTab() }, true);
            }
          }
        });
      }
    });
  }

  closeInspector() {
    if (this.selectedBrandId()) {
      this.navigateWorkspace({
        brand: this.selectedBrandId(),
        tab: this.activeTab()
      });
      return;
    }
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
    this.api.fetchInstagramMedia(c.handle, 100, c.id).subscribe({
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
        this.selectBrand(this.selectedBrandId());
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
        if (ic) this.refreshCreatorInsights(ic);
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
    if (this.selectedBrandId()) {
      this.navigateWorkspace({
        brand: this.selectedBrandId(),
        tab: this.activeTab(),
        creator: r.creatorId || this.inspectedCreator()?.id || '',
        reel: r.id
      });
      return;
    }
    this.loadDeliverableInsightsById(r.id, r);
  }

  private loadDeliverableInsightsById(deliverableId: string, initialReel?: ReelDeliverable) {
    if (initialReel) {
      this.selectedReel.set(initialReel);
      this.selectedReelCreator.set(this.inspectedCreator());
    }
    this.selectedReelBundle.set(null);
    this.selectedReelIsLive.set(false);
    this.api.getDeliverableInsights(deliverableId).subscribe({
      next: (bundle) => {
        this.selectedReel.set(bundle.deliverable);
        this.selectedReelCreator.set(bundle.creator);
        this.selectedReelBundle.set(bundle);
      },
      error: (err) => {
        this.showToast(err?.error?.error || 'Could not load Reel insights.');
        this.closeReelInsights();
      }
    });
  }

  openDrawerLiveReelInsights(m: any) {
    const ic = this.inspectedCreator();
    if (!ic) return;
    const liveKey = String(m?.shortcode || m?.id || '');
    if (this.selectedBrandId() && liveKey) {
      this.openLiveMediaAsReelPage(m, ic);
      this.navigateWorkspace({
        brand: this.selectedBrandId(),
        tab: this.activeTab(),
        creator: ic.id,
        liveReel: liveKey
      });
      return;
    }
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
    const liveKey = String(m?.shortcode || m?.id || '');
    const handle = String(profile?.username || profile?.handle || '').replace(/^@+/, '');
    if (this.selectedBrandId() && liveKey) {
      this.navigateWorkspace({
        brand: this.selectedBrandId(),
        tab: 'instagram',
        igHandle: handle,
        liveReel: liveKey
      });
    }
  }

  private restoreLiveMediaReel(liveKey: string, creatorId: string): void {
    if (!liveKey) return;
    if (creatorId) {
      const match = this.drawerMedia().find(m => m.shortcode === liveKey || String(m.id) === liveKey);
      const ic = this.inspectedCreator();
      if (match && ic) {
        this.openLiveMediaAsReelPage(match, ic);
      }
      return;
    }
    const profile = this.igProfilePreview();
    const list: any[] = profile?.recentMedia || [];
    const match = list.find(m => m.shortcode === liveKey || String(m.id) === liveKey);
    if (match && profile) {
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
      this.openLiveMediaAsReelPage(match, previewCreator);
    }
  }

  private openLiveMediaAsReelPage(m: any, creator: Creator) {
    const followers = creator.followersCount || 0;
    const views = m.viewsCount || 0;
    const likes = m.likeCount || 0;
    const cmts = m.commentsCount || 0;
    const denom = views > 0 ? views : followers;
    const eng = denom > 0 ? Math.round(((likes + cmts) * 100.0 / denom) * 100) / 100 : 0;

    const kind = this.isLookupReel(m) ? 'Instagram Reel' : (m.mediaType === 'VIDEO' ? 'Video Post' : 'Instagram Post');
    const publishedLabel = formatPublishedDateLabel(m.timestamp);
    const previewReel: ReelDeliverable & { publishedAt?: string } = {
      id: m.id,
      brandId: creator.brandId,
      creatorId: creator.id,
      creatorHandle: creator.handle,
      title: publishedLabel ? `${kind} · ${publishedLabel}` : kind,
      reelUrl: m.permalink || '',
      igMediaId: m.id,
      shortcode: m.shortcode || '',
      mediaType: m.mediaProductType || m.mediaType || 'REELS',
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
    if (this.selectedBrandId()) {
      const creatorId = this.pendingQueryParams['creator'] || this.selectedReelCreator()?.id || '';
      if (creatorId) {
        this.navigateWorkspace({
          brand: this.selectedBrandId(),
          tab: this.activeTab(),
          creator: creatorId
        });
      } else {
        const igHandle = this.pendingQueryParams['igHandle']
          || (this.igProfilePreview()?.username ? String(this.igProfilePreview().username) : '');
        this.navigateWorkspace({
          brand: this.selectedBrandId(),
          tab: 'instagram',
          ...(igHandle ? { igHandle } : {})
        });
      }
      return;
    }
    this.selectedReel.set(null);
    this.selectedReelBundle.set(null);
    this.selectedReelCreator.set(null);
    this.selectedReelIsLive.set(false);
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
            if (ic) this.refreshCreatorInsights(ic);
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
        this.navigateWorkspace({
          brand: this.selectedBrandId(),
          tab: this.activeTab(),
          creator: creator.id,
          reel: saved.id
        }, true);
        const ic = this.inspectedCreator();
        if (ic) this.refreshCreatorInsights(ic);
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
        if (ic) this.refreshCreatorInsights(ic);
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
        if (ic) this.refreshCreatorInsights(ic);
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
          this.closeInspector();
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

  openAgencyCreateModal() {
    this.viewedAgency.set(null);
    this.editingAgency.set(null);
    this.agencyFormError.set('');
    this.agencySaving.set(false);
    this.showAgencyModal.set(true);
  }

  openAgencyEditModal(ag: Agency) {
    this.viewedAgency.set(null);
    this.editingAgency.set(ag);
    this.agencyFormError.set('');
    this.agencySaving.set(false);
    this.showAgencyModal.set(true);
  }

  closeAgencyFormModal() {
    this.showAgencyModal.set(false);
    this.editingAgency.set(null);
    this.agencyFormError.set('');
    this.agencySaving.set(false);
  }

  saveAgency(payload: AgencyFormPayload) {
    const brandId = this.selectedBrandId();
    if (!brandId || this.agencySaving()) return;
    this.agencySaving.set(true);
    this.agencyFormError.set('');

    const editing = this.editingAgency();
    if (editing) {
      this.api.updateAgencyPermissions(brandId, editing.id, {
        name: payload.name,
        contactName: payload.contactName,
        contactEmail: payload.contactEmail,
        contactNumber: payload.contactNumber
      }).subscribe({
        next: () => {
          this.closeAgencyFormModal();
          this.auditLoadedBrandId = '';
          this.selectBrand(brandId);
          if (this.activeTab() === 'audit') this.loadAuditLogs();
          this.showToast('Agency details updated.');
        },
        error: (err) => {
          this.agencySaving.set(false);
          this.agencyFormError.set(err?.error?.error || 'Could not update agency details.');
        }
      });
      return;
    }

    this.api.addAgency(brandId, payload).subscribe({
      next: () => {
        this.closeAgencyFormModal();
        this.auditLoadedBrandId = '';
        this.selectBrand(brandId);
        if (this.activeTab() === 'audit') this.loadAuditLogs();
        this.showToast(payload.status === 'DRAFT' ? 'Partner agency saved as draft.' : 'Partner agency onboarded!');
      },
      error: (err) => {
        this.agencySaving.set(false);
        this.agencyFormError.set(err?.error?.error || 'Could not onboard partner agency.');
      }
    });
  }

  activateAgency(ag: Agency) {
    const brandId = this.selectedBrandId();
    if (!brandId) return;
    this.api.updateAgencyPermissions(brandId, ag.id, { status: 'CONNECTED' }).subscribe({
      next: (updated) => {
        this.viewedAgency.set(updated);
        this.auditLoadedBrandId = '';
        this.selectBrand(brandId);
        if (this.activeTab() === 'audit') this.loadAuditLogs();
        this.showToast('Partner agency activated.');
      },
      error: (err) => this.showToast(err?.error?.error || 'Could not activate partner agency.')
    });
  }

  confirmDeleteAgency(ag: Agency) {
    const brandId = this.selectedBrandId();
    if (!brandId) return;
    this.api.deleteAgency(brandId, ag.id).subscribe({
      next: () => {
        this.agencyToDelete.set(null);
        if (this.viewedAgency()?.id === ag.id) this.viewedAgency.set(null);
        this.auditLoadedBrandId = '';
        this.selectBrand(brandId);
        if (this.activeTab() === 'audit') this.loadAuditLogs();
        this.showToast('Partner agency removed.');
      },
      error: (err) => {
        this.agencyToDelete.set(null);
        this.showToast(err?.error?.error || 'Could not remove partner agency.');
      }
    });
  }

  filterByAgency(name: string) {
    this.selectedAgencyFilter = name;
    this.selectedAgencySig.set(name);
    this.switchTab('creators');
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

  openCsvRecapView() {
    this.overviewMode.set('csv');
    this.switchTab('overview');
  }

  selectSpotlightCreator(creatorId: string) {
    this.spotlightCreatorId.set(creatorId);
    this.spotlightReelId.set('');
    this.spotlightChartMode.set('auto');
    this.hoveredSpotlightBarIdx.set(null);
    this.pinnedSpotlightSnapIdx.set(null);
  }

  selectSpotlightReel(reelId: string) {
    this.spotlightReelId.set(reelId);
    this.spotlightChartMode.set('auto');
    this.hoveredSpotlightBarIdx.set(null);
    this.pinnedSpotlightSnapIdx.set(null);
  }

  setSpotlightChartMode(mode: 'snapshots' | 'reels') {
    this.spotlightChartMode.set(mode);
    this.hoveredSpotlightBarIdx.set(null);
    this.pinnedSpotlightSnapIdx.set(null);
  }

  onSpotlightBarClick(index: number, bar: { reel?: ReelDeliverable; snapshot?: ReelSnapshotPoint }) {
    if (bar.reel) {
      this.hoveredSpotlightBarIdx.set(null);
      this.pinnedSpotlightSnapIdx.set(null);
      this.spotlightCreatorId.set(bar.reel.creatorId);
      this.spotlightReelId.set(bar.reel.id);
      return;
    }
    this.pinnedSpotlightSnapIdx.update(cur => cur === index ? null : index);
  }

  refreshSpotlightReel(deliverableId: string) {
    if (this.syncingSpotlightReel()) return;
    this.syncingSpotlightReel.set(true);
    this.api.syncDeliverableInstagram(deliverableId).subscribe({
      next: (updated) => {
        this.syncingSpotlightReel.set(false);
        this.selectBrand(this.selectedBrandId());
        this.showToast(updated.status === 'VERIFIED' ? 'Reel refreshed with live stats!' : 'Saved — waiting for live Instagram sync.');
      },
      error: (err) => {
        this.syncingSpotlightReel.set(false);
        this.showToast(err?.error?.error || 'Could not refresh Reel.');
      }
    });
  }

  cleanAuditTitle = formatAuditTitle;
  cleanAuditSummary = formatAuditSummary;
  readonly displayReelTitle = formatReelDisplayTitle;
  readonly reelMetaLabel = formatReelMetaLabel;
  readonly safeExternalUrl = safeExternalUrl;

  isLookupReel(m: any): boolean {
    if (!m) return false;
    if (m.isReel === true || m.mediaProductType === 'REELS') return true;
    const link = String(m.permalink || '').toLowerCase();
    return link.includes('/reel/') || link.includes('/reels/');
  }

  lookupReels(media: any[] | undefined | null): any[] {
    return (media || []).filter(m => this.isLookupReel(m));
  }

  displayedLookupMedia(media: any[] | undefined | null): any[] {
    const all = media || [];
    return this.lookupMediaFilter() === 'all' ? all : this.lookupReels(all);
  }

  ngOnDestroy(): void {
    this.exitCtrl.destroy();
  }

  confirmDashboardExit(): Observable<boolean> {
    return this.exitCtrl.requestExit(() => {
      this.closeTransientModals();
      this.showSignOutConfirm.set(true);
    });
  }

  confirmSignOutModal() {
    if (this.exitCtrl.confirm(() => this.auth.logout())) {
      this.showSignOutConfirm.set(false);
      return;
    }
    this.logout();
  }

  cancelSignOutModal() {
    this.exitCtrl.cancel(() => this.showSignOutConfirm.set(false));
  }

  logout() {
    this.auth.logout();
    this.router.navigateByUrl('/auth', { replaceUrl: true });
  }
}
