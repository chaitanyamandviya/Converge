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
    expect(component.rememberMe()).toBe(false);
    component.toggleRememberMe();
    expect(component.rememberMe()).toBe(true);
    component.toggleRememberMe();
    expect(component.rememberMe()).toBe(false);
  });

  it('should compute password security strength', () => {
    component.password.set('123');
    expect(component.passwordStrengthLabel()).toBe('Weak');

    component.password.set('Pass1234');
    expect(['Fair', 'Good']).toContain(component.passwordStrengthLabel());

    component.password.set('Admin@12345Long!');
    expect(component.passwordStrengthLabel()).toBe('Strong');
  });

  it('should validate empty email and password', () => {
    component.email.set('');
    component.password.set('');
    component.onLogin();

    expect(component.errorMessage()).toContain('Please enter both email and password');
  });

  it('should call authService on valid login submission', () => {
    const loginSpy = vi.spyOn(authService, 'login').mockReturnValue(of({
      email: 'admin@converge.io',
      role: 'SYSTEM_ADMIN',
      token: 'mock-token'
    }));

    component.email.set('admin@converge.io');
    component.password.set('password123');
    component.rememberMe.set(true);
    component.onLogin();

    expect(loginSpy).toHaveBeenCalledWith({
      email: 'admin@converge.io',
      password: 'password123',
      rememberMe: true
    });
  });
});
