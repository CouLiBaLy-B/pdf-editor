import React from 'react'

export function AppLogo() {
  return (
    <div className="flex items-center gap-2 select-none">
      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-brand shrink-0">
        <svg width="15" height="17" viewBox="0 0 15 17" fill="none">
          <rect x="1" y="1" width="9" height="12" rx="1.5" fill="white" fillOpacity="0.25"/>
          <rect x="3" y="3" width="9" height="12" rx="1.5" fill="white"/>
          <path d="M5.5 6.5h4M5.5 9h4M5.5 11.5h2.5" stroke="#00b386" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </div>
      <span className="text-sm font-bold tracking-tight text-ink">PDF<span className="text-brand">Pro</span></span>
    </div>
  )
}
