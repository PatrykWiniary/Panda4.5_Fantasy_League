import { useState } from "react";
import type { MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/LogReg.css";
import homeIcon from "../assets/home.svg";
import userIcon from "../assets/user.svg";
import { useSession } from "../context/SessionContext";

export default function HomePage() {
  const { user } = useSession();
  const [fadeOut, setFadeOut] = useState(false);
  const navigate = useNavigate();

  const handleLinkClick = (e: MouseEvent<HTMLAnchorElement>, to: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) {
      return;
    }
    e.preventDefault();
    setFadeOut(true);
    setTimeout(() => {
      navigate(to);
    }, 700);
  };

  const hasOngoingLeague = Boolean(user);

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
      <p className="homepage-subtitle">
        {user ? `Welcome back, ${user.name}!` : "Sign in to manage your roster."}
      </p>

      <div className="homepage-buttons">
        <Link
          to={hasOngoingLeague ? "/ongleague" : "#"}
          className={`homepage-button ${!hasOngoingLeague ? "disabled" : ""}`}
          onClick={(e) =>
            hasOngoingLeague && handleLinkClick(e, "/ongleague")
          }
        >
          ONGOING LEAGUE
        </Link>
        <Link to="/joinnewleague" className="homepage-button">
          JOIN NEW LEAGUE
        </Link>

        <Link to="/createnewleague" className="homepage-button">
          CREATE NEW LEAGUE
        </Link>

        <Link
          to="/leaderboard"
          className="homepage-button"
          onClick={(e) => handleLinkClick(e, "/leaderboard")}
        >
          LEADERBOARD
        </Link>
      </div>
    </div>
  );
}
