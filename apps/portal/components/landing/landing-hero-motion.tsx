'use client';

import { useEffect } from 'react';

export function LandingHeroMotion() {
  useEffect(() => {
    const stage = document.querySelector('.stage');
    if (!stage || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const islands = [...stage.querySelectorAll('.island')];
    const connectors = stage.querySelector('.connectors');
    const pins = [...stage.querySelectorAll('.pin')];
    const cards = [...stage.querySelectorAll('.listing-card')];

    const animations: Animation[] = [];
    const spring = 'cubic-bezier(.34,1.35,.64,1)';

    islands.forEach((el, index) => animations.push(el.animate(
      [{ opacity: 0, transform: 'translateY(26px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { delay: [80, 460, 840, 1220][index], duration: 920, easing: spring, fill: 'both' },
    )));

    if (connectors) animations.push(connectors.animate([{ opacity: 0 }, { opacity: 1 }], { delay: 1700, duration: 700, fill: 'both' }));

    pins.forEach((el, index) => {
      animations.push(el.animate([{ opacity: 0, transform: 'translateY(-16px)' }, { opacity: 1, transform: 'translateY(0)' }], { delay: 1950 + index * 180, duration: 760, easing: spring, fill: 'both' }));
      animations.push(el.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-5px)' }], { delay: 2850 + index * 380, duration: 1500, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' }));
    });

    const pos = { top: [260,135], left: [115,325], right: [405,325], bottom: [260,465] };
    const origin = [23,30];
    const at = ([x,y]: number[], opacity: number) => ({ opacity, transform: `translate(${x-origin[0]}px,${y-origin[1]}px) scale(1)` });
    const routes = [
      [pos.top, pos.left, pos.bottom, 2500],
      [pos.top, pos.right, pos.bottom, 4500],
      [pos.top, pos.left, pos.bottom, 6500],
    ] as const;

    cards.forEach((el, index) => {
      const [top, mid, bottom, delay] = routes[index];
      const frames = [at(top, 0), at(top, 1), at(mid, 1), at(bottom, 1), at(bottom, 0)];
      frames.forEach((frame, i) => { (frame as Keyframe).offset = [0, .1, .5, .9, 1][i]; });
      animations.push(el.animate(frames, { delay, duration: 6000, iterations: Infinity, easing: 'ease-in-out', fill: 'both' }));
    });

    return () => animations.forEach((animation) => animation.cancel());
  }, []);

  return null;
}
