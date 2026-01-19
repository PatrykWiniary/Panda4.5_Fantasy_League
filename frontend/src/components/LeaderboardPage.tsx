import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/LogReg.css";
import homeIcon from "../assets/home.svg";
import userIcon from "../assets/user.svg";
import { apiFetch, ApiError } from "../api/client";
import type {
  LeaderboardResponse,
  LeaderboardEntry,
  LobbyLeaderboardResponse,
  TournamentControlState,
  LobbyByUserResponse,
} from "../api/types";
import { useSession } from "../context/SessionContext";

export default function LeaderboardPage() {
  const { user } = useSession();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [tournamentState, setTournamentState] =
    useState<TournamentControlState | null>(null);
  const [lobbyId, setLobbyId] = useState<number | null>(null);
  const [lobbyName, setLobbyName] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"lobby" | "world">("lobby");

  useEffect(() => {
    if (!user) {
      setLobbyId(null);
      setLobbyName(null);
      return;
    }
    let canceled = false;
    apiFetch<LobbyByUserResponse>(`/api/lobbies?userId=${user.id}`)
      .then((payload) => {
        if (!canceled) {
          setLobbyId(payload.lobby?.lobby.id ?? null);
          setLobbyName(payload.lobby?.lobby.name ?? null);
        }
      })
      .catch(() => {
        if (!canceled) {
          setLobbyId(null);
          setLobbyName(null);
        }
      });
    return () => {
      canceled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    let canceled = false;
    const load = async () => {
      try {
        if (viewMode === "lobby") {
          if (!lobbyId) {
            setData(null);
            setStatus("Join a lobby to view its leaderboard.");
            return;
          }
          setStatus("Loading lobby leaderboard...");
          const payload = await apiFetch<LobbyLeaderboardResponse>(
            `/api/lobbies/${lobbyId}/leaderboard`
          );
          const leaderboard = payload.leaderboard;
          const userEntry = user
            ? leaderboard.find((entry) => entry.id === user.id) ?? null
            : null;
          setData({
            top: leaderboard,
            totalUsers: leaderboard.length,
            userEntry,
            userInTop: userEntry ? leaderboard.some((entry) => entry.id === userEntry.id) : false,
          });
          setStatus(null);
          return;
        }

        setStatus("Loading world leaderboard...");
        const query = user ? `?userId=${user.id}&mode=global` : "?mode=global";
        const payload = await apiFetch<LeaderboardResponse>(`/api/users/leaderboard${query}`);
        setData(payload);
        setStatus(null);
      } catch (error) {
        if (canceled) return;
        if (error instanceof ApiError) {
          const body = error.body as { message?: string; error?: string };
          setStatus(body?.message ?? "Failed to load leaderboard.");
        } else {
          setStatus("Failed to load leaderboard.");
        }
      }
    };
    load();
    const timer = window.setInterval(load, 5000);
    const handleFocus = () => load();
    const handleVisibility = () => {
      if (!document.hidden) {
        load();
      }
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      canceled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [user?.id, lobbyId, viewMode]);

  useEffect(() => {
    apiFetch<TournamentControlState>(`/api/regions/1/tournament`)
      .then((payload) => {
        setTournamentState(payload);
      })
      .catch(() => {
        setTournamentState(null);
      });
  }, []);

  const highlightId = user?.id ?? data?.userEntry?.id;

  const renderRow = (entry: LeaderboardEntry) => {
    const highlighted = highlightId && entry.id === highlightId;
    return (
      <tr
        key={entry.id}
        className={highlighted ? "leaderboard-row highlighted" : undefined}
      >
        <td>{entry.position}</td>
        <td>{entry.name}</td>
        <td>{entry.score}</td>
        <td>{entry.currency}</td>
        <td>{entry.passiveGold}</td>
        <td>{entry.currency + entry.passiveGold}</td>
      </tr>
    );
  };

  return (
    <div className="login-container leaderboard-page">
      <div className="page-icons">
        <Link to="/" className="page-icon home-icon">
          <img src={homeIcon} alt="Home" className="icon-image" />
        </Link>
        <Link to="/profile" className="page-icon user-icon">
          <img src={userIcon} alt="Profile" className="icon-image" />
        </Link>
      </div>

      <div className="leaderboard-card">
        <h1 className="login-title login-title--main">Leaderboard</h1>
        <p className="leaderboard-subtitle">
          {viewMode === "lobby"
            ? lobbyId
              ? `Lobby: ${lobbyName ?? "Your lobby"} (${data?.totalUsers ?? 0} players)`
              : "Lobby ranking (join a lobby to see standings)"
            : `World (current tournament) (${data?.totalUsers ?? 0} players)`}
        </p>

        {status && <p className="form-status">{status}</p>}
        {viewMode === "lobby" && !lobbyId && (
          <Link to="/joinnewleague" className="leaderboard-cta">
            Join Lobby
          </Link>
        )}
        <div className="leaderboard-tabs">
          <button
            type="button"
            className={viewMode === "lobby" ? "active" : ""}
            onClick={() => setViewMode("lobby")}
          >
            Lobby
          </button>
          <button
            type="button"
            className={viewMode === "world" ? "active" : ""}
            onClick={() => setViewMode("world")}
          >
            World
          </button>
        </div>

        {data && (
          <>
            <div className="leaderboard-table-wrapper">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Score</th>
                    <th>Gold</th>
                    <th>Passive</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top.length > 0 ? (
                    data.top.map(renderRow)
                  ) : (
                    <tr>
                      <td colSpan={6}>No players yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {data.userEntry && !data.userInTop && (
              <div className="leaderboard-user-card">
                <p>Your position</p>
                <div className="leaderboard-user-stats">
                  <span>#{data.userEntry.position}</span>
                  <span>{data.userEntry.name}</span>
                  <span>{data.userEntry.score} pts</span>
                  <span>{data.userEntry.currency} gold</span>
                  <span>{data.userEntry.passiveGold} passive</span>
                  <span>{data.userEntry.currency + data.userEntry.passiveGold} total</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {tournamentState?.tournament && (
        <div className="leaderboard-card tournament-summary">
          <h2>Regional Tournament</h2>
          <p>
            <strong>{tournamentState.tournament.name}</strong> • Stage:{" "}
            {tournamentState.tournament.stage}
          </p>
          {tournamentState.tournament.nextMatch ? (
            <p>
              Next series:{" "}
              {tournamentState.tournament.nextMatch.teamA?.name ?? "TBD"} vs{" "}
              {tournamentState.tournament.nextMatch.teamB?.name ?? "TBD"}
            </p>
          ) : (
            <p>No upcoming series.</p>
          )}
        </div>
      )}
    </div>
  );
}
