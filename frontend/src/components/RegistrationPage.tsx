import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/LogReg.css';
import homeIcon from "../assets/home.svg";
import userIcon from "../assets/user.svg";

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
      <div className="page-icons">
        <Link to="/" className="page-icon home-icon">
          <img src={homeIcon} alt="Home" className="icon-image" />
        </Link>
        <Link to="/profile" className="page-icon user-icon">
          <img src={userIcon} alt="Profile" className="icon-image" />
        </Link>
      </div>

      <div className="login-form">
        <h1 className="login-title login-title--main">SUMMONER'S LEAGUE</h1>
        <h2 className="login-title login-title--sub">SIGN UP</h2>

        <input
          type="email"
          placeholder="EMAIL"
          className="login-input"
          autoComplete="username"
        />
        <input
          type="text"
          placeholder="USERNAME"
          className="login-input"
          autoComplete="username"
        />
        <input
          type="password"
          placeholder="PASSWORD"
          className="login-input"
          autoComplete="new-password"
        />

        <div className="login-actions">
          <button type="submit" className="login-button">
            SIGN UP
          </button>
        </div>

        <div className="login-register">
          Already have an account?{' '}
          <Link to="/login" className="register-link">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}