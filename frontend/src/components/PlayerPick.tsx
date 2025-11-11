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

const playerIcons = "/src/assets/playerPics/";
const FALLBACK_IMAGE = `${playerIcons}Faker.webp`;
const KNOWN_IMAGES = new Set([
  "Zeus",
  "Bin",
  "Faker",
  "Chovy",
  "Gumayusi",
  "Ruler",
  "Oner",
  "Canyon",
  "Keria",
  "Duro",
]);

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
  team: string;
  region: string;
  image: string;
  deckRole: DeckRole;
  source?: PlayerOverview;
  snapshot?: DeckCard;
};

type PlayersData = Record<RoleKey, UIPlayer[]>;
type DraftTeam = Record<RoleKey, UIPlayer | null>;

let staticId = 1;

const defaultPlayers: PlayersData = {
  top: [
    makeStaticPlayer("Zeus", "HLE", "LCK", "Top", "Zeus"),
    makeStaticPlayer("Bin", "BLG", "LPL", "Top", "Bin"),
  ],
  jungle: [
    makeStaticPlayer("Oner", "T1", "LCK", "Jgl", "Oner"),
    makeStaticPlayer("Canyon", "Gen.G", "LCK", "Jgl", "Canyon"),
  ],
  mid: [
    makeStaticPlayer("Faker", "T1", "LCK", "Mid", "Faker"),
    makeStaticPlayer("Chovy", "Gen.G", "LCK", "Mid", "Chovy"),
  ],
  adc: [
    makeStaticPlayer("Gumayusi", "T1", "LCK", "Adc", "Gumayusi"),
    makeStaticPlayer("Ruler", "Gen.G", "LCK", "Adc", "Ruler"),
  ],
  support: [
    makeStaticPlayer("Keria", "T1", "LCK", "Supp", "Keria"),
    makeStaticPlayer("Duro", "Gen.G", "LCK", "Supp", "Duro"),
  ],
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
  const [playersData, setPlayersData] = useState<PlayersData>(defaultPlayers);
  const [selectedRole, setSelectedRole] = useState<RoleKey | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<UIPlayer | null>(null);
  const [draftTeam, setDraftTeam] = useState<DraftTeam>({ ...emptyDraftTeam });

  useEffect(() => {
    let canceled = false;
    apiFetch<GroupedPlayersResponse>("/api/players?grouped=true&regionId=1")
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
      console.warn("Sign in to save your deck.");
      return;
    }

    const missing = ROLE_KEYS.filter((key) => !draftTeam[key]);
    if (missing.length > 0) {
      console.warn("Fill every role before saving.");
      return;
    }

    const deckPayload: Deck = {
      userId: user.id,
      slots: buildDeckSlots(draftTeam),
    };

    try {
      await apiFetch<DeckResponse>("/api/decks/save", {
        method: "POST",
        body: JSON.stringify({ userId: user.id, deck: deckPayload }),
      });
    } catch (error) {
      if (error instanceof ApiError) {
        console.error("Deck save failed:", error.body);
      } else {
        console.error("Deck save failed:", error);
      }
    }
  };

  return (
    <div className={`pick-your-team ${selectedRole ? "blurred" : ""}`}>
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
        <button className="btn confirm" onClick={handleSubmitTeam}>
          <span>CONFIRM</span>
        </button>
      </div>

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
    if (players.length === 0) {
      mapped[key] = defaultPlayers[key];
      return;
    }
    mapped[key] = players.slice(0, 8).map((player) => ({
      id: player.id,
      name: player.name,
      team: player.team.name,
      region: player.region.name,
      image: resolveImage(player.name),
      deckRole,
      source: player,
    }));
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
      image: resolveImage(card.name),
      deckRole: role,
      snapshot: card,
    };
  });
  return next;
}

function makeStaticPlayer(
  name: string,
  team: string,
  region: string,
  deckRole: DeckRole,
  asset: string
): UIPlayer {
  return {
    id: staticId++,
    name,
    team,
    region,
    image: `${playerIcons}${asset}.webp`,
    deckRole,
  };
}

function resolveImage(name: string): string {
  const cleaned = name.replace(/\s+/g, "");
  if (KNOWN_IMAGES.has(cleaned)) {
    return `${playerIcons}${cleaned}.webp`;
  }
  return FALLBACK_IMAGE;
}
