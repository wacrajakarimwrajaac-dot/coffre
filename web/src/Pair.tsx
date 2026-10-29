import qrcode from 'qrcode-generator';
import { useEffect, useMemo, type ReactNode } from 'react';
import { Icon } from './icons';
import { phone, usePhone } from './phone';

/** WhatsApp-Web-style gate: QR code until a phone is linked, then the app (while the phone answers). */
export function PhoneGate({ children }: { children: ReactNode }) {
  const st = usePhone();
  useEffect(() => phone.start(), []);

  if (st.status === 'unavailable') {
    return <Screen><p className="error">Le relais Coffre n’est pas configuré (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).</p></Screen>;
  }
  if (st.status === 'pairing' && st.qr) return <PairScreen qr={st.qr} />;
  if (!st.loaded) {
    return (
      <Screen>
        <div className="spinner" />
        <h2>{st.status === 'offline' ? 'Ton téléphone ne répond pas' : 'Chargement depuis ton téléphone…'}</h2>
        {st.code && <p className="muted">Code de vérification, le même que sur ton téléphone : <b className="code">{st.code}</b></p>}
        <p className="muted">Ouvre Coffre sur ton téléphone et garde-le connecté à internet. Tes données restent sur le téléphone : ce site les affiche.</p>
        <button className="ghost" onClick={() => void phone.forget()}><Icon name="qr-code" size={16} /> Afficher un nouveau QR code</button>
      </Screen>
    );
  }
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
          <h1>Utilise Coffre sur ton ordinateur</h1>
          <ol>
            <li><span className="step">1</span><span>Ouvre <b>Coffre</b> sur ton téléphone.</span></li>
            <li><span className="step">2</span><span>Va dans <b>Réglages</b> <Icon name="chevron-right" size={14} /> <b>Coffre Web</b>.</span></li>
            <li><span className="step">3</span><span>Touche <b>Connecter un appareil</b> et scanne ce code.</span></li>
          </ol>
          <div className="pair-note">
            <Icon name="shield-check" size={18} />
            <span>Tes données restent sur ton téléphone. Ce site les affiche tant que Coffre est ouvert dessus, chiffrées de bout en bout.</span>
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
