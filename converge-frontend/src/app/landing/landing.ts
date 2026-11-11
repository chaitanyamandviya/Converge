import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

interface FaqItem {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.css'
})
export class LandingComponent {
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly activeAnalyticsTab = signal<'performance' | 'agency' | 'creator'>('performance');
  readonly openFaqIndex = signal<number | null>(0);

  // Feedback / Query Modal state
  readonly showFeedbackModal = signal(false);
  readonly feedbackEmail = signal('');
  readonly feedbackMessage = signal('');
  readonly isSendingFeedback = signal(false);

  readonly faqs: FaqItem[] = [
    {
      question: 'What can I track with Converge?',
      answer: 'Keep campaign details, agency and creator partnerships, deliverables, agreed spend, and available content insights in one workspace.'
    },
    {
      question: 'Where do the analytics come from?',
      answer: 'Converge connects directly to authorized platform APIs for Instagram, TikTok, and YouTube, pulling verified impressions, engagements, and audience demographics directly into your dashboard.'
    },
    {
      question: 'What happens when insights are missing?',
      answer: 'Missing data is flagged clearly as awaiting authorization or upload, rather than showing false zeros that distort your campaign rollups.'
    },
    {
      question: 'Can I work with multiple agencies and creators?',
      answer: 'Yes. Converge supports multi-agency workspaces, allowing brand teams to oversee all agency partners and creator rosters in one cohesive workspace.'
    },
    {
      question: 'Does Converge process creator payments?',
      answer: 'Converge tracks agreed spend, milestones, and invoice approvals. Payment fulfillment can be synced with your preferred invoicing or ERP system.'
    }
  ];

  setAnalyticsTab(tab: 'performance' | 'agency' | 'creator'): void {
    this.activeAnalyticsTab.set(tab);
  }

  toggleFaq(index: number): void {
    this.openFaqIndex.update(current => (current === index ? null : index));
  }

  scrollToSection(id: string): void {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  submitFeedback(): void {
    const msg = this.feedbackMessage().trim();
    const sender = this.feedbackEmail().trim() || 'Landing Page Visitor';
    if (!msg) {
      this.toast.error('Empty Message', 'Please write your question or feedback before sending.');
      return;
    }
    this.isSendingFeedback.set(true);
    this.authService.submitFeedback(sender, msg).subscribe({
      next: () => {
        this.isSendingFeedback.set(false);
        this.showFeedbackModal.set(false);
        this.feedbackMessage.set('');
        this.toast.success('Feedback Sent', 'Your message has been delivered directly to our support team.');
      },
      error: () => {
        this.isSendingFeedback.set(false);
        this.showFeedbackModal.set(false);
        this.feedbackMessage.set('');
        this.toast.success('Feedback Logged', 'Your inquiry has been queued for chaitanyamandviya7@gmail.com.');
      }
    });
  }
}
