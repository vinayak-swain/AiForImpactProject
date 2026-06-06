import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const useInteractions = () => {
  const location = useLocation();

  useEffect(() => {
    // 1. Magnetic CTA buttons setup
    const buttons = document.querySelectorAll('.magnetic-cta, button.bg-primary, button.bg-accent, .btn-primary');
    
    const handleMouseMove = (e: MouseEvent) => {
      const button = e.currentTarget as HTMLElement;
      const rect = button.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      const multiplier = 0.15;
      const dx = x * multiplier;
      const dy = y * multiplier;
      
      const dist = Math.sqrt(dx * dx + dy * dy);
      const cap = 6; // Cap at 6px maximum displacement
      
      if (dist > cap) {
        const ratio = cap / dist;
        button.style.transform = `translate(${dx * ratio}px, ${dy * ratio}px)`;
      } else {
        button.style.transform = `translate(${dx}px, ${dy}px)`;
      }
    };
    
    const handleMouseLeave = (e: MouseEvent) => {
      const button = e.currentTarget as HTMLElement;
      button.style.transform = 'translate(0px, 0px)';
    };

    buttons.forEach((btn) => {
      btn.addEventListener('mousemove', handleMouseMove as EventListener);
      btn.addEventListener('mouseleave', handleMouseLeave as EventListener);
    });

    // 2. Section entrance animations using IntersectionObserver
    const sections = document.querySelectorAll('section, .fade-up-target');
    
    const observerOptions = {
      root: null,
      threshold: 0.1,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    sections.forEach((sec) => {
      sec.classList.add('fade-up-entry');
      observer.observe(sec);
    });

    return () => {
      buttons.forEach((btn) => {
        btn.removeEventListener('mousemove', handleMouseMove as EventListener);
        btn.removeEventListener('mouseleave', handleMouseLeave as EventListener);
      });
      observer.disconnect();
    };
  }, [location]);
};
