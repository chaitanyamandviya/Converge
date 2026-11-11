import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.css'
})
export class LandingComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly isAppBooting = signal(true);

  // Waitlist / Sign Up Form State
  readonly workEmail = signal('');
  readonly isJoining = signal(false);
  readonly joinedSuccess = signal(false);

  // Policy Modals
  readonly showPrivacyModal = signal(false);
  readonly showTermsModal = signal(false);

  ngOnInit(): void {
    setTimeout(() => {
      this.isAppBooting.set(false);
    }, 200);
  }

  scrollToSection(id: string): void {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  submitWaitlist(): void {
    const email = this.workEmail().trim().toLowerCase();
    if (!email || !email.includes('@')) {
      this.toast.error('Invalid Email', 'Please enter a valid work email address.');
      return;
    }

    this.isJoining.set(true);
    this.authService.submitFeedback(email, 'Waitlist submission from Converge Stitch Landing Page').subscribe({
      next: () => {
        this.isJoining.set(false);
        this.joinedSuccess.set(true);
        this.toast.success('Joined Waitlist', "You're on the invite list! We'll be in touch soon.");
      },
      error: () => {
        this.isJoining.set(false);
        this.joinedSuccess.set(true);
        this.toast.success('Joined Waitlist', "You're on the invite list! We'll be in touch soon.");
      }
    });
  }
}
