import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { translate } from './i18n.js';
import { formatPrice } from './data.js';
import { A11yContext, DEFAULT_OPTS, TEXT_SIZES, speak, stopSpeaking } from './a11y.js';
import Stage from './components/Stage.jsx';
import IdleModal from './components/IdleModal.jsx';
import A11yPanel from './components/A11yPanel.jsx';
import ConfirmCancel from './components/ConfirmCancel.jsx';
import TopBar, { hasTopZone } from './components/TopBar.jsx';
import Attract from './screens/Attract.jsx';
import DineOption from './screens/DineOption.jsx';
import Menu from './screens/Menu.jsx';
import Cart from './screens/Cart.jsx';
import Payment from './screens/Payment.jsx';
import Confirmation from './screens/Confirmation.jsx';
import { flush, isActive, logError, logOrder, refreshAois, setResetHandler } from './logger.js';

// Wersja B: dłuższy czas na zamówienie i dłuższe ostrzeżenie przed jego anulowaniem;
// opcja „Więcej czasu” (B+) wydłuża go jeszcze bardziej
const IDLE_MS = { A: 60_000, B: 120_000, 'B+': 300_000 };
const IDLE_WARN_S = { A: 15, B: 30, 'B+': 60 };

// Wersja B: wysokość strefy informacyjnej w trybie ułatwionego zasięgu
const REACH_TOP = 600;

// Wersja B: anulowanie przez samego klienta nie wyłącza jego ustawień dostępności
const KEEP_OPTS = ['zacznij_od_nowa', 'bezczynnosc_przycisk'];

const OPT_TITLES = {
  contrast: 'optContrast', textSize: 'optText', noMotion: 'optMotion', moreTime: 'optTime', reach: 'optReach', audio: 'optAudio',
};

// Kolejność ekranów — decyduje o kierunku animacji przejścia
const ORDER = ['attract', 'dine', 'menu', 'cart', 'payment', 'done'];

const screenVariants = {
  enter: (dir) => ({ x: dir > 0 ? '100%' : '-30%', opacity: dir > 0 ? 1 : 0, scale: dir > 0 ? 1 : 0.96 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir) => ({ x: dir > 0 ? '-30%' : '100%', opacity: dir > 0 ? 0 : 1, scale: dir > 0 ? 0.96 : 1 }),
};

export default function App({ version = 'A' }) {
  const vb = version === 'B';
  const [screen, setScreen] = useState('attract');
  const [dir, setDir] = useState(1);
  const [lang, setLang] = useState('pl');
  const [dine, setDine] = useState(null);
  const [cart, setCart] = useState([]);
  const [donation, setDonation] = useState(null);
  const [a11y, setA11y] = useState(false);
  const [opts, setOpts] = useState(DEFAULT_OPTS);
  const [panel, setPanel] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [idle, setIdle] = useState(false);
  const [order, setOrder] = useState(null);
  const idleTimer = useRef();

  const t = useMemo(() => translate(lang), [lang]);
  const timing = vb && opts.moreTime ? 'B+' : vb ? 'B' : 'A';

  const go = useCallback(
    (next) => {
      setDir(ORDER.indexOf(next) >= ORDER.indexOf(screen) ? 1 : -1);
      setScreen(next);
    },
    [screen]
  );

  // Powrót do ekranu startowego. Nie kończy scenariusza (koniec = „Przejdź dalej”), ale dopisuje rejestr do pliku.
  const reset = useCallback((reason) => {
    if (reason === 'limit_czasu') logError('LIMIT_CZASU', `${t('moreTimeSub')} 0 s`);
    setDir(-1);
    setScreen('attract');
    setCart([]);
    setDine(null);
    setDonation(null);
    setLang('pl');
    setA11y(false);
    setIdle(false);
    setOrder(null);
    setPanel(false);
    setConfirmCancel(false);
    if (!KEEP_OPTS.includes(reason)) {
      setOpts(DEFAULT_OPTS);
      stopSpeaking();
    }
    if (reason !== 'scenariusz') setTimeout(() => flush(), 0);
  }, [t]);

  // Start scenariusza klawiszem prowadzącego → kiosk wraca na ekran startowy
  useEffect(() => { setResetHandler(() => reset('scenariusz')); }, [reset]);

  // Wykrywanie bezczynności
  const bump = useCallback(() => {
    clearTimeout(idleTimer.current);
    if (screen === 'attract' || screen === 'done') return;
    idleTimer.current = setTimeout(() => setIdle(true), IDLE_MS[timing]);
  }, [screen, timing]);

  useEffect(() => {
    bump();
    return () => clearTimeout(idleTimer.current);
  }, [bump]);

  // Klawisz prowadzącego T: od razu pokazuje ostrzeżenie o bezczynności (test limitu czasu)
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.key.toLowerCase() !== 't') return;
      if (screen === 'attract' || screen === 'done') return;
      clearTimeout(idleTimer.current);
      setIdle(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen]);

  const addToCart = (item) => setCart((c) => [...c, { ...item, uid: crypto.randomUUID() }]);
  const replaceLine = (uid, item) => setCart((c) => c.map((i) => (i.uid === uid ? { ...item, uid } : i)));
  const updateQty = (uid, qty) =>
    setCart((c) => (qty <= 0 ? c.filter((i) => i.uid !== uid) : c.map((i) => (i.uid === uid ? { ...i, qty } : i))));

  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const total = subtotal + (donation?.amount ?? 0);
  const count = cart.reduce((s, i) => s + i.qty, 0);

  const finishOrder = (method) => {
    const number = Math.floor(100 + Math.random() * 899);
    setOrder({ number, method, total });
    go('done');
  };

  // Potwierdzenie zamówienia trafia do rejestru, ale scenariusz trwa do „Przejdź dalej”
  useEffect(() => {
    if (screen === 'done' && order && isActive()) {
      const items = cart.map((l) => `${l.qty}x${l.product.id}`).join(',');
      logOrder(`zamowienie=${order.number} platnosc=${order.method} suma_gr=${Math.round(order.total * 100)} na_wynos=${dine === 'out' ? 1 : 0} pozycje=${items}`);
    }
  }, [screen, order]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tryb dostępności przesuwa cały interfejs → AOI mają nowe położenie
  const prevA11y = useRef(a11y);
  useEffect(() => {
    if (prevA11y.current === a11y) return;
    prevA11y.current = a11y;
    refreshAois(`dostepnosc=${a11y ? 1 : 0}`);
  }, [a11y]);

  // Wersja B: większy tekst i ułatwiony zasięg zmieniają układ → AOI mają nowe położenie
  const layoutKey = `zasieg=${opts.reach ? 1 : 0} tekst=${opts.textSize}`;
  const prevLayout = useRef(layoutKey);
  useEffect(() => {
    if (prevLayout.current === layoutKey) return;
    prevLayout.current = layoutKey;
    refreshAois(layoutKey);
  }, [layoutKey]);

  // ---------- Wersja B: ustawienia dostępności i asystent głosowy ----------
  const say = useCallback((text, interrupt = false) => {
    if (vb && opts.audio) speak(text, lang, interrupt);
  }, [vb, opts.audio, lang]);

  const setOpt = (id, value) => {
    setOpts((o) => ({ ...o, [id]: value }));
    const state = id === 'textSize' ? t(TEXT_SIZES[value]) : value ? t('turnedOn') : t('turnedOff');
    const msg = `${t(OPT_TITLES[id])}: ${state}`;
    if (id === 'audio') {
      if (value) speak(msg, lang, true);
      else stopSpeaking();
    } else {
      say(msg, true);
    }
  };
  const resetOpts = () => {
    stopSpeaking();
    setOpts(DEFAULT_OPTS);
  };

  // Dotknięty przycisk jest odczytywany na głos (potwierdzenie, co zostało wybrane)
  useEffect(() => {
    if (!vb || !opts.audio) return undefined;
    const onClick = (e) => {
      const el = e.target.closest?.('button, [role="button"]');
      if (!el || el.dataset.speak === 'off') return;
      speak(el.getAttribute('aria-label') || el.dataset.label || el.innerText, lang, true);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [vb, opts.audio, lang]);

  // Instrukcja dla każdego ekranu (czytana po wejściu na ekran)
  useEffect(() => {
    if (!vb || !opts.audio) return;
    const help = {
      attract: t('helpStart'),
      dine: t('helpDine'),
      menu: t('helpMenu'),
      cart: `${t('itemsCount')}: ${count}. ${t('helpCart')} ${formatPrice(total)}.`,
      payment: `${t('total')}: ${formatPrice(total)}. ${t('helpPay')}`,
      done: `${t('helpDone')} ${order?.number ?? ''}.`,
    }[screen];
    say(help);
  }, [screen, opts.audio, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const requestRestart = () => (cart.length === 0 ? reset('zacznij_od_nowa') : setConfirmCancel(true));
  const anyOpt = Object.values(opts).some(Boolean);

  const topFor = (s) => (vb && opts.reach && hasTopZone(s) ? REACH_TOP : 0);
  const stageClass = vb
    ? ['ver-b', opts.contrast && 'hc', opts.textSize === 1 && 'md', opts.textSize === 2 && 'lg', opts.reach && 'reach', opts.noMotion && 'no-motion'].filter(Boolean).join(' ')
    : '';

  const shared = vb
    ? { t, lang, setLang, go, reset, a11y: anyOpt, setA11y: () => setPanel(true), requestRestart }
    : { t, lang, setLang, go, reset, a11y, setA11y };

  const screens = {
    attract: <Attract {...shared} />,
    dine: <DineOption {...shared} onPick={(d) => { setDine(d); go('menu'); }} />,
    menu: <Menu {...shared} cart={cart} count={count} subtotal={subtotal} addToCart={addToCart} />,
    cart: (
      <Cart
        {...shared}
        cart={cart}
        updateQty={updateQty}
        replaceLine={replaceLine}
        subtotal={subtotal}
        total={total}
        donation={donation}
        setDonation={setDonation}
      />
    ),
    payment: <Payment {...shared} total={total} onPaid={finishOrder} />,
    done: <Confirmation {...shared} order={order} dine={dine} />,
  };

  const ctx = useMemo(() => ({ vb, opts, say }), [vb, opts, say]);

  return (
    <A11yContext.Provider value={ctx}>
      <MotionConfig reducedMotion={vb && opts.noMotion ? 'always' : 'never'}>
      <Stage onPointerDown={bump} className={stageClass}>
        <motion.div
          className="a11y-layer"
          animate={!vb && a11y ? { scale: 0.62, y: 365 } : { scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 160, damping: 24 }}
        >
          {vb && opts.reach && <TopBar t={t} screen={screen} height={topFor(screen)} />}
          <AnimatePresence initial={false} custom={dir} mode="popLayout">
            <motion.div
              key={screen}
              className="screen"
              style={vb ? { top: topFor(screen) } : undefined}
              custom={dir}
              variants={screenVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 220, damping: 30, mass: 0.9 }}
            >
              {screens[screen]}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <AnimatePresence>
          {panel && <A11yPanel t={t} opts={opts} setOpt={setOpt} resetOpts={resetOpts} onClose={() => setPanel(false)} />}
        </AnimatePresence>

        <AnimatePresence>
          {confirmCancel && (
            <ConfirmCancel t={t} name="od_nowa" ico="↺" onKeep={() => setConfirmCancel(false)} onConfirm={() => reset('zacznij_od_nowa')} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {idle && (
            <IdleModal
              t={t}
              seconds={IDLE_WARN_S[timing]}
              onContinue={() => { setIdle(false); bump(); }}
              onReset={(why) => reset(why)}
              onCancel={vb ? () => { setIdle(false); requestRestart(); } : undefined}
            />
          )}
        </AnimatePresence>
      </Stage>
      </MotionConfig>
    </A11yContext.Provider>
  );
}
