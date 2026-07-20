import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  children,
  ...props
}: PropsWithChildren<ButtonProps>) {
  const classes = ['ui-button', 'ui-button--' + variant, className]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={classes} type={type} {...props}>
      {children}
    </button>
  )
}
