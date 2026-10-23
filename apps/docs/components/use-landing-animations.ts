'use client';

import { useEffect, type RefObject } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/** Adds the landing page entrance and scroll-reveal animations. */
export function useLandingAnimations(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const context = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: 'power3.out', duration: 0.8 } })
        .from('[data-gsap="header"]', { y: -20, opacity: 0, duration: 0.6 })
        .from('[data-gsap="hero-copy"] > *', { y: 28, opacity: 0, stagger: 0.09 }, '-=0.2')
        .from(
          '[data-gsap="hero-visual"]',
          { y: 36, opacity: 0, scale: 0.985, duration: 1 },
          '-=0.55',
        )
        .from('[data-gsap="hero-waves"]', { opacity: 0, duration: 1.4 }, 0);

      gsap.utils.toArray<HTMLElement>('[data-gsap="section"]').forEach((element) => {
        gsap.from(element, {
          y: 32,
          opacity: 0,
          duration: 0.85,
          ease: 'power3.out',
          scrollTrigger: { trigger: element, start: 'top 88%', once: true },
        });
      });

      const bento = root.querySelector<HTMLElement>('[data-gsap="bento"]');
      if (bento) {
        gsap.from(bento.querySelectorAll('.magic-bento__cell'), {
          y: 24,
          opacity: 0,
          scale: 0.98,
          duration: 0.7,
          stagger: 0.07,
          ease: 'power3.out',
          scrollTrigger: { trigger: bento, start: 'top 85%', once: true },
        });
      }

      gsap.from('.mink-faq-item', {
        y: 20,
        opacity: 0,
        duration: 0.65,
        stagger: 0.08,
        ease: 'power3.out',
        scrollTrigger: { trigger: '#faq', start: 'top 85%', once: true },
      });

      gsap.to('[data-gsap="hero-waves"]', {
        yPercent: 8,
        ease: 'none',
        scrollTrigger: {
          trigger: '[data-gsap="hero-section"]',
          start: 'top top',
          end: 'bottom top',
          scrub: 0.6,
        },
      });
    }, root);

    return () => context.revert();
  }, [rootRef]);
}
