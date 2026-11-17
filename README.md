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
jeden plik na uczestnika i wersję, `zdarzenia/PUN_zdarzenia_I02_P01_A.csv`, UTF-8 z BOM, separator `;`.
Scenariusze S1, S2, S3 danej wersji dopisują się kolejno do tego samego pliku.

Po uruchomieniu najpierw pokazuje się **panel prowadzącego**: kod uczestnika (P01–P99)
i kolejność wersji (AB/BA). Panel pokazuje sekwencję scenariuszy i nazwy obu plików, ostrzega, gdy któryś
już istnieje (nowa sesja dopisze się na końcu), i sprawdza skalowanie systemu.
„Rozpocznij sesję” włącza pełny ekran i dopiero wtedy zaczyna się rejestrowanie.
Pola można wypełnić z adresu, np. `?uczestnik=P02&kolejnosc=BA`.

Sesja to sześć scenariuszy: AB = S1(A) → S2(A) → S3(A) → S1(B) → S2(B) → S3(B), BA – odwrotna kolejność wersji.
Przed każdym scenariuszem wyświetla się jego opis i przycisk „Rozpocznij scenariusz” (nic nie startuje samo).
W trakcie scenariusza w prawym dolnym rogu ekranu jest przycisk **„Przejdź dalej”** – jedyny sposób zakończenia
scenariusza: zapisuje `scenariusz_koniec` (kolumna `sukces` pusta – ocenia prowadzący), resetuje kiosk
i pokazuje kolejną instrukcję. Złożenie zamówienia zapisuje tylko wiersz `zamowienie`. Po szóstym scenariuszu
pojawia się ekran „Badanie zostało zakończone. Dziękujemy za udział!” z powrotem do panelu.
Treści scenariuszy: `src/admin/scenarios.js`. Dotknięcia instrukcji i „Przejdź dalej” nie trafiają do rejestru.

Sterowanie przez prowadzącego (klawiatura):
- `T` – natychmiastowe ostrzeżenie o bezczynności (test limitu czasu),
- `Ctrl` + `Shift` + `A` – przerwanie sesji i powrót do panelu prowadzącego (zapisuje plik).

„Zacznij od nowa” i upływ limitu czasu nie kończą scenariusza (limit czasu to wiersz `blad`), ale dopisują rejestr do pliku.

AOI (wspólna lista): `AOI_cel`, `AOI_wstecz`, `AOI_dostepnosc`, `AOI_blad` – atrybut `data-aoi`;
nazwa elementu – atrybut `data-log`. Do poprawnych współrzędnych: pełny ekran (F11) i skalowanie systemu 100%.
Zapis działa przy `npm run dev` i `npm run preview`.
