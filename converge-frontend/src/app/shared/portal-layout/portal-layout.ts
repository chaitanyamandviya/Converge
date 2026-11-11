import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PortalService } from '../../services/portal.service';
import { ConfirmService } from '../../services/confirm.service';

@Component({
  selector: 'app-portal-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="portal-root">
      <!-- Top Workspace Header -->
      <header class="app-header">
        <div class="header-left">
          <a routerLink="/dashboard" class="logo-link" title="Return to Overview">
            <img src="/assets/converge-logo.svg" alt="Converge" class="header-logo" />
          </a>
          <span class="header-divider">/</span>
          <a routerLink="/dashboard" class="workspace-pill-link" title="Workspace Overview">
            <div class="workspace-pill">
              @if (user()?.logoUrl && !logoFailed) {
                <img [src]="user()?.logoUrl" alt="" class="workspace-logo-img" (error)="logoFailed = true" />
              } @else {
                <span class="workspace-dot"></span>
              }
              <span class="workspace-name">{{ workspaceName() }}</span>
            </div>
          </a>
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
            <svg class="logout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span>Log out</span>
          </button>
        </div>
      </header>

      <!-- Portal Body -->
      <div class="portal-layout">
        <!-- Sidebar Navigation -->
        <aside class="portal-sidebar">
          <div class="sidebar-category">{{ isAgencyManager() ? 'AGENCY WORKSPACE' : (isAdmin() ? 'ADMIN CONSOLE' : 'BRAND WORKSPACE') }}</div>
          <nav class="sidebar-nav">
            <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="nav-item">
              <img src="/assets/layout-dashboard.svg" alt="" class="nav-icon" />
              <span>{{ isAdmin() ? 'Brands & Organizations' : 'Overview' }}</span>
            </a>

            <!-- Campaigns nav item visible to Brand Manager -->
            @if (!isAdmin() && !isAgencyManager()) {
              <a routerLink="/campaigns" routerLinkActive="active" class="nav-item">
                <img src="/assets/megaphone.svg" alt="" class="nav-icon" />
                <span>Campaigns</span>
              </a>
            }

            <!-- Agencies nav item visible to System Admin and Brand Manager -->
            @if (!isAgencyManager()) {
              <a routerLink="/agencies" routerLinkActive="active" class="nav-item">
                <img src="/assets/building-2.svg" alt="" class="nav-icon" />
                <span>{{ isAdmin() ? 'Agencies (Directory)' : 'Agencies' }}</span>
              </a>
            }

            <a routerLink="/creators" routerLinkActive="active" class="nav-item">
              <img src="/assets/users.svg" alt="" class="nav-icon" />
              <span>{{ isAgencyManager() ? 'My Talent Roster' : (isAdmin() ? 'Creators (Directory)' : 'Creators') }}</span>
            </a>
            <a routerLink="/content-library" routerLinkActive="active" class="nav-item">
              <img src="/assets/panels-top-left.svg" alt="" class="nav-icon" />
              <span>{{ isAdmin() ? 'Deliverables Audit' : 'Content library' }}</span>
            </a>
          </nav>

          <div class="sidebar-footer">
            <div class="sidebar-stat-chip">
              <span class="status-indicator-dot"></span>
              <span>{{ isAgencyManager() ? 'Agency active' : (activeAgenciesCount() + ' agencies active') }}</span>
            </div>
          </div>
        </aside>

        <!-- Main Dynamic Portal Content -->
        <main class="portal-main">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .portal-root {
      min-height: 100vh;
      width: 100%;
      max-width: 100vw;
      display: flex;
      flex-direction: column;
      background-color: #F5F5F7;
      color: #1D1D1F;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Plus Jakarta Sans", "Inter", sans-serif;
      overflow-x: hidden;
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .app-header {
      min-height: 52px;
      height: 52px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      position: sticky;
      top: 0;
      z-index: 50;
      width: 100%;
      box-sizing: border-box;
      gap: 12px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      flex-shrink: 1;
    }

    .logo-link {
      display: inline-flex;
      align-items: center;
      text-decoration: none;
      cursor: pointer;
    }

    .workspace-pill-link {
      display: inline-flex;
      align-items: center;
      text-decoration: none;
      color: inherit;
      cursor: pointer;
      min-width: 0;
    }

    .header-logo {
      height: 20px;
      display: block;
      flex-shrink: 0;
    }

    .header-divider {
      color: rgba(0, 0, 0, 0.2);
      font-size: 14px;
      font-weight: 300;
      flex-shrink: 0;
    }

    .workspace-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(0, 0, 0, 0.04);
      padding: 4px 10px;
      border-radius: 980px;
      font-size: 12px;
      font-weight: 500;
      color: #1D1D1F;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      border: 1px solid rgba(0, 0, 0, 0.04);
      transition: background 0.15s ease;
    }

    .workspace-pill:hover {
      background: rgba(0, 0, 0, 0.07);
    }

    .workspace-dot {
      width: 6px;
      height: 6px;
      background-color: #34C759;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .workspace-logo-img {
      width: 15px;
      height: 15px;
      border-radius: 3px;
      object-fit: contain;
      flex-shrink: 0;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    .user-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(0, 0, 0, 0.03);
      padding: 3px 10px 3px 5px;
      border-radius: 980px;
      border: 1px solid rgba(0, 0, 0, 0.04);
      max-width: 260px;
    }

    .user-avatar {
      width: 24px;
      height: 24px;
      background: #1D1D1F;
      color: #FFFFFF;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 11px;
      flex-shrink: 0;
    }

    .user-details {
      display: flex;
      flex-direction: column;
      line-height: 1.15;
      min-width: 0;
      overflow: hidden;
    }

    .user-email {
      font-size: 11px;
      font-weight: 500;
      color: #1D1D1F;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-role-badge {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #86868B;
      white-space: nowrap;
    }

    .logout-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(0, 0, 0, 0.04);
      border: 1px solid rgba(0, 0, 0, 0.06);
      color: #1D1D1F;
      font-size: 12px;
      font-weight: 500;
      min-height: 32px;
      padding: 4px 12px;
      border-radius: 980px;
      cursor: pointer;
      transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
      white-space: nowrap;
      flex-shrink: 0;
    }

    .logout-btn:hover {
      background: #FF3B30;
      border-color: #FF3B30;
      color: #FFFFFF;
    }

    .logout-btn:active {
      transform: scale(0.97);
    }

    .logout-icon {
      width: 15px;
      height: 15px;
    }

    .portal-layout {
      display: flex;
      flex: 1;
      width: 100%;
      min-width: 0;
    }

    /* macOS Sidebar */
    .portal-sidebar {
      width: 230px;
      flex-shrink: 0;
      background: #FBFBFD;
      border-right: 1px solid rgba(0, 0, 0, 0.08);
      display: flex;
      flex-direction: column;
      padding: 20px 10px;
      gap: 12px;
    }

    .sidebar-category {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: #86868B;
      text-transform: uppercase;
      padding: 0 10px;
    }

    .sidebar-nav {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 36px;
      padding: 7px 12px;
      font-size: 13px;
      font-weight: 500;
      color: #424245;
      text-decoration: none;
      border-radius: 8px;
      transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .nav-item:hover {
      background: rgba(0, 0, 0, 0.04);
      color: #1D1D1F;
    }

    .nav-item:active {
      transform: scale(0.98);
    }

    .nav-item.active {
      background: rgba(0, 0, 0, 0.08);
      color: #1D1D1F;
      font-weight: 600;
    }

    .nav-icon {
      width: 16px;
      height: 16px;
      opacity: 0.65;
      transition: opacity 0.15s ease;
    }

    .nav-item.active .nav-icon,
    .nav-item:hover .nav-icon {
      opacity: 1;
    }

    .sidebar-footer {
      margin-top: auto;
      padding: 12px 10px;
      border-top: 1px solid rgba(0, 0, 0, 0.06);
    }

    .sidebar-stat-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      font-weight: 500;
      color: #86868B;
    }

    .status-indicator-dot {
      width: 6px;
      height: 6px;
      background: #34C759;
      border-radius: 50%;
    }

    .portal-main {
      flex: 1 1 auto;
      min-width: 0;
      width: 100%;
      box-sizing: border-box;
      padding: 32px 40px;
      max-width: 1380px;
      margin: 0 auto;
      overflow-x: hidden;
      background-color: #F5F5F7;
    }

    @media (max-width: 1100px) {
      .portal-main {
        padding: 24px 20px;
      }
    }

    @media (max-width: 900px) {
      .portal-layout {
        flex-direction: column;
      }
      .portal-sidebar {
        width: 100%;
        border-right: none;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        padding: 14px 16px;
        gap: 10px;
      }
      .sidebar-nav {
        flex-direction: row;
        flex-wrap: wrap;
        gap: 6px;
      }
      .nav-item {
        min-height: 38px;
        padding: 8px 12px;
        font-size: 12px;
      }
      .sidebar-footer {
        display: none;
      }
      .portal-main {
        padding: 18px 14px;
      }
    }

    @media (max-width: 640px) {
      .app-header {
        padding: 0 14px;
      }
      .user-details {
        display: none;
      }
      .user-chip {
        padding: 4px;
      }
      .logout-btn {
        padding: 6px 12px;
        font-size: 12px;
        min-height: 34px;
      }
      .workspace-pill {
        display: none;
      }
      .header-divider {
        display: none;
      }
      .portal-main {
        padding: 14px 10px;
      }
    }
  `]
})
export class PortalLayoutComponent {
  private auth = inject(AuthService);
  private portal = inject(PortalService);
  private confirmService = inject(ConfirmService);
  private router = inject(Router);

  user = this.auth.currentUser;
  logoFailed = false;

  activeAgenciesCount = computed(() =>
    this.portal.agencies().filter(a => a.status === 'ACTIVE').length
  );

  isAdmin = computed(() => this.user()?.role === 'SYSTEM_ADMIN');
  isAgencyManager = computed(() => this.user()?.role === 'AGENCY_MANAGER');
  isBrandManager = computed(() => this.user()?.role === 'BRAND_MANAGER');

  workspaceName = computed(() => {
    const org = this.user()?.organizationName;
    if (org && org.trim()) {
      return org.trim();
    }
    if (this.isAgencyManager()) {
      return 'Agency Workspace';
    }
    if (this.isAdmin()) {
      return 'Converge System Admin';
    }
    return 'Brand Workspace';
  });

  workspaceSubtitle = computed(() => {
    if (this.isAdmin()) {
      return 'Brand & Agency Governance';
    }
    if (this.isAgencyManager()) {
      return 'Creator Roster & Deliverables';
    }
    return 'Multi-Agency Campaign Hub';
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
