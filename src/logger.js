// Rejestr zdarzeń do badania (format PUN_zdarzenia.csv).
// Jedno zamówienie = jeden plik w folderze `zdarzenia/`, zapisywany po zakończeniu albo anulowaniu zamówienia.
//
// Dane badania ustawia się w adresie strony, np.:
//   http://localhost:5173/?interfejs=6&uczestnik=P02&wersja=B&kolejnosc=BA&scenariusz=S2
// Brakujące wartości biorą się z DEFAULTS.

import { useEffect, useRef } from 'react';
import { useIsPresent } from 'framer-motion';

const DEFAULTS = { interfejs: '6', uczestnik: 'P01', wersja: 'A', kolejnosc: 'AB', scenariusz: 'S1' };

const COLUMNS = [
  'interfejs', 'uczestnik', 'wersja', 'kolejnosc', 'scenariusz', 'czas_lokalny', 'czas_epoch_ms', 'czas_ms',
  'zdarzenie', 'ekran', 'element', 'etykieta', 'x', 'y', 'szer', 'wys', 'trafienie', 'aoi', 'sukces', 'opis',
];

// Po tylu ms od pojawienia się ekranu/AOI mierzymy jego położenie (po animacji wejścia)
const SETTLE_MS = 1000;

const query = new URLSearchParams(window.location.search);
const meta = Object.fromEntries(Object.entries(DEFAULTS).map(([k, v]) => [k, query.get(k) ?? v]));

let rows = [];
let active = false;
let t0 = 0;
let base = { name: 'start', opis: '' }; // ekran główny (start, opcja, menu, koszyk, platnosc, potwierdzenie)
const overlays = []; // okna nad ekranem głównym: produkt, zestaw, bezczynnosc
const aois = new Map(); // element DOM → { aoi, element, etykieta }
let observer = null;
let scanTimer = null;
const pending = new Set(); // wiersze czekające na pomiar położenia

// ---------- pomocnicze ----------
const pad = (n, w = 2) => String(n).padStart(w, '0');
const localTime = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
};
const fileTime = (ms) => localTime(ms).replace(' ', '_').replace(/:/g, '-').replace(/\.\d+$/, '');

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
export const slug = (s) =>
  clean(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

const labelOf = (el) => clean(el.getAttribute('aria-label') || el.dataset.label || el.innerText).slice(0, 80);
const idOf = (el) =>
  el.dataset.log || el.id || (el.dataset.aoi && el.dataset.aoi.replace(/^AOI_/, '').toLowerCase())
  || slug(labelOf(el)) || slug(el.className) || el.tagName.toLowerCase();

const rectOf = (el) => {
  if (!el?.isConnected) return {};
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), szer: Math.round(r.width), wys: Math.round(r.height) };
};
const stageEl = () => document.querySelector('.stage-box');

const top = () => overlays[overlays.length - 1] ?? base;
export const currentScreen = () => top().name;

function push(fields, at = Date.now()) {
  const row = {
    ...meta,
    czas_lokalny: localTime(at),
    czas_epoch_ms: at,
    czas_ms: at - t0,
    ekran: currentScreen(),
    ...fields,
  };
  rows.push(row);
  return row;
}

// Położenie mierzymy po animacji wejścia; przy zapisie pliku mierzymy od razu to, co jeszcze czeka
function measureLater(row, el) {
  const job = { row, el };
  pending.add(job);
  setTimeout(() => {
    if (!pending.has(job)) return;
    pending.delete(job);
    Object.assign(row, rectOf(el));
  }, SETTLE_MS);
}

// ---------- ekrany ----------
function logScreen(screen) {
  if (!active) return;
  const el = screen.el?.current ?? screen.el ?? stageEl();
  const row = push({ zdarzenie: 'ekran', ekran: screen.name, opis: screen.opis ?? '' });
  if (screen.el) measureLater(row, el);
  else Object.assign(row, rectOf(el));
}

export function setBaseScreen(name, opis = '') {
  const changed = base.name !== name || base.opis !== opis;
  base = { name, opis };
  if (changed && overlays.length === 0) logScreen(base);
}

// Hook dla ekranów głównych: loguje ekran przy wejściu i przy zmianie nazwy/opisu
export function useBaseScreen(name, opis = '') {
  useEffect(() => { setBaseScreen(name, opis); }, [name, opis]);
}

// Hook dla okien nad ekranem (okno produktu, kreator zestawu, okno bezczynności).
// Ekran pod spodem logujemy ponownie od razu, gdy okno zaczyna znikać.
export function useOverlayScreen(name, ref, opis = '') {
  const present = useIsPresent();
  const entry = useRef(null);

  useEffect(() => {
    // React StrictMode (tryb dev) montuje komponent dwa razy: odmontowanie-zamontowanie od razu
    // nie może dać w rejestrze fałszywego „zamknięcia” okna, więc zamknięcie odkładamy o jedno tyknięcie.
    let e = entry.current;
    if (e?.closeTimer) {
      clearTimeout(e.closeTimer);
      e.closeTimer = null;
    } else {
      e = { name, opis, el: ref };
      entry.current = e;
      overlays.push(e);
      logScreen(e);
    }
    return () => {
      e.closeTimer = setTimeout(() => { e.closeTimer = null; closeOverlay(e); }, 0);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const e = entry.current;
    if (!e || (e.name === name && e.opis === opis)) return;
    e.name = name;
    e.opis = opis;
    if (top() === e) logScreen(e);
  }, [name, opis]);

  useEffect(() => {
    if (!present && entry.current) closeOverlay(entry.current);
  }, [present]);
}

function closeOverlay(e) {
  const i = overlays.indexOf(e);
  if (i === -1) return;
  const wasTop = i === overlays.length - 1;
  overlays.splice(i, 1);
  if (wasTop) logScreen(top());
}

// ---------- AOI (obszary zainteresowania: elementy z atrybutem data-aoi) ----------
function scanAois() {
  scanTimer = null;
  if (!active) return;
  const now = new Set(document.querySelectorAll('[data-aoi]'));
  aois.forEach((info, el) => {
    if (!now.has(el) || !el.isConnected) {
      aois.delete(el);
      push({ zdarzenie: 'aoi_znika', element: info.element, aoi: info.aoi });
    }
  });
  now.forEach((el) => {
    if (aois.has(el)) return;
    const info = { aoi: el.dataset.aoi, element: idOf(el), etykieta: labelOf(el) };
    aois.set(el, info);
    const row = push({ zdarzenie: 'aoi', element: info.element, etykieta: info.etykieta, aoi: info.aoi });
    measureLater(row, el);
  });
}
const scheduleScan = () => {
  if (!scanTimer) scanTimer = setTimeout(scanAois, 40);
};

// Po zmianie układu (tryb dostępności, zmiana rozmiaru okna) AOI są w innym miejscu → zapisujemy je ponownie
export function refreshAois(opis) {
  if (!active) return;
  logScreen({ ...top(), opis: [top().opis, opis].filter(Boolean).join(' ') });
  aois.clear();
  setTimeout(scanAois, SETTLE_MS);
}

// ---------- dotknięcia ----------
const INTERACTIVE = 'button, a, input, select, textarea, [role="button"], [data-log]';

function onPointerDown(e) {
  if (!active) start();
  const el = e.target.closest?.(INTERACTIVE);
  const aoiEl = e.target.closest?.('[data-aoi]');
  const disabled = Boolean(el?.disabled || el?.getAttribute?.('aria-disabled') === 'true');
  push({
    zdarzenie: 'dotkniecie',
    element: el ? idOf(el) : 'kiosk',
    etykieta: el ? labelOf(el) : '',
    x: Math.round(e.clientX),
    y: Math.round(e.clientY),
    trafienie: el && !disabled ? 1 : 0,
    aoi: aoiEl?.dataset.aoi ?? '',
    opis: e.pointerType || 'touch',
  });
  if (disabled) logError('PRZYCISK_NIEAKTYWNY', `Przycisk jest nieaktywny: ${labelOf(el)}`);
}

// ---------- API dla aplikacji ----------
export function logError(code, message) {
  if (active) push({ zdarzenie: 'blad', element: code, etykieta: message });
}

// Zdarzenia aplikacji, np. dodanie do koszyka (zdarzenie = 'koszyk_dodaj' itd.)
export function logEvent(zdarzenie, fields = {}) {
  if (active) push({ zdarzenie, ...fields });
}

export const isActive = () => active;

export function start() {
  if (active) return;
  active = true;
  rows = [];
  aois.clear();
  const now = Date.now();
  rows.push({
    ...meta,
    scenariusz: '',
    czas_lokalny: localTime(now),
    czas_epoch_ms: now,
    czas_ms: '',
    zdarzenie: 'sesja',
    opis: `skalowanie=${Math.round(window.devicePixelRatio * 100)}% okno=${window.innerWidth}x${window.innerHeight} ekran=${window.screen.width}x${window.screen.height}`,
  });
  t0 = now;
  push({ zdarzenie: 'scenariusz_start', ekran: '' }, now);
  logScreen(top());
  scanAois();
  observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { childList: true, subtree: true });
}

// Koniec zamówienia: sukces = 1 (zamówienie złożone) albo 0 (anulowane). Zapisuje plik CSV.
// settle: true → plik zapisujemy chwilę później, żeby zmierzyć położenie AOI ekranu potwierdzenia po animacji.
export function finish({ sukces, opis = '', powod = sukces ? 'zakonczone' : 'anulowane', beacon = false, settle = false }) {
  if (!active) return;
  if (scanTimer) clearTimeout(scanTimer);
  scanAois();
  push({ zdarzenie: 'scenariusz_koniec', sukces, opis });
  observer?.disconnect();
  observer = null;
  active = false;
  // Kopia danych tego zamówienia — nowe zamówienie może zacząć się, zanim plik zostanie zapisany
  const data = rows;
  const jobs = [...pending];
  const startedAt = t0;
  rows = [];
  pending.clear();
  aois.clear();
  const write = () => {
    jobs.forEach(({ row, el }) => Object.assign(row, rectOf(el)));
    const csv = [COLUMNS.join(';'), ...data.map((r) => COLUMNS.map((c) => csvField(r[c])).join(';'))].join('\n') + '\n';
    const nazwa = `PUN_zdarzenia_${meta.uczestnik}_${meta.scenariusz || 'brak'}_${fileTime(startedAt)}_${sukces ? 'zakonczone' : powod}.csv`;
    save(nazwa, csv, beacon);
  };
  if (settle) setTimeout(write, SETTLE_MS + 50);
  else write();
}

function csvField(v) {
  const s = v === undefined || v === null ? '' : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function save(nazwa, csv, beacon) {
  const body = JSON.stringify({ nazwa, csv });
  if (beacon && navigator.sendBeacon) {
    navigator.sendBeacon('/api/zdarzenia', new Blob([body], { type: 'application/json' }));
    return;
  }
  fetch('/api/zdarzenia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((r) => console.info(`[zdarzenia] zapisano ${r.plik}`))
    .catch((err) => {
      // Brak serwera Vite (np. plik otwarty z dysku) → pobieramy plik w przeglądarce
      console.warn('[zdarzenia] zapis na serwerze nieudany, pobieram plik', err);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      a.download = nazwa;
      a.click();
      URL.revokeObjectURL(a.href);
    });
}

// Zmiana rozmiaru okna przesuwa interfejs → AOI zapisujemy ponownie
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => refreshAois(`zmiana_okna=${window.innerWidth}x${window.innerHeight}`), 300);
});

// Nasłuch dotknięć w całym dokumencie (faza capture, żeby złapać też dotknięcia w nieaktywne przyciski)
document.addEventListener('pointerdown', onPointerDown, true);
// Zamknięcie lub odświeżenie strony w trakcie zamówienia → zapisujemy to, co jest
window.addEventListener('pagehide', () => finish({ sukces: 0, opis: 'anulowano=zamkniecie_strony', beacon: true }));
