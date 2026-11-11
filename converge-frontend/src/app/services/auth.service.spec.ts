import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import { AuthService } from './auth.service';

@Component({ template: '' })
class DummyLoginComponent {}

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideRouter([
          { path: 'login', component: DummyLoginComponent }
        ])
      ]
    });
    service = TestBed.inject(AuthService);
  });

  it('should be created and default to unauthenticated', () => {
    expect(service).toBeTruthy();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBe(null);
  });

  it('should logout cleanly', () => {
    service.logout();
    expect(service.currentUser()).toBe(null);
    expect(service.isAuthenticated()).toBe(false);
  });
});
