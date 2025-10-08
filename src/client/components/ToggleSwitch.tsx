import React from 'react'
import clsx from 'clsx'

interface ToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
}

export function ToggleSwitch({ checked, onChange, label, disabled = false }: ToggleSwitchProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      {label && (
        <span
          className={clsx('text-sm select-none', {
            'text-gray-400': disabled,
            'text-gray-700 dark:text-gray-300': !disabled,
          })}
        >
          {label}
        </span>
      )}
      <div className="relative inline-block">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <div
          className={clsx('w-11 h-6 rounded-full transition-colors duration-200 ease-in-out', {
            'bg-blue-600': checked && !disabled,
            'bg-gray-300 dark:bg-gray-600': !checked && !disabled,
            'bg-gray-200 dark:bg-gray-700': disabled,
          })}
        >
          <div
            className={clsx(
              'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md',
              'transform transition-transform duration-200 ease-in-out',
              {
                'translate-x-5': checked,
                'translate-x-0': !checked,
              },
            )}
          />
        </div>
      </div>
    </label>
  )
}
