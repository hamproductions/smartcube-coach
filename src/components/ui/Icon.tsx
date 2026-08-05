// Ported from poliva/cubedex, src/components/ui/Icon.tsx
// https://github.com/poliva/cubedex — MIT License, Copyright (c) 2024 Pau Oliva Fora.
// Icon paths extended with this app's own nav set (today/library/progress); the
// `Icon`/`IC` shape and the Bluetooth glyph are copied as-is.

export const IC = {
  today: 'M3 3h18v18H3zM3 9h18M9 21V9',
  live: 'M5 3l14 9-14 9V3z',
  solves: 'M4 6h16M4 10h16M4 14h16M4 18h16',
  train: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  ],
  library: 'M9.5 7.5L14.5 12.5M14.5 7.5L9.5 12.5M19 21V7.8C19 6.11984 19 5.27976 18.673 4.63803C18.3854 4.07354 17.9265 3.6146 17.362 3.32698C16.7202 3 15.8802 3 14.2 3H9.8C8.11984 3 7.27976 3 6.63803 3.32698C6.07354 3.6146 5.6146 4.07354 5.32698 4.63803C5 5.27976 5 6.11984 5 7.8V21L12 17L19 21Z',
  progress: 'M4 19V10M12 19V4M20 19v-7',
  play: 'M5 3l14 9-14 9V3z',
  stop: 'M6 6h12v12H6z',
} as const;

interface IconProps {
  d: string | readonly string[];
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function Icon({ d, size = 16, strokeWidth = 1.8, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d as string} />}
    </svg>
  );
}

export function BluetoothIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="currentColor" viewBox="0 0 32 32" aria-hidden>
      <path d="M16 2C12.886719 2 10.03125 2.742188 8.03125 4.96875C6.03125 7.195313 5 10.714844 5 16C5 21.285156 6.03125 24.804688 8.03125 27.03125C10.03125 29.257813 12.886719 30 16 30C19.113281 30 21.972656 29.257813 23.96875 27.03125C25.964844 24.804688 27 21.285156 27 16C27 10.714844 25.964844 7.195313 23.96875 4.96875C21.972656 2.742188 19.113281 2 16 2ZM16 4C18.808594 4 20.945313 4.617188 22.46875 6.3125C23.992188 8.007813 25 10.980469 25 16C25 21.019531 23.992188 23.992188 22.46875 25.6875C20.945313 27.382813 18.808594 28 16 28C13.191406 28 11.054688 27.382813 9.53125 25.6875C8.007813 23.992188 7 21.019531 7 16C7 10.980469 8.007813 8.007813 9.53125 6.3125C11.054688 4.617188 13.191406 4 16 4ZM15 7L15 13.5625L12.71875 11.28125L11.28125 12.71875L14.5625 16L11.28125 19.28125L12.71875 20.71875L15 18.4375L15 25L16.59375 23.8125L20.59375 20.8125L21.53125 20.09375L17.4375 16L21.53125 11.90625L20.59375 11.1875L16.59375 8.1875ZM17 11L18.46875 12.09375L17 13.5625ZM17 18.4375L18.46875 19.90625L17 21Z" />
    </svg>
  );
}
