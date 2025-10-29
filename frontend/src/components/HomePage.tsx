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


 const hasOngoingLeague = false;  // trwająca liga (false - nie ma ligi, true - jest liga)

   return (
    <div className="homepage">
      <div className="page-icons">
        <Link to="/" className="page-icon home-icon">
          <img src={homeIcon} alt="Home" className="icon-image" />
        </Link>
        <Link to="/profile" className="page-icon user-icon">
          <img src={userIcon} alt="Profile" className="icon-image" />
        </Link>
      </div>


      <h1 className="homepage-title">SUMMONER’S LEAGUE</h1>


      <div className="homepage-buttons">
        <Link
          to={hasOngoingLeague ? "/ongoing" : "#"}
          className={`homepage-button ${!hasOngoingLeague ? "disabled" : ""}`}
        >
          ONGOING LEAGUE
        </Link>

        <Link to="/join" className="homepage-button">
          JOIN NEW LEAGUE
        </Link>

        <Link to="/create" className="homepage-button">
          CREATE NEW LEAGUE
        </Link>
      </div>

    </div>
  );
}