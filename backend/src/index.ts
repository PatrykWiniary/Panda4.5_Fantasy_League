import express from 'express';
import cors from 'cors';
import { getAllItems, addItem } from './db';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/items', (req, res) => {
  const items = getAllItems();
  res.json(items);
});

app.post('/api/items', (req, res) => {
  const { name, qty } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const item = addItem(name, qty ?? 0);
  res.status(201).json(item);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
