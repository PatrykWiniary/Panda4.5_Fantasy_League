import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "../styles/LogReg.css";
import homeIcon from "../assets/home.svg";
import userIcon from "../assets/user.svg";
import { apiFetch, ApiError } from "../api/client";
import type {
  LeaderboardResponse,
  LeaderboardEntry,
  LobbyLeaderboardResponse,
  TournamentControlState,
} from "../api/types";
import { useSession } from "../context/SessionContext";

export default function LeaderboardPage() {
  const location = useLocation();
  const { user } = useSession();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [tournamentState, setTournamentState] =
    useState<TournamentControlState | null>(null);
  const lobbyId = (() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get("lobbyId");
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  })();

  useEffect(() => {
    let canceled = false;
    setStatus(lobbyId ? "Loading lobby leaderboard..." : "Loading leaderboard...");
    const query = user ? `?userId=${user.id}` : "";
    const request = lobbyId
      ? apiFetch<LobbyLeaderboardResponse>(`/api/lobbies/${lobbyId}/leaderboard`)
      : apiFetch<LeaderboardResponse>(`/api/users/leaderboard${query}`);
    request
      .then((payload) => {
        if (canceled) return;
        if (lobbyId) {
          const leaderboard = (payload as LobbyLeaderboardResponse).leaderboard;
          const userEntry = user
            ? leaderboard.find((entry) => entry.id === user.id) ?? null
            : null;
          setData({
            top: leaderboard,
            totalUsers: leaderboard.length,
            userEntry,
            userInTop: userEntry ? leaderboard.some((entry) => entry.id === userEntry.id) : false,
          });
        } else {
          setData(payload as LeaderboardResponse);
        }
        setStatus(null);
      })
      .catch((error) => {
        if (canceled) return;
        if (error instanceof ApiError) {
          const body = error.body as { message?: string; error?: string };
          setStatus(body?.message ?? "Failed to load leaderboard.");
        } else {
          setStatus("Failed to load leaderboard.");
        }
      });
    return () => {
      canceled = true;
    };
  }, [user?.id, lobbyId]);

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
          {lobbyId
            ? `Lobby ranking (${data?.totalUsers ?? 0} players)`
            : `Top managers by score (${data?.totalUsers ?? 0} players tracked)`}
        </p>

        {status && <p className="form-status">{status}</p>}

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
                  </tr>
                </thead>
                <tbody>
                  {data.top.length > 0 ? (
                    data.top.map(renderRow)
                  ) : (
                    <tr>
                      <td colSpan={4}>No players yet.</td>
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
