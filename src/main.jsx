import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import AdminSetup from './admin/AdminSetup.jsx';
import { NextButton, ScenarioIntro, StudyDone } from './admin/SessionScreens.jsx';
import { sequenceFor } from './admin/scenarios.js';
import { beginStep, configure, endScenario, shutdown, startScenario } from './logger.js';
import './styles.css';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const exitFullscreen = () => {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
};

// Panel prowadzącego → sześć scenariuszy (instrukcja → kiosk → „Przejdź dalej”) → koniec badania.
// Ctrl+Shift+A w każdej chwili wraca do panelu.
function Root() {
  const [session, setSession] = useState(null); // { ...dane z panelu, steps, startedAt }
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState('intro'); // intro | kiosk | done
  const busy = useRef(false); // blokada podwójnego kliknięcia („Rozpocznij”, „Przejdź dalej”)
  const started = useRef(-1); // krok, którego scenariusz już wystartował (StrictMode uruchamia efekty dwa razy)

  const backToPanel = (reason) => {
    shutdown(reason);
    setSession(null);
    exitFullscreen();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a')) return;
      e.preventDefault();
      backToPanel('panel');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const start = async (cfg, fullscreen) => {
    if (fullscreen && !document.fullscreenElement) {
      try {
        // Niektóre przeglądarki nie odpowiadają na prośbę o pełny ekran — po 1,5 s startujemy mimo to
        await Promise.race([document.documentElement.requestFullscreen(), wait(1500)]);
        await wait(400); // wiersz `sesja` ma mieć już rozmiar okna po przejściu na pełny ekran
      } catch { /* przeglądarka odmówiła — działamy w oknie */ }
    }
    const steps = sequenceFor(cfg.kolejnosc);
    configure({ ...cfg, wersja: steps[0].wersja });
    busy.current = false;
    started.current = -1;
    setStep(0);
    setPhase('intro');
    setSession({ ...cfg, steps, startedAt: Date.now() });
  };

  const current = session?.steps[step];

  const beginScenario = () => {
    if (busy.current) return;
    busy.current = true;
    beginStep(current.wersja);
    setPhase('kiosk');
  };

  // Scenariusz startuje po zamontowaniu kiosku (efekty dzieci, w tym ekran startowy, działają wcześniej)
  useEffect(() => {
    if (phase !== 'kiosk' || started.current === step) return;
    started.current = step;
    startScenario(current.n, `start=rozpocznij krok=${step + 1}`);
    busy.current = false;
  }, [phase, step]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => {
    if (busy.current || phase !== 'kiosk') return;
    busy.current = true;
    endScenario({ opis: `koniec=przejdz_dalej krok=${step + 1}` });
    if (step + 1 >= session.steps.length) {
      setPhase('done');
    } else {
      setStep(step + 1);
      setPhase('intro');
    }
  };

  useEffect(() => {
    if (phase === 'intro') busy.current = false;
  }, [phase, step]);

  if (!session) return <AdminSetup onStart={start} />;
  if (phase === 'done') return <StudyDone onBack={() => backToPanel('koniec_badania')} />;
  if (phase === 'intro') {
    return (
      <ScenarioIntro
        step={step + 1}
        total={session.steps.length}
        wersja={current.wersja}
        n={current.n}
        onStart={beginScenario}
      />
    );
  }
  return (
    <>
      <App key={`${session.startedAt}-${step}`} version={current.wersja} />
      <NextButton onClick={next} />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
