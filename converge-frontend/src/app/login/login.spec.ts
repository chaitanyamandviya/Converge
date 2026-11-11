import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { of } from 'rxjs';
import { LoginComponent } from './login';
import { AuthService } from '../services/auth.service';

@Component({ template: '' })
class DummyDashboardComponent {}

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authService: AuthService;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: DummyDashboardComponent }
        ]),
        provideHttpClient()
      ]
    }).compileComponents();

    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle password visibility', () => {
    expect(component.showPassword()).toBe(false);
    component.togglePasswordVisibility();
    expect(component.showPassword()).toBe(true);
    component.togglePasswordVisibility();
    expect(component.showPassword()).toBe(false);
  });

  it('should toggle remember me', () => {
    expect(component.rememberMe()).toBe(true);
    component.toggleRememberMe();
    expect(component.rememberMe()).toBe(false);
  });

  it('should compute password security strength (low, medium, high)', () => {
    component.password.set('123');
    expect(component.passwordStrength()).toBe('low');

    component.password.set('Password1');
    expect(component.passwordStrength()).toBe('medium');

    component.password.set('Admin@12345');
    expect(component.passwordStrength()).toBe('high');
  });

  it('should validate empty email and password', () => {
    const dummyEvent = new Event('submit');
    component.email.set('');
    component.password.set('');
    component.onLogin(dummyEvent);

    expect(component.errorMessage()).toContain('Please enter your email address');
  });

  it('should validate invalid email format', () => {
    const dummyEvent = new Event('submit');
    component.email.set('notanemail');
    component.password.set('validpass123');
    component.onLogin(dummyEvent);

    expect(component.errorMessage()).toContain('valid email address');
  });

  it('should call authService on valid login submission', () => {
    const loginSpy = vi.spyOn(authService, 'login').mockReturnValue(of({
      email: 'admin@converge.io',
      role: 'SYSTEM_ADMIN',
      token: 'mock-token'
    }));

    const dummyEvent = new Event('submit');
    component.email.set('admin@converge.io');
    component.password.set('password123');
    component.onLogin(dummyEvent);

    expect(loginSpy).toHaveBeenCalledWith({
      email: 'admin@converge.io',
      password: 'password123',
      rememberMe: true
    });
  });
});
