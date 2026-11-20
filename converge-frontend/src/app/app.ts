import { Component, NgZone, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('converge-frontend');
  private readonly zone = inject(NgZone);
  private rafId: number | null = null;
  private latestX = 0;
  private latestY = 0;

  private readonly onMouseMove = (event: MouseEvent) => {
    this.latestX = event.clientX;
    this.latestY = event.clientY;
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      const root = document.documentElement.style;
      root.setProperty('--cursor-x', `${this.latestX}px`);
      root.setProperty('--cursor-y', `${this.latestY}px`);
      root.setProperty('--cursor-opacity', '1');
    });
  };

  private readonly onMouseLeave = () => {
    document.documentElement.style.setProperty('--cursor-opacity', '0');
  };

  ngOnInit(): void {
    this.zone.runOutsideAngular(() => {
      document.addEventListener('mousemove', this.onMouseMove, { passive: true });
      document.addEventListener('mouseleave', this.onMouseLeave, { passive: true });
    });
  }

  ngOnDestroy(): void {
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseleave', this.onMouseLeave);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
  }
}
