import type { ReactElement } from 'react';
import type { Suit } from '@pm/engine';

// Small original glyphs for suits, resources and keywords. 24×24 grid, currentColor.

const P: Record<string, ReactElement> = {
  // suits
  earth: <path d="M12 21V8M12 8c0-3 2-5 5-5 0 3-2 5-5 5zm0 4c0-3-2-5-5-5 0 3 2 5 5 5zm0 4c0-3 2-5 5-5 0 3-2 5-5 5z" />,
  stone: <path d="M3 20h18M4 20v-5h7v5M13 20v-5h7v5M7 15v-5h10v5" />,
  bronze: <path d="M12 2l3 7-3 3-3-3 3-7zM12 12v10M8 18h8" />,
  silk: <path d="M3 12c3-6 6 6 9 0s6 6 9 0M3 7c3-4 6 4 9 0s6 4 9 0M3 17c3-4 6 4 9 0s6 4 9 0" />,
  star: <path d="M12 2l2.4 6.6L21 9l-5 4.4L17.5 21 12 17l-5.5 4L8 13.4 3 9l6.6-.4L12 2z" />,
  shadow: <path d="M15 3a9 9 0 1 0 6 15A7 7 0 0 1 15 3zM9 11h.01" />,
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

export const SUIT_LABEL: Record<Suit, string> = {
  earth: 'Earth', stone: 'Stone', bronze: 'Bronze', silk: 'Silk', star: 'Star', shadow: 'Shadow',
};

export const SUIT_COLOR: Record<Suit, string> = {
  earth: '#8fb35a', stone: '#b9ab94', bronze: '#d08a4a', silk: '#5fb3c9', star: '#e7c766', shadow: '#a58ad6',
};
