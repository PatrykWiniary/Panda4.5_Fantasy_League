import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/OngoingLeague.css";

// Avatar gracza
import avatarIcon from "../assets/man.jpg";
// Portrety championów
import champPortrait from "../assets/playerPics/Bin.webp";
// Ikony ról
import topIcon from "../assets/roleIcons/top.png";
import jungleIcon from "../assets/roleIcons/jungle.png";
import midIcon from "../assets/roleIcons/mid.png";
import adcIcon from "../assets/roleIcons/adc.png";
import supportIcon from "../assets/roleIcons/support.png";
// Tło mapy
import mapBackground from "../assets/rift.png";

type Champ = {
  id: number;
  name?: string;
  icon: string;
  portrait: string;
  isMvp?: boolean;
  kdA?: string;
  pointsDelta?: number;
  position?: string;
};

type OngLeagueProps = {
  popupEvent?: boolean;
  onPopupHandled?: () => void;
};

export default function OngLeague({ popupEvent, onPopupHandled }: OngLeagueProps) {
  const navigate = useNavigate();
  const [showPopup, setShowPopup] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  const player = {
    name: "Faker2",
    rankPosition: 4,
    points: 998728,
    avatar: avatarIcon,
    champions: [
      { id: 1, icon: topIcon, portrait: champPortrait, name: "Champ1", kdA: "3/1/5", pointsDelta: 10, isMvp: false, position: "Top lane" },
      { id: 2, icon: jungleIcon, portrait: champPortrait, name: "Champ2", kdA: "4/2/6", pointsDelta: 15, isMvp: false, position: "Jungle" },
      { id: 3, icon: midIcon, portrait: champPortrait, name: "Champ3", kdA: "8/2/12", pointsDelta: 20, isMvp: false, position: "Mid lane" },
      { id: 4, icon: adcIcon, portrait: champPortrait, name: "Champ4", kdA: "5/3/7", pointsDelta: 18, isMvp: false, position: "ADC" },
      { id: 5, icon: supportIcon, portrait: champPortrait, name: "Champ5", kdA: "2/4/15", pointsDelta: 12, isMvp: true, position: "Support" },
    ] as Champ[],
  };

  useEffect(() => {
    if (popupEvent) {
      setShowPopup(true);
      const t = setTimeout(() => {
        setShowPopup(false);
        onPopupHandled?.();
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [popupEvent, onPopupHandled]);

  const simulateEvent = () => {
    setShowPopup(true);
    setTimeout(() => {
      setShowPopup(false);
      onPopupHandled?.();
    }, 4000);
  };

  const handleMainMenuClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setFadeOut(true);
    setTimeout(() => navigate("/"), 700); // dopasowane do animacji fade-out
  };

  const played = 2;
  const total = 56;

  return (
    <div className={`ongleague-page ${fadeOut ? "fade-out" : "fade-in"}`}
         style={{ backgroundImage: `url(${mapBackground})`, backgroundSize: "cover", backgroundPosition: "center" }}>
      {/* Popup */}
      <div className={`match-popup ${showPopup ? "visible" : ""}`} role="status">
        <div className="match-popup-inner">
          Match just finished. New points added
        </div>
      </div>

      {/* Nagłówek */}
      <div className="league-title-bg">
        <h1 className="league-title gradient-text">&lt;LOBBY NAME&gt;</h1>
        <div className="league-played-count gradient-text">{played}/{total}</div>
      </div>

      {/* Layout */}
      <div className="league-layout">
        {/* Gracz */}
        <div className="league-left">
          <div className="league-avatar-wrapper">
            <img src={player.avatar} alt="Avatar" className="league-avatar" />
          </div>
          <h2 className="league-player-name gradient-text">{player.name}</h2>
          <div className="league-player-meta">
            <div className="league-player-rank gradient-text">RANKING POSITION: {player.rankPosition}</div>
            <div className="league-player-points gradient-text">POINTS: {player.points.toLocaleString()}</div>
          </div>
        </div>

        {/* Champions */}
        <div className="league-right">
          <div className="league-champions">
            {player.champions.map((champ) => (
              <div key={champ.id} className="league-champion-card" aria-label={`Champion card ${champ.id}`}>
                <div className={`portrait-wrapper ${champ.isMvp ? "mvp" : ""}`}>
                  <img src={champ.portrait} alt={`Champion ${champ.id}`} className="league-champion-portrait" />

                  {/* MVP label */}
                  {champ.isMvp && (
                    <div className="mvp-label gradient-text">MVP</div>
                  )}

                  {/* Overlay statystyk */}
                  <div className="champ-overlay">
                    {champ.kdA && <div className="kd">{`K/D/A ${champ.kdA}`}</div>}
                    {champ.pointsDelta !== undefined && <div className="delta">{`+${champ.pointsDelta} POINTS`}</div>}
                  </div>
                </div>

                <div className="champ-name">{champ.name ?? "Player"}</div>

                <div className="league-role-container" aria-hidden>
                  <div className="role-icon-wrapper">
                    <img src={champ.icon} alt="role" className="league-role-icon" />
                    <div className="role-tooltip">{`Position: ${champ.position}`}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Main Menu */}
          <div className="main-menu-row-bottom">
            <Link to="/" className="main-menu-button-dark" onClick={handleMainMenuClick}>
              MAIN MENU
            </Link>
          </div>
        </div>
      </div>

      {/* Demo button */}
      <div style={{ position: "fixed", left: 12, bottom: 12, zIndex: 2000 }}>
        <button className="debug-btn" onClick={simulateEvent}>Simulate match event</button>
      </div>
    </div>
  );
}
