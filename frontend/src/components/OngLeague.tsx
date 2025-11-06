import React from "react";
import { Link } from "react-router-dom";
import "../styles/LogReg.css";

// Ikony w prawym górnym rogu
import homeIcon from "../assets/home.svg";
import userIcon from "../assets/user.svg";

// Avatar gracza
import avatarIcon from "../assets/playerPics/Bin.webp";

// Portrety championów (tymczasowo takie same)
import champPortrait from "../assets/playerPics/Bin.webp";

// Ikony ról
import topIcon from "../assets/roleIcons/top.png";
import jungleIcon from "../assets/roleIcons/jungle.png";
import midIcon from "../assets/roleIcons/mid.png";
import adcIcon from "../assets/roleIcons/adc.png";
import supportIcon from "../assets/roleIcons/support.png";

// Tło mapy (upewnij się, że masz ten plik)
import mapBackground from "../assets/rift.png";

export default function OngLeague() {
  const player = {
    name: "<PlayerName>",
    rank: 4,
    points: 9898,
    avatar: avatarIcon,
    champions: [
      { id: 1, icon: topIcon, portrait: champPortrait },
      { id: 2, icon: jungleIcon, portrait: champPortrait },
      { id: 3, icon: midIcon, portrait: champPortrait },
      { id: 4, icon: adcIcon, portrait: champPortrait },
      { id: 5, icon: supportIcon, portrait: champPortrait },
    ],
  };

  return (
<div
  className="ongleague-page fade-in"
  style={{
    backgroundImage: `url(${mapBackground})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  }}
>
      {/* Ikony w prawym górnym rogu */}
      <div className="page-icons">
        <Link to="/" className="page-icon home-icon">
          <img src={homeIcon} alt="Home" className="icon-image" />
        </Link>
<Link
  to="/profile"
  className="page-icon user-icon"
  onClick={(e) => handleLinkClick(e, "/profile")}
>
  <img src={userIcon} alt="Profile" className="icon-image" />
</Link>
      </div>

      {/* Nagłówek z ciemnym tłem */}
      <div className="league-title-bg">
        <h1 className="league-title">&lt;LOBBY NAME&gt;</h1>
      </div>

      {/* Główna sekcja */}
      <div className="league-layout">
        {/* Lewa sekcja – gracz */}
        <div className="league-left">
          <img src={player.avatar} alt="Avatar" className="league-avatar" />
          <h2 className="league-player-name">{player.name}</h2>
          <p className="league-player-rank">{player.rank}</p>
          <p className="league-player-points">{player.points}</p>
        </div>

        {/* Prawa sekcja – drużyna */}
        <div className="league-right">
          <div className="league-champions">
            {player.champions.map((champ) => (
              <div key={champ.id} className="league-champion-card">
                <img
                  src={champ.portrait}
                  alt={`Champion ${champ.id}`}
                  className="league-champion-portrait"
                />
                <div className="league-role-container">
                  <img
                    src={champ.icon}
                    alt={`Role ${champ.id}`}
                    className="league-role-icon"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
