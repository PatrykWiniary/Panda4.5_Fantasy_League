import React from "react";
import { Link } from "react-router-dom";
import "../styles/LogReg.css";
import homeIcon from "../assets/home.svg";
import userIcon from "../assets/user.svg";
import avatarIcon from "../assets/faker.svg";

// Portrety graczy (mogą być tymczasowo takie same)
import champPortrait from "../assets/faker.svg";

// Ikony ról z przezroczystym tłem (PNG)
import jungleIcon from "../assets/roleIcons/jungle.png";
import topIcon from "../assets/roleIcons/top.png";
import midIcon from "../assets/roleIcons/mid.png";
import adcIcon from "../assets/roleIcons/adc.png";
import supportIcon from "../assets/roleIcons/support.png";

export default function OngLeague() {
  const player = {
    name: "<PlayerName>",
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
    <div className="ongleague-page">
      {/* Ikony w prawym górnym rogu */}
      <div className="page-icons">
        <Link to="/" className="page-icon home-icon">
          <img src={homeIcon} alt="Home" className="icon-image" />
        </Link>
        <Link to="/profile" className="page-icon user-icon">
          <img src={userIcon} alt="Profile" className="icon-image" />
        </Link>
      </div>

      {/* Tytuł na środku u góry */}
      <h1 className="league-title">LOBBY NAME</h1>

      {/* Sekcja środkowa */}
      <div className="league-main">
        {/* Lewa sekcja – gracz */}
        <div className="league-left">
          <img src={player.avatar} alt="Avatar" className="league-avatar" />
          <h2 className="league-player-name">{player.name}</h2>
          <p className="league-player-stats">{player.points}</p>
        </div>

        {/* Prawa sekcja – drużyna */}
        <div className="league-team">
          {player.champions.map((champ) => (
            <div key={champ.id} className="league-slot">z
              <div className="league-portrait-wrapper">
                <img
                  src={champ.portrait}
                  alt={`Portrait ${champ.id}`}
                  className="league-portrait"
                />
              </div>
              <img
                src={champ.icon}
                alt={`Role ${champ.id}`}
                className="league-role-icon"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
