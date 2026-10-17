import { useEffect, useRef } from 'react';

export function CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const glow = glowRef.current;
    if (!glow) return;

    let rafId: number | null = null;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const onMouseMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      glow.style.opacity = '1';
      if (rafId === null) {
        rafId = requestAnimationFrame(animate);
      }
    };

    const onMouseLeave = () => {
      glow.style.opacity = '0';
    };

    const animate = () => {
      currentX += (targetX - currentX) * 0.1;
      currentY += (targetY - currentY) * 0.1;
      glow.style.left = `${currentX}px`;
      glow.style.top = `${currentY}px`;
      if (Math.abs(targetX - currentX) > 0.5 || Math.abs(targetY - currentY) > 0.5) {
        rafId = requestAnimationFrame(animate);
      } else {
        rafId = null;
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    document.body.addEventListener('mouseleave', onMouseLeave);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      document.body.removeEventListener('mouseleave', onMouseLeave);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return <div ref={glowRef} className="cursor-glow" style={{ opacity: 0, left: 0, top: 0 }} />;
}
