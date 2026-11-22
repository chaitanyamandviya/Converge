import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';
import { ThemeService } from './services/theme.service';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private theme = inject(ThemeService);
  private router = inject(Router);
  protected readonly title = signal('converge-frontend');

  private readonly onPageShow = (event: PageTransitionEvent) => {
    if (!event.persisted || typeof window === 'undefined') return;
    const p = window.location.pathname || '/';
    if ((p.startsWith('/workspace') || p.startsWith('/admin')) && !this.auth.isAuthenticated()) {
      this.router.navigateByUrl('/auth?mode=signin', { replaceUrl: true });
    }
  };

  ngOnInit(): void {
    this.auth.verifySessionWithServer();
    if (typeof window !== 'undefined') {
      window.addEventListener('pageshow', this.onPageShow);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('pageshow', this.onPageShow);
    }
  }
}
