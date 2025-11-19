import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/LogReg.css";
import homeIcon from "../assets/home.svg";
import userIcon from "../assets/user.svg";
import mapBackground from "../assets/rift.png";
import topIcon from "../assets/roleIcons/top.png";
import jungleIcon from "../assets/roleIcons/jungle.png";
import midIcon from "../assets/roleIcons/mid.png";
import adcIcon from "../assets/roleIcons/adc.png";
import supportIcon from "../assets/roleIcons/support.png";
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

export default function OngLeaguePage() {
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

  const champions = (Object.keys(deck) as DeckRole[]).map((role) => {
    const card = deck[role];
    return {
      role,
      card,
      icon: roleIcons[role],
      image: resolvePlayerImage(card?.name),
    };
  });
  const playerAvatar = resolveProfileAvatar(user?.avatar);

  return (
    <div
      className="ongleague-page fade-in"
      style={{
        backgroundImage: `url(${mapBackground})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="page-icons">
        <Link to="/" className="page-icon home-icon">
          <img src={homeIcon} alt="Home" className="icon-image" />
        </Link>
        <Link to="/profile" className="page-icon user-icon">
          <img src={userIcon} alt="Profile" className="icon-image" />
        </Link>
      </div>

      <div className="league-title-bg">
        <h1 className="league-title">
          {user ? `${user.name.toUpperCase()}'S ROSTER` : "JOIN A LEAGUE"}
        </h1>
      </div>

      <div className="league-layout">
        <div className="league-left">
          <img
            src={playerAvatar}
            alt={user ? `${user.name} avatar` : "Avatar"}
            className="league-player-avatar"
          />
          <h2 className="league-player-name">
            {user ? user.name : "Unassigned"}
          </h2>
          <p className="league-player-points">
            {summary
              ? `Deck value: ${summary.totalValue}/${summary.currencyCap ?? "?"}`
              : "No deck saved"}
          </p>
          {status && <p className="form-status">{status}</p>}
        </div>

        <div className="league-right">
          <div className="league-champions">
            {champions.map(({ role, card, icon, image }) => (
              <div
                key={role}
                className={`league-champion-card ${card ? "" : "empty"}`}
              >
                <img
                  src={image}
                  alt={card?.name ?? `${role} slot`}
                  className="league-champion-portrait"
                />
                <div className="league-champion-info">
                  {card ? (
                    <>
                      <span className="league-champion-name">{card.name}</span>
                      <span className="league-champion-meta">
                        {card.points ?? 0} pts / {card.value ?? 0} gold
                      </span>
                    </>
                  ) : (
                    <span className="league-champion-empty-label">
                      Empty slot
                    </span>
                  )}
                </div>
                <div className="league-role-container">
                  <img src={icon} alt={`${role} icon`} className="league-role-icon" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
