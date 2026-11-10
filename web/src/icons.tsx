import type { ReactNode } from 'react'

// Small outline icons drawn inline, so there is no icon library to load and
// they take the colour of the text around them. All are decoration: the
// control they sit in carries the accessible name.
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export function ChevronLeftIcon() {
  return (
    <Icon>
      <path d="M10 3.5 5.5 8l4.5 4.5" />
    </Icon>
  )
}

export function ChevronRightIcon() {
  return (
    <Icon>
      <path d="M6 3.5 10.5 8 6 12.5" />
    </Icon>
  )
}

export function FilterIcon() {
  return (
    <Icon>
      <path d="M2.5 3.5h11L9.5 8.4v3.4l-3 1.2V8.4z" />
    </Icon>
  )
}

export function PencilIcon() {
  return (
    <Icon>
      <path d="m10.5 3 2.5 2.5-7 7-3 .5.5-3z" />
    </Icon>
  )
}
