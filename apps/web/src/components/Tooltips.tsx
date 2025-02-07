import useDropdownPosition from '@/hooks/dropdownPosition'
import { computeTooltipPosition } from '@/utils/dom'
import clsx from 'clsx'
import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export const Tooltip = ({
  title,
  message,
  children,
  className,
  position = 'top',
  tooltipClassname,
  active,
}: {
  title?: string
  message?: string
  children: React.ReactNode
  className?: string
  position?: 'top' | 'bottom' | 'left' | 'right' | 'manual'
  tooltipClassname?: string
  active?: boolean
}) => {
  return (
    <div className={clsx(`group relative`, className)}>
      {children}

      {active && (
        <div
          className={clsx(
            'font-sans pointer-events-none absolute opacity-0 transition-opacity group-hover:opacity-100 bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col items-center justify-center gap-y-1 z-[4000]',
            getPosClass(position),
            tooltipClassname
          )}
        >
          {title && <span>{title}</span>}
          {message && (
            <span className="inline-flex items-center justify-center text-gray-400 text-center">
              {message}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

const getPosClass = (
  position: 'top' | 'bottom' | 'left' | 'right' | 'manual'
): string => {
  switch (position) {
    case 'top':
      return '-top-1 left-1/2 -translate-x-1/2 -translate-y-full'
    case 'bottom':
      return '-bottom-1 right-1/2 translate-x-1/2 translate-y-full'
    case 'left':
      return '-left-1 top-1/2 -translate-x-full -translate-y-1/2'
    case 'right':
      return 'right-0 top-1/2 translate-x-full -translate-y-1/2'
    case 'manual':
      return ''
  }
}

interface PortalTooltipProps {
  className?: string
  children: React.ReactNode
  content: React.ReactNode
  ignoreScrollableAncestor?: boolean
}
export function PortalTooltip(props: PortalTooltipProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)
  const { onOpen, dropdownPosition } = useDropdownPosition(
    ref,
    'top',
    0,
    0,
    props.ignoreScrollableAncestor
  )
  useEffect(() => {
    if (active) {
      onOpen()
    }
  }, [active])

  return (
    <div
      className={clsx(props.className, 'relative')}
      ref={ref}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
    >
      {props.children}
      {createPortal(
        <div
          className={clsx(
            'absolute z-[2000] -translate-y-full pb-2 subpixel-antialiased transition-opacity',
            active ? 'opacity-100' : 'opacity-0 invisible'
          )}
          style={dropdownPosition}
        >
          {props.content}
        </div>,
        document.body
      )}
    </div>
  )
}

interface TooltipV2Props<T extends HTMLElement> {
  title?: string
  message?: string
  content?: (
    tooltipRef: React.RefObject<HTMLDivElement>,
    pos: CSSProperties
  ) => React.ReactNode
  referenceRef?: React.RefObject<T>
  children: (ref: React.RefObject<T>) => React.ReactNode
  active: boolean
}
export function TooltipV2<T extends HTMLElement>(props: TooltipV2Props<T>) {
  const parentRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const _referenceRef = useRef<T>(null)
  const referenceRef = props.referenceRef ?? _referenceRef
  const [pos, setPos] = useState<CSSProperties>(
    computeTooltipPosition(parentRef, referenceRef, tooltipRef, 'top', 4)
  )
  useEffect(() => {
    if (!parentRef.current || !props.active) {
      return
    }

    const cb = () => {
      setPos(
        computeTooltipPosition(parentRef, referenceRef, tooltipRef, 'top', 4)
      )
    }

    const mut = new MutationObserver(cb)
    mut.observe(parentRef.current, {
      attributes: true,
      childList: true,
      subtree: true,
    })
    cb()

    return () => {
      mut.disconnect()
    }
  }, [parentRef, referenceRef, tooltipRef, props.active])

  return (
    <div className="group relative" ref={parentRef}>
      {props.children(referenceRef)}
      {props.active ? (
        props.content ? (
          props.content(tooltipRef, pos)
        ) : props.title || props.message ? (
          <div
            ref={tooltipRef}
            className="font-sans pointer-events-none absolute opacity-0 transition-opacity group-hover:opacity-100 bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col items-center justify-center gap-y-1 z-[4000] w-36"
            style={pos}
          >
            <>
              {props.title && (
                <span className="text-center">{props.title}</span>
              )}
              <span className="inline-flex items-center justify-center text-gray-400 text-center">
                {props.message}
              </span>
            </>
          </div>
        ) : null
      ) : null}
    </div>
  )
}
