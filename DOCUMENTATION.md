# Panda 4.5 Fantasy League – Dokumentacja

## Spis treści
1. [Architektura projektu](#architektura-projektu)  
2. [Backend](#backend)  
   - [Struktury danych](#struktury-danych)  
   - [Warstwa bazy danych](#warstwa-bazy-danych)  
   - [Logika talii](#logika-talii)  
   - [Endpointy REST](#endpointy-rest)  
3. [Frontend](#frontend)  
   - [Sekcja Deck Tester](#sekcja-deck-tester)  
   - [Sekcja zapisanych talii](#sekcja-zapisanych-talii)  
4. [Przykładowe karty](#przykładowe-karty)  
5. [Uruchomienie i build](#uruchomienie-i-build)  
6. [Scenariusze testowe](#scenariusze-testowe)

---

## Architektura projektu

Repozytorium składa się z aplikacji backendowej (Node.js + Express + better-sqlite3) oraz frontendowej (React + Vite). Obie części można uruchamiać niezależnie lub razem przy użyciu docker-compose. Dane przechowywane są w lokalnej bazie SQLite (`backend/data/app.db`).  

### Istotne katalogi
- `backend/src` – logika serwera HTTP, operacje na bazie, modele talii i przykładowe karty.  
- `frontend/src` – aplikacja React z panelem administracyjnym/testowym.  
- `backend/src/init.sql` – definicja schematu bazodanowego (tabele `items`, `users`, `decks`).  
- `DOCUMENTATION.md` – niniejszy dokument.

---

## Backend

### Struktury danych
Plik `backend/src/Types.tsx` określa wspólne typy TypeScript wykorzystywane w całej aplikacji:
- `Role`, `RoleInput` – dozwolone role w talii (Top, Jgl, Mid, Adc, Supp) wraz z aliasami tekstowymi.  
- `Card` – karta zawodnika (nazwa, punkty, wartość, opcjonalny mnożnik kapitana).  
- `Deck`, `CompleteDeck` – reprezentacja talii jako mapy slotów (rola → karta lub `null`).  
- `DeckSummary` i `DeckSaveResult` – metadane służące do walidacji i komunikatów przy zapisywaniu talii.  

### Warstwa bazy danych
Plik `backend/src/db.ts` kapsułkuje interakcję z SQLite. Kluczowe funkcje:
- `getDeck(userId)` – odczyt talii użytkownika (jeżeli brak rekordu, zwracana jest pusta talia).  
- `getAllDecks()` – zwraca listę wszystkich talii w bazie wraz z datą ostatniej aktualizacji i podsumowaniem kompletności.  
- `saveDeck(userId, deck)` – próba zapisu talii. Wymaga kompletnej talii (wszystkie role obsadzone); w przeciwnym wypadku zwracana jest informacja ostrzegawcza z listą brakujących ról.  
- `registerUser`, `loginUser` – rejestracja i logowanie z wykorzystaniem PBKDF2 (hashowanie haseł).

### Logika talii
Moduł `backend/src/deckManager.ts` zapewnia spójne operacje na talii:
- Normalizacja ról (`normalizeRole`) oraz obsługa aliasów.  
- Tworzenie i klonowanie talii (`createDeck`, `cloneDeck`).  
- Operacje na slotach: `addCardToDeck`, `removeCardFromDeck`, `replaceCardInDeck`, `upsertCardInDeck`(do usunięcia).  
- Walidacje kompletności (`ensureDeckComplete`, `summarizeDeck`) zgłaszające błędy `DeckError` z kodami (`ROLE_EMPTY`, `ROLE_ALREADY_OCCUPIED`, itd.).  

Moduł `backend/src/deckIO.ts` odpowiada za parsowanie/serializację payloadów HTTP (karty, talie, identyfikatory użytkowników) oraz generowanie odpowiedzi (`toDeckResponse`). Dzięki temu serwer ma jedno źródło walidacji wejścia.

### Endpointy REST
Najważniejsze ścieżki serwera (wszystkie zaczynają się od `/api`):
## make better table in the future xD
| Metoda | Ścieżka | Opis |
| ------ | ------- | ---- |
| `GET` | `/cards` | Zwraca tablicę przykładowych kart z opisami. |
| `GET` | `/decks` | Lista wszystkich zapisanych talii (użytkownik, data aktualizacji, talia, podsumowanie). |
| `GET` | `/decks/:userId` | Talia pojedynczego użytkownika. |
| `POST` | `/decks/empty` | Tworzy pustą talię (wszystkie sloty `null`). |
| `POST` | `/decks/add-card` | Dodaje kartę do wskazanego slotu; waliduje duplikaty. |
| `POST` | `/decks/remove-card` | Usuwa kartę z roli. |
| `POST` | `/decks/replace-card` | Zastępuje kartę na danej roli. |
| `POST` | `/decks/save` | Próbuje zapisać talię użytkownika. Zwraca błąd, jeśli talia jest niekompletna. |
| `GET` / `POST` | `/items`, `/users`, `/register`, `/login` | Endpoints CRUD/testowe z poprzednich wersji projektu. |

> Rejestracja (`POST /api/register`) odrzuca zgłoszenie, jeśli adres e-mail nie przejdzie podstawowej walidacji lub hasło nie spełnia wymagań bezpieczeństwa (minimum 8 znaków, mała i duża litera, cyfra). Backend zwraca odpowiednio `INVALID_EMAIL` lub `WEAK_PASSWORD`.

Wszystkie operacje na talii zwracają strukturę `{ deck, summary }`, co pozwala frontendowi w prosty sposób aktualizować interfejs użytkownika.

---

## Frontend
# do uzupełnienia przez front end albo jak dostaniemy frontend to mogę to zrobić jak będzie czas
### Sekcja Deck Tester
Plik `frontend/src/App.tsx` zawiera dodatkową sekcję „Deck Tester”, umożliwiającą manualne testowanie talii:
- Podanie ID użytkownika, załadowanie istniejącej talii (lub utworzenie pustej).  
- Edycja slotów poprzez formularz (rola, nazwa, punkty, wartość, mnożnik).  
- Wczytanie przykładowej karty z listy (`GET /api/cards`).  
- Dodanie / zastąpienie / usunięcie karty oraz próba zapisu.  
- Wyświetlenie aktualnego podsumowania kompletności (lista brakujących ról).  

### Sekcja zapisanych talii
Na dole aplikacji znajduje się sekcja „Zapisane talie”, pobierająca `GET /api/decks`. Pozwala szybko podejrzeć wszystkie przechowywane talie, w tym:
- ID użytkownika i datę ostatniej aktualizacji,  
- informację, czy talia jest kompletna,  
- szczegółową tabelę kart w każdym slocie.

---

## Przykładowe karty
# SampleCards pewnie do usunięcia, albo zastąpienia danymi mockowymi, te wymyślone są przez AI bo nie chciało mi się szukać graczy LoLa xD
Moduł `backend/src/cards.ts` udostępnia listę kart referencyjnych (funkcja `getSampleCards`). Każda karta ma:
- identyfikator (`id`),  
- nazwę, rolę, punkty i wartość,  
- opcjonalny mnożnik (`Captain` lub `Vice-captain`),  
- opis pozwalający na szybkie skojarzenie stylu gry.

Frontend udostępnia rozwijaną listę tych kart. Wybór pozycji automatycznie uzupełnia formularz w edytorze.

---

## Uruchomienie i build

### Backend
```
cd backend
npm install            # jednorazowo
npm run dev            # tryb watchers
npm run build          # kompilacja TypeScript -> dist
```

### Frontend
```
cd frontend
npm install            # jednorazowo
npm run dev            # start Vite
npm run build          # budowa produkcyjna (wymaga zainstalowanego tsc)
```

> **Uwaga:** W środowisku CI podczas `npm run build` może zabraknąć polecenia `tsc`. Wystarczy doinstalować TypeScript (`npm install`) przed uruchomieniem komendy.

### Docker
```
docker-compose up      # uruchomienie frontu i backendu w kontenerach
```

---

## Scenariusze testowe
1. **Dodanie karty do pustej talii:**  
   - `POST /api/decks/empty` → przyjmij wynikowy `deck`.  
   - `POST /api/decks/add-card` z przykładową kartą (np. Sample `Arcana`).  
   - Oczekiwany status 200 oraz `summary.complete === false` (wciąż brakuje pozostałych ról).

2. **Zapisywanie niekompletnej talii:**  
   - `POST /api/decks/save` z talią mającą tylko dwa sloty obsadzone.  
   - Oczekiwany status 400 i `missingRoles` z listą brakujących pozycji.

3. **Zapisywanie kompletnej talii:**  
   - Dodaj karty na wszystkie pięć ról.  
   - `POST /api/decks/save` powinien zwrócić 200 oraz `summary.complete === true`.  
   - `GET /api/decks` powinno zawierać nowo zapisaną talię.

4. **Rejestracja użytkownika z walidacją:**  
   - Spróbuj zarejestrować konto z hasłem pozbawionym cyfr – API zwróci `WEAK_PASSWORD`.  
   - Popraw dane (np. `Fantasy8Pass`) i powtórz zgłoszenie – użytkownik zostanie zapisany, a frontend automatycznie ustawi go jako aktywnego.

5. **Frontend Deck Tester:**  
   - Załaduj użytkownika (np. ID 1), dodaj karty z listy przykładowej i zapisz.  
   - Sprawdź, czy sekcja „Zapisane talie” wyświetla aktualne dane.

---

W razie pytań dotyczących dalszej rozbudowy (np. integracja z prawdziwą bazą kart lub systemem scoringowym) – komentarze w kodzie wskazują miejsca rozszerzeń. Powodzenia! :)
