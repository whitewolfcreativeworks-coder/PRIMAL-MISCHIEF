import type { ReactElement } from 'react';
import type { Family } from '@pm/engine';

// Small original glyphs for suits, resources and keywords. 24×24 grid, currentColor.

const P: Record<string, ReactElement> = {
  // suits
  earth: <path d="M12 21V8M12 8c0-3 2-5 5-5 0 3-2 5-5 5zm0 4c0-3-2-5-5-5 0 3 2 5 5 5zm0 4c0-3 2-5 5-5 0 3-2 5-5 5z" />,
  stone: <path d="M3 20h18M4 20v-5h7v5M13 20v-5h7v5M7 15v-5h10v5" />,
  bronze: <path d="M12 2l3 7-3 3-3-3 3-7zM12 12v10M8 18h8" />,
  silk: <path d="M3 12c3-6 6 6 9 0s6 6 9 0M3 7c3-4 6 4 9 0s6 4 9 0M3 17c3-4 6 4 9 0s6 4 9 0" />,
  star: <path d="M12 2l2.4 6.6L21 9l-5 4.4L17.5 21 12 17l-5.5 4L8 13.4 3 9l6.6-.4L12 2z" />,
  shadow: <path d="M15 3a9 9 0 1 0 6 15A7 7 0 0 1 15 3zM9 11h.01" />,
  // families
  civ: <path d="M3 21h18M5 21V11M9 21V11M15 21V11M19 21V11M3 11l9-7 9 7H3z" />,
  mil: <path d="M14.5 3L21 3v6.5L9 21l-6-6L14.5 3zM5 13l6 6M16 8l-4 4" />,
  prosperity: <path d="M8 4h8M9 4c0 3-4 4-4 9a7 7 0 0 0 14 0c0-5-4-6-4-9M9 13h6" />,
  progress: <path d="M3 20h4v-4h4v-4h4V8h4V4M15 4h4v4" />,
  growth: <path d="M12 21V11M12 11c0-4 3-7 7-7 0 4-3 7-7 7zm0 3c0-3-2-5-5-5 0 3 2 5 5 5z" />,
  upkeep: <path d="M12 3v18M7 8h7a3 3 0 0 1 0 6H8M5 21l3-3M19 21l-3-3" />,
  river: <path d="M2 8c3-2 5 2 8 0s5 2 8 0 3 0 4 0M2 14c3-2 5 2 8 0s5 2 8 0 3 0 4 0" />,
  // resources
  goods: <path d="M8 4h8M9 4c0 3-4 4-4 9a7 7 0 0 0 14 0c0-5-4-6-4-9M9 13h6" />,
  food: <path d="M12 22V9M12 9c-3 0-5-2-5-5 3 0 5 2 5 5zm0 0c3 0 5-2 5-5-3 0-5 2-5 5zm0 6c-3 0-5-2-5-5 3 0 5 2 5 5zm0 0c3 0 5-2 5-5-3 0-5 2-5 5z" />,
  stability: <path d="M4 21h16M6 21V9M10 21V9M14 21V9M18 21V9M3 9h18L12 3 3 9z" />,
  legacy: <path d="M12 3l2 5 5 .5-4 3.5 1.5 5L12 14l-4.5 3 1.5-5-4-3.5 5-.5 2-5zM5 21c2-2 4-3 7-3s5 1 7 3" />,
  momentum: <path d="M4 6l6 6-6 6M12 6l6 6-6 6" />,
  str: <path d="M14.5 3L21 3v6.5L9 21l-6-6L14.5 3zM5 13l6 6" />,
  hp: <path d="M12 21C5 16 3 12 3 8.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 9 2.5C21 12 19 16 12 21z" />,
  integrity: <path d="M12 2l8 4v6c0 5-4 8-8 10-4-2-8-5-8-10V6l8-4z" />,
  deck: <path d="M7 3h11v15H7zM4 6v15h11" />,
  hand: <path d="M4 18l3-12 7 2-3 12zM10 6l8-1 2 12-7 1" />,
  unrest: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
  broken: <path d="M9 7H6a5 5 0 0 0 0 10h3M15 7h3a5 5 0 0 1 0 10h-3M8 12h2M14 12h2M12 3v3M12 18v3" />,
  sword: <path d="M14.5 3L21 3v6.5L9 21l-6-6L14.5 3z" />,
  sound: <path d="M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />,
  mute: <path d="M4 9h4l5-4v14l-5-4H4zM17 9l5 6M22 9l-5 6" />,
  info: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 11v6M12 7h.01" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  city: <path d="M3 21h18M5 21V10l4-3 4 3v11M13 21V6l3-3 3 3v15M8 14h2M16 10h0" />,
  worker: <path d="M12 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM5 21v-3a7 7 0 0 1 14 0v3M9 15l3 3 3-3" />,
  role_spear: <path d="M5 21L19 5M19 5l-5 1 4 4 1-5zM8 14l2 2" />,
  role_rider: <path d="M4 20l3-6 4-1 3-5 4-2 2 3-3 2-1 4-5 2-1 3M14 8l1-3" />,
  role_archer: <path d="M6 3c8 3 8 15 0 18M6 3v18M4 12h16M17 9l3 3-3 3" />,
  role_shield: <path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6l7-3zM12 3v18" />,
  role_siege: <path d="M3 17h13M16 14l5 3-5 3M6 17v-5h8v5M5 20a1.5 1.5 0 1 0 0 .1M13 20a1.5 1.5 0 1 0 0 .1" />,
  role_skirmisher: <path d="M13 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM8 21l3-6 3 2v4M11 15l1-5 4 3 3-1M12 10l-4 1-2 3" />,
  role_raider: <path d="M3 15c4 3 14 3 18 0M5 15l2-6h10l2 6M12 9V4l4 2-4 2" />,
  trap: <path d="M5 20h14M7 20l1.5-9h7L17 20M9 11l3-7 3 7M12 15v2" />,
  wifi: <path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01" />,
};

export function Icon({ name, size = 16, className, title }: { name: string; size?: number; className?: string; title?: string }) {
  return (
    <svg className={`icon ${className ?? ''}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      {P[name] ?? P.info}
    </svg>
  );
}

export const FAMILY_LABEL: Record<Family, string> = { civ: 'Civilization', mil: 'Military' };
export const FAMILY_COLOR: Record<Family, string> = { civ: '#e3c46f', mil: '#e07a5a' };
export const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
