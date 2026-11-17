import { SCENARIOS } from './scenarios.js';
import './admin.css';

// Ekrany badania poza kioskiem. data-nolog: dotknięcia tutaj nie trafiają do rejestru kiosku.

export function ScenarioIntro({ step, total, wersja, n, onStart, disabled }) {
  const s = SCENARIOS[n];
  return (
    <div className="ses" data-nolog>
      <div className="ses-card">
        <span className="adm-badge">Scenariusz {step} z {total}</span>
        <p className="ses-meta">Wersja {wersja} · S{n}</p>
        <h1>{s.title}</h1>
        <p className="ses-text">{s.text}</p>
        <p className="ses-hint">Kiedy skończysz zadanie, kliknij „Przejdź dalej” w prawym dolnym rogu ekranu.</p>
        <button type="button" className="adm-start ses-btn" onClick={onStart} disabled={disabled}>Rozpocznij scenariusz</button>
      </div>
    </div>
  );
}

export function StudyDone({ onBack }) {
  return (
    <div className="ses" data-nolog>
      <div className="ses-card">
        <span className="ses-done-ico" aria-hidden>✓</span>
        <h1>Badanie zostało zakończone. Dziękujemy za udział!</h1>
        <button type="button" className="ses-back" onClick={onBack}>Wróć do panelu prowadzącego</button>
      </div>
    </div>
  );
}

// Przycisk badania (nie część kiosku): prawy dolny róg okna, poza kioskiem 9:16 na ekranie poziomym
export function NextButton({ onClick, disabled }) {
  return (
    <button type="button" className="ses-next" data-nolog onClick={onClick} disabled={disabled}>
      Przejdź dalej →
    </button>
  );
}
