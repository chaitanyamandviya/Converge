import { Component, OnInit, NgZone, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AppHeaderComponent } from '../components/app-header.component';
import { AppFooterComponent } from '../components/app-footer.component';
import { ThemeToggleComponent } from '../components/theme-toggle.component';

declare const google: any;

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppHeaderComponent, AppFooterComponent, ThemeToggleComponent],
  template: `
    <div class="bg-cv-canvas font-body text-cv-ink min-h-screen flex flex-col selection:bg-[#f54e26]/25 selection:text-cv-ink overflow-x-clip">
      <!-- Slim Minimal Header matching Landing Page -->
      <app-header [elevated]="true">
        <div header-right class="flex items-center gap-3 sm:gap-5">
          <app-theme-toggle />
          <a routerLink="/" class="text-sm text-cv-ink-muted hover:text-cv-ink transition-colors inline-flex items-center gap-1.5 group">
            <span class="transition-transform duration-200 group-hover:-translate-x-0.5">←</span>
            <span>Back to home</span>
          </a>
        </div>
      </app-header>

      <!-- Editorial Neo-Brutalist Auth Stage -->
      <main class="w-full flex-1 bg-cv-canvas relative flex items-center justify-center px-4 sm:px-6 lg:px-10 py-3 sm:py-4 lg:py-3.5">
        <div class="w-full max-w-[1320px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center my-auto">

          <!-- Left Column: Condensed Color-Blocked Statement + VSK Stickers (Desktop) -->
          <div class="hidden lg:flex lg:col-span-6 flex-col items-start justify-center lg:pr-6 animate-fade-in-up">
            <!-- Sticker Trio Lockup -->
            <div class="flex items-center mb-5 select-none">
              <div class="px-2.5 py-1 bg-[#5738af] text-[#fff6e8] font-headline uppercase font-bold text-lg tracking-[0.02em] -rotate-12 -mr-1.5 z-10 shadow-md">
                {{ mode() === 'signin' ? 'HEY!' : 'NEW!' }}
              </div>
              <div class="w-12 h-12 rounded-xl bg-[#111111] border border-cv-border flex items-center justify-center p-1.5 shadow-lg">
                <img src="/converge-logo.svg" alt="Converge" class="w-full h-full object-contain"/>
              </div>
              <div class="w-9 h-9 rounded-full bg-[#007656] border-2 border-cv-canvas flex items-center justify-center -ml-2 -mt-6 shadow-md">
                <div class="flex items-center gap-1">
                  <span class="w-2 h-2.5 rounded-full bg-[#fff6e8] flex items-center justify-end pr-0.5"><span class="w-1 h-1 rounded-full bg-[#111111]"></span></span>
                  <span class="w-2 h-2.5 rounded-full bg-[#fff6e8] flex items-center justify-end pr-0.5"><span class="w-1 h-1 rounded-full bg-[#111111]"></span></span>
                </div>
              </div>
            </div>

            <!-- Color-Blocked Condensed Headline -->
            @if (mode() === 'signin') {
              <h1 class="font-headline uppercase font-bold text-[3.2rem] xl:text-[4.1rem] leading-[0.96] tracking-[0.01em] text-cv-ink">
                OPEN YOUR<br/>
                <span class="text-cv-gold">CAMPAIGNS,</span><br/>
                CHECK LIVE <span class="text-cv-blush">REELS,</span><br/>
                <span class="text-[#f54e26]">SKIP THE DMS.</span>
              </h1>
            } @else {
              <h1 class="font-headline uppercase font-bold text-[3.2rem] xl:text-[4.1rem] leading-[0.96] tracking-[0.01em] text-cv-ink">
                TRACK EVERY<br/>
                <span class="text-cv-gold">PUBLIC REEL,</span><br/>
                ZERO CREATOR <span class="text-[#007656]">PASSWORDS,</span><br/>
                <span class="text-[#f54e26]">START IN 60S.</span>
              </h1>
            }

            <p class="text-sm xl:text-base text-cv-ink-muted mt-4 leading-relaxed max-w-md">
              {{ mode() === 'signin'
                ? 'Open your brand workspaces to see real Reel views, likes, comments, and clean campaign spreadsheets in one place.'
                : 'Set up your workspace in under a minute. Paste any public Instagram Reel link and get real post numbers without chasing screenshots.' }}
            </p>

            <!-- VSK Tag Strip -->
            <div class="mt-5 flex flex-wrap items-center gap-2 select-none">
              <span class="px-3 py-1 rounded-[4px] bg-[#5738af] text-[#fff6e8] text-xs font-semibold">
                No Passwords
              </span>
              <span class="px-3 py-1 rounded-[4px] bg-cv-card-soft border border-cv-border text-cv-ink-soft text-xs font-medium">
                Live Reel Numbers
              </span>
              <span class="px-3 py-1 rounded-[4px] bg-cv-card-soft border border-cv-border text-cv-ink-soft text-xs font-medium">
                1-Click CSV Export
              </span>
            </div>

            <!-- Mini Tilted Sticker Callout -->
            <div class="mt-5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#fff6e8] border-2 border-[#111111] shadow-[4px_4px_0px_#f54e26] -rotate-1 select-none">
              <span class="font-headline uppercase font-bold text-base tracking-[0.02em] text-[#111111]">
                0 DMS ◆ 100% REAL POST NUMBERS
              </span>
            </div>
          </div>

          <!-- Right Column: Brutalist Editorial Auth Card -->
          <div class="lg:col-span-6 w-full flex flex-col items-center lg:items-end animate-fade-in-up">
            <!-- Mobile / Tablet Condensed Title -->
            <div class="lg:hidden text-center mb-4">
              <h1 class="font-headline uppercase text-4xl font-bold text-cv-ink tracking-[0.015em] leading-none">
                {{ mode() === 'signin' ? 'WELCOME BACK.' : 'START FREE.' }}
              </h1>
              <p class="text-xs text-cv-ink-muted mt-1.5">
                {{ mode() === 'signin' ? 'Sign in to open your workspace.' : 'Create your Converge workspace in seconds.' }}
              </p>
            </div>

            <div
              class="w-full max-w-[460px] xl:max-w-[488px] bg-cv-card rounded-[8px] p-4 sm:p-5 border border-cv-border-strong shadow-[6px_6px_0px_#f54e26] transition-all duration-300"
              [class.animate-shake]="shakeForm()">

              <!-- Hairline Mode Switcher (Sign In / Create Account) -->
              <div class="w-full grid grid-cols-2 gap-1 p-1 rounded-[4px] bg-cv-well border border-cv-border mb-3.5 select-none" role="tablist">
                <button
                  type="button"
                  role="tab"
                  [attr.aria-selected]="mode() === 'signin'"
                  (click)="switchMode('signin')"
                  class="py-2 text-center rounded-[3px] font-headline uppercase text-lg tracking-[0.03em] font-bold transition-colors duration-150 cursor-pointer"
                  [ngClass]="mode() === 'signin' ? 'bg-cv-ink text-cv-ink-inverse' : 'text-cv-ink-muted hover:text-cv-ink'">
                  SIGN IN
                </button>
                <button
                  type="button"
                  role="tab"
                  [attr.aria-selected]="mode() === 'signup'"
                  (click)="switchMode('signup')"
                  class="py-2 text-center rounded-[3px] font-headline uppercase text-lg tracking-[0.03em] font-bold transition-colors duration-150 cursor-pointer"
                  [ngClass]="mode() === 'signup' ? 'bg-cv-ink text-cv-ink-inverse' : 'text-cv-ink-muted hover:text-cv-ink'">
                  CREATE ACCOUNT
                </button>
              </div>

              @if (!successState()) {
                <!-- Google SSO Button -->
                <button
                  type="button"
                  (click)="handleGoogle()"
                  [disabled]="loading() || googleLoading()"
                  class="w-full h-10 px-4 rounded-[4px] bg-cv-control hover:bg-cv-control-hover active:scale-[0.99] text-cv-ink text-sm font-medium flex items-center justify-center gap-2.5 border border-cv-border hover:border-cv-border-bright focus-visible:outline-none focus-visible:border-[#f54e26] transition-all duration-150 cursor-pointer disabled:opacity-60">
                  @if (googleLoading()) {
                    <svg class="w-4 h-4 animate-spin text-[#f54e26] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                      <path d="M12 3a9 9 0 1 0 9 9"/>
                    </svg>
                    <span>Connecting to Google...</span>
                  } @else {
                    <svg aria-hidden="true" class="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" fill="#4285F4"></path>
                      <path d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z" fill="#34A853"></path>
                      <path d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.15z" fill="#FBBC05"></path>
                      <path d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" fill="#EA4335"></path>
                    </svg>
                    <span>Continue with Google</span>
                  }
                </button>

                <!-- Hairline Divider -->
                <div class="relative my-3 flex items-center justify-center">
                  <div class="absolute inset-0 flex items-center"><div class="w-full bg-cv-border-soft h-[1px]"></div></div>
                  <span class="relative px-3 bg-cv-card text-xs text-cv-ink-muted">or with email</span>
                </div>

                <!-- Alert Banner -->
                @if (banner(); as msg) {
                  <div
                    class="mb-2.5 px-3 py-2 rounded-[4px] border text-xs font-medium flex items-center justify-between gap-2 animate-pop-in"
                    [ngClass]="msg.type === 'error'
                      ? 'bg-cv-danger-bg border-[#ff5c5c]/40 text-cv-danger-ink'
                      : 'bg-cv-success-bg border-[#007656] text-cv-success-ink'">
                    <div class="flex items-center gap-2 min-w-0">
                      @if (msg.type === 'error') {
                        <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="9"/>
                          <path d="M12 8v4"/>
                          <circle cx="12" cy="16" r="0.6" fill="currentColor"/>
                        </svg>
                      } @else {
                        <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9z"/>
                          <path d="M5 7l7 5 7-5"/>
                        </svg>
                      }
                      <span class="leading-snug">{{ msg.text }}</span>
                    </div>
                    <button type="button" (click)="banner.set(null)" aria-label="Dismiss message" class="shrink-0 opacity-70 hover:opacity-100 p-0.5 cursor-pointer">
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <path d="M6 6l12 12M18 6L6 18"/>
                      </svg>
                    </button>
                  </div>
                }

                <!-- Sharp Editorial Form -->
                <form (ngSubmit)="submit()" novalidate class="space-y-2.5">
                  @if (mode() === 'signup') {
                    <div>
                      <div class="flex items-center justify-between mb-1">
                        <label for="auth-name" class="text-xs font-medium text-cv-ink">Full name</label>
                        @if (nameTouched() && nameError()) {
                          <span class="text-xs text-cv-red-soft font-medium">{{ nameError() }}</span>
                        }
                      </div>
                      <div
                        class="group flex items-center gap-2.5 h-10 px-3 rounded-[4px] bg-cv-well border transition-colors duration-150"
                        [ngClass]="nameTouched() && nameError()
                          ? 'border-[#ff5c5c]'
                          : (nameValid() ? 'border-[#007656] focus-within:border-[#f54e26]' : 'border-cv-border focus-within:border-[#f54e26]')">
                        <svg class="doodle-svg w-4 h-4 shrink-0"
                             [ngClass]="nameTouched() && nameError() ? 'text-[#ff5c5c]' : 'text-cv-ink-muted group-focus-within:text-[#f54e26]'"
                             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="8" r="3.8"/>
                          <path d="M5.5 19.5c1-3.4 3.5-5 6.5-5s5.5 1.6 6.5 5"/>
                        </svg>
                        <input
                          id="auth-name"
                          [ngModel]="name()"
                          (ngModelChange)="onFieldChange(name, $event)"
                          (blur)="nameTouched.set(true)"
                          name="name"
                          autocomplete="name"
                          placeholder="Alex Morgan"
                          type="text"
                          class="flex-1 min-w-0 bg-transparent text-cv-ink placeholder:text-cv-ink-subtle text-sm outline-none"/>
                        @if (nameValid()) {
                          <svg class="w-4 h-4 text-cv-green shrink-0 animate-pop-in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="9" class="opacity-25" fill="currentColor"/>
                            <path d="M8 12.5l2.7 2.7 5.5-6" class="doodle-check-path"/>
                          </svg>
                        }
                      </div>
                    </div>
                  }

                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label for="auth-email" class="text-xs font-medium text-cv-ink">Email address</label>
                      @if (emailTouched() && emailError()) {
                        <span class="text-xs text-cv-red-soft font-medium">{{ emailError() }}</span>
                      }
                    </div>
                    <div
                      class="group flex items-center gap-2.5 h-10 px-3 rounded-[4px] bg-cv-well border transition-colors duration-150"
                      [ngClass]="emailTouched() && emailError()
                        ? 'border-[#ff5c5c]'
                        : (emailValid() ? 'border-[#007656] focus-within:border-[#f54e26]' : 'border-cv-border focus-within:border-[#f54e26]')">
                      <svg class="doodle-svg w-4 h-4 shrink-0"
                           [ngClass]="emailTouched() && emailError() ? 'text-[#ff5c5c]' : 'text-cv-ink-muted group-focus-within:text-[#f54e26]'"
                           viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/>
                        <path d="M5 7.5l7 5.2 7-5.2"/>
                      </svg>
                      <input
                        id="auth-email"
                        [ngModel]="email()"
                        (ngModelChange)="onFieldChange(email, $event)"
                        (blur)="emailTouched.set(true)"
                        name="email"
                        autocomplete="email"
                        placeholder="name@company.com"
                        type="email"
                        class="flex-1 min-w-0 bg-transparent text-cv-ink placeholder:text-cv-ink-subtle text-sm outline-none"/>
                      @if (emailValid()) {
                        <svg class="w-4 h-4 text-cv-green shrink-0 animate-pop-in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="9" class="opacity-25" fill="currentColor"/>
                          <path d="M8 12.5l2.7 2.7 5.5-6" class="doodle-check-path"/>
                        </svg>
                      }
                    </div>
                  </div>

                  <!-- Password Field -->
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label for="auth-password" class="text-xs font-medium text-cv-ink">{{ mode() === 'signup' ? 'Create password' : 'Password' }}</label>
                      @if (passwordTouched() && passwordError()) {
                        <span class="text-xs text-cv-red-soft font-medium">{{ passwordError() }}</span>
                      } @else if (mode() === 'signup' && password().length > 0) {
                        <div class="flex items-center gap-1.5">
                          <div class="flex items-center gap-0.5">
                            <span class="w-3 h-1 rounded-xs transition-colors duration-200" [ngClass]="passwordStrength().score >= 1 ? passwordStrength().color : 'bg-cv-border-strong'"></span>
                            <span class="w-3 h-1 rounded-xs transition-colors duration-200" [ngClass]="passwordStrength().score >= 2 ? passwordStrength().color : 'bg-cv-border-strong'"></span>
                            <span class="w-3 h-1 rounded-xs transition-colors duration-200" [ngClass]="passwordStrength().score >= 3 ? passwordStrength().color : 'bg-cv-border-strong'"></span>
                            <span class="w-3 h-1 rounded-xs transition-colors duration-200" [ngClass]="passwordStrength().score >= 4 ? passwordStrength().color : 'bg-cv-border-strong'"></span>
                          </div>
                          <span class="text-[11px] font-semibold" [ngClass]="passwordStrength().textColor">{{ passwordStrength().label }}</span>
                        </div>
                      } @else if (mode() === 'signin') {
                        <button type="button" (click)="handleForgot()" class="text-xs font-medium text-cv-blush hover:text-[#f54e26] transition-colors cursor-pointer">Forgot password?</button>
                      }
                    </div>
                    <div
                      class="group flex items-center gap-2.5 h-10 px-3 rounded-[4px] bg-cv-well border transition-colors duration-150"
                      [ngClass]="passwordTouched() && passwordError()
                        ? 'border-[#ff5c5c]'
                        : 'border-cv-border focus-within:border-[#f54e26]'">
                      <svg class="doodle-svg w-4 h-4 shrink-0"
                           [ngClass]="passwordTouched() && passwordError() ? 'text-[#ff5c5c]' : 'text-cv-ink-muted group-focus-within:text-[#f54e26]'"
                           viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                        <path class="doodle-shackle" [class.doodle-shackle-open]="showPass()" d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7"/>
                        <rect x="5.5" y="10.5" width="13" height="9.5" rx="2.5"/>
                        <circle cx="12" cy="15.2" r="1.2" fill="currentColor"/>
                      </svg>
                      <input
                        id="auth-password"
                        [ngModel]="password()"
                        (ngModelChange)="onFieldChange(password, $event)"
                        (blur)="passwordTouched.set(true)"
                        name="password"
                        [autocomplete]="mode() === 'signup' ? 'new-password' : 'current-password'"
                        [placeholder]="mode() === 'signup' ? 'At least 8 characters' : 'Enter your password'"
                        [type]="showPass() ? 'text' : 'password'"
                        class="flex-1 min-w-0 bg-transparent text-cv-ink placeholder:text-cv-ink-subtle text-sm outline-none"/>
                      <button
                        type="button"
                        (click)="showPass.set(!showPass())"
                        aria-label="Toggle password visibility"
                        class="shrink-0 w-7 h-7 rounded-[4px] hover:bg-cv-hover-pill flex items-center justify-center text-cv-ink-muted hover:text-cv-ink transition-colors cursor-pointer">
                        @if (showPass()) {
                          <svg class="w-4 h-4 doodle-eye-lid animate-pop-in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6z"/>
                            <circle cx="12" cy="12" r="2.6" fill="currentColor" class="opacity-85"/>
                            <circle cx="12.9" cy="11.1" r="0.8" fill="var(--cv-well)" stroke="none"/>
                          </svg>
                        } @else {
                          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3.5 11.5c2.2 3 5 4.2 8.5 4.2s6.3-1.2 8.5-4.2"/>
                            <path d="M7 14.5l-1.3 2.3"/>
                            <path d="M12 15.8v2.6"/>
                            <path d="M17 14.5l1.3 2.3"/>
                          </svg>
                        }
                      </button>
                    </div>
                  </div>

                  <!-- Confirm Password -->
                  @if (mode() === 'signup') {
                    <div>
                      <div class="flex items-center justify-between mb-1">
                        <label for="auth-confirm" class="text-xs font-medium text-cv-ink">Confirm password</label>
                        @if (confirmTouched() && confirmError()) {
                          <span class="text-xs text-cv-red-soft font-medium">{{ confirmError() }}</span>
                        }
                      </div>
                      <div
                        class="group flex items-center gap-2.5 h-10 px-3 rounded-[4px] bg-cv-well border transition-colors duration-150"
                        [ngClass]="confirmTouched() && confirmError()
                          ? 'border-[#ff5c5c]'
                          : (confirmValid() ? 'border-[#007656] focus-within:border-[#f54e26]' : 'border-cv-border focus-within:border-[#f54e26]')">
                        <svg class="doodle-svg w-4 h-4 shrink-0"
                             [ngClass]="confirmTouched() && confirmError() ? 'text-[#ff5c5c]' : (confirmValid() ? 'text-cv-green' : 'text-cv-ink-muted group-focus-within:text-[#f54e26]')"
                             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M12 3.5l7 2.8v5.2c0 4.6-3 8.1-7 9.5-4-1.4-7-4.9-7-9.5V6.3l7-2.8z"/>
                          @if (confirmValid()) {
                            <path d="M9 12.2l2 2 4.2-4.2" class="doodle-check-path"/>
                          }
                        </svg>
                        <input
                          id="auth-confirm"
                          [ngModel]="confirmPassword()"
                          (ngModelChange)="onFieldChange(confirmPassword, $event)"
                          (blur)="confirmTouched.set(true)"
                          name="confirmPassword"
                          autocomplete="new-password"
                          placeholder="Re-enter password"
                          [type]="showConfirm() ? 'text' : 'password'"
                          class="flex-1 min-w-0 bg-transparent text-cv-ink placeholder:text-cv-ink-subtle text-sm outline-none"/>
                        <button
                          type="button"
                          (click)="showConfirm.set(!showConfirm())"
                          aria-label="Toggle confirm password visibility"
                          class="shrink-0 w-7 h-7 rounded-[4px] hover:bg-cv-hover-pill flex items-center justify-center text-cv-ink-muted hover:text-cv-ink transition-colors cursor-pointer">
                          @if (showConfirm()) {
                            <svg class="w-4 h-4 doodle-eye-lid animate-pop-in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6z"/>
                              <circle cx="12" cy="12" r="2.6" fill="currentColor" class="opacity-85"/>
                              <circle cx="12.9" cy="11.1" r="0.8" fill="var(--cv-well)" stroke="none"/>
                            </svg>
                          } @else {
                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M3.5 11.5c2.2 3 5 4.2 8.5 4.2s6.3-1.2 8.5-4.2"/>
                              <path d="M7 14.5l-1.3 2.3"/>
                              <path d="M12 15.8v2.6"/>
                              <path d="M17 14.5l1.3 2.3"/>
                            </svg>
                          }
                        </button>
                      </div>
                    </div>
                  }

                  <!-- Editorial Submit Button -->
                  <button
                    type="submit"
                    [disabled]="loading()"
                    class="w-full h-11 mt-2 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] active:scale-[0.99] text-[#111111] font-headline uppercase tracking-[0.03em] text-xl font-bold flex items-center justify-center gap-2 transition-colors duration-150 group cursor-pointer disabled:opacity-60">
                    @if (loading()) {
                      <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                        <path d="M12 3a9 9 0 1 0 9 9"/>
                      </svg>
                      <span>{{ mode() === 'signin' ? 'SIGNING IN...' : 'CREATING ACCOUNT...' }}</span>
                    } @else {
                      <span>{{ mode() === 'signin' ? 'SIGN IN ↗' : 'CREATE ACCOUNT ↗' }}</span>
                    }
                  </button>
                </form>
              } @else {
                <!-- Account Created View -->
                <div class="py-6 text-center flex flex-col items-center animate-pop-in">
                  <div class="w-12 h-12 rounded-xl bg-[#007656] text-[#fff6e8] flex items-center justify-center mb-3">
                    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                  </div>
                  <h2 class="font-headline uppercase text-3xl font-bold text-cv-ink tracking-[0.02em]">{{ successTitle() }}</h2>
                  <p class="text-sm text-cv-ink-muted mt-2 max-w-xs">{{ successSub() }}</p>
                  <button
                    type="button"
                    (click)="proceedAfterAuth()"
                    class="mt-5 h-11 px-7 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase tracking-[0.03em] text-xl font-bold transition-colors cursor-pointer">
                    {{ targetRoute() === '/admin' ? 'OPEN ADMIN CONSOLE ↗' : 'OPEN WORKSPACE ↗' }}
                  </button>
                </div>
              }

              <!-- Legal Line inside Card Footer -->
              <p class="mt-3 text-center text-xs text-cv-ink-muted">
                By continuing, you agree to our
                <a routerLink="/legal" [queryParams]="{tab: 'terms'}" class="underline text-cv-ink hover:text-[#f54e26] transition-colors">Terms</a> &amp;
                <a routerLink="/legal" [queryParams]="{tab: 'privacy'}" class="underline text-cv-ink hover:text-[#f54e26] transition-colors">Privacy Policy</a>.
              </p>
            </div>
          </div>
        </div>
      </main>

      <app-footer></app-footer>
    </div>
  `
})
export class AuthComponent implements OnInit {
  mode = signal<'signin' | 'signup'>('signin');
  showPass = signal(false);
  showConfirm = signal(false);
  loading = signal(false);
  googleLoading = signal(false);
  shakeForm = signal(false);
  banner = signal<{ type: 'error' | 'success'; text: string } | null>(null);
  successState = signal(false);
  successTitle = signal('');
  successSub = signal('');
  targetRoute = signal('/workspace');

  private googleClientId = '';
  private tokenClient: any = null;
  private googleTimer: any = null;
  private inviteToken = '';

  name = signal('');
  email = signal('');
  password = signal('');
  confirmPassword = signal('');

  nameTouched = signal(false);
  emailTouched = signal(false);
  passwordTouched = signal(false);
  confirmTouched = signal(false);

  nameError = computed(() => {
    const v = this.name().trim();
    if (!v) return 'Required';
    if (v.length < 2) return 'Min 2 chars';
    return '';
  });
  nameValid = computed(() => this.name().trim().length >= 2);

  emailError = computed(() => {
    const v = this.email().trim();
    if (!v) return 'Required';
    if (!EMAIL_REGEX.test(v)) return 'Invalid email';
    return '';
  });
  emailValid = computed(() => EMAIL_REGEX.test(this.email().trim()));

  passwordError = computed(() => {
    const v = this.password();
    if (!v) return 'Required';
    const min = this.mode() === 'signup' ? 8 : 6;
    if (v.length < min) return `Min ${min} chars`;
    return '';
  });

  confirmError = computed(() => {
    if (this.mode() !== 'signup') return '';
    if (!this.confirmPassword()) return 'Required';
    if (this.confirmPassword() !== this.password()) return 'Mismatch';
    return '';
  });
  confirmValid = computed(() =>
    this.mode() === 'signup' && this.confirmPassword().length >= 8 && this.confirmPassword() === this.password()
  );

  passwordStrength = computed(() => {
    const p = this.password();
    let score = 0;
    if (p.length >= 6) score++;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
    if (/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p)) score++;

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-[#ff5c5c]', textColor: 'text-cv-red' };
    if (score === 2) return { score: 2, label: 'Fair', color: 'bg-[#fabf29]', textColor: 'text-cv-gold' };
    if (score === 3) return { score: 3, label: 'Good', color: 'bg-[#f54e26]', textColor: 'text-[#f54e26]' };
    return { score: 4, label: 'Strong', color: 'bg-[#4ade80]', textColor: 'text-cv-green' };
  });

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigateByUrl(this.authService.dashboardRoute(), { replaceUrl: true });
      return;
    }

    this.route.queryParams.subscribe(p => {
      const m = String(p['mode'] || '').trim().toLowerCase();
      if (m === 'signup' || m === 'register' || m === 'onboard') {
        this.switchMode('signup');
      } else if (m === 'signin' || m === 'login') {
        this.switchMode('signin');
      }
      if (p['email']) {
        this.email.set(String(p['email']).trim());
      }
      if (p['token'] || p['activationToken']) {
        this.inviteToken = String(p['token'] || p['activationToken']).trim();
      }
      if (p['reason'] === 'expired') {
        this.showError('Your session expired or was signed out. Please sign in again.');
      }
    });

    this.authService.getConfig().subscribe({
      next: (cfg) => {
        this.googleClientId = cfg.googleClientId;
        this.initGoogleTokenClient();
      },
      error: () => {}
    });
  }

  private initGoogleTokenClient(): boolean {
    if (!this.googleClientId || typeof google === 'undefined' || !google?.accounts?.oauth2) {
      return false;
    }
    if (!this.tokenClient) {
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: this.googleClientId,
        scope: 'openid email profile',
        callback: (resp: any) => {
          this.ngZone.run(() => {
            this.clearGoogleTimer();
            if (resp?.access_token) {
              this.submitGoogleAccessToken(resp.access_token);
            } else {
              this.googleLoading.set(false);
              this.showError(resp?.error_description || 'Google Sign-In did not complete. Please try again.');
            }
          });
        },
        error_callback: (err: any) => {
          this.ngZone.run(() => {
            this.clearGoogleTimer();
            this.googleLoading.set(false);
            if (err?.type === 'popup_closed') {
              return;
            }
            this.showError('Google Sign-In window could not open. Please allow popups or sign in with email below.');
          });
        }
      });
    }
    return true;
  }

  private clearGoogleTimer() {
    if (this.googleTimer) {
      clearTimeout(this.googleTimer);
      this.googleTimer = null;
    }
  }

  onFieldChange(targetSignal: { set: (val: string) => void }, value: string) {
    targetSignal.set(value);
    if (this.banner()) {
      this.banner.set(null);
    }
  }

  switchMode(newMode: 'signin' | 'signup') {
    this.mode.set(newMode);
    this.banner.set(null);
    this.successState.set(false);
    this.nameTouched.set(false);
    this.emailTouched.set(false);
    this.passwordTouched.set(false);
    this.confirmTouched.set(false);
  }

  private showError(text: string) {
    this.banner.set({ type: 'error', text });
  }

  private showSuccess(text: string) {
    this.banner.set({ type: 'success', text });
  }

  private triggerShake() {
    this.shakeForm.set(false);
    setTimeout(() => this.shakeForm.set(true), 10);
    setTimeout(() => this.shakeForm.set(false), 400);
  }

  submit() {
    this.banner.set(null);
    this.emailTouched.set(true);
    this.passwordTouched.set(true);

    if (this.mode() === 'signup') {
      this.nameTouched.set(true);
      this.confirmTouched.set(true);
      if (this.nameError() || this.emailError() || this.passwordError() || this.confirmError()) {
        this.triggerShake();
        return;
      }
    } else if (this.emailError() || this.passwordError()) {
      this.triggerShake();
      return;
    }

    this.loading.set(true);
    const obs = this.mode() === 'signup'
      ? this.authService.signup(this.name().trim(), this.email().trim(), this.password(), this.inviteToken)
      : this.authService.login(this.email().trim(), this.password());

    obs.subscribe({
      next: (res) => {
        this.loading.set(false);
        this.targetRoute.set(res.user.role === 'SYSTEM_ADMIN' ? '/admin' : '/workspace');
        if (this.mode() === 'signup') {
          this.successState.set(true);
          this.successTitle.set('ACCOUNT CREATED');
          this.successSub.set(`Welcome, ${res.user.name}. Your Converge workspace is ready.`);
        } else {
          this.router.navigateByUrl(this.targetRoute(), { replaceUrl: true });
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.triggerShake();
        this.showError(err?.error?.error || 'Sign-in failed. Please check your email and password.');
      }
    });
  }

  handleGoogle() {
    this.banner.set(null);
    if (!this.googleClientId) {
      this.googleLoading.set(true);
      this.authService.getConfig().subscribe({
        next: (cfg) => {
          this.googleClientId = (cfg?.googleClientId || '').trim();
          this.googleLoading.set(false);
          if (!this.googleClientId) {
            this.showError('Google Sign-In is not available right now. Please sign in or create an account with Email below.');
            return;
          }
          this.launchGooglePopup();
        },
        error: () => {
          this.googleLoading.set(false);
          this.showError('Still connecting — please wait a few seconds and try again.');
        }
      });
      return;
    }
    this.launchGooglePopup();
  }

  private launchGooglePopup() {
    if (!this.initGoogleTokenClient()) {
      this.showError('Google Sign-In is still loading or blocked by your browser. Please try again or use email.');
      return;
    }
    this.clearGoogleTimer();
    this.googleLoading.set(true);
    try {
      this.tokenClient.requestAccessToken({ prompt: 'select_account' });
      this.googleTimer = setTimeout(() => {
        this.ngZone.run(() => {
          if (this.googleLoading() && document.hasFocus()) {
            this.googleLoading.set(false);
            this.showError('Google Sign-In popup could not open here. Please allow popups or sign in with email.');
          }
        });
      }, 2500);
    } catch {
      this.googleLoading.set(false);
      this.showError('Google Sign-In could not be started here. Please sign in with email.');
    }
  }

  private submitGoogleAccessToken(accessToken: string) {
    this.authService.googleLogin({ accessToken }).subscribe({
      next: (res) => {
        this.googleLoading.set(false);
        this.router.navigateByUrl(res.user.role === 'SYSTEM_ADMIN' ? '/admin' : '/workspace', { replaceUrl: true });
      },
      error: (err) => {
        this.googleLoading.set(false);
        this.triggerShake();
        this.showError(err?.error?.error || 'Google sign-in failed.');
      }
    });
  }

  proceedAfterAuth() {
    this.router.navigateByUrl(this.targetRoute(), { replaceUrl: true });
  }

  handleForgot() {
    this.banner.set(null);
    this.emailTouched.set(true);
    if (this.emailError()) {
      this.triggerShake();
      this.showError('Enter your email address first to receive reset instructions.');
      return;
    }
    this.authService.forgotPassword(this.email().trim()).subscribe({
      next: (res) => this.showSuccess(res.message),
      error: () => this.showSuccess('Password reset instructions sent if the account exists.')
    });
  }
}
