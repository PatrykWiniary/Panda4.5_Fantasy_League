import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import '../styles/HomePage.css';
import homeIcon from "../assets/home.svg";
import userIcon from "../assets/user.svg";

type Item = { id: number; name: string; qty: number };

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState('');
  const [fadeOut, setFadeOut] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";

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
  const handleNavigate = (path: string) => {
    setFadeOut(true);
    setTimeout(() => {
      navigate(path);
    }, 800); // czas animacji fade-out (dopasowany do CSS)
  };

 const handleLinkClick = (e: React.MouseEvent, to: string) => {
    // pozwól na otwieranie w nowej karcie / z modyfikatorem
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (e as any).button === 1) {
      return; // domyślne zachowanie Link (nowa karta)
    }
    e.preventDefault();
    setFadeOut(true);
    // czas musi pasować do CSS fade-out (np. 700ms)
    setTimeout(() => navigate(to), 700);
  };


  const hasOngoingLeague = true;

  return (
    <div className={`homepage ${fadeOut ? "fade-out" : "fade-in"}`}>
      <div className="page-icons">
        <div className="page-icon home-icon disabled-icon">
          <img src={homeIcon} alt="Home (disabled)" className="icon-image" />
        </div>
<Link
  to="/profile"
  className="page-icon user-icon"
  onClick={(e) => handleLinkClick(e, "/profile")}
>
  <img src={userIcon} alt="Profile" className="icon-image" />
</Link>
      </div>

      <h1 className="homepage-title">SUMMONER’S LEAGUE</h1>

      <div className="homepage-buttons">
    <Link
          to={hasOngoingLeague ? "/ongleague" : "#"}
          className={`homepage-button ${!hasOngoingLeague ? "disabled" : ""}`}
          onClick={(e) => hasOngoingLeague && handleLinkClick(e, "/ongleague")}
        >
          ONGOING LEAGUE
        </Link>
        <Link to="/joinnewleague" className="homepage-button">
          CREATE NEW LOBBY
        </Link>

        <Link to="/createnewleague" className="homepage-button">
          JOIN LOBBY
        </Link>

        <Link to="/login" className="homepage-button">
          SIGN OUT
        </Link>

      </div>
    </div>
  );
}