# Kiosk – interfejs zamówień (React + Vite)

Ekran 9:16 (projekt w 1080×1920, automatycznie skalowany do okna).

## Uruchomienie

```
npm install
npm run dev
```

Otwórz http://localhost:5173 (F11 = pełny ekran).

## Ekrany
1. Ekran startowy (pokaz slajdów) → 2. Na miejscu / na wynos + język →
3. Menu (kategorie, nowości, okno produktu z personalizacją i zestawami) →
4. Twoje zamówienie (ilości, darowizna) → 5. Płatność (symulacja terminala) → 6. Numer zamówienia.

Po 60 s bezczynności pojawia się okno „Potrzebujesz więcej czasu?”.
Przycisk „Dostępność” przesuwa interfejs w dół ekranu.

## Wersja A i wersja B
Wersję wybiera prowadzący w panelu („Badana wersja”). **A** to odtworzenie oryginalnego kiosku (bez zmian).
**B** to ta sama aplikacja z ulepszeniami dostępności (projektowanie uniwersalne):

- przycisk „♿ Dostępność” otwiera panel od dołu ekranu z niezależnymi opcjami:
  wysoki kontrast (tekst ≥ 7:1), wielkość napisów (normalna / średnia / duża), bez animacji (zatrzymuje ruch, pulsowanie i automatyczny
  pokaz slajdów), więcej czasu, ułatwiony zasięg (u góry tylko informacje, wszystkie przyciski w dolnej
  części ekranu) i asystent głosowy po polsku (Web Speech API, jeśli przeglądarka go ma),
- w stopce, jak w A, „Zacznij od nowa” i „♿ Dostępność”; przy niepustym zamówieniu „Zacznij od nowa” pyta o potwierdzenie,
- potwierdzenie przed usunięciem produktu z koszyka („Tak, usuń” / „Nie, zostaw”),
- 120 s do ostrzeżenia o bezczynności i 30 s na odpowiedź (z opcją „Więcej czasu”: 300 s + 60 s; w A: 60 s + 15 s);
  „Zacznij od nowa” w ostrzeżeniu też pyta o potwierdzenie,
- cele dotyku ≥ 44 px (m.in. „✕ Zamknij” 72 px), ciemniejszy tekst pomocniczy i ceny, zaznaczenia ze znakiem ✓.

Wszystkie style wersji B są w `styles.css` pod klasą `.ver-b`; komponenty sprawdzają `useA11y().vb`.

## Edycja menu
Produkty, ceny i kategorie: `src/data.js`. Teksty (PL/EN/UK): `src/i18n.js`.
Obrazki są emoji – możesz je zamienić na zdjęcia (np. `<img>` w `Menu.jsx` / `ProductModal.jsx`).

## Rejestr zdarzeń (badanie)
Format zgodny ze słownikiem `PUN_slownik_zmiennych.csv` (plik PUN_zdarzenia):
jeden plik na uczestnika i wersję, `zdarzenia/PUN_zdarzenia_I06_P01_A.csv`, UTF-8 z BOM, separator `;`.
Scenariusze S1, S2, S3 dopisują się kolejno do tego samego pliku.

Po uruchomieniu kiosku najpierw pokazuje się **panel prowadzącego**: numer interfejsu, kod uczestnika
(P01–P99), wersja (A/B), kolejność (AB/BA) i pierwszy scenariusz. Panel pokazuje nazwę pliku, ostrzega,
gdy plik tego uczestnika i wersji już istnieje (nowa sesja dopisze się na końcu), i sprawdza skalowanie systemu.
„Uruchom kiosk” włącza pełny ekran i dopiero wtedy zaczyna się rejestrowanie.
Pola można wypełnić z adresu, np. `?interfejs=6&uczestnik=P02&wersja=B&kolejnosc=BA`.

Sterowanie przez prowadzącego (klawiatura):
- `1`, `2`, `3` – start scenariusza S1/S2/S3 (kiosk wraca na ekran startowy),
- `0` – przerwanie bieżącego scenariusza (`scenariusz_koniec`, sukces = 0),
- `T` – natychmiastowe ostrzeżenie o bezczynności (test limitu czasu),
- `Ctrl` + `Shift` + `A` – powrót do panelu prowadzącego (zapisuje plik).

Bez klawiatury scenariusz startuje pierwszym dotknięciem ekranu startowego (kolejny numer),
a kończy się potwierdzeniem zamówienia (sukces = 1). „Zacznij od nowa” i upływ limitu czasu
nie kończą scenariusza (limit czasu to wiersz `blad`), ale dopisują rejestr do pliku.

AOI (wspólna lista): `AOI_cel`, `AOI_wstecz`, `AOI_dostepnosc`, `AOI_blad` – atrybut `data-aoi`;
nazwa elementu – atrybut `data-log`. Do poprawnych współrzędnych: pełny ekran (F11) i skalowanie systemu 100%.
Zapis działa przy `npm run dev` i `npm run preview`.
