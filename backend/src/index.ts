import express from 'express';
import cors from 'cors';
import { getAllItems, addItem, addUser, getAllUsers, clearUsers } from './db';

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
