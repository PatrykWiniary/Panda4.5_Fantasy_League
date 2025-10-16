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
        <h1 className="login-title">SUMMONER'S LEAGUE</h1>
          <h1 className="login-title">SIGN IN</h1>
        <div className="login-field">
          <input type="email" id="email" name="email" placeholder="EMAIL" className="login-input" />
        </div>
        <div className="login-field">
          <input type="password" id="password" name="password" placeholder="PASSWORD" className="login-input" />
        </div>
        <div className="signin-field">
          <button type="submit" className="login-button">SIGN IN</button>
        </div>
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