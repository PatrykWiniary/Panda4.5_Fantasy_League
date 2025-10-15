import express from 'express';
import cors from 'cors';
import { getAllItems, addItem, addUser, getAllUsers, clearUsers, registerUser, loginUser } from './db';

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
