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
4. [Jak dziala aplikacja](#jak-dziala-aplikacja)
   - [Szybki przeglad krok po kroku](#szybki-przeglad-krok-po-kroku)
   - [Najczesciej wykorzystywane widoki](#najczesciej-wykorzystywane-widoki)
   - [Gdzie trafiaja dane](#gdzie-trafiaja-dane)
   - [Rejestracja i logowanie](#rejestracja-i-logowanie)
   - [Obecne zabezpieczenia](#obecne-zabezpieczenia)
5. [System punktacji](#system-punktacji)
6. [Przykladowe karty](#przykladowe-karty)
7. [Uruchomienie i build](#uruchomienie-i-build)
8. [Scenariusze testowe](#scenariusze-testowe)
9. [Przewodnik dla nowych deweloperów(dla osób niewiedzących co robimy na backendzie xD)](#przewodnik-dla-nowych-deweloperow)

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

### Historia meczow i ranking
- W `init.sql` znajduje sie tabela `match_history`, a `simulateMatch` automatycznie zapisuje kazdy wygenerowany mecz (region, dwa zespoly, zwyciezca, MVP i znacznik czasu). W `db.ts` dodano helpery `recordMatchHistory`, `getRecentMatchHistory(limit, offset)` oraz `getMatchHistoryCount`.
- Endpoint `POST /api/matches/simulate` instancjonuje `FootabalolGame`, wykonuje pojedyncza symulacje i zwraca wynik – rownoczesnie wpis trafia do historii.
- Endpoint `GET /api/matches/history?limit=15&page=2` udostepnia stronnicowana liste ostatnich symulacji i jest wykorzystywany przez frontendowy widok historii.
- Detale graczy sa przechowywane w tabeli match_history_players. GET /api/matches/:matchId zwraca pojedynczy mecz wraz z pełna tabela (rola, K/D/A, CS, zloto, wynik), a frontend pokazuje te dane po kliknieciu w wiersz.
- Symulacja meczu losuje dwie faktyczne druzyny (na podstawie 	eam_id graczy w wybranym regionie) i tylko ich zawodnicy biora udzial w wydarzeniu – pozostali zawodnicy nie dostaja dodatkowych statystyk.
- Ranking uzytkownikow (`getLeaderboardTop`, `getUserRankingEntry`) jest udostepniany przez `GET /api/users/leaderboard`, ktory zwraca TOP 10, laczna liczbe menedzerow oraz (opcjonalnie) pozycje wskazanego uzytkownika.
- Uzytkownicy moga zapisywac wybrany avatar (`POST /api/users/:id/avatar`). Backend normalizuje klucz (tylko alfanumeryczne + mylniki) i przechowuje wartosc w kolumnie `users.avatar`.

### Endpointy REST
Najwazniejsze sciezki serwera (wszystkie zaczynaja sie od `/api`):

| Metoda | Sciezka | Opis |
| ------ | ------- | ---- |
| `GET` | `/cards` | Zwraca tablice przykladowych kart z opisami.
| `GET` | `/regions` | Lista regionow turniejowych (ID + nazwa) wykorzystywana przez mapy/wybory regionu.
| `GET` | `/teams?regionId=ID` | Zwraca druzyny (z turniejem, regionem i liczba graczy) z opcjonalnym filtrem po regionie.
| `GET` | `/players?role=Top&regionId=1&teamId=3&grouped=true` | Uniwersalny endpoint zwracajacy liste lub mapowanie graczy wedlug roli; pozwala filtrowac po regionie, druzynie i roli (wynik wykorzystywany przez widok Player Pick).
| `GET` | `/decks` | Lista wszystkich zapisanych talii (uzytkownik, data aktualizacji, talia, podsumowanie).
| `GET` | `/decks/:userId` | Talia pojedynczego uzytkownika.
| `POST` | `/decks/empty` | Tworzy pusta talie (wszystkie sloty `null`).
| `POST` | `/decks/add-card` | Dodaje karte do wskazanego slotu; waliduje duplikaty i role.
| `POST` | `/decks/remove-card` | Usuwa karte z roli z uwzglednieniem waluty gracza.
| `POST` | `/decks/replace-card` | Zastepuje karte na danej roli i sprawdza limit waluty.
| `POST` | `/decks/save` | Zapisuje kompletna talie i zwraca jej podsumowanie.
| `POST` | `/tournaments/simulate` | Uruchamia symulacje turnieju dla wskazanego uzytkownika, nalicza punkty na podstawie wybranych kart i aktualizuje `users.score`.
| `GET` | `/users/leaderboard?userId=123` | Zwraca TOP 10 menedzerow, laczna liczbe uzytkownikow oraz (opcjonalnie) pozycje konkretnej osoby.
| `POST` | `/users/:userId/avatar` | Aktualizuje avatar uzytkownika po stronie backendu (nowa wartosc laduje w kolumnie `users.avatar`).
| `GET` | `/matches/history?limit=15&page=2` | Stronnicowana historia ostatnich symulacji (region, zespoly, zwyciezca, MVP, data).
| `GET` | `/matches/:matchId` | Zwraca pojedynczy wpis z historii wraz z tabela statystyk wszystkich graczy uczestniczacych w meczu.
| `POST` | `/matches/simulate` | Generuje nowy mecz w regionie gry i dopisuje go do historii.
| `DELETE` | `/matches/history` | Czyści logi meczowe (zarówno główną tabelę, jak i statystyki graczy); wykorzystywane przez przycisk „Clear History”.
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

## Jak dziala aplikacja

Projekt ma charakter warsztatowy: pozwala tworzyc talie zawodnikow League of Legends, zapisywac je w bazie, a nastepnie uruchamiac symulacje turniejowe i obserwowac zdobyte punkty.

### Szybki przeglad krok po kroku
1. **Uruchom backend i frontend.** Najprosciej przez `npm run dev` w obu katalogach lub `docker-compose up`.
2. **Zarejestruj uzytkownika** w formularzu "Register" (podaj nazwe, e-mail, haslo spelniace wymagania i budzet startowy).
3. **Zaloguj sie** po stronie frontendu. Panel "Login" zapamieta aktywnego uzytkownika w `localStorage`.
4. **Zaladuj lub utworz talie** w sekcji "Deck Tester". Mozesz:
   - wpisac ID uzytkownika i pobrac istniejaca konfiguracje (`Load Deck`),
   - albo utworzyc pusty szablon (`New Empty Deck`).
5. **Uzupelnij sloty kart** recznie lub korzystajac z przykladowej listy (`Sample card` + przycisk `Use`). Dodawaj i podmieniaj karty przyciskami `Add Card` i `Replace Card`.
6. **Zapisz talie** (`Save Deck`). Backend sprawdzi kompletność oraz limit waluty, a wynik widoczny jest w komunikatach stanu.
7. **Podejrzyj zapisane konfiguracje** w sekcji "Saved Decks" i upewnij sie, ze kazdy slot ma przypisana karte.
8. **Uruchom symulacje turnieju** w sekcji "Tournament Simulation": podaj ID uzytkownika, region, ilosc gier oraz czy chcesz zresetowac dane meczowe. Po symulacji zobaczysz podsumowanie, wynik decku oraz zaktualizowany stan konta.

### Tryb demo i funkcje debugowe
- Backend przy starcie utrzymuje dwoch przykładowych uzytkownikow: **Mia Analyst** (`mia.analyst@example.com`) oraz **Erik Strategist** (`erik.strategist@example.com`). Oba konta maja haslo `Debug123!`, kompletne talie oraz budzet odpowiadajacy wartosci kart.
- Symulacja nalicza punkty dla kazdej talii zapisanej w bazie (nie tylko dla zalogowanego konta). Wyniki widac w tabelach debugowych sekcji "Tournament Simulation" oraz w podgladzie "Saved Decks".
- Endpoint `/api/users/leaderboard` oraz sekcja "Leaderboard" na froncie prezentuja **Top 10** graczy, a jesli aktywny uzytkownik wypada poza czolowke, dodatkowo pokazuje jego pozycje ponizej listy (styl znany z serwisow sportowych) <jeszcze nie testowane teehee>.
- W tabelach rankingowych zalogowany uzytkownik jest podkreslany ciemniejszym tlem, dzieki czemu latwo go odszukac.

### Najczesciej wykorzystywane widoki
- **Items**: prosta lista kontrolna (pozostalosci z var. edukacyjnych).
- **Users**: przeglad uzytkownikow z bazy, wraz z waluta i liczba punktow.
- **Deck Tester**: najwazniejsza czesc panelu testowego (edytor kart, podsumowanie talii, komunikaty o bledach).
- **Saved Decks**: historyczne talie wraz z ostatnimi wynikami (`tournamentPoints`).
- **Tournament Simulation**: kreator symulacji, w ktorym backend nalicza punkty i zapisuje nowe statystyki.

### Gdzie trafiaja dane
- Dane stale (uzytkownicy, talie, statystyki turniejowe) przechowywane sa w SQLite (`backend/data/app.db`).
- Frontend komunikuje sie z backendem JSON-owymi endpointami REST (opis w sekcji [Endpointy REST](#endpointy-rest)).
- Aktualny uzytkownik jest zapisywany w `localStorage` przegladarki (`fantasy-league.loggedUser`).

### Rejestracja i logowanie
- **Walidacja po stronie klienta i serwera.** Formularz "Register" sprawdza wstepnie poprawnosc e-maila (`EMAIL_REGEX`) oraz sile hasla (min. 8 znakow, mala i duza litera, cyfra). Te same reguly sa egzekwowane w backendzie (`backend/src/validation.ts`), wiec nie mozna ich ominac przez wyslanie zapytania recznie.
- **Hashowanie hasel.** Przy rejestracji backend nigdy nie zapisuje hasla w postaci jawnej. Funkcja `hashPassword` w `backend/src/db.ts` generuje losowa sol i wylicza hash PBKDF2 (`sha256`) z domyslnymi parametrami 16B soli, 32B hashy i 310000 iteracji. Kazdy z tych parametrow mozna zmienic zmiennymi srodowiskowymi (`PASSWORD_SALT_BYTES`, `PASSWORD_HASH_BYTES`, `PASSWORD_HASH_ITERATIONS`, `PASSWORD_DIGEST`).
- **Logowanie.** Podczas logowania rekord uzytkownika jest wyszukiwany po adresie e-mail, a nastepnie haslo porownywane z zapisanym hashem funkcja `verifyPassword`, ktora ponownie liczy PBKDF2 i uzywa `crypto.timingSafeEqual`, aby uniknac atakow czasowych.
- **Obsluga bledow.** Gdy konto o wskazanym e-mailu juz istnieje, rejestracja zwraca `USER_ALREADY_EXISTS`. Bledne dane logowania odpowiadaja komunikatem `INVALID_CREDENTIALS`.
- **Przechowywanie sesji.** Po udanym logowaniu frontend zapisuje niesekretne dane uzytkownika (ID, imie, budzet, punktacje) w `localStorage`. Informacje te sluza jedynie do wypelniania formularzy; haslo ani tokeny sesyjne nie sa przechowywane w przegladarce.

### Obecne zabezpieczenia
- **Naglowki ochronne (helmet).** Serwer dopisuje zestaw dodatkowych naglowkow HTTP, dzieki czemu przegladarka blokuje czesc niebezpiecznych zachowan. W praktyce utrudnia to osadzenie naszej strony w cudzej ramce (clickjacking) albo odczytywanie danych przez blednie ustawione typy MIME.
- **Ograniczenie liczby prob logowania.** Kazdy adres IP ma domyslnie 10 podejsc do logowania/rejestracji na minute. Gdy ktos probuje zgadnac haslo metoda brute force, kolejne zapytania dostaje zablokowane. Administrator moze latwo zmienic limit w zmiennych `AUTH_RATE_LIMIT_WINDOW_MS` (okno czasowe) i `AUTH_RATE_LIMIT_MAX_ATTEMPTS` (liczba prob).
- **Ustawienia kryptografii przez zmienne srodowiskowe.** Metoda PBKDF2, ktora haszuje hasla, korzysta z parametrow z `process.env`. To pozwala zwiekszyc liczbe iteracji (czyli czas potrzebny napasnikowi na zlamanie hasla) bez modyfikowania kodu. Domyslne wartosci sa bezpieczne dla srodowiska demo.
- **Poprawna wspolpraca z reverse proxy.** Flaga `TRUST_PROXY=true` wylacza sie tylko wtedy, gdy aplikacja stoi za serwerem takim jak nginx lub load balancer. Pozwala to prawidlowo odczytywac oryginalne IP klienta i korzystac z ograniczenia liczby prob.
---

## System punktacji

Symulacja turniejowa laczy zapisane talie z wygenerowanymi statystykami graczy. Kluczowe obliczenia znajduja sie w `backend/src/simulationScoring.ts` i przebiegaja wedlug ponizszych zasad.

### Dane wejsciowe
- Statystyki graczy (`kills`, `deaths`, `assists`, `cs`, `gold`, `role`) pochodza z tabeli `players`. W trakcie symulacji sa aktualizowane przez `FootabalolGame`.
- Kazda karta w talii moze wskazywac gracza po `playerId`. Jezeli pole jest puste, system porownuje nazwe karty z nazwa gracza (bez wielkosci liter).
- Gdy karta nie zostanie dopasowana do zadnego gracza, slot trafia na liste brakow (`missingRoles`), a karta dostaje 0 punktow i `tournamentPoints` nie sa ustawione.

### Wzor podstawowy
Dla dopasowanej karty obliczany jest wynik bazowy:

```
score = kills * 3 + assists * 2 - deaths + floor(cs / 10) + floor(gold / 500)
```

- `kills`, `assists`, `deaths` pochodza bezposrednio z meczu.
- `cs` (creep score) wzbogaca wynik co 10 zabitych stworow.
- `gold` (zloto) dodaje 1 punkt za kazde pelne 500 jednostek.

### Mnozniki kapitanow
Karty moga miec znacznik `Captain` lub `Vice-captain`. System zamienia je na mnozniki:

| Mnoznik | Wartosc | Opis |
| --- | --- | --- |
| brak | 1.0 | standardowa karta |
| `Captain` | 2.0 | podwaja wynik bazowy |
| `Vice-captain` | 1.5 | zwieksza wynik o 50% |

Wynik calkowity to `round(score * multiplier)` (zaokraglenie do najblizszej liczby calkowitej).

### Podsumowanie talii i konta
- Wszystkie wyniki kart sa sumowane; powstaje `deckScore.total`.
- Ujemny wynik laczny jest obcinany do 0 przy naliczaniu nagrody (`awarded = max(total, 0)`).
- Punkty sa dopisywane do kolumny `users.score`, a aktualna talia otrzymuje `tournamentPoints` zapisane przy kazdej karcie.
- W odpowiedzi API znajdziesz tez `deckScore.breakdown` z tabela (rola, gracz, punkty bazowe, mnoznik, wynik) oraz `deckScore.missingRoles` z brakujacymi slotami.
- Sekcja "Saved Decks" prezentuje te dane przy kolejnych odswiezeniach, co pozwala sledzic historie wynikow po symulacjach.

### Profil uzytkownika i avatary
- Komponenty `LoginPage`, `RegistrationPage` oraz `ProfilePage` korzystaja ze wspolnego arkusza `LogReg.css`, dzieki czemu zachowuja jednolity styl (gradientowe tytuly, zaokraglone przyciski).
- Formularz rejestracji oraz ekran profilu posiadaja picker avatarow (`AvatarPicker`). Komponent automatycznie wykrywa wszystkie pliki w `frontend/src/assets/profilePics`, dzieli je na strony (15 pozycji) i pozwala wybrac jedna ikone.
- Wybor jest zapisywany w backendzie (`POST /api/users/:id/avatar`), a avatar uzytkownika wyswietla sie m.in. na stronie profilu, w panelu OngLeague oraz w tabeli leaderboardu(TODO maybe).

### Leaderboard i historia meczow
- Strona `/leaderboard` (`LeaderboardPage.tsx`) pobiera `GET /api/users/leaderboard`, wyswietla TOP 10 menedzerow oraz wyróżnia zalogowanego uzytkownika (nawet jezeli nie miesci sie w czolowce). Karta informuje rowniez o liczbie zarejestrowanych graczy.
- Strona `/matches` (`MatchHistoryPage.tsx`) prezentuje logi meczowe. Tabela wyswietla po 15 rekordow na strone, a nawigacja Prev/Next dziala analogicznie do avatarow. Przycisk "Simulate New Match" wywoluje `POST /api/matches/simulate`, a "Refresh" ponownie pobiera liste (`GET /api/matches/history?...`).
- Klikniecie wiersza meczu pobiera `GET /api/matches/:id` i rozwija szczegoly (rola, K/D/A, CS, zloto, wynik) zapisane w tabeli `match_history_players`.
- Dodatkowy przycisk "Clear History" korzysta z `DELETE /api/matches/history` i zeruje zawartosc tabeli.


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

---

## Przewodnik dla nowych deweloperów

Ta sekcja zbiera najwazniejsze elementy kodu, tak aby osoba mogla szybko zorientowac sie w strukturze repozytorium.

### Najwazniejsze typy (TypeScript)
- `backend/src/Types.ts`
  - `DeckRole` / `Role` – dozwolone role na kartach (`Top`, `Jgl`, `Mid`, `Adc`, `Supp`).
  - `Card` – przebieg pojedynczej karty (nazwa, punkty, wartosc, mnoznik). Uzywana w calej aplikacji.
  - `Deck` – talia jako mapa rola → karta (`slots`), dzieki czemu latwo przetwarzac dane na backendzie i froncie.
  - `DeckSummary` – wynik walidacji talii (kompletnosc, brakujace role, koszt).
  - `TournamentSimulationResult` – odpowiedz backendu po symulacji (gry, wyniki, zaktualizowany uzytkownik).
- `frontend/src/App.tsx` ma lokalne definicje typow zgrane z backendem. Przy zmianach w `Types.ts` warto zachowac spojnosc pomiedzy obiema stronami.

### Kluczowe moduły backendu
- `db.ts` – warstwa dostepu do danych (SQLite). Odpowiada za:
  - rejestracje/logowanie (`registerUser`, `loginUser`),
  - operacje na talii (`getDeck`, `saveDeck`),
  - symulacje (reset danych, pobieranie graczy).
- `deckManager.ts` – cala logika biznesowa talii: dodawanie kart, walidacja, kontrola kosztu, pilnowanie mnoznikow kapitanów.
- `deckIO.ts` – funkcje parsujace payloady HTTP oraz budujace odpowiedzi (wspolne miejsce walidacji danych wejsciowych).
- `simulationScoring.ts` – naliczanie punktow na podstawie statystyk graczy.
- `API/FootbalolGame.ts` – prosty silnik rozgrywek, generujacy kolejne rundy i finalny wynik.
- `validation.ts` – reguly walidacji formularzy (adres e-mail, sila hasła).
- `index.ts` – konfiguracja serwera Express (middleware, endpointy REST, limity, naglowki bezpieczeństwa).

### Moduly frontendu
- `frontend/src/App.tsx` – pojedyncza aplikacja Reacta z kilkoma sekcjami:
  - formularze rejestracji/logowania,
  - panel "Deck Tester" (edycja talii i komunikaty),
  - tabelki z uzytkownikami i zapisanymi taliami,
  - kontrolka do uruchamiania symulacji.
- `frontend/src` nie ma routingów ani zlozonego stanu – logika znajduje sie glownie w `App.tsx` oraz w lokalnych `useState`.

### Jak szukac logiki
- Operacje na kartach: `deckManager.ts` (backend) oraz funkcje `addCard`, `replaceCard`, `removeCard` w `App.tsx`.
- Zapisywanie talii: `POST /api/decks/save` – parsowanie w `deckIO.ts`, walidacja w `deckManager.ts`, zapis w `db.ts`.
- Symulacja: `POST /api/tournaments/simulate` – wejscie w `index.ts`, obsluga w `FootbalolGame`, naliczanie punktów w `simulationScoring.ts`.

### Wskazówki rozwojowe
- Przy dodawaniu nowych pól w kartach/taliach: zaktualizuj `Types.ts`, `deckManager.ts`, `deckIO.ts` oraz odpowiadajace fragmenty frontendu.
- Sensowne miejsca na rozszerzenia API:
  - `index.ts` – dopisz nowy endpoint i wykorzystaj istniejace funkcje z `db.ts`.
  - `db.ts` – trzymaj operacje bazodanowe w osobnych, czystych funkcjach (łatwiej testowac).
- Przy zmianach w hashowaniu/bezpieczenstwie: parametry PBKDF2 sa konfigurowalne zmiennymi srodowiskowymi (opisane w sekcji [Rejestracja i logowanie](#rejestracja-i-logowanie)).

Ten rozdział ma byc rozwijany na bieżąco – jezeli dodajesz wiekszy modul, dopisz tu 1-2 zdania, aby nastepne osoby wiedzialy, gdzie szukac kodu.***
