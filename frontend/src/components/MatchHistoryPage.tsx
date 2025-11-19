import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/LogReg.css";
import homeIcon from "../assets/home.svg";
import userIcon from "../assets/user.svg";
import { apiFetch, ApiError } from "../api/client";
import type {
  MatchHistoryEntry,
  MatchHistoryResponse,
  MatchHistoryDetailResponse,
  MatchPlayerHistoryEntry,
} from "../api/types";

export default function MatchHistoryPage() {
  const [matches, setMatches] = useState<MatchHistoryEntry[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const pageSize = 15;
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedMatchId, setExpandedMatchId] = useState<number | null>(null);
  const [matchDetails, setMatchDetails] = useState<
    Record<number, MatchPlayerHistoryEntry[]>
  >({});
  const [loadingDetailId, setLoadingDetailId] = useState<number | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const loadMatches = (targetPage = page) => {
    setLoading(true);
    setStatus("Loading matches...");
    apiFetch<MatchHistoryResponse>(
      `/api/matches/history?limit=${pageSize}&page=${targetPage}`
    )
      .then((payload) => {
        setMatches(payload.matches);
        setTotal(payload.total ?? payload.matches.length);
        setPage(targetPage);
        setExpandedMatchId(null);
        setMatchDetails({});
        setStatus(null);
      })
      .catch((error) => {
        if (error instanceof ApiError) {
          const body = error.body as { message?: string; error?: string };
          setStatus(body?.message ?? "Failed to load matches.");
        } else {
          setStatus("Failed to load matches.");
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadMatches(1);
  }, []);

  const handleSimulate = async () => {
    setSimulating(true);
    setStatus("Simulating match...");
    try {
      await apiFetch("/api/matches/simulate", {
        method: "POST",
        body: JSON.stringify({}),
      });
      loadMatches(1);
    } catch (error) {
      if (error instanceof ApiError) {
        const body = error.body as { message?: string; error?: string };
        setStatus(body?.message ?? "Match simulation failed.");
      } else {
        setStatus("Match simulation failed.");
      }
    } finally {
      setSimulating(false);
    }
  };

  const handleClearHistory = async () => {
    setClearing(true);
    setStatus("Clearing match history...");
    try {
      await apiFetch("/api/matches/history", { method: "DELETE" });
      setMatches([]);
      setTotal(0);
      setExpandedMatchId(null);
      setMatchDetails({});
      setStatus("History cleared.");
    } catch (error) {
      if (error instanceof ApiError) {
        const body = error.body as { message?: string; error?: string };
        setStatus(body?.message ?? "Failed to clear history.");
      } else {
        setStatus("Failed to clear history.");
      }
    } finally {
      setClearing(false);
    }
  };

  const toggleMatchDetails = (matchId: number) => {
    if (expandedMatchId === matchId) {
      setExpandedMatchId(null);
      return;
    }

    if (matchDetails[matchId]) {
      setExpandedMatchId(matchId);
      return;
    }

    setLoadingDetailId(matchId);
    setStatus("Loading match details...");
    apiFetch<MatchHistoryDetailResponse>(`/api/matches/${matchId}`)
      .then((payload) => {
        setMatchDetails((prev) => ({
          ...prev,
          [matchId]: payload.players,
        }));
        setExpandedMatchId(matchId);
        setStatus(null);
      })
      .catch((error) => {
        if (error instanceof ApiError) {
          const body = error.body as { message?: string; error?: string };
          setStatus(body?.message ?? "Failed to load match details.");
        } else {
          setStatus("Failed to load match details.");
        }
      })
      .finally(() => {
        setLoadingDetailId(null);
      });
  };

  return (
    <div className="login-container match-history-page">
      <div className="page-icons">
        <Link to="/" className="page-icon home-icon">
          <img src={homeIcon} alt="Home" className="icon-image" />
        </Link>
        <Link to="/profile" className="page-icon user-icon">
          <img src={userIcon} alt="Profile" className="icon-image" />
        </Link>
      </div>

      <div className="match-history-card">
        <h1 className="login-title login-title--main">Match History</h1>
        <p className="leaderboard-subtitle">
          Latest simulated clashes across all regions
        </p>

        <div className="match-history-actions">
          <button
            className="login-button"
            type="button"
            onClick={handleSimulate}
            disabled={simulating || clearing}
          >
            {simulating ? "Simulating..." : "Simulate New Match"}
          </button>
          <button
            className="login-button outline"
            type="button"
            onClick={() => loadMatches(page)}
            disabled={simulating || loading || clearing}
          >
            Refresh
          </button>
          <button
            className="login-button outline"
            type="button"
            onClick={handleClearHistory}
            disabled={simulating || loading || clearing}
          >
            {clearing ? "Clearing..." : "Clear History"}
          </button>
        </div>

        {status && <p className="form-status">{status}</p>}

        <div className="match-history-table-wrapper">
          <table className="match-history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Region</th>
                <th>Matchup</th>
                <th>Winner</th>
                <th>MVP</th>
              </tr>
            </thead>
            <tbody>
              {matches.length === 0 ? (
                <tr>
                  <td colSpan={5}>No matches yet. Simulate one!</td>
                </tr>
              ) : (
                matches.map((match) => {
                  const isExpanded = expandedMatchId === match.id;
                  const players = matchDetails[match.id] ?? [];
                  return (
                    <Fragment key={match.id}>
                      <tr
                        className={`match-history-row ${
                          isExpanded ? "expanded" : ""
                        }`}
                        onClick={() => toggleMatchDetails(match.id)}
                      >
                        <td>
                          {new Date(match.createdAt).toLocaleString(undefined, {
                            hour12: false,
                          })}
                        </td>
                        <td>{match.region}</td>
                        <td>
                          {match.teamA} vs {match.teamB}
                        </td>
                        <td>{match.winner}</td>
                        <td>
                          {match.mvp
                            ? `${match.mvp}${
                                match.mvpScore
                                  ? ` (${match.mvpScore.toFixed(1)})`
                                  : ""
                              }`
                            : "-"}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="match-history-detail-row">
                          <td colSpan={5}>
                            {loadingDetailId === match.id ? (
                              <p>Loading details...</p>
                            ) : players.length === 0 ? (
                              <p>No player stats recorded.</p>
                            ) : (
                              <table className="match-history-detail-table">
                                <thead>
                                  <tr>
                                    <th>Role</th>
                                    <th>Player</th>
                                    <th>K / D / A</th>
                                    <th>CS</th>
                                    <th>Gold</th>
                                    <th>Score</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {players.map((player) => (
                                    <tr key={player.id}>
                                      <td>{player.role ?? "-"}</td>
                                      <td>
                                        {player.nickname ?? player.name}
                                      </td>
                                      <td>
                                        {player.kills}/{player.deaths}/
                                        {player.assists}
                                      </td>
                                      <td>{player.cs}</td>
                                      <td>{player.gold}</td>
                                      <td>{player.score.toFixed(1)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="match-history-pagination">
          <button
            type="button"
            className="match-history-nav"
            onClick={() => loadMatches(page - 1)}
            disabled={!canPrev || loading || simulating}
          >
            {"< Prev"}
          </button>
          <span className="match-history-page-indicator">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            className="match-history-nav"
            onClick={() => loadMatches(page + 1)}
            disabled={!canNext || loading || simulating}
          >
            {"Next >"}
          </button>
        </div>
      </div>
    </div>
  );
}
