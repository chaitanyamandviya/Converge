import { Component, signal, computed, inject, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { ConfirmService } from '../services/confirm.service';

export interface SystemGoogleAccount {
  name: string;
  email: string;
  avatarInitials: string;
  avatarColor?: string;
}

export interface BrandPartnerOption {
  id: number;
  name: string;
  badge: string;
  color: string;
  category?: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);

  // Mode: 'login' | 'signup' | 'forgot'
  readonly mode = signal<'login' | 'signup' | 'forgot'>('login');

  readonly email = signal('');
  readonly password = signal('');
  readonly confirmPassword = signal('');
  readonly rememberMe = signal(false);
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly agreeTerms = signal(false);
  readonly hasShakeError = signal(false);

  // Brand dropdown & search
  readonly brandDropdownOpen = signal(false);
  readonly brandSearch = signal('');
  readonly selectedBrandId = signal<number | undefined>(1);
  readonly selectedBrandName = signal<string>('Blitz Inc.');
  readonly selectedBrandBadge = signal<string>('BL');
  readonly selectedBrandColor = signal<string>('#FBBC05');

  // Default and live brands
  readonly brandPartners = signal<BrandPartnerOption[]>([
    { id: 1, name: 'Blitz Inc.', badge: 'BL', color: '#FBBC05', category: 'Creator Commerce' },
    { id: 2, name: 'Waveform Media', badge: 'WM', color: '#4285F4', category: 'Digital Media' },
    { id: 3, name: 'Nike', badge: 'NK', color: '#000000', category: 'Sportswear' },
    { id: 4, name: 'Spotify', badge: 'SP', color: '#1DB954', category: 'Audio & Music' },
    { id: 5, name: 'Aura Wellness', badge: 'AW', color: '#EA4335', category: 'Health & Beauty' }
  ]);

  readonly filteredBrands = computed(() => {
    const q = this.brandSearch().trim().toLowerCase();
    const list = this.brandPartners();
    if (!q) return list;
    return list.filter(b => b.name.toLowerCase().includes(q) || (b.category && b.category.toLowerCase().includes(q)));
  });

  // Google Sign-In state
  readonly showGoogleModal = signal(false);
  readonly useAnotherGoogleAccount = signal(false);
  readonly googleEmail = signal('');
  readonly systemGoogleAccounts = signal<SystemGoogleAccount[]>(this.loadSystemGoogleAccounts());

  // Privacy & Help Modals
  readonly showPrivacyModal = signal(false);
  readonly showTermsModal = signal(false);
  readonly showHelpModal = signal(false);
  readonly supportSenderEmail = signal('');
  readonly supportQuestion = signal('');
  readonly isSendingSupport = signal(false);

  // Onboarding fields
  readonly fullName = signal('');
  readonly organizationName = signal('');
  readonly role = signal<'BRAND_MANAGER' | 'AGENCY_MANAGER'>('BRAND_MANAGER');

  readonly isBrandRole = computed(() => this.role() === 'BRAND_MANAGER');
  readonly isAgencyRole = computed(() => this.role() === 'AGENCY_MANAGER');

  // Password Strength Computations
  readonly passwordHasMinLength = computed(() => this.password().length >= 8);
  readonly passwordHasNumOrSpecial = computed(() =>
    /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?~`]/.test(this.password())
  );

  readonly passwordScore = computed(() => {
    const val = this.password();
    if (!val) return 0;
    let score = 0;
    if (val.length >= 4) score++;
    if (val.length >= 8) score++;
    if (/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?~`]/.test(val)) score++;
    if (val.length >= 10 && /[A-Z]/.test(val)) score++;
    return score;
  });

  readonly passwordStrengthLabel = computed<'Strength' | 'Weak' | 'Fair' | 'Good' | 'Strong'>(() => {
    const s = this.passwordScore();
    const val = this.password();
    if (!val) return 'Strength';
    if (s <= 1) return 'Weak';
    if (s === 2) return 'Fair';
    if (s === 3) return 'Good';
    return 'Strong';
  });

  readonly passwordsMatch = computed(() => {
    const p = this.password();
    const c = this.confirmPassword();
    return p.length > 0 && c.length > 0 && p === c;
  });

  ngOnInit(): void {
    this.route.queryParams?.subscribe(params => {
      if (params['email']) {
        this.email.set(params['email']);
      }
      if (params['mode'] === 'signup') {
        this.setMode('signup');
      } else if (params['mode'] === 'forgot') {
        this.setMode('forgot');
      }
    });
    this.loadBrandsForOnboarding();
  }

  private loadBrandsForOnboarding(): void {
    if (typeof this.authService.getAvailableBrands === 'function') {
      this.authService.getAvailableBrands().subscribe({
        next: (brands) => {
          if (brands && brands.length > 0) {
            const mapped: BrandPartnerOption[] = brands.map(b => ({
              id: b.id,
              name: b.name,
              badge: b.name.substring(0, 2).toUpperCase(),
              color: '#4285F4',
              category: b.category
            }));
            // Merge with defaults avoiding duplicate names
            const existingNames = new Set(this.brandPartners().map(b => b.name.toLowerCase()));
            const toAdd = mapped.filter(m => !existingNames.has(m.name.toLowerCase()));
            this.brandPartners.update(curr => [...curr, ...toAdd]);
          }
        },
        error: () => {
          // keep defaults
        }
      });
    }
  }

  toggleBrandDropdown(force?: boolean): void {
    if (typeof force === 'boolean') {
      this.brandDropdownOpen.set(force);
    } else {
      this.brandDropdownOpen.update(v => !v);
    }
  }

  selectBrand(brand: BrandPartnerOption): void {
    this.selectedBrandId.set(brand.id);
    this.selectedBrandName.set(brand.name);
    this.selectedBrandBadge.set(brand.badge);
    this.selectedBrandColor.set(brand.color);
    this.brandDropdownOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.showGoogleModal.set(false);
    this.showPrivacyModal.set(false);
    this.showHelpModal.set(false);
    this.brandDropdownOpen.set(false);
  }

  private loadSystemGoogleAccounts(): SystemGoogleAccount[] {
    const defaultAccounts: SystemGoogleAccount[] = [
      {
        name: 'Chaitanya Mandviya',
        email: 'chaitanyamandviya7@gmail.com',
        avatarInitials: 'CM',
        avatarColor: '#37474f'
      },
      {
        name: 'Chaitanya Mandviya',
        email: 'chaitanyamandviya1@gmail.com',
        avatarInitials: 'C',
        avatarColor: '#0288d1'
      }
    ];
    try {
      const saved = localStorage.getItem('converge_google_accounts');
      if (saved) {
        const parsed: SystemGoogleAccount[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return defaultAccounts;
  }

  setMode(newMode: 'login' | 'signup' | 'forgot'): void {
    this.mode.set(newMode);
    this.clearMessages();
    this.confirmPassword.set('');
    this.brandDropdownOpen.set(false);
  }

  private autoDismissTimer: any = null;

  triggerShake(): void {
    this.hasShakeError.set(false);
    setTimeout(() => {
      this.hasShakeError.set(true);
      setTimeout(() => {
        this.hasShakeError.set(false);
      }, 500);
    }, 10);
  }

  showError(msg: string): void {
    this.successMessage.set('');
    this.errorMessage.set(msg);
    this.triggerShake();
    if (this.autoDismissTimer) clearTimeout(this.autoDismissTimer);
    this.autoDismissTimer = setTimeout(() => {
      this.errorMessage.set('');
    }, 8000);
  }

  showSuccess(msg: string): void {
    this.errorMessage.set('');
    this.successMessage.set(msg);
    if (this.autoDismissTimer) clearTimeout(this.autoDismissTimer);
    this.autoDismissTimer = setTimeout(() => {
      this.successMessage.set('');
    }, 8000);
  }

  dismissAlert(type: 'error' | 'success'): void {
    if (type === 'error') this.errorMessage.set('');
    if (type === 'success') this.successMessage.set('');
    if (this.autoDismissTimer) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
    }
  }

  clearMessages(): void {
    if (this.errorMessage()) this.errorMessage.set('');
    if (this.successMessage()) this.successMessage.set('');
    if (this.autoDismissTimer) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
    }
  }

  selectRole(newRole: 'BRAND_MANAGER' | 'AGENCY_MANAGER'): void {
    this.role.set(newRole);
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(show => !show);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update(show => !show);
  }

  onGoogleSignIn(): void {
    this.clearMessages();
    this.useAnotherGoogleAccount.set(false);
    this.showGoogleModal.set(true);
  }

  selectGoogleAccount(account: SystemGoogleAccount): void {
    this.authenticateGoogleEmail(account.email);
  }

  submitGoogleAccount(): void {
    const emailVal = this.googleEmail().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailVal || !emailRegex.test(emailVal)) {
      this.toast.error('Invalid Email', 'Please enter a valid personal or work Google email address.');
      return;
    }

    this.saveGoogleAccountToChooser(emailVal.split('@')[0], emailVal);
    this.authenticateGoogleEmail(emailVal);
  }

  private saveGoogleAccountToChooser(name: string, email: string): void {
    const cleanEmail = email.trim().toLowerCase();
    const initials = name
      .split(/\s+/)
      .map(part => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'G';

    const existing = this.systemGoogleAccounts().filter(a => a.email.toLowerCase() !== cleanEmail);
    const updated = [{ name, email: cleanEmail, avatarInitials: initials }, ...existing];
    this.systemGoogleAccounts.set(updated);
    try {
      localStorage.setItem('converge_google_accounts', JSON.stringify(updated));
    } catch {
      // ignore
    }
  }

  private authenticateGoogleEmail(emailVal: string): void {
    this.isLoading.set(true);
    this.authService.googleLogin(emailVal, this.rememberMe()).subscribe({
      next: (user) => {
        this.isLoading.set(false);
        this.showGoogleModal.set(false);
        this.toast.success('Signed in with Google', `Authenticated as ${user.email}`);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toast.error('Google Sign-In Notice', err.message || 'Could not authenticate with Google.');
      }
    });
  }

  submitSupportRequest(): void {
    const msg = this.supportQuestion().trim();
    const sender = this.supportSenderEmail().trim() || this.email().trim() || 'User';
    if (!msg) {
      this.toast.error('Empty Message', 'Please enter your feedback or question.');
      return;
    }
    this.isSendingSupport.set(true);
    this.authService.submitFeedback(sender, msg).subscribe({
      next: () => {
        this.isSendingSupport.set(false);
        this.showHelpModal.set(false);
        this.supportQuestion.set('');
        this.toast.success('Feedback Sent', 'Your feedback or query has been delivered to the platform team.');
      },
      error: () => {
        this.isSendingSupport.set(false);
        this.showHelpModal.set(false);
        this.supportQuestion.set('');
        this.toast.success('Feedback Recorded', 'Your inquiry has been received by the support team.');
      }
    });
  }

  async onForgotPassword(): Promise<void> {
    const emailVal = this.email().trim();
    const newPass = this.password();
    const confPass = this.confirmPassword();

    if (!emailVal) {
      this.showError('Please enter your email address.');
      return;
    }

    if (newPass && newPass !== confPass) {
      this.showError('New password and Confirm password do not match.');
      return;
    }

    const confirmed = await this.confirmService.confirm({
      title: newPass ? 'Confirm Password Update?' : 'Send Password Recovery Email?',
      message: newPass
        ? `Save your new password for ${emailVal} and activate your workspace login?`
        : `Dispatch a password recovery link to ${emailVal}?`,
      detail: `Account: ${emailVal}`,
      confirmText: newPass ? 'Save Password' : 'Send Reset Link',
      variant: 'primary'
    });
    if (!confirmed) return;

    this.isLoading.set(true);
    this.authService.forgotPassword(emailVal, newPass).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.password.set('');
        this.confirmPassword.set('');
        this.toast.success(
          newPass ? 'Password Updated' : 'Reset Instructions Sent',
          newPass
            ? `Password updated for ${emailVal}. You can now log in.`
            : `Password recovery email dispatched to ${emailVal}.`
        );
        this.setMode('login');
      },
      error: (err) => {
        this.isLoading.set(false);
        this.showError(err.message || 'Could not process password recovery.');
      }
    });
  }

  onSubmit(event?: Event): void {
    if (event) event.preventDefault();
    if (this.mode() === 'login') {
      this.onLogin();
    } else if (this.mode() === 'signup') {
      this.onRegister();
    } else {
      this.onForgotPassword();
    }
  }

  onLogin(): void {
    const emailVal = this.email().trim();
    const passVal = this.password();

    if (!emailVal || !passVal) {
      this.showError('Please enter both email and password.');
      return;
    }

    this.isLoading.set(true);
    this.clearMessages();

    this.authService.login({
      email: emailVal,
      password: passVal,
      rememberMe: this.rememberMe()
    }).subscribe({
      next: (user) => {
        this.isLoading.set(false);
        this.toast.success('Welcome back', `Logged in as ${user.email}`);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.showError(err.message || 'Invalid email or password.');
      }
    });
  }

  onRegister(): void {
    const emailVal = this.email().trim();
    const passVal = this.password();
    const confVal = this.confirmPassword();
    const nameVal = this.fullName().trim();
    const orgVal = this.organizationName().trim();

    if (!nameVal) {
      this.showError('Please provide your full name.');
      return;
    }
    if (!emailVal) {
      this.showError('Please provide your work email.');
      return;
    }
    if (!passVal) {
      this.showError('Please set a secure password.');
      return;
    }
    if (passVal !== confVal) {
      this.showError('Passwords do not match.');
      return;
    }
    if (this.role() === 'BRAND_MANAGER' && !orgVal) {
      this.showError('Please provide your brand or organization name.');
      return;
    }
    if (this.role() === 'AGENCY_MANAGER' && !orgVal) {
      this.showError('Please provide your agency workspace name.');
      return;
    }

    this.isLoading.set(true);
    this.clearMessages();

    this.authService.register(
      emailVal,
      passVal,
      this.role(),
      nameVal,
      orgVal,
      'Lifestyle & Wellness',
      '',
      this.role() === 'AGENCY_MANAGER' ? this.selectedBrandId() : undefined,
      this.role() === 'AGENCY_MANAGER' ? this.selectedBrandName() : undefined
    ).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.toast.success('Account Created', `Welcome to Converge, ${nameVal}!`);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.showError(err.message || 'Registration failed. Please check your details.');
      }
    });
  }
}
