import express from 'express';
import cors from 'cors';
import {
  getAllItems,
  addItem,
  addUser,
  getAllUsers,
  clearUsers,
  registerUser,
  loginUser,
  getDeck,
  getAllDecks,
  saveDeck,
  getUserCurrency
} from './db';
import {
  addCardToDeck,
  removeCardFromDeck,
  replaceCardInDeck,
  createDeck,
  DeckError,
  calculateDeckValue
} from './deckManager';
import { Deck, RoleInput } from './Types';
import {
  DeckPayloadError,
  parseCardPayload,
  parseDeckPayload,
  parseUserId,
  toDeckResponse
} from './deckIO';
import { getSampleCards } from './cards';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/items', (req, res) => {
  const items = getAllItems();
  res.json(items);
});

app.get('/api/users', (req, res) => {
  const users = getAllUsers();
  res.json(users);
});

app.post('/api/items', (req, res) => {
  const { name, qty } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const item = addItem(name, qty ?? 0);
  res.status(201).json(item);
});

app.post('/api/users', (req, res) => {
  const { name, mail, password, currency } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const user = addUser({name, mail, password, currency});
  res.status(201).json(user);
});

app.get('/api/cards', (_req, res) => {
  res.json(getSampleCards());
});

app.post('/api/register', (req, res) => {
  const { name, mail, password, currency } = req.body;
  if (!name || !mail || !password) {
    return res.status(400).json({ error: 'MISSING_FIELDS' });
  }

  try {
    const user = registerUser({
      name,
      mail,
      password,
      currency: Number.isFinite(currency) ? Number(currency) : 0
    });
    res.status(201).json(user);
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_ALREADY_EXISTS') {
      return res.status(409).json({ error: 'USER_ALREADY_EXISTS' });
    }
    console.error(error);
    res.status(500).json({ error: 'REGISTER_FAILED' });
  }
});

app.post('/api/login', (req, res) => {
  const { mail, password } = req.body;
  if (!mail || !password) {
    return res.status(400).json({ error: 'MISSING_FIELDS' });
  }

  try {
    const user = loginUser(mail, password);
    res.json(user);
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }
    console.error(error);
    res.status(500).json({ error: 'LOGIN_FAILED' });
  }
});

function handleDeckError(res: express.Response, error: unknown) {
  if (error instanceof DeckPayloadError) {
    return res.status(400).json({
      error: error.code,
      message: error.message,
      meta: error.meta
    });
  }

  if (error instanceof DeckError) {
    return res.status(400).json({
      error: error.code,
      message: error.message,
      meta: error.meta
    });
  }

  console.error(error);
  return res.status(500).json({ error: 'DECK_OPERATION_FAILED' });
}

// Currency lookup helper that suppresses missing-user errors when we only need a hint.
function safeGetUserCurrency(userId: number): number | undefined {
  try {
    return getUserCurrency(userId);
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      return undefined;
    }
    throw error;
  }
}

function sendDeck(res: express.Response, deck: Deck, options: { currency?: number } = {}) {
  const payload = toDeckResponse(deck);
  const currency =
    options.currency ?? (deck.userId !== undefined ? safeGetUserCurrency(deck.userId) : undefined);

  if (currency !== undefined) {
    // Propagate the spending cap so the client can display remaining budget.
    payload.summary.currencyCap = currency;
  }

  res.json(payload);
}

app.get('/api/decks', (_req, res) => {
  try {
    const decks = getAllDecks().map(entry => ({
      userId: entry.userId,
      updatedAt: entry.updatedAt,
      deck: entry.deck,
      summary: {
        ...entry.summary,
        ...(entry.summary.currencyCap !== undefined
          ? {}
          : { currencyCap: safeGetUserCurrency(entry.userId) }),
      },
    }));
    res.json(decks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'DECK_FETCH_FAILED' });
  }
});

app.get('/api/decks/:userId', (req, res) => {
  try {
    const userId = parseUserId(req.params.userId);
    const deck = getDeck(userId);
    sendDeck(res, deck);
  } catch (error) {
    if (error instanceof DeckPayloadError && error.code === 'INVALID_USER_ID') {
      return res.status(400).json({ error: 'INVALID_USER_ID' });
    }
    console.error(error);
    res.status(500).json({ error: 'DECK_FETCH_FAILED' });
  }
});

app.post('/api/decks/empty', (req, res) => {
  try {
    const rawUserId = req.body?.userId;
    if (rawUserId !== undefined) {
      const userId = parseUserId(rawUserId);
      const deck = createDeck({ userId });
      return sendDeck(res, deck);
    }
  } catch (error) {
    if (error instanceof DeckPayloadError && error.code === 'INVALID_USER_ID') {
      return res.status(400).json({ error: 'INVALID_USER_ID' });
    }
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User must exist before creating a deck.' });
    }
    console.error(error);
    return res.status(500).json({ error: 'DECK_OPERATION_FAILED' });
  }

  const deck = createDeck();
  sendDeck(res, deck);
});

app.post('/api/decks/add-card', (req, res) => {
  const { deck: deckPayload, card: cardPayload } = req.body ?? {};
  if (!deckPayload || typeof deckPayload !== 'object' || !cardPayload || typeof cardPayload !== 'object') {
    return res.status(400).json({ error: 'INVALID_PAYLOAD' });
  }

  try {
    let deck = parseDeckPayload(deckPayload);
    const card = parseCardPayload(cardPayload);
    // Resolve owning user so we can validate wallet limits for the mutation.
    const rawUserId =
      deck.userId ??
      (typeof (deckPayload as { userId?: unknown }).userId !== 'undefined'
        ? (deckPayload as { userId?: unknown }).userId
        : req.body?.userId);
    const userId = parseUserId(rawUserId);

    if (deck.userId !== userId) {
      deck = createDeck({ userId, slots: deck.slots });
    }

    const currency = getUserCurrency(userId);
    const updatedDeck = addCardToDeck(deck, card);
    const totalValue = calculateDeckValue(updatedDeck);

    if (totalValue > currency) {
      throw new DeckError('CURRENCY_LIMIT_EXCEEDED', 'Adding this card exceeds available currency.', {
        totalValue,
        currency,
        overBudgetBy: totalValue - currency,
      });
    }

    sendDeck(res, updatedDeck, { currency });
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User must exist before modifying a deck.' });
    }
    handleDeckError(res, error);
  }
});

app.post('/api/decks/remove-card', (req, res) => {
  const { deck: deckPayload, role } = req.body ?? {};
  if (!deckPayload || typeof deckPayload !== 'object' || !role) {
    return res.status(400).json({ error: 'INVALID_PAYLOAD' });
  }

  try {
    let deck = parseDeckPayload(deckPayload);
    // Resolve owning user so we can validate wallet limits for the mutation.
    const rawUserId =
      deck.userId ??
      (typeof (deckPayload as { userId?: unknown }).userId !== 'undefined'
        ? (deckPayload as { userId?: unknown }).userId
        : req.body?.userId);
    const userId = parseUserId(rawUserId);

    if (deck.userId !== userId) {
      deck = createDeck({ userId, slots: deck.slots });
    }

    const currency = getUserCurrency(userId);
    const updatedDeck = removeCardFromDeck(deck, role as RoleInput);
    sendDeck(res, updatedDeck, { currency });
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User must exist before modifying a deck.' });
    }
    handleDeckError(res, error);
  }
});

app.post('/api/decks/replace-card', (req, res) => {
  const { deck: deckPayload, role, card: cardPayload } = req.body ?? {};
  if (!deckPayload || typeof deckPayload !== 'object' || !role || !cardPayload || typeof cardPayload !== 'object') {
    return res.status(400).json({ error: 'INVALID_PAYLOAD' });
  }

  try {
    let deck = parseDeckPayload(deckPayload);
    const card = parseCardPayload({ ...cardPayload, role }, role as RoleInput);
    // Resolve owning user so we can fetch the available currency.
    const rawUserId =
      deck.userId ??
      (typeof (deckPayload as { userId?: unknown }).userId !== 'undefined'
        ? (deckPayload as { userId?: unknown }).userId
        : req.body?.userId);
    const userId = parseUserId(rawUserId);

    if (deck.userId !== userId) {
      deck = createDeck({ userId, slots: deck.slots });
    }

    const currency = getUserCurrency(userId);
    const updatedDeck = replaceCardInDeck(deck, role as RoleInput, card);
    const totalValue = calculateDeckValue(updatedDeck);

    if (totalValue > currency) {
      throw new DeckError('CURRENCY_LIMIT_EXCEEDED', 'Replacing this card exceeds available currency.', {
        totalValue,
        currency,
        overBudgetBy: totalValue - currency,
      });
    }

    sendDeck(res, updatedDeck, { currency });
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User must exist before modifying a deck.' });
    }
    handleDeckError(res, error);
  }
});

app.post('/api/decks/save', (req, res) => {
  const { userId: rawUserId, deck: deckPayload } = req.body ?? {};
  if (!deckPayload || typeof deckPayload !== 'object') {
    return res.status(400).json({ error: 'INVALID_PAYLOAD' });
  }

  try {
    const userId = parseUserId(rawUserId);
    const deck = parseDeckPayload({ ...deckPayload, userId });
    const currency = getUserCurrency(userId);
    const result = saveDeck(userId, deck);

    if (result.status === 'saved') {
      return sendDeck(res, { ...result.deck, userId }, { currency });
    }

    const response = toDeckResponse(result.deck);
    response.summary.currencyCap = currency;

    return res.status(400).json({
      error: 'DECK_INCOMPLETE',
      message: result.message,
      missingRoles: result.missingRoles,
      deck: result.deck,
      summary: response.summary
    });
  } catch (error) {
    if (error instanceof DeckPayloadError && error.code === 'INVALID_USER_ID') {
      return res.status(400).json({ error: 'INVALID_USER_ID' });
    }
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User must exist before saving a deck.' });
    }
    handleDeckError(res, error);
  }
});

function test(){
  clearUsers();
  addUser({name: "nazwa",mail: "email",password: "password", currency: 3});
  const users = getAllUsers();
  console.log(users)
}
test()

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
