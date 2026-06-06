import React, { useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

interface Particle {
  x: number;
  y: number;
  baseX: number;
  size: number;
  type: 'dot' | 'hexagon' | 'triangle';
  opacity: number;
  speedY: number;
  speedX: number;
  angle: number;
  angleSpeed: number;
  color: string;
  isBurst?: boolean;
  burstDecay?: number;
}

export const ParticleBackground: React.FC<{ theme?: string }> = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    const isMobile = window.innerWidth < 768;
    const maxParticles = isMobile ? 45 : 110;

    // Mouse coordinates tracker
    const mouse = { x: -1000, y: -1000, active: false };

    // Scroll acceleration tracker
    let scrollVelocity = 0;
    let lastScrollY = window.scrollY;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resize);
    resize();

    // Color selectors based on active theme
    const getColors = (currentTheme: string) => {
      if (currentTheme === 'dark') {
        return ['#00f5ff', '#4d9fff', '#ffffff']; // cyan, electric blue, white highlights
      } else {
        return ['#6366f1', '#a78bfa', '#cbd5e1']; // indigo, lavender, warm gray
      }
    };

    // Helper to initialize a single particle
    const createParticle = (x?: number, y?: number, isBurst = false): Particle => {
      const colors = getColors(theme);
      const randColor = colors[Math.floor(Math.random() * colors.length)];
      const types: Array<'dot' | 'hexagon' | 'triangle'> = ['dot', 'hexagon', 'triangle'];
      const pType = types[Math.floor(Math.random() * types.length)];
      
      const pSize = Math.random() * 6 + 2; // 2px to 8px
      const px = x ?? Math.random() * canvas.width;
      const py = y ?? Math.random() * canvas.height;

      if (isBurst) {
        // Burst particle configuration
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 3;
        return {
          x: px,
          y: py,
          baseX: px,
          size: pSize,
          type: pType,
          opacity: Math.random() * 0.6 + 0.4,
          speedX: Math.cos(angle) * speed,
          speedY: Math.sin(angle) * speed,
          angle: 0,
          angleSpeed: Math.random() * 0.05 + 0.01,
          color: randColor,
          isBurst: true,
          burstDecay: 0.93
        };
      }

      return {
        x: px,
        y: py,
        baseX: px,
        size: pSize,
        type: pType,
        opacity: Math.random() * 0.6 + 0.2, // 0.2 to 0.8
        speedY: Math.random() * 0.5 + 0.2, // slowly floating upward
        speedX: (Math.random() - 0.5) * 0.2,
        angle: Math.random() * Math.PI,
        angleSpeed: Math.random() * 0.02 + 0.005,
        color: randColor
      };
    };

    // Populate initial particles
    for (let i = 0; i < maxParticles; i++) {
      particles.push(createParticle());
    }

    // Hexagon renderer helper
    const drawHexagon = (c: CanvasRenderingContext2D, x: number, y: number, size: number) => {
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        c.lineTo(x + size * Math.cos(angle), y + size * Math.sin(angle));
      }
      c.closePath();
      c.fill();
    };

    // Triangle renderer helper
    const drawTriangle = (c: CanvasRenderingContext2D, x: number, y: number, size: number) => {
      c.beginPath();
      c.moveTo(x, y - size);
      c.lineTo(x - size, y + size);
      c.lineTo(x + size, y + size);
      c.closePath();
      c.fill();
    };

    // Animation Loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Decelerate scroll velocity
      scrollVelocity *= 0.95;

      particles.forEach((p, index) => {
        if (p.isBurst && p.burstDecay) {
          // Update burst physics
          p.x += p.speedX;
          p.y += p.speedY;
          p.speedX *= p.burstDecay;
          p.speedY *= p.burstDecay;

          // Decay burst status to float normally
          if (Math.abs(p.speedX) < 0.1 && Math.abs(p.speedY) < 0.1) {
            p.isBurst = false;
            p.speedY = Math.random() * 0.5 + 0.2;
            p.speedX = (Math.random() - 0.5) * 0.2;
            p.baseX = p.x;
          }
        } else {
          // Normal floating upward and sine wave drift
          p.angle += p.angleSpeed;
          p.baseX += p.speedX;
          
          // Apply scroll lift factor
          const lift = p.speedY + Math.max(0, scrollVelocity * 0.08);
          p.y -= lift;

          // Sine oscillation drift
          p.x = p.baseX + Math.sin(p.angle) * 12;
        }

        // Mouse interaction: Repel force within 120px radius
        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const repelRadius = 120;

          if (distance < repelRadius) {
            const force = (repelRadius - distance) / repelRadius;
            const angle = Math.atan2(dy, dx);
            const repelAmount = force * 4;
            
            p.x += Math.cos(angle) * repelAmount;
            p.y += Math.sin(angle) * repelAmount;
            if (!p.isBurst) {
              p.baseX += Math.cos(angle) * repelAmount;
            }
          }
        }

        // Recycling particles exiting viewport
        if (p.y < -20) {
          // If a burst particle exits, we can remove it to stabilize count
          if (p.isBurst && particles.length > maxParticles) {
            particles.splice(index, 1);
            return;
          }
          p.y = canvas.height + 20;
          p.baseX = Math.random() * canvas.width;
          p.x = p.baseX;
          p.opacity = Math.random() * 0.6 + 0.2;
        }

        // Draw particle based on its type
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;

        // Apply glow effect in dark mode
        if (theme === 'dark') {
          ctx.shadowBlur = 8;
          ctx.shadowColor = p.color;
        } else {
          ctx.shadowBlur = 0;
        }

        if (p.type === 'hexagon') {
          drawHexagon(ctx, p.x, p.y, p.size);
        } else if (p.type === 'triangle') {
          drawTriangle(ctx, p.x, p.y, p.size);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Reset shadows and alpha
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;
      animationFrameId = requestAnimationFrame(animate);
    };

    // Listeners
    let mouseThrottler = false;
    const handleMouseMove = (e: MouseEvent) => {
      if (!mouseThrottler) {
        mouseThrottler = true;
        requestAnimationFrame(() => {
          mouse.x = e.clientX;
          mouse.y = e.clientY;
          mouse.active = true;
          mouseThrottler = false;
        });
      }
    };

    const handleMouseLeave = () => {
      mouse.active = false;
    };

    const handleClick = (e: MouseEvent) => {
      const burstCount = 18;
      for (let i = 0; i < burstCount; i++) {
        particles.push(createParticle(e.clientX, e.clientY, true));
      }
    };

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const diff = Math.abs(currentScrollY - lastScrollY);
      scrollVelocity += diff * 0.15;
      lastScrollY = currentScrollY;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('click', handleClick);
    window.addEventListener('scroll', handleScroll, { passive: true });

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none'
      }}
    />
  );
};
