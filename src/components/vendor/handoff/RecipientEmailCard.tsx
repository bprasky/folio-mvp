'use client'
import * as React from 'react'

type Props = {
  value: string
  onChange: (email: string) => void
  className?: string
}

export default function RecipientEmailCard({ value, onChange, className }: Props) {
  return (
    <div className={`border rounded-2xl p-6 bg-white ${className ?? ''}`}>
      <h3 className="text-lg font-semibold mb-2">Designer recipient</h3>
      <p className="text-sm text-gray-500 mb-4">
        Enter the designer's email. We'll send a private link; the designer chooses the destination.
      </p>
      <input
        type="email"
        placeholder="designer@studio.com"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-gray-300"
      />
      <p className="text-xs text-gray-400 mt-2">We'll invite them if they don't have an account yet.</p>
    </div>
  )
}




