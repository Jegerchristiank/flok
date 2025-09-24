import React, { useState } from 'react';
import { X, UserPlus, LogIn } from 'lucide-react';
import FocusTrap from '../ui/FocusTrap';
import { card, btn } from '../ui/styles';
import { toast } from '../ui/toast';
import { haptic } from '../ui/feedback';

export default function TempLoginDialog({
  open,
  onClose,
  onCreate,
  onAuth,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (username: string, pin: string) => { ok: boolean; error?: string };
  onAuth: (username: string, pin: string) => { ok: boolean; error?: string };
}) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" role="dialog" aria-modal>
      <FocusTrap onEsc={onClose}>
        <div className={`${card} max-w-md w-full p-4 sm:p-6 space-y-4`}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold" id="tempLoginTitle">
              Midlertidigt login
            </h3>
            <button className={btn} aria-label="Luk dialog" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
          <p className="text-sm">
            Gælder kun for denne begivenhed. Indtast dit navn og en PIN på 4–6 cifre. Dit navn vises i gæstelisten. Udløber 30 dage efter begivenheden.
          </p>
          <div className="grid gap-2">
            <input className={`${card} px-3 py-2 bg-transparent`} placeholder="Navn" aria-label="Navn" value={username} onChange={(e) => setUsername(e.target.value)} />
            <input className={`${card} px-3 py-2 bg-transparent`} placeholder="PIN 4 til 6 cifre" aria-label="PIN" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className={btn}
              onClick={() => {
                const r = onCreate(username.trim(), pin);
                if (!r.ok) {
                  toast(r.error || 'Kunne ikke oprette', 'error');
                  haptic('medium');
                } else {
                  toast('Midlertidig konto oprettet', 'success');
                  haptic('light');
                }
              }}
            >
              <UserPlus size={18} aria-hidden /> Opret
            </button>
            <button
              className={btn}
              onClick={() => {
                const r = onAuth(username.trim(), pin);
                if (!r.ok) {
                  toast(r.error || 'Kunne ikke logge ind', 'error');
                  haptic('medium');
                } else {
                  toast('Logget ind', 'success');
                  haptic('light');
                }
              }}
            >
              <LogIn size={18} aria-hidden /> Log ind
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}

