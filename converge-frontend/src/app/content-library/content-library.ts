import { Component, inject, OnInit, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PortalService, ContentItem, Creator } from '../services/portal.service';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { ConfirmService } from '../services/confirm.service';
import { CustomSelectComponent, SelectOption } from '../shared/custom-select/custom-select.component';

@Component({
  selector: 'app-content-library',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomSelectComponent],
  template: `
    <div class="content-library-view">
      <!-- Page Header -->
      <header class="page-header">
        <div class="header-text">
          <h1 class="page-title">Content Library</h1>
          <p class="page-subtitle">Track deliveries, insight status, final submission prices, and engagement metrics for all campaign posts.</p>
        </div>
        @if (!isAdmin()) {
          <button class="add-btn" (click)="openNewModal()">
            <img src="/assets/plus.svg" alt="" class="btn-icon" />
            <span>Add content URL</span>
          </button>
        }
      </header>

      <!-- macOS Liquid Segmented Control Toolbar (Soft, Rounded, Zero Boxy Cards) -->
      <div class="macos-segmented-bar">
        <button 
          type="button" 
          class="macos-segment" 
          [class.active]="selectedStatus() === 'ALL'" 
          (click)="filterByStatus('ALL')"
        >
          <span class="seg-title">All Deliverables</span>
          <span class="seg-badge">{{ totalCount() }}</span>
        </button>

        <button 
          type="button" 
          class="macos-segment" 
          [class.active]="selectedStatus() === 'WITH_INSIGHTS'" 
          (click)="filterByStatus('WITH_INSIGHTS')"
        >
          <span class="seg-title">With Live Insights</span>
          <span class="seg-badge positive">{{ withInsightsCount() }}</span>
        </button>

        <button 
          type="button" 
          class="macos-segment" 
          [class.active]="selectedStatus() === 'MISSING_URL'" 
          (click)="filterByStatus('MISSING_URL')"
        >
          <span class="seg-title">Missing URLs</span>
          <span class="seg-badge warning">{{ missingUrlCount() }}</span>
        </button>

        <button 
          type="button" 
          class="macos-segment" 
          [class.active]="selectedStatus() === 'AWAITING_INSIGHTS'" 
          (click)="filterByStatus('AWAITING_INSIGHTS')"
        >
          <span class="seg-title">Awaiting Sync</span>
          <span class="seg-badge info">{{ awaitingCount() }}</span>
        </button>
      </div>

      <!-- Content Items Table -->
      <section class="table-container">

        @if (filteredItems().length === 0) {
          <div class="macos-empty-state">
            <div class="macos-empty-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
              </svg>
            </div>
            <h3 class="macos-empty-title">No Deliverables Recorded</h3>
            <p class="macos-empty-text">Add published post or reel URLs to verify insights via Meta Graph API v26.0.</p>
            <button type="button" class="macos-empty-cta" (click)="openModal = true">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>Add Content URL</span>
            </button>
          </div>
        } @else {
          <div class="table-scroll">
            <table class="content-table">
              <thead>
                <tr>
                  <th>CONTENT TITLE / CREATOR</th>
                  <th>FORMAT</th>
                  <th>VIEWS</th>
                  <th>LIKES</th>
                  <th>COMMENTS</th>
                  <th>FINAL PRICE</th>
                  <th>STATUS</th>
                  <th class="th-actions">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                @for (item of filteredItems(); track item.id ?? (item.title + item.creatorHandle); let idx = $index) {
                  <tr>
                    <td class="content-title-cell">
                      <div class="title-with-thumb">
                        @if (item.thumbnailUrl) {
                          <div class="table-thumb-wrap">
                            <img [src]="item.thumbnailUrl" class="table-thumb" alt="" />
                          </div>
                        }
                        <div class="title-text-group">
                          <div class="title-text">{{ item.title }}</div>
                          <div class="creator-sub">{{ item.creatorHandle }}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span class="format-pill">{{ item.format }}</span>
                    </td>
                    <td><strong class="number-data">{{ item.views > 0 ? (item.views | number) : '—' }}</strong></td>
                    <td><strong class="number-data">{{ item.likes > 0 ? (item.likes | number) : '—' }}</strong></td>
                    <td><strong class="number-data">{{ item.comments > 0 ? (item.comments | number) : '—' }}</strong></td>
                    <td>
                      <strong class="price-data">₹{{ formatInr(item.finalPrice) }}</strong>
                    </td>
                    <td>
                      @if (item.status === 'WITH_INSIGHTS') {
                        <span class="badge badge-success">WITH INSIGHTS</span>
                      } @else if (item.status === 'MISSING_URL') {
                        <span class="badge badge-warning">MISSING URL</span>
                      } @else {
                        <span class="badge badge-info">AWAITING INSIGHTS</span>
                      }
                    </td>
                    <td class="td-actions">
                      <div class="action-dropdown-container">
                        <button
                          type="button"
                          class="btn-action-trigger"
                          (click)="toggleActionMenu(item.id, $event)"
                          title="Actions menu"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="2"/>
                            <circle cx="12" cy="12" r="2"/>
                            <circle cx="12" cy="19" r="2"/>
                          </svg>
                          <span>Actions</span>
                          <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor" style="opacity: 0.7;"><path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/></svg>
                        </button>
                        @if (openMenuId() === item.id) {
                          <div
                            class="action-dropdown-menu"
                            [class.drop-up]="idx >= filteredItems().length - 1 && filteredItems().length > 2"
                            (click)="$event.stopPropagation()"
                          >
                            @if (item.contentUrl) {
                              <a [href]="item.contentUrl" target="_blank" rel="noopener noreferrer" class="dropdown-item" (click)="closeMenu()">
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="2"/></svg>
                                <span>Open URL ↗</span>
                              </a>
                            }
                            @if (!isAdmin()) {
                              <button type="button" class="dropdown-item" (click)="openEditModal(item); closeMenu()">
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M11.333 2a1.886 1.886 0 0 1 2.667 2.667L4.667 14 2 14.667l.667-2.667L11.333 2Z"/></svg>
                                <span>Edit Deliverable</span>
                              </button>
                              <div class="dropdown-divider"></div>
                              <button type="button" class="dropdown-item danger" (click)="deleteItem(item); closeMenu()">
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2.5 4h11"/><path d="M5.5 4V2.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V4"/><path d="M4 4l.7 9.5a1.5 1.5 0 0 0 1.5 1.5h3.6a1.5 1.5 0 0 0 1.5-1.5L12 4"/></svg>
                                <span>Delete Deliverable</span>
                              </button>
                            }
                          </div>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <!-- Add / Edit Content Dialog -->
      @if (openModal) {
        <div class="modal-backdrop" (click)="closeModal()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-head">
              <h3>{{ editingItemId() ? 'Edit Content Deliverable' : 'Add Campaign Content Post' }}</h3>
              <button class="close-btn" (click)="closeModal()">✕</button>
            </div>
            <form (ngSubmit)="submitContent()">
              <div class="form-group">
                <label>Content Title *</label>
                <input type="text" [(ngModel)]="newTitle" name="title" required placeholder="e.g. Unboxing autumn tones reel" class="form-input" />
              </div>
              <div class="form-group">
                <label>Creator Handle *</label>
                <div class="handle-lookup-row">
                  <input
                    type="text"
                    [(ngModel)]="newCreatorHandle"
                    name="creatorHandle"
                    required
                    placeholder="@creator.handle (e.g. @virat.kohli)"
                    class="form-input handle-input"
                    (blur)="onHandleBlur()"
                  />
                  <button
                    type="button"
                    class="btn-fetch-handle"
                    [disabled]="isFetchingCreator() || !newCreatorHandle.trim()"
                    (click)="fetchCreatorDetails()"
                  >
                    @if (isFetchingCreator()) {
                      <span class="mini-spinner"></span>
                      <span>Fetching...</span>
                    } @else {
                      <span>Fetch Details</span>
                    }
                  </button>
                </div>
                @if (fetchedCreator(); as creator) {
                  <div class="creator-preview-card">
                    @if (creator.avatarUrl) {
                      <img [src]="creator.avatarUrl" [alt]="creator.name" class="creator-preview-avatar-img" />
                    } @else {
                      <div class="creator-preview-avatar">{{ creator.avatarInitials || 'CR' }}</div>
                    }
                    <div class="creator-preview-info">
                      <div class="creator-preview-top">
                        <strong>{{ creator.name }}</strong>
                        <span class="creator-preview-handle">{{ creator.handle }}</span>
                        <span class="creator-preview-badge" [class.new-badge]="!creator.id">
                          {{ creator.id ? 'In Roster' : 'Auto-Insert to System' }}
                        </span>
                      </div>
                      <div class="creator-preview-meta">
                        {{ creator.category || 'Creator (Professional Account)' }}
                        @if (creator.profileUrl) {
                          · <a [href]="creator.profileUrl" target="_blank" rel="noopener">Profile ↗</a>
                        }
                      </div>
                    </div>
                  </div>
                }
              </div>
              <div class="form-group">
                <label>Assign to Campaign</label>
                <app-custom-select
                  [options]="campaignSelectOptions()"
                  [(ngModel)]="newCampaignId"
                  name="campaignId"
                  placeholder="Select Campaign"
                ></app-custom-select>
              </div>
              <div class="form-group">
                <label>Content URL *</label>
                <input type="url" [(ngModel)]="newUrl" name="contentUrl" placeholder="https://www.instagram.com/reel/..." class="form-input" />
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label>Platform / Format</label>
                  <app-custom-select
                    [options]="formatOptions"
                    [(ngModel)]="newFormat"
                    name="format"
                    placeholder="Select Format"
                  ></app-custom-select>
                </div>
                @if (isFetchedCreatorPackage()) {
                  <div class="form-group package-notice-group-cl">
                    <label>Deliverable Rate</label>
                    <div class="package-calc-badge-cl">
                      <div class="pkg-badge-icon-cl">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                      </div>
                      <div class="pkg-badge-text-cl">
                        <strong>Package Retainer (₹{{ (fetchedCreator()?.price || 0) | number }})</strong>
                        <span>Auto-divided across total deliverables</span>
                      </div>
                    </div>
                  </div>
                } @else {
                  <div class="form-group">
                    <div class="label-with-range-info-cl">
                      <label>Final Submission Price (₹)</label>
                      @if (fetchedCreator()?.minPrice || fetchedCreator()?.maxPrice) {
                        <span class="range-badge-pill-cl">
                          Range: ₹{{ (fetchedCreator()?.minPrice || 0) | number }} – {{ fetchedCreator()?.maxPrice ? ('₹' + ((fetchedCreator()?.maxPrice || 0) | number)) : '∞' }}
                        </span>
                      }
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      [(ngModel)]="newFinalPrice"
                      name="finalPrice"
                      placeholder="e.g. 50000"
                      class="form-input"
                      [class.input-range-invalid-cl]="isPriceOutOfRange()"
                    />
                    @if (isPriceOutOfRange()) {
                      <span class="range-error-text-cl">
                        ⚠️ Rate must be within allowed range: ₹{{ (fetchedCreator()?.minPrice || 0) | number }} – ₹{{ (fetchedCreator()?.maxPrice || 0) | number }}
                      </span>
                    }
                  </div>
                }
              </div>

              <div class="modal-actions">
                <button type="button" class="btn-cancel" [disabled]="isSubmitting" (click)="closeModal()">Cancel</button>
                <button type="submit" class="btn-submit" [disabled]="isSubmitting || (!isFetchedCreatorPackage() && isPriceOutOfRange())">
                  @if (isSubmitting) {
                    <span class="mini-spinner light"></span>
                    <span>Saving...</span>
                  } @else {
                    <span>{{ editingItemId() ? 'Save Changes' : 'Save Post' }}</span>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .content-library-view {
      display: flex;
      flex-direction: column;
      gap: 28px;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      width: 100%;
    }

    .header-text {
      min-width: 0;
      flex: 1 1 280px;
    }

    .page-title {
      font-size: 28px;
      font-weight: 800;
      color: #1D1D1F;
      margin: 0 0 6px 0;
      letter-spacing: -0.02em;
    }

    .page-subtitle {
      font-size: 14px;
      color: rgba(0, 0, 0, 0.7);
      margin: 0;
      line-height: 1.45;
    }

    .add-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #0071E3;
      color: #FFFFFF;
      border: none;
      padding: 10px 18px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transition: all 0.15s ease;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .add-btn:hover {
      background: #0077ED;
      transform: translateY(-1px);
    }

    .btn-icon {
      width: 14px;
      height: 14px;
      filter: brightness(0) invert(1);
    }

    .macos-segmented-bar {
      display: inline-flex;
      align-items: center;
      background: rgba(0, 0, 0, 0.05);
      padding: 4px;
      border-radius: 980px;
      gap: 3px;
      width: fit-content;
      max-width: 100%;
      overflow-x: auto;
      border: 1px solid rgba(0, 0, 0, 0.05);
      box-sizing: border-box;
    }

    .macos-segment {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 16px;
      background: transparent;
      border: none;
      border-radius: 980px;
      font-size: 13px;
      font-weight: 500;
      color: #636366;
      cursor: pointer;
      transition: all 0.16s cubic-bezier(0.16, 1, 0.3, 1);
      white-space: nowrap;
      user-select: none;
      font-family: inherit;
    }

    .macos-segment:hover:not(.active) {
      color: #1D1D1F;
      background: rgba(0, 0, 0, 0.03);
    }

    .macos-segment:active {
      transform: scale(0.96);
    }

    .macos-segment.active {
      background: #FFFFFF;
      color: #1D1D1F;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04);
    }

    .seg-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 980px;
      background: rgba(0, 0, 0, 0.06);
      color: #636366;
      font-variant-numeric: tabular-nums;
    }

    .macos-segment.active .seg-badge {
      background: rgba(0, 113, 227, 0.1);
      color: #0071E3;
    }

    .seg-badge.positive {
      background: rgba(52, 199, 89, 0.12);
      color: #34C759;
    }

    .seg-badge.warning {
      background: rgba(255, 149, 0, 0.12);
      color: #FF9500;
    }

    .seg-badge.info {
      background: rgba(90, 200, 250, 0.12);
      color: #0071E3;
    }

    .table-container {
      background: #FFFFFF;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }

    .macos-empty-state {
      padding: 48px 24px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }

    .macos-empty-icon {
      width: 52px;
      height: 52px;
      border-radius: 16px;
      background: rgba(0, 0, 0, 0.03);
      color: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 4px;
    }

    .macos-empty-title {
      font-size: 15px;
      font-weight: 600;
      color: #1D1D1F;
      margin: 0;
      letter-spacing: -0.01em;
    }

    .macos-empty-text {
      font-size: 13px;
      color: #86868B;
      margin: 0;
      max-width: 380px;
      line-height: 1.45;
    }

    .macos-empty-cta {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      background: #0071E3;
      color: #FFFFFF;
      border: none;
      padding: 8px 16px;
      border-radius: 980px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 113, 227, 0.25);
      transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .macos-empty-cta:hover {
      background: #0077ED;
      transform: translateY(-1px);
      box-shadow: 0 4px 14px rgba(0, 113, 227, 0.35);
    }

    .macos-empty-cta:active {
      transform: scale(0.96);
    }

    .table-scroll {
      width: 100%;
      max-width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      display: block;
      min-height: 280px;
      padding-bottom: 75px;
      box-sizing: border-box;
    }

    .table-header-strip {
      padding: 16px 20px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      width: 100%;
      box-sizing: border-box;
    }

    .filter-group {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .filter-label {
      font-size: 12px;
      font-weight: 600;
      color: rgba(0, 0, 0, 0.5);
      margin-right: 4px;
    }

    .pill-btn {
      background: transparent;
      border: 1px solid rgba(0, 0, 0, 0.15);
      color: rgba(0, 0, 0, 0.7);
      padding: 5px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .pill-btn:hover {
      background: rgba(0, 0, 0, 0.05);
      color: #1D1D1F;
    }

    .pill-btn.active {
      background: #0071E3;
      color: #FFFFFF;
      border-color: #0071E3;
    }

    .content-table {
      width: 100%;
      min-width: 820px;
      border-collapse: collapse;
      text-align: left;
    }

    .content-table th {
      padding: 12px 18px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: rgba(0, 0, 0, 0.6);
      background: rgba(0, 0, 0, 0.03, 0.6);
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      white-space: nowrap;
    }

    .content-table th.th-actions,
    .content-table td.td-actions {
      text-align: right;
    }

    .content-table td {
      padding: 16px 18px;
      font-size: 13px;
      color: #1D1D1F;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      vertical-align: middle;
    }

    .content-table tr:hover {
      background: rgba(0, 0, 0, 0.02);
    }

    .title-with-thumb {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .table-thumb-wrap {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      overflow: hidden;
      flex-shrink: 0;
      background: #E8EEFA;
      border: 1px solid rgba(0, 0, 0, 0.15);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    }

    .table-thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .title-text-group {
      display: flex;
      flex-direction: column;
    }

    .title-text {
      font-weight: 700;
      color: #1D1D1F;
    }

    .creator-sub {
      font-size: 11px;
      color: rgba(0, 0, 0, 0.6);
      margin-top: 2px;
    }

    .format-pill {
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
      background: #FFFFFF;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
    }

    .number-data {
      font-weight: 700;
      white-space: nowrap;
    }

    .price-data {
      font-weight: 800;
      color: #527E5A;
      white-space: nowrap;
    }

    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }

    .badge-success {
      background: rgba(82, 126, 90, 0.15);
      color: #527E5A;
    }

    .badge-warning {
      background: rgba(228, 102, 75, 0.15);
      color: #E4664B;
    }

    .badge-info {
      background: rgba(61, 94, 171, 0.15);
      color: #3D5EAB;
    }

    .row-actions {
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      white-space: nowrap;
    }

    .link-btn,
    .row-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #1D1D1F;
      font-size: 11.5px;
      font-weight: 700;
      text-decoration: none;
      padding: 5px 10px;
      border-radius: 7px;
      background: rgba(0, 0, 0, 0.05);
      border: 1px solid rgba(0, 0, 0, 0.14);
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
    }

    .action-dropdown-container {
      position: relative;
      display: inline-block;
    }

    .btn-action-trigger {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid rgba(0, 0, 0, 0.2);
      background: #FFFFFF;
      color: #1D1D1F;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(18, 32, 68, 0.05);
      transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .btn-action-trigger:hover {
      background: #FFFFFF;
      border-color: #0071E3;
      transform: translateY(-1px);
      box-shadow: 0 3px 8px rgba(0, 0, 0, 0.12);
    }

    .action-dropdown-menu {
      position: absolute;
      right: 0;
      top: calc(100% + 5px);
      z-index: 1000;
      min-width: 175px;
      background: #FFFFFF;
      border: 1px solid rgba(0, 0, 0, 0.14);
      border-radius: 12px;
      box-shadow: 0 14px 34px rgba(18, 32, 68, 0.18);
      padding: 6px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      animation: menuPop 0.14s cubic-bezier(0.2, 1, 0.3, 1);
    }

    .action-dropdown-menu.drop-up {
      top: auto;
      bottom: calc(100% + 6px);
      transform-origin: bottom right;
    }

    @keyframes menuPop {
      from { opacity: 0; transform: scale(0.95) translateY(-4px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    .dropdown-item {
      display: flex;
      align-items: center;
      gap: 9px;
      width: 100%;
      padding: 8px 12px;
      border: none;
      background: transparent;
      border-radius: 8px;
      color: #0077ED;
      font-size: 12.5px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.14s ease;
      text-align: left;
    }

    .dropdown-item:hover {
      background: #FFFFFF;
      color: #1D1D1F;
    }

    .dropdown-item.danger {
      color: #DC2626;
    }

    .dropdown-item.danger:hover {
      background: #FEF2F2;
      color: #B91C1C;
    }

    .dropdown-divider {
      height: 1px;
      background: rgba(0, 0, 0, 0.08);
      margin: 4px 6px;
    }

    .link-btn:hover,
    .row-btn:hover {
      background: #0071E3;
      color: #FFFFFF;
      border-color: #0071E3;
    }

    .row-btn.danger {
      color: #C94A34;
      border-color: rgba(201, 74, 52, 0.25);
      background: rgba(201, 74, 52, 0.05);
    }

    .row-btn.danger:hover {
      background: #C94A34;
      color: #FFFFFF;
      border-color: #C94A34;
    }

    .add-url-inline-btn {
      background: none;
      border: 1px dashed rgba(228, 102, 75, 0.6);
      color: #E4664B;
      padding: 4px 10px;
      border-radius: 7px;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
    }

    .add-url-inline-btn:hover {
      background: rgba(228, 102, 75, 0.1);
    }

    /* Modal */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }

    .modal-card {
      background: #FFFFFF;
      border-radius: 16px;
      width: 100%;
      max-width: 480px;
      padding: 28px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.2);
    }

    .modal-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .modal-head h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 800;
      color: #1D1D1F;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      color: rgba(0, 0, 0, 0.5);
    }

    .form-row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .form-group {
      margin-bottom: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-group label {
      font-size: 12px;
      font-weight: 700;
      color: #1D1D1F;
    }

    .form-input {
      padding: 10px 14px;
      border: 1px solid rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      font-size: 13px;
      outline: none;
      font-family: inherit;
    }

    .form-input:focus {
      border-color: #0071E3;
    }

    .label-with-range-info-cl {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 6px;
      flex-wrap: wrap;
    }

    .range-badge-pill-cl {
      font-size: 10px;
      font-weight: 700;
      color: #2563EB;
      background: rgba(37, 99, 235, 0.08);
      padding: 2px 6px;
      border-radius: 999px;
    }

    .input-range-invalid-cl {
      border-color: #DC2626 !important;
      background-color: #FEF2F2 !important;
    }

    .range-error-text-cl {
      font-size: 11px;
      font-weight: 600;
      color: #DC2626;
      margin-top: 3px;
    }

    .package-notice-group-cl {
      display: flex;
      flex-direction: column;
    }

    .package-calc-badge-cl {
      display: flex;
      align-items: center;
      gap: 10px;
      background: linear-gradient(135deg, rgba(0, 0, 0, 0.06) 0%, rgba(0, 0, 0, 0.02) 100%);
      border: 1px solid rgba(0, 0, 0, 0.15);
      border-radius: 8px;
      padding: 8px 12px;
      min-height: 42px;
      box-sizing: border-box;
    }

    .pkg-badge-icon-cl {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      background: #0071E3;
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .pkg-badge-text-cl {
      display: flex;
      flex-direction: column;
      gap: 1px;
      line-height: 1.25;
    }

    .pkg-badge-text-cl strong {
      font-size: 11px;
      font-weight: 700;
      color: #1D1D1F;
    }

    .pkg-badge-text-cl span {
      font-size: 10.5px;
      color: #475569;
    }

    select.form-input {
      padding-right: 38px !important;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23243F82' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") !important;
      background-repeat: no-repeat !important;
      background-position: right 14px center !important;
      appearance: none !important;
      -webkit-appearance: none !important;
      -moz-appearance: none !important;
      cursor: pointer;
      text-overflow: ellipsis;
      white-space: nowrap;
      background-color: #FFFFFF;
    }

    .handle-lookup-row {
      display: flex;
      gap: 8px;
      align-items: stretch;
    }

    .handle-input {
      flex: 1;
    }

    .btn-fetch-handle {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 14px;
      border-radius: 8px;
      border: 1px solid rgba(0, 0, 0, 0.25);
      background: #FFFFFF;
      color: #1D1D1F;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
    }

    .btn-fetch-handle:hover:not(:disabled) {
      background: #0071E3;
      color: #FFFFFF;
      border-color: #0071E3;
    }

    .btn-fetch-handle:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .creator-preview-card {
      margin-top: 6px;
      padding: 10px 12px;
      border-radius: 10px;
      background: rgba(0, 0, 0, 0.04);
      border: 1px solid rgba(0, 0, 0, 0.14);
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .creator-preview-avatar,
    .creator-preview-avatar-img {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .creator-preview-avatar-img {
      object-fit: cover;
      border: 1.5px solid rgba(0, 0, 0, 0.2);
    }

    .creator-preview-avatar {
      background: #0071E3;
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .creator-preview-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      flex: 1;
    }

    .creator-preview-top {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      font-size: 12.5px;
      color: #1D1D1F;
    }

    .creator-preview-handle {
      font-size: 11.5px;
      color: rgba(0, 0, 0, 0.65);
      font-weight: 600;
    }

    .creator-preview-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 999px;
      background: rgba(82, 126, 90, 0.16);
      color: #3F6346;
      white-space: nowrap;
    }

    .creator-preview-badge.new-badge {
      background: rgba(61, 94, 171, 0.14);
      color: #1D1D1F;
    }

    .creator-preview-meta {
      font-size: 11px;
      color: rgba(0, 0, 0, 0.68);
    }

    .creator-preview-meta a {
      color: #1D1D1F;
      font-weight: 600;
      text-decoration: underline;
    }

    .mini-spinner {
      width: 12px;
      height: 12px;
      border: 2px solid rgba(0, 0, 0, 0.25);
      border-top-color: #0071E3;
      border-radius: 50%;
      animation: clSpin 0.65s linear infinite;
      display: inline-block;
    }

    .mini-spinner.light {
      border-color: rgba(255, 255, 255, 0.35);
      border-top-color: #FFFFFF;
    }

    @keyframes clSpin {
      to { transform: rotate(360deg); }
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 24px;
    }

    .btn-cancel {
      padding: 8px 16px;
      border: 1px solid rgba(0, 0, 0, 0.2);
      background: transparent;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      color: #1D1D1F;
    }

    .btn-submit {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 22px;
      border: none;
      background: #0071E3;
      color: #FFFFFF;
      border-radius: 999px;
      font-size: 13.5px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
      transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .btn-submit:hover:not(:disabled) {
      background: #0077ED;
      transform: translateY(-1.5px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
    }

    .btn-submit:active:not(:disabled) {
      transform: scale(0.96) translateY(0);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .btn-submit:disabled,
    .btn-cancel:disabled {
      opacity: 0.75;
      cursor: not-allowed;
      transform: none !important;
    }

    @media (max-width: 900px) {
      .metrics-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      .form-row-2 {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 768px) {
      .page-title {
        font-size: 24px;
      }
      .page-header {
        gap: 12px;
      }
      .modal-card {
        padding: 20px 16px;
        max-width: 95vw;
      }
    }
  `]
})
export class ContentLibraryComponent implements OnInit {
  private portalService = inject(PortalService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);
  private confirmService = inject(ConfirmService);

  isAdmin = computed(() => this.authService.userRole() === 'SYSTEM_ADMIN');

  contentItems = this.portalService.contentItems;
  campaigns = this.portalService.campaigns;
  selectedStatus = signal<string>('ALL');

  readonly formatOptions: string[] = ['Instagram Reel', 'Instagram Post', 'Instagram Story', 'YouTube Shorts'];

  campaignSelectOptions = computed<SelectOption[]>(() => [
    { label: 'General Workspace (All Campaigns)', value: null },
    ...this.campaigns().map(c => ({
      label: `${c.name}${c.timeframe ? ' (' + c.timeframe + ')' : ''}`,
      value: c.id
    }))
  ]);

  totalCount = computed(() => this.contentItems().length);
  withInsightsCount = computed(() => this.contentItems().filter(i => i.status === 'WITH_INSIGHTS').length);
  missingUrlCount = computed(() => this.contentItems().filter(i => i.status === 'MISSING_URL').length);
  awaitingCount = computed(() => this.contentItems().filter(i => i.status === 'AWAITING_INSIGHTS').length);

  readonly openMenuId = signal<number | null>(null);

  toggleActionMenu(id?: number, e?: Event) {
    if (e) e.stopPropagation();
    if (!id) return;
    this.openMenuId.update(curr => (curr === id ? null : id));
  }

  closeMenu() {
    this.openMenuId.set(null);
  }

  @HostListener('document:click')
  onDocClick(): void {
    this.closeMenu();
  }

  openModal = false;
  isSubmitting = false;
  readonly editingItemId = signal<number | null>(null);
  readonly isFetchingCreator = signal(false);
  readonly fetchedCreator = signal<Creator | null>(null);
  isFetchedCreatorPackage = computed(() => this.fetchedCreator()?.pricingModel === 'PACKAGE');

  isPriceOutOfRange(): boolean {
    if (this.isFetchedCreatorPackage()) return false;
    const c = this.fetchedCreator();
    if (!c) return false;
    const price = Number(this.newFinalPrice) || 0;
    if (c.minPrice && c.minPrice > 0 && price < c.minPrice) return true;
    if (c.maxPrice && c.maxPrice > 0 && price > c.maxPrice) return true;
    return false;
  }

  newTitle = '';
  newCreatorHandle = '';
  newUrl = '';
  newFormat = 'Instagram Reel';
  newFinalPrice: number | null = null;
  newCampaignId: number | null = null;

  formatInr(val: number | undefined | null): string {
    return Number(val || 0).toLocaleString('en-IN');
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeModal();
  }

  ngOnInit() {
    this.portalService.fetchContent().subscribe();
  }

  openNewModal() {
    this.editingItemId.set(null);
    this.newTitle = '';
    this.newCreatorHandle = '';
    this.newUrl = '';
    this.newFormat = 'Instagram Reel';
    this.newFinalPrice = null;
    this.newCampaignId = null;
    this.fetchedCreator.set(null);
    this.openModal = true;
  }

  openEditModal(item: ContentItem) {
    this.editingItemId.set(item.id ?? null);
    this.newTitle = item.title;
    this.newCreatorHandle = item.creatorHandle;
    this.newUrl = item.contentUrl || '';
    this.newFormat = item.format || 'Instagram Reel';
    this.newFinalPrice = item.finalPrice ?? null;
    this.newCampaignId = item.campaignId ?? null;
    this.fetchedCreator.set(null);
    this.openModal = true;
    this.fetchCreatorDetails();
  }

  closeModal() {
    if (this.isSubmitting) return;
    this.openModal = false;
    this.editingItemId.set(null);
  }

  onHandleBlur() {
    if (this.newCreatorHandle.trim().length >= 2) {
      this.fetchCreatorDetails();
    }
  }

  fetchCreatorDetails() {
    const raw = this.newCreatorHandle.trim();
    if (!raw || this.isFetchingCreator()) return;
    this.isFetchingCreator.set(true);
    this.portalService.lookupCreatorByHandle(raw, undefined, false).subscribe({
      next: (creator) => {
        this.isFetchingCreator.set(false);
        this.fetchedCreator.set(creator);
        this.newCreatorHandle = creator.handle;
        if (!this.newFinalPrice && creator.price > 0 && creator.pricingModel !== 'PACKAGE') {
          this.newFinalPrice = creator.price;
        }
      },
      error: () => {
        this.isFetchingCreator.set(false);
      }
    });
  }

  filterByStatus(status: string) {
    this.selectedStatus.set(status);
    this.portalService.fetchContent(status).subscribe();
  }

  filteredItems() {
    const status = this.selectedStatus();
    if (status === 'ALL') return this.contentItems();
    return this.contentItems().filter(i => i.status === status);
  }

  async submitContent() {
    if (!this.newTitle || !this.newCreatorHandle || this.isSubmitting) return;

    if (!this.isFetchedCreatorPackage() && this.isPriceOutOfRange()) {
      const c = this.fetchedCreator();
      this.toast.error('Rate Out of Range', `Deliverable price must be between ₹${((c?.minPrice || 0)).toLocaleString('en-IN')} and ₹${((c?.maxPrice || 0)).toLocaleString('en-IN')}.`);
      return;
    }

    const isEditing = this.editingItemId() !== null;
    const priceVal = this.isFetchedCreatorPackage() ? 0 : (Number(this.newFinalPrice) > 0 ? Number(this.newFinalPrice) : 0);

    const priceSummary = this.isFetchedCreatorPackage()
      ? `Package Retainer (₹${(this.fetchedCreator()?.price || 0).toLocaleString('en-IN')} total)`
      : `Final Price: ₹${priceVal.toLocaleString('en-IN')}`;

    const confirmed = await this.confirmService.confirm({
      title: isEditing ? 'Update Content Deliverable?' : 'Confirm Deliverable Submission?',
      message: isEditing
        ? `Save updates to "${this.newTitle.trim()}" for ${this.newCreatorHandle.trim()}?`
        : `Submit "${this.newTitle.trim()}" for creator ${this.newCreatorHandle.trim()} to the Content Library?`,
      detail: `Format: ${this.newFormat} · ${priceSummary}${this.newUrl ? ' · URL: ' + this.newUrl : ' · URL Pending'}`,
      confirmText: isEditing ? 'Save Changes' : 'Submit Post',
      variant: 'primary'
    });
    if (!confirmed) return;

    this.isSubmitting = true;
    const isInstagram = this.newUrl && this.newUrl.includes('instagram.com');
    const title = this.newTitle;
    const resolvedCreator = this.fetchedCreator();
    const assignedCampaign = this.campaigns().find(x => x.id === this.newCampaignId);

    const payload = {
      title: this.newTitle,
      creatorHandle: this.newCreatorHandle,
      agencyName: resolvedCreator?.agencyName,
      campaignId: this.newCampaignId ?? undefined,
      campaignName: assignedCampaign?.name,
      contentUrl: this.newUrl,
      format: this.newFormat,
      finalPrice: priceVal
    };

    if (isEditing && this.editingItemId()) {
      this.portalService.updateContentItem(this.editingItemId()!, payload).subscribe({
        next: (saved) => {
          this.isSubmitting = false;
          this.openModal = false;
          this.editingItemId.set(null);
          this.toast.success('Deliverable Updated', `"${title}" (${saved.creatorHandle}) has been updated.`);
        },
        error: (err) => {
          this.isSubmitting = false;
          this.toast.error('Update Failed', err.error?.message || err.message || 'Could not update content item.');
        }
      });
      return;
    }

    this.portalService.addContentItem({
      ...payload,
      views: 0,
      likes: 0,
      comments: 0
    }).subscribe({
      next: (saved) => {
        this.isSubmitting = false;
        this.openModal = false;
        if (isInstagram) {
          this.toast.success('Creator & Live Content Synced', `"${title}" (${saved.creatorHandle}) was saved, creator inserted in roster, and synced with Meta Graph API v26.0.`);
        } else {
          this.toast.success('Deliverable & Creator Recorded', `"${title}" (${saved.creatorHandle}) has been saved and linked to the Creators directory.`);
        }
        this.newTitle = '';
        this.newCreatorHandle = '';
        this.newUrl = '';
        this.newFinalPrice = null;
        this.fetchedCreator.set(null);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.toast.error('Save Failed', err.error?.message || err.message || 'Could not save content item.');
      }
    });
  }

  async deleteItem(item: ContentItem) {
    if (!item.id) return;
    const confirmed = await this.confirmService.confirm({
      title: 'Delete Deliverable?',
      message: `Are you sure you want to delete "${item.title}" (${item.creatorHandle})?`,
      detail: item.contentUrl || 'No URL attached',
      confirmText: 'Delete Deliverable',
      variant: 'danger'
    });
    if (!confirmed) return;

    this.portalService.deleteContentItem(item.id).subscribe({
      next: () => {
        this.toast.success('Deliverable Deleted', `"${item.title}" has been removed.`);
      },
      error: (err) => {
        this.toast.error('Delete Failed', err.error?.message || err.message || 'Could not delete deliverable.');
      }
    });
  }
}
