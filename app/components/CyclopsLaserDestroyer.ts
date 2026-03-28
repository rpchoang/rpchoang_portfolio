export enum AnimState {
  IDLE,
  LANDING,
  DUST_DRIFT,
  LASER_ACTIVE,
  CLEANUP
}

/**
 * AnimationController - High-Performance Vanilla JS Orchestrator
 *
 * Manages the entire lifecycle of a canvas-based pixel destruction and dust effect.
 */
export class AnimationController {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private textCanvas: HTMLCanvasElement;

  // State Management
  public state: AnimState = AnimState.IDLE;
  public isTextDestroyed = false;
  private isRunning = false;
  private rafId: number | null = null;
  private isCharging = false;
  public isFiring = false;
  private chargeProgress = 0;
  private isBeamOn = true;
  private isTwinkling = false;
  private twinkleProgress = 0;

  // Laser & Particle Physics
  private laserOrigin = { x: 198, y: 295 }; // Base origin
  private laserTipX: number;
  
  // Zero-Allocation Memory Engine
  private MAX_PARTICLES = 30000;
  private STRIDE = 16; // [x, y, vx, vy, life, decay, r, g, b, size, type, initLife, phase, amplitude, frequency, gravityDelay]
  private particleData: Float32Array;
  private pCount = 0;

  // Pixel Data & Scan Position
  private pixelColumns: { x: number; y: number; r: number; g: number; b: number }[][] = [];
  private currentScanX: number;

  // Safety & Performance
  private scrollObserver: IntersectionObserver | null = null;
  private isVisible = true;
  private isTabActive = true;
  private scaleFactor: number = 1;
  
  private domBounds: { el: HTMLElement; rightEdge: number; leftEdge: number; bottomEdge: number; width: number }[] = [];
  
  // Mouse Logic
  private mouse = { x: -1000, y: -1000, vx: 0, vy: 0, isMoving: false };
  private mouseTimeout: any;

  constructor(canvas: HTMLCanvasElement, textCanvas: HTMLCanvasElement, domElements: HTMLElement[] = []) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = context;

    this.textCanvas = textCanvas;
    this.particleData = new Float32Array(this.MAX_PARTICLES * this.STRIDE);
    
    this.laserTipX = this.canvas.width;
    this.currentScanX = this.canvas.width;

    this.preScanTextPixels();

    // Pre-calculate DOM boundaries for accurate clipping
    const containerRect = canvas.getBoundingClientRect();
    for (const el of domElements) {
      const rect = el.getBoundingClientRect();
      this.domBounds.push({
        el,
        leftEdge: rect.left - containerRect.left,
        rightEdge: rect.right - containerRect.left,
        bottomEdge: rect.bottom - containerRect.top,
        width: rect.width
      });
    }

    this.render = this.render.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);

    window.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    this.scrollObserver = new IntersectionObserver((entries) => {
      this.isVisible = entries[0].isIntersecting;
      this.checkEngine();
    }, { threshold: 0.1 });
    this.scrollObserver.observe(this.canvas);

    this.startEngine();
  }

  private handleVisibilityChange() {
    this.isTabActive = !document.hidden;
    this.checkEngine();
  }

  private checkEngine() {
    if (this.isVisible && this.isTabActive) {
      this.startEngine();
    } else {
      this.stopEngine();
    }
  }

  private startEngine() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.rafId = requestAnimationFrame(this.render);
    }
  }

  private stopEngine() {
    if (this.isRunning && this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
      this.isRunning = false;
    }
  }

  public setState(newState: AnimState) {
    this.state = newState;
    this.startEngine();
  }

  private preScanTextPixels() {
    const width = this.textCanvas.width;
    const height = this.textCanvas.height;
    const offCtx = this.textCanvas.getContext('2d', { willReadFrequently: true });
    if (!offCtx) return;

    const imgData = offCtx.getImageData(0, 0, width, height).data;

    for (let x = 0; x < width; x++) {
      const column = [];
      for (let y = 0; y < height; y++) {
        const idx = (y * width + x) * 4;
        if (imgData[idx + 3] > 128) { // Target non-transparent pixels
          column.push({
            x, y,
            r: imgData[idx],
            g: imgData[idx + 1],
            b: imgData[idx + 2]
          });
        }
      }
      this.pixelColumns[x] = column;
    }
  }

  public triggerLandingDust() {
    //if (this.isTextDestroyed) return;
    this.setState(AnimState.DUST_DRIFT);

    // The user wants all dust to originate from under the text boxes upon impact.
    // This will be the single source of dust particles.
    for (const bound of this.domBounds) {
      // Spawn a large number of particles per text line for a dramatic effect.
      const particleCount = bound.width * 1.5; // More particles for wider lines
      for (let i = 0; i < particleCount; i++) {
        if (this.pCount >= this.MAX_PARTICLES) break;

        const x = bound.leftEdge + Math.random() * bound.width;
        const y = bound.bottomEdge - Math.random() * 10;
        const distFromCenter = (x - (bound.leftEdge + bound.width / 2)) / (bound.width / 2 || 1);

        const initialVy = -(Math.random() * 15 + 8); // Increased initial upward velocity for faster ascent
        const normalizedVy = (Math.abs(initialVy) - 6) / 12; // Range [0, 1]
        // Particles that shoot up higher (larger normalizedVy) will have gravity delayed longer.
        const gravityDelay = (normalizedVy * 30) + (Math.random() * 20); // Delay in frames

        const idx = this.pCount * this.STRIDE;
        this.particleData[idx + 0] = x;
        this.particleData[idx + 1] = y;
        // Stronger outward blast
        this.particleData[idx + 2] = (distFromCenter * (Math.random() * 8 + 4)) + (Math.random() - 0.5) * 2;
        // Much stronger vertical impulse to spread dust up the page
        this.particleData[idx + 3] = initialVy;
        this.particleData[idx + 4] = 10.0; // 10s life
        this.particleData[idx + 5] = 1 / 600; // decay
        this.particleData[idx + 6] = 180 + Math.random() * 50;
        this.particleData[idx + 7] = 180 + Math.random() * 50;
        this.particleData[idx + 8] = 180 + Math.random() * 50;
        this.particleData[idx + 9] = Math.random() * 2 + 1;
        this.particleData[idx + 10] = 1;
        this.particleData[idx + 11] = 10.0;
        this.particleData[idx + 12] = Math.random() * Math.PI * 2; // phase
        this.particleData[idx + 13] = Math.random() * 2.0 + 0.5; // amplitude
        this.particleData[idx + 14] = Math.random() * 0.002 + 0.001; // frequency
        this.particleData[idx + 15] = gravityDelay;
        this.pCount++;
      }
    }
  }

  private handleMouseMove(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    if (this.mouse.x !== -1000) {
      this.mouse.vx = currentX - this.mouse.x;
      this.mouse.vy = currentY - this.mouse.y;
    }

    this.mouse.x = currentX;
    this.mouse.y = currentY;
    this.mouse.isMoving = true;

    clearTimeout(this.mouseTimeout);
    this.mouseTimeout = setTimeout(() => {
      this.mouse.isMoving = false;
      this.mouse.vx = 0;
      this.mouse.vy = 0;
    }, 100);
  }

  public fireLaser(origin?: { x: number; y: number }, scaleFactor: number = 1) {
    //if (this.isTextDestroyed) return;
    this.scaleFactor = scaleFactor;
    
    if (origin) {
      this.laserOrigin = origin;
      this.laserTipX = origin.x; // Snap the sweep to start exactly AT the eye
      this.currentScanX = origin.x;
    }
    this.isFiring = true;
    this.isTwinkling = true;
    this.twinkleProgress = 0;
    this.isCharging = false;
    this.chargeProgress = 0;
    this.isBeamOn = true;
    this.setState(AnimState.LASER_ACTIVE);
    
  }

  public hideBeam() {
    this.isBeamOn = false;
    this.isCharging = false;
    this.isTwinkling = false;
  }

  public showBeam() {
    if (!this.isFiring) return;
    if (!this.isBeamOn) {
      // Returning after a hideBeam() — restart twinkle/charge from the eye position
      this.laserTipX = this.laserOrigin.x;
      this.currentScanX = this.laserOrigin.x;
      this.isTwinkling = true;
      this.twinkleProgress = 0;
      this.isCharging = false;
      this.chargeProgress = 0;
      this.isBeamOn = true;
    }
    this.setState(AnimState.LASER_ACTIVE);
  }

  public stopLaser() {
    this.isFiring = false;
    this.isCharging = false;
  }

  public reset() {
    this.isTextDestroyed = false;
    this.isFiring = false;
    this.isCharging = false;
    this.chargeProgress = 0;
    this.isTwinkling = false;
    this.twinkleProgress = 0;
    this.pCount = 0; // Clear all particles
    this.laserTipX = this.canvas.width;
    this.currentScanX = this.canvas.width;
    this.isBeamOn = true;

    for (const bound of this.domBounds) {
      bound.el.style.clipPath = 'none';
    }

    this.setState(AnimState.IDLE);
  }

  private spawnParticles(columnX: number) {
    const pixels = this.pixelColumns[columnX];
    if (!pixels) return;

    for (let i = 0; i < pixels.length; i += 2) { // Stride for performance
      if (this.pCount >= this.MAX_PARTICLES) break;
      
      const p = pixels[i];
      const idx = this.pCount * this.STRIDE;
      
      this.particleData[idx + 0] = p.x;
      this.particleData[idx + 1] = p.y;
      this.particleData[idx + 2] = -(Math.random() * 5 + 2) * this.scaleFactor; // vx
      this.particleData[idx + 3] = (Math.random() - 0.5) * 6 * this.scaleFactor; // vy
      this.particleData[idx + 4] = 1.0; // life
      this.particleData[idx + 5] = Math.random() * 0.015 + 0.01; // decay
      this.particleData[idx + 6] = p.r;
      this.particleData[idx + 7] = p.g;
      this.particleData[idx + 8] = p.b;
      this.particleData[idx + 9] = 2; // size
      this.particleData[idx + 10] = 0; // type (0 = Atomized Text)
      this.particleData[idx + 11] = 1.0; // initLife
      this.particleData[idx + 12] = 0; // phase
      this.particleData[idx + 13] = 0; // amplitude
      this.particleData[idx + 14] = 0; // frequency
      this.particleData[idx + 15] = 0; // gravityDelay
      this.pCount++;
    }
  }

  private render() {
    if (!this.isRunning) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const eyeX = this.laserOrigin.x;
    const eyeY = this.laserOrigin.y;
    const flicker = Math.random() * 0.3 + 0.7;

    // Advance twinkle (~1 second), then hand off to the charge phase
    if (this.isTwinkling) {
      this.twinkleProgress += 1 / 60;
      if (this.twinkleProgress >= 1) {
        this.isTwinkling = false;
        this.isCharging = true;
        this.chargeProgress = 0;
      }
    }

    let intensity = 1;
    if (this.isCharging) {
      this.chargeProgress += 0.083; // ~0.2 seconds at 60fps
      intensity = Math.pow(this.chargeProgress, 2);
      if (this.chargeProgress >= 1) {
        this.isCharging = false;
        intensity = 1;
      }
    }

    this.ctx.globalCompositeOperation = 'screen';

    // 0. Draw pre-fire twinkle / lens-flare sparkle at the eye
    if (this.isTwinkling && this.isBeamOn) {
      const t = this.twinkleProgress;
      // Three quick pulses that build in intensity toward the end
      const pulse = (0.5 + 0.5 * Math.sin(t * Math.PI * 6)) * (0.4 + 0.6 * t) * flicker;

      // Radial energy glow
      const glowR = 120 * pulse;
      if (glowR > 1) {
        const twinkleGlow = this.ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, glowR);
        twinkleGlow.addColorStop(0, `rgba(255, 120, 120, ${0.9 * pulse})`);
        twinkleGlow.addColorStop(0.3, `rgba(220, 0, 0, ${0.5 * pulse})`);
        twinkleGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.ctx.fillStyle = twinkleGlow;
        this.ctx.beginPath();
        this.ctx.arc(eyeX, eyeY, glowR, 0, Math.PI * 2);
        this.ctx.fill();
      }

      // 8-point star (4 cardinal + 4 diagonal lines)
      const starLen = 45 * pulse;
      const diagLen = 28 * pulse;
      this.ctx.shadowColor = '#ff4444';
      this.ctx.shadowBlur = 18 * pulse;
      this.ctx.strokeStyle = `rgba(255, 255, 255, ${pulse})`;
      this.ctx.lineWidth = 1.5;
      for (let a = 0; a < 4; a++) {
        const angle = (a * Math.PI) / 2;
        this.ctx.beginPath();
        this.ctx.moveTo(eyeX, eyeY);
        this.ctx.lineTo(eyeX + Math.cos(angle) * starLen, eyeY + Math.sin(angle) * starLen);
        this.ctx.stroke();
      }
      for (let a = 0; a < 4; a++) {
        const angle = Math.PI / 4 + (a * Math.PI) / 2;
        this.ctx.beginPath();
        this.ctx.moveTo(eyeX, eyeY);
        this.ctx.lineTo(eyeX + Math.cos(angle) * diagLen, eyeY + Math.sin(angle) * diagLen);
        this.ctx.stroke();
      }

      // Bright centre dot
      const dotR = 8 * pulse;
      if (dotR > 0.5) {
        this.ctx.beginPath();
        this.ctx.arc(eyeX, eyeY, dotR, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
        this.ctx.shadowColor = '#ffffff';
        this.ctx.shadowBlur = 25 * pulse;
        this.ctx.fill();
      }

      this.ctx.shadowBlur = 0;
    }

    // 1. Draw Subtle Background Glow
    if (this.isCharging && this.isBeamOn) {
      const radius = 300 * intensity * flicker;
      if (radius > 0) {
        const bgGlow = this.ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, radius);
        bgGlow.addColorStop(0, `rgba(200, 10, 10, ${0.3 * intensity})`);
        bgGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.ctx.fillStyle = bgGlow;
        this.ctx.beginPath();
        this.ctx.arc(eyeX, eyeY, radius, 0, Math.PI * 2);
        this.ctx.fill();
      }
    } else if (this.isFiring && this.isBeamOn) {
      const tipX = this.laserTipX;
      if (tipX < eyeX) {
        const totalDistance = eyeX || 1;
        const traveled = eyeX - tipX;
        const rawProgress = Math.max(0, Math.min(1, traveled / totalDistance));
        const expandProgress = Math.pow(rawProgress, 3);
        
        const ambientEye = 40 * flicker;
        const ambientEdge = (40 + 800 * expandProgress) * flicker;
        
        // Deep faint ambient glow matching the cone
        this.ctx.shadowColor = '#ff0000';
        this.ctx.shadowBlur = 100 * flicker;
        this.ctx.fillStyle = `rgba(100, 0, 0, ${0.15 * flicker})`;
        
        this.ctx.beginPath();
        this.ctx.moveTo(eyeX, eyeY - ambientEye / 2);
        this.ctx.lineTo(tipX, eyeY - ambientEdge / 2);
        this.ctx.lineTo(tipX, eyeY + ambientEdge / 2);
        this.ctx.lineTo(eyeX, eyeY + ambientEye / 2);
        this.ctx.fill();
        
        // Mid faint ambient glow
        this.ctx.shadowBlur = 50 * flicker;
        this.ctx.fillStyle = `rgba(180, 0, 0, ${0.15 * flicker})`;
        this.ctx.beginPath();
        this.ctx.moveTo(eyeX, eyeY - ambientEye / 4);
        this.ctx.lineTo(tipX, eyeY - ambientEdge / 4);
        this.ctx.lineTo(tipX, eyeY + ambientEdge / 4);
        this.ctx.lineTo(eyeX, eyeY + ambientEye / 4);
        this.ctx.fill();

        this.ctx.shadowBlur = 0; // reset
      }
    }

    // 2. Draw Eye Flare
    if ((this.isCharging || this.isFiring) && this.isBeamOn) {
      this.ctx.beginPath();
      this.ctx.arc(eyeX, eyeY, 12 * intensity * flicker, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.shadowColor = '#ff0000';
      this.ctx.shadowBlur = 40 * intensity;
      this.ctx.fill();
    }

    this.ctx.globalCompositeOperation = 'source-over';

    if (this.isTwinkling || this.isCharging) {
      this.rafId = requestAnimationFrame(this.render);
      return;
    }

    if (this.isFiring) {
      // Advance Laser
      if (this.laserTipX > 0) {
        this.laserTipX -= 20 * this.scaleFactor; // Slower sweep speed to match particles
      } else {
        this.laserTipX = 0;
      }

      // Spawn particles as laser passes
      if (!this.isTextDestroyed) {
        while (this.currentScanX > this.laserTipX && this.currentScanX >= 0) {
          this.spawnParticles(Math.floor(this.currentScanX));
          this.currentScanX--;
        }
      }
    }

    // Dynamically clip the DOM elements directly (prevents shifting!)
    // Skip when text is already destroyed — laserTipX resets to eye origin on scroll-back,
    // which would calculate clipRight=0 and reveal the destroyed text DOM elements.
    if (!this.isTextDestroyed) {
      for (const bound of this.domBounds) {
        const clipRight = Math.max(0, bound.rightEdge - this.laserTipX);
        // Use a generous negative margin on top/left/bottom so shadows aren't cut off abruptly
        bound.el.style.clipPath = `inset(-100px ${clipRight}px -100px -100px)`;
      }
    }

    // Reset shadow for particles
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;

    // Begin a single path for high-performance batch rendering of dust
    this.ctx.beginPath();

    let activeParticles = 0;
    const now = Date.now();

    for (let i = 0; i < this.pCount; i++) {
      let idx = i * this.STRIDE;
      let life = this.particleData[idx + 4];
      const decay = this.particleData[idx + 5];
      life -= decay;

      // Zero-Allocation Particle Removal
      if (life <= 0) {
        this.pCount--;
        if (i < this.pCount) {
          const lastIdx = this.pCount * this.STRIDE;
          for (let j = 0; j < this.STRIDE; j++) {
            this.particleData[idx + j] = this.particleData[lastIdx + j];
          }
          i--; // Re-evaluate the swapped particle
        }
        continue;
      }
      
      activeParticles++;
      
      let x = this.particleData[idx + 0];
      let y = this.particleData[idx + 1];
      let vx = this.particleData[idx + 2];
      let vy = this.particleData[idx + 3];
      const r = this.particleData[idx + 6];
      const g = this.particleData[idx + 7];
      const b = this.particleData[idx + 8];
      const size = this.particleData[idx + 9];
      const type = this.particleData[idx + 10];
      const initLife = this.particleData[idx + 11];

      // Phase Physics (Dust Only)
      if (type === 1) {
        const age = initLife - life;
        const ageInFrames = age * 60; // Rough estimate
        const gravityDelay = this.particleData[idx + 15];

        // Apply gravity only after a delay proportional to initial upward velocity
        if (ageInFrames > gravityDelay) {
          vy += 0.01;
        }

        vx *= 0.97; // Air friction
        vy *= 0.97;

        const freq = this.particleData[idx + 14];
        const phase = this.particleData[idx + 12];
        const amp = this.particleData[idx + 13];
        
        // Ensure override happens safely without fluttering into the beam
        const isLaserBlasting = (this.state === AnimState.LASER_ACTIVE && this.isFiring && this.isBeamOn && Math.abs(y - eyeY) < 40 * this.scaleFactor && x <= eyeX && x >= this.laserTipX);

        if (!isLaserBlasting) {
            x += Math.sin(now * freq + phase) * amp * this.scaleFactor; // Leaf Flutter
        }

        // Make dust particles disappear faster when the laser is firing
        if (this.isFiring) {
          life -= (1 / (2.5 * 60)); // Additional decay to make them disappear over ~2.5 seconds
        }
      }

      // Inline External Forces (Mouse Wind & Laser Blast)
      if (this.mouse.isMoving) {
        const dx = x - this.mouse.x;
        const dy = y - this.mouse.y;
        const distSq = dx * dx + dy * dy;
        const repulseRadius = (type === 1 ? 100 : 150) * this.scaleFactor;
        
        if (distSq < repulseRadius * repulseRadius) {
          const dist = Math.sqrt(distSq);
          const force = (repulseRadius - dist) / repulseRadius;
          if (type === 1) {
            vx += (dx / dist) * force * 2.0; // Pushes aside organically
            vy += (dy / dist) * force * 2.0;
          } else {
            vx += (dx / dist) * force * 1.5;
            vy += (dy / dist) * force * 1.5;
          }
        }
      }

      if (this.state === AnimState.LASER_ACTIVE && this.isFiring && this.isBeamOn && x <= eyeX && x >= this.laserTipX) {
        if (Math.abs(y - eyeY) < 40 * this.scaleFactor) { // Expanded destruction width
          vx = -25 * this.scaleFactor; // High momentum override
          if (type === 1) {
            vy += (Math.random() - 0.5) * 4;
            life -= 0.05;
          }
        }
      }

      x += vx;
      y += vy;

      this.particleData[idx + 0] = x;
      this.particleData[idx + 1] = y;
      this.particleData[idx + 2] = vx;
      this.particleData[idx + 3] = vy;
      this.particleData[idx + 4] = life;

      // Renderer
      if (type === 0) { // Text Atom
        const hotness = Math.max(0, (life - 0.7) / 0.3);
        const cr = Math.floor(r + (255 - r) * hotness);
        const cg = Math.floor(g + (255 - g) * hotness);
        const cb = Math.floor(b + (255 - b) * hotness);
        this.ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${Math.max(0, life)})`;
        // Using fillRect executes immediately and doesn't interfere with our open beginPath for the dust
        this.ctx.fillRect(x, y, size, size);
      } else { // Dust Grain
        // Batched path building, size scaling handles visual fade avoiding alpha changes
        const currentSize = Math.max(0, size * (life / initLife));
        this.ctx.rect(x, y, currentSize, currentSize);
      }
    }
    
    // Executing the massive batch draw call globally
    this.ctx.fillStyle = 'rgba(180, 180, 180, 0.4)';
    this.ctx.fill();

    if (this.laserTipX <= 0) { // Text is considered destroyed once the laser has passed
      this.isTextDestroyed = true;
    }
    this.ctx.globalAlpha = 1.0;

    // Draw Laser Beam (Tapered Geometric Polygons)
    const tipX = this.laserTipX;
    const tipY = this.laserOrigin.y;

    // Only draw the beam out to the left (avoiding drawing backwards behind the head)
    if (this.isFiring && this.isBeamOn && tipX < eyeX) {
      this.ctx.globalCompositeOperation = 'screen';

      // Scale the cone expansion directly to the distance traveled so they are perfectly synced.
      // Using a cubic ease-in (Math.pow(..., 3)) ensures it shoots out as a uniform line first before fanning open.
      const totalDistance = eyeX || 1;
      const traveled = eyeX - tipX;
      const rawProgress = Math.max(0, Math.min(1, traveled / totalDistance));
      const expandProgress = Math.pow(rawProgress, 3);

      const coreEye = 4 * flicker;
      const coreEdge = (4 + 76 * expandProgress) * flicker;
      const glowEye = 20 * flicker;
      const glowEdge = (20 + 380 * expandProgress) * flicker;

      // Create linear gradients to fade the beam at its tip for a natural falloff
      const redGlowGradient = this.ctx.createLinearGradient(eyeX, eyeY, tipX, tipY);
      redGlowGradient.addColorStop(0, `rgba(255, 0, 0, ${0.8 * flicker})`);
      redGlowGradient.addColorStop(1, 'rgba(255, 0, 0, 0)');

      const whiteCoreGradient = this.ctx.createLinearGradient(eyeX, eyeY, tipX, tipY);
      whiteCoreGradient.addColorStop(0, `rgba(255, 255, 255, ${0.9 * flicker})`);
      whiteCoreGradient.addColorStop(0.8, `rgba(255, 255, 255, ${0.5 * flicker})`);
      whiteCoreGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      const strokeGradient = this.ctx.createLinearGradient(eyeX, eyeY, tipX, tipY);
      strokeGradient.addColorStop(0, `rgba(255, 20, 20, ${0.7 * flicker})`);
      strokeGradient.addColorStop(1, 'rgba(255, 20, 20, 0)');

      // 1. Draw Massive Outer Red Glow
      this.ctx.shadowColor = '#ff0000';
      this.ctx.shadowBlur = 60 * flicker;
      this.ctx.fillStyle = redGlowGradient;
      this.ctx.beginPath();
      this.ctx.moveTo(eyeX, eyeY - glowEye / 2);
      this.ctx.lineTo(tipX, tipY - glowEdge / 2);
      this.ctx.lineTo(tipX, tipY + glowEdge / 2);
      this.ctx.lineTo(eyeX, eyeY + glowEye / 2);
      this.ctx.fill();

      // 2. Draw Searing White Core
      this.ctx.shadowColor = '#ffffff';
      this.ctx.shadowBlur = 20 * flicker;
      this.ctx.fillStyle = whiteCoreGradient;
      this.ctx.beginPath();
      this.ctx.moveTo(eyeX, eyeY - coreEye / 2);
      this.ctx.lineTo(tipX, tipY - coreEdge / 2);
      this.ctx.lineTo(tipX, tipY + coreEdge / 2);
      this.ctx.lineTo(eyeX, eyeY + coreEye / 2);
      this.ctx.fill();

      // 3. Draw Faint Red Outline around the core
      this.ctx.closePath();
      this.ctx.shadowColor = '#ff0000';
      this.ctx.shadowBlur = 15 * flicker;
      this.ctx.strokeStyle = strokeGradient;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      this.ctx.globalCompositeOperation = 'source-over';
    }

    // Stop the animation loop completely if everything is done
    if (!this.isFiring && activeParticles === 0 && !this.isCharging && !this.isTwinkling) {
      if (this.isTextDestroyed) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
      this.setState(AnimState.IDLE);
      this.stopEngine();
      this.pCount = 0; // Nullify arrays
      return;
    }

    this.rafId = requestAnimationFrame(this.render);
  }

  /** Suspend rendering + clear live particles without destroying pixel data.
   *  The controller remains restartable (reset() + setState() still work). */
  public pause() {
    this.stopEngine();
    this.isFiring   = false;
    this.isCharging = false;
    this.isTwinkling = false;
    this.pCount     = 0;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  public cleanup() {
    this.stopEngine();
    window.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    this.pCount = 0;
    this.pixelColumns = [];
    (this.textCanvas as any) = null;
    this.domBounds = [];

    if (this.scrollObserver) {
      this.scrollObserver.disconnect();
      this.scrollObserver = null;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    console.log('AnimationController cleaned up.');
  }
}