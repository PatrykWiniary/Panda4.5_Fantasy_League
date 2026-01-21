import type {
  DeckRole,
  MatchHistoryEntry,
  MatchPlayerHistoryEntry,
} from "../api/types";

type Props = {
  match: Pick<MatchHistoryEntry, "teamA" | "teamB">;
  players: MatchPlayerHistoryEntry[];
  onPlayerClick?: (player: MatchPlayerHistoryEntry) => void;
};

const ROLE_ORDER: DeckRole[] = ["Top", "Jgl", "Mid", "Adc", "Supp"];

const roleIndex = (role?: string | null) => {
  if (!role) return ROLE_ORDER.length;
  const normalized = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  const index = ROLE_ORDER.findIndex((entry) => entry === normalized);
  return index === -1 ? ROLE_ORDER.length : index;
};

export default function MatchPlayerTables({
  match,
  players,
  onPlayerClick,
}: Props) {
  const buckets: Record<"A" | "B" | "unknown", MatchPlayerHistoryEntry[]> = {
    A: [],
    B: [],
    unknown: [],
  };

  const teamAName = match.teamA ?? "Team A";
  const teamBName = match.teamB ?? "Team B";

  for (const player of players) {
    let side: "A" | "B" | null = null;
    if (player.teamSide === "A" || player.teamSide === "B") {
      side = player.teamSide;
    } else if (
      player.teamName &&
      player.teamName.toLowerCase() === teamAName.toLowerCase()
    ) {
      side = "A";
    } else if (
      player.teamName &&
      player.teamName.toLowerCase() === teamBName.toLowerCase()
    ) {
      side = "B";
    }

    if (side === "A") {
      buckets.A.push(player);
    } else if (side === "B") {
      buckets.B.push(player);
    } else {
      buckets.unknown.push(player);
    }
  }

  const sortByRole = (entries: MatchPlayerHistoryEntry[]) =>
    [...entries].sort((a, b) => roleIndex(a.role) - roleIndex(b.role));

  const renderTeamTable = (
    title: string,
    entries: MatchPlayerHistoryEntry[]
  ) => (
    <div className="match-player-team" key={title}>
      <h4>{title}</h4>
      {entries.length === 0 ? (
        <p className="tournament-empty">No stats.</p>
      ) : (
        <table>
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
            {entries.map((player) => (
              <tr key={player.id}>
                <td>{player.role ?? "-"}</td>
                <td>
                  {player.playerId && onPlayerClick ? (
                    <button
                      type="button"
                      className="player-link"
                      onClick={() => onPlayerClick(player)}
                    >
                      {player.nickname ?? player.name}
                    </button>
                  ) : (
                    player.nickname ?? player.name
                  )}
                </td>
                <td>
                  {player.kills}/{player.deaths}/{player.assists}
                </td>
                <td>{player.cs}</td>
                <td>{player.gold}</td>
                <td>{player.score.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const unknownPlayers = buckets.unknown.length
    ? sortByRole(buckets.unknown)
    : [];

  return (
    <div className="match-player-grid">
      {renderTeamTable(teamAName, sortByRole(buckets.A))}
      {renderTeamTable(teamBName, sortByRole(buckets.B))}
      {unknownPlayers.length > 0 && (
        <div className="match-player-team match-player-unknown">
          <h4>Unassigned</h4>
          <table>
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
              {unknownPlayers.map((player) => (
                <tr key={player.id}>
                  <td>{player.role ?? "-"}</td>
                  <td>
                    {player.playerId && onPlayerClick ? (
                      <button
                        type="button"
                        className="player-link"
                        onClick={() => onPlayerClick(player)}
                      >
                        {player.nickname ?? player.name}
                      </button>
                    ) : (
                      player.nickname ?? player.name
                    )}
                  </td>
                  <td>
                    {player.kills}/{player.deaths}/{player.assists}
                  </td>
                  <td>{player.cs}</td>
                  <td>{player.gold}</td>
                  <td>{player.score.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
