import { useEffect, useState } from 'react';
import LoginPage from './components/LoginPage';
import RegistrationPage from './components/RegistrationPage';
import HomePage from './components/HomePage';
import ProfilePage from './components/ProfilePage';
import OngLeaguePage from './components/OngLeague';
import CreateNewLeaguePage from './components/CreateNewLeague';
import JoinNewLeaguePage from './components/JoinNewLeague';
import "./App.css";
import { BrowserRouter, Routes, Route } from 'react-router-dom';

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
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registration" element={<RegistrationPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/ongleague" element={<OngLeaguePage />} />
      <Route path="/createnewleague" element={<CreateNewLeaguePage />} />
      <Route path="/joinnewleague" element={<JoinNewLeaguePage />} />
    </Routes>
  </BrowserRouter>
  );
}
