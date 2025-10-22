import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/LoginPage.css';
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
    <div className="login-container">
      <h1 className="login-title login-title--main">SUMMONER'S LEAGUE</h1>
      <h2 className="login-title login-title--sub">SIGN IN</h2>

      <input
        type="email"
        placeholder="EMAIL"
        className="login-input"
        autoComplete="username"
      />
      <input
        type="password"
        placeholder="PASSWORD"
        className="login-input"
        autoComplete="current-password"
      />
<div class="login-actions">
  <a class="login-forgot">Forgot Password?</a>
  <button class="login-button">SIGN IN</button>
</div>
      <div className="login-register">
       {' '}
        <Link to="/registration" className="register-link">
           Create account
        </Link>
      </div>
    </div>
  );
}