import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService, Brand } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { ConfirmModalComponent } from '../components/confirm-modal.component';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const IG_REGEX = /^@?[a-zA-Z0-9._]{1,30}$/;

interface CountryOption {
  iso: string;
  dial: string;
  label: string;
  minDigits: number;
  maxDigits: number;
  placeholder: string;
}

const COUNTRY_CODES: CountryOption[] = [
  { iso: 'IN', dial: '+91', label: 'IN +91', minDigits: 10, maxDigits: 10, placeholder: '98765 43210' },
  { iso: 'US', dial: '+1', label: 'US +1', minDigits: 10, maxDigits: 10, placeholder: '(555) 000-0000' },
  { iso: 'UK', dial: '+44', label: 'UK +44', minDigits: 10, maxDigits: 11, placeholder: '7700 900077' },
  { iso: 'AE', dial: '+971', label: 'AE +971', minDigits: 9, maxDigits: 9, placeholder: '50 123 4567' },
  { iso: 'SG', dial: '+65', label: 'SG +65', minDigits: 8, maxDigits: 8, placeholder: '8123 4567' },
  { iso: 'AU', dial: '+61', label: 'AU +61', minDigits: 9, maxDigits: 9, placeholder: '412 345 678' },
  { iso: 'CA', dial: '+1', label: 'CA +1', minDigits: 10, maxDigits: 10, placeholder: '(416) 555-0199' },
  { iso: 'DE', dial: '+49', label: 'DE +49', minDigits: 10, maxDigits: 12, placeholder: '151 23456789' },
  { iso: 'FR', dial: '+33', label: 'FR +33', minDigits: 9, maxDigits: 9, placeholder: '6 12 34 56 78' },
  { iso: 'JP', dial: '+81', label: 'JP +81', minDigits: 10, maxDigits: 10, placeholder: '90 1234 5678' }
];

@Component({
  selector: 'app-admin-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ConfirmModalComponent],
  template: `
    <div class="bg-background font-body text-ink-primary antialiased min-h-screen flex flex-col overflow-x-hidden selection:bg-blue-container selection:text-ink-primary">
      <!-- Header -->
      <header class="shrink-0 w-full z-40 bg-surface-bright/90 backdrop-blur-xl border-b border-surface-container-high/40">
        <div class="h-[52px] w-full px-4 sm:px-8 max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <a routerLink="/admin" class="flex items-center gap-2 shrink-0 group">
              <img src="/converge-logo.png" alt="Converge" class="w-7 h-7 rounded-full object-contain shrink-0 transition-transform duration-300 group-hover:rotate-12"/>
              <span class="font-headline text-base sm:text-lg font-bold text-ink-primary tracking-tight group-hover:text-primary transition-colors">Converge</span>
            </a>
            <span class="hidden sm:inline-flex px-2.5 py-0.5 rounded-full bg-surface-container-soft text-ink-secondary text-[11px] font-semibold">Admin Console</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <div class="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-mint-container text-ink-primary text-xs font-semibold">
              <span class="w-2 h-2 rounded-full bg-mint-green animate-pulse"></span>
              <span>System Admin</span>
            </div>
            <button (click)="showSignOutConfirm.set(true)" class="px-3.5 py-1.5 rounded-full bg-surface-container-soft hover:bg-surface-container-high active:scale-95 text-xs font-semibold text-ink-secondary cursor-pointer whitespace-nowrap transition-all">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main class="w-full bg-background flex-1 relative overflow-hidden">
        <!-- Soft Ambient Floating Blobs & Orbitals -->
        <div class="absolute -top-12 left-1/4 w-[420px] h-[420px] pointer-events-none rounded-full bg-gradient-to-tr from-blue-container/30 via-marigold-container/20 to-transparent blur-3xl animate-pulse-glow -z-0"></div>
        <div class="absolute bottom-0 right-1/5 w-[360px] h-[360px] pointer-events-none rounded-full bg-coral-container/20 blur-3xl animate-drift -z-0"></div>
        <div aria-hidden="true" class="hidden md:block absolute -top-4 right-6 w-52 h-52 pointer-events-none opacity-30 mix-blend-multiply select-none">
          <svg class="w-full h-full animate-orbit" viewBox="0 0 400 400">
            <circle cx="200" cy="200" fill="none" opacity="0.45" r="160" stroke="#0b57d0" stroke-dasharray="8 12" stroke-width="1.5"></circle>
            <circle cx="200" cy="200" fill="none" r="110" stroke="#d9372b" stroke-dasharray="120 60" stroke-width="2.5"></circle>
            <circle cx="200" cy="200" fill="none" r="60" stroke="#fbbc05" stroke-dasharray="40 20" stroke-width="3"></circle>
          </svg>
        </div>

        <div class="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 py-3.5 lg:py-4">
          <!-- Compact Top Title + Stats Row -->
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3.5 animate-fade-in-up">
            <div class="min-w-0">
              <div class="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-surface-container-soft text-ink-primary border border-surface-container-high/60 mb-1">
                <span class="w-1.5 h-1.5 rounded-full bg-mint-green animate-pulse"></span>
                <span class="text-[10px] uppercase tracking-wider font-semibold text-ink-secondary">System Admin • Brand Provisioning</span>
              </div>
              <h1 class="font-headline text-2xl sm:text-[26px] font-bold text-ink-primary tracking-tight leading-tight">Brand Registry &amp; Onboarding</h1>
              <p class="mt-0.5 text-xs sm:text-sm text-ink-secondary">Provision brand workspaces and assign brand managers for direct access.</p>
            </div>

            <div class="flex flex-wrap items-center gap-1.5 self-start md:self-center p-1 bg-surface-container-soft/80 rounded-full border border-surface-container-high/50 shrink-0 shadow-2xs">
              <div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-lowest shadow-2xs text-xs">
                <span class="h-2 w-2 rounded-full bg-primary"></span>
                <span class="font-bold text-ink-primary">{{ activeCount() }}</span>
                <span class="text-ink-secondary">Active</span>
              </div>
              <div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-marigold-container/70 text-xs">
                <span class="h-2 w-2 rounded-full bg-tertiary-fixed-dim"></span>
                <span class="font-bold text-tertiary">{{ draftCount() }}</span>
                <span class="text-ink-secondary">Drafts</span>
              </div>
              <div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-mint-container/70 text-xs">
                <span class="h-2 w-2 rounded-full bg-mint-green"></span>
                <span class="font-bold text-[#137333]">{{ brands().length }}</span>
                <span class="text-ink-secondary">Total</span>
              </div>
            </div>
          </div>

          <!-- Split Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start animate-fade-in-up">
            <!-- Left Column: Brand Provisioning Form -->
            <section
              class="lg:col-span-7 flex flex-col bg-surface-container-lowest/95 backdrop-blur-xl rounded-[24px] shadow-[0_12px_36px_-12px_rgba(31,29,25,0.06)] p-4 sm:p-5 relative overflow-hidden border border-surface-container-high transition-all duration-300"
              [class.animate-shake]="shakeForm()">
              <div class="flex items-center justify-between gap-2 mb-2.5">
                <div class="flex items-center gap-2">
                  <!-- Animated Building Doodle -->
                  <svg class="w-5 h-5 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="4" y="5" width="12" height="15" rx="2.5"/>
                    <path d="M8 9h4M8 13h4"/>
                    <path d="M16 11h4v9h-4"/>
                    <path d="M18 4v3M16.5 5.5h3"/>
                  </svg>
                  <h2 class="font-headline text-base sm:text-lg font-bold text-ink-primary">Brand Provisioning Form</h2>
                </div>
                <span class="px-2.5 py-0.5 rounded-full bg-mint-container/80 text-[#137333] text-[11px] font-semibold">Direct Handshake</span>
              </div>

              @if (banner(); as msg) {
                <div
                  class="mb-2.5 px-3 py-1.5 rounded-2xl border text-xs font-medium flex items-center justify-between gap-2 animate-pop-in"
                  [ngClass]="msg.type === 'error'
                    ? 'bg-coral-container/45 border-secondary/20 text-secondary'
                    : 'bg-mint-container/50 border-mint-green/25 text-[#137333]'">
                  <div class="flex items-center gap-2 min-w-0">
                    <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                      @if (msg.type === 'error') {
                        <circle cx="12" cy="12" r="9"/>
                        <path d="M12 8v4"/>
                        <circle cx="12" cy="16" r="0.6" fill="currentColor"/>
                      } @else {
                        <circle cx="12" cy="12" r="9"/>
                        <path d="M8.5 12.5l2.5 2.5 4.5-5" class="doodle-check-path"/>
                      }
                    </svg>
                    <span class="leading-snug">{{ msg.text }}</span>
                  </div>
                  <button type="button" (click)="banner.set(null)" aria-label="Dismiss message" class="opacity-70 hover:opacity-100 cursor-pointer shrink-0 p-0.5">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
                  </button>
                </div>
              }

              <form (ngSubmit)="submitBrand('ACTIVE')" novalidate class="flex flex-col gap-2.5">
                <div class="flex flex-col gap-2.5 p-3.5 sm:p-4 rounded-2xl bg-surface-cream border border-surface-container-high/60">
                  <!-- Row 1: Brand Org + Manager Name -->
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div class="flex flex-col gap-0.5">
                      <div class="flex items-center justify-between px-1">
                        <label for="brand-org" class="text-[11px] text-ink-primary font-semibold">Brand Organization Name</label>
                        @if (brandTouched() && brandError()) {
                          <span class="text-[10px] text-secondary font-semibold">{{ brandError() }}</span>
                        }
                      </div>
                      <div
                        class="group pill-white flex items-center gap-2.5 px-3.5 h-9.5 rounded-full bg-surface-container-lowest border transition-all duration-200"
                        [ngClass]="brandTouched() && brandError()
                          ? 'border-secondary/55 ring-2 ring-secondary/10'
                          : (brandValid() ? 'border-mint-green/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15' : 'border-surface-container-high/80 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15')">
                        <!-- Monoline Building Doodle -->
                        <svg class="doodle-svg w-4 h-4 shrink-0"
                             [ngClass]="brandTouched() && brandError() ? 'text-secondary' : 'text-primary'"
                             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="4" y="4.5" width="16" height="15" rx="3"/>
                          <path d="M9 9h2M13 9h2M9 13h2M13 13h2M10 19.5v-3h4v3"/>
                        </svg>
                        <input
                          id="brand-org"
                          [ngModel]="brandName()"
                          (ngModelChange)="onSimpleChange(brandName, $event)"
                          (blur)="brandTouched.set(true)"
                          name="brandName"
                          autocomplete="organization"
                          placeholder="e.g. Acme Skincare"
                          type="text"
                          class="w-full min-w-0 bg-transparent text-sm text-ink-primary placeholder:text-ink-secondary/50 focus:outline-none"/>
                        @if (brandValid()) {
                          <svg class="w-4 h-4 text-mint-green shrink-0 animate-pop-in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="9" class="opacity-30" fill="#ceead6"/>
                            <path d="M8 12.5l2.7 2.7 5.5-6" class="doodle-check-path"/>
                          </svg>
                        }
                      </div>
                    </div>

                    <div class="flex flex-col gap-0.5">
                      <div class="flex items-center justify-between px-1">
                        <label for="manager-name" class="text-[11px] text-ink-primary font-semibold">Brand Manager Name</label>
                        @if (managerNameTouched() && managerNameError()) {
                          <span class="text-[10px] text-secondary font-semibold">{{ managerNameError() }}</span>
                        }
                      </div>
                      <div
                        class="group pill-white flex items-center gap-2.5 px-3.5 h-9.5 rounded-full bg-surface-container-lowest border transition-all duration-200"
                        [ngClass]="managerNameTouched() && managerNameError()
                          ? 'border-secondary/55 ring-2 ring-secondary/10'
                          : (managerNameValid() ? 'border-mint-green/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15' : 'border-surface-container-high/80 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15')">
                        <!-- Monoline Person Doodle -->
                        <svg class="doodle-svg w-4 h-4 shrink-0"
                             [ngClass]="managerNameTouched() && managerNameError() ? 'text-secondary' : 'text-tertiary group-focus-within:text-primary'"
                             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="8.5" r="3.6"/>
                          <path d="M5.5 19.5c1-3.2 3.3-4.8 6.5-4.8s5.5 1.6 6.5 4.8"/>
                        </svg>
                        <input
                          id="manager-name"
                          [ngModel]="managerName()"
                          (ngModelChange)="onManagerNameInput($event)"
                          (blur)="managerNameTouched.set(true)"
                          name="brandManagerDisplayName"
                          autocomplete="off"
                          placeholder="Manager full name"
                          type="text"
                          class="w-full min-w-0 bg-transparent text-sm text-ink-primary placeholder:text-ink-secondary/50 focus:outline-none"/>
                        @if (managerNameValid()) {
                          <svg class="w-4 h-4 text-mint-green shrink-0 animate-pop-in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="9" class="opacity-30" fill="#ceead6"/>
                            <path d="M8 12.5l2.7 2.7 5.5-6" class="doodle-check-path"/>
                          </svg>
                        }
                      </div>
                    </div>
                  </div>

                  <!-- Row 2: Brand Manager Email -->
                  <div class="flex flex-col gap-0.5">
                    <div class="flex items-center justify-between flex-wrap gap-1 px-1">
                      <label for="manager-email" class="text-[11px] text-ink-primary font-semibold">Brand Manager Email</label>
                      @if ((emailTouched() || emailIsAdmin()) && emailError()) {
                        <span class="text-[10px] text-secondary font-semibold">{{ emailError() }}</span>
                      } @else {
                        <span class="text-ink-secondary text-[10px] flex items-center gap-1">
                          <span class="w-1.5 h-1.5 rounded-full bg-mint-green"></span>Registered Account Lookup
                        </span>
                      }
                    </div>
                    <div
                      class="group pill-white flex items-center gap-2.5 px-3.5 h-9.5 rounded-full bg-surface-container-lowest border transition-all duration-200"
                      [ngClass]="(emailTouched() || emailIsAdmin()) && emailError()
                        ? 'border-secondary/55 ring-2 ring-secondary/10'
                        : (emailValid() ? 'border-mint-green/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15' : 'border-surface-container-high/80 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15')">
                      <!-- Animated Monoline Envelope Doodle -->
                      <svg class="doodle-svg w-4 h-4 shrink-0"
                           [ngClass]="(emailTouched() || emailIsAdmin()) && emailError() ? 'text-secondary' : 'text-primary'"
                           viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3.5" y="5.5" width="17" height="13" rx="3.5"/>
                        <path d="M5 7.5l7 5.2 7-5.2"/>
                      </svg>
                      <input
                        id="manager-email"
                        [ngModel]="managerEmail()"
                        (ngModelChange)="onManagerEmailChange($event)"
                        (blur)="emailTouched.set(true)"
                        name="brandManagerEmailInput"
                        autocomplete="off"
                        placeholder="manager@brand.com"
                        type="email"
                        class="w-full min-w-0 bg-transparent text-sm text-ink-primary placeholder:text-ink-secondary/50 focus:outline-none"/>
                      @if (emailValid()) {
                        <svg class="w-4 h-4 text-mint-green shrink-0 animate-pop-in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="9" class="opacity-30" fill="#ceead6"/>
                          <path d="M8 12.5l2.7 2.7 5.5-6" class="doodle-check-path"/>
                        </svg>
                      }
                    </div>
                    @if (matchedUser(); as user) {
                      <div class="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-surface-container-lowest border border-mint-green/40 mt-0.5 animate-pop-in">
                        <div class="flex items-center gap-2 min-w-0">
                          <span class="w-6 h-6 rounded-full bg-blue-container text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                            {{ user.name.substring(0, 2).toUpperCase() }}
                          </span>
                          <p class="text-[11px] text-ink-primary font-semibold truncate">{{ user.name }} <span class="font-mono font-normal text-ink-secondary">({{ user.email }})</span></p>
                        </div>
                        <span class="px-2 py-0.5 rounded-full bg-mint-container text-[#137333] text-[10px] font-semibold">Linked Identity</span>
                      </div>
                    }
                  </div>

                  <!-- Row 3: Contact Number (with Country Code Dropdown) + Instagram Handle -->
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div class="flex flex-col gap-0.5">
                      <div class="flex items-center justify-between px-1">
                        <label for="brand-contact" class="text-[11px] text-ink-primary font-semibold">Contact Number</label>
                        @if (phoneTouched() && phoneError()) {
                          <span class="text-[10px] text-secondary font-semibold">{{ phoneError() }}</span>
                        }
                      </div>
                      <div
                        class="group pill-white flex items-center gap-2 pl-2 pr-3 h-9.5 rounded-full bg-surface-container-lowest border transition-all duration-200"
                        [ngClass]="phoneTouched() && phoneError()
                          ? 'border-secondary/55 ring-2 ring-secondary/10'
                          : (phoneValid() ? 'border-mint-green/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15' : 'border-surface-container-high/80 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15')">
                        <!-- Country Code Selector -->
                        <div class="relative shrink-0 flex items-center">
                          <select
                            [ngModel]="countryIso()"
                            (ngModelChange)="onCountryChange($event)"
                            name="countryIso"
                            aria-label="Country dialing code"
                            class="appearance-none h-7 pl-2.5 pr-5 rounded-full bg-surface-container-soft/85 hover:bg-surface-container text-[11px] font-semibold text-ink-primary outline-none cursor-pointer transition-colors">
                            @for (c of countries; track c.iso) {
                              <option [value]="c.iso">{{ c.label }}</option>
                            }
                          </select>
                          <svg class="w-3 h-3 text-ink-secondary pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M6 9l6 6 6-6"/>
                          </svg>
                        </div>

                        <!-- Monoline Phone Doodle -->
                        <svg class="doodle-svg w-3.5 h-3.5 shrink-0"
                             [ngClass]="phoneTouched() && phoneError() ? 'text-secondary' : 'text-ink-secondary group-focus-within:text-primary'"
                             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M6.5 4.5h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A14.5 14.5 0 0 1 4.5 6.7a2 2 0 0 1 2-2.2z"/>
                        </svg>

                        <input
                          id="brand-contact"
                          [ngModel]="phoneLocal()"
                          (ngModelChange)="onSimpleChange(phoneLocal, $event)"
                          (blur)="phoneTouched.set(true)"
                          name="contactNumber"
                          autocomplete="off"
                          [placeholder]="selectedCountry().placeholder"
                          type="tel"
                          class="w-full min-w-0 bg-transparent text-sm text-ink-primary placeholder:text-ink-secondary/50 focus:outline-none"/>

                        @if (phoneValid()) {
                          <svg class="w-4 h-4 text-mint-green shrink-0 animate-pop-in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="9" class="opacity-30" fill="#ceead6"/>
                            <path d="M8 12.5l2.7 2.7 5.5-6" class="doodle-check-path"/>
                          </svg>
                        }
                      </div>
                    </div>

                    <div class="flex flex-col gap-0.5">
                      <div class="flex items-center justify-between px-1">
                        <label for="brand-handle" class="text-[11px] text-ink-primary font-semibold">Instagram Handle <span class="text-ink-secondary font-normal">(Optional)</span></label>
                        @if (igTouched() && igError()) {
                          <span class="text-[10px] text-secondary font-semibold">{{ igError() }}</span>
                        }
                      </div>
                      <div
                        class="group pill-white flex items-center gap-2.5 px-3.5 h-9.5 rounded-full bg-surface-container-lowest border transition-all duration-200"
                        [ngClass]="igTouched() && igError()
                          ? 'border-secondary/55 ring-2 ring-secondary/10'
                          : (igValid() ? 'border-mint-green/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15' : 'border-surface-container-high/80 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15')">
                        <!-- Monoline Camera Doodle -->
                        <svg class="doodle-svg w-4 h-4 shrink-0"
                             [ngClass]="igTouched() && igError() ? 'text-secondary' : 'text-secondary'"
                             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="4" y="4" width="16" height="16" rx="4.5"/>
                          <circle cx="12" cy="12" r="3.5"/>
                          <circle cx="16.8" cy="7.2" r="0.8" fill="currentColor" stroke="none"/>
                        </svg>
                        <input
                          id="brand-handle"
                          [ngModel]="instagramHandle()"
                          (ngModelChange)="onSimpleChange(instagramHandle, $event)"
                          (blur)="igTouched.set(true)"
                          name="instagramHandle"
                          autocomplete="off"
                          placeholder="@brand_handle"
                          type="text"
                          class="w-full min-w-0 bg-transparent text-sm text-ink-primary placeholder:text-ink-secondary/50 focus:outline-none"/>
                        @if (igValid()) {
                          <svg class="w-4 h-4 text-mint-green shrink-0 animate-pop-in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="9" class="opacity-30" fill="#ceead6"/>
                            <path d="M8 12.5l2.7 2.7 5.5-6" class="doodle-check-path"/>
                          </svg>
                        }
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Compact Direct Access Note -->
                <div class="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-surface-warm border border-surface-container-high/60 text-ink-secondary text-[11px] leading-snug">
                  <svg class="w-4 h-4 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9"/>
                    <path d="M12 10.5v5.5"/>
                    <circle cx="12" cy="8" r="0.6" fill="currentColor"/>
                  </svg>
                  <span>Direct access: <strong>{{ managerName() || 'the Brand Manager' }}</strong> can sign in with {{ !emailError() && managerEmail().trim() ? managerEmail().trim() : 'a manager email' }} to open the workspace immediately.</span>
                </div>

                <div class="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-0.5">
                  <button type="button" (click)="submitBrand('DRAFT')" [disabled]="submitting()" class="h-9.5 px-5 rounded-full bg-surface-container-soft hover:bg-surface-container-high active:scale-95 text-ink-secondary text-xs font-semibold border border-surface-container-high/50 cursor-pointer transition-all">
                    Save Draft
                  </button>
                  <button type="submit" [disabled]="submitting()" class="btn-shimmer h-9.5 flex items-center justify-center gap-1.5 px-6 rounded-full bg-primary hover:bg-primary-container text-on-primary text-xs sm:text-sm font-semibold shadow-sm hover:shadow-md transition-all active:scale-95 group cursor-pointer disabled:opacity-60">
                    @if (submitting()) {
                      <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9"/></svg>
                      <span>Provisioning...</span>
                    } @else {
                      <span>Onboard Brand</span>
                      <svg class="w-4 h-4 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 12h14"/>
                        <path d="M13 6l6 6-6 6"/>
                      </svg>
                    }
                  </button>
                </div>
              </form>

              <!-- Success Overlay -->
              @if (provisionedBrand(); as pb) {
                <div class="absolute inset-0 bg-surface-container-lowest/95 backdrop-blur-md p-6 flex flex-col items-center justify-center text-center z-30 animate-pop-in">
                  <div class="w-14 h-14 rounded-full bg-mint-container flex items-center justify-center text-[#137333] mb-3 shadow-sm">
                    <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="9"/>
                      <path d="M8.5 12.5l2.5 2.5 4.5-5" class="doodle-check-path"/>
                    </svg>
                  </div>
                  <span class="text-xs font-bold uppercase tracking-wider text-mint-green">Brand Workspace Ready</span>
                  <h3 class="font-headline text-2xl font-bold text-ink-primary mt-1">{{ pb.name }} is Live!</h3>
                  <p class="text-sm text-ink-secondary max-w-md mt-1.5">
                    <strong class="text-ink-primary">{{ pb.managerName }} ({{ pb.managerEmail }})</strong> can now sign in with this email to access the workspace directly.
                  </p>
                  <div class="mt-5 flex items-center justify-center gap-2.5">
                    <button type="button" (click)="openBrand(pb.id)" class="h-9.5 px-5 rounded-full bg-surface-container-soft hover:bg-surface-container text-ink-primary text-xs font-semibold cursor-pointer transition-colors">View Brand</button>
                    <button type="button" (click)="provisionedBrand.set(null)" class="h-9.5 px-6 rounded-full bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold shadow-sm cursor-pointer transition-all">Done</button>
                  </div>
                </div>
              }
            </section>

            <!-- Right Column: Active Directory -->
            <section class="lg:col-span-5 flex flex-col gap-3">
              <div class="flex flex-col gap-2.5 bg-surface-container-lowest/95 backdrop-blur-xl p-4 rounded-[24px] shadow-[0_12px_36px_-12px_rgba(31,29,25,0.06)] border border-surface-container-high">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h4l2 2.5h6A2.5 2.5 0 0 1 20.5 10v7A2.5 2.5 0 0 1 18 19.5H6A2.5 2.5 0 0 1 3.5 17V7.5z"/>
                    </svg>
                    <span class="font-headline text-base font-bold text-ink-primary">Active Directory</span>
                  </div>
                  <span class="px-2.5 py-0.5 rounded-full bg-surface-container-soft text-ink-secondary text-[11px] font-medium">{{ brands().length }} Enrolled</span>
                </div>

                <div class="group flex items-center gap-2.5 px-3.5 h-9.5 rounded-full bg-surface-container-soft focus-within:bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary/20 border border-surface-container-high/50 transition-all">
                  <svg class="doodle-svg w-4 h-4 text-ink-secondary group-focus-within:text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="6.5"/>
                    <path d="M16 16l4 4"/>
                  </svg>
                  <input [(ngModel)]="searchQuery" (ngModelChange)="searchSignal.set($event)" placeholder="Filter by brand name or manager..." type="text" class="w-full min-w-0 bg-transparent text-ink-primary text-xs focus:outline-none"/>
                </div>

                <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <button (click)="statusFilter.set('ALL')" class="px-3 py-1 rounded-full text-xs cursor-pointer whitespace-nowrap transition-colors" [ngClass]="statusFilter() === 'ALL' ? 'bg-blue-container text-primary font-semibold' : 'bg-surface-container-soft text-ink-secondary hover:bg-surface-container'">
                    All ({{ brands().length }})
                  </button>
                  <button (click)="statusFilter.set('ACTIVE')" class="px-3 py-1 rounded-full text-xs cursor-pointer whitespace-nowrap transition-colors" [ngClass]="statusFilter() === 'ACTIVE' ? 'bg-blue-container text-primary font-semibold' : 'bg-surface-container-soft text-ink-secondary hover:bg-surface-container'">
                    Active ({{ activeCount() }})
                  </button>
                  <button (click)="statusFilter.set('DRAFT')" class="px-3 py-1 rounded-full text-xs cursor-pointer whitespace-nowrap transition-colors" [ngClass]="statusFilter() === 'DRAFT' ? 'bg-blue-container text-primary font-semibold' : 'bg-surface-container-soft text-ink-secondary hover:bg-surface-container'">
                    Drafts ({{ draftCount() }})
                  </button>
                </div>
              </div>

              @if (filteredBrands().length === 0) {
                <div class="p-6 rounded-[24px] bg-surface-container-lowest border border-dashed border-outline-variant text-center flex flex-col items-center">
                  <svg class="w-8 h-8 text-ink-secondary/60 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="4" y="5" width="16" height="14" rx="3"/>
                    <path d="M8 10h8M8 14h5"/>
                  </svg>
                  <h3 class="font-headline text-sm font-bold text-ink-primary">No Brands Enrolled Yet</h3>
                  <p class="text-xs text-ink-secondary mt-1">Use the Brand Provisioning Form to onboard a brand workspace.</p>
                </div>
              } @else {
                <div class="flex flex-col gap-2 lg:max-h-[305px] lg:overflow-y-auto p-1 -m-1">
                  @for (b of filteredBrands(); track b.id) {
                    <div
                      (click)="openBrand(b.id)"
                      class="group flex items-center justify-between p-3.5 rounded-2xl bg-surface-container-lowest hover:bg-surface-warm/60 transition-colors shadow-xs border border-surface-container-high/50 outline-none focus:outline-none cursor-pointer">
                      <div class="flex items-center gap-3 min-w-0">
                        <div class="w-10 h-10 rounded-2xl bg-blue-container text-primary font-headline flex items-center justify-center font-bold shrink-0">
                          {{ b.name.charAt(0).toUpperCase() }}
                        </div>
                        <div class="min-w-0">
                          <div class="flex items-center gap-1.5">
                            <h3 class="font-headline text-sm font-bold text-ink-primary truncate group-hover:text-primary transition-colors">{{ b.name }}</h3>
                            @if (b.status === 'ACTIVE') {
                              <svg class="w-3.5 h-3.5 text-primary shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2l2.4 2.4 3.4-.3 1 3.3 2.8 1.9-1.1 3.2 1.1 3.2-2.8 1.9-1 3.3-3.4-.3L12 22l-2.4-2.4-3.4.3-1-3.3-2.8-1.9 1.1-3.2-1.1-3.2 2.8-1.9 1-3.3 3.4.3L12 2z"/>
                              </svg>
                            }
                          </div>
                          <p class="text-xs text-ink-secondary truncate">{{ b.managerName }} • {{ b.managerEmail }}</p>
                        </div>
                      </div>
                      <div class="flex items-center gap-1.5 shrink-0 ml-2">
                        <span
                          class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                          [ngClass]="b.status === 'ACTIVE' ? 'bg-mint-container text-ink-primary' : (b.status === 'DRAFT' ? 'bg-blue-container text-primary' : 'bg-marigold-container text-tertiary')">
                          <span class="w-1.5 h-1.5 rounded-full" [ngClass]="b.status === 'ACTIVE' ? 'bg-mint-green' : (b.status === 'DRAFT' ? 'bg-primary' : 'bg-tertiary-fixed-dim')"></span>
                          {{ b.status }}
                        </span>
                        <button
                          type="button"
                          (click)="$event.stopPropagation(); brandToDelete.set(b)"
                          [attr.aria-label]="'Delete brand ' + b.name"
                          title="Delete brand"
                          class="w-7 h-7 rounded-full flex items-center justify-center text-ink-secondary/70 hover:text-secondary hover:bg-coral-container/40 active:scale-90 transition-all cursor-pointer">
                          <!-- Monoline Trash Doodle -->
                          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M4.5 7h15"/>
                            <path d="M9.5 4.5h5a1 1 0 0 1 1 1V7h-7V5.5a1 1 0 0 1 1-1z"/>
                            <path d="M6.5 7l1 12a2 2 0 0 0 2 1.8h5a2 2 0 0 0 2-1.8l1-12"/>
                            <path d="M10 11v5M14 11v5"/>
                          </svg>
                        </button>
                        <svg class="w-4 h-4 text-ink-secondary group-hover:translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M9 6l6 6-6 6"/>
                        </svg>
                      </div>
                    </div>
                  }
                </div>
              }
            </section>
          </div>
        </div>
      </main>

      <!-- Delete Brand Confirmation Modal -->
      <app-confirm-modal
        [open]="!!brandToDelete()"
        [title]="'Delete ' + (brandToDelete()?.name || 'brand') + '?'"
        [message]="'This permanently deletes the brand workspace (' + (brandToDelete()?.code || '') + ') along with its linked agencies, creators, and audit logs.'"
        confirmLabel="Delete Brand"
        busyLabel="Deleting..."
        tone="danger"
        [busy]="deleting()"
        (confirm)="brandToDelete() && executeDeleteBrand(brandToDelete()!)"
        (cancel)="!deleting() && brandToDelete.set(null)">
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
export class AdminOnboardingComponent implements OnInit {
  readonly countries = COUNTRY_CODES;

  brands = signal<Brand[]>([]);
  statusFilter = signal<string>('ALL');
  searchSignal = signal<string>('');
  searchQuery = '';

  brandName = signal('');
  managerName = signal('');
  managerEmail = signal('');
  countryIso = signal('IN');
  phoneLocal = signal('');
  instagramHandle = signal('');

  brandTouched = signal(false);
  managerNameTouched = signal(false);
  emailTouched = signal(false);
  phoneTouched = signal(false);
  igTouched = signal(false);

  private managerNameManual = false;
  matchedUser = signal<any | null>(null);
  submitting = signal(false);
  deleting = signal(false);
  shakeForm = signal(false);
  banner = signal<{ type: 'error' | 'success'; text: string } | null>(null);
  provisionedBrand = signal<Brand | null>(null);
  brandToDelete = signal<Brand | null>(null);
  showSignOutConfirm = signal(false);

  private currentAdminEmail = computed(() => (this.auth.currentUser()?.email || '').trim().toLowerCase());

  selectedCountry = computed(
    () => this.countries.find(c => c.iso === this.countryIso()) || this.countries[0]
  );

  brandError = computed(() => {
    const v = this.brandName().trim();
    if (!v) return 'Required';
    if (v.length < 2) return 'Min 2 chars';
    return '';
  });
  brandValid = computed(() => this.brandName().trim().length >= 2);

  managerNameError = computed(() => {
    const v = this.managerName().trim();
    if (!v) return 'Required';
    if (v.length < 2) return 'Min 2 chars';
    return '';
  });
  managerNameValid = computed(() => this.managerName().trim().length >= 2);

  emailIsAdmin = computed(() => {
    const v = this.managerEmail().trim().toLowerCase();
    return (!!this.currentAdminEmail() && v === this.currentAdminEmail()) || this.matchedUser()?.role === 'SYSTEM_ADMIN';
  });

  emailError = computed(() => {
    const v = this.managerEmail().trim();
    if (!v) return 'Required';
    if (!EMAIL_REGEX.test(v)) return 'Invalid email';
    if (this.emailIsAdmin()) return 'Admin email not allowed';
    return '';
  });
  emailValid = computed(() => {
    const v = this.managerEmail().trim();
    return EMAIL_REGEX.test(v) && !this.emailError();
  });

  phoneError = computed(() => {
    const raw = this.phoneLocal().trim();
    if (!raw) return 'Required';
    if (!/^[0-9\s\-()]+$/.test(raw)) return 'Digits only';
    const digits = raw.replace(/\D/g, '');
    const c = this.selectedCountry();
    if (c.minDigits === c.maxDigits && digits.length !== c.minDigits) {
      return `Enter ${c.minDigits} digits`;
    }
    if (digits.length < c.minDigits || digits.length > c.maxDigits) {
      return `${c.minDigits}–${c.maxDigits} digits`;
    }
    return '';
  });
  phoneValid = computed(() => this.phoneLocal().trim().length > 0 && !this.phoneError());

  igError = computed(() => {
    const v = this.instagramHandle().trim();
    if (!v) return '';
    if (!IG_REGEX.test(v)) return 'Invalid handle';
    return '';
  });
  igValid = computed(() => {
    const v = this.instagramHandle().trim();
    return v.length > 0 && IG_REGEX.test(v);
  });

  activeCount = computed(() => this.brands().filter(b => b.status === 'ACTIVE').length);
  draftCount = computed(() => this.brands().filter(b => b.status === 'DRAFT').length);
  filteredBrands = computed(() => {
    const q = this.searchSignal().toLowerCase();
    const s = this.statusFilter();
    return this.brands().filter(b => {
      const matchStatus = s === 'ALL' || b.status === s;
      const matchQuery = !q || b.name.toLowerCase().includes(q) || (b.managerName || '').toLowerCase().includes(q) || (b.managerEmail || '').toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  });

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadBrands();
  }

  loadBrands() {
    this.api.listBrands().subscribe({
      next: (data) => this.brands.set(data),
      error: () => {}
    });
  }

  onSimpleChange(target: { set: (val: string) => void }, val: string) {
    target.set(val);
    if (this.banner()?.type === 'error') {
      this.banner.set(null);
    }
  }

  onManagerNameInput(val: string) {
    this.managerNameManual = val.trim().length > 0;
    this.managerName.set(val);
    if (this.banner()?.type === 'error') {
      this.banner.set(null);
    }
  }

  onCountryChange(iso: string) {
    this.countryIso.set(iso);
    if (this.phoneLocal().trim()) {
      this.phoneTouched.set(true);
    }
  }

  onManagerEmailChange(email: string) {
    this.managerEmail.set(email);
    if (this.banner()?.type === 'error') {
      this.banner.set(null);
    }
    const clean = email.trim();
    if (!clean || clean.length < 3 || this.emailIsAdmin()) {
      this.matchedUser.set(null);
      return;
    }
    this.api.searchUsersByEmail(clean).subscribe({
      next: (users) => {
        const found = users.length > 0 ? users[0] : null;
        this.matchedUser.set(found);
        if (found && (!this.managerName().trim() || !this.managerNameManual)) {
          this.managerName.set(found.name);
        }
      },
      error: () => this.matchedUser.set(null)
    });
  }

  private triggerShake() {
    this.shakeForm.set(false);
    setTimeout(() => this.shakeForm.set(true), 10);
    setTimeout(() => this.shakeForm.set(false), 400);
  }

  submitBrand(status: 'ACTIVE' | 'DRAFT') {
    this.banner.set(null);
    this.brandTouched.set(true);
    this.managerNameTouched.set(true);
    this.emailTouched.set(true);
    this.igTouched.set(true);

    if (status === 'ACTIVE') {
      this.phoneTouched.set(true);
    }

    const phoneInvalid = (status === 'ACTIVE' && !!this.phoneError()) || (this.phoneLocal().trim().length > 0 && !!this.phoneError());
    if (this.brandError() || this.managerNameError() || this.emailError() || phoneInvalid || this.igError()) {
      this.triggerShake();
      this.banner.set({
        type: 'error',
        text: this.emailIsAdmin()
          ? 'System Admin email cannot be assigned as a Brand Manager.'
          : 'Please fix the highlighted fields before continuing.'
      });
      return;
    }

    const rawPhone = this.phoneLocal().trim();
    const formattedPhone = rawPhone ? `${this.selectedCountry().dial} ${rawPhone}` : '';

    this.submitting.set(true);
    this.api.provisionBrand({
      name: this.brandName().trim(),
      managerName: this.managerName().trim(),
      managerEmail: this.managerEmail().trim(),
      contactNumber: formattedPhone,
      instagramHandle: this.instagramHandle().trim(),
      status
    }).subscribe({
      next: (created) => {
        this.submitting.set(false);
        this.provisionedBrand.set(created);
        this.brandName.set('');
        this.managerName.set('');
        this.managerEmail.set('');
        this.phoneLocal.set('');
        this.instagramHandle.set('');
        this.managerNameManual = false;
        this.brandTouched.set(false);
        this.managerNameTouched.set(false);
        this.emailTouched.set(false);
        this.phoneTouched.set(false);
        this.igTouched.set(false);
        this.matchedUser.set(null);
        this.loadBrands();
      },
      error: (err) => {
        this.submitting.set(false);
        this.triggerShake();
        this.banner.set({ type: 'error', text: err?.error?.error || 'Failed to provision brand.' });
      }
    });
  }

  executeDeleteBrand(brand: Brand) {
    this.deleting.set(true);
    this.api.deleteBrand(brand.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.brandToDelete.set(null);
        this.banner.set({ type: 'success', text: `Deleted "${brand.name}" and its workspace records.` });
        this.loadBrands();
      },
      error: (err) => {
        this.deleting.set(false);
        this.brandToDelete.set(null);
        this.banner.set({ type: 'error', text: err?.error?.error || 'Failed to delete brand.' });
      }
    });
  }

  openBrand(id: string) {
    this.router.navigate(['/admin/brands', id]);
  }

  logout() {
    this.auth.logout();
    this.router.navigateByUrl('/auth');
  }
}
