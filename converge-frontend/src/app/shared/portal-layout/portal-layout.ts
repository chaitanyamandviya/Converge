import { Component, inject, computed, signal, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PortalService } from '../../services/portal.service';
import { ConfirmService } from '../../services/confirm.service';

@Component({
  selector: 'app-portal-layout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    @if (isAdmin()) {
      <!-- Converge Superadmin Mesh (Stitch Carbon Copy) -->
      <div class="min-h-screen bg-[#f8f6f2] text-[#111827] flex flex-col lg:flex-row font-sans antialiased">
        <!-- Mobile Sidebar Backdrop -->
        @if (mobileSidebarOpen()) {
          <div
            class="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 lg:hidden"
            (click)="mobileSidebarOpen.set(false)">
          </div>
        }

        <!-- Left White Sidebar -->
        <aside
          [class]="
            'fixed inset-y-0 left-0 z-50 lg:sticky lg:top-0 lg:h-screen bg-white border-r border-[#e6e2da] flex flex-col transition-all duration-300 ease-in-out shrink-0 ' +
            (mobileSidebarOpen() ? 'translate-x-0 ' : '-translate-x-full lg:translate-x-0 ') +
            (sidebarCollapsed() ? 'lg:w-20 w-64' : 'w-64')
          ">
          <!-- Brand Header -->
          <div class="h-16 px-4 flex items-center justify-between border-b border-[#f0ede8] shrink-0">
            <a routerLink="/dashboard" (click)="navigateAdminTab('overview')" class="flex items-center gap-2.5 min-w-0">
              <div class="w-8 h-8 rounded-full bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-center shrink-0 overflow-hidden">
                <img src="/assets/converge-logo.png" alt="Converge" class="w-5 h-5 object-contain" />
              </div>
              @if (!sidebarCollapsed()) {
                <div class="min-w-0">
                  <div class="font-display font-bold text-[15px] tracking-tight text-[#0f172a] leading-none">Converge</div>
                  <div class="text-[11px] font-medium text-[#64748b] mt-1 truncate">Superadmin Mesh</div>
                </div>
              }
            </a>

            <!-- Desktop Collapse Toggle -->
            <button
              type="button"
              (click)="sidebarCollapsed.set(!sidebarCollapsed())"
              class="hidden lg:inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition-colors"
              [title]="sidebarCollapsed() ? 'Expand sidebar' : 'Collapse sidebar'">
              <span class="material-symbols-outlined text-[18px]">
                {{ sidebarCollapsed() ? 'left_panel_open' : 'menu_open' }}
              </span>
            </button>

            <!-- Mobile Close Button -->
            <button
              type="button"
              (click)="mobileSidebarOpen.set(false)"
              class="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9]">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <!-- Primary Navigation -->
          <div class="flex-1 overflow-y-auto px-3 py-5">
            @if (!sidebarCollapsed()) {
              <div class="px-3 mb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
                ECOSYSTEM WORKSPACE
              </div>
            }
            <nav class="space-y-1">
              <!-- Overview -->
              <a
                routerLink="/dashboard"
                (click)="navigateAdminTab('overview')"
                [class]="adminNavClass(isOverviewRoute())"
                [title]="sidebarCollapsed() ? 'Overview' : ''">
                <span class="material-symbols-outlined text-[19px] shrink-0">grid_view</span>
                @if (!sidebarCollapsed()) {
                  <span class="truncate flex-1">Overview</span>
                  <span [class]="adminBadgeClass(isOverviewRoute())">All-in-One</span>
                }
              </a>

              <!-- Brands -->
              <a
                routerLink="/dashboard"
                [queryParams]="{ tab: 'brands' }"
                (click)="navigateAdminTab('brands')"
                [class]="adminNavClass(isBrandsRoute())"
                [title]="sidebarCollapsed() ? 'Brands' : ''">
                <span class="material-symbols-outlined text-[19px] shrink-0">verified</span>
                @if (!sidebarCollapsed()) {
                  <span class="truncate flex-1">Brands</span>
                  <span [class]="adminBadgeClass(isBrandsRoute())">{{ brandsCount() }}</span>
                }
              </a>

              <!-- Agencies -->
              <a
                routerLink="/agencies"
                routerLinkActive="bg-[#eef4ff] !text-[#2563eb] font-semibold border border-[#dbeafe]"
                (click)="mobileSidebarOpen.set(false)"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium text-[#475569] hover:bg-[#f8fafc] hover:text-[#0f172a] transition-all border border-transparent"
                [title]="sidebarCollapsed() ? 'Agencies' : ''">
                <span class="material-symbols-outlined text-[19px] shrink-0">corporate_fare</span>
                @if (!sidebarCollapsed()) {
                  <span class="truncate flex-1">Agencies</span>
                  <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f1f5f9] text-[#475569]">
                    {{ agenciesCount() }}
                  </span>
                }
              </a>

              <!-- Creators -->
              <a
                routerLink="/creators"
                routerLinkActive="bg-[#eef4ff] !text-[#2563eb] font-semibold border border-[#dbeafe]"
                (click)="mobileSidebarOpen.set(false)"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium text-[#475569] hover:bg-[#f8fafc] hover:text-[#0f172a] transition-all border border-transparent"
                [title]="sidebarCollapsed() ? 'Creators' : ''">
                <span class="material-symbols-outlined text-[19px] shrink-0">groups</span>
                @if (!sidebarCollapsed()) {
                  <span class="truncate flex-1">Creators</span>
                  <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f1f5f9] text-[#475569]">
                    {{ creatorsCount() }}
                  </span>
                }
              </a>
            </nav>
          </div>

          <!-- Sidebar Footer: Platform Settings + Admin Session Card -->
          <div class="p-3 border-t border-[#f0ede8] space-y-2 shrink-0">
            <a
              routerLink="/dashboard"
              [queryParams]="{ tab: 'settings' }"
              (click)="navigateAdminTab('settings')"
              [class]="adminNavClass(isSettingsRoute())"
              [title]="sidebarCollapsed() ? 'Platform Settings' : ''">
              <span class="material-symbols-outlined text-[19px] shrink-0">settings</span>
              @if (!sidebarCollapsed()) {
                <span class="truncate flex-1">Platform Settings</span>
              }
            </a>

            <div class="flex items-center justify-between gap-2 px-2.5 py-2.5 rounded-2xl bg-[#f8fafc] border border-[#e2e8f0]">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-full bg-[#2563eb] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  SA
                </div>
                @if (!sidebarCollapsed()) {
                  <div class="min-w-0">
                    <div class="text-xs font-semibold text-[#0f172a] truncate">System Admin</div>
                    <div class="flex items-center gap-1 text-[10.5px] font-medium text-[#10b981]">
                      <span class="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span>
                      <span>Active Session</span>
                    </div>
                  </div>
                }
              </div>
              <button
                type="button"
                (click)="logout()"
                class="w-7 h-7 rounded-lg inline-flex items-center justify-center text-[#64748b] hover:text-[#dc2626] hover:bg-red-50 transition-colors shrink-0"
                title="Sign out">
                <span class="material-symbols-outlined text-[17px]">shield</span>
              </button>
            </div>
          </div>
        </aside>

        <!-- Main Column -->
        <div class="flex-1 flex flex-col min-w-0">
          <!-- Top Sticky Header -->
          <header class="h-16 px-4 sm:px-6 lg:px-8 bg-white border-b border-[#e6e2da] flex items-center justify-between gap-3 sticky top-0 z-30">
            <div class="flex items-center gap-3 min-w-0">
              <button
                type="button"
                (click)="mobileSidebarOpen.set(true)"
                class="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-xl border border-[#e2e8f0] bg-white text-[#0f172a] hover:bg-[#f8fafc]">
                <span class="material-symbols-outlined text-[20px]">menu</span>
              </button>

              <h2 class="text-sm sm:text-[15px] font-semibold text-[#0f172a] truncate">
                {{ adminPageTitle() }}
              </h2>
            </div>

            <div class="flex items-center gap-2.5 sm:gap-3">
              <!-- Global Omnibar Search -->
              <div class="relative hidden sm:flex items-center">
                <span class="material-symbols-outlined text-[17px] text-[#94a3b8] absolute left-3.5 pointer-events-none">search</span>
                <input
                  #adminSearchInput
                  type="text"
                  [ngModel]="portal.adminSearchQuery()"
                  (ngModelChange)="onGlobalSearch($event)"
                  placeholder="Search brands, agencies, creators..."
                  class="w-56 md:w-72 pl-10 pr-12 py-2 text-xs bg-[#f5f3ef] border border-[#e6e2da] rounded-full text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb] transition-all" />
                <kbd class="absolute right-3 px-1.5 py-0.5 text-[10px] font-mono bg-white text-[#64748b] rounded border border-[#e2e8f0]">
                  ⌘K
                </kbd>
              </div>

              <!-- Notifications Popover -->
              <div class="relative">
                <button
                  type="button"
                  (click)="notificationsOpen.set(!notificationsOpen())"
                  class="relative w-9 h-9 rounded-full bg-white border border-[#e2e8f0] flex items-center justify-center text-[#475569] hover:text-[#0f172a] hover:bg-[#f8fafc] transition-colors"
                  title="Notifications">
                  <span class="material-symbols-outlined text-[19px]">notifications</span>
                  @if (pendingApprovalsCount() > 0) {
                    <span class="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-[#ef4444]"></span>
                  }
                </button>

                @if (notificationsOpen()) {
                  <div class="fixed inset-0 z-30" (click)="notificationsOpen.set(false)"></div>
                  <div class="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl border border-[#e2e8f0] shadow-xl p-4 z-40">
                    <div class="flex items-center justify-between mb-3">
                      <span class="text-xs font-bold uppercase tracking-wider text-[#0f172a]">Governance Alerts</span>
                      <span class="text-[11px] font-mono text-[#64748b]">{{ pendingApprovalsCount() }} pending</span>
                    </div>
                    @if (pendingApprovalsCount() === 0) {
                      <div class="py-4 text-center text-xs text-[#64748b]">
                        All caught up — no pending brand or agency approvals.
                      </div>
                    } @else {
                      <div class="space-y-2 text-xs">
                        @if (pendingBrandsCount() > 0) {
                          <a
                            routerLink="/dashboard"
                            [queryParams]="{ tab: 'brands' }"
                            (click)="notificationsOpen.set(false)"
                            class="block p-2.5 rounded-xl bg-amber-50 border border-amber-200/70 text-amber-900 hover:bg-amber-100/70 transition-colors">
                            <span class="font-semibold">{{ pendingBrandsCount() }} Brand(s)</span> awaiting approval
                          </a>
                        }
                        @if (pendingAgenciesCount() > 0) {
                          <a
                            routerLink="/agencies"
                            (click)="notificationsOpen.set(false)"
                            class="block p-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-[#0f172a] hover:bg-[#f1f5f9] transition-colors">
                            <span class="font-semibold">{{ pendingAgenciesCount() }} Agency(s)</span> pending review
                          </a>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          </header>

          <!-- Main Content Outlet -->
          <main class="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-7">
            <router-outlet></router-outlet>
          </main>
        </div>
      </div>
    } @else {
      <!-- Existing Brand / Agency Manager Notion-style Shell -->
      <div class="portal-root">
        <header class="app-header">
          <div class="header-left">
            <a routerLink="/dashboard" class="logo-link" title="Return to Overview">
              <img src="/assets/converge-logo.svg" alt="Converge" class="header-logo" />
            </a>
            <span class="header-divider">/</span>
            <div class="breadcrumb-chip">
              <span class="workspace-dot"></span>
              <span class="workspace-name">{{ workspaceName() }}</span>
            </div>
          </div>

          <div class="header-right">
            <div class="user-chip">
              <span class="user-avatar">{{ (user()?.email || 'U')[0].toUpperCase() }}</span>
              <div class="user-details">
                <span class="user-email">{{ user()?.email }}</span>
                <span class="user-role-badge">{{ roleDisplay() }}</span>
              </div>
            </div>
            <button type="button" class="logout-btn" (click)="logout()" title="Sign out of workspace">
              <svg class="logout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span class="logout-label">Log out</span>
            </button>
          </div>
        </header>

        <div class="portal-layout">
          <aside class="portal-sidebar">
            <div class="sidebar-ws-card">
              <div class="ws-identity">
                <span class="ws-badge-icon">📋</span>
                <span class="ws-title-text">{{ workspaceName() }}</span>
              </div>
            </div>

            <div class="sidebar-category">WORKSPACE</div>
            <nav class="sidebar-nav">
              <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="nav-item">
                <span class="nav-emoji">🏢</span>
                <span>Overview</span>
              </a>

              @if (!isAgencyManager()) {
                <a routerLink="/campaigns" routerLinkActive="active" class="nav-item">
                  <span class="nav-emoji">📢</span>
                  <span>Campaigns</span>
                </a>
                <a routerLink="/agencies" routerLinkActive="active" class="nav-item">
                  <span class="nav-emoji">🤝</span>
                  <span>Agencies</span>
                </a>
              }

              <a routerLink="/creators" routerLinkActive="active" class="nav-item">
                <span class="nav-emoji">✨</span>
                <span>{{ isAgencyManager() ? 'My Talent Roster' : 'Creators' }}</span>
              </a>
            </nav>

            <div class="sidebar-category" style="margin-top: 14px;">ADMIN &amp; AUDIT</div>
            <nav class="sidebar-nav">
              <a routerLink="/content-library" routerLinkActive="active" class="nav-item">
                <span class="nav-emoji">📊</span>
                <span>Content library</span>
              </a>
            </nav>

            <div class="sidebar-footer">
              <div class="sidebar-stat-chip">
                <span class="status-indicator-dot"></span>
                <span>{{ isAgencyManager() ? 'Agency active' : (activeAgenciesCount() + ' agencies active') }}</span>
              </div>
            </div>
          </aside>

          <main class="portal-main">
            <router-outlet></router-outlet>
          </main>
        </div>
      </div>
    }
  `,
  styles: [`
    .portal-root {
      min-height: 100vh;
      width: 100%;
      max-width: 100vw;
      display: flex;
      flex-direction: column;
      background-color: #FFFFFF;
      color: #37352F;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", sans-serif;
      overflow-x: hidden;
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
    }

    .app-header {
      height: 48px;
      min-height: 48px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      background: #FFFFFF;
      border-bottom: 1px solid #EDEDED;
      position: sticky;
      top: 0;
      z-index: 50;
      width: 100%;
      box-sizing: border-box;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .header-logo {
      height: 20px;
      display: block;
    }

    .header-divider {
      color: #D3D1CB;
      font-size: 13px;
    }

    .breadcrumb-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 500;
      color: #787774;
      min-width: 0;
    }

    .workspace-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .workspace-dot {
      width: 6px;
      height: 6px;
      background-color: #10B981;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }

    .user-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #F7F6F3;
      padding: 3px 10px 3px 6px;
      border-radius: 4px;
      border: 1px solid #EDEDED;
    }

    .user-avatar {
      width: 22px;
      height: 22px;
      background: #37352F;
      color: #FFFFFF;
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 11px;
    }

    .user-details {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
    }

    .user-email {
      font-size: 12px;
      font-weight: 500;
      color: #37352F;
    }

    .user-role-badge {
      font-size: 10px;
      color: #787774;
    }

    .logout-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: transparent;
      border: 1px solid #EDEDED;
      color: #787774;
      font-size: 12px;
      font-weight: 500;
      height: 28px;
      padding: 0 10px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .logout-btn:hover {
      background: #FDEBEC;
      border-color: #F8D7DA;
      color: #D44C47;
    }

    .logout-icon {
      width: 14px;
      height: 14px;
    }

    .portal-layout {
      display: flex;
      flex: 1;
      width: 100%;
    }

    .portal-sidebar {
      width: 240px;
      flex-shrink: 0;
      background: #F7F6F3;
      border-right: 1px solid #EDEDED;
      display: flex;
      flex-direction: column;
      padding: 16px 12px;
      gap: 4px;
    }

    .sidebar-ws-card {
      padding: 6px 8px;
      border-radius: 4px;
      background: transparent;
      margin-bottom: 12px;
    }

    .ws-identity {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13.5px;
      font-weight: 600;
      color: #37352F;
    }

    .ws-badge-icon {
      font-size: 16px;
    }

    .sidebar-category {
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: #9B9A97;
      text-transform: uppercase;
      padding: 4px 8px;
    }

    .sidebar-nav {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      font-size: 13px;
      font-weight: 500;
      color: #37352F;
      text-decoration: none;
      border-radius: 4px;
      transition: background 0.1s ease;
    }

    .nav-item:hover {
      background: #EFEFED;
    }

    .nav-item.active {
      background: #EFEFED;
      font-weight: 600;
    }

    .nav-emoji {
      font-size: 14px;
    }

    .sidebar-footer {
      margin-top: auto;
      padding: 12px 8px;
      border-top: 1px solid #EDEDED;
    }

    .sidebar-stat-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11.5px;
      color: #787774;
    }

    .status-indicator-dot {
      width: 6px;
      height: 6px;
      background: #10B981;
      border-radius: 50%;
    }

    .portal-main {
      flex: 1 1 auto;
      width: 100%;
      min-width: 0;
      background-color: #FFFFFF;
      padding: 32px 40px;
      max-width: 1280px;
      margin: 0 auto;
    }

    @media (max-width: 900px) {
      .portal-layout {
        flex-direction: column;
      }
      .portal-sidebar {
        width: 100%;
        border-right: none;
        border-bottom: 1px solid #EDEDED;
        padding: 12px;
      }
      .sidebar-ws-card, .sidebar-category {
        display: none;
      }
      .sidebar-nav {
        flex-direction: row;
        flex-wrap: wrap;
        gap: 6px;
      }
      .sidebar-footer {
        display: none;
      }
      .portal-main {
        padding: 20px 16px;
      }
    }

    @media (max-width: 640px) {
      .app-header {
        padding: 0 12px;
      }
      .user-details, .logout-label {
        display: none;
      }
      .user-chip {
        padding: 3px;
      }
    }
  `]
})
export class PortalLayoutComponent {
  private auth = inject(AuthService);
  public portal = inject(PortalService);
  private confirmService = inject(ConfirmService);
  private router = inject(Router);

  @ViewChild('adminSearchInput') adminSearchInput?: ElementRef<HTMLInputElement>;

  user = this.auth.currentUser;
  mobileSidebarOpen = signal(false);
  sidebarCollapsed = signal(false);
  notificationsOpen = signal(false);

  brandsCount = computed(() => this.portal.brands().length);
  agenciesCount = computed(() => this.portal.agencies().length);
  creatorsCount = computed(() => this.portal.overview().totalCreators || this.portal.creators().length);
  activeAgenciesCount = computed(() =>
    this.portal.agencies().filter(a => a.status === 'ACTIVE').length
  );
  pendingBrandsCount = computed(() =>
    this.portal.brands().filter(b => b.status === 'PENDING_APPROVAL').length
  );
  pendingAgenciesCount = computed(() =>
    this.portal.agencies().filter(a => a.status === 'PENDING_APPROVAL').length
  );
  pendingApprovalsCount = computed(() => this.pendingBrandsCount() + this.pendingAgenciesCount());

  isAdmin = computed(() => this.user()?.role === 'SYSTEM_ADMIN');
  isAgencyManager = computed(() => this.user()?.role === 'AGENCY_MANAGER');
  isBrandManager = computed(() => this.user()?.role === 'BRAND_MANAGER');

  isOverviewRoute(): boolean {
    const url = this.router.url;
    return (url === '/dashboard' || url.startsWith('/dashboard?')) && !url.includes('tab=brands') && !url.includes('tab=settings');
  }

  isBrandsRoute(): boolean {
    return this.router.url.includes('tab=brands');
  }

  isSettingsRoute(): boolean {
    return this.router.url.includes('tab=settings');
  }

  adminPageTitle(): string {
    const url = this.router.url;
    if (url.includes('tab=brands')) return 'Brands Directory';
    if (url.includes('tab=settings')) return 'Platform Settings';
    if (url.startsWith('/agencies')) return 'Ecosystem Agencies';
    if (url.startsWith('/creators')) return 'Verified Creators';
    if (url.startsWith('/content-library')) return 'Deliverables Audit';
    return 'System Overview';
  }

  adminNavClass(active: boolean): string {
    const base = 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] transition-all border ';
    return active
      ? base + 'bg-[#eef4ff] text-[#2563eb] font-semibold border-[#dbeafe]'
      : base + 'text-[#475569] font-medium border-transparent hover:bg-[#f8fafc] hover:text-[#0f172a]';
  }

  adminBadgeClass(active: boolean): string {
    const base = 'text-[11px] font-semibold px-2 py-0.5 rounded-full ';
    return active
      ? base + 'bg-[#dbeafe] text-[#1d4ed8]'
      : base + 'bg-[#f1f5f9] text-[#475569]';
  }

  navigateAdminTab(tab: 'overview' | 'brands' | 'settings'): void {
    this.mobileSidebarOpen.set(false);
    this.router.navigate(['/dashboard'], {
      queryParams: tab === 'overview' ? {} : { tab }
    });
  }

  onGlobalSearch(query: string): void {
    this.portal.adminSearchQuery.set(query);
    if (query.trim() && !this.router.url.includes('tab=brands') && !this.router.url.startsWith('/agencies') && !this.router.url.startsWith('/creators')) {
      this.router.navigate(['/dashboard'], { queryParams: { tab: 'brands' } });
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      if (this.isAdmin() && this.adminSearchInput?.nativeElement) {
        event.preventDefault();
        this.adminSearchInput.nativeElement.focus();
      }
    }
  }

  workspaceName = computed(() => {
    const org = this.user()?.organizationName;
    if (org && org.trim()) {
      return org.trim();
    }
    if (this.isAgencyManager()) {
      return 'Agency Workspace';
    }
    if (this.isAdmin()) {
      return 'Converge Master Console';
    }
    return 'Brand Workspace';
  });

  roleDisplay = computed(() => {
    switch (this.user()?.role) {
      case 'SYSTEM_ADMIN': return 'System Admin';
      case 'AGENCY_MANAGER': return 'Agency Manager';
      case 'BRAND_MANAGER': return 'Brand Manager';
      default: return 'User';
    }
  });

  async logout() {
    const confirmed = await this.confirmService.confirm({
      title: 'Sign Out of Workspace?',
      message: 'Are you sure you want to log out of your active Converge session?',
      detail: this.user()?.email ? `Account: ${this.user()?.email} (${this.roleDisplay()})` : undefined,
      confirmText: 'Log Out',
      cancelText: 'Stay Signed In',
      variant: 'danger'
    });
    if (!confirmed) return;
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
