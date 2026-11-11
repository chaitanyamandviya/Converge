import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { of } from 'rxjs';
import { DashboardComponent } from './dashboard';
import { PortalService } from '../services/portal.service';

@Component({ template: '' })
class DummyLoginComponent { }

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let portalService: PortalService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([
          { path: 'login', component: DummyLoginComponent }
        ]),
        provideHttpClient()
      ]
    }).compileComponents();

    portalService = TestBed.inject(PortalService);
    // Mock HTTP observables to return real test data cleanly
    portalService.fetchOverview = () => {
      portalService.overview.set({
        spend: 48000,
        views: 2400000,
        likes: 114000,
        comments: 6000,
        onboardedAgencies: 4,
        totalAgencies: 4,
        totalCreators: 24,
        contentSlotsFilled: 36,
        totalContentSlots: 48,
        missingUrlsCount: 8,
        awaitingInsightsCount: 4,
        coveragePercent: 75,
        activeCampaignName: 'Autumn essentials'
      });
      return of(portalService.overview());
    };

    portalService.fetchAgencies = () => {
      portalService.agencies.set([
        {
          name: 'North Collective',
          email: 'partners@northcollective.co',
          category: 'Lifestyle & Wellness',
          creatorsCount: 8,
          contentSlots: '16 / 16',
          spend: 16000,
          status: 'ACTIVE',
          joinedDate: 'Oct 2026',
          avatarColor: '#243F82'
        }
      ]);
      return of(portalService.agencies());
    };

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and display campaign overview metrics', () => {
    expect(component).toBeTruthy();
    expect(component.overview().activeCampaignName).toContain('Autumn');
    expect(component.overview().spend).toBe(48000);
  });

  it('should list onboarded agencies', () => {
    expect(component.agencies().length).toBeGreaterThan(0);
    expect(component.agencies()[0].name).toBe('North Collective');
  });
});
