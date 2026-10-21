import { useEffect, useRef } from 'react'

const focusableSelector =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [contenteditable="true"]'

// Dialog shell: locks page scroll, moves focus inside, keeps Tab within the dialog, closes on Escape
// (unless busy) and returns focus to where it was when closed.
export default function Modal({ onClose, busy = false, className = '', children, ...aria }) {
  const dialog = useRef(null)
  // Read the latest handlers from the key listener without re-running the effect (which would move focus)
  const latest = useRef({ onClose, busy })
  latest.current = { onClose, busy }

  useEffect(() => {
    const previous = document.activeElement,
      overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusable = () => [...(dialog.current?.querySelectorAll(focusableSelector) || [])]
    focusable()[0]?.focus()
    const keydown = (e) => {
      if (e.key === 'Escape' && !latest.current.busy) latest.current.onClose()
      if (e.key === 'Tab') {
        const items = focusable(),
          first = items[0],
          last = items.at(-1)
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', keydown)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', keydown)
      previous?.focus()
    }
  }, [])

  return (
    <div className="admin-modal-backdrop">
      <section
        ref={dialog}
        className={('admin-modal ' + className).trim()}
        role="dialog"
        aria-modal="true"
        {...aria}
      >
        {children}
      </section>
    </div>
  )
}

// Heading row with an eyebrow, title, optional subtitle and a close button
export function DialogHeading({ eyebrow, title, titleId, subtitle, onClose, busy, closeLabel }) {
  return (
    <div className="admin-dialog-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2 id={titleId}>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <button
        type="button"
        className="admin-close"
        disabled={busy}
        aria-label={closeLabel}
        onClick={onClose}
      >
        ×
      </button>
    </div>
  )
}
