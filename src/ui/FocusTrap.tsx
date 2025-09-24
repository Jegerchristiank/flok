import React, { useEffect, useRef } from 'react';

function getFocusable(container: HTMLElement): HTMLElement[] {
  const selectors = [
    'a[href]', 'area[href]', 'button:not([disabled])', 'input:not([disabled])',
    'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
  ];
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(selectors.join(',')));
  return nodes.filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
}

export default function FocusTrap({ children, onEsc }: React.PropsWithChildren<{ onEsc?: () => void }>) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prev = document.activeElement as HTMLElement | null;
    const focusables = getFocusable(el);
    (focusables[0] || el).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onEsc?.(); return; }
      if (e.key !== 'Tab') return;
      const fs = getFocusable(el);
      if (fs.length === 0) { e.preventDefault(); return; }
      const first = fs[0];
      const last = fs[fs.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (!active || active === first) { e.preventDefault(); last.focus(); }
      } else {
        if (!active || active === last) { e.preventDefault(); first.focus(); }
      }
    };

    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, [onEsc]);

  return (
    <div ref={ref} tabIndex={-1}>
      {children}
    </div>
  );
}

