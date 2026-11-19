import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService, Agency, AuditLog, Brand, Creator, ReelDeliverable } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { ConfirmModalComponent } from '../components/confirm-modal.component';

@Component({
  selector: 'app-admin-brand-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ConfirmModalComponent],
  template: `
    <div class="bg-background font-body text-on-surface antialiased min-h-screen flex flex-col overflow-x-hidden">
      <!-- Header -->
      <header class="shrink-0 w-full z-40 bg-background/90 backdrop-blur-xl border-b border-surface-container-high/40">
        <div class="h-[52px] w-full px-4 sm:px-8 max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <a routerLink="/admin" class="flex items-center gap-2 shrink-0">
              <img src="/converge-logo.png" alt="Converge" class="w-7 h-7 rounded-full object-contain shrink-0"/>
              <span class="font-headline text-base sm:text-lg text-ink-primary font-bold">Converge</span>
            </a>
            <div class="h-4 w-px bg-surface-container-highest hidden sm:block"></div>
            <a routerLink="/admin" class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-surface-container-low hover:bg-surface-container text-ink-secondary text-xs font-semibold transition-all whitespace-nowrap">
              <span class="material-symbols-outlined text-[15px]">arrow_back</span>
              <span>Directory</span>
            </a>
            @if (brand(); as b) {
              <nav class="hidden md:flex items-center gap-1 text-ink-secondary text-sm min-w-0">
                <span class="material-symbols-outlined text-[14px] text-outline-variant">chevron_right</span>
                <span class="font-headline text-ink-primary font-semibold truncate">{{ b.name }}</span>
              </nav>
            }
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <div class="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-mint-container text-ink-primary text-xs font-semibold">
              <span class="w-2 h-2 rounded-full bg-mint-green animate-pulse"></span>
              <span>System Admin</span>
            </div>
            <button (click)="showSignOutConfirm.set(true)" class="px-3.5 py-1.5 rounded-full bg-surface-container-soft hover:bg-surface-container-high text-xs font-semibold text-ink-secondary cursor-pointer whitespace-nowrap transition-colors">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main class="w-full bg-background flex-1">
        @if (brand(); as b) {
          <div class="w-full max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-6 flex flex-col gap-5">
            <!-- Entity Header -->
            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div class="flex items-start sm:items-center gap-4">
                <div class="relative shrink-0">
                  <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-primary to-primary-container flex items-center justify-center text-white shadow-md">
                    <span class="font-headline text-3xl sm:text-4xl font-bold">{{ b.name.charAt(0).toUpperCase() }}</span>
                  </div>
                  <div class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-mint-container flex items-center justify-center shadow-sm">
                    <span class="w-2.5 h-2.5 rounded-full bg-mint-green"></span>
                  </div>
                </div>
                <div class="flex flex-col gap-1 min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <h1 class="font-headline text-2xl sm:text-4xl text-ink-primary font-bold truncate">{{ b.name }}</h1>
                    <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-mint-container text-[#166534] text-xs font-semibold">
                      <span class="w-2 h-2 rounded-full bg-mint-green animate-pulse"></span>
                      <span>{{ b.status }} Brand</span>
                    </div>
                  </div>
                  <div class="flex flex-wrap items-center gap-2 text-ink-secondary text-xs font-semibold">
                    <span class="font-mono bg-surface-container px-2 py-0.5 rounded-md text-ink-primary">{{ b.code }}</span>
                    <span>•</span>
                    <span>{{ creators().length }} Associated Creators</span>
                    <span>•</span>
                    <span>{{ agencies().length }} Partner Agencies</span>
                  </div>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-2 self-start lg:self-center">
                <button (click)="openEditModal()" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-container-low hover:bg-surface-container text-ink-primary text-xs font-semibold shadow-sm cursor-pointer">
                  <span class="material-symbols-outlined text-[17px] text-ink-secondary">edit</span>
                  <span>Edit Brand</span>
                </button>
                <button (click)="exportCsv()" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-ink-primary hover:bg-on-background text-on-primary text-xs font-semibold shadow-md cursor-pointer">
                  <span class="material-symbols-outlined text-[17px]">ios_share</span>
                  <span>Export Report</span>
                </button>
                <button (click)="showDeleteModal.set(true)" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-coral-container/60 hover:bg-coral-container text-secondary text-xs font-semibold cursor-pointer transition-colors">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4.5 7h15"/>
                    <path d="M9.5 4.5h5a1 1 0 0 1 1 1V7h-7V5.5a1 1 0 0 1 1-1z"/>
                    <path d="M6.5 7l1 12a2 2 0 0 0 2 1.8h5a2 2 0 0 0 2-1.8l1-12"/>
                  </svg>
                  <span>Delete</span>
                </button>
              </div>
            </div>

            <!-- 4-Tab Pill Rail -->
            <div class="flex items-center gap-2 p-1.5 bg-surface-container-low rounded-2xl overflow-x-auto no-scrollbar shadow-sm">
              <button (click)="activeTab.set('overview')" class="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer"
                      [ngClass]="activeTab() === 'overview' ? 'bg-primary-container text-on-primary shadow-sm' : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-container'">
                <span class="material-symbols-outlined text-[18px]">dashboard</span>
                <span>Overview</span>
              </button>
              <button (click)="activeTab.set('agencies')" class="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer"
                      [ngClass]="activeTab() === 'agencies' ? 'bg-primary-container text-on-primary shadow-sm' : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-container'">
                <span class="material-symbols-outlined text-[18px]">hub</span>
                <span>Linked Agencies</span>
                <span class="px-2 py-0.5 rounded-full bg-surface-container-high text-ink-primary text-[11px] font-bold">{{ agencies().length }}</span>
              </button>
              <button (click)="activeTab.set('creators')" class="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer"
                      [ngClass]="activeTab() === 'creators' ? 'bg-primary-container text-on-primary shadow-sm' : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-container'">
                <span class="material-symbols-outlined text-[18px]">group</span>
                <span>Associated Creators</span>
                <span class="px-2 py-0.5 rounded-full bg-surface-container-high text-ink-primary text-[11px] font-bold">{{ creators().length }}</span>
              </button>
              <button (click)="activeTab.set('audit'); loadAuditLogs()" class="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer"
                      [ngClass]="activeTab() === 'audit' ? 'bg-primary-container text-on-primary shadow-sm' : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-container'">
                <span class="material-symbols-outlined text-[18px]">fact_check</span>
                <span>Audit Logs</span>
              </button>
            </div>

            <!-- TAB 1: OVERVIEW -->
            @if (activeTab() === 'overview') {
              <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 shadow-sm">
                  <span class="text-ink-secondary text-xs font-semibold">Total Reel Audits</span>
                  <div class="mt-2 flex items-baseline gap-2">
                    <span class="font-headline text-2xl font-bold text-ink-primary">{{ stats().totalReels }}</span>
                    <span class="text-[11px] text-mint-green font-semibold">Verified</span>
                  </div>
                </div>
                <div class="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 shadow-sm">
                  <span class="text-ink-secondary text-xs font-semibold">Total Verified Reach</span>
                  <div class="mt-2 flex items-baseline gap-2">
                    <span class="font-headline text-2xl font-bold text-ink-primary">{{ formatNum(stats().totalReach) }}</span>
                    <span class="text-[11px] text-ink-secondary">{{ stats().totalCreators }} creators</span>
                  </div>
                </div>
                <div class="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 shadow-sm">
                  <span class="text-ink-secondary text-xs font-semibold">Avg. Engagement</span>
                  <div class="mt-2 flex items-baseline gap-2">
                    <span class="font-headline text-2xl font-bold text-ink-primary">{{ stats().avgEngagement }}%</span>
                  </div>
                </div>
                <div class="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 shadow-sm">
                  <span class="text-ink-secondary text-xs font-semibold">Linked Agencies</span>
                  <div class="mt-2 flex items-baseline gap-2">
                    <span class="font-headline text-2xl font-bold text-ink-primary">{{ stats().activeAgencies }}</span>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div class="lg:col-span-5 flex flex-col gap-6">
                  <div class="bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                    <h2 class="font-headline text-lg font-bold text-ink-primary flex items-center gap-2">
                      <span class="w-2 h-4 rounded-full bg-mint-green inline-block"></span>
                      Brand Manager
                    </h2>
                    <div class="flex items-center gap-3 p-4 rounded-2xl bg-surface-container-low">
                      <div class="w-11 h-11 rounded-full bg-blue-container text-primary flex items-center justify-center font-bold shrink-0">
                        {{ (b.managerName || 'BM').substring(0, 2).toUpperCase() }}
                      </div>
                      <div class="flex flex-col min-w-0">
                        <span class="font-headline text-sm font-bold text-ink-primary truncate">{{ b.managerName || 'Unassigned' }}</span>
                        <span class="text-xs text-primary truncate">{{ b.managerEmail }}</span>
                      </div>
                    </div>
                    @if (b.contactNumber || b.instagramHandle) {
                      <div class="flex flex-col gap-2">
                        @if (b.instagramHandle) {
                          <div class="flex items-center justify-between py-2 px-3 rounded-xl bg-surface-container-low text-xs">
                            <span class="text-ink-secondary">Instagram</span>
                            <span class="font-mono font-semibold text-primary">{{ b.instagramHandle }}</span>
                          </div>
                        }
                        @if (b.contactNumber) {
                          <div class="flex items-center justify-between py-2 px-3 rounded-xl bg-surface-container-low text-xs">
                            <span class="text-ink-secondary">Contact</span>
                            <span class="font-semibold text-ink-primary">{{ b.contactNumber }}</span>
                          </div>
                        }
                      </div>
                    }
                  </div>

                  <div class="bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                    <div class="flex items-center justify-between gap-2">
                      <h2 class="font-headline text-lg font-bold text-ink-primary flex items-center gap-2">
                        <span class="w-2 h-4 rounded-full bg-primary inline-block"></span>
                        Creators Snapshot
                      </h2>
                      <button type="button" (click)="activeTab.set('creators')" class="text-xs font-semibold text-primary hover:underline cursor-pointer">
                        View All ({{ creators().length }}) →
                      </button>
                    </div>
                    <div class="grid grid-cols-2 gap-2.5 text-center">
                      <div class="p-3 rounded-xl bg-surface-container-low">
                        <span class="text-[11px] text-ink-secondary block">Direct Creators</span>
                        <span class="font-headline text-lg font-bold text-ink-primary">{{ directCreatorsCount() }}</span>
                      </div>
                      <div class="p-3 rounded-xl bg-surface-container-low">
                        <span class="text-[11px] text-ink-secondary block">Agency-Managed</span>
                        <span class="font-headline text-lg font-bold text-primary">{{ agencyCreatorsCount() }}</span>
                      </div>
                    </div>
                    @if (creators().length === 0) {
                      <p class="text-xs text-ink-secondary py-2">No creators added to this brand workspace yet.</p>
                    } @else {
                      <div class="flex flex-col gap-2">
                        @for (c of creators().slice(0, 4); track c.id) {
                          <div class="p-3 rounded-xl bg-surface-container-low flex items-center justify-between gap-2 text-xs">
                            <div class="min-w-0">
                              <p class="font-bold text-ink-primary truncate">{{ c.name }}</p>
                              <p class="font-mono text-[11px] text-ink-secondary truncate">{{ c.handle }}</p>
                            </div>
                            <span class="font-semibold text-ink-primary shrink-0">{{ c.auditedReelsCount }} reel(s)</span>
                          </div>
                        }
                      </div>
                    }
                  </div>
                </div>

                <div class="lg:col-span-7 flex flex-col gap-6">
                  <div class="bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                    <div class="flex items-center justify-between gap-2">
                      <h2 class="font-headline text-lg font-bold text-ink-primary">Linked Agencies</h2>
                      <button (click)="showAgencyModal.set(true)" class="px-4 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-primary text-xs font-semibold cursor-pointer">
                        + Link Agency
                      </button>
                    </div>
                    @if (agencies().length === 0) {
                      <p class="text-xs text-ink-secondary py-4">No agencies linked to this brand yet.</p>
                    } @else {
                      <div class="flex flex-col gap-2.5">
                        @for (ag of agencies().slice(0, 3); track ag.id) {
                          <div class="p-4 rounded-2xl bg-surface-container-low flex items-center justify-between gap-3">
                            <div class="flex items-center gap-3 min-w-0">
                              <div class="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold shrink-0">{{ ag.monogram }}</div>
                              <div class="min-w-0">
                                <div class="font-bold text-sm text-ink-primary truncate">{{ ag.name }}</div>
                                <span class="text-xs text-ink-secondary">{{ ag.auditedReelsCount }} reels monitored</span>
                              </div>
                            </div>
                            <span class="px-2.5 py-1 rounded-full bg-mint-container text-[#166534] text-xs font-medium shrink-0">{{ ag.status }}</span>
                          </div>
                        }
                      </div>
                    }
                  </div>

                  <div class="bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                    <div class="flex items-center justify-between">
                      <h2 class="font-headline text-lg font-bold text-ink-primary">Audited Reel Links</h2>
                      <button (click)="syncNow()" class="text-primary text-xs font-semibold hover:underline cursor-pointer">Sync Live Deliverables</button>
                    </div>
                    @if (recentReels().length === 0) {
                      <p class="text-xs text-ink-secondary py-4">No reel deliverables verified yet.</p>
                    } @else {
                      <div class="flex flex-col gap-2.5">
                        @for (r of recentReels(); track r.id) {
                          <div class="p-4 rounded-2xl bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div class="min-w-0">
                              <div class="font-bold text-sm text-ink-primary truncate">{{ r.title }}</div>
                              <div class="text-xs font-mono text-ink-secondary truncate">{{ r.reelUrl }}</div>
                            </div>
                            <div class="flex items-center gap-3 shrink-0">
                              <span class="text-xs font-bold text-ink-primary">{{ formatNum(r.viewsCount) }} views</span>
                              <span class="px-2.5 py-0.5 rounded-full bg-mint-container text-[#166534] text-xs font-semibold">{{ r.status }}</span>
                            </div>
                          </div>
                        }
                      </div>
                    }
                  </div>
                </div>
              </div>
            }

            <!-- TAB 2: LINKED AGENCIES -->
            @if (activeTab() === 'agencies') {
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 class="font-headline text-2xl font-bold text-ink-primary">{{ agencies().length }} Authorized Agency Partners</h2>
                </div>
                <button (click)="showAgencyModal.set(true)" class="px-5 py-2.5 rounded-full bg-primary text-on-primary text-xs font-semibold cursor-pointer">+ Link New Agency</button>
              </div>
              @if (agencies().length === 0) {
                <div class="p-10 rounded-3xl bg-surface-container-lowest text-center border border-dashed border-outline-variant">
                  <p class="text-sm text-ink-secondary">No agencies linked yet. Click "Link New Agency" to authorize a partner.</p>
                </div>
              } @else {
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  @for (ag of agencies(); track ag.id) {
                    <article class="bg-surface-cream rounded-3xl p-6 shadow-sm border border-surface-container-high/50 flex flex-col gap-4">
                      <div class="flex items-start justify-between gap-3">
                        <div class="flex items-center gap-3 min-w-0">
                          <div class="w-12 h-12 rounded-2xl bg-blue-container/70 text-primary flex items-center justify-center font-bold text-base shrink-0">{{ ag.monogram }}</div>
                          <div class="min-w-0">
                            <h3 class="font-headline text-base font-bold text-ink-primary truncate">{{ ag.name }}</h3>
                            <span class="text-xs text-ink-secondary">{{ ag.handle }}</span>
                          </div>
                        </div>
                        <span class="px-3 py-1 rounded-full bg-mint-container text-ink-primary text-xs font-semibold shrink-0">{{ ag.status }}</span>
                      </div>
                      <div class="p-3 rounded-2xl bg-surface-warm text-xs text-ink-secondary">{{ ag.scopeDescription }}</div>
                    </article>
                  }
                </div>
              }
            }

            <!-- TAB 3: ASSOCIATED CREATORS -->
            @if (activeTab() === 'creators') {
              <div class="p-4 rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <input [(ngModel)]="creatorSearch" (ngModelChange)="creatorSearchSig.set($event)" placeholder="Search creator by name or handle..." class="w-full md:max-w-md h-11 px-4 rounded-xl bg-surface-container-low text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
                <div class="flex items-center gap-2 flex-wrap">
                  <button (click)="creatorAgencyFilter.set('all')" class="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer" [ngClass]="creatorAgencyFilter() === 'all' ? 'bg-primary text-white' : 'bg-surface-container-low text-ink-secondary'">All ({{ creators().length }})</button>
                  <button (click)="creatorAgencyFilter.set('DIRECT')" class="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer" [ngClass]="creatorAgencyFilter() === 'DIRECT' ? 'bg-primary text-white' : 'bg-surface-container-low text-ink-secondary'">Direct</button>
                  <button (click)="creatorAgencyFilter.set('AGENCY')" class="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer" [ngClass]="creatorAgencyFilter() === 'AGENCY' ? 'bg-primary text-white' : 'bg-surface-container-low text-ink-secondary'">Agency-Managed</button>
                </div>
              </div>
              @if (filteredCreators().length === 0) {
                <div class="p-10 rounded-3xl bg-surface-container-lowest text-center border border-dashed border-outline-variant">
                  <p class="text-sm text-ink-secondary">No creators associated with this brand yet.</p>
                </div>
              } @else {
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  @for (c of filteredCreators(); track c.id) {
                    <article class="p-6 rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col justify-between gap-4">
                      <div>
                        <div class="flex items-start justify-between gap-2">
                          <div class="min-w-0">
                            <h3 class="font-headline text-base font-bold text-ink-primary truncate">{{ c.name }}</h3>
                            <span class="font-mono text-xs text-primary">{{ c.handle }}</span>
                          </div>
                          <span class="px-2.5 py-1 rounded-full bg-mint-container text-[#166534] text-[11px] font-semibold shrink-0">Active</span>
                        </div>
                        <div class="grid grid-cols-3 gap-2 mt-4">
                          <div class="p-2 rounded-xl bg-surface-container-low text-center">
                            <span class="text-[11px] text-ink-secondary block">Reach</span>
                            <span class="font-bold text-sm text-ink-primary">{{ formatNum(c.reachCount) }}</span>
                          </div>
                          <div class="p-2 rounded-xl bg-surface-container-low text-center">
                            <span class="text-[11px] text-ink-secondary block">Audited</span>
                            <span class="font-bold text-sm text-primary">{{ c.auditedReelsCount }}</span>
                          </div>
                          <div class="p-2 rounded-xl bg-surface-container-low text-center">
                            <span class="text-[11px] text-ink-secondary block">Eng.</span>
                            <span class="font-bold text-sm text-mint-green">{{ c.engagementRate }}%</span>
                          </div>
                        </div>
                      </div>
                    </article>
                  }
                </div>
              }
            }

            <!-- TAB 4: AUDIT LOGS -->
            @if (activeTab() === 'audit') {
              <div class="p-4 rounded-3xl bg-surface-warm shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <input [(ngModel)]="auditSearch" (ngModelChange)="loadAuditLogs()" placeholder="Search events by ID or keyword..." class="w-full md:max-w-md h-11 px-5 rounded-full bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"/>
                <div class="flex items-center flex-wrap gap-2">
                  <button (click)="auditCategory.set('ALL'); loadAuditLogs()" class="px-4 py-2 rounded-full text-xs font-semibold cursor-pointer" [ngClass]="auditCategory() === 'ALL' ? 'bg-primary text-white' : 'bg-surface-container-soft text-ink-primary'">All Events</button>
                  <button (click)="auditCategory.set('REEL_AUDIT'); loadAuditLogs()" class="px-4 py-2 rounded-full text-xs font-semibold cursor-pointer" [ngClass]="auditCategory() === 'REEL_AUDIT' ? 'bg-primary text-white' : 'bg-surface-container-soft text-ink-primary'">Reel Audits</button>
                  <button (click)="auditCategory.set('AGENCY_PERMISSION'); loadAuditLogs()" class="px-4 py-2 rounded-full text-xs font-semibold cursor-pointer" [ngClass]="auditCategory() === 'AGENCY_PERMISSION' ? 'bg-primary text-white' : 'bg-surface-container-soft text-ink-primary'">Agency Permissions</button>
                  <button (click)="auditCategory.set('CREATOR_LINK'); loadAuditLogs()" class="px-4 py-2 rounded-full text-xs font-semibold cursor-pointer" [ngClass]="auditCategory() === 'CREATOR_LINK' ? 'bg-primary text-white' : 'bg-surface-container-soft text-ink-primary'">Creator Links</button>
                </div>
              </div>

              <section class="w-full bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-4">
                <div class="flex items-center justify-between">
                  <h2 class="font-headline text-lg font-bold text-ink-primary">Verified Activity &amp; Audit Ledger</h2>
                  <span class="font-mono text-xs bg-surface-container px-3 py-1 rounded-full">{{ auditTotal() }} records</span>
                </div>
                <div class="flex flex-col gap-3">
                  @for (log of auditLogs(); track log.id) {
                    <article class="p-4 rounded-2xl bg-surface-container-soft flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                      <div class="flex flex-col gap-1">
                        <div class="flex items-center gap-2 flex-wrap">
                          <h3 class="font-headline text-sm font-bold text-ink-primary">{{ log.title }}</h3>
                          <span class="px-2.5 py-0.5 rounded-full bg-mint-container text-[#137333] text-[11px] font-semibold">{{ log.statusBadge }}</span>
                          <span class="font-mono text-ink-secondary text-xs">{{ log.eventCode }}</span>
                        </div>
                        <p class="text-xs sm:text-sm text-on-surface">{{ log.description }}</p>
                      </div>
                      <span class="text-xs font-semibold text-ink-secondary shrink-0">{{ log.createdAt | date:'short' }}</span>
                    </article>
                  }
                </div>
              </section>
            }
          </div>
        }
      </main>

      <!-- Link Agency Modal -->
      @if (showAgencyModal()) {
        <div class="fixed inset-0 z-50 bg-ink-primary/30 backdrop-blur-xs flex items-center justify-center p-4" (click)="showAgencyModal.set(false)">
          <div class="bg-surface-container-lowest rounded-3xl max-w-md w-full p-6 shadow-2xl" (click)="$event.stopPropagation()">
            <h3 class="font-headline text-base font-bold text-ink-primary mb-4">Link New Partner Agency</h3>
            <form (ngSubmit)="submitAgency()" class="space-y-3">
              <input [(ngModel)]="newAgencyName" name="agName" placeholder="Agency Name" required class="w-full h-11 px-4 rounded-xl bg-surface-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
              <input [(ngModel)]="newAgencyRole" name="agRole" placeholder="Role Badge (e.g. Paid Growth)" class="w-full h-11 px-4 rounded-xl bg-surface-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
              <input [(ngModel)]="newAgencyEmail" name="agEmail" placeholder="Contact Email" type="email" class="w-full h-11 px-4 rounded-xl bg-surface-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
              <div class="flex justify-end gap-2 pt-2">
                <button type="button" (click)="showAgencyModal.set(false)" class="px-4 py-2 rounded-full text-xs font-semibold text-ink-secondary cursor-pointer">Cancel</button>
                <button type="submit" class="px-5 py-2 rounded-full bg-primary text-white text-xs font-semibold cursor-pointer">Link Agency</button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Edit Brand Modal -->
      @if (showEditModal()) {
        <div class="fixed inset-0 z-50 bg-ink-primary/30 backdrop-blur-xs flex items-center justify-center p-4" (click)="showEditModal.set(false)">
          <div class="bg-surface-container-lowest rounded-3xl max-w-md w-full p-6 shadow-2xl" (click)="$event.stopPropagation()">
            <h3 class="font-headline text-base font-bold text-ink-primary mb-4">Edit Brand Details</h3>
            <form (ngSubmit)="saveBrandEdit()" class="space-y-3">
              <input [(ngModel)]="editName" name="editName" placeholder="Brand Name" required class="w-full h-11 px-4 rounded-xl bg-surface-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
              <input [(ngModel)]="editDomain" name="editDomain" placeholder="Domain" class="w-full h-11 px-4 rounded-xl bg-surface-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
              <textarea [(ngModel)]="editDesc" name="editDesc" rows="3" placeholder="Description" class="w-full p-3 rounded-xl bg-surface-warm text-sm focus:outline-none focus:ring-2 focus:ring-primary"></textarea>
              <div class="flex justify-end gap-2 pt-2">
                <button type="button" (click)="showEditModal.set(false)" class="px-4 py-2 rounded-full text-xs font-semibold text-ink-secondary cursor-pointer">Cancel</button>
                <button type="submit" class="px-5 py-2 rounded-full bg-primary text-white text-xs font-semibold cursor-pointer">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Delete Brand Confirmation Modal -->
      <app-confirm-modal
        [open]="showDeleteModal() && !!brand()"
        [title]="'Delete ' + (brand()?.name || 'brand') + '?'"
        message="This permanently removes the brand workspace, linked agencies, creators, and audit logs."
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
        title="Sign out of Admin Console?"
        message="You will be returned to the sign-in screen."
        confirmLabel="Sign Out"
        tone="primary"
        (confirm)="logout()"
        (cancel)="showSignOutConfirm.set(false)">
      </app-confirm-modal>
    </div>
  `
})
export class AdminBrandDetailsComponent implements OnInit {
  brandId = '';
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
  newAgencyName = '';
  newAgencyRole = 'Partner Agency';
  newAgencyEmail = '';

  showEditModal = signal(false);
  showDeleteModal = signal(false);
  showSignOutConfirm = signal(false);
  deleting = signal(false);
  editName = '';
  editDomain = '';
  editDesc = '';

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
    });
  }

  loadOverview() {
    this.api.getBrandOverview(this.brandId).subscribe(res => {
      this.brand.set(res.brand);
      this.agencies.set(res.agencies);
      this.creators.set(res.creators);
      this.recentReels.set(res.recentReels);
      this.stats.set(res.stats);
    });
  }

  loadAuditLogs() {
    this.api.listAuditLogs(this.brandId, this.auditCategory(), this.auditSearch).subscribe(res => {
      this.auditLogs.set(res.items);
      this.auditTotal.set(res.total);
    });
  }

  syncNow() {
    this.api.syncBrandDeliverables(this.brandId).subscribe(() => {
      this.loadOverview();
      if (this.activeTab() === 'audit') this.loadAuditLogs();
    });
  }

  submitAgency() {
    if (!this.newAgencyName.trim()) return;
    this.api.addAgency(this.brandId, {
      name: this.newAgencyName,
      roleBadge: this.newAgencyRole,
      contactEmail: this.newAgencyEmail
    }).subscribe(() => {
      this.showAgencyModal.set(false);
      this.newAgencyName = '';
      this.newAgencyEmail = '';
      this.loadOverview();
    });
  }

  openEditModal() {
    const b = this.brand();
    if (!b) return;
    this.editName = b.name;
    this.editDomain = b.domain || '';
    this.editDesc = b.description || '';
    this.showEditModal.set(true);
  }

  saveBrandEdit() {
    this.api.updateBrand(this.brandId, {
      name: this.editName,
      domain: this.editDomain,
      description: this.editDesc
    }).subscribe(() => {
      this.showEditModal.set(false);
      this.loadOverview();
    });
  }

  exportCsv() {
    this.api.exportBrandCsv(this.brandId).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.brand()?.slug || 'brand'}-report.csv`;
      a.click();
      URL.revokeObjectURL(url);
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
      error: () => {
        this.deleting.set(false);
        this.showDeleteModal.set(false);
      }
    });
  }

  logout() {
    this.auth.logout();
    this.router.navigateByUrl('/auth');
  }
}
