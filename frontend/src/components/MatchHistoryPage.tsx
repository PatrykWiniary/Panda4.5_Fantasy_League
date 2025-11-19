import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/LogReg.css";
import homeIcon from "../assets/home.svg";
import userIcon from "../assets/user.svg";
import { apiFetch, ApiError } from "../api/client";
import type {
  MatchHistoryResponse,
  MatchHistoryDetailResponse,
  MatchPlayerHistoryEntry,
  MatchHistorySeriesEntry,
  TournamentControlState,
} from "../api/types";
import MatchPlayerTables from "./MatchPlayerTables";
import PlayerProfileModal from "./PlayerProfileModal";

export default function MatchHistoryPage() {
  const [series, setSeries] = useState<MatchHistorySeriesEntry[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const pageSize = 15;
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedSeriesId, setExpandedSeriesId] = useState<number | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [matchDetails, setMatchDetails] = useState<
    Record<number, MatchPlayerHistoryEntry[]>
  >({});
  const [loadingDetailId, setLoadingDetailId] = useState<number | null>(null);
  const [friendlyLocked, setFriendlyLocked] = useState(false);
  const [activeTournamentName, setActiveTournamentName] = useState<string | null>(null);
  const [profilePlayerId, setProfilePlayerId] = useState<number | null>(null);

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
        setSeries(payload.series);
        setTotal(payload.total ?? payload.series.length);
        setPage(targetPage);
        setExpandedSeriesId(null);
        setSelectedGameId(null);
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

  const loadTournamentState = () => {
    apiFetch<TournamentControlState>(`/api/regions/1/tournament`)
      .then((state) => {
        const active = state.tournament;
        const locked =
          Boolean(active?.isActive) && active?.stage !== "completed";
        setFriendlyLocked(locked);
        setActiveTournamentName(active?.name ?? null);
      })
      .catch(() => {
        setFriendlyLocked(false);
        setActiveTournamentName(null);
      });
  };

  useEffect(() => {
    loadMatches(1);
    loadTournamentState();
  }, []);

  const handleSimulate = async () => {
    if (friendlyLocked) {
      setStatus(
        "Friendly matches are disabled while a tournament is active in this region."
      );
      return;
    }
    setSimulating(true);
    setStatus("Simulating match...");
    try {
      await apiFetch("/api/matches/simulate", {
        method: "POST",
        body: JSON.stringify({}),
      });
      loadMatches(1);
      loadTournamentState();
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
      setSeries([]);
      setTotal(0);
      setExpandedSeriesId(null);
      setSelectedGameId(null);
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

  const toggleSeries = (seriesId: number) => {
    if (expandedSeriesId === seriesId) {
      setExpandedSeriesId(null);
      setSelectedGameId(null);
      return;
    }
    setExpandedSeriesId(seriesId);
    setSelectedGameId(null);
  };

  const handlePlayerClick = (player: MatchPlayerHistoryEntry) => {
    if (!player.playerId) {
      return;
    }
    setProfilePlayerId(player.playerId);
  };

  const selectGame = (gameId: number) => {
    if (selectedGameId === gameId) {
      return;
    }
    if (matchDetails[gameId]) {
      setSelectedGameId(gameId);
      setStatus(null);
      return;
    }

    setLoadingDetailId(gameId);
    setStatus("Loading match details...");
    apiFetch<MatchHistoryDetailResponse>(`/api/matches/${gameId}`)
      .then((payload) => {
        setMatchDetails((prev) => ({
          ...prev,
          [gameId]: payload.players,
        }));
        setSelectedGameId(gameId);
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
    <>
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

        {friendlyLocked && (
          <p className="form-status warning">
            {activeTournamentName
              ? `${activeTournamentName} is running. Friendly matches are disabled until it finishes.`
              : "A tournament is running. Friendly matches are disabled until it ends."}
          </p>
        )}

        {status && <p className="form-status">{status}</p>}

        <div className="match-history-table-wrapper">
          <table className="match-history-table">
            <thead>
              <tr>
                <th>Stage</th>
                <th>Series</th>
                <th>Score</th>
                <th>Best Of</th>
                <th>Finished</th>
              </tr>
            </thead>
            <tbody>
              {series.length === 0 ? (
                <tr>
                  <td colSpan={5}>No matches yet. Simulate one!</td>
                </tr>
              ) : (
                series.map((entry) => {
                  const isExpanded = expandedSeriesId === entry.id;
                  const isSeriesSelected =
                    typeof selectedGameId === "number" &&
                    entry.games.some((game) => game.id === selectedGameId);
                  const activeGame =
                    isSeriesSelected && selectedGameId
                      ? entry.games.find((game) => game.id === selectedGameId)
                      : undefined;
                  const activeGamePlayers =
                    isSeriesSelected && selectedGameId
                      ? matchDetails[selectedGameId] ?? []
                      : [];
                  return (
                    <Fragment key={entry.id}>
                      <tr
                        className={`match-history-row ${
                          isExpanded ? "expanded" : ""
                        }`}
                        onClick={() => toggleSeries(entry.id)}
                      >
                        <td>{entry.stage ?? "Friendly"}</td>
                        <td>
                          {entry.teamA.name} vs {entry.teamB.name}
                        </td>
                        <td>
                          {entry.seriesScore ??
                            `${entry.teamA.score}-${entry.teamB.score}`}
                        </td>
                        <td>Bo{entry.bestOf}</td>
                        <td>
                          {new Date(entry.completedAt).toLocaleString(undefined, {
                            hour12: false,
                          })}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="match-history-detail-row">
                          <td colSpan={5}>
                            <div className="match-history-series-panel">
                              <div className="match-history-games">
                                <h4>Games</h4>
                                {entry.games.length === 0 ? (
                                  <p>No games simulated yet.</p>
                                ) : (
                                  entry.games.map((game, index) => {
                                    const label =
                                      game.gameNumber ?? index + 1;
                                    const isSelected =
                                      selectedGameId === game.id;
                                    return (
                                      <button
                                        key={game.id}
                                        type="button"
                                        className={`match-history-game-btn ${
                                          isSelected ? "active" : ""
                                        }`}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          selectGame(game.id);
                                        }}
                                      >
                                        {`Game ${label}: ${game.winner}`}
                                        {game.mvp
                                          ? ` • MVP: ${game.mvp}`
                                          : ""}
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                              <div className="match-history-players-panel">
                                <h4>Player Stats</h4>
                                {selectedGameId &&
                                loadingDetailId === selectedGameId ? (
                                  <p>Loading details...</p>
                                ) : !activeGame ? (
                                  <p>Select a game to view player stats.</p>
                                ) : activeGamePlayers.length === 0 ? (
                                  <p>No player stats recorded.</p>
                                ) : (
                                  <MatchPlayerTables
                                    match={activeGame}
                                    players={activeGamePlayers}
                                    onPlayerClick={handlePlayerClick}
                                  />
                                )}
                              </div>
                            </div>
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
      {profilePlayerId && (
        <PlayerProfileModal
          playerId={profilePlayerId}
          onClose={() => setProfilePlayerId(null)}
        />
      )}
    </>
  );
}
