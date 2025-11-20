import { useEffect, useState, MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/OngoingLeague.css";
import avatarIcon from "../assets/man.jpg";
import champPortrait from "../assets/playerPics/Bin.webp";
import topIcon from "../assets/roleIcons/top.png";
import jungleIcon from "../assets/roleIcons/jungle.png";
import midIcon from "../assets/roleIcons/mid.png";
import adcIcon from "../assets/roleIcons/adc.png";
import supportIcon from "../assets/roleIcons/support.png";
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

export default function OngLeague({
  popupEvent,
  onPopupHandled,
}: OngLeagueProps) {
  const navigate = useNavigate();
  const [showPopup, setShowPopup] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!popupEvent) {
      return;
    }
    setShowPopup(true);
    const timer = setTimeout(() => {
      setShowPopup(false);
      onPopupHandled?.();
    }, 4000);
    return () => clearTimeout(timer);
  }, [popupEvent, onPopupHandled]);

  const simulateEvent = () => {
    setShowPopup(true);
    setTimeout(() => {
      setShowPopup(false);
      onPopupHandled?.();
    }, 4000);
  };

  const handleMainMenuClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setFadeOut(true);
    setTimeout(() => navigate("/"), 700);
  };

  const played = 2;
  const total = 56;

  return (
    <div
      className={`ongleague-page ${fadeOut ? "fade-out" : "fade-in"}`}
      style={{
        backgroundImage: `url(${mapBackground})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className={`match-popup ${showPopup ? "visible" : ""}`} role="status">
        <div className="match-popup-inner">
          Match just finished. New points added
        </div>
      </div>

      <div className="league-title-bg">
        <h1 className="league-title gradient-text">&lt;LOBBY NAME&gt;</h1>
        <div className="league-played-count gradient-text">
          {played}/{total}
        </div>
      </div>

      <div className="league-layout">
        <div className="league-left">
          <div className="league-avatar-wrapper">
            <img src={player.avatar} alt="Avatar" className="league-avatar" />
          </div>
          <h2 className="league-player-name gradient-text">{player.name}</h2>
          <div className="league-player-meta">
            <div className="league-player-rank gradient-text">
              RANKING POSITION: {player.rankPosition}
            </div>
            <div className="league-player-points gradient-text">
              POINTS: {player.points.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="league-right">
          <div className="league-champions">
            {player.champions.map((champ) => (
              <div
                key={champ.id}
                className="league-champion-card"
                aria-label={`Champion card ${champ.id}`}
              >
                <div className={`portrait-wrapper ${champ.isMvp ? "mvp" : ""}`}>
                  <img
                    src={champ.portrait}
                    alt={`Champion ${champ.id}`}
                    className="league-champion-portrait"
                  />
                  {champ.isMvp && (
                    <div className="mvp-label gradient-text">MVP</div>
                  )}
                  <div className="champ-overlay">
                    {champ.kdA && <div className="kd">{`K/D/A ${champ.kdA}`}</div>}
                    {champ.pointsDelta !== undefined && (
                      <div className="delta">{`+${champ.pointsDelta} POINTS`}</div>
                    )}
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

          <div className="main-menu-row-bottom">
            <Link
              to="/"
              className="main-menu-button-dark"
              onClick={handleMainMenuClick}
            >
              MAIN MENU
            </Link>
          </div>
        </div>
      </div>

      <div style={{ position: "fixed", left: 12, bottom: 12, zIndex: 2000 }}>
        <button className="debug-btn" onClick={simulateEvent}>
          Simulate match event
        </button>
      </div>
    </div>
  );
}
