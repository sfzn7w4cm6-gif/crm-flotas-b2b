const PATHS: Record<string, string> = {
  home: 'M3 11.5 12 4l9 7.5M5 10v9.5a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10',
  add: 'M12 5v14M5 12h14',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  dashboard: 'M4 4h7v8H4zM13 4h7v5h-7zM13 12h7v8h-7zM4 15h7v5H4z',
  check: 'm5 13 4 4L19 7',
  people: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20c0-3 3-5 6-5s6 2 6 5M17 11a2.5 2.5 0 1 0 0-5M15 20c.3-2.5 2.3-4.2 4.5-4.6',
  settings:
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V19.6a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.1-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1H4.4a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H10.5a1.7 1.7 0 0 0 1-1.56V4.4a2 2 0 1 1 4 0v.09c0 .68.39 1.29 1 1.56.63.27 1.36.14 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09c.27.61.88 1 1.56 1h.1a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1Z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6l12 12M18 6L6 18',
  chevronDown: 'm6 9 6 6 6-6',
  chevronRight: 'm9 6 6 6-6 6',
  chevronLeft: 'm15 6-6 6 6 6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20c0-4 3.5-7 8-7s8 3 8 7',
  x: 'M6 6l12 12M18 6L6 18',
  filter: 'M4 5h16l-6 8v6l-4-2v-4L4 5Z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-3.5-3.5',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v6M12 7.5h.01',
  car: 'M4 16.5V11l1.6-4.3A2 2 0 0 1 7.5 5.5h9a2 2 0 0 1 1.9 1.2L20 11v5.5M4 16.5a1.5 1.5 0 0 0 1.5 1.5h1a1.5 1.5 0 0 0 1.5-1.5M4 16.5v1a1 1 0 0 0 1 1h1M20 16.5a1.5 1.5 0 0 1-1.5 1.5h-1a1.5 1.5 0 0 1-1.5-1.5M20 16.5v1a1 1 0 0 1-1 1h-1M4 11h16M7.5 13.5h.01M16.5 13.5h.01',
  building:
    'M4 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16M13 21V9a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v12M7 7h1M10 7h1M7 11h1M10 11h1M7 15h1M10 15h1M16 11h1M16 15h1',
  trendUp: 'M4 17 10 11l4 4 7-8M15 9h5v5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3.5 2',
  warning: 'M12 3 2 20h20L12 3ZM12 10v4M12 17h.01',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  trophy:
    'M8 4h8v4a4 4 0 0 1-8 0V4ZM5 6h3v2a3 3 0 0 1-3-3V6ZM16 6h3v-1a3 3 0 0 1-3 3V6ZM10 12v3M14 12v3M8 19h8M12 15v4',
}

export function Icon({
  name,
  size = 18,
  className,
}: {
  name: keyof typeof PATHS
  size?: number
  className?: string
}) {
  const d = PATHS[name]
  if (!d) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}
