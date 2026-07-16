import type { ButtonHTMLAttributes, ReactNode } from 'react'

import styles from './Button.module.css'

type ButtonVariant = 'primary' | 'secondary' | 'quiet'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: ButtonVariant
}

export function Button({ children, className, type = 'button', variant = 'primary', ...props }: ButtonProps) {
  const classes = [styles.button, styles[variant], className].filter(Boolean).join(' ')
  return <button className={classes} type={type} {...props}>{children}</button>
}
