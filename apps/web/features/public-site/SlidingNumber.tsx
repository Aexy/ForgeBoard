'use client'

import { useEffect, useRef, useState } from 'react'

import styles from './SlidingNumber.module.css'

const digits = Array.from({ length: 10 }, (_, value) => value)
const integerFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0, useGrouping: false })

function nonNegativeInteger(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

export function SlidingNumber({ value, from = 0 }: Readonly<{ value: number; from?: number }>) {
  const rootRef = useRef<HTMLSpanElement>(null)
  const hasAnimatedRef = useRef(false)
  const finalValue = nonNegativeInteger(value)
  const [visibleValue, setVisibleValue] = useState(finalValue)
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!rootRef.current || hasAnimatedRef.current || reducedMotion || !('IntersectionObserver' in window)) {
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || hasAnimatedRef.current) return

      hasAnimatedRef.current = true
      setVisibleValue(nonNegativeInteger(from))
      requestAnimationFrame(() => {
        setAnimated(true)
        setVisibleValue(finalValue)
      })
      observer.disconnect()
    }, { threshold: 0.5 })

    observer.observe(rootRef.current)
    return () => observer.disconnect()
  }, [finalValue, from])

  const formattedFinalValue = integerFormatter.format(finalValue)
  const width = formattedFinalValue.length
  const visibleDigits = integerFormatter.format(visibleValue).padStart(width, '0').slice(-width).split('')

  return <span ref={rootRef} className={styles.number} data-animated={animated}>
    <span className={styles.staticValue}>{formattedFinalValue}</span>
    <span className={styles.animatedValue} aria-hidden="true">
      {visibleDigits.map((digit, index) => <span className={styles.digit} key={index}>
        <span className={styles.track} style={{ transform: `translateY(-${Number(digit) * 10}%)` }}>
          {digits.map((candidate) => <span key={candidate}>{candidate}</span>)}
        </span>
      </span>)}
    </span>
  </span>
}
