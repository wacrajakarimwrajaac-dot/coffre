import { useEffect, useRef, useState } from 'react';

const pickMime = () =>
  ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'].find(
    (m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m),
  ) ?? '';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Records a voice note with the microphone, then hands it over as a File. */
export function Recorder({ onSave }: { onSave: (file: File) => void }) {
  const [state, setState] = useState<'idle' | 'recording' | 'review'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [clip, setClip] = useState<{ blob: Blob; url: string } | null>(null);
  const [name, setName] = useState('');
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<number>(0);

  useEffect(() => () => {
    clearInterval(timer.current);
    rec.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);
  useEffect(() => () => { if (clip) URL.revokeObjectURL(clip.url); }, [clip]);

  const start = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      return setError('L’enregistrement audio n’est pas disponible dans ce navigateur.');
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMime();
      const r = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 64000 } : undefined);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' });
        setClip({ blob, url: URL.createObjectURL(blob) });
        setState('review');
      };
      rec.current = r;
      r.start(1000);
      setSeconds(0);
      setName(`Vocal du ${new Date().toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`);
      timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
      setState('recording');
    } catch {
      setError('Micro refusé ou introuvable. Autorise le micro dans le navigateur.');
    }
  };

  const stop = () => {
    clearInterval(timer.current);
    rec.current?.stop();
  };

  const discard = () => {
    setClip(null);
    setState('idle');
  };

  const save = () => {
    if (!clip) return;
    const ext = clip.blob.type.includes('mp4') ? 'm4a' : clip.blob.type.includes('ogg') ? 'ogg' : 'webm';
    onSave(new File([clip.blob], `${name.trim() || 'Vocal'}.${ext}`, { type: clip.blob.type }));
    discard();
  };

  return (
    <div className="recorder">
      {state === 'idle' && (
        <button type="button" className="rec-btn" onClick={start}>
          <span className="rec-dot" /> Appuie pour enregistrer
        </button>
      )}
      {state === 'recording' && (
        <button type="button" className="rec-btn live" onClick={stop}>
          <span className="rec-dot" /> {fmt(seconds)} · Arrêter
        </button>
      )}
      {state === 'review' && clip && (
        <div className="rec-review">
          <audio src={clip.url} controls />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du vocal" />
          <div className="modal-actions">
            <span className="muted grow">{fmt(seconds)} · {(clip.blob.size / 1024).toFixed(0)} Ko</span>
            <button type="button" className="ghost" onClick={discard}>Recommencer</button>
            <button type="button" className="btn primary" onClick={save}>Ajouter</button>
          </div>
        </div>
      )}
      {error && <span className="error">{error}</span>}
    </div>
  );
}
