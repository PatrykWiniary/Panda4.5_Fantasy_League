import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/LogReg.css";
import homeIcon from "../assets/home.svg";
import userIcon from "../assets/user.svg";
import { apiFetch, ApiError } from "../api/client";
import type {
  Region,
  TournamentControlState,
  TournamentMatchSummary,
  MatchHistoryResponse,
  MatchHistorySeriesEntry,
  MatchHistoryDetailResponse,
  MatchPlayerHistoryEntry,
} from "../api/types";
import MatchPlayerTables from "./MatchPlayerTables";
import PlayerProfileModal from "./PlayerProfileModal";

type SimulationMode = "next" | "round" | "full";

export default function TournamentPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionId, setRegionId] = useState(1);
  const [state, setState] = useState<TournamentControlState | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recentMatches, setRecentMatches] = useState<TournamentMatchSummary[]>(
    []
  );
  const [historySeries, setHistorySeries] = useState<MatchHistorySeriesEntry[]>(
    []
  );
  const [historyExpandedId, setHistoryExpandedId] = useState<number | null>(
    null
  );
  const [historyStatus, setHistoryStatus] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyGameSelection, setHistoryGameSelection] = useState<
    Record<number, number | null>
  >({});
  const [historyGameDetails, setHistoryGameDetails] = useState<
    Record<number, MatchPlayerHistoryEntry[]>
  >({});
  const [historyGameLoadingId, setHistoryGameLoadingId] = useState<
    number | null
  >(null);
  const [historyGameError, setHistoryGameError] = useState<string | null>(null);
  const [profilePlayerId, setProfilePlayerId] = useState<number | null>(null);

  const activeTournament = state?.tournament ?? null;
  const groups = state?.groups ?? [];
  const bracketRounds = state?.bracket.rounds ?? [];

  const loadTournamentHistory = (
    tournamentId?: number | null,
    regionName?: string | null
  ) => {
    setHistoryLoading(true);
    setHistoryStatus("Loading match history...");
    apiFetch<MatchHistoryResponse>(`/api/matches/history?limit=25&page=1`)
      .then((payload) => {
        const filtered = payload.series.filter((entry) => {
          if (!entry.isTournament) {
            return false;
          }
          if (tournamentId) {
            return entry.tournamentId === tournamentId;
          }
          if (regionName) {
            return entry.games.some(
              (game) => game.region.toLowerCase() === regionName.toLowerCase()
            );
          }
          return true;
        });
        setHistorySeries(filtered);
        setHistoryExpandedId(null);
        setHistoryGameSelection({});
        setHistoryGameDetails({});
        setHistoryGameError(null);
        setHistoryStatus(
          filtered.length === 0
            ? "No tournament matches recorded yet."
            : null
        );
      })
      .catch((error) => {
        if (error instanceof ApiError) {
          const body = error.body as { message?: string; error?: string };
          setHistoryStatus(body?.message ?? "Failed to load match history.");
        } else {
          setHistoryStatus("Failed to load match history.");
        }
        setHistorySeries([]);
      })
      .finally(() => {
        setHistoryLoading(false);
      });
  };

  const toggleHistorySeries = (seriesId: number) => {
    setHistoryExpandedId((prev) => (prev === seriesId ? null : seriesId));
  };

  const handleHistoryGameClick = (
    seriesId: number,
    game: MatchHistorySeriesEntry["games"][number]
  ) => {
    setHistoryGameError(null);
    if (historyGameSelection[seriesId] === game.id) {
      setHistoryGameSelection((prev) => ({ ...prev, [seriesId]: null }));
      return;
    }
    if (historyGameDetails[game.id]) {
      setHistoryGameSelection((prev) => ({ ...prev, [seriesId]: game.id }));
      return;
    }
    setHistoryGameLoadingId(game.id);
    apiFetch<MatchHistoryDetailResponse>(`/api/matches/${game.id}`)
      .then((payload) => {
        setHistoryGameDetails((prev) => ({
          ...prev,
          [game.id]: payload.players,
        }));
        setHistoryGameSelection((prev) => ({ ...prev, [seriesId]: game.id }));
      })
      .catch((error) => {
        if (error instanceof ApiError) {
          const body = error.body as { message?: string; error?: string };
          setHistoryGameError(body?.message ?? "Failed to load player stats.");
        } else {
          setHistoryGameError("Failed to load player stats.");
        }
      })
      .finally(() => {
        setHistoryGameLoadingId(null);
      });
  };

  const handlePlayerClick = (player: MatchPlayerHistoryEntry) => {
    if (!player.playerId) {
      return;
    }
    setProfilePlayerId(player.playerId);
  };

  useEffect(() => {
    apiFetch<Region[]>("/api/regions")
      .then((payload) => {
        setRegions(payload);
        if (payload.length > 0 && !payload.find((r) => r.id === regionId)) {
          setRegionId(payload[0].id);
        }
      })
      .catch(() => {
        setRegions([]);
      });
  }, []);

  useEffect(() => {
    loadState(regionId);
  }, [regionId]);

  const loadState = (targetRegion: number) => {
    setStatus("Loading tournament state...");
    apiFetch<TournamentControlState>(`/api/regions/${targetRegion}/tournament`)
      .then((payload) => {
        setState(payload);
        setStatus(null);
        loadTournamentHistory(
          payload.tournament?.id ?? null,
          payload.tournament?.region.name ?? undefined
        );
      })
      .catch((error) => {
        if (error instanceof ApiError) {
          const body = error.body as { message?: string; error?: string };
          setStatus(body?.message ?? "Failed to load tournament state.");
        } else {
          setStatus("Failed to load tournament state.");
        }
        setState(null);
      });
  };

  const handleStart = async (force = false) => {
    setBusy(true);
    setStatus(force ? "Resetting tournament..." : "Starting tournament...");
    try {
      const payload = await apiFetch<TournamentControlState>(
        `/api/regions/${regionId}/tournament/start`,
        {
          method: "POST",
          body: JSON.stringify({ force }),
        }
      );
      setState(payload);
      setRecentMatches([]);
      setStatus("Tournament ready.");
      loadTournamentHistory(
        payload.tournament?.id ?? null,
        payload.tournament?.region.name ?? undefined
      );
    } catch (error) {
      if (error instanceof ApiError) {
        const body = error.body as { message?: string; error?: string };
        setStatus(body?.message ?? "Failed to start tournament.");
      } else {
        setStatus("Failed to start tournament.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSimulate = async (mode: SimulationMode) => {
    setBusy(true);
    const label =
      mode === "full"
        ? "Simulating entire tournament..."
        : mode === "round"
        ? "Simulating current round..."
        : "Simulating next series...";
    setStatus(label);
    try {
      const payload = await apiFetch<{
        matches: TournamentMatchSummary[];
        state: TournamentControlState;
      }>(`/api/regions/${regionId}/tournament/simulate`, {
        method: "POST",
        body: JSON.stringify({ mode }),
      });
      setState(payload.state);
      setRecentMatches(payload.matches);
      setStatus("Simulation complete.");
      loadTournamentHistory(
        payload.state.tournament?.id ?? null,
        payload.state.tournament?.region.name ?? undefined
      );
    } catch (error) {
      if (error instanceof ApiError) {
        const body = error.body as { message?: string; error?: string };
        setStatus(body?.message ?? "Simulation failed.");
      } else {
        setStatus("Simulation failed.");
      }
    } finally {
      setBusy(false);
    }
  };

  const regionOptions = useMemo(
    () =>
      regions.map((region) => (
        <option key={region.id} value={region.id}>
          {region.name}
        </option>
      )),
    [regions]
  );

  const renderGroupTable = (groupId: number) => {
    const group = groups.find((entry) => entry.id === groupId);
    if (!group) {
      return null;
    }
    return (
      <div key={group.id} className="tournament-group-card">
        <h3>{group.name}</h3>
        <table>
          <thead>
            <tr>
              <th>Team</th>
              <th>Wins</th>
              <th>Losses</th>
              <th>GP</th>
            </tr>
          </thead>
          <tbody>
            {group.teams.length === 0 ? (
              <tr>
                <td colSpan={4}>No teams assigned.</td>
              </tr>
            ) : (
              group.teams.map((team) => (
                <tr key={team.teamId}>
                  <td>{team.teamName}</td>
                  <td>{team.wins}</td>
                  <td>{team.losses}</td>
                  <td>{team.gamesPlayed}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderBracket = () => {
    if (bracketRounds.length === 0) {
      return (
        <p className="tournament-empty">Bracket matches will appear here.</p>
      );
    }
    return bracketRounds.map((round) => (
      <div key={round.name} className="tournament-bracket-round">
        <h3>{round.name}</h3>
        <div className="tournament-match-grid">
          {round.matches.length === 0 ? (
            <p>No series scheduled.</p>
          ) : (
            round.matches.map((match) => (
              <div key={match.id} className="tournament-match-card">
                <div className="tournament-match-round">
                  {match.stage} • Bo{match.bestOf}
                </div>
                <div className="tournament-match-team">
                  <span>{match.teamA?.name ?? "TBD"}</span>
                  <span>{match.teamA?.score ?? 0}</span>
                </div>
                <div className="tournament-match-team">
                  <span>{match.teamB?.name ?? "TBD"}</span>
                  <span>{match.teamB?.score ?? 0}</span>
                </div>
                <div className="tournament-match-footer">
                  {match.seriesScore ?? `${match.teamA?.score ?? 0}-${match.teamB?.score ?? 0}`}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    ));
  };

  return (
    <>
    <div className="login-container tournament-page fade-in">
      <div className="page-icons">
        <Link to="/" className="page-icon home-icon">
          <img src={homeIcon} alt="Home" className="icon-image" />
        </Link>
        <Link to="/profile" className="page-icon user-icon">
          <img src={userIcon} alt="Profile" className="icon-image" />
        </Link>
      </div>

      <div className="tournament-card">
        <div className="tournament-header">
          <h1>Regional Tournament Control</h1>
          <div className="tournament-region-picker">
            <label htmlFor="region-select">Region</label>
            <select
              id="region-select"
              value={regionId}
              onChange={(event) => setRegionId(Number(event.target.value))}
              disabled={busy}
            >
              {regionOptions}
            </select>
          </div>
        </div>

        <div className="tournament-mode-help">
          <p>
            <strong>Next series</strong> resolves a single BO1/BO5,
            <strong> current round</strong> runs every series scheduled in the
            upcoming round, while <strong>entire tournament</strong> simulates
            from the current point straight to the finals.
          </p>
        </div>

        <div className="tournament-actions">
          <button
            type="button"
            className="login-button"
            disabled={busy}
            onClick={() => handleStart(false)}
          >
            {busy ? "Working..." : "Start Tournament"}
          </button>
          <button
            type="button"
            className="login-button outline"
            disabled={busy}
            onClick={() => handleStart(true)}
          >
            Reset & Start
          </button>
          <button
            type="button"
            className="login-button outline"
            disabled={busy}
            onClick={() => handleSimulate("next")}
          >
            Simulate Next Series
          </button>
          <button
            type="button"
            className="login-button outline"
            disabled={busy}
            onClick={() => handleSimulate("round")}
          >
            Simulate Current Round
          </button>
          <button
            type="button"
            className="login-button outline"
            disabled={busy}
            onClick={() => handleSimulate("full")}
          >
            Simulate Entire Tournament
          </button>
        </div>

        {status && <p className="form-status">{status}</p>}

        <div className="tournament-panels">
          <div className="tournament-summary-card">
            {activeTournament ? (
              <>
                <h2>{activeTournament.name}</h2>
                <p>
                  Stage: <strong>{activeTournament.stage}</strong> • Status:{" "}
                  <strong>{activeTournament.status}</strong>
                </p>
                {activeTournament.nextMatch ? (
                  <p>
                    Next: {activeTournament.nextMatch.teamA?.name ?? "TBD"} vs{" "}
                    {activeTournament.nextMatch.teamB?.name ?? "TBD"} (
                    {activeTournament.nextMatch.roundName})
                  </p>
                ) : (
                  <p>No pending matches.</p>
                )}
              </>
            ) : (
              <p>No tournament created for this region.</p>
            )}
          </div>

          <div className="tournament-recent-results">
            <h3>Latest Simulation</h3>
            {recentMatches.length === 0 ? (
              <p className="tournament-empty">
                Run a simulation to see quick highlights.
              </p>
            ) : (
              <ul>
                {recentMatches.map((match) => (
                  <li key={match.id}>
                    <span>
                      {match.roundName ?? match.stage} · Bo{match.bestOf}
                    </span>
                    <strong>
                      {match.teamA?.name ?? "TBD"} vs{" "}
                      {match.teamB?.name ?? "TBD"}
                    </strong>
                    <span>
                      {match.seriesScore ??
                        `${match.teamA?.score ?? 0}-${match.teamB?.score ?? 0}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="tournament-grid">
          <section className="tournament-groups">
            <h2>Group Stage</h2>
            {groups.length === 0 ? (
              <p className="tournament-empty">
                Groups will appear once the tournament starts.
              </p>
            ) : (
              <div className="tournament-group-grid">
                {groups.map((group) => renderGroupTable(group.id))}
              </div>
            )}
          </section>

          <section className="tournament-bracket">
            <h2>Knockout Bracket</h2>
            {renderBracket()}
          </section>
        </div>

        <section className="tournament-history-card">
          <div className="tournament-history-header">
            <h2>Match History</h2>
            {historyLoading && <span>Loading…</span>}
          </div>
          {historyStatus && <p className="form-status">{historyStatus}</p>}
          {!historyStatus && historySeries.length === 0 && !historyLoading && (
            <p className="tournament-empty">
              Start or simulate a tournament to generate match history.
            </p>
          )}
          {historySeries.map((entry) => {
            const expanded = historyExpandedId === entry.id;
            const selectedGameIdForSeries = historyGameSelection[entry.id];
            const selectedGame =
              expanded && selectedGameIdForSeries
                ? entry.games.find((game) => game.id === selectedGameIdForSeries)
                : undefined;
            const selectedPlayers =
              selectedGame && selectedGameIdForSeries
                ? historyGameDetails[selectedGameIdForSeries] ?? []
                : [];
            return (
              <div
                key={entry.id}
                className={`tournament-history-entry ${
                  expanded ? "expanded" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleHistorySeries(entry.id)}
                >
                  <span className="tournament-history-round">
                    {entry.roundName ?? entry.stage ?? "Series"}
                  </span>
                  <span className="tournament-history-matchup">
                    {entry.teamA.name} vs {entry.teamB.name}
                  </span>
                  <span className="tournament-history-score">
                    {entry.seriesScore ??
                      `${entry.teamA.score}-${entry.teamB.score}`}
                  </span>
                </button>
                {expanded && (
                  <div className="tournament-history-games">
                    {entry.games.map((game, index) => {
                      const isSelected =
                        selectedGameIdForSeries === game.id &&
                        historyGameDetails[game.id];
                      return (
                        <div key={game.id} className="tournament-history-game">
                          <div>
                            <strong>
                              Game {game.gameNumber ?? index + 1}:
                            </strong>{" "}
                            {game.winner}
                          </div>
                          <div className="tournament-history-game-meta">
                            {game.teamA} vs {game.teamB} •{" "}
                            {game.mvp
                              ? `MVP: ${game.mvp}${
                                  game.mvpScore
                                    ? ` (${game.mvpScore.toFixed(1)})`
                                    : ""
                                }`
                              : "No MVP data"}
                          </div>
                          <button
                            type="button"
                            className="match-history-game-btn"
                            onClick={() => handleHistoryGameClick(entry.id, game)}
                          >
                            {historyGameLoadingId === game.id
                              ? "Loading..."
                              : isSelected
                              ? "Hide players"
                              : "View lineups"}
                          </button>
                          {isSelected && selectedGame && (
                            <>
                              <div className="match-history-objectives">
                                <h4>Objectives</h4>
                                {selectedGame.objectives ? (
                                  <div className="match-history-objectives-grid">
                                    <div className="match-history-objective-team">
                                      <div className="objective-team-name">
                                        {selectedGame.teamA}
                                      </div>
                                      <div className="objective-values">
                                        <span>
                                          Towers: {selectedGame.objectives.teamA.towers}
                                        </span>
                                        <span>
                                          Dragons: {selectedGame.objectives.teamA.dragons}
                                        </span>
                                        <span>
                                          Barons: {selectedGame.objectives.teamA.barons}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="match-history-objective-team">
                                      <div className="objective-team-name">
                                        {selectedGame.teamB}
                                      </div>
                                      <div className="objective-values">
                                        <span>
                                          Towers: {selectedGame.objectives.teamB.towers}
                                        </span>
                                        <span>
                                          Dragons: {selectedGame.objectives.teamB.dragons}
                                        </span>
                                        <span>
                                          Barons: {selectedGame.objectives.teamB.barons}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <p>Select a game to view objectives.</p>
                                )}
                              </div>
                              <MatchPlayerTables
                                match={selectedGame}
                                players={selectedPlayers}
                                onPlayerClick={handlePlayerClick}
                              />
                            </>
                          )}
                        </div>
                      );
                    })}
                    {historyGameError && (
                      <p className="form-status">{historyGameError}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
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
