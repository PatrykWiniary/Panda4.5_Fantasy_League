import { FormEvent, useEffect, useState } from 'react';

type Item = { id: number; name: string; qty: number };
type User = { id: number; name: string; mail: string; currency: number };

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState('');

  const [users, setUsers] = useState<User[]>([]);
  const [registerName, setRegisterName] = useState('');
  const [registerMail, setRegisterMail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerCurrency, setRegisterCurrency] = useState('0');
  const [registerStatus, setRegisterStatus] = useState<string | null>(null);

  const [loginMail, setLoginMail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginStatus, setLoginStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/items')
      .then(r => r.json())
      .then(setItems)
      .catch(console.error);

    fetch('/api/users')
      .then(r => r.json())
      .then(setUsers)
      .catch(console.error);
  }, []);

  const add = async () => {
    if (!name) return;
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, qty: 1 })
    });
    if (!res.ok) {
      return;
    }
    const newItem = await res.json();
    setItems(s => [...s, newItem]);
    setName('');
  };

  const refreshUsers = async () => {
    const res = await fetch('/api/users');
    if (!res.ok) {
      throw new Error('Failed to load users');
    }
    const list = await res.json();
    setUsers(list);
  };

  const register = async (event: FormEvent) => {
    event.preventDefault();
    setRegisterStatus(null);
    if (!registerName || !registerMail || !registerPassword) {
      setRegisterStatus('Fill in all fields.');
      return;
    }

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: registerName,
        mail: registerMail,
        password: registerPassword,
        currency: Number(registerCurrency) || 0
      })
    });

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'REGISTER_FAILED' }));
      setRegisterStatus(`Registration failed: ${error}`);
      return;
    }

    const user = await res.json();
    setRegisterStatus(`Registered user ${user.name}.`);
    setRegisterName('');
    setRegisterMail('');
    setRegisterPassword('');
    setRegisterCurrency('0');
    await refreshUsers();
  };

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setLoginStatus(null);
    if (!loginMail || !loginPassword) {
      setLoginStatus('Enter email and password.');
      return;
    }

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mail: loginMail,
        password: loginPassword
      })
    });

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'LOGIN_FAILED' }));
      setLoginStatus(`Login failed: ${error}`);
      return;
    }

    const user = await res.json();
    setLoginStatus(`Logged in as ${user.name}.`);
    setLoginMail('');
    setLoginPassword('');
  };

  return (
    <div style={{ padding: 20, display: 'grid', gap: 24 }}>
      <section>
        <h1>Items</h1>
        <ul>
          {items.map(i => (
            <li key={i.id}>
              {i.name} ({i.qty})
            </li>
          ))}
        </ul>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="New item" />
        <button onClick={add} style={{ marginLeft: 8 }}>Add</button>
      </section>

      <section>
        <h2>Register</h2>
        <form onSubmit={register} style={{ display: 'grid', gap: 8, maxWidth: 320 }}>
          <input value={registerName} onChange={e => setRegisterName(e.target.value)} placeholder="Name" />
          <input value={registerMail} onChange={e => setRegisterMail(e.target.value)} placeholder="Email" />
          <input value={registerPassword} onChange={e => setRegisterPassword(e.target.value)} placeholder="Password" type="password" />
          <input
            value={registerCurrency}
            onChange={e => setRegisterCurrency(e.target.value)}
            placeholder="Currency"
            type="number"
            min="0"
          />
          <button type="submit">Register</button>
        </form>
        {registerStatus && <p>{registerStatus}</p>}
      </section>

      <section>
        <h2>Login</h2>
        <form onSubmit={login} style={{ display: 'grid', gap: 8, maxWidth: 320 }}>
          <input value={loginMail} onChange={e => setLoginMail(e.target.value)} placeholder="Email" />
          <input value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Password" type="password" />
          <button type="submit">Login</button>
        </form>
        {loginStatus && <p>{loginStatus}</p>}
      </section>

      <section>
        <h2>Users</h2>
        <button onClick={refreshUsers} style={{ marginBottom: 12 }}>Refresh</button>
        <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 600 }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>ID</th>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Name</th>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Email</th>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '4px 8px' }}>Currency</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{user.id}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{user.name}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{user.mail}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '4px 8px' }}>{user.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
