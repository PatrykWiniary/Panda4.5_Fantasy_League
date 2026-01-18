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
  LeaderboardResponse,
  LeaderboardEntry,
  TournamentPlayerStatsResponse,
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
  const [latestStats, setLatestStats] = useState<{
    byName: Map<string, { kdA?: string; score?: number; isMvp?: boolean }>;
    byId: Map<number, { kdA?: string; score?: number; isMvp?: boolean }>;
  }>({
    byName: new Map(),
    byId: new Map(),
  });
  const [latestProgress, setLatestProgress] = useState<{
    played: number;
    total: number;
  } | null>(null);
  const [latestLobby, setLatestLobby] = useState<string | null>(null);
  const [userStanding, setUserStanding] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    if (!user) {
      setStatus("Sign in to view your current league roster.");
      setLatestStats({ byName: new Map(), byId: new Map() });
      setUserStanding(null);
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
    if (!user) {
      setUserStanding(null);
      return;
    }

    let canceled = false;
    apiFetch<LeaderboardResponse>(`/api/users/leaderboard?userId=${user.id}`)
      .then((payload) => {
        if (canceled) return;
        const match =
          payload.userEntry ??
          payload.top.find((entry) => entry.id === user.id) ??
          null;
        setUserStanding(match ?? null);
      })
      .catch(() => {
        if (!canceled) {
          setUserStanding(null);
        }
      });

    return () => {
      canceled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    let canceled = false;
    const playerIds = Object.values(deck)
      .map((card) => card?.playerId)
      .filter((id): id is number => typeof id === "number" && id > 0);
    if (playerIds.length === 0) {
      setLatestStats({ byName: new Map(), byId: new Map() });
      setLatestProgress(null);
      setLatestLobby(null);
      return;
    }

    apiFetch<TournamentPlayerStatsResponse>(
      `/api/regions/1/tournament/player-stats?ids=${playerIds.join(",")}`
    )
      .then((payload) => {
        if (canceled) return;
        const byId = new Map<
          number,
          { kdA?: string; score?: number; isMvp?: boolean }
        >();
        payload.players.forEach((player) => {
          byId.set(player.playerId, {
            kdA: `${player.kills}/${player.deaths}/${player.assists}`,
            score: Math.round(player.score),
            isMvp: false,
          });
        });
        setLatestStats({ byName: new Map(), byId });
        setLatestProgress(null);
        setLatestLobby(null);
      })
      .catch(() => {
        if (!canceled) {
          setLatestStats({ byName: new Map(), byId: new Map() });
          setLatestProgress(null);
          setLatestLobby(null);
        }
      });

    return () => {
      canceled = true;
    };
  }, [deck]);

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
        const normalizedName = card?.name?.trim().toLowerCase();
        const latest =
          (card?.playerId !== undefined &&
            latestStats.byId.get(card.playerId)) ||
          (normalizedName ? latestStats.byName.get(normalizedName) : undefined);
        return {
          id: index + 1,
          icon: roleIcons[role],
          portrait: resolvedPortrait,
          name: card?.name,
          role,
          kdA: latest?.kdA,
          pointsDelta: latest?.score ?? tournamentScore ?? basePoints ?? 0,
          isMvp: latest?.isMvp,
        };
      }
    );

    if (!entries.some((champ) => champ.isMvp)) {
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
    }

    return entries;
  }, [deck, latestStats]);

  const leaguePoints = userStanding?.score ?? user?.score ?? 0;
  const rankingPosition = userStanding?.position ?? null;
  const spentPoints = summary?.totalValue ?? 0;
  const maxPoints = summary?.currencyCap ?? "?";
  const formatPoints = (value: number | string) =>
    typeof value === "number" ? value.toLocaleString() : value;

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

      <div className="league-title-bg">
        <h1 className="league-title gradient-text">
          {user ? `${user.name.toUpperCase()}'S LOBBY` : "JOIN A LEAGUE"}
        </h1>
        <div className="league-played-count gradient-text">
          {formatPoints(spentPoints)}/{formatPoints(maxPoints)}
        </div>
      </div>

      <div className="league-layout">
        <div className="league-left">
          <div className="league-avatar-wrapper">
            <Link to="/profile">
            <img
              src={playerAvatar}
              alt={user ? `${user.name} avatar` : "Avatar"}
              className="league-avatar"
            />
            </Link>
          </div>
          <h2 className="league-player-name gradient-text"> 
            {user ? user.name : "Unassigned"}
          </h2>
          <div className="league-player-meta">
            <div className="league-player-rank">
              {user
                ? `Ranking position: ${rankingPosition ?? "?"}`
                : "Ranking position: -"}
            </div>
            <div className="league-player-points">
              Points: {formatPoints(leaguePoints)}
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
                      {champ.kdA && (
                        <>
                          <div className="kd-label">K/D/A</div>
                          <div className="kd-value">{champ.kdA}</div>
                        </>
                      )}
                      {champ.pointsDelta !== undefined && (
                        <div className="delta">
                          {champ.pointsDelta >= 0 ? "+" : ""}
                          {champ.pointsDelta} POINTS
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

    </div>
  );
}
