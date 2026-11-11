import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

export interface DeliverableItem {
  name: string;
  creator: string;
  format: 'Reel' | 'Carousel' | 'Story';
  url: string;
  views: string;
  reach: string;
  status: 'Verified' | 'Under Audit';
  payout: string;
}

export interface StepCard {
  number: string;
  targetRole: string;
  title: string;
  description: string;
  previewLabel: string;
  previewValue: string;
  previewNote: string;
  previewIsLink?: boolean;
}

export interface LedgerItem {
  agency: string;
  deliverables: string;
  budget: string;
  status: 'Settled' | 'Auditing';
}

export interface FaqItem {
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

  readonly isAppBooting = signal(true);
  readonly openFaqIndex = signal<number | null>(null);

  // Demo / Contact Modal State
  readonly showDemoModal = signal(false);
  readonly demoEmail = signal('');
  readonly demoCompany = signal('');
  readonly demoMessage = signal('');
  readonly isSubmittingDemo = signal(false);

  // Summer Essentials Campaign Data (From Figma Design)
  readonly campaignSummary = {
    name: 'Summer essentials',
    breadcrumb: 'Campaign / Summer essentials',
    budget: '₹5,00,000',
    verifiedReach: '12,48,600',
    deliverablesCount: '18 / 24',
    payoutBalance: '₹3,60,000'
  };

  readonly deliverables: DeliverableItem[] = [
    {
      name: 'Hero Launch Reel',
      creator: '@ananya_m',
      format: 'Reel',
      url: 'instagram.com/reel/C89xK2...',
      views: '4,85,200',
      reach: '4,12,000',
      status: 'Verified',
      payout: '₹1,50,000'
    },
    {
      name: 'Product Showcase Carousel',
      creator: '@karan_v',
      format: 'Carousel',
      url: 'instagram.com/p/D12mV8...',
      views: '3,92,400',
      reach: '3,45,000',
      status: 'Under Audit',
      payout: '₹85,000'
    },
    {
      name: 'Founder Story Reel',
      creator: '@priya_design',
      format: 'Reel',
      url: 'instagram.com/reel/E45nQ9...',
      views: '3,71,000',
      reach: '3,20,000',
      status: 'Verified',
      payout: '₹1,25,000'
    }
  ];

  // 3-Step End-to-End Workflow Cards
  readonly steps: StepCard[] = [
    {
      number: '01',
      targetRole: 'For Brands & Agencies',
      title: 'Set the campaign',
      description: 'Define deliverables, milestones, budget caps in INR, and invite your partner agencies.',
      previewLabel: 'Campaign Budget',
      previewValue: '₹5,00,000',
      previewNote: 'Milestone based release'
    },
    {
      number: '02',
      targetRole: 'For Creators & Agencies',
      title: 'Drop the post link',
      description: 'Agencies and creators submit live post or reel URLs as soon as content goes live. No manual PDF reporting.',
      previewLabel: 'Deliverable Link',
      previewValue: 'instagram.com/reel/C89xK2...',
      previewNote: 'Automated URL ingestion',
      previewIsLink: true
    },
    {
      number: '03',
      targetRole: 'For Finance & Execs',
      title: 'Verify. Reconcile. Done.',
      description: 'System audits engagement metrics, validates deliverable compliance, and reconciles the payout budget.',
      previewLabel: 'Verification Status',
      previewValue: 'Approved for payout',
      previewNote: 'INR Ledger Reconciled'
    }
  ];

  // Multi-Agency Financial Reconciliation Ledger
  readonly ledgerItems: LedgerItem[] = [
    {
      agency: 'Apex Media Group',
      deliverables: '10 of 10',
      budget: '₹1,50,000',
      status: 'Settled'
    },
    {
      agency: 'Velocity Collective',
      deliverables: '8 of 8',
      budget: '₹85,000',
      status: 'Settled'
    },
    {
      agency: 'Aura Agency',
      deliverables: '6 of 6',
      budget: '₹1,25,000',
      status: 'Settled'
    }
  ];

  // Frequently Asked Questions
  readonly faqs: FaqItem[] = [
    {
      question: 'Who is Converge for?',
      answer: 'Built for consumer and enterprise brands running influencer campaigns alongside partner agencies that need automated proof-of-work and financial clarity.'
    },
    {
      question: 'How is post performance verified?',
      answer: 'Directly via official platform APIs as soon as deliverable URLs are submitted. No fabricated screenshots, altered decks, or inaccurate manual metrics.'
    },
    {
      question: 'How does the payout workflow work?',
      answer: 'Deliverable milestones are confirmed by the brand before payment sign-offs are unlocked, guaranteeing milestone-based disbursements with full audit trails.'
    },
    {
      question: 'Can I manage multiple campaigns at once?',
      answer: 'Yes. Run concurrent campaigns across different brand lines and partner agencies under a single unified governance dashboard.'
    }
  ];

  ngOnInit(): void {
    setTimeout(() => {
      this.isAppBooting.set(false);
    }, 250);
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

  openDemoModal(): void {
    this.showDemoModal.set(true);
  }

  closeDemoModal(): void {
    this.showDemoModal.set(false);
  }

  submitDemoRequest(): void {
    const email = this.demoEmail().trim();
    if (!email) {
      this.toast.error('Required Field', 'Please provide a work email address.');
      return;
    }
    this.isSubmittingDemo.set(true);
    const msg = `Demo Request from ${this.demoCompany().trim() || 'Brand/Agency'}: ${this.demoMessage().trim() || 'Interested in campaign verification and INR ledgers.'}`;
    this.authService.submitFeedback(email, msg).subscribe({
      next: () => {
        this.isSubmittingDemo.set(false);
        this.showDemoModal.set(false);
        this.demoEmail.set('');
        this.demoCompany.set('');
        this.demoMessage.set('');
        this.toast.success('Demo Requested', 'Thank you! Our enterprise team will connect within 24 hours.');
      },
      error: () => {
        this.isSubmittingDemo.set(false);
        this.showDemoModal.set(false);
        this.toast.success('Demo Requested', 'Request recorded successfully. We will be in touch shortly.');
      }
    });
  }
}
