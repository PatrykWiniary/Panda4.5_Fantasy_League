import { useEffect, useState } from "react";
import "./PlayerPick.css";
import bg from "../assets/rift.png";
import iconTop from "../assets/roleIcons/top.png";
import iconJungle from "../assets/roleIcons/jungle.png";
import iconMid from "../assets/roleIcons/mid.png";
import iconAdc from "../assets/roleIcons/adc.png";
import iconSupport from "../assets/roleIcons/support.png";
import { apiFetch, ApiError } from "../api/client";
import type {
  Deck,
  DeckCard,
  DeckResponse,
  DeckRole,
  GroupedPlayersResponse,
  PlayerOverview,
} from "../api/types";
import { useSession } from "../context/SessionContext";
import { resolvePlayerImage } from "../utils/playerImages";

type RoleKey = "top" | "jungle" | "mid" | "adc" | "support";
const ROLE_KEYS: RoleKey[] = ["top", "jungle", "mid", "adc", "support"];

const ROLE_TO_DECK: Record<RoleKey, DeckRole> = {
  top: "Top",
  jungle: "Jgl",
  mid: "Mid",
  adc: "Adc",
  support: "Supp",
};

const circlePositions: Array<{
  key: RoleKey;
  top: string;
  left: string;
  icon: string;
}> = [
  { key: "top", top: "15%", left: "28%", icon: iconTop },
  { key: "jungle", top: "38%", left: "33%", icon: iconJungle },
  { key: "mid", top: "42%", left: "50%", icon: iconMid },
  { key: "adc", top: "75%", left: "68%", icon: iconAdc },
  { key: "support", top: "80%", left: "80%", icon: iconSupport },
];

type UIPlayer = {
  id: number;
  name: string;
  nickname?: string | null;
  team: string;
  region: string;
  image: string;
  deckRole: DeckRole;
  points: number;
  cost: number;
  source?: PlayerOverview;
  snapshot?: DeckCard;
};

type PlayersData = Record<RoleKey, UIPlayer[]>;
type DraftTeam = Record<RoleKey, UIPlayer | null>;

const emptyPlayersData: PlayersData = {
  top: [],
  jungle: [],
  mid: [],
  adc: [],
  support: [],
};

const emptyDraftTeam: DraftTeam = {
  top: null,
  jungle: null,
  mid: null,
  adc: null,
  support: null,
};

export default function PlayerPick() {
  const { user } = useSession();
  const [playersData, setPlayersData] = useState<PlayersData>(emptyPlayersData);
  const [selectedRole, setSelectedRole] = useState<RoleKey | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<UIPlayer | null>(null);
  const [draftTeam, setDraftTeam] = useState<DraftTeam>({ ...emptyDraftTeam });
  const [saveStatus, setSaveStatus] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);
  const [saving, setSaving] = useState(false);
  const totalCost = calculateDraftCost(draftTeam);
  const currency = user?.currency ?? 0;
  const remaining = user ? currency - totalCost : null;

  useEffect(() => {
    let canceled = false;
    apiFetch<GroupedPlayersResponse>("/api/players?grouped=true")
      .then((payload) => {
        if (canceled) return;
        setPlayersData(buildPlayersFromApi(payload));
      })
      .catch(() => {
        /* leave defaults */
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setDraftTeam({ ...emptyDraftTeam });
      return;
    }
    let canceled = false;
    apiFetch<DeckResponse>(`/api/decks/${user.id}`)
      .then((response) => {
        if (canceled) return;
        setDraftTeam(mapDeckToDraft(response.deck));
      })
      .catch(() => undefined);
    return () => {
      canceled = true;
    };
  }, [user]);

  const handleCircleClick = (role: RoleKey) => {
    setSelectedRole(role);
    setSelectedPlayer(draftTeam[role] ?? playersData[role][0] ?? null);
  };

  const handlePlayerSelect = (role: RoleKey, player: UIPlayer) => {
    setSelectedPlayer(player);
    setDraftTeam((prev) => ({
      ...prev,
      [role]: player,
    }));
  };

  const handleSubmitTeam = async () => {
    if (!user) {
      setSaveStatus({
        type: "error",
        message: "Sign in to save your deck.",
      });
      return;
    }

    const missing = ROLE_KEYS.filter((key) => !draftTeam[key]);
    if (missing.length > 0) {
      setSaveStatus({
        type: "error",
        message: "Fill every role before saving.",
      });
      return;
    }

    const deckPayload: Deck = {
      userId: user.id,
      slots: buildDeckSlots(draftTeam),
    };

    setSaving(true);
    setSaveStatus(null);
    try {
      const response = await apiFetch<DeckResponse>("/api/decks/save", {
        method: "POST",
        body: JSON.stringify({ userId: user.id, deck: deckPayload }),
      });
      setSaveStatus({
        type: "success",
        message: "Deck saved successfully.",
      });
      setDraftTeam(mapDeckToDraft(response.deck));
    } catch (error) {
      let message = "Deck save failed.";
      if (error instanceof ApiError) {
        const body = error.body as { message?: string; error?: string };
        message = body?.message ?? body?.error ?? `Request failed (${error.status})`;
      }
      setSaveStatus({
        type: "error",
        message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`pick-your-team ${selectedRole ? "blurred" : ""}`}>
      <div className="budget-panel">
        <div className="budget-item">
          <span className="label">USER SCORE</span>
          <strong>{user ? user.score ?? 0 : "Sign in"}</strong>
        </div>
        <div className="budget-item">
          <span className="label">GOLD</span>
          <strong>{user ? currency : "--"}</strong>
        </div>
        <div className="budget-item">
          <span className="label">DRAFT COST</span>
          <strong>{totalCost}</strong>
        </div>
        {user && (
          <div className="budget-item">
            <span className="label">REMAINING</span>
            <strong className={remaining !== null && remaining < 0 ? "over-budget" : ""}>
              {remaining}
            </strong>
          </div>
        )}
      </div>
      <div className="rift-container">
        <img src={bg} alt="rift background" className="bg-img" />

        {circlePositions.map((pos) => {
          const filled = draftTeam[pos.key];
          return (
            <div
              key={pos.key}
              className="player-slot"
              style={{ top: pos.top, left: pos.left }}
            >
              <div
                className={`player-circle ${filled ? "selected" : ""}`}
                onClick={() => handleCircleClick(pos.key)}
                title={pos.key.toUpperCase()}
              >
                {filled && (
                  <img
                    src={filled.image}
                    alt={filled.name}
                    className="circle-image"
                  />
                )}
              </div>
              <img src={pos.icon} alt={`${pos.key} icon`} className="role-icon" />
            </div>
          );
        })}
      </div>

      <h1 className="title">PICK YOUR TEAM</h1>

      <div className="button-container">
        <button className="btn return" onClick={() => window.history.back()}>
          <span>RETURN</span>
        </button>
        <button
          className="btn confirm"
          onClick={handleSubmitTeam}
          disabled={saving || (remaining !== null && remaining < 0)}
        >
          <span>{saving ? "SAVING..." : "CONFIRM"}</span>
        </button>
      </div>
      {saveStatus && (
        <p className={`form-status ${saveStatus.type}`}>{saveStatus.message}</p>
      )}

      {selectedRole && (
        <div className="modal-overlay">
          <div className="modal">
            <button className="close-btn" onClick={() => setSelectedRole(null)}>
              ✕
            </button>

            <div className="modal-header">{selectedRole.toUpperCase()}</div>

            <div className="modal-body">
              <div className="player-grid">
                {playersData[selectedRole].map((player) => (
                  <div
                    key={player.id}
                    className={`player-grid-item ${
                      selectedPlayer?.id === player.id ? "active" : ""
                    }`}
                    onClick={() => handlePlayerSelect(selectedRole, player)}
                  >
                    <img src={player.image} alt={player.name} />
                    <span className="player-cost">{player.cost}</span>
                  </div>
                ))}
              </div>

              {selectedPlayer && (
                <div className="player-preview">
                  <img
                    src={selectedPlayer.image}
                    alt={selectedPlayer.name}
                    className="preview-image"
                  />
                  <div className="preview-info">
                    <h2>{selectedPlayer.name}</h2>
                    <p>TEAM: {selectedPlayer.team}</p>
                    <p>REGION: {selectedPlayer.region}</p>
                    <p>POINTS: {selectedPlayer.points}</p>
                    <p>COST: {selectedPlayer.cost}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function buildPlayersFromApi(response: GroupedPlayersResponse): PlayersData {
  const mapped: PlayersData = {
    top: [],
    jungle: [],
    mid: [],
    adc: [],
    support: [],
  };

  ROLE_KEYS.forEach((key) => {
    const deckRole = ROLE_TO_DECK[key];
    const players = response.groupedByRole[deckRole] ?? [];
    mapped[key] = players.map((player) => {
      const displayName = player.nickname ?? player.name;
      const points = Math.max(20, Math.round(player.score));
      const cost = Math.max(10, Math.round(points / 3));
      return {
        id: player.id,
        name: displayName,
        nickname: player.nickname,
        team: player.team.name,
        region: player.region.name,
        image: resolvePlayerImage(player.nickname ?? player.name),
        deckRole,
        points,
        cost,
        source: player,
      };
    });
  });

  return mapped;
}

function buildDeckSlots(draft: DraftTeam): Record<DeckRole, DeckCard | null> {
  return ROLE_KEYS.reduce((acc, key) => {
    acc[ROLE_TO_DECK[key]] = selectionToCard(draft[key]);
    return acc;
  }, {} as Record<DeckRole, DeckCard | null>);
}

function selectionToCard(selection: UIPlayer | null): DeckCard | null {
  if (!selection) {
    return null;
  }

  if (selection.snapshot) {
    return { ...selection.snapshot };
  }

  if (selection.source) {
    const baseScore = Math.max(20, Math.round(selection.source.score));
    return {
      name: selection.name,
      role: selection.deckRole,
      points: baseScore,
      value: Math.max(10, Math.round(baseScore / 3)),
      playerId: selection.source.id,
    };
  }

  return {
    name: selection.name,
    role: selection.deckRole,
    points: 40,
    value: 15,
  };
}

function mapDeckToDraft(deck: Deck): DraftTeam {
  const next: DraftTeam = { ...emptyDraftTeam };
  ROLE_KEYS.forEach((key) => {
    const role = ROLE_TO_DECK[key];
    const card = deck.slots[role];
    if (!card) {
      next[key] = null;
      return;
    }
    next[key] = {
      id: card.playerId ?? -role.charCodeAt(0),
      name: card.name,
      team: "Current team",
      region: "N/A",
      image: resolvePlayerImage(card.name),
      deckRole: role,
      points: card.points ?? 0,
      cost: card.value ?? 0,
      snapshot: card,
    };
  });
  return next;
}

function calculateDraftCost(draft: DraftTeam): number {
  return ROLE_KEYS.reduce((total, key) => total + (draft[key]?.cost ?? 0), 0);
}
