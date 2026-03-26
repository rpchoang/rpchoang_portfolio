interface Particle {
  element: HTMLElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  initialLife: number;
}

export class DustInteraction {
  private particles: Particle[] = [];
  private container: HTMLElement;
  private mouse = { x: -9999, y: -9999 };
  private rafId: number | null = null;
  private gravity = 0.15;
  private friction = 0.98;
  private repulsionRadius = 70;
  private repulsionStrength = 8;

  constructor(elements: HTMLElement[], container: HTMLElement) {
    this.container = container;
    elements.forEach(el => {
      this.particles.push({
        element: el,
        x: 0, y: 0, vx: 0, vy: 0,
        life: 0, initialLife: 1,
      });
    });

    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.update = this.update.bind(this);
    
    window.addEventListener('mousemove', this.handleMouseMove, { passive: true });
  }

  private handleMouseMove(event: MouseEvent) {
    const rect = this.container.getBoundingClientRect();
    this.mouse.x = event.clientX - rect.left;
    this.mouse.y = event.clientY - rect.top;
  }

  public explode(originX: number, originY: number) {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }

    this.particles.forEach(p => {
      p.x = originX;
      p.y = originY;
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 7 + 2; // Initial velocity
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 4; // Initial upward burst
      p.initialLife = p.life = Math.random() * 0.6 + 0.8; // ~0.8 to 1.4 seconds life
      p.element.style.opacity = '1';
    });

    this.rafId = requestAnimationFrame(this.update);
  }

  private update() {
    let activeParticles = 0;

    this.particles.forEach(p => {
      if (p.life <= 0) return;
      activeParticles++;

      // Mouse Repulsion
      const dx = p.x - this.mouse.x;
      const dy = p.y - this.mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.repulsionRadius) {
        const force = (this.repulsionRadius - dist) / this.repulsionRadius;
        const angle = Math.atan2(dy, dx);
        p.vx += Math.cos(angle) * force * this.repulsionStrength;
        p.vy += Math.sin(angle) * force * this.repulsionStrength;
      }

      // Physics
      p.vy += this.gravity;
      p.vx *= this.friction;
      p.vy *= this.friction;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 1 / 60; // Assumes 60fps

      const opacity = Math.max(0, p.life / p.initialLife);
      p.element.style.transform = `translate(${p.x}px, ${p.y}px)`;
      p.element.style.opacity = `${opacity}`;
    });

    if (activeParticles > 0) this.rafId = requestAnimationFrame(this.update);
    else this.rafId = null;
  }

  public cleanup() {
    window.removeEventListener('mousemove', this.handleMouseMove);
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }
}