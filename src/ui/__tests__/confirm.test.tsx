import React from 'react';
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { ConfirmProvider, confirm } from '../../ui/confirm';

function mount(ui: React.ReactElement) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  act(() => root.render(ui));
  return { el, root };
}

describe('Confirm + Undo flow', () => {
  it('resolves true when confirming and false when cancelling', async () => {
    const { root } = mount(
      <ConfirmProvider>
        <div id="app" />
      </ConfirmProvider>
    );
    // Open confirm
    let p: Promise<boolean> = Promise.resolve(false);
    await act(async () => {
      p = confirm({ title: 'Slet', message: 'Er du sikker?', confirmText: 'Slet', cancelText: 'Fortryd' });
    });
    // Click cancel
    const cancelBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Fortryd') as HTMLButtonElement;
    expect(cancelBtn).toBeTruthy();
    await act(async () => cancelBtn.click());
    await expect(p!).resolves.toBe(false);

    // Re-open and confirm
    let p2: Promise<boolean> = Promise.resolve(false);
    await act(async () => {
      p2 = confirm({ title: 'Slet', message: 'Er du sikker?', confirmText: 'Slet', cancelText: 'Fortryd' });
    });
    const okBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Slet') as HTMLButtonElement;
    expect(okBtn).toBeTruthy();
    await act(async () => okBtn.click());
    await expect(p2!).resolves.toBe(true);
    root.unmount();
  });
});

