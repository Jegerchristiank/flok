import React, { useEffect, useState } from 'react';
import { card, btn, btnPrimary } from './styles';

type ConfirmOpts = {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
};

let opener: ((opts: ConfirmOpts) => Promise<boolean>) | null = null;

export const confirm = (opts: ConfirmOpts): Promise<boolean> => opener ? opener(opts) : Promise.resolve(false);

export function ConfirmProvider({ children }: React.PropsWithChildren) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOpts>({});
  const [resolver, setResolver] = useState<(v: boolean) => void>(() => () => {});

  useEffect(() => {
    opener = (o: ConfirmOpts) => {
      setOpts(o || {});
      setOpen(true);
      return new Promise<boolean>((resolve) => setResolver(() => resolve));
    };
    return () => { opener = null; };
  }, []);

  const close = (val: boolean) => {
    setOpen(false);
    resolver(val);
  };

  return (
    <>
      {children}
      {open && (
        <div className="fixed inset-0 z-[200] bg-black/30 flex items-center justify-center p-4" role="dialog" aria-modal>
          <div className={`${card} max-w-sm w-full p-4 space-y-3`}>
            {opts.title && <div className="text-lg font-semibold">{opts.title}</div>}
            {opts.message && <div className="text-sm text-zinc-700 dark:text-zinc-300">{opts.message}</div>}
            <div className="flex justify-end gap-2 pt-1">
              <button className={btn} onClick={() => close(false)}>{opts.cancelText || 'Annullér'}</button>
              <button className={btnPrimary} onClick={() => close(true)}>{opts.confirmText || 'Bekræft'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

