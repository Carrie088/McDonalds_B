import { useEffect, useMemo, useState } from 'react';
import { DEFAULTS, fileNameFor } from '../logger.js';
import { sequenceFor } from './scenarios.js';
import './admin.css';

// Panel prowadzącego: dane uczestnika przed uruchomieniem sesji (sześć scenariuszy w kolejności AB/BA).
// Wartości startowe: parametry adresu (?uczestnik=…&kolejnosc=…) → ostatnio użyte → DEFAULTS.
const STORAGE_KEY = 'pun_panel_ostatnie';
const INTERFEJS = DEFAULTS.interfejs;

const readStored = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}; } catch { return {}; }
};
const writeStored = (v) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch { /* tryb prywatny itp. */ }
};

// „2”, „p2”, „P02” → „P02”
const normalizeCode = (v) => {
  const s = String(v ?? '').trim().toUpperCase();
  const digits = s.replace(/^P/, '');
  return /^\d{1,2}$/.test(digits) ? `P${digits.padStart(2, '0')}` : s;
};

const validate = (f) => {
  const e = {};
  if (!/^P(0[1-9]|[1-9]\d)$/.test(f.uczestnik)) e.uczestnik = 'Kod uczestnika w formacie P01–P99 (nadaje prowadzący).';
  return e;
};

function Segmented({ value, options, onChange, name }) {
  return (
    <div className="adm-seg" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button
          type="button"
          key={o}
          role="radio"
          aria-checked={value === o}
          className={value === o ? 'on' : ''}
          onClick={() => onChange(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export default function AdminSetup({ onStart }) {
  const initial = useMemo(() => {
    const q = new URLSearchParams(window.location.search);
    const stored = readStored();
    const pick = (k) => q.get(k) ?? stored[k] ?? DEFAULTS[k];
    return {
      interfejs: INTERFEJS,
      uczestnik: normalizeCode(q.get('uczestnik') ?? stored.uczestnik ?? ''),
      kolejnosc: pick('kolejnosc') === 'BA' ? 'BA' : 'AB',
    };
  }, []);

  const [form, setForm] = useState(initial);
  const [fullscreen, setFullscreen] = useState(true);
  const [touched, setTouched] = useState(false);
  const [fileInfo, setFileInfo] = useState(null); // [{ nazwa, istnieje, wiersze }] | { blad: true }
  const [starting, setStarting] = useState(false);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const errors = validate(form);
  const valid = Object.keys(errors).length === 0;
  const steps = sequenceFor(form.kolejnosc);
  const fileNames = valid ? form.kolejnosc.split('').map((wersja) => fileNameFor({ ...form, wersja })) : [];
  const filesKey = fileNames.join('|');

  // Czy pliki tego uczestnika (wersja A i B) już istnieją (serwer Vite)
  useEffect(() => {
    if (!filesKey) { setFileInfo(null); return undefined; }
    let cancelled = false;
    const id = setTimeout(() => {
      Promise.all(filesKey.split('|').map((nazwa) =>
        fetch(`/api/zdarzenia?nazwa=${encodeURIComponent(nazwa)}`)
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
          .then((info) => ({ nazwa, ...info }))))
        .then((list) => { if (!cancelled) setFileInfo(list); })
        .catch(() => { if (!cancelled) setFileInfo({ blad: true }); });
    }, 200);
    return () => { cancelled = true; clearTimeout(id); };
  }, [filesKey]);
  const existing = Array.isArray(fileInfo) ? fileInfo.filter((f) => f.istnieje) : [];

  const scaling = Math.round(window.devicePixelRatio * 100);
  const screenSize = `${window.screen.width} × ${window.screen.height}`;

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (!valid || starting) return;
    setStarting(true);
    writeStored({ uczestnik: form.uczestnik, kolejnosc: form.kolejnosc });
    await onStart({ ...form, interfejs: Number(INTERFEJS) }, fullscreen);
  };

  const showErr = (k) => touched && errors[k];

  return (
    <div className="adm">
      <form className="adm-card" onSubmit={submit} noValidate>
        <header className="adm-head">
          <span className="adm-badge">Panel prowadzącego</span>
          <h1>Nowa sesja badania</h1>
          <p>Wpisz dane uczestnika. Sesja obejmuje sześć scenariuszy; przed każdym wyświetli się instrukcja, a scenariusz kończy przycisk „Przejdź dalej”.</p>
        </header>

        <div className="adm-grid">
          <label className="adm-field">
            <span>Kod uczestnika</span>
            <input
              type="text"
              placeholder="np. P07"
              autoFocus={!initial.uczestnik}
              autoComplete="off"
              spellCheck={false}
              value={form.uczestnik}
              onChange={(e) => set('uczestnik')(e.target.value.toUpperCase())}
              onBlur={(e) => set('uczestnik')(normalizeCode(e.target.value))}
              aria-invalid={Boolean(showErr('uczestnik'))}
            />
            <small className={showErr('uczestnik') ? 'adm-err' : ''}>{showErr('uczestnik') || 'Globalny kod P01–P99, ten sam we wszystkich grupach.'}</small>
          </label>

          <div className="adm-field">
            <span>Kolejność wersji w sesji</span>
            <Segmented name="Kolejność" value={form.kolejnosc} options={['AB', 'BA']} onChange={set('kolejnosc')} />
            <small className="adm-seq">{steps.map((s) => `S${s.n}(${s.wersja})`).join(' → ')}</small>
          </div>
        </div>

        <section className="adm-status" aria-live="polite">
          <div className="adm-row">
            <span>Pliki zdarzeń</span>
            <b className="adm-mono">
              {fileNames.length ? fileNames.map((f) => <span key={f} className="adm-file">zdarzenia/{f}</span>) : '—'}
            </b>
          </div>
          {Array.isArray(fileInfo) && (
            <p className={`adm-note ${existing.length ? 'warn' : 'ok'}`}>
              {existing.length
                ? `Już istnieje: ${existing.map((f) => `${f.nazwa} (${f.wiersze} zdarzeń)`).join(', ')}. Nowa sesja zostanie dopisana na końcu — sprawdź, czy kod uczestnika jest poprawny.`
                : 'Nowe pliki — zostaną utworzone przy pierwszym zapisie.'}
            </p>
          )}
          {fileInfo?.blad && (
            <p className="adm-note bad">Brak serwera zapisu (uruchom kiosk przez „npm run dev”). Bez niego plik pobierze się przez przeglądarkę.</p>
          )}
          <div className="adm-checks">
            <span className={scaling === 100 ? 'ok' : 'warn'}>
              Skalowanie systemu: {scaling}%{scaling !== 100 && ' — ustaw 100%, inaczej współrzędne nie zgodzą się z eyetrackerem'}
            </span>
            <span className="ok">Rozdzielczość ekranu: {screenSize}</span>
          </div>
        </section>

        <section className="adm-keys">
          <h2>Sterowanie w trakcie sesji (klawiatura)</h2>
          <ul>
            <li><kbd>T</kbd> natychmiastowe ostrzeżenie o bezczynności (test limitu czasu)</li>
            <li><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>A</kbd> przerwanie sesji i powrót do tego panelu (zapisuje plik)</li>
          </ul>
          <p>Scenariusz zaczyna się przyciskiem „Rozpocznij scenariusz” i kończy wyłącznie przyciskiem „Przejdź dalej” w prawym dolnym rogu. Złożenie zamówienia nie kończy scenariusza, a kolumna „sukces” zostaje pusta do oceny przez prowadzącego.</p>
        </section>

        <footer className="adm-foot">
          <label className="adm-check">
            <input type="checkbox" checked={fullscreen} onChange={(e) => setFullscreen(e.target.checked)} />
            Pełny ekran (wymagany do poprawnych współrzędnych)
          </label>
          <button type="submit" className="adm-start" disabled={starting}>
            {starting ? 'Uruchamianie…' : 'Rozpocznij sesję'}
          </button>
        </footer>
      </form>
    </div>
  );
}
