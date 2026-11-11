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

export interface DeliverableRow {
  campaign: string;
  format: 'Reel' | 'Carousel' | 'Story Set';
  urlStatus: string;
  urlAttached: boolean;
  status: 'Verified Reach' | 'Under Audit' | 'Awaiting Post URL';
  settlementInr: string;
}

export interface AgencyLedgerRow {
  name: string;
  deliverables: number;
  compliance: 'Settled' | 'Auditing';
  settlementInr: string;
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

  // Minimalist Smooth Boot Sequence
  readonly isAppBooting = signal(true);

  // Table Filter: All | Verified Reach | Under Audit | Awaiting URL
  readonly activeFilter = signal<'ALL' | 'VERIFIED' | 'AUDIT' | 'AWAITING'>('ALL');

  // FAQs: None open by default
  readonly openFaqIndex = signal<number | null>(null);

  // Direct Inquiries Modal state
  readonly showFeedbackModal = signal(false);
  readonly feedbackEmail = signal('');
  readonly feedbackMessage = signal('');
  readonly isSendingFeedback = signal(false);

  // Real Deliverable Verification Pipeline Data (Zero Fake Usernames, Zero Fluff)
  readonly deliverables: DeliverableRow[] = [
    {
      campaign: 'Festive Brand Launch',
      format: 'Reel',
      urlStatus: 'instagram.com/reel/C89xK2...',
      urlAttached: true,
      status: 'Verified Reach',
      settlementInr: '₹1,50,000'
    },
    {
      campaign: 'Monsoon Collection Q3',
      format: 'Carousel',
      urlStatus: 'instagram.com/p/D12mV8...',
      urlAttached: true,
      status: 'Under Audit',
      settlementInr: '₹85,000'
    },
    {
      campaign: 'Tier-1 Product Spotlight',
      format: 'Story Set',
      urlStatus: 'Awaiting URL Submission',
      urlAttached: false,
      status: 'Awaiting Post URL',
      settlementInr: '₹2,20,000'
    },
    {
      campaign: 'National Creator Roster',
      format: 'Reel',
      urlStatus: 'instagram.com/reel/E45nQ9...',
      urlAttached: true,
      status: 'Verified Reach',
      settlementInr: '₹3,10,000'
    },
    {
      campaign: 'Creator Milestone Sprint',
      format: 'Carousel',
      urlStatus: 'instagram.com/p/F78tL4...',
      urlAttached: true,
      status: 'Under Audit',
      settlementInr: '₹1,25,000'
    }
  ];

  // Multi-Agency Financial Reconciliation Ledger
  readonly agencyLedger: AgencyLedgerRow[] = [
    {
      name: 'Apex Media Group',
      deliverables: 18,
      compliance: 'Settled',
      settlementInr: '₹18,50,000'
    },
    {
      name: 'Velocity Collective',
      deliverables: 12,
      compliance: 'Auditing',
      settlementInr: '₹14,00,000'
    },
    {
      name: 'Pulse Digital Agency',
      deliverables: 10,
      compliance: 'Auditing',
      settlementInr: '₹12,50,000'
    }
  ];

  readonly faqs: FaqItem[] = [
    {
      question: 'What can I track with Converge?',
      answer: 'Keep campaign briefs, partner agency rosters, creator assignments, agreed INR budgets, and verified deliverable links in one unified workspace.'
    },
    {
      question: 'How does live insight synchronization work?',
      answer: 'Converge connects directly to authorized platform APIs for Instagram, pulling verified organic reach and interactions without manual screenshot submission.'
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
      answer: 'Yes. Converge tracks agreed spend per deliverable or fixed campaign fees in INR, allowing instant multi-sheet audit workbooks to be exported at any time.'
    }
  ];

  ngOnInit(): void {
    setTimeout(() => {
      this.isAppBooting.set(false);
    }, 300);
  }

  setFilter(filter: 'ALL' | 'VERIFIED' | 'AUDIT' | 'AWAITING'): void {
    this.activeFilter.set(filter);
  }

  get filteredDeliverables(): DeliverableRow[] {
    const filter = this.activeFilter();
    if (filter === 'VERIFIED') {
      return this.deliverables.filter(d => d.status === 'Verified Reach');
    }
    if (filter === 'AUDIT') {
      return this.deliverables.filter(d => d.status === 'Under Audit');
    }
    if (filter === 'AWAITING') {
      return this.deliverables.filter(d => d.status === 'Awaiting Post URL');
    }
    return this.deliverables;
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
        this.toast.error('Failed to Send', 'Could not deliver your feedback right now. Please try again.');
      }
    });
  }
}
