import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import type {
  PlayerProfileResponse,
  PlayerMatchAppearance,
} from "../api/types";
import { resolvePlayerImage } from "../utils/playerImages";

type Props = {
  playerId: number;
  onClose: () => void;
};

export default function PlayerProfileModal({ playerId, onClose }: Props) {
  const [data, setData] = useState<PlayerProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch<PlayerProfileResponse>(`/api/players/${playerId}/profile`)
      .then((payload) => {
        setData(payload);
      })
      .catch((err) => {
        if (err instanceof ApiError) {
          const body = err.body as { message?: string; error?: string };
          setError(body?.message ?? "Failed to load player profile.");
        } else {
          setError("Failed to load player profile.");
        }
      })
      .finally(() => setLoading(false));
  }, [playerId]);

  const close = () => {
    onClose();
  };

  const player = data?.player;
  const avatarSrc = player ? resolvePlayerImage(player.name) : undefined;

  const renderMatch = (match: PlayerMatchAppearance) => {
    return (
      <li key={`${match.matchId}-${match.createdAt}`}>
        <div className="player-match-head">
          <strong>{match.roundName ?? match.stage ?? match.region}</strong>
          <span>
            {new Date(match.createdAt).toLocaleString(undefined, {
              hour12: false,
            })}
          </span>
        </div>
        <div className="player-match-body">
          <span>
            {match.teamA} vs {match.teamB} • Winner: {match.winner}
          </span>
          <span>
            {match.stats.teamName
              ? `${match.stats.teamName}${match.stats.teamSide ? ` (${match.stats.teamSide})` : ""}`
              : ""}
          </span>
        </div>
        <div className="player-match-stats">
          <span>Role: {match.stats.role ?? "-"}</span>
          <span>
            K/D/A: {match.stats.kills}/{match.stats.deaths}/
            {match.stats.assists}
          </span>
          <span>CS: {match.stats.cs}</span>
          <span>Gold: {match.stats.gold}</span>
          <span>Score: {match.stats.score.toFixed(1)}</span>
        </div>
      </li>
    );
  };

  return (
    <div className="player-profile-backdrop" onClick={close}>
      <div
        className="player-profile-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="player-profile-close" onClick={close}>
          ×
        </button>
        {loading ? (
          <p>Loading player…</p>
        ) : error ? (
          <p className="form-status">{error}</p>
        ) : player ? (
          <>
            <div className="player-profile-header">
              <img
                src={avatarSrc}
                alt={player.name}
                className="player-profile-avatar"
              />
              <div>
                <h3>{player.nickname ?? player.name}</h3>
                <p>{player.name}</p>
                <p>
                  {player.role} • {player.team.name} ({player.region.name})
                </p>
                <p>League: {player.team.tournamentName}</p>
              </div>
            </div>
            <div className="player-profile-stats">
              <div>
                <span>Kills</span>
                <strong>{player.kills}</strong>
              </div>
              <div>
                <span>Deaths</span>
                <strong>{player.deaths}</strong>
              </div>
              <div>
                <span>Assists</span>
                <strong>{player.assists}</strong>
              </div>
              <div>
                <span>CS</span>
                <strong>{player.cs}</strong>
              </div>
              <div>
                <span>Gold</span>
                <strong>{player.gold}</strong>
              </div>
              <div>
                <span>Score</span>
                <strong>{player.score.toFixed(1)}</strong>
              </div>
            </div>
            <div className="player-profile-matches">
              <h4>Recent Matches</h4>
              {data?.matches.length ? (
                <ul>{data.matches.map(renderMatch)}</ul>
              ) : (
                <p>No recent matches recorded.</p>
              )}
            </div>
          </>
        ) : (
          <p className="form-status">Player not found.</p>
        )}
      </div>
    </div>
  );
}
