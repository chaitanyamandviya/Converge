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
      <!-- Notion-style Top Header / Breadcrumbs -->
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
            <span>Log out</span>
          </button>
        </div>
      </header>

      <!-- Portal Body: Slim Notion Sidebar + Main Canvas -->
      <div class="portal-layout">
        <!-- Notion Slim Sidebar -->
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
              <span>{{ isAdmin() ? 'Brands & Organizations' : 'Overview' }}</span>
            </a>

            @if (!isAdmin() && !isAgencyManager()) {
              <a routerLink="/campaigns" routerLinkActive="active" class="nav-item">
                <span class="nav-emoji">📢</span>
                <span>Campaigns</span>
              </a>
            }

            @if (!isAgencyManager()) {
              <a routerLink="/agencies" routerLinkActive="active" class="nav-item">
                <span class="nav-emoji">🤝</span>
                <span>{{ isAdmin() ? 'Agencies (Directory)' : 'Agencies' }}</span>
              </a>
            }

            <a routerLink="/creators" routerLinkActive="active" class="nav-item">
              <span class="nav-emoji">✨</span>
              <span>{{ isAgencyManager() ? 'My Talent Roster' : (isAdmin() ? 'Creators (Directory)' : 'Creators') }}</span>
            </a>
          </nav>

          <div class="sidebar-category" style="margin-top: 14px;">ADMIN &amp; AUDIT</div>
          <nav class="sidebar-nav">
            <a routerLink="/content-library" routerLinkActive="active" class="nav-item">
              <span class="nav-emoji">📊</span>
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

        <!-- Main Notion Canvas -->
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
      background-color: #FFFFFF;
      color: #37352F;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", sans-serif;
      overflow-x: hidden;
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
    }

    /* Notion Minimalist Header */
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
    }

    .workspace-dot {
      width: 6px;
      height: 6px;
      background-color: #10B981;
      border-radius: 50%;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 12px;
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

    /* Notion Slim Sidebar */
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

    /* Notion Canvas */
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
      }
      .sidebar-nav {
        flex-direction: row;
        flex-wrap: wrap;
      }
      .sidebar-footer {
        display: none;
      }
      .portal-main {
        padding: 20px 16px;
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
