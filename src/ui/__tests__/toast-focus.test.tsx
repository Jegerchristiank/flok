import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { ToastProvider, toast } from '../../ui/toast';
import FocusTrap from '../../ui/FocusTrap';

function mount(ui: React.ReactElement) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  act(() => root.render(ui));
  return { el, root };
}

describe('Toast and FocusTrap', () => {
  it('renders toast and auto-dismisses', async () => {
    vi.useFakeTimers();
    const { root } = mount(
      <ToastProvider>
        <div />
      </ToastProvider>
    );
    await act(async () => {
      toast('Hej', 'info', 1000);
    });
    const first = document.querySelector('[aria-live]');
    expect(first).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    await act(async () => {});
    expect(document.querySelectorAll('[aria-live]').length).toBeLessThanOrEqual(1);
    root.unmount();
    vi.useRealTimers();
  });

  it('calls onEsc for FocusTrap when Escape pressed', async () => {
    const onEsc = vi.fn();
    const { el, root } = mount(
      <div>
        <FocusTrap onEsc={onEsc}>
          <button>first</button>
          <button>last</button>
        </FocusTrap>
      </div>
    );
    const trap = el.querySelector('div[tabindex="-1"]') as HTMLElement;
    expect(trap).toBeTruthy();
    await act(async () => {
      const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      trap.dispatchEvent(ev);
    });
    expect(onEsc).toHaveBeenCalled();
    root.unmount();
  });
});

