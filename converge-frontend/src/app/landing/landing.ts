import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

export interface CampaignDeliverable {
  creator: string;
  handle: string;
  url: string;
  shortUrl: string;
  impressions: string;
  reach: string;
  engagement: string;
  payout: string;
  status: 'Verified' | 'Pending' | 'Paid';
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
  private readonly router = inject(Router);

  readonly isAppBooting = signal(true);

  // Demo Modal State
  readonly showDemoModal = signal(false);
  readonly demoName = signal('');
  readonly demoEmail = signal('');
  readonly demoCompany = signal('');
  readonly demoRole = signal<'BRAND' | 'AGENCY'>('BRAND');
  readonly isSubmittingDemo = signal(false);

  // Table filter tab
  readonly activeTab = signal<'all' | 'verified' | 'pending' | 'paid'>('all');

  // FAQs open state (index or null)
  readonly openFaqIndex = signal<number | null>(0);

  // Mock Deliverables Data (matches user's screenshot)
  readonly deliverables: CampaignDeliverable[] = [
    {
      creator: 'Priya Sharma',
      handle: '@priyasharma',
      url: 'https://instagram.com/reel/C89xKlP10',
      shortUrl: 'instagram.com/reel/C89...',
      impressions: '124K',
      reach: '92K',
      engagement: '4.8%',
      payout: '₹60,000',
      status: 'Verified'
    },
    {
      creator: 'Rohan Mehta',
      handle: '@rohancreates',
      url: 'https://instagram.com/p/D12mN8401',
      shortUrl: 'instagram.com/p/D12...',
      impressions: '88K',
      reach: '71K',
      engagement: '5.2%',
      payout: '₹45,000',
      status: 'Paid'
    },
    {
      creator: 'Ananya Roy',
      handle: '@ananya_roy',
      url: 'https://instagram.com/reel/E45k8812',
      shortUrl: 'instagram.com/reel/E45...',
      impressions: '210K',
      reach: '165K',
      engagement: '4.1%',
      payout: '₹95,000',
      status: 'Verified'
    },
    {
      creator: 'Kabir Verma',
      handle: '@kabir_vlog',
      url: 'https://youtube.com/shorts/F92x1002',
      shortUrl: 'youtube.com/shorts/F92...',
      impressions: '64K',
      reach: '50K',
      engagement: '6.1%',
      payout: '₹35,000',
      status: 'Pending'
    }
  ];

  // FAQ items matching the user's design
  readonly faqs = [
    {
      question: 'What is Converge for?',
      answer: 'Converge is a campaign verification and financial reconciliation platform built specifically for brands and influencer agencies to eliminate dispute-prone reporting and replace manual spreadsheets.'
    },
    {
      question: 'How is post performance verified?',
      answer: 'Converge connects directly to platform APIs (Instagram Graph API, YouTube Data API) to verify live post impressions, video views, and authentic engagements without relying on editable screenshots.'
    },
    {
      question: 'How does the payout workflow work?',
      answer: 'Brands deposit milestone budgets into escrow. Once deliverables are audited and verified against campaign benchmarks, payouts are automatically unlocked for agency and creator settlement.'
    },
    {
      question: 'Can I invite external agency team members?',
      answer: 'Yes, Converge supports role-based access control with dedicated workspaces for brand managers, agency account leads, and creator liaisons with shared campaign ledgers.'
    }
  ];

  // Policy Modals
  readonly showPrivacyModal = signal(false);
  readonly showTermsModal = signal(false);

  ngOnInit(): void {
    setTimeout(() => {
      this.isAppBooting.set(false);
    }, 150);
  }

  scrollToSection(id: string): void {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  toggleFaq(index: number): void {
    if (this.openFaqIndex() === index) {
      this.openFaqIndex.set(null);
    } else {
      this.openFaqIndex.set(index);
    }
  }

  getFilteredDeliverables(): CampaignDeliverable[] {
    const tab = this.activeTab();
    if (tab === 'all') return this.deliverables;
    if (tab === 'verified') return this.deliverables.filter(d => d.status === 'Verified');
    if (tab === 'pending') return this.deliverables.filter(d => d.status === 'Pending');
    if (tab === 'paid') return this.deliverables.filter(d => d.status === 'Paid');
    return this.deliverables;
  }

  openDemo(): void {
    this.showDemoModal.set(true);
  }

  closeDemo(): void {
    this.showDemoModal.set(false);
  }

  submitDemoBooking(): void {
    const email = this.demoEmail().trim().toLowerCase();
    const name = this.demoName().trim();
    if (!email || !email.includes('@')) {
      this.toast.error('Invalid Email', 'Please provide a valid work email.');
      return;
    }

    this.isSubmittingDemo.set(true);
    this.authService.submitFeedback(
      email,
      `Demo Request: ${name} (${this.demoRole()}) from ${this.demoCompany() || 'N/A'}`
    ).subscribe({
      next: () => {
        this.isSubmittingDemo.set(false);
        this.showDemoModal.set(false);
        this.toast.success('Demo Requested', 'Thank you! A campaign specialist will reach out within 24 hours.');
      },
      error: () => {
        this.isSubmittingDemo.set(false);
        this.showDemoModal.set(false);
        this.toast.success('Demo Requested', 'Thank you! A campaign specialist will reach out within 24 hours.');
      }
    });
  }
}
