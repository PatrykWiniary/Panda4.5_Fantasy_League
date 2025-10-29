# Panda 4.5 Fantasy League - Dokumentacja

## Spis tresci
1. [Architektura projektu](#architektura-projektu)
2. [Backend](#backend)
   - [Struktury danych](#struktury-danych)
   - [Warstwa bazy danych](#warstwa-bazy-danych)
   - [Logika talii](#logika-talii)
   - [Modul symulacji rozgrywek](#modul-symulacji-rozgrywek)
   - [Endpointy REST](#endpointy-rest)
3. [Frontend](#frontend)
   - [Sekcja Deck Tester](#sekcja-deck-tester)
   - [Sekcja zapisanych talii](#sekcja-zapisanych-talii)
4. [Przykladowe karty](#przykladowe-karty)
5. [Uruchomienie i build](#uruchomienie-i-build)
6. [Scenariusze testowe](#scenariusze-testowe)

---

## Architektura projektu

Repozytorium sklada sie z aplikacji backendowej (Node.js + Express + better-sqlite3) oraz frontendowej (React + Vite). Obie czesci mozna uruchamiac niezaleznie lub razem przy uzyciu docker-compose. Dane przechowywane sa w lokalnej bazie SQLite (`backend/data/app.db`).

### Istotne katalogi
- `backend/src` - logika serwera HTTP, operacje na bazie, modele talii, symulacja rozgrywek oraz przykladowe karty.
- `frontend/src` - aplikacja React z panelem administracyjnym/testowym.
- `backend/src/init.sql` - definicja schematu bazodanowego (tabele `items`, `users`, `decks`, `regions`, `matches`, `players`).
- `DOCUMENTATION.md` - niniejszy dokument.

---

## Backend

### Struktury danych
Plik `backend/src/Types.ts` definiuje wspolne typy TypeScript wykorzystywane w calym projekcie:
- `Role` i `RoleInput` - dozwolone role w talii (Top, Jgl, Mid, Adc, Supp) wraz z aliasami tekstowymi.
- `Card` - karta zawodnika (nazwa, punkty, wartosc, opcjonalny mnoznik kapitana) oraz dodatkowe pola `playerId` (powiazanie z graczem w bazie) i `tournamentPoints` (ostatni wynik po symulacji).
- `Deck` i `CompleteDeck` - reprezentacja talii jako mapy slotow (rola -> karta lub `null`).
- `DeckSummary` oraz `DeckSaveResult` - metadane uzywane przy walidacji talii i komunikatach API.
- `User` - podstawowe dane konta wraz z budzetem (`currency`) i zdobytymi punktami turniejowymi (`score`).
- `Region` - identyfikator i nazwa regionu turniejowego.
- `Player` - statystyki zawodnika przechowywane w bazie symulacji (kills, deaths, assists, cs, gold, region) wraz z przypisana rola (`role`) zgodna ze slotami talii.

### Warstwa bazy danych
Plik `backend/src/db.ts` kapsulkuje interakcje z SQLite. Kluczowe funkcje:
- `getDeck(userId)` - odczyt talii uzytkownika (jezeli brak rekordu, zwracana jest pusta talia).
- `getAllDecks()` - zwraca liste wszystkich talii wraz z data ostatniej aktualizacji i podsumowaniem kompletności.
- `saveDeck(userId, deck)` - proba zapisu talii. Wymaga kompletnej talii i mieszczenia sie w limicie waluty.
- `registerUser`, `loginUser` - rejestracja i logowanie z wykorzystaniem PBKDF2 (hashowanie hasel).
- `getUserCurrency`, `getUserScore`, `addUserScore` - operacje na portfelu oraz punktach turniejowych uzytkownika (wyniki kumulowane w kolumnie `score`).
- `simulateData()` - resetuje dane turniejowe i odtwarza zestaw regionow oraz graczy odpowiadajacych kartom (role, identyfikatory i poczatkowe statystyki).
- `simulateMatch(players, regionName)` - aktualizuje statystyki przekazanych zawodnikow losowymi wynikami (kills, deaths, assists, cs, gold) i zapisuje je w bazie.
- `fetchRegionNameById(regionId)` / `fetchAllPlayers(regionId)` - pomocnicze funkcje do pobierania informacji wykorzystywanych przez modul symulacji.

Schemat `init.sql` zawiera tabele `regions`, `matches` oraz `players`, a dodatkowo kolumny `role` i `gold` dla zawodnikow oraz `score` dla uzytkownikow. Funkcja `simulateData()` czysci poprzednie rekordy i uzupelnia je swiezym zestawem.

### Logika talii
Modul `backend/src/deckManager.ts` zapewnia spojne operacje na talii:
- Normalizacja roli (`normalizeRole`) i obsluga aliasow.
- Tworzenie i klonowanie talii (`createDeck`, `cloneDeck`, `createEmptyDeck`).
- Operacje na slotach: `addCardToDeck`, `removeCardFromDeck`, `replaceCardInDeck`, `upsertCardInDeck`.
- Walidacje kompletności (`ensureDeckComplete`, `summarizeDeck`) oraz wyjatki `DeckError` z bogatymi metadanymi.
- Kontrola kosztu talii (`calculateDeckValue`) oraz pilnowanie unikalnych mnoznikow kapitana (`ensureUniqueMultipliers`).

Modul `backend/src/deckIO.ts` odpowiada za parsowanie i serializacje payloadow HTTP (karty, talie, identyfikatory uzytkownikow) oraz generowanie odpowiedzi (`toDeckResponse`). Dzieki temu serwer ma jedno zrodlo walidacji wejscia.

### Modul symulacji rozgrywek
Modul `backend/src/API/FootbalolGame.ts` udostepnia klase `FootabalolGame`, ktora opiera sie na funkcjach z `db.ts`:
- `setRegion(regionId)` - konfiguruje region oraz pobiera przypisanych do niego graczy.
- `simulateMatch()` - aktualizuje biezace statystyki graczy w ramach wybranego regionu.
- `simulateTournament(region, gameNumber)` - generator rozgrywek; po kazdym meczu zwraca zaktualizowany stan zawodnikow, a na koncu wskazuje zwycieska druzyna na podstawie prostego algorytmu KDA.
- `logPlayerStats(name)` - pomocniczy logger przydatny w konsolowych testach.

Modul `backend/src/simulationScoring.ts` spina symulacje z taliami. Funkcja `scoreDeckAgainstPlayers` oblicza wynik talii na podstawie statystyk graczy (z uwzglednieniem mnoznikow kapitanow) i zapisuje wynik w polu `tournamentPoints` kazdej karty. Suma punktow jest nastepnie dodawana do `users.score`.

### Endpointy REST
Najwazniejsze sciezki serwera (wszystkie zaczynaja sie od `/api`):

| Metoda | Sciezka | Opis |
| ------ | ------- | ---- |
| `GET` | `/cards` | Zwraca tablice przykladowych kart z opisami.
| `GET` | `/decks` | Lista wszystkich zapisanych talii (uzytkownik, data aktualizacji, talia, podsumowanie).
| `GET` | `/decks/:userId` | Talia pojedynczego uzytkownika.
| `POST` | `/decks/empty` | Tworzy pusta talie (wszystkie sloty `null`).
| `POST` | `/decks/add-card` | Dodaje karte do wskazanego slotu; waliduje duplikaty i role.
| `POST` | `/decks/remove-card` | Usuwa karte z roli z uwzglednieniem waluty gracza.
| `POST` | `/decks/replace-card` | Zastepuje karte na danej roli i sprawdza limit waluty.
| `POST` | `/decks/save` | Zapisuje kompletna talie i zwraca jej podsumowanie.
| `POST` | `/tournaments/simulate` | Uruchamia symulacje turnieju dla wskazanego uzytkownika, nalicza punkty na podstawie wybranych kart i aktualizuje `users.score`.
| `GET` / `POST` | `/items`, `/users`, `/register`, `/login` | Endpoints CRUD/testowe z poprzednich wersji projektu.

Rejestracja (`POST /api/register`) odrzuca zgloszenie, jezeli adres e-mail nie przejdzie walidacji lub haslo nie spelni wymagan bezpieczenstwa (minimum 8 znakow, mala i duza litera, cyfra). Backend zwraca odpowiednio `INVALID_EMAIL` lub `WEAK_PASSWORD`.

---

## Frontend

### Sekcja Deck Tester
Plik `frontend/src/App.tsx` zawiera dodatkowa sekcje "Deck Tester", umozliwiajaca manualne testowanie talii:
- Podanie ID uzytkownika, zaladowanie istniejacej talii (lub utworzenie pustej).
- Edycja slotow poprzez formularz (rola, nazwa, punkty, wartosc, mnoznik, identyfikator gracza).
- Wczytanie przykladowej karty z listy (`GET /api/cards`).
- Dodanie, zastapienie lub usuniecie karty oraz proba zapisu.
- Wyswietlenie aktualnego podsumowania kompletności (lista brakujacych roli, koszt talii oraz ostatnie `tournamentPoints`).

### Sekcja zapisanych talii
Na dole aplikacji znajduje sie sekcja "Zapisane talie", pobierajaca `GET /api/decks`. Pozwala szybko podejrzec wszystkie przechowywane talie, w tym:
- ID uzytkownika i date ostatniej aktualizacji,
- informacje o kompletności talii i limicie waluty,
- szczegolowa tabele kart wraz z ostatnimi wynikami turniejowymi.

---

## Przykladowe karty
Modul `backend/src/cards.ts` udostepnia liste kart referencyjnych (funkcja `getSampleCards`). Kazda karta ma:
- identyfikator (`id`),
- nazwe, role, punkty i wartosc,
- opcjonalny mnoznik (`Captain` lub `Vice-captain`),
- opis pozwalajacy na szybkie skojarzenie stylu gry,
- pole `playerId`, ktore wskazuje odpowiadajacego gracza w bazie (wykorzystywane przy naliczaniu punktow).

Frontend udostepnia rozwijana liste tych kart. Wybor pozycji automatycznie uzupelnia formularz w edytorze.

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

**Uwaga:** W srodowisku CI podczas `npm run build` moze zabraknac polecenia `tsc`. Wystarczy doinstalowac TypeScript (`npm install`) przed uruchomieniem komendy.

### Docker
```
docker-compose up      # uruchomienie frontu i backendu w kontenerach
```

---

## Scenariusze testowe
1. **Dodanie karty do pustej talii:**
   - `POST /api/decks/empty` i zachowaj wynikowy `deck`.
   - `POST /api/decks/add-card` z przykladowa karta (np. "Arcana").
   - Oczekiwany status 200 i `summary.complete === false` (wciaz brakuje pozostalych roli).

2. **Zapisywanie niekompletnej talii:**
   - `POST /api/decks/save` z talia majaca tylko dwa sloty obsadzone.
   - Oczekiwany status 400 i `missingRoles` z lista brakujacych pozycji.

3. **Zapisywanie kompletnej talii:**
   - Dodaj karty na wszystkie piec roli.
   - `POST /api/decks/save` powinien zwrocic 200 oraz `summary.complete === true`.
   - `GET /api/decks` powinno zawierac nowo zapisana talie.

4. **Rejestracja uzytkownika z walidacja:**
   - Sprobuj zarejestrowac konto z haslem pozbawionym cyfr - API zwroci `WEAK_PASSWORD`.
   - Popraw dane (np. `Fantasy8Pass`) i powtorz zgloszenie - uzytkownik zostanie zapisany, a frontend automatycznie ustawi go jako aktywnego.

5. **Frontend Deck Tester:**
   - Zaladuj uzytkownika (np. ID 1), dodaj karty z listy przykladowej i zapisz.
   - Sprawdz, czy sekcja "Zapisane talie" wyswietla aktualne dane.

6. **Symulacja turnieju i naliczanie punktow:**
   - `POST /api/tournaments/simulate` z payloadem `{ "userId": 1, "regionId": 1, "games": 5 }`.
   - Oczekiwany status 200, w odpowiedzi pojawia sie podsumowanie gier (`tournament.rounds`), wyniki kart (`deckScore.breakdown`) oraz zaktualizowany licznik punktow uzytkownika (`user.score`).
   - Po wywolaniu `GET /api/decks/:userId` widoczne sa `tournamentPoints` przy kartach uzytkownika.

---

W razie pytan dotyczacych dalszej rozbudowy (np. integracja z prawdziwa baza kart lub systemem scoringowym) komentarze w kodzie wskazuja miejsca rozszerzen. Powodzenia!
