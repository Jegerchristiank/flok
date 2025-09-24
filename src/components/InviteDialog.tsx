import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Share2, X, UserPlus } from 'lucide-react';
import FocusTrap from '../ui/FocusTrap';
import { card, btn, btnPrimary, chip } from '../ui/styles';
import { toast } from '../ui/toast';
import { haptic } from '../ui/feedback';
import { FlokDB, FlokEvent, ID } from '../types';
import { fmtDateTimeRange, shortInviteUrl } from '../utils';
import QRCode from 'qrcode';

type SendInvitesFn = (eventId: ID, toUserIds: ID[]) => { ok: boolean; count?: number; error?: string };

export default function InviteDialog({
  open,
  onClose,
  ev,
  friends,
  db,
  onSendInvites,
  copy,
  webShare,
}: {
  open: boolean;
  onClose: () => void;
  ev: FlokEvent;
  friends: ID[];
  db: FlokDB;
  onSendInvites: SendInvitesFn;
  copy: (text: string) => Promise<boolean>;
  webShare: (opts: { title?: string; text?: string; url?: string }) => Promise<boolean>;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [qrMode, setQrMode] = useState<'link' | 'code'>('link');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  // Extra options are hidden by default so Facebook/Messenger don’t appear immediately
  const [showMoreShare, setShowMoreShare] = useState(false);
  // Short link state (with optional remote shorteners)
  const [shareUrl, setShareUrl] = useState<string>(() => shortInviteUrl(ev));
  const [shortBusy, setShortBusy] = useState(false);
  const [shortErr, setShortErr] = useState('');
  useEffect(() => { setShareUrl(shortInviteUrl(ev)); setShortErr(''); }, [ev.id]);
  const myFriends = friends.map((id) => db.users[id]).filter(Boolean);
  const togglePick = (id: string) => setPicked((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));
  const alreadyInvited = (uid: string) => (db.invites || []).some((i) => i.eventId === ev.id && i.to === uid && i.status !== 'declined');
  const doSend = () => {
    const targets = picked.filter((id) => !alreadyInvited(id));
    if (targets.length === 0) {
      toast('Vælg mindst én ven der ikke allerede er inviteret', 'error');
      haptic('medium');
      return;
    }
    const res = onSendInvites(ev.id, targets);
    if (!res.ok) {
      toast(res.error || 'Kunne ikke sende invitationer', 'error');
      haptic('medium');
      return;
    }
    toast(`Sendte ${res.count} invitation(er)`, 'success');
    haptic('light');
    setPicked([]);
  };
  const qrValue = useMemo(() => (qrMode === 'link' ? shareUrl : (ev.inviteToken || ev.id)), [qrMode, shareUrl, ev]);
  useEffect(() => {
    let cancelled = false;
    const gen = async () => {
      if (!showQR) return;
      try {
        const url = await QRCode.toDataURL(qrValue, { margin: 1, errorCorrectionLevel: 'M', width: 512 });
        if (!cancelled) setQrDataUrl(url);
      } catch {
        if (!cancelled) setQrDataUrl('');
      }
    };
    gen();
    return () => { cancelled = true; };
  }, [showQR, qrValue]);
  if (!open) return null;
  const downloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `flok-${qrMode === 'link' ? 'link' : 'invitationskode'}-${ev.id}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  const printQR = () => {
    if (!qrDataUrl) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const title = qrMode === 'link' ? 'QR-kode (link)' : 'QR-kode (invitationskode)';
    const subtitle = qrMode === 'link' ? shareUrl : (ev.inviteToken || ev.id);
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>` +
      `<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:24px}img{max-width:100%}h1{font-size:18px;margin:0 0 8px}p{font-size:12px;color:#444;word-break:break-all}</style></head>` +
      `<body><h1>${ev.title}</h1><img src="${qrDataUrl}" alt="QR"/><p>${subtitle}</p></body></html>`
    );
    w.document.close();
    w.focus();
    try { w.print(); } catch {}
  };
  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
      role="dialog"
      aria-modal
      onClick={onClose}
    >
      <FocusTrap onEsc={onClose}>
        <div
          className={`${card} w-full max-w-3xl p-4 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between sticky top-0 z-10 bg-white/90 dark:bg-zinc-900/80 backdrop-blur -mx-4 sm:-mx-6 px-4 sm:px-6 py-2">
            <h3 className="text-lg font-semibold" id="inviteDialogTitle">
              Del og inviter
            </h3>
            <button className={btn} aria-label="Luk dialog" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
          <div className="space-y-2">
            <div className="text-sm">Delbart kort link til begivenheden</div>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                readOnly
                className={`${card} flex-1 px-3 py-2 bg-transparent`}
                value={shareUrl}
                aria-label="Invitationslink (kort)"
              />
              <button
                className={btn}
                aria-label="Kopiér kort link"
                onClick={() => copy(shareUrl).then(() => {
                  toast('Kort link kopieret', 'success');
                  haptic('light');
                })}
              >
                <Copy size={18} aria-hidden />
              </button>
              <button
                className={btn}
                aria-label="Del kort link"
                onClick={async () => {
                  const url = shareUrl;
                  const ok = await webShare({ title: ev.title, text: ev.description, url });
                  if (!ok) {
                    const subject = encodeURIComponent(`Invitation ${ev.title}`);
                    const body = encodeURIComponent(`${ev.title}\n\nLæs mere og svar her: ${url}`);
                    const href = `mailto:?subject=${subject}&body=${body}`;
                    try {
                      window.open(href, '_self');
                    } catch {
                      (window as any).location.href = href;
                    }
                    toast('Åbner e-mail', 'info');
                  }
                }}
              >
                <Share2 size={18} aria-hidden />
              </button>
              <button
                className={btn}
                aria-label="Forkort link"
                disabled={shortBusy}
                onClick={async () => {
                  setShortBusy(true); setShortErr('');
                  const long = shortInviteUrl(ev);
                  const tryProviders = async (): Promise<string | null> => {
                    // CleanURI
                    try {
                      const res = await fetch('https://cleanuri.com/api/v1/shorten', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
                        body: new URLSearchParams({ url: long }).toString(),
                      });
                      if (res.ok) { const j: any = await res.json(); if (j?.result_url) return j.result_url as string; }
                    } catch {}
                    // is.gd
                    try {
                      const res = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(long)}`);
                      if (res.ok) { const t = (await res.text()).trim(); if (t.startsWith('http')) return t; }
                    } catch {}
                    // tinyurl
                    try {
                      const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(long)}`);
                      if (res.ok) { const t = (await res.text()).trim(); if (t.startsWith('http')) return t; }
                    } catch {}
                    return null;
                  };
                  const short = await tryProviders();
                  if (short) { setShareUrl(short); toast('Link forkortet', 'success'); haptic('light'); }
                  else { setShortErr('Kunne ikke forkorte link'); toast('Kunne ikke forkorte link', 'error'); haptic('medium'); }
                  setShortBusy(false);
                }}
              >
                {shortBusy ? 'Arbejder…' : 'Forkort link'}
              </button>
              <button
                className={btn}
                aria-pressed={showQR}
                aria-label="Vis QR-kode"
                onClick={() => setShowQR((v) => !v)}
              >
                QR
              </button>
          </div>
          <div className="text-xs text-zinc-600 dark:text-zinc-300">
            Link er åbent for alle. Værten kan også sætte adgangskode i indstillinger. {shortErr && (<span className="text-amber-600 dark:text-amber-400"> {shortErr}</span>)}
          </div>
          {showQR && (
            <div className={`${card} p-3 space-y-2`}
              role="region"
              aria-label="QR-kode for deling"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">QR‑kode</div>
                <div className="flex items-center gap-2">
                  <label className={chip}>
                    <input
                      type="radio"
                      name="qrmode"
                      className="mr-1"
                      checked={qrMode === 'link'}
                      onChange={() => setQrMode('link')}
                    />
                    Kort link
                  </label>
                  <label className={chip}>
                    <input
                      type="radio"
                      name="qrmode"
                      className="mr-1"
                      checked={qrMode === 'code'}
                      onChange={() => setQrMode('code')}
                    />
                    Invitationskode
                  </label>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt={qrMode === 'link' ? 'QR-kode for link' : 'QR-kode for invitationskode'} className="w-48 h-48 sm:w-64 sm:h-64" />
                ) : (
                  <div className="text-sm">Genererer QR…</div>
                )}
                <div className="text-xs text-zinc-600 dark:text-zinc-300 break-all max-w-full">
                  {qrMode === 'link' ? shortInviteUrl(ev) : (ev.inviteToken || ev.id)}
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-300 text-center max-w-sm">
                  Kort link åbner begivenheden. Invitationskode kan indtastes under “Deltag med kode”.
                </div>
                <div className="flex gap-2">
                  <button className={btn} onClick={downloadQR}>Download PNG</button>
                  <button className={btn} onClick={printQR}>Print</button>
                </div>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              className={btn}
              aria-label="Kopiér besked"
              onClick={() => {
                const body = `Hej\n\nDu er inviteret til ${ev.title}.\n\nTid: ${fmtDateTimeRange(ev.datetime, ev.endtime, ev.timezone)}\nSted: ${ev.address}\n\nLæs mere og svar her: ${shortInviteUrl(ev)}\n\nKærlig hilsen\nVærten`;
                navigator.clipboard.writeText(body).then(() => toast('Besked kopieret', 'success'));
              }}
            >
              <Copy size={16} aria-hidden /> Kopiér besked
            </button>
            <button
              className={btn}
              aria-expanded={showMoreShare}
              aria-controls="shareMoreSection"
              onClick={() => setShowMoreShare((v) => !v)}
            >
              {showMoreShare ? 'Skjul delingsmuligheder' : 'Flere delingsmuligheder'}
            </button>
          </div>
        </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Invitér dine venner</div>
            <div className="grid sm:grid-cols-2 gap-2 max-h-56 overflow-auto pr-1">
              {myFriends.length === 0 && <div className="text-sm">Du har ingen venner endnu</div>}
              {myFriends.map((u) => (
                <label key={u.id} className={`${card} p-3 flex items-center justify-between cursor-pointer`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label={`Vælg ${u.name}`}
                      checked={picked.includes(u.id)}
                      onChange={() => togglePick(u.id)}
                      disabled={alreadyInvited(u.id)}
                    />
                    <div>
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-300">{u.email} · {u.phone}</div>
                    </div>
                  </div>
                  {alreadyInvited(u.id) ? (
                    <span className={chip}>Allerede inviteret</span>
                  ) : (
                    <button
                      className={btn}
                      aria-label={`Send invitation til ${u.name}`}
                      onClick={(e) => {
                        e.preventDefault();
                        const res = onSendInvites(ev.id, [u.id]);
                        if (!res.ok) {
                          toast(res.error || 'Kunne ikke sende', 'error');
                          haptic('medium');
                        } else {
                          toast('Invitation sendt', 'success');
                          haptic('light');
                        }
                      }}
                    >
                      Send invitation
                    </button>
                  )}
                </label>
              ))}
            </div>
            <div className="flex items-center justify-end">
              <button className={btnPrimary} onClick={doSend}>
                <UserPlus size={16} /> Send interne invitationer
              </button>
            </div>
          </div>

          {showMoreShare && (
            <div id="shareMoreSection" className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Invitér via kontakt</div>
                <InviteByContact ev={ev} copy={copy} webShare={webShare} />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">E mail invitation</div>
                <EmailComposer ev={ev} />
              </div>
            </div>
          )}
        </div>
      </FocusTrap>
    </div>
  );
}

function InviteByContact({ ev, copy, webShare }: { ev: FlokEvent; copy: (t: string) => Promise<boolean>; webShare: (o: any) => Promise<boolean> }) {
  const [contact, setContact] = useState('');
  const makeText = () => {
    const url = shortInviteUrl(ev);
    return `Hej ${contact || ''}\n\nDu er inviteret til ${ev.title}.\n\nTid: ${fmtDateTimeRange(ev.datetime, ev.endtime, ev.timezone)}\nSted: ${ev.address}\n\nLæs mere og svar her: ${url}\n\nKærlig hilsen\nVærten`;
  };
  return (
    <div className={`${card} p-3 space-y-2`}>
      <input
        className={`${card} px-3 py-2 bg-transparent w-full`}
        placeholder="Navn, e mail eller telefon (valgfrit)"
        aria-label="Kontaktoplysninger (valgfrit)"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <button
          className={btn}
          aria-label="Kopiér tekst"
          onClick={() => copy(makeText()).then(() => {
            toast('Tekst kopieret', 'success');
            haptic('light');
          })}
        >
          <Copy size={16} aria-hidden /> Kopiér tekst
        </button>
        <button
          className={btn}
          aria-label="Del via system"
          onClick={async () => {
            const t = makeText();
            const url = shortInviteUrl(ev);
            const ok = await webShare({ title: ev.title, text: t, url });
            if (!ok) {
              const subject = encodeURIComponent(`Invitation ${ev.title}`);
              const body = encodeURIComponent(t);
              const href = `mailto:?subject=${subject}&body=${body}`;
              try {
                window.open(href, '_self');
              } catch {
                (window as any).location.href = href;
              }
              toast('Åbner e-mail', 'info');
            }
          }}
        >
          <Share2 size={16} /> Del
        </button>
        <button
          className={btn}
          aria-label="Del via SMS"
          onClick={() => {
            const href = `sms:?&body=${encodeURIComponent(makeText())}`;
            try { window.open(href, '_self'); } catch { (window as any).location.href = href; }
          }}
        >
          SMS
        </button>
        <button
          className={btn}
          aria-label="Del via WhatsApp"
          onClick={() => {
            const href = `https://wa.me/?text=${encodeURIComponent(makeText())}`;
            window.open(href, '_blank');
          }}
        >
          WhatsApp
        </button>
        <button
          className={btn}
          aria-label="Del via Facebook"
          onClick={() => {
            const longUrl = shortInviteUrl(ev);
            const url = encodeURIComponent(longUrl);
            const quote = encodeURIComponent(`Du er inviteret til ${ev.title}. Kom og vær med!`);
            const appId = (import.meta as any).env?.VITE_FB_APP_ID;
            const redirect = encodeURIComponent(window.location.origin);
            const href = appId
              ? `https://www.facebook.com/dialog/share?app_id=${appId}&display=popup&href=${url}&quote=${quote}&redirect_uri=${redirect}`
              : `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${quote}`;
            window.open(href, '_blank');
          }}
        >
          Facebook
        </button>
        <button
          className={btn}
          aria-label="Del via Messenger"
          onClick={() => {
            const appId = (import.meta as any).env?.VITE_FB_APP_ID;
            const link = encodeURIComponent(shortInviteUrl(ev));
            const redirect = encodeURIComponent(window.location.origin);
            if (appId) {
              const href = `https://www.facebook.com/dialog/send?app_id=${appId}&link=${link}&redirect_uri=${redirect}`;
              window.open(href, '_blank');
            } else {
              toast('Sæt VITE_FB_APP_ID for Messenger‑deling', 'error');
            }
          }}
        >
          Messenger
        </button>
      </div>
    </div>
  );
}

function EmailComposer({ ev }: { ev: FlokEvent }) {
  const subject = `Invitation ${ev.title}`;
  const shortUrl = shortInviteUrl(ev);
  const body = `Hej\n\nDu er inviteret til ${ev.title}.\n\nTid: ${fmtDateTimeRange(ev.datetime, ev.endtime, ev.timezone)}\nSted: ${ev.address}\n\nLæs mere og svar her: ${shortUrl}\n\nKærlig hilsen\nVærten`;
  const href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return (
    <div className="flex items-center gap-2">
      <a className={btn} href={href} onClick={() => toast('Åbner e-mail', 'info')}>
        <Share2 size={18} aria-hidden /> Åbn e mail
      </a>
      <button className={btn} onClick={() => navigator.clipboard.writeText(body).then(() => toast('Tekst kopieret', 'success'))}>
        <Copy size={18} aria-hidden /> Kopiér tekst
      </button>
    </div>
  );
}
