import { Component, OnDestroy, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiService, Agency, AuditLog, Brand, Creator, ReelDeliverable } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { DashboardExitAware, DashboardExitController } from '../services/auth.guard';
import { ConfirmModalComponent } from '../components/confirm-modal.component';
import { AgencyFormModalComponent, AgencyFormPayload } from '../components/agency-form-modal.component';
import { AgencyDetailsModalComponent } from '../components/agency-details-modal.component';
import { AppHeaderComponent } from '../components/app-header.component';
import { AppFooterComponent } from '../components/app-footer.component';
import { ThemeToggleComponent } from '../components/theme-toggle.component';
import {
  CountryPickerComponent,
  enforcePhoneKeydown,
  findCountryByIso,
  splitPhoneNumber,
  validatePhoneDigits
} from '../components/country-picker.component';
import { formatAuditSummary, formatAuditTitle } from '../utils/audit-format';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

@Component({
  selector: 'app-admin-brand-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ConfirmModalComponent, AgencyFormModalComponent, AgencyDetailsModalComponent, AppHeaderComponent, AppFooterComponent, CountryPickerComponent, ThemeToggleComponent],
  template: `
    <div class="bg-cv-canvas font-body text-cv-ink antialiased min-h-screen flex flex-col overflow-x-clip selection:bg-[#f54e26]/25 selection:text-cv-ink">
      <!-- Slim Editorial Header -->
      <app-header [elevated]="true" brandLink="/admin">
        <div header-right class="flex items-center gap-2.5 shrink-0">
          <a routerLink="/admin"
             class="h-8.5 px-3.5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border-strong text-xs font-semibold text-cv-ink inline-flex items-center gap-1.5 whitespace-nowrap transition-colors group">
            <span class="transition-transform group-hover:-translate-x-0.5">←</span>
            <span>Back</span>
          </a>
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

      <main class="w-full bg-cv-canvas flex-1">
        @if (!loaded()) {
          <div class="py-24 text-center text-sm text-cv-ink-muted flex flex-col items-center gap-3">
            <svg class="w-6 h-6 animate-spin text-[#f54e26]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9"/></svg>
            <span>Loading brand details...</span>
          </div>
        } @else if (brand(); as b) {
          <div class="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-5 lg:py-6 flex flex-col gap-5 animate-fade-in-up">
            <!-- Sleek Editorial Entity Header (No Chunky Code Box) -->
            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-cv-border-soft">
              <div class="flex items-center gap-3.5 min-w-0">
                <div class="w-12 h-12 rounded-[4px] bg-[#f54e26] flex items-center justify-center text-[#111111] shrink-0">
                  <span class="font-headline text-2xl font-bold leading-none">{{ b.name.charAt(0).toUpperCase() }}</span>
                </div>
                <div class="flex flex-col gap-1 min-w-0">
                  <div class="flex flex-wrap items-center gap-2.5">
                    <h1 class="font-headline uppercase text-3xl sm:text-4xl text-cv-ink font-bold tracking-[0.015em] leading-none truncate">{{ b.name }}</h1>
                    @if (b.status === 'DRAFT') {
                      <span class="px-2 py-0.5 rounded-[3px] bg-[#fabf29] text-[#111111] text-[11px] font-bold uppercase tracking-wide">Draft</span>
                    }
                  </div>
                  <div class="flex flex-wrap items-center gap-2 text-cv-ink-muted text-xs">
                    <span class="inline-flex items-center gap-1.5">
                      <span class="w-1.5 h-1.5 rounded-full" [ngClass]="b.status === 'ACTIVE' ? 'bg-cv-green' : 'bg-[#fabf29]'"></span>
                      <span class="text-cv-ink font-medium">{{ b.status === 'ACTIVE' ? 'Active workspace' : 'Draft workspace' }}</span>
                    </span>
                    <span>•</span>
                    <span>{{ creators().length }} creators</span>
                    <span>•</span>
                    <span>{{ agencies().length }} partner agencies</span>
                  </div>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-2 self-start lg:self-center">
                @if (b.status === 'DRAFT') {
                  <button type="button" (click)="activateBrand()"
                          class="inline-flex items-center gap-1.5 h-9 px-4 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] text-xs font-bold cursor-pointer transition-colors">
                    <span>Activate Brand</span>
                  </button>
                }
                <button type="button" (click)="openEditModal()"
                        class="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border text-cv-ink text-xs font-medium cursor-pointer transition-colors">
                  <span>Edit Brand</span>
                </button>
                <button type="button" (click)="exportCsv()"
                        class="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border text-cv-ink text-xs font-medium cursor-pointer transition-colors">
                  <span>Export CSV</span>
                </button>
                <button type="button" (click)="showDeleteModal.set(true)"
                        class="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[4px] bg-cv-danger-bg hover:bg-cv-danger-hover border border-[#ff5c5c]/40 text-cv-danger-ink text-xs font-medium cursor-pointer transition-colors">
                  <span>Delete</span>
                </button>
              </div>
            </div>

            <!-- Editorial Underline Tab Rail -->
            <div class="flex items-center gap-6 border-b border-cv-border-soft overflow-x-auto no-scrollbar">
              <button type="button" (click)="switchTab('overview')"
                      class="pb-2.5 -mb-px border-b-2 font-headline uppercase tracking-[0.03em] text-lg font-bold whitespace-nowrap transition-colors cursor-pointer"
                      [ngClass]="activeTab() === 'overview' ? 'border-[#f54e26] text-cv-ink' : 'border-transparent text-cv-ink-muted hover:text-cv-ink'">
                OVERVIEW
              </button>
              <button type="button" (click)="switchTab('agencies')"
                      class="inline-flex items-center gap-2 pb-2.5 -mb-px border-b-2 font-headline uppercase tracking-[0.03em] text-lg font-bold whitespace-nowrap transition-colors cursor-pointer"
                      [ngClass]="activeTab() === 'agencies' ? 'border-[#f54e26] text-cv-ink' : 'border-transparent text-cv-ink-muted hover:text-cv-ink'">
                <span>PARTNER AGENCIES</span>
                <span class="font-body text-xs font-normal text-cv-ink-muted">({{ agencies().length }})</span>
              </button>
              <button type="button" (click)="switchTab('creators')"
                      class="inline-flex items-center gap-2 pb-2.5 -mb-px border-b-2 font-headline uppercase tracking-[0.03em] text-lg font-bold whitespace-nowrap transition-colors cursor-pointer"
                      [ngClass]="activeTab() === 'creators' ? 'border-[#f54e26] text-cv-ink' : 'border-transparent text-cv-ink-muted hover:text-cv-ink'">
                <span>CREATORS</span>
                <span class="font-body text-xs font-normal text-cv-ink-muted">({{ creators().length }})</span>
              </button>
              <button type="button" (click)="switchTab('audit')"
                      class="pb-2.5 -mb-px border-b-2 font-headline uppercase tracking-[0.03em] text-lg font-bold whitespace-nowrap transition-colors cursor-pointer"
                      [ngClass]="activeTab() === 'audit' ? 'border-[#f54e26] text-cv-ink' : 'border-transparent text-cv-ink-muted hover:text-cv-ink'">
                ACTIVITY
              </button>
            </div>

            <!-- TAB 1: OVERVIEW -->
            @if (activeTab() === 'overview') {
              <!-- Unified Swiss Hairline Metric Strip -->
              <div class="rounded-[4px] bg-cv-card border border-cv-border grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-cv-divide tabular-nums">
                <div class="px-5 py-3.5">
                  <span class="text-cv-ink-muted text-xs font-medium block">Tracked Reels</span>
                  <div class="mt-1 flex items-baseline gap-2">
                    <span class="font-headline text-3xl font-bold text-cv-ink leading-none">{{ stats().totalReels }}</span>
                    <span class="text-xs text-cv-green font-medium">Live</span>
                  </div>
                </div>
                <div class="px-5 py-3.5">
                  <span class="text-cv-ink-muted text-xs font-medium block">Total Reach</span>
                  <div class="mt-1 flex items-baseline gap-2">
                    <span class="font-headline text-3xl font-bold text-[#f54e26] leading-none">{{ formatNum(stats().totalReach) }}</span>
                    <span class="text-xs text-cv-ink-muted">{{ stats().totalCreators }} creators</span>
                  </div>
                </div>
                <div class="px-5 py-3.5">
                  <span class="text-cv-ink-muted text-xs font-medium block">Avg. Engagement</span>
                  <div class="mt-1">
                    <span class="font-headline text-3xl font-bold text-cv-gold leading-none">{{ stats().avgEngagement }}%</span>
                  </div>
                </div>
                <div class="px-5 py-3.5">
                  <span class="text-cv-ink-muted text-xs font-medium block">Linked Agencies</span>
                  <div class="mt-1">
                    <span class="font-headline text-3xl font-bold text-cv-ink leading-none">{{ stats().activeAgencies }}</span>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <div class="lg:col-span-5 flex flex-col gap-5">
                  <!-- Brand Manager Panel -->
                  <div class="bg-cv-card rounded-[4px] border border-cv-border divide-y divide-cv-divide">
                    <div class="px-5 py-3 flex items-center justify-between gap-2">
                      <h2 class="font-headline uppercase text-lg font-bold text-cv-ink tracking-[0.02em]">BRAND MANAGER</h2>
                      <button type="button" (click)="openEditModal()" class="text-xs font-medium text-[#f54e26] hover:underline cursor-pointer">Edit</button>
                    </div>
                    <div class="px-5 py-3.5 flex items-center gap-3">
                      <div class="w-9 h-9 rounded-[4px] bg-[#f54e26] text-[#111111] flex items-center justify-center font-headline font-bold text-base shrink-0">
                        {{ (b.managerName || 'BM').substring(0, 2).toUpperCase() }}
                      </div>
                      <div class="flex flex-col min-w-0">
                        <span class="text-sm font-semibold text-cv-ink truncate">{{ b.managerName || 'Unassigned' }}</span>
                        <span class="text-xs text-cv-ink-muted truncate">{{ b.managerEmail }}</span>
                      </div>
                    </div>
                    @if (b.contactNumber) {
                      <div class="px-5 py-2.5 flex items-center justify-between text-xs">
                        <span class="text-cv-ink-muted">Contact number</span>
                        <span class="font-medium text-cv-ink tabular-nums">{{ b.contactNumber }}</span>
                      </div>
                    }
                  </div>

                  <!-- Creators Snapshot Panel -->
                  <div class="bg-cv-card rounded-[4px] border border-cv-border divide-y divide-cv-divide">
                    <div class="px-5 py-3 flex items-center justify-between gap-2">
                      <div>
                        <h2 class="font-headline uppercase text-lg font-bold text-cv-ink tracking-[0.02em] leading-none">CREATORS</h2>
                        <span class="text-[11px] text-cv-ink-muted mt-0.5 block">{{ directCreatorsCount() }} direct • {{ agencyCreatorsCount() }} agency</span>
                      </div>
                      <button type="button" (click)="switchTab('creators')" class="text-xs font-medium text-[#f54e26] hover:underline cursor-pointer">
                        View All ({{ creators().length }}) ↗
                      </button>
                    </div>
                    @if (creators().length === 0) {
                      <p class="px-5 py-4 text-xs text-cv-ink-muted">No creators added to this brand workspace yet.</p>
                    } @else {
                      @for (c of creators().slice(0, 4); track c.id) {
                        <div class="px-5 py-2.5 flex items-center justify-between gap-2 text-xs">
                          <div class="min-w-0">
                            <p class="font-medium text-cv-ink truncate">{{ c.name }}</p>
                            <p class="text-[11px] text-cv-ink-muted truncate">{{ c.handle }}</p>
                          </div>
                          <span class="text-cv-ink-muted tabular-nums shrink-0">{{ c.auditedReelsCount }} reel(s)</span>
                        </div>
                      }
                    }
                  </div>
                </div>

                <div class="lg:col-span-7 flex flex-col gap-5">
                  <!-- Partner Agencies Panel -->
                  <div class="bg-cv-card rounded-[4px] border border-cv-border divide-y divide-cv-divide">
                    <div class="px-5 py-3 flex items-center justify-between gap-2">
                      <h2 class="font-headline uppercase text-lg font-bold text-cv-ink tracking-[0.02em]">LINKED AGENCIES</h2>
                      <button type="button" (click)="openAgencyCreateModal()"
                              class="text-xs font-semibold text-[#f54e26] hover:underline cursor-pointer">
                        + Onboard Agency
                      </button>
                    </div>
                    @if (agencies().length === 0) {
                      <p class="px-5 py-4 text-xs text-cv-ink-muted">No agencies linked to this brand yet.</p>
                    } @else {
                      @for (ag of agencies().slice(0, 3); track ag.id) {
                        <div (click)="viewedAgency.set(ag)" class="px-5 py-3 hover:bg-cv-hover-subtle transition-colors flex items-center justify-between gap-3 cursor-pointer">
                          <div class="flex items-center gap-3 min-w-0">
                            <div class="w-8 h-8 rounded-[4px] bg-[#5738af] text-[#fff6e8] flex items-center justify-center font-headline font-bold text-sm shrink-0">{{ ag.monogram }}</div>
                            <div class="min-w-0">
                              <div class="font-medium text-sm text-cv-ink truncate">{{ ag.name }}</div>
                              <span class="text-xs text-cv-ink-muted truncate block">
                                {{ ag.contactName || 'Manager not set' }}@if (ag.contactEmail) { • {{ ag.contactEmail }} }
                              </span>
                            </div>
                          </div>
                          <div class="flex items-center gap-2 shrink-0">
                            <span class="inline-flex items-center gap-1.5 text-xs" [ngClass]="ag.status === 'DRAFT' ? 'text-cv-gold' : 'text-cv-green'">
                              <span class="w-1.5 h-1.5 rounded-full" [ngClass]="ag.status === 'DRAFT' ? 'bg-cv-gold' : 'bg-cv-green'"></span>
                              <span>{{ ag.status === 'DRAFT' ? 'Draft' : 'Connected' }}</span>
                            </span>
                            <button type="button" (click)="openAgencyEditModal(ag); $event.stopPropagation()" class="h-7 px-2.5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border text-[11px] font-medium text-cv-ink cursor-pointer transition-colors">Edit</button>
                          </div>
                        </div>
                      }
                    }
                  </div>

                  <!-- Tracked Reels Panel -->
                  <div class="bg-cv-card rounded-[4px] border border-cv-border divide-y divide-cv-divide">
                    <div class="px-5 py-3 flex items-center justify-between gap-2">
                      <h2 class="font-headline uppercase text-lg font-bold text-cv-ink tracking-[0.02em]">TRACKED REEL LINKS</h2>
                      <button type="button" (click)="syncNow()" [disabled]="syncing()" class="text-[#f54e26] text-xs font-medium hover:underline cursor-pointer disabled:opacity-50">
                        {{ syncing() ? 'Refreshing...' : 'Refresh Reels ↻' }}
                      </button>
                    </div>
                    @if (recentReels().length === 0) {
                      <p class="px-5 py-4 text-xs text-cv-ink-muted">No reel links tracked yet.</p>
                    } @else {
                      @for (r of recentReels(); track r.id) {
                        <div class="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div class="min-w-0">
                            <div class="font-medium text-sm text-cv-ink truncate">{{ r.title }}</div>
                            <div class="text-xs text-cv-ink-muted truncate">{{ r.reelUrl }}</div>
                          </div>
                          <div class="flex items-center gap-3 shrink-0 tabular-nums">
                            <span class="text-xs font-semibold text-cv-ink">{{ formatNum(r.viewsCount) }} views</span>
                            <span class="text-xs font-medium" [ngClass]="r.status === 'VERIFIED' ? 'text-cv-green' : 'text-cv-gold'">
                              {{ r.status === 'VERIFIED' ? 'Live' : 'Pending' }}
                            </span>
                          </div>
                        </div>
                      }
                    }
                  </div>
                </div>
              </div>
            }

            <!-- TAB 2: LINKED AGENCIES -->
            @if (activeTab() === 'agencies') {
              <div class="flex flex-wrap items-center justify-between gap-3">
                <h2 class="font-headline uppercase text-2xl font-bold text-cv-ink tracking-[0.02em]">{{ agencies().length }} PARTNER AGENCIES</h2>
                <button type="button" (click)="openAgencyCreateModal()"
                        class="h-9 px-4 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase tracking-[0.03em] text-base font-bold cursor-pointer transition-colors">
                  + ONBOARD AGENCY
                </button>
              </div>
              @if (agencies().length === 0) {
                <div class="p-8 rounded-[4px] bg-cv-card text-center border border-dashed border-cv-border-strong">
                  <p class="text-sm text-cv-ink-muted">No agencies linked yet. Click "+ Onboard Agency" to add a partner.</p>
                </div>
              } @else {
                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  @for (ag of agencies(); track ag.id) {
                    <article (click)="viewedAgency.set(ag)" class="bg-cv-card rounded-[4px] p-4 border border-cv-border hover:border-[#f54e26] transition-colors cursor-pointer flex flex-col justify-between gap-3.5">
                      <div class="flex items-start justify-between gap-3">
                        <div class="flex items-center gap-3 min-w-0">
                          <div class="w-10 h-10 rounded-[4px] bg-[#5738af] text-[#fff6e8] flex items-center justify-center font-headline font-bold text-base shrink-0">{{ ag.monogram }}</div>
                          <div class="min-w-0">
                            <h3 class="font-headline uppercase text-lg font-bold text-cv-ink tracking-[0.015em] truncate">{{ ag.name }}</h3>
                            <span class="text-xs text-cv-ink-muted block truncate">{{ ag.handle }} • {{ ag.creatorsCount || 0 }} Creators</span>
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
                          <button type="button" (click)="viewedAgency.set(ag); $event.stopPropagation()" class="h-8 px-3 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border text-xs font-medium text-cv-ink cursor-pointer transition-colors">
                            View
                          </button>
                          <button type="button" (click)="openAgencyEditModal(ag); $event.stopPropagation()" class="h-8 px-3 rounded-[4px] bg-cv-control hover:bg-[#f54e26] border border-cv-border hover:border-[#f54e26] text-xs font-medium text-cv-ink hover:text-[#111111] cursor-pointer transition-colors">
                            Edit
                          </button>
                        </div>
                      </div>
                    </article>
                  }
                </div>
              }
            }

            <!-- TAB 3: ASSOCIATED CREATORS -->
            @if (activeTab() === 'creators') {
              <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div class="group w-full md:max-w-md flex items-center gap-2.5 h-10 px-3 rounded-[4px] bg-cv-well border border-cv-border focus-within:border-[#f54e26] transition-colors">
                  <svg class="doodle-svg w-4 h-4 text-cv-ink-muted group-focus-within:text-[#f54e26] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>
                  <input [(ngModel)]="creatorSearch" (ngModelChange)="creatorSearchSig.set($event)" placeholder="Search creator by name or handle..." class="w-full min-w-0 bg-transparent text-sm text-cv-ink placeholder:text-cv-ink-subtle focus:outline-none"/>
                </div>
                <div class="flex items-center gap-1.5 flex-wrap">
                  <button type="button" (click)="creatorAgencyFilter.set('all')" class="h-8 px-3.5 rounded-[4px] text-xs font-medium cursor-pointer transition-colors" [ngClass]="creatorAgencyFilter() === 'all' ? 'bg-cv-ink text-cv-ink-inverse font-semibold' : 'bg-cv-well border border-cv-border text-cv-ink-muted hover:text-cv-ink'">All ({{ creators().length }})</button>
                  <button type="button" (click)="creatorAgencyFilter.set('DIRECT')" class="h-8 px-3.5 rounded-[4px] text-xs font-medium cursor-pointer transition-colors" [ngClass]="creatorAgencyFilter() === 'DIRECT' ? 'bg-cv-ink text-cv-ink-inverse font-semibold' : 'bg-cv-well border border-cv-border text-cv-ink-muted hover:text-cv-ink'">Direct</button>
                  <button type="button" (click)="creatorAgencyFilter.set('AGENCY')" class="h-8 px-3.5 rounded-[4px] text-xs font-medium cursor-pointer transition-colors" [ngClass]="creatorAgencyFilter() === 'AGENCY' ? 'bg-cv-ink text-cv-ink-inverse font-semibold' : 'bg-cv-well border border-cv-border text-cv-ink-muted hover:text-cv-ink'">Agency-Managed</button>
                </div>
              </div>
              @if (filteredCreators().length === 0) {
                <div class="p-8 rounded-[4px] bg-cv-card text-center border border-dashed border-cv-border-strong">
                  <p class="text-sm text-cv-ink-muted">No creators associated with this brand yet.</p>
                </div>
              } @else {
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                  @for (c of filteredCreators(); track c.id) {
                    <article class="p-4 rounded-[4px] bg-cv-card border border-cv-border flex flex-col justify-between gap-3">
                      <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0">
                          <h3 class="font-headline uppercase text-lg font-bold text-cv-ink tracking-[0.015em] truncate leading-tight">{{ c.name }}</h3>
                          <span class="text-xs text-[#f54e26]">{{ c.handle }}</span>
                        </div>
                        <span class="text-[11px] text-cv-ink-muted shrink-0">{{ c.sourceType === 'AGENCY' ? 'Agency' : 'Direct' }}</span>
                      </div>
                      <div class="grid grid-cols-3 divide-x divide-cv-divide rounded-[4px] bg-cv-well border border-cv-border-soft tabular-nums text-center">
                        <div class="py-2 px-1">
                          <span class="text-[10px] text-cv-ink-muted block">Reach</span>
                          <span class="font-bold text-xs text-cv-ink">{{ formatNum(c.reachCount) }}</span>
                        </div>
                        <div class="py-2 px-1">
                          <span class="text-[10px] text-cv-ink-muted block">Reels</span>
                          <span class="font-bold text-xs text-[#f54e26]">{{ c.auditedReelsCount }}</span>
                        </div>
                        <div class="py-2 px-1">
                          <span class="text-[10px] text-cv-ink-muted block">Eng.</span>
                          <span class="font-bold text-xs text-cv-green">{{ c.engagementRate }}%</span>
                        </div>
                      </div>
                    </article>
                  }
                </div>
              }
            }

            <!-- TAB 4: SIMPLIFIED ACTIVITY TIMELINE -->
            @if (activeTab() === 'audit') {
              <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div class="group w-full md:max-w-md flex items-center gap-2.5 h-10 px-3 rounded-[4px] bg-cv-well border border-cv-border focus-within:border-[#f54e26] transition-colors">
                  <svg class="doodle-svg w-4 h-4 text-cv-ink-muted group-focus-within:text-[#f54e26] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>
                  <input [(ngModel)]="auditSearch" (ngModelChange)="loadAuditLogs()" placeholder="Search activity..." class="w-full min-w-0 bg-transparent text-sm text-cv-ink placeholder:text-cv-ink-subtle focus:outline-none"/>
                </div>
                <div class="flex items-center flex-wrap gap-1.5">
                  <button type="button" (click)="auditCategory.set('ALL'); loadAuditLogs()" class="h-8 px-3.5 rounded-[4px] text-xs font-medium cursor-pointer transition-colors" [ngClass]="auditCategory() === 'ALL' ? 'bg-cv-ink text-cv-ink-inverse font-semibold' : 'bg-cv-well border border-cv-border text-cv-ink-muted hover:text-cv-ink'">All</button>
                  <button type="button" (click)="auditCategory.set('REEL_AUDIT'); loadAuditLogs()" class="h-8 px-3.5 rounded-[4px] text-xs font-medium cursor-pointer transition-colors" [ngClass]="auditCategory() === 'REEL_AUDIT' ? 'bg-cv-ink text-cv-ink-inverse font-semibold' : 'bg-cv-well border border-cv-border text-cv-ink-muted hover:text-cv-ink'">Reels</button>
                  <button type="button" (click)="auditCategory.set('AGENCY_PERMISSION'); loadAuditLogs()" class="h-8 px-3.5 rounded-[4px] text-xs font-medium cursor-pointer transition-colors" [ngClass]="auditCategory() === 'AGENCY_PERMISSION' ? 'bg-cv-ink text-cv-ink-inverse font-semibold' : 'bg-cv-well border border-cv-border text-cv-ink-muted hover:text-cv-ink'">Agencies</button>
                  <button type="button" (click)="auditCategory.set('CREATOR_LINK'); loadAuditLogs()" class="h-8 px-3.5 rounded-[4px] text-xs font-medium cursor-pointer transition-colors" [ngClass]="auditCategory() === 'CREATOR_LINK' ? 'bg-cv-ink text-cv-ink-inverse font-semibold' : 'bg-cv-well border border-cv-border text-cv-ink-muted hover:text-cv-ink'">Creators</button>
                </div>
              </div>

              <section class="w-full bg-cv-card rounded-[4px] border border-cv-border divide-y divide-cv-divide">
                <div class="px-5 py-3 flex items-center justify-between">
                  <h2 class="font-headline uppercase text-lg font-bold text-cv-ink tracking-[0.02em]">RECENT ACTIVITY</h2>
                  <span class="text-xs text-cv-ink-muted tabular-nums">{{ auditTotal() }} events</span>
                </div>
                @if (auditLogs().length === 0) {
                  <p class="px-5 py-8 text-xs text-cv-ink-muted text-center">No activity recorded yet.</p>
                } @else {
                  @for (log of auditLogs(); track log.id) {
                    <article class="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-cv-hover-subtle transition-colors">
                      <div class="flex items-start gap-3 min-w-0">
                        <span class="w-2 h-2 rounded-full mt-1.5 shrink-0"
                              [ngClass]="log.category === 'REEL_AUDIT' ? 'bg-[#f54e26]' : (log.category === 'CREATOR_LINK' ? 'bg-cv-green' : (log.category === 'AGENCY_PERMISSION' ? 'bg-[#5738af]' : 'bg-[#fabf29]'))"></span>
                        <div class="min-w-0">
                          <h3 class="text-sm font-medium text-cv-ink leading-snug">{{ cleanAuditTitle(log.title) }}</h3>
                          <p class="text-xs text-cv-ink-muted mt-0.5 leading-relaxed">{{ cleanAuditSummary(log.description) }}</p>
                        </div>
                      </div>
                      <span class="text-xs text-cv-ink-muted pl-5 sm:pl-0 shrink-0 tabular-nums">{{ log.createdAt | date:'MMM d, h:mm a' }}</span>
                    </article>
                  }
                }
              </section>
            }
          </div>
        }
      </main>

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
        [showFilterCreators]="false"
        (close)="viewedAgency.set(null)"
        (edit)="openAgencyEditModal($event)"
        (activate)="activateAgency($event)"
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

      <!-- Edit Brand Modal (Brand + Brand Manager Details Only) -->
      @if (showEditModal()) {
        <div class="fixed inset-0 z-50 bg-cv-backdrop backdrop-blur-xs flex items-center justify-center p-4 animate-pop-in" (click)="showEditModal.set(false)">
          <div class="bg-cv-card rounded-[6px] max-w-md w-full p-6 border border-cv-border-strong shadow-[6px_6px_0px_#f54e26]" (click)="$event.stopPropagation()">
            <div class="flex items-center justify-between pb-3 border-b border-cv-border mb-4">
              <h3 class="font-headline uppercase text-2xl font-bold text-cv-ink tracking-[0.02em]">EDIT BRAND DETAILS</h3>
              <button type="button" (click)="showEditModal.set(false)" class="w-8 h-8 rounded-[4px] hover:bg-cv-hover-pill flex items-center justify-center text-cv-ink-muted hover:text-cv-ink cursor-pointer">✕</button>
            </div>
            @if (editError()) {
              <div class="mb-3.5 px-3 py-2 rounded-[4px] bg-cv-danger-bg border border-[#ff5c5c]/40 text-xs text-cv-danger-ink font-medium">
                {{ editError() }}
              </div>
            }
            <form (ngSubmit)="saveBrandEdit()" class="space-y-3.5" novalidate>
              <div>
                <label for="edit-brand-name" class="block text-xs font-medium text-cv-ink mb-1">Brand name</label>
                <input id="edit-brand-name" [(ngModel)]="editName" name="editName" placeholder="Brand name" autocomplete="off" required
                       class="w-full h-10 px-3 rounded-[4px] bg-cv-well border border-cv-border text-sm text-cv-ink placeholder:text-cv-ink-subtle focus:border-[#f54e26] focus:outline-none"/>
              </div>
              <div>
                <label for="edit-mgr-name" class="block text-xs font-medium text-cv-ink mb-1">Brand manager name</label>
                <input id="edit-mgr-name" [(ngModel)]="editManagerName" name="editManagerName" placeholder="Manager full name" autocomplete="off" required
                       class="w-full h-10 px-3 rounded-[4px] bg-cv-well border border-cv-border text-sm text-cv-ink placeholder:text-cv-ink-subtle focus:border-[#f54e26] focus:outline-none"/>
              </div>
              <div>
                <label for="edit-mgr-email" class="block text-xs font-medium text-cv-ink mb-1">Brand manager email</label>
                <input id="edit-mgr-email" [(ngModel)]="editManagerEmail" name="editManagerEmail" placeholder="manager@brand.com" autocomplete="off" type="email" required
                       class="w-full h-10 px-3 rounded-[4px] bg-cv-well border border-cv-border text-sm text-cv-ink placeholder:text-cv-ink-subtle focus:border-[#f54e26] focus:outline-none"/>
              </div>
              <div>
                <label for="edit-contact" class="block text-xs font-medium text-cv-ink mb-1">Contact number</label>
                <div class="flex items-center gap-2 pl-2 pr-3 h-10 rounded-[4px] bg-cv-well border border-cv-border focus-within:border-[#f54e26] transition-colors">
                  <app-country-picker
                    [iso]="editPhoneIso()"
                    (isoChange)="onEditCountryChange($event)">
                  </app-country-picker>
                  <input
                    id="edit-contact"
                    [value]="editPhoneLocal()"
                    (input)="onEditPhoneInput($event)"
                    (keydown)="onEditPhoneKeydown($event)"
                    [attr.maxlength]="editSelectedCountry().maxDigits"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    name="editContactNumber"
                    autocomplete="off"
                    [placeholder]="editSelectedCountry().placeholder"
                    type="tel"
                    class="w-full min-w-0 bg-transparent text-sm text-cv-ink placeholder:text-cv-ink-subtle focus:outline-none tabular-nums"/>
                </div>
              </div>
              <div class="flex justify-end gap-2.5 pt-4 border-t border-cv-border">
                <button type="button" (click)="showEditModal.set(false)" class="h-10 px-4 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border text-xs font-medium text-cv-ink-muted hover:text-cv-ink cursor-pointer transition-colors">Cancel</button>
                <button type="submit" [disabled]="savingEdit()" class="h-10 px-5 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase tracking-[0.03em] text-lg font-bold cursor-pointer transition-colors disabled:opacity-60">
                  {{ savingEdit() ? 'SAVING...' : 'SAVE CHANGES ↗' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Toast -->
      @if (toastMsg()) {
        <div class="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-[4px] bg-cv-toast-bg text-cv-toast-ink border-2 border-[#111111] shadow-[4px_4px_0px_#f54e26] text-xs font-bold animate-pop-in">
          {{ toastMsg() }}
        </div>
      }

      <!-- Delete Brand Confirmation Modal -->
      <app-confirm-modal
        [open]="showDeleteModal() && !!brand()"
        [title]="'Delete ' + (brand()?.name || 'brand') + '?'"
        message="This permanently removes the brand workspace, linked agencies, creators, and activity history."
        confirmLabel="Delete Brand"
        busyLabel="Deleting..."
        tone="danger"
        [busy]="deleting()"
        (confirm)="confirmDelete()"
        (cancel)="!deleting() && showDeleteModal.set(false)">
      </app-confirm-modal>

      <!-- Sign Out Confirmation Modal -->
      <app-confirm-modal
        [open]="showSignOutConfirm()"
        [title]="exitCtrl.promptVisible() ? 'Sign out &amp; leave Admin?' : 'Sign out of Admin?'"
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
export class AdminBrandDetailsComponent implements OnInit, OnDestroy, DashboardExitAware {
  readonly exitCtrl = new DashboardExitController();
  brandId = '';
  loaded = signal(false);
  brand = signal<Brand | null>(null);
  agencies = signal<Agency[]>([]);
  creators = signal<Creator[]>([]);
  recentReels = signal<ReelDeliverable[]>([]);
  stats = signal({ totalReels: 0, totalReach: 0, avgEngagement: 0, activeAgencies: 0, totalCreators: 0 });
  activeTab = signal<'overview' | 'agencies' | 'creators' | 'audit'>('overview');

  creatorSearch = '';
  creatorSearchSig = signal('');
  creatorAgencyFilter = signal('all');

  auditLogs = signal<AuditLog[]>([]);
  auditTotal = signal(0);
  auditCategory = signal('ALL');
  auditSearch = '';

  showAgencyModal = signal(false);
  editingAgency = signal<Agency | null>(null);
  viewedAgency = signal<Agency | null>(null);
  agencyToDelete = signal<Agency | null>(null);
  agencySaving = signal(false);
  agencyFormError = signal('');

  showEditModal = signal(false);
  showDeleteModal = signal(false);
  showSignOutConfirm = signal(false);
  deleting = signal(false);
  savingEdit = signal(false);
  syncing = signal(false);
  toastMsg = signal('');
  editError = signal('');
  editName = '';
  editManagerName = '';
  editManagerEmail = '';
  editPhoneIso = signal('IN');
  editPhoneLocal = signal('');
  editSelectedCountry = computed(() => findCountryByIso(this.editPhoneIso()));

  cleanAuditTitle = formatAuditTitle;
  cleanAuditSummary = formatAuditSummary;

  directCreatorsCount = computed(() => this.creators().filter(c => c.sourceType === 'DIRECT').length);
  agencyCreatorsCount = computed(() => this.creators().filter(c => c.sourceType === 'AGENCY').length);

  filteredCreators = computed(() => {
    const q = this.creatorSearchSig().toLowerCase();
    const f = this.creatorAgencyFilter();
    return this.creators().filter(c => {
      const mType = f === 'all' || c.sourceType === f;
      const mQuery = !q || c.name.toLowerCase().includes(q) || c.handle.toLowerCase().includes(q);
      return mType && mQuery;
    });
  });

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(p => {
      this.brandId = p['id'];
      this.loadOverview();
      if (this.activeTab() === 'audit') {
        this.loadAuditLogs();
      }
    });
    this.route.queryParams.subscribe(q => {
      this.closeAgencyFormModal();
      this.viewedAgency.set(null);
      this.agencyToDelete.set(null);
      this.showEditModal.set(false);
      this.showDeleteModal.set(false);
      if (!this.exitCtrl.promptVisible()) {
        this.showSignOutConfirm.set(false);
      }
      const tab = q['tab'];
      if (tab === 'overview' || tab === 'agencies' || tab === 'creators' || tab === 'audit') {
        this.activeTab.set(tab);
        if (tab === 'audit' && this.brandId) {
          this.loadAuditLogs();
        }
      } else {
        this.activeTab.set('overview');
      }
    });
  }

  switchTab(tab: 'overview' | 'agencies' | 'creators' | 'audit') {
    if (this.activeTab() === tab) {
      if (tab === 'audit' && this.brandId) this.loadAuditLogs();
      return;
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab }
    });
  }

  private showToast(msg: string) {
    this.toastMsg.set(msg);
    setTimeout(() => {
      if (this.toastMsg() === msg) this.toastMsg.set('');
    }, 3200);
  }

  loadOverview() {
    this.api.getBrandOverview(this.brandId).subscribe({
      next: (res) => {
        this.brand.set(res.brand);
        this.agencies.set(res.agencies);
        this.creators.set(res.creators);
        this.recentReels.set(res.recentReels);
        this.stats.set(res.stats);
        this.loaded.set(true);
      },
      error: (err) => {
        this.loaded.set(true);
        this.showToast(err?.error?.error || 'Could not load brand details.');
      }
    });
  }

  loadAuditLogs() {
    this.api.listAuditLogs(this.brandId, this.auditCategory(), this.auditSearch).subscribe({
      next: (res) => {
        this.auditLogs.set(res.items);
        this.auditTotal.set(res.total);
      },
      error: (err) => {
        this.showToast(err?.error?.error || 'Could not load activity history.');
      }
    });
  }

  syncNow() {
    if (this.syncing()) return;
    this.syncing.set(true);
    this.api.syncBrandDeliverables(this.brandId).subscribe({
      next: () => {
        this.syncing.set(false);
        this.loadOverview();
        if (this.activeTab() === 'audit') this.loadAuditLogs();
        this.showToast('Reel numbers refreshed.');
      },
      error: (err) => {
        this.syncing.set(false);
        this.showToast(err?.error?.error || 'Could not refresh Reel numbers.');
      }
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
    if (!this.brandId || this.agencySaving()) return;
    this.agencySaving.set(true);
    this.agencyFormError.set('');

    const editing = this.editingAgency();
    if (editing) {
      this.api.updateAgencyPermissions(this.brandId, editing.id, {
        name: payload.name,
        contactName: payload.contactName,
        contactEmail: payload.contactEmail,
        contactNumber: payload.contactNumber
      }).subscribe({
        next: () => {
          this.closeAgencyFormModal();
          this.loadOverview();
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

    this.api.addAgency(this.brandId, payload).subscribe({
      next: () => {
        this.closeAgencyFormModal();
        this.loadOverview();
        if (this.activeTab() === 'audit') this.loadAuditLogs();
        this.showToast(payload.status === 'DRAFT' ? 'Partner agency saved as draft.' : 'Partner agency onboarded.');
      },
      error: (err) => {
        this.agencySaving.set(false);
        this.agencyFormError.set(err?.error?.error || 'Could not onboard partner agency.');
      }
    });
  }

  activateAgency(ag: Agency) {
    if (!this.brandId) return;
    this.api.updateAgencyPermissions(this.brandId, ag.id, { status: 'CONNECTED' }).subscribe({
      next: (updated) => {
        this.viewedAgency.set(updated);
        this.loadOverview();
        if (this.activeTab() === 'audit') this.loadAuditLogs();
        this.showToast('Partner agency activated.');
      },
      error: (err) => this.showToast(err?.error?.error || 'Could not activate partner agency.')
    });
  }

  confirmDeleteAgency(ag: Agency) {
    if (!this.brandId) return;
    this.api.deleteAgency(this.brandId, ag.id).subscribe({
      next: () => {
        this.agencyToDelete.set(null);
        if (this.viewedAgency()?.id === ag.id) this.viewedAgency.set(null);
        this.loadOverview();
        if (this.activeTab() === 'audit') this.loadAuditLogs();
        this.showToast('Partner agency removed.');
      },
      error: (err) => {
        this.agencyToDelete.set(null);
        this.showToast(err?.error?.error || 'Could not remove partner agency.');
      }
    });
  }

  activateBrand() {
    this.api.updateBrand(this.brandId, { status: 'ACTIVE' }).subscribe({
      next: () => {
        this.loadOverview();
        if (this.activeTab() === 'audit') this.loadAuditLogs();
        this.showToast('Brand activated.');
      },
      error: (err) => {
        this.showToast(err?.error?.error || 'Could not activate brand.');
      }
    });
  }

  openEditModal() {
    const b = this.brand();
    if (!b) return;
    this.editError.set('');
    this.editName = b.name || '';
    this.editManagerName = b.managerName || '';
    this.editManagerEmail = b.managerEmail || '';
    const parsed = splitPhoneNumber(b.contactNumber);
    this.editPhoneIso.set(parsed.iso);
    this.editPhoneLocal.set(parsed.local);
    this.showEditModal.set(true);
  }

  onEditCountryChange(iso: string) {
    this.editPhoneIso.set(iso);
    const max = this.editSelectedCountry().maxDigits;
    this.editPhoneLocal.set(this.editPhoneLocal().replace(/\D/g, '').slice(0, max));
  }

  onEditPhoneKeydown(event: KeyboardEvent) {
    enforcePhoneKeydown(event, this.editPhoneLocal(), this.editSelectedCountry().maxDigits);
  }

  onEditPhoneInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const max = this.editSelectedCountry().maxDigits;
    const digitsOnly = input.value.replace(/\D/g, '').slice(0, max);
    if (input.value !== digitsOnly) input.value = digitsOnly;
    this.editPhoneLocal.set(digitsOnly);
  }

  saveBrandEdit() {
    this.editError.set('');
    const name = this.editName.trim();
    const managerName = this.editManagerName.trim();
    const managerEmail = this.editManagerEmail.trim();
    const phoneDigits = this.editPhoneLocal().replace(/\D/g, '');
    const phoneErr = validatePhoneDigits(this.editPhoneIso(), phoneDigits, false);

    if (name.length < 2) {
      this.editError.set('Brand name must be at least 2 characters.');
      return;
    }
    if (managerName.length < 2) {
      this.editError.set('Brand manager name must be at least 2 characters.');
      return;
    }
    if (!EMAIL_REGEX.test(managerEmail)) {
      this.editError.set('Enter a valid Brand manager email.');
      return;
    }
    if (phoneErr) {
      this.editError.set(`Contact number: ${phoneErr}.`);
      return;
    }

    const formattedPhone = phoneDigits ? `${this.editSelectedCountry().dial} ${phoneDigits}` : '';
    this.savingEdit.set(true);
    this.api.updateBrand(this.brandId, {
      name,
      managerName,
      managerEmail,
      contactNumber: formattedPhone
    }).subscribe({
      next: () => {
        this.savingEdit.set(false);
        this.showEditModal.set(false);
        this.loadOverview();
        if (this.activeTab() === 'audit') this.loadAuditLogs();
        this.showToast('Brand details updated.');
      },
      error: (err) => {
        this.savingEdit.set(false);
        this.editError.set(err?.error?.error || 'Could not save brand details.');
      }
    });
  }

  exportCsv() {
    this.api.exportBrandCsv(this.brandId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.brand()?.slug || 'brand'}-report.csv`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.showToast(err?.error?.error || 'Could not export CSV report.');
      }
    });
  }

  formatNum(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  confirmDelete() {
    this.deleting.set(true);
    this.api.deleteBrand(this.brandId).subscribe({
      next: () => {
        this.deleting.set(false);
        this.router.navigateByUrl('/admin');
      },
      error: (err) => {
        this.deleting.set(false);
        this.showDeleteModal.set(false);
        this.showToast(err?.error?.error || 'Could not delete brand.');
      }
    });
  }

  ngOnDestroy(): void {
    this.exitCtrl.destroy();
  }

  confirmDashboardExit(): Observable<boolean> {
    return this.exitCtrl.requestExit(() => {
      this.closeAgencyFormModal();
      this.viewedAgency.set(null);
      this.agencyToDelete.set(null);
      this.showEditModal.set(false);
      this.showDeleteModal.set(false);
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
