import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/LogReg.css";
import "../styles/OngoingLeague.css";
import homeIcon from "../assets/home.svg";
import userIcon from "../assets/user.svg";
import mapBackground from "../assets/rift.png";
import topIcon from "../assets/roleIcons/top.png";
import jungleIcon from "../assets/roleIcons/jungle.png";
import midIcon from "../assets/roleIcons/mid.png";
import adcIcon from "../assets/roleIcons/adc.png";
import supportIcon from "../assets/roleIcons/support.png";
import fallbackPortrait from "../assets/playerPics/Bin.webp";
import { apiFetch, ApiError } from "../api/client";
import type {
  DeckResponse,
  DeckRole,
  DeckCard,
  DeckSummary,
} from "../api/types";
import { useSession } from "../context/SessionContext";
import { resolvePlayerImage } from "../utils/playerImages";
import { resolveProfileAvatar } from "../utils/profileAvatars";

const roleIcons: Record<DeckRole, string> = {
  Top: topIcon,
  Jgl: jungleIcon,
  Mid: midIcon,
  Adc: adcIcon,
  Supp: supportIcon,
};

type ChampCard = {
  id: number;
  icon: string;
  portrait: string;
  name?: string;
  role: DeckRole;
  kdA?: string;
  pointsDelta?: number;
  isMvp?: boolean;
};

type OngLeagueProps = {
  popupEvent?: boolean;
  onPopupHandled?: () => void;
};

export default function OngLeaguePage({
  popupEvent,
  onPopupHandled,
}: OngLeagueProps) {
  const navigate = useNavigate();
  const { user } = useSession();
  const [deck, setDeck] = useState<Record<DeckRole, DeckCard | null>>({
    Top: null,
    Jgl: null,
    Mid: null,
    Adc: null,
    Supp: null,
  });
  const [summary, setSummary] = useState<DeckSummary | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!user) {
      setStatus("Sign in to view your current league roster.");
      return;
    }

    let canceled = false;
    setStatus("Loading deck...");
    apiFetch<DeckResponse>(`/api/decks/${user.id}`)
      .then((response) => {
        if (canceled) return;
        setDeck(response.deck.slots);
        setSummary(response.summary);
        setStatus(null);
      })
      .catch((error) => {
        if (canceled) return;
        if (error instanceof ApiError && error.status === 404) {
          setStatus("No deck saved yet.");
          setDeck({
            Top: null,
            Jgl: null,
            Mid: null,
            Adc: null,
            Supp: null,
          });
        } else {
          setStatus("Failed to load deck.");
        }
      });

    return () => {
      canceled = true;
    };
  }, [user]);

  useEffect(() => {
    if (popupEvent) {
      setShowPopup(true);
      const timer = setTimeout(() => {
        setShowPopup(false);
        onPopupHandled?.();
      }, 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [popupEvent, onPopupHandled]);

  const handleMainMenuClick = (event: React.MouseEvent) => {
    event.preventDefault();
    setFadeOut(true);
    setTimeout(() => navigate("/"), 600);
  };

  const simulateEvent = () => {
    setShowPopup(true);
    setTimeout(() => setShowPopup(false), 3000);
  };

  const playerAvatar = resolveProfileAvatar(user?.avatar);

  const champions = useMemo(() => {
    const entries: ChampCard[] = (Object.keys(deck) as DeckRole[]).map(
      (role, index) => {
        const card = deck[role];
        const resolvedPortrait =
          card?.name && resolvePlayerImage(card.name)
            ? resolvePlayerImage(card.name)
            : fallbackPortrait;
        const tournamentScore =
          typeof card?.tournamentPoints === "number"
            ? card.tournamentPoints
            : undefined;
        const basePoints =
          typeof card?.points === "number" ? card.points : undefined;

        return {
          id: index + 1,
          icon: roleIcons[role],
          portrait: resolvedPortrait,
          name: card?.name,
          role,
          kdA:
            tournamentScore !== undefined
              ? `Score ${tournamentScore.toFixed(1)}`
              : undefined,
          pointsDelta: tournamentScore ?? basePoints ?? 0,
        };
      }
    );

    const best = entries.reduce(
      (acc, champ) =>
        champ.pointsDelta !== undefined && champ.pointsDelta > acc.value
          ? { value: champ.pointsDelta, id: champ.id }
          : acc,
      { value: -Infinity, id: -1 }
    );
    if (best.id !== -1) {
      entries.forEach((champ) => {
        if (champ.id === best.id) {
          champ.isMvp = true;
        }
      });
    }

    return entries;
  }, [deck]);

  const playedGames = summary?.totalValue ?? 0;
  const totalGames = summary?.currencyCap ?? "?";

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
          Match just finished. New points added.
        </div>
      </div>

      <div className="page-icons">
        <Link to="/" className="page-icon home-icon">
          <img src={homeIcon} alt="Home" className="icon-image" />
        </Link>
        <Link to="/profile" className="page-icon user-icon">
          <img src={userIcon} alt="Profile" className="icon-image" />
        </Link>
      </div>

      <div className="league-title-bg">
        <h1 className="league-title gradient-text">
          {user ? `${user.name.toUpperCase()}'S LOBBY` : "JOIN A LEAGUE"}
        </h1>
        <div className="league-played-count gradient-text">
          {playedGames}/{totalGames}
        </div>
      </div>

      <div className="league-layout">
        <div className="league-left">
          <div className="league-avatar-wrapper">
            <img
              src={playerAvatar}
              alt={user ? `${user.name} avatar` : "Avatar"}
              className="league-avatar"
            />
          </div>
          <h2 className="league-player-name gradient-text">
            {user ? user.name : "Unassigned"}
          </h2>
          <div className="league-player-meta">
            <div className="league-player-rank gradient-text">
              {user
                ? `Ranking position: ${user.score ?? "?"}`
                : "Ranking position: -"}
            </div>
            <div className="league-player-points gradient-text">
              Deck value: {summary?.totalValue ?? 0}/
              {summary?.currencyCap ?? "?"}
            </div>
            {status && <p className="form-status">{status}</p>}
          </div>
        </div>

        <div className="league-right">
          <div className="league-champions">
            {champions.map((champ) => (
              <div
                key={champ.id}
                className={`league-champion-card ${
                  champ.name ? "" : "empty"
                }`}
              >
                <div
                  className={`portrait-wrapper ${champ.isMvp ? "mvp" : ""}`}
                >
                  <img
                    src={champ.portrait}
                    alt={champ.name ?? `Champion ${champ.id}`}
                    className="league-champion-portrait"
                  />
                  {champ.isMvp && (
                    <div className="mvp-label gradient-text">MVP</div>
                  )}
                  {(champ.kdA || champ.pointsDelta !== undefined) && (
                    <div className="champ-overlay">
                      {champ.kdA && <div className="kd">{champ.kdA}</div>}
                      {champ.pointsDelta !== undefined && (
                        <div className="delta">
                          {champ.pointsDelta >= 0 ? "+" : ""}
                          {champ.pointsDelta} pts
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="champ-name">{champ.name ?? "Empty Slot"}</div>
                <div className="league-role-container" aria-hidden>
                  <div className="role-icon-wrapper">
                    <img
                      src={champ.icon}
                      alt={`${champ.role} icon`}
                      className="league-role-icon"
                    />
                    <div className="role-tooltip">{`Position: ${champ.role}`}</div>
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
