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

## Edycja menu
Produkty, ceny i kategorie: `src/data.js`. Teksty (PL/EN/UK): `src/i18n.js`.
Obrazki są emoji – możesz je zamienić na zdjęcia (np. `<img>` w `Menu.jsx` / `ProductModal.jsx`).

## Rejestr zdarzeń (badanie)
Każde zamówienie zapisuje się jako osobny plik CSV w folderze `zdarzenia/`
(format `PUN_zdarzenia`: dotknięcia, ekrany, obszary AOI, błędy, zmiany w koszyku).
Plik powstaje po złożeniu zamówienia (`..._zakonczone.csv`) albo po jego anulowaniu
(„Zacznij od nowa”, bezczynność, zamknięcie strony → `..._anulowane.csv`).

Dane uczestnika ustawia się w adresie strony, np.:
`http://localhost:5173/?interfejs=6&uczestnik=P02&wersja=A&kolejnosc=AB&scenariusz=S2`
(wartości domyślne: `src/logger.js` → `DEFAULTS`).

Zapis działa przy `npm run dev` i `npm run preview`. Bez serwera Vite plik pobiera się przez przeglądarkę.
Obszary AOI to elementy z atrybutem `data-aoi`, a nazwy elementów pochodzą z atrybutu `data-log`.
