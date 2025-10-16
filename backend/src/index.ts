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
  saveDeck
} from './db';
import {
  addCardToDeck,
  removeCardFromDeck,
  replaceCardInDeck,
  createDeck,
  DeckError
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

function sendDeck(res: express.Response, deck: Deck) {
  res.json(toDeckResponse(deck));
}

app.get('/api/decks', (_req, res) => {
  try {
    const decks = getAllDecks().map(entry => ({
      userId: entry.userId,
      updatedAt: entry.updatedAt,
      deck: entry.deck,
      summary: entry.summary,
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

app.post('/api/decks/empty', (_req, res) => {
  const deck = createDeck();
  sendDeck(res, deck);
});

app.post('/api/decks/add-card', (req, res) => {
  const { deck: deckPayload, card: cardPayload } = req.body ?? {};
  if (!deckPayload || typeof deckPayload !== 'object' || !cardPayload || typeof cardPayload !== 'object') {
    return res.status(400).json({ error: 'INVALID_PAYLOAD' });
  }

  try {
    const deck = parseDeckPayload(deckPayload);
    const card = parseCardPayload(cardPayload);
    const updatedDeck = addCardToDeck(deck, card);
    sendDeck(res, updatedDeck);
  } catch (error) {
    handleDeckError(res, error);
  }
});

app.post('/api/decks/remove-card', (req, res) => {
  const { deck: deckPayload, role } = req.body ?? {};
  if (!deckPayload || typeof deckPayload !== 'object' || !role) {
    return res.status(400).json({ error: 'INVALID_PAYLOAD' });
  }

  try {
    const deck = parseDeckPayload(deckPayload);
    const updatedDeck = removeCardFromDeck(deck, role as RoleInput);
    sendDeck(res, updatedDeck);
  } catch (error) {
    handleDeckError(res, error);
  }
});

app.post('/api/decks/replace-card', (req, res) => {
  const { deck: deckPayload, role, card: cardPayload } = req.body ?? {};
  if (!deckPayload || typeof deckPayload !== 'object' || !role || !cardPayload || typeof cardPayload !== 'object') {
    return res.status(400).json({ error: 'INVALID_PAYLOAD' });
  }

  try {
    const deck = parseDeckPayload(deckPayload);
    const card = parseCardPayload({ ...cardPayload, role }, role as RoleInput);
    const updatedDeck = replaceCardInDeck(deck, role as RoleInput, card);
    sendDeck(res, updatedDeck);
  } catch (error) {
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
    const result = saveDeck(userId, deck);

    if (result.status === 'saved') {
      return sendDeck(res, { ...result.deck, userId });
    }

    return res.status(400).json({
      error: 'DECK_INCOMPLETE',
      message: result.message,
      missingRoles: result.missingRoles,
      deck: result.deck,
      summary: toDeckResponse(result.deck).summary
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
