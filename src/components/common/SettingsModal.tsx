import { useEffect, useState } from 'react';
import { ExternalLink, KeyRound, X } from 'lucide-react';
import { USDA_DEMO_KEY, getUsdaKey, setUsdaKey } from '../../services/foodApi';

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      const k = getUsdaKey();
      setKey(k === USDA_DEMO_KEY ? '' : k);
      setSaved(false);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-md p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 id="settings-title" className="flex items-center gap-2 text-sm font-semibold text-white">
            <KeyRound size={16} className="text-nme" /> Data source settings
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <label className="mb-1.5 block text-xs text-slate-300">USDA FoodData Central API key</label>
        <input className="input num" placeholder={`Empty = ${USDA_DEMO_KEY} (rate-limited)`} value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} />
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          The built-in <code className="text-nme">DEMO_KEY</code> allows ~30 requests/hour per IP. A personal key (free, instant) raises this to 1,000/hour.
          The key is stored only in this browser's localStorage and sent only to api.nal.usda.gov.
        </p>
        <a href="https://fdc.nal.usda.gov/api-key-signup" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-nme hover:underline">
          Get a free USDA API key <ExternalLink size={11} />
        </a>
        <div className="mt-4 rounded-lg border border-white/5 bg-void-850 p-3 text-[11px] text-slate-400">
          <b className="text-slate-300">OpenFoodFacts</b> needs no key (open database, ~10 searches/minute).
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              setUsdaKey(key);
              setSaved(true);
              setTimeout(onClose, 600);
            }}
          >
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
