import { FormEvent, useEffect, useState } from 'react';

type Item = { id: number; name: string; qty: number };
type User = { id: number; name: string; mail: string; currency: number };

type DeckRole = 'Top' | 'Jgl' | 'Mid' | 'Adc' | 'Supp';

type DeckCard = {
  name: string;
  role: DeckRole;
  points: number;
  value: number;
  multiplier?: 'Captain' | 'Vice-captain';
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
};

type StoredDeckEntry = {
  userId: number;
  updatedAt: string;
  deck: Deck;
  summary: DeckSummary;
};

const deckRoles: DeckRole[] = ['Top', 'Jgl', 'Mid', 'Adc', 'Supp'];
const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
const PASSWORD_REQUIREMENTS_DESCRIPTION =
  'Hasło musi mieć co najmniej 8 znaków, zawierać dużą i małą literę oraz cyfrę.';

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
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);

  const [deckUserIdInput, setDeckUserIdInput] = useState('1');
  const [deckData, setDeckData] = useState<Deck | null>(null);
  const [deckSummary, setDeckSummary] = useState<DeckSummary | null>(null);
  const [deckStatus, setDeckStatus] = useState<string | null>(null);
  const [cardRole, setCardRole] = useState<DeckRole>('Top');
  const [cardName, setCardName] = useState('');
  const [cardPoints, setCardPoints] = useState('0');
  const [cardValue, setCardValue] = useState('0');
  const [cardMultiplier, setCardMultiplier] = useState<'None' | 'Captain' | 'Vice-captain'>('None');
  const [sampleCards, setSampleCards] = useState<SampleCard[]>([]);
  const [selectedSampleCard, setSelectedSampleCard] = useState<string>('');
  const [storedDecks, setStoredDecks] = useState<StoredDeckEntry[]>([]);
  const [storedDecksStatus, setStoredDecksStatus] = useState<string | null>(null);

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
    const list = await res.json();
    setUsers(list);
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
    setLoggedInUser({ id: user.id, name: user.name, mail: user.mail, currency: user.currency });
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
    setLoggedInUser(user);
    setDeckUserIdInput(String(user.id));
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
        setStoredDecksStatus('Nie udało się pobrać zapisanych talii.');
        return;
      }
      const payload: StoredDeckEntry[] = await res.json();
      setStoredDecks(payload);
      setStoredDecksStatus(`Załadowano ${payload.length} talii z bazy danych.`);
    } catch (error) {
      console.error(error);
      setStoredDecksStatus('Błąd sieci podczas pobierania talii.');
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
  };

  const fetchDeckForUser = async () => {
    setDeckStatus(null);
    const userId = loggedInUser ? loggedInUser.id : parsePositiveInt(deckUserIdInput);
    if (!userId) {
      setDeckStatus('Podaj poprawne ID użytkownika (>0).');
      return;
    }

    try {
      const res = await fetch(`/api/decks/${userId}`);
      if (!res.ok) {
        const error: DeckErrorResponse = await res.json().catch(() => ({}));
        setDeckStatus(error.message ?? 'Nie udało się pobrać talii.');
        return;
      }
      const payload: DeckResponse = await res.json();
      applyDeckResponse(payload, userId);
      setDeckStatus(`Załadowano talię użytkownika ${userId}.`);
    } catch (error) {
      console.error(error);
      setDeckStatus('Błąd sieci podczas pobierania talii.');
    }
  };

  const startEmptyDeck = async () => {
    setDeckStatus(null);
    const userId = loggedInUser ? loggedInUser.id : parsePositiveInt(deckUserIdInput);
    if (!userId) {
      setDeckStatus('Podaj poprawne ID użytkownika (>0).');
      return;
    }

    try {
      const res = await fetch('/api/decks/empty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      if (!res.ok) {
        setDeckStatus('Nie udało się utworzyć pustej talii.');
        return;
      }
      const payload: DeckResponse = await res.json();
      applyDeckResponse(payload, userId);
      setDeckStatus(`Rozpoczęto pustą talię dla użytkownika ${userId}.`);
    } catch (error) {
      console.error(error);
      setDeckStatus('Błąd sieci podczas tworzenia talii.');
    }
  };

  const ensureDeckLoaded = (): Deck | null => {
    if (!deckData) {
      setDeckStatus('Najpierw załaduj lub utwórz talię.');
      return null;
    }
    return deckData;
  };

  const buildCardPayload = (): DeckCard => ({
    name: cardName.trim(),
    role: cardRole,
    points: Number(cardPoints) || 0,
    value: Number(cardValue) || 0,
    ...(cardMultiplier === 'None' ? {} : { multiplier: cardMultiplier })
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
        let message = error.message ?? error.error ?? 'Operacja na talii nie powiodła się.';
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
            message += ` (${multiplier}${conflictRole ? ` zajęty na roli ${conflictRole}` : ' zajęty'})`;
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
      setDeckStatus('Błąd sieci podczas operacji na talii.');
    }
  };

  const addCard = async () => {
    const deck = ensureDeckLoaded();
    if (!deck) return;
    if (!cardName.trim()) {
      setDeckStatus('Podaj nazwę karty.');
      return;
    }
    await mutateDeck('/api/decks/add-card', { deck, card: buildCardPayload() }, 'Dodano kartę do talii.');
  };

  const replaceCard = async () => {
    const deck = ensureDeckLoaded();
    if (!deck) return;
    if (!cardName.trim()) {
      setDeckStatus('Podaj nazwę karty.');
      return;
    }
    await mutateDeck(
      '/api/decks/replace-card',
      { deck, role: cardRole, card: buildCardPayload() },
      'Zastąpiono kartę w talii.'
    );
  };

  const removeCard = async (role: DeckRole) => {
    const deck = ensureDeckLoaded();
    if (!deck) return;
    await mutateDeck('/api/decks/remove-card', { deck, role }, `Usunięto kartę z pozycji ${role}.`);
  };

  const saveDeck = async () => {
    const deck = ensureDeckLoaded();
    if (!deck) return;
    const userId = deck.userId ?? (loggedInUser ? loggedInUser.id : parsePositiveInt(deckUserIdInput));
    if (!userId) {
      setDeckStatus('Brak ID użytkownika powiązanego z talią.');
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
        let message = error.message ?? 'Nie udało się zapisać talii.';
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
      setDeckStatus('Błąd sieci podczas zapisywania talii.');
    }
  };

  const applySampleCard = () => {
    if (!selectedSampleCard) {
      setDeckStatus('Wybierz kartę z listy przykładowych kart.');
      return;
    }
    const card = sampleCards.find(c => c.id === selectedSampleCard);
    if (!card) {
      setDeckStatus('Nie znaleziono wybranej karty.');
      return;
    }
    setCardRole(card.role);
    setCardName(card.name);
    setCardPoints(String(card.points));
    setCardValue(String(card.value));
    if (card.multiplier && !isMultiplierAllowed(card.multiplier, card.role)) {
      setCardMultiplier('None');
      setDeckStatus(`Załadowano kartę "${card.name}", ale mnożnik ${card.multiplier} jest już zajęty.`);
    } else {
      setCardMultiplier(card.multiplier ?? 'None');
      setDeckStatus(`Załadowano przykładową kartę "${card.name}".`);
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
        <form onSubmit={login} style={{ display: 'grid', gap: 8, maxWidth: 320 }}>
          <input value={loginMail} onChange={e => setLoginMail(e.target.value)} placeholder="Email" />
          <input value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Password" type="password" />
          <button type="submit">Login</button>
        </form>
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
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{user.id}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{user.name}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{user.mail}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{user.currency}</td>
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
              <span>Nie jesteś zalogowany – podaj ID użytkownika ręcznie lub zaloguj się.</span>
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
                  Multiplier:
                  <select value={cardMultiplier} onChange={e => setCardMultiplier(e.target.value as typeof cardMultiplier)}>
                    <option value="None">None</option>
                    <option value="Captain" disabled={!isMultiplierAllowed('Captain', cardRole)}>Captain</option>
                    <option value="Vice-captain" disabled={!isMultiplierAllowed('Vice-captain', cardRole)}>Vice-captain</option>
                  </select>
                  {blockedMultipliers.length > 0 && (
                    <small style={{ display: 'block', color: '#666' }}>
                      Zajęte mnożniki: {blockedMultipliers.join(', ')}.
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
                      <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deckRoles.map(role => {
                      const card = deckData.slots[role];
                      return (
                        <tr key={role}>
                          <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{role}</td>
                          <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{card ? card.name : '—'}</td>
                          <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{card ? card.points : '—'}</td>
                          <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{card ? card.value : '—'}</td>
                          <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{card?.multiplier ?? '—'}</td>
                          <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>
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
        <h2>Zapisane talie</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => refreshStoredDecks()}>Odśwież</button>
            {storedDecksStatus && <span>{storedDecksStatus}</span>}
          </div>
          {storedDecks.length === 0 ? (
            <p>Brak zapisanych talii w bazie danych.</p>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {storedDecks.map(entry => (
                <div key={`${entry.userId}-${entry.updatedAt}`} style={{ border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
                  <strong>Użytkownik #{entry.userId}</strong> - ostatnia aktualizacja: {new Date(entry.updatedAt).toLocaleString()}
                  <div>Kompletna: {entry.summary.complete ? 'Tak' : `Nie (${entry.summary.missingRoles.join(', ') || 'brak danych'})`}</div>
                  <div>Wartość talii: {entry.summary.totalValue}</div>
                  {entry.summary.currencyCap !== undefined && (
                    <div>Limit waluty: {entry.summary.currencyCap}</div>
                  )}
                  <table style={{ borderCollapse: 'collapse', marginTop: 8, width: '100%', maxWidth: 500 }}>
                    <thead>
                      <tr>
                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Rola</th>
                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Karta</th>
                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Punkty</th>
                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Wartość</th>
                        <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Mnożnik</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deckRoles.map(role => {
                        const card = entry.deck.slots[role];
                        return (
                          <tr key={role}>
                            <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{role}</td>
                            <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{card ? card.name : '—'}</td>
                            <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{card ? card.points : '—'}</td>
                            <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{card ? card.value : '—'}</td>
                            <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{card?.multiplier ?? '—'}</td>
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
