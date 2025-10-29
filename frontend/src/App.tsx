import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';

type Item = { id: number; name: string; qty: number };
type User = { id: number; name: string; mail: string; currency: number; score?: number };

type DeckRole = 'Top' | 'Jgl' | 'Mid' | 'Adc' | 'Supp';

type DeckCard = {
  name: string;
  role: DeckRole;
  points: number;
  value: number;
  multiplier?: 'Captain' | 'Vice-captain';
  playerId?: number;
  tournamentPoints?: number;
};

type Deck = {
  userId?: number;
  slots: Record<DeckRole, DeckCard | null>;
};

type DeckSummary = {
  complete: boolean;
  missingRoles: DeckRole[];
  totalValue: number;
  currencyCap?: number;
};

type DeckResponse = {
  deck: Deck;
  summary: DeckSummary;
};

type DeckErrorResponse = {
  error?: string;
  message?: string;
  missingRoles?: DeckRole[];
  summary?: DeckSummary;
  deck?: Deck;
  meta?: Record<string, unknown>;
};

type SampleCard = {
  id: string;
  name: string;
  role: DeckRole;
  description: string;
  points: number;
  value: number;
  multiplier?: 'Captain' | 'Vice-captain';
  playerId?: number;
};

type StoredDeckEntry = {
  userId: number;
  updatedAt: string;
  deck: Deck;
  summary: DeckSummary;
};

type TournamentPlayer = {
  id: number;
  name: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold?: number;
  region_id: number;
  role: DeckRole;
};

type TournamentRound = {
  region: number;
  players: TournamentPlayer[];
  gameNumber: number;
};

type TournamentFinal = {
  region: number;
  players: TournamentPlayer[];
  winner: string;
};

type DeckScoreBreakdownEntry = {
  role: DeckRole;
  playerId?: number;
  playerName: string;
  baseScore: number;
  multiplier: number;
  multiplierLabel?: 'Captain' | 'Vice-captain';
  totalScore: number;
};

type TournamentSimulationResult = {
  tournament: {
    region: { id: number; name: string };
    rounds: TournamentRound[];
    final: TournamentFinal;
    games: number;
    resetPerformed: boolean;
  };
  deck: Deck;
  deckSummary: DeckSummary;
  deckScore: {
    total: number;
    awarded: number;
    breakdown: DeckScoreBreakdownEntry[];
    missingRoles: DeckRole[];
  };
  user: {
    id: number;
    score: number;
    awardedPoints: number;
    currency?: number;
  };
};

const LOCAL_STORAGE_KEY = 'fantasy-league.loggedUser';

const deckRoles: DeckRole[] = ['Top', 'Jgl', 'Mid', 'Adc', 'Supp'];
const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
const PASSWORD_REQUIREMENTS_DESCRIPTION =
  'Has≥o musi mieÊ co najmniej 8 znakÛw, zawieraÊ duø± i ma≥± literÍ oraz cyfrÍ.';

const isValidEmail = (value: string) => EMAIL_REGEX.test(value.trim());
const isStrongPassword = (value: string) =>
  value.length >= 8 && PASSWORD_PATTERN.test(value);

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState('');

  const [users, setUsers] = useState<User[]>([]);
  const [registerName, setRegisterName] = useState('');
  const [registerMail, setRegisterMail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerCurrency, setRegisterCurrency] = useState('0');
  const [registerStatus, setRegisterStatus] = useState<string | null>(null);

  const [loginMail, setLoginMail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginStatus, setLoginStatus] = useState<string | null>(null);
  const [loggedInUser, setLoggedInUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as User;
    } catch {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
      return null;
    }
  });

  const [deckUserIdInput, setDeckUserIdInput] = useState(() => (loggedInUser ? String(loggedInUser.id) : '1'));
  const [deckData, setDeckData] = useState<Deck | null>(null);
  const [deckSummary, setDeckSummary] = useState<DeckSummary | null>(null);
  const [deckStatus, setDeckStatus] = useState<string | null>(null);
  const [cardRole, setCardRole] = useState<DeckRole>('Top');
  const [cardName, setCardName] = useState('');
  const [cardPoints, setCardPoints] = useState('0');
  const [cardValue, setCardValue] = useState('0');
  const [cardMultiplier, setCardMultiplier] = useState<'None' | 'Captain' | 'Vice-captain'>('None');
  const [cardPlayerId, setCardPlayerId] = useState('');
  const [sampleCards, setSampleCards] = useState<SampleCard[]>([]);
  const [selectedSampleCard, setSelectedSampleCard] = useState<string>('');
  const [storedDecks, setStoredDecks] = useState<StoredDeckEntry[]>([]);
  const [storedDecksStatus, setStoredDecksStatus] = useState<string | null>(null);
  const [simulationUserId, setSimulationUserId] = useState(() => (loggedInUser ? String(loggedInUser.id) : '1'));
  const [simulationRegionId, setSimulationRegionId] = useState('1');
  const [simulationGames, setSimulationGames] = useState('5');
  const [simulationReset, setSimulationReset] = useState(true);
  const [simulationStatus, setSimulationStatus] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<TournamentSimulationResult | null>(null);
  const [simulationLoading, setSimulationLoading] = useState(false);

  const persistLoggedInUser = (user: User | null) => {
    setLoggedInUser(user);
    if (typeof window !== 'undefined') {
      if (user) {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(user));
      } else {
        window.localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    }
  };

  const handleUserLogin = (user: User) => {
    persistLoggedInUser(user);
    setDeckUserIdInput(String(user.id));
    setSimulationUserId(String(user.id));
  };

  const handleLogout = () => {
    persistLoggedInUser(null);
    setDeckUserIdInput('1');
    setSimulationUserId('1');
    setDeckData(null);
    setDeckSummary(null);
    setDeckStatus(null);
    setLoginStatus(null);
  };

  function isMultiplierAllowed(multiplier: 'Captain' | 'Vice-captain', targetRole: DeckRole): boolean {
    if (!deckData) {
      return true;
    }
    return deckRoles.every(role => {
      const card = deckData.slots[role];
      if (!card || card.multiplier !== multiplier) {
        return true;
      }
      return role === targetRole;
    });
  }

  const blockedMultipliers = deckData
    ? (['Captain', 'Vice-captain'] as const).filter(multiplier => !isMultiplierAllowed(multiplier, cardRole))
    : [];

  useEffect(() => {
    fetch('/api/items')
      .then(r => r.json())
      .then(setItems)
      .catch(console.error);

    fetch('/api/users')
      .then(r => r.json())
      .then(setUsers)
      .catch(console.error);

    loadSampleCards();
    refreshStoredDecks().catch(console.error);
  }, []);

useEffect(() => {
  if (loggedInUser) {
    setDeckUserIdInput(String(loggedInUser.id));
    setSimulationUserId(String(loggedInUser.id));
  }
}, [loggedInUser]);

  useEffect(() => {
    if (cardMultiplier === 'None') {
      return;
    }
    if (!isMultiplierAllowed(cardMultiplier, cardRole)) {
      setCardMultiplier('None');
    }
  }, [cardMultiplier, cardRole, deckData]);

  const add = async () => {
    if (!name) return;
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, qty: 1 })
    });
    if (!res.ok) {
      return;
    }
    const newItem = await res.json();
    setItems(s => [...s, newItem]);
    setName('');
  };

  const refreshUsers = async () => {
    const res = await fetch('/api/users');
    if (!res.ok) {
      throw new Error('Failed to load users');
    }
    const list: User[] = await res.json();
    setUsers(list);
    if (loggedInUser) {
      const updated = list.find(user => user.id === loggedInUser.id);
      if (updated) {
        persistLoggedInUser({ ...loggedInUser, ...updated });
      }
    }
  };

  const register = async (event: FormEvent) => {
    event.preventDefault();
    setRegisterStatus(null);
    if (!registerName || !registerMail || !registerPassword) {
      setRegisterStatus('Fill in all fields.');
      return;
    }

    if (!isValidEmail(registerMail)) {
      setRegisterStatus('Podaj poprawny adres e-mail.');
      return;
    }

    if (!isStrongPassword(registerPassword)) {
      setRegisterStatus(PASSWORD_REQUIREMENTS_DESCRIPTION);
      return;
    }

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: registerName,
        mail: registerMail,
        password: registerPassword,
        currency: Number(registerCurrency) || 0
      })
    });

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'REGISTER_FAILED' }));
      if (error === 'INVALID_EMAIL') {
        setRegisterStatus('Podaj poprawny adres e-mail.');
      } else if (error === 'WEAK_PASSWORD') {
        setRegisterStatus(PASSWORD_REQUIREMENTS_DESCRIPTION);
      } else {
        setRegisterStatus(`Registration failed: ${error}`);
      }
      return;
    }

    const user = await res.json();
    setRegisterStatus(`Registered user ${user.name}.`);
    setRegisterName('');
    setRegisterMail('');
    setRegisterPassword('');
    setRegisterCurrency('0');
    await refreshUsers();
    handleUserLogin({
      id: user.id,
      name: user.name,
      mail: user.mail,
      currency: user.currency,
      score: user.score ?? 0,
    });
  };

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setLoginStatus(null);
    if (!loginMail || !loginPassword) {
      setLoginStatus('Enter email and password.');
      return;
    }

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mail: loginMail,
        password: loginPassword
      })
    });

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'LOGIN_FAILED' }));
      setLoginStatus(`Login failed: ${error}`);
      return;
    }

    const user = await res.json();
    setLoginStatus(`Logged in as ${user.name}.`);
    handleUserLogin({
      id: user.id,
      name: user.name,
      mail: user.mail,
      currency: user.currency,
      score: user.score ?? 0,
    });
    setLoginMail('');
    setLoginPassword('');
  };

  const loadSampleCards = () => {
    fetch('/api/cards')
      .then(r => r.json())
      .then((cards: SampleCard[]) => setSampleCards(cards))
      .catch(console.error);
  };

  const refreshStoredDecks = async () => {
    setStoredDecksStatus(null);
    try {
      const res = await fetch('/api/decks');
      if (!res.ok) {
        setStoredDecksStatus('Nie uda≈?o siƒ? pobraƒ? zapisanych talii.');
        return;
      }
      const payload: StoredDeckEntry[] = await res.json();
      setStoredDecks(payload);
      setStoredDecksStatus(`Za≈?adowano ${payload.length} talii z bazy danych.`);
    } catch (error) {
      console.error(error);
      setStoredDecksStatus('B≈?ƒ?d sieci podczas pobierania talii.');
    }
  };

  const parsePositiveInt = (value: string) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  };

  const applyDeckResponse = (payload: DeckResponse, forcedUserId?: number) => {
    const userId = forcedUserId ?? payload.deck.userId ?? deckData?.userId;
    const normalizedDeck: Deck = {
      ...payload.deck,
      userId,
      slots: { ...payload.deck.slots }
    };
    setDeckData(normalizedDeck);
    setDeckSummary(payload.summary);
    if (userId) {
      setSimulationUserId(String(userId));
    }
  };

  const fetchDeckForUser = async () => {
    setDeckStatus(null);
    const userId = loggedInUser ? loggedInUser.id : parsePositiveInt(deckUserIdInput);
    if (!userId) {
    setDeckStatus('Podaj poprawne ID u≈•ytkownika (>0).');
      return;
    }

    try {
      const res = await fetch(`/api/decks/${userId}`);
      if (!res.ok) {
        const error: DeckErrorResponse = await res.json().catch(() => ({}));
        setDeckStatus(error.message ?? 'Nie uda≈?o siƒ? pobraƒ? talii.');
        return;
      }
      const payload: DeckResponse = await res.json();
      applyDeckResponse(payload, userId);
      setDeckStatus(`Za≈?adowano taliƒ? u≈•ytkownika ${userId}.`);
    } catch (error) {
      console.error(error);
      setDeckStatus('B≈?ƒ?d sieci podczas pobierania talii.');
    }
  };

  const startEmptyDeck = async () => {
    setDeckStatus(null);
    const userId = loggedInUser ? loggedInUser.id : parsePositiveInt(deckUserIdInput);
    if (!userId) {
    setDeckStatus('Podaj poprawne ID u≈•ytkownika (>0).');
      return;
    }

    try {
      const res = await fetch('/api/decks/empty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      if (!res.ok) {
      setDeckStatus('Nie uda≈?o siƒ? utworzyƒ? pustej talii.');
        return;
      }
      const payload: DeckResponse = await res.json();
      applyDeckResponse(payload, userId);
      setDeckStatus(`Rozpoczƒ?to pustƒ? taliƒ? dla u≈•ytkownika ${userId}.`);
    } catch (error) {
      console.error(error);
      setDeckStatus('B≈?ƒ?d sieci podczas tworzenia talii.');
    }
  };

  const ensureDeckLoaded = (): Deck | null => {
    if (!deckData) {
      setDeckStatus('Najpierw za≈?aduj lub utw√≥rz taliƒ?.');
      return null;
    }
    return deckData;
  };

  const buildCardPayload = (): DeckCard => ({
    name: cardName.trim(),
    role: cardRole,
    points: Number(cardPoints) || 0,
    value: Number(cardValue) || 0,
    ...(cardMultiplier === 'None' ? {} : { multiplier: cardMultiplier }),
    ...(() => {
      const parsed = parsePositiveInt(cardPlayerId);
      return parsed ? { playerId: parsed } : {};
    })()
  });

  const mutateDeck = async (
    endpoint: string,
    body: Record<string, unknown>,
    successMessage: string
  ) => {
    setDeckStatus(null);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const error: DeckErrorResponse = await res.json().catch(() => ({}));
        let message = error.message ?? error.error ?? 'Operacja na talii nie powiod≈?a siƒ?.';
        if (error.error === 'CURRENCY_LIMIT_EXCEEDED' && error.meta) {
          const total = typeof error.meta.totalValue === 'number' ? error.meta.totalValue : undefined;
          const cap = typeof error.meta.currency === 'number' ? error.meta.currency : undefined;
          const over = typeof error.meta.overBudgetBy === 'number' ? error.meta.overBudgetBy : undefined;
          const details: string[] = [];
          if (total !== undefined) {
            details.push(`koszt talii ${total}`);
          }
          if (cap !== undefined) {
            details.push(`limit ${cap}`);
          }
          if (over !== undefined) {
            details.push(`przekroczono o ${over}`);
          }
          if (details.length > 0) {
            message += ` (${details.join(', ')})`;
          }
        } else if (error.error === 'MULTIPLIER_CONFLICT' && error.meta) {
          const multiplier = typeof error.meta.multiplier === 'string' ? error.meta.multiplier : null;
          const conflictRole = typeof error.meta.conflictRole === 'string' ? error.meta.conflictRole : null;
          if (multiplier) {
            message += ` (${multiplier}${conflictRole ? ` zajƒ?ty na roli ${conflictRole}` : ' zajƒ?ty'})`;
          }
        }
        setDeckStatus(message);
        if (error.deck && error.summary) {
          setDeckData(error.deck);
          setDeckSummary(error.summary);
        }
        return;
      }
      const payload: DeckResponse = await res.json();
      applyDeckResponse(payload);
      setDeckStatus(successMessage);
    } catch (error) {
      console.error(error);
      setDeckStatus('B≈?ƒ?d sieci podczas operacji na talii.');
    }
  };

  const addCard = async () => {
    const deck = ensureDeckLoaded();
    if (!deck) return;
    if (!cardName.trim()) {
      setDeckStatus('Podaj nazwƒ? karty.');
      return;
    }
    await mutateDeck('/api/decks/add-card', { deck, card: buildCardPayload() }, 'Dodano kartƒ? do talii.');
  };

  const replaceCard = async () => {
    const deck = ensureDeckLoaded();
    if (!deck) return;
    if (!cardName.trim()) {
      setDeckStatus('Podaj nazwƒ? karty.');
      return;
    }
    await mutateDeck(
      '/api/decks/replace-card',
      { deck, role: cardRole, card: buildCardPayload() },
      'Zastƒ?piono kartƒ? w talii.'
    );
  };

  const removeCard = async (role: DeckRole) => {
    const deck = ensureDeckLoaded();
    if (!deck) return;
    await mutateDeck('/api/decks/remove-card', { deck, role }, `Usuniƒ?to kartƒ? z pozycji ${role}.`);
  };

  const saveDeck = async () => {
    const deck = ensureDeckLoaded();
    if (!deck) return;
    const userId = deck.userId ?? (loggedInUser ? loggedInUser.id : parsePositiveInt(deckUserIdInput));
    if (!userId) {
      setDeckStatus('Brak ID u≈•ytkownika powiƒ?zanego z taliƒ?.');
      return;
    }
    try {
      const res = await fetch('/api/decks/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, deck: { ...deck, userId } })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const error = payload as DeckErrorResponse;
        let message = error.message ?? 'Nie uda≈?o siƒ? zapisaƒ? talii.';
        if (error.error === 'CURRENCY_LIMIT_EXCEEDED' && error.meta) {
          const total = typeof error.meta.totalValue === 'number' ? error.meta.totalValue : undefined;
          const cap = typeof error.meta.currency === 'number' ? error.meta.currency : undefined;
          const over = typeof error.meta.overBudgetBy === 'number' ? error.meta.overBudgetBy : undefined;
          const details: string[] = [];
          if (total !== undefined) {
            details.push(`koszt talii ${total}`);
          }
          if (cap !== undefined) {
            details.push(`limit ${cap}`);
          }
          if (over !== undefined) {
            details.push(`przekroczono o ${over}`);
          }
          if (details.length > 0) {
            message += ` (${details.join(', ')})`;
          }
        }
        setDeckStatus(message);
        if (error.deck && error.summary) {
          setDeckData(error.deck);
          setDeckSummary(error.summary);
        }
        return;
      }
      applyDeckResponse(payload as DeckResponse, userId);
      setDeckStatus('Talia zapisana poprawnie.');
    } catch (error) {
      console.error(error);
      setDeckStatus('B≈?ƒ?d sieci podczas zapisywania talii.');
    }
  };

  const applySampleCard = () => {
    if (!selectedSampleCard) {
      setDeckStatus('Wybierz kartÍ z listy przyk≥adowych kart.');
      return;
    }
    const card = sampleCards.find((c) => c.id === selectedSampleCard);
    if (!card) {
      setDeckStatus('Nie znaleziono wybranej karty.');
      return;
    }
    setCardRole(card.role);
    setCardName(card.name);
    setCardPoints(String(card.points));
    setCardValue(String(card.value));
    setCardPlayerId(card.playerId ? String(card.playerId) : '');
    if (card.multiplier && !isMultiplierAllowed(card.multiplier, card.role)) {
      setCardMultiplier('None');
      setDeckStatus(`Za≥adowano kartÍ "${card.name}", ale mnoønik ${card.multiplier} jest juø zajÍty.`);
    } else {
      setCardMultiplier(card.multiplier ?? 'None');
      setDeckStatus(`Za≥adowano przyk≥adow± kartÍ "${card.name}".`);
    }
  };

  const runTournamentSimulation = async () => {
    setSimulationStatus(null);
    setSimulationResult(null);

    const fallbackUserId = deckData?.userId ?? (loggedInUser ? loggedInUser.id : null);
    const parsedUserId = simulationUserId.trim() ? parsePositiveInt(simulationUserId) : null;
    const userId = parsedUserId ?? fallbackUserId;

    if (!userId) {
      setSimulationStatus('Podaj poprawne ID u≈•ytkownika do symulacji.');
      return;
    }

    const parsedRegionId = simulationRegionId.trim() ? parsePositiveInt(simulationRegionId) : null;
    const regionId = parsedRegionId ?? 1;
    if (!parsedRegionId) {
      setSimulationRegionId(String(regionId));
    }

    const parsedGames = simulationGames.trim() ? parsePositiveInt(simulationGames) : null;
    const games = parsedGames ?? 5;
    if (!parsedGames) {
      setSimulationGames(String(games));
    }

    setSimulationLoading(true);
    try {
      const res = await fetch('/api/tournaments/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          regionId,
          games,
          resetData: simulationReset,
        }),
      });

      if (!res.ok) {
        const errorBody = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        setSimulationStatus(errorBody.message ?? errorBody.error ?? 'Symulacja nie powiod≈?a siƒ?.');
        return;
      }

      const data = (await res.json()) as TournamentSimulationResult;
      setSimulationResult(data);
      applyDeckResponse({ deck: data.deck, summary: data.deckSummary }, data.user.id);
      setSimulationUserId(String(data.user.id));
      setSimulationStatus(`Przyznano ${data.deckScore.awarded} punkt√≥w. ≈Åƒ?czny wynik u≈•ytkownika: ${data.user.score}.`);
      setDeckStatus(`Deck updated after simulation. Awarded ${data.deckScore.awarded} points.`);
      if (loggedInUser && loggedInUser.id === data.user.id) {
        handleUserLogin({
          ...loggedInUser,
          ...data.user,
        });
      }
      refreshStoredDecks().catch(console.error);
      refreshUsers().catch(console.error);
    } catch (error) {
      console.error(error);
      setSimulationStatus('B≈?ƒ?d sieci podczas symulacji.');
    } finally {
      setSimulationLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, display: 'grid', gap: 24 }}>
      <section>
        <h1>Items</h1>
        <ul>
          {items.map(i => (
            <li key={i.id}>
              {i.name} ({i.qty})
            </li>
          ))}
        </ul>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="New item" />
        <button onClick={add} style={{ marginLeft: 8 }}>Add</button>
      </section>

      <section>
        <h2>Register</h2>
        <form onSubmit={register} style={{ display: 'grid', gap: 8, maxWidth: 320 }}>
          <input value={registerName} onChange={e => setRegisterName(e.target.value)} placeholder="Name" />
          <input value={registerMail} onChange={e => setRegisterMail(e.target.value)} placeholder="Email" />
          <input value={registerPassword} onChange={e => setRegisterPassword(e.target.value)} placeholder="Password" type="password" />
          <input
            value={registerCurrency}
            onChange={e => setRegisterCurrency(e.target.value)}
            placeholder="Currency"
            type="number"
            min="0"
          />
          <button type="submit">Register</button>
        </form>
        {registerStatus && <p>{registerStatus}</p>}
      </section>

      <section>
        <h2>Login</h2>
        {loggedInUser ? (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>
              Zalogowany jako <strong>{loggedInUser.name}</strong> (ID {loggedInUser.id})
              {typeof loggedInUser.score === 'number' ? ` | Punkty: ${loggedInUser.score}` : ''}
              {typeof loggedInUser.currency === 'number' ? ` | Waluta: ${loggedInUser.currency}` : ''}
            </span>
            <button type="button" onClick={handleLogout}>Wyloguj</button>
          </div>
        ) : (
          <form onSubmit={login} style={{ display: 'grid', gap: 8, maxWidth: 320 }}>
            <input value={loginMail} onChange={e => setLoginMail(e.target.value)} placeholder="Email" />
            <input value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Password" type="password" />
            <button type="submit">Login</button>
          </form>
        )}
        {loginStatus && <p>{loginStatus}</p>}
      </section>

      <section>
        <h2>Users</h2>
        <button onClick={refreshUsers} style={{ marginBottom: 12 }}>Refresh</button>
        <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 600 }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>ID</th>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Name</th>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Email</th>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Currency</th>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{user.id}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{user.name}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{user.mail}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{user.currency}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{user.score ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Deck Tester</h2>
        <div style={{ display: 'grid', gap: 12, maxWidth: 640 }}>
          <div>
            {loggedInUser ? (
              <span>Zalogowany jako <strong>{loggedInUser.name}</strong> (ID {loggedInUser.id})</span>
            ) : (
              <span>Nie jeste≈? zalogowany ‚?? podaj ID u≈•ytkownika rƒ?≈?ƒ?cznie lub zaloguj siƒ?.</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <label>
              User ID:{' '}
              <input
                value={loggedInUser ? String(loggedInUser.id) : deckUserIdInput}
                onChange={e => setDeckUserIdInput(e.target.value)}
                disabled={Boolean(loggedInUser)}
                style={{ width: 80 }}
              />
            </label>
            <button onClick={fetchDeckForUser}>Load Deck</button>
            <button onClick={startEmptyDeck}>New Empty Deck</button>
            <button onClick={saveDeck} disabled={!deckData}>Save Deck</button>
          </div>

          {deckData && (
            <>
              <div style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
                <h3>Card Editor</h3>
                {sampleCards.length > 0 && (
                  <label>
                    Sample card:
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <select
                        value={selectedSampleCard}
                        onChange={e => setSelectedSampleCard(e.target.value)}
                      >
                        <option value="">-- wybierz --</option>
                        {sampleCards.map(card => (
                          <option key={card.id} value={card.id}>
                            {card.name} ({card.role})
                          </option>
                        ))}
                      </select>
                      <button onClick={applySampleCard}>Use</button>
                    </div>
                  </label>
                )}
                <label>
                  Role:
                  <select value={cardRole} onChange={e => setCardRole(e.target.value as DeckRole)}>
                    {deckRoles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Name:
                  <input value={cardName} onChange={e => setCardName(e.target.value)} />
                </label>
                <label>
                  Points:
                  <input value={cardPoints} onChange={e => setCardPoints(e.target.value)} type="number" />
                </label>
                <label>
                  Value:
                  <input value={cardValue} onChange={e => setCardValue(e.target.value)} type="number" />
                </label>
                <label>
                  Player ID:
                  <input
                    value={cardPlayerId}
                    onChange={e => setCardPlayerId(e.target.value)}
                    type="number"
                    min={1}
                    placeholder="powiƒ?≈• kartƒ? z graczem"
                  />
                </label>
                <label>
                  Multiplier:
                  <select value={cardMultiplier} onChange={e => setCardMultiplier(e.target.value as typeof cardMultiplier)}>
                    <option value="None">None</option>
                    <option value="Captain" disabled={!isMultiplierAllowed('Captain', cardRole)}>Captain</option>
                    <option value="Vice-captain" disabled={!isMultiplierAllowed('Vice-captain', cardRole)}>Vice-captain</option>
                  </select>
                  {blockedMultipliers.length > 0 && (
                    <small style={{ display: 'block', color: '#666' }}>
                      Zajƒ?te mno≈•niki: {blockedMultipliers.join(', ')}.
                    </small>
                  )}
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={addCard}>Add Card</button>
                  <button onClick={replaceCard}>Replace Card</button>
                </div>
              </div>

              <div>
                <h3>Deck Slots</h3>
                <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 640 }}>
                  <thead>
                    <tr>
                      <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Role</th>
                      <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Card</th>
                      <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Points</th>
                      <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Value</th>
                      <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Multiplier</th>
                      <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Player ID</th>
                      <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Last score</th>
                      <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deckRoles.map(role => {
                      const card = deckData.slots[role];
                      return (
                        <tr key={role}>
                          <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{role}</td>
                          <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{card ? card.name : '-'}</td>
                          <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{card ? card.points : '-'}</td>
                          <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{card ? card.value : '-'}</td>
                          <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{card?.multiplier ?? '-'}</td>
                          <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{card?.playerId ?? '-'}</td>
                          <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{card?.tournamentPoints ?? '-'}</td>
                          <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>
                            <button
                              onClick={() => {
                                setCardRole(role);
                                if (card) {
                                  setCardName(card.name);
                                  setCardPoints(String(card.points));
                                  setCardValue(String(card.value));
                                  setCardMultiplier(card.multiplier ?? 'None');
                                  setCardPlayerId(card.playerId ? String(card.playerId) : '');
                                }
                              }}
                              disabled={!card}
                            >
                              Edit
                            </button>{' '}
                            <button onClick={() => removeCard(role)} disabled={!card}>Remove</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div>
                <h3>Summary</h3>
                {deckSummary ? (
                  <ul>
                    <li>Complete: {deckSummary.complete ? 'Yes' : 'No'}</li>
                    <li>Total value: {deckSummary.totalValue}</li>
                    {deckSummary.currencyCap !== undefined && (
                      <li>
                        Currency cap: {deckSummary.currencyCap} (Remaining: {deckSummary.currencyCap - deckSummary.totalValue})
                      </li>
                    )}
                    {!deckSummary.complete && (
                      <li>
                        Missing roles: {deckSummary.missingRoles.length > 0 ? deckSummary.missingRoles.join(', ') : '-'}
                      </li>
                    )}
                  </ul>
                ) : (
                  <p>Brak danych podsumowania.</p>
                )}
              </div>
            </>
          )}

          {deckStatus && <p>{deckStatus}</p>}
        </div>
      </section>


      <section>
        <h2>Symulacja turnieju</h2>
        <div style={{ display: 'grid', gap: 12, maxWidth: 720 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ display: 'grid', gap: 4 }}>
              User ID
              <input
                value={simulationUserId}
                onChange={e => setSimulationUserId(e.target.value)}
                placeholder="np. 1"
                style={{ width: 80 }}
              />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              Region ID
              <input
                value={simulationRegionId}
                onChange={e => setSimulationRegionId(e.target.value)}
                type="number"
                min={1}
                style={{ width: 80 }}
              />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              Games
              <input
                value={simulationGames}
                onChange={e => setSimulationGames(e.target.value)}
                type="number"
                min={1}
                max={50}
                style={{ width: 80 }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="checkbox"
                checked={simulationReset}
                onChange={e => setSimulationReset(e.target.checked)}
              />
              Reset danych przed symulacjƒ?
            </label>
            <button onClick={runTournamentSimulation} disabled={simulationLoading}>
              {simulationLoading ? 'Symulacja‚??' : 'Uruchom symulacjƒ?'}
            </button>
          </div>
          {simulationStatus && <p>{simulationStatus}</p>}

          {simulationResult && (
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <strong>Region:</strong> {simulationResult.tournament.region.name} (ID {simulationResult.tournament.region.id})<br />
                <strong>Liczba gier:</strong> {simulationResult.tournament.games}{' '}
                {simulationResult.tournament.resetPerformed ? '(dane zresetowane przed startem)' : '(bez resetu)'}<br />
                <strong>Zwyciƒ?zca fina≈?u:</strong> {simulationResult.tournament.final.winner}
              </div>

              <div>
                <strong>Punkty talii:</strong> {simulationResult.deckScore.awarded} (suma bazowa {simulationResult.deckScore.total})<br />
                <strong>Nowy wynik u≈•ytkownika:</strong> {simulationResult.user.score}
                {simulationResult.user.currency !== undefined ? ` | Waluta: ${simulationResult.user.currency}` : ''}
              </div>

              {simulationResult.deckScore.missingRoles.length > 0 && (
                <div style={{ color: '#b71c1c' }}>
                  Brak danych dla r√≥l: {simulationResult.deckScore.missingRoles.join(', ')}
                </div>
              )}

              <div>
                <h3>Rozk≈?ad punkt√≥w w talii</h3>
                <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 720 }}>
                  <thead>
                    <tr>
                      <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Rola</th>
                      <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Gracz</th>
                      <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Player ID</th>
                      <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Punkty bazowe</th>
                      <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Mnoønik</th>
                      <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>£±cznie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulationResult.deckScore.breakdown.map(entry => (
                      <tr key={entry.role}>
                        <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{entry.role}</td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{entry.playerName}</td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{entry.playerId ?? '-'}</td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{entry.baseScore}</td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>
                          {entry.multiplierLabel ? `${entry.multiplierLabel} (${entry.multiplier}x)` : entry.multiplier}
                        </td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{entry.totalScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h3>Statystyki po turnieju</h3>
                <p>
                  Poni≈•ej ostatnia lista graczy dla regionu {simulationResult.tournament.final.region}.
                </p>
                <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 720 }}>
                  <thead>
                    <tr>
                      <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Gracz</th>
                      <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Rola</th>
                      <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Kills</th>
                      <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Deaths</th>
                      <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Assists</th>
                      <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>CS</th>
                      <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Gold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulationResult.tournament.final.players.map(player => (
                      <tr key={player.id}>
                        <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{player.name}</td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{player.role}</td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{player.kills}</td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{player.deaths}</td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{player.assists}</td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{player.cs}</td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{player.gold ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>      <section>
        <h2>Zapisane talie</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => refreshStoredDecks()}>Od≈?wie≈•</button>
            {storedDecksStatus && <span>{storedDecksStatus}</span>}
          </div>
          {storedDecks.length === 0 ? (
            <p>Brak zapisanych talii w bazie danych.</p>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {storedDecks.map(entry => (
                <div key={`${entry.userId}-${entry.updatedAt}`} style={{ border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
                  <strong>U≈•ytkownik #{entry.userId}</strong> - ostatnia aktualizacja: {new Date(entry.updatedAt).toLocaleString()}
                  <div>Kompletna: {entry.summary.complete ? 'Tak' : `Nie (${entry.summary.missingRoles.join(', ') || 'brak danych'})`}</div>
                  <div>Warto≈?ƒ? talii: {entry.summary.totalValue}</div>
                  {entry.summary.currencyCap !== undefined && (
                    <div>Limit waluty: {entry.summary.currencyCap}</div>
                  )}
                  <table style={{ borderCollapse: 'collapse', marginTop: 8, width: '100%', maxWidth: 500 }}>
                    <thead>
                      <tr>
                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Rola</th>
                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Karta</th>
                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Punkty</th>
                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Warto≈?ƒ?</th>
                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Warto∂Ê</th>
                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Mnoønik</th>
                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Ostatni wynik</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deckRoles.map(role => {
                        const card = entry.deck.slots[role];
                        return (
                          <tr key={role}>
                            <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{role}</td>
                            <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{card ? card.name : '-'}</td>
                            <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{card ? card.points : '-'}</td>
                            <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{card ? card.value : '-'}</td>
                            <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{card?.multiplier ?? '-'}</td>
                            <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{card?.playerId ?? '-'}</td>
                            <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{card?.tournamentPoints ?? '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}













