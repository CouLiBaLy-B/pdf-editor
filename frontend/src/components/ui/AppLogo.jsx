import React from 'react'

export function AppLogo() {
  return (
    <div className="flex items-center gap-2.5 select-none">
      {/* Green rounded square icon */}
      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-brand shrink-0" aria-hidden="true">
        <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
          <rect x="1" y="1" width="10" height="13" rx="1.5" fill="white" fillOpacity="0.25"/>
          <rect x="3" y="3" width="10" height="13" rx="1.5" fill="white"/>
          <path d="M6 7h4M6 9.5h4M6 12h2.5" stroke="#00b386" strokeWidth="1.25" strokeLinecap="round"/>
        </svg>
      </div>
      <span className="text-sm font-bold text-ink tracking-tight">PDF<span className="text-brand">Pro</span></span>
    </div>
  )
}
