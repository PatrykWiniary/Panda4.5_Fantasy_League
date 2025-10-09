import { useEffect, useState } from 'react';
import RegistrationPage from './RegistrationPage';
import { Link } from 'react-router';
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
    <div style={{ width: '100vw', minHeight: '80vh', background: '#f5f6fa', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <form style={{ background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#333' }}>Login</h2>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="email" style={{ display: 'block', marginBottom: '0.5rem', color: '#555' }}>Email</label>
          <input type="email" id="email" name="email" placeholder="Enter your email" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} />
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label htmlFor="password" style={{ display: 'block', marginBottom: '0.5rem', color: '#555' }}>Password</label>
          <input type="password" id="password" name="password" placeholder="Enter your password" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} />
        </div>
        <button type="submit" style={{ width: '100%', padding: '0.75rem', background: '#4078c0', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Login</button>
        <div style={{ textAlign: 'center', marginTop: '1rem', color: '#888', fontSize: '0.95rem' }}>
        Nie masz konta? Zarejestruj się
         </div>
      </form>
    </div>
  );
}
