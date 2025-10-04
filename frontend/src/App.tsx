import { useEffect, useState } from 'react';

type Item = { id: number; name: string; qty: number };

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState('');

  useEffect(() => {
    fetch('/api/items')
      .then(r => r.json())
      .then(setItems)
      .catch(console.error);
  }, []);

  const add = async () => {
    if (!name) return;
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, qty: 1 })
    });
    const newItem = await res.json();
    setItems(s => [...s, newItem]);
    setName('');
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Items</h1>
      <ul>
        {items.map(i => <li key={i.id}>{i.name} ({i.qty})</li>)}
      </ul>
      <span> Haello! </span>
      <input value={name} onChange={e => setName(e.target.value)} />
      <button onClick={add}>Add</button>
    </div>
  );
}
