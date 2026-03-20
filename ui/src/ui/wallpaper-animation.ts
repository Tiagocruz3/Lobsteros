// ===========================================
// High-Tech Live Wallpaper Animation
// Cyberpunk-style animated background
// ===========================================

import { html, nothing } from "lit";

// Animation state
let animationFrameId: number | null = null;
let particles: Array<{
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  speed: number;
}> = [];

let gridOffset = 0;
let scanLinePos = 0;

// Initialize particles
function initParticles(count: number, width: number, height: number) {
  particles = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      size: Math.random() * 2 + 1,
      alpha: Math.random() * 0.5 + 0.2,
      speed: Math.random() * 0.02 + 0.01,
    });
  }
}

// Update particle positions
function updateParticles(width: number, height: number) {
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.alpha += Math.sin(Date.now() * p.speed) * 0.01;
    
    // Wrap around
    if (p.x < 0) p.x = width;
    if (p.x > width) p.x = 0;
    if (p.y < 0) p.y = height;
    if (p.y > height) p.y = 0;
    
    // Clamp alpha
    p.alpha = Math.max(0.1, Math.min(0.8, p.alpha));
  });
}

// Render SVG wallpaper
export function renderWallpaper() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  // Initialize particles on first render
  if (particles.length === 0) {
    initParticles(50, width, height);
  }
  
  return html`
    <div class="live-wallpaper">
      <!-- Base gradient -->
      <div class="wallpaper-gradient"></div>
      
      <!-- Cyber grid -->
      <svg class="cyber-grid" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <defs>
          <pattern id="grid-pattern" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255, 51, 51, 0.08)" stroke-width="1"/>
          </pattern>
          <linearGradient id="grid-fade" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(255, 51, 51, 0.3)"/>
            <stop offset="50%" stop-color="rgba(255, 51, 51, 0.05)"/>
            <stop offset="100%" stop-color="transparent"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-pattern)" />
        <rect width="100%" height="40%" fill="url(#grid-fade)" opacity="0.5"/>
      </svg>
      
      <!-- Moving horizontal lines -->
      <div class="moving-lines">
        ${Array.from({ length: 5 }, (_, i) => html`
          <div class="moving-line" style="animation-delay: ${i * 2}s; top: ${20 + i * 15}%;"></div>
        `)}
      </div>
      
      <!-- Floating particles -->
      <canvas id="particle-canvas" class="particle-canvas"></canvas>
      
      <!-- Scan lines -->
      <div class="scan-lines"></div>
      
      <!-- Scan line sweep -->
      <div class="scan-sweep"></div>
      
      <!-- Corner accents -->
      <div class="corner-accent corner-tl"></div>
      <div class="corner-accent corner-tr"></div>
      <div class="corner-accent corner-bl"></div>
      <div class="corner-accent corner-br"></div>
      
      <!-- Hex pattern overlay -->
      <svg class="hex-pattern" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <pattern id="hexes" width="20" height="17.32" patternUnits="userSpaceOnUse" patternTransform="scale(2)">
            <path d="M10 0 L20 5.77 L20 17.32 L10 23.09 L0 17.32 L0 5.77 Z" 
                  fill="none" stroke="rgba(255, 51, 51, 0.03)" stroke-width="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hexes)" />
      </svg>
      
      <!-- Glowing orbs -->
      <div class="glow-orb glow-orb-1"></div>
      <div class="glow-orb glow-orb-2"></div>
      <div class="glow-orb glow-orb-3"></div>
      
      <!-- Data streams -->
      <div class="data-streams">
        ${Array.from({ length: 8 }, (_, i) => html`
          <div class="data-stream" style="left: ${10 + i * 12}%; animation-delay: ${i * 0.5}s;">
            ${Array.from({ length: 20 }, () => html`
              <span class="data-bit">${Math.random() > 0.5 ? '1' : '0'}</span>
            `)}
          </div>
        `)}
      </div>
      
      <!-- Radial gradient overlay -->
      <div class="radial-overlay"></div>
      
      <!-- Centered High-Tech Lobster Logo -->
      <div class="center-logo">
        <svg viewBox="0 0 200 200" class="center-logo__svg">
          <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ff3333"/>
              <stop offset="50%" stop-color="#ff6666"/>
              <stop offset="100%" stop-color="#ff3333"/>
            </linearGradient>
            <filter id="logoGlow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <filter id="logoGlowStrong">
              <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          <!-- Tech ring outer -->
          <circle cx="100" cy="100" r="95" fill="none" stroke="rgba(255, 51, 51, 0.2)" stroke-width="1"/>
          <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(255, 51, 51, 0.3)" stroke-width="2"/>
          
          <!-- Tech segments -->
          <path d="M100 5 L100 15 M100 185 L100 195 M5 100 L15 100 M185 100 L195 100" 
                stroke="rgba(255, 51, 51, 0.4)" stroke-width="2"/>
          
          <!-- Lobster body -->
          <ellipse cx="100" cy="100" rx="35" ry="50" fill="url(#logoGradient)" opacity="0.9" filter="url(#logoGlow)"/>
          
          <!-- Lobster claws -->
          <ellipse cx="55" cy="75" rx="20" ry="28" fill="url(#logoGradient)" opacity="0.85" transform="rotate(-30 55 75)" filter="url(#logoGlow)"/>
          <ellipse cx="145" cy="75" rx="20" ry="28" fill="url(#logoGradient)" opacity="0.85" transform="rotate(30 145 75)" filter="url(#logoGlow)"/>
          
          <!-- Lobster tail segments -->
          <ellipse cx="100" cy="145" rx="25" ry="15" fill="url(#logoGradient)" opacity="0.8" filter="url(#logoGlow)"/>
          <ellipse cx="100" cy="165" rx="20" ry="12" fill="url(#logoGradient)" opacity="0.7" filter="url(#logoGlow)"/>
          <ellipse cx="100" cy="180" rx="15" ry="8" fill="url(#logoGradient)" opacity="0.6" filter="url(#logoGlow)"/>
          
          <!-- Antennae -->
          <path d="M85 60 Q70 30 60 20" stroke="rgba(255, 100, 100, 0.8)" stroke-width="2" fill="none"/>
          <path d="M115 60 Q130 30 140 20" stroke="rgba(255, 100, 100, 0.8)" stroke-width="2" fill="none"/>
          
          <!-- Eyes -->
          <circle cx="90" cy="85" r="4" fill="#fff" opacity="0.9"/>
          <circle cx="110" cy="85" r="4" fill="#fff" opacity="0.9"/>
          <circle cx="91" cy="84" r="2" fill="#000"/>
          <circle cx="111" cy="84" r="2" fill="#000"/>
          
          <!-- Tech inner ring -->
          <circle cx="100" cy="100" r="55" fill="none" stroke="rgba(255, 51, 51, 0.4)" stroke-width="1" stroke-dasharray="10 5"/>
          
          <!-- Rotating tech elements -->
          <g class="rotating-ring">
            <circle cx="100" cy="100" r="75" fill="none" stroke="rgba(255, 51, 51, 0.15)" stroke-width="1" stroke-dasharray="20 40"/>
          </g>
          
          <!-- Lobster text -->
          <text x="100" y="115" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold" letter-spacing="2" opacity="0.9">LOBSTER</text>
        </svg>
        <div class="center-logo__glow"></div>
      </div>
    </div>
  `;
}

// Start animation loop
export function startWallpaperAnimation() {
  const canvas = document.getElementById('particle-canvas') as HTMLCanvasElement;
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initParticles(50, canvas.width, canvas.height);
  };
  
  resize();
  window.addEventListener('resize', resize);
  
  function animate() {
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Update and draw particles
    updateParticles(canvas.width, canvas.height);
    
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 51, 51, ${p.alpha})`;
      ctx.fill();
      
      // Draw connections
      particles.forEach(p2 => {
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(255, 51, 51, ${0.1 * (1 - dist / 100)})`;
          ctx.stroke();
        }
      });
    });
    
    animationFrameId = requestAnimationFrame(animate);
  }
  
  animate();
  
  // Return cleanup function
  return () => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    window.removeEventListener('resize', resize);
  };
}

// Stop animation
export function stopWallpaperAnimation() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}
