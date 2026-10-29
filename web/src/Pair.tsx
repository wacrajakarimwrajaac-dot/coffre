import qrcode from 'qrcode-generator';
import { useEffect, useMemo, type ReactNode } from 'react';
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
        <h2>Connexion à ton téléphone…</h2>
        {st.code && <p className="meta">Code de vérification (le même s’affiche sur ton téléphone) : <span className="code">{st.code}</span></p>}
        <p className="meta">Ouvre Coffre sur ton téléphone et garde-le connecté à internet. Tes données restent sur le téléphone ; ce site les affiche.</p>
        <button className="btn-ghost small" onClick={() => void phone.forget()}>Afficher un nouveau QR code</button>
      </Screen>
    );
  }
  return <>{children}</>;
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="pair">
      <div className="pair-card" style={{ flexDirection: 'column', alignItems: 'flex-start', maxWidth: 520, gap: 14 }}>
        <div className="brand" style={{ padding: 0 }}><img src="/favicon.svg" alt="" width={28} height={28} /> Coffre</div>
        {children}
      </div>
    </div>
  );
}

function PairScreen({ qr }: { qr: string }) {
  const path = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(qr);
    q.make();
    const n = q.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { d, n };
  }, [qr]);

  return (
    <div className="pair">
      <div className="pair-card">
        <div className="pair-steps">
          <div className="brand" style={{ padding: 0 }}><img src="/favicon.svg" alt="" width={30} height={30} /> Coffre Web</div>
          <h1 style={{ fontSize: 26 }}>Utilise Coffre sur ton ordinateur</h1>
          <ol>
            <li>Ouvre <b>Coffre</b> sur ton téléphone.</li>
            <li>Va dans <b>Réglages → Coffre Web</b>.</li>
            <li>Touche <b>Connecter un appareil</b> et scanne ce code.</li>
          </ol>
          <p className="meta">Tes données restent sur ton téléphone : ce site les affiche tant que Coffre est ouvert dessus. Tout est chiffré de bout en bout.</p>
        </div>
        <div className="qr" aria-label="QR code à scanner avec l’app Coffre">
          <svg viewBox={`-1 -1 ${path.n + 2} ${path.n + 2}`} shapeRendering="crispEdges"><path d={path.d} fill="#0b1020" /></svg>
        </div>
      </div>
    </div>
  );
}
