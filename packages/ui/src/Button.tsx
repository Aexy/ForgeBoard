import type { ComponentPropsWithRef } from 'react'

import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet'

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant
}

export function Button({ children, className, ref, type = 'button', variant = 'primary', ...props }: ButtonProps) {
  const classes = [styles.button, styles[variant], className].filter(Boolean).join(' ')
  return <button ref={ref} className={classes} type={type} {...props}>{children}</button>
}
