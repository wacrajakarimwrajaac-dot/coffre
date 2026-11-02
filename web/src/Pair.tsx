import qrcode from 'qrcode-generator';
import { useEffect, useMemo, type ReactNode } from 'react';
import { Icon } from './icons';
import { library, useLibrary } from './library';
import { phone, useLink } from './phone';

/** WhatsApp-Web-style gate: QR code until a phone is linked, then the app with its own local copy. */
export function PhoneGate({ children }: { children: ReactNode }) {
  const link = useLink();
  const lib = useLibrary();
  useEffect(() => {
    phone.start();
    void library.load();
  }, []);

  if (link.status === 'unavailable') {
    return <Screen><p className="error">Le relais Coffre n’est pas configuré (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).</p></Screen>;
  }
  if (link.status === 'pairing' && link.qr) return <PairScreen qr={link.qr} />;
  if (!lib.loaded) return <Screen><div className="spinner" /></Screen>;
  return <>{children}</>;
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="pair">
      <div className="pair-top"><img src="/logo-mark.png" alt="" width={30} height={30} /> Coffre Web</div>
      <div className="pair-card center">{children}</div>
    </div>
  );
}

function PairScreen({ qr }: { qr: string }) {
  const path = useMemo(() => {
    const q = qrcode(0, 'H');
    q.addData(qr);
    q.make();
    const n = q.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { d, n };
  }, [qr]);

  return (
    <div className="pair">
      <div className="pair-top"><img src="/logo-mark.png" alt="" width={30} height={30} /> Coffre Web</div>
      <div className="pair-card">
        <div className="pair-steps">
          <h1>Mets ton Coffre sur ton ordinateur</h1>
          <ol>
            <li><span className="step">1</span><span>Ouvre <b>Coffre</b> sur ton téléphone.</span></li>
            <li><span className="step">2</span><span>Va dans <b>Réglages</b> <Icon name="chevron-right" size={14} /> <b>Coffre Web</b>.</span></li>
            <li><span className="step">3</span><span>Touche <b>Connecter un appareil</b> et scanne ce code.</span></li>
          </ol>
          <div className="pair-note">
            <Icon name="shield-check" size={18} />
            <span>Ton ordinateur garde sa propre copie de ton Coffre. Elle se met à jour avec ton téléphone quand tu appuies sur « Synchroniser » (Coffre doit alors être ouvert sur le téléphone). Tout est chiffré de bout en bout.</span>
          </div>
        </div>
        <div className="qr" aria-label="QR code à scanner avec l’app Coffre">
          <svg viewBox={`-1 -1 ${path.n + 2} ${path.n + 2}`} shapeRendering="crispEdges"><path d={path.d} fill="#14151A" /></svg>
          <img className="qr-logo" src="/logo-mark.png" alt="" />
        </div>
      </div>
    </div>
  );
}
