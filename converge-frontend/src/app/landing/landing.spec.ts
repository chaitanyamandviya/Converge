import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { LandingComponent } from './landing';

describe('LandingComponent', () => {
  let component: LandingComponent;
  let fixture: ComponentFixture<LandingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [provideRouter([]), provideHttpClient()]
    }).compileComponents();

    fixture = TestBed.createComponent(LandingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle character spotlight', () => {
    expect(component.activeSpotlight()).toBe(null);
    component.toggleSpotlight('brand');
    expect(component.activeSpotlight()).toBe('brand');
    component.toggleSpotlight('brand');
    expect(component.activeSpotlight()).toBe(null);
  });

  it('should dismiss modals on escape key', () => {
    component.showPrivacyModal.set(true);
    component.showTermsModal.set(true);
    component.onEscapeKey();
    expect(component.showPrivacyModal()).toBe(false);
    expect(component.showTermsModal()).toBe(false);
  });
});
