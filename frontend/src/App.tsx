import { useEffect, useState } from 'react';
import PlayerPickPage from './components/PlayerPick.tsx'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css'
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
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<PlayerPickPage />} />
    </Routes>
  </BrowserRouter>
  );
}
