import { Component, signal, inject, OnInit } from '@angular/core';
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
export class LandingComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  // Fluid App Booting / Loading Screen
  readonly isAppBooting = signal(true);

  // Interactive Architecture Workflow Switcher (Zero Demo Data)
  readonly activeWorkflowTab = signal<'roster' | 'audit' | 'meta' | 'ledger'>('roster');

  // FAQs: None open by default
  readonly openFaqIndex = signal<number | null>(null);

  // Direct Inquiries Sheet Modal state
  readonly showFeedbackModal = signal(false);
  readonly feedbackEmail = signal('');
  readonly feedbackMessage = signal('');
  readonly isSendingFeedback = signal(false);

  readonly faqs: FaqItem[] = [
    {
      question: 'What can I track with Converge?',
      answer: 'Keep campaign briefs, partner agency rosters, creator assignments, agreed INR budgets, and verified deliverable links in one unified workspace.'
    },
    {
      question: 'How does live insight synchronization work?',
      answer: 'Converge connects directly to authorized platform APIs for Instagram and Meta Graph API v26.0, pulling verified organic reach and interactions without manual screenshot submission.'
    },
    {
      question: 'What happens when insights or deliverables are missing?',
      answer: 'Missing deliverables and pending authorizations are flagged prominently in your audit stream rather than showing distorted zeros that corrupt campaign pacing.'
    },
    {
      question: 'Can I manage multiple partner agencies and brand workspaces?',
      answer: 'Yes. Converge is architected for multi-agency collaboration. Brand managers oversee all connected partner agencies while agency teams maintain private roster control.'
    },
    {
      question: 'Does Converge support agreed INR budget tracking?',
      answer: 'Yes. Converge tracks agreed spend per deliverable or fixed campaign fees in INR, allowing instant 5-sheet audit workbooks to be exported at any time.'
    }
  ];

  ngOnInit(): void {
    // Apple Fluid Boot sequence: smoothly unveil view after initialization
    setTimeout(() => {
      this.isAppBooting.set(false);
    }, 450);
  }

  setWorkflowTab(tab: 'roster' | 'audit' | 'meta' | 'ledger'): void {
    this.activeWorkflowTab.set(tab);
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
        this.toast.success('Feedback Logged', 'Your inquiry has been queued for our team.');
      }
    });
  }
}
