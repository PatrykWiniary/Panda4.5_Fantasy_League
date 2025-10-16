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
      <form className="login-form">
        <h2 className="login-title">Zaloguj się</h2>
        <div className="login-field">
          <label htmlFor="email" className="login-label">Email</label>
          <input type="email" id="email" name="email" placeholder="Enter your email" className="login-input" />
        </div>
        <div className="login-field">
          <label htmlFor="password" className="login-label">Password</label>
          <input type="password" id="password" name="password" placeholder="Enter your password" className="login-input" />
        </div>
        <button type="submit" className="login-button">Login</button>
        <div className="login-register">
          Nie masz konta?{' '}
      <Link to="/registration" className="register-link">
      Zarejestruj się
      </Link>
        </div>
      </form>
    </div>
  );
}