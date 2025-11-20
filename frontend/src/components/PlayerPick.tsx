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
  const [playerInfoMap, setPlayerInfoMap] = useState<Map<number, UIPlayer>>(
    () => new Map()
  );
  const [selectedRole, setSelectedRole] = useState<RoleKey | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<UIPlayer | null>(null);
  const [draftTeam, setDraftTeam] = useState<DraftTeam>({ ...emptyDraftTeam });
  const [savedDeck, setSavedDeck] = useState<Deck | null>(null);
  const [saveStatus, setSaveStatus] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [isLockedIn, setIsLockedIn] = useState(false);
  const [showLockedOverlay, setShowLockedOverlay] = useState(false);
  const totalCost = calculateDraftCost(draftTeam);
  const maxBudget = user?.currency ?? 250;
  const remainingBudget = maxBudget - totalCost;

  useEffect(() => {
    let canceled = false;
    apiFetch<GroupedPlayersResponse>("/api/players?grouped=true")
      .then((payload) => {
        if (canceled) return;
        const result = buildPlayersFromApi(payload);
        setPlayersData(result.data);
        setPlayerInfoMap(result.map);
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
      setSavedDeck(null);
      setDraftTeam({ ...emptyDraftTeam });
      return;
    }
    let canceled = false;
    apiFetch<DeckResponse>(`/api/decks/${user.id}`)
      .then((response) => {
        if (canceled) return;
        setSavedDeck(response.deck);
        setDraftTeam(mapDeckToDraft(response.deck, playerInfoMap));
      })
      .catch(() => undefined);
    return () => {
      canceled = true;
    };
  }, [user]);

  useEffect(() => {
    if (savedDeck) {
      setDraftTeam(mapDeckToDraft(savedDeck, playerInfoMap));
    }
  }, [playerInfoMap, savedDeck]);

  const handleCircleClick = (role: RoleKey) => {
    if (isLockedIn) {
      return;
    }
    setSelectedRole(role);
    setSelectedPlayer(draftTeam[role] ?? playersData[role][0] ?? null);
  };

  const handlePlayerSelect = (role: RoleKey, player: UIPlayer) => {
    if (isLockedIn) {
      return;
    }
    setSelectedPlayer(player);
    setDraftTeam((prev) => ({
      ...prev,
      [role]: player,
    }));
  };

  const closeModal = () => {
    setSelectedRole(null);
    setSelectedPlayer(null);
  };

  const handleSubmitTeam = async (): Promise<boolean> => {
    if (!user) {
      setSaveStatus({
        type: "error",
        message: "Sign in to save your deck.",
      });
      return false;
    }

    const missing = ROLE_KEYS.filter((key) => !draftTeam[key]);
    if (missing.length > 0) {
      setSaveStatus({
        type: "error",
        message: "Fill every role before saving.",
      });
      return false;
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
      setSavedDeck(response.deck);
      setDraftTeam(mapDeckToDraft(response.deck, playerInfoMap));
      return true;
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
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmLockIn = async () => {
    if (isLockedIn) {
      return;
    }
    setShowPopup(false);
    if (remainingBudget < 0) {
      setSaveStatus({
        type: "error",
        message: "You can’t lock in with insufficient eurogąbki!",
      });
      return;
    }
    const success = await handleSubmitTeam();
    if (success) {
      setIsLockedIn(true);
      setShowLockedOverlay(true);
      setTimeout(() => setShowLockedOverlay(false), 3000);
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
      <p className="deadline">⏱ DUE IN: 23.11.2025 23:59</p>

      <div className="draft-info">
        <div className="info-item">
          <span className="label">DRAFT COST</span>
          <span className="value">{totalCost}</span>
        </div>
        <div className="info-item">
          <span className="label">REMAINING EUROGĄBKI</span>
          <span className="value">{remainingBudget}</span>
        </div>
      </div>

      <div className="button-container">
        <button className="btn return" onClick={() => window.history.back()}>
          <span>RETURN</span>
        </button>
        <button
          className={`btn confirm ${isLockedIn ? "disabled" : ""}`}
          onClick={() => !isLockedIn && setShowPopup(true)}
          disabled={isLockedIn || saving}
        >
          <span>{saving ? "SAVING..." : "LOCK IN"}</span>
        </button>
      </div>
      {saveStatus && (
        <p className={`form-status ${saveStatus.type}`}>{saveStatus.message}</p>
      )}

      {selectedRole && (
        <div className="modal-overlay">
          <div className="modal">
            <button className="close-btn" onClick={closeModal}>
              X
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
                    <span className="cost">{player.cost}</span>
                  </div>
                ))}
              </div>
            </div>
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
                    <p>COST: {selectedPlayer.cost}</p>
                  </div>
                </div>
              )}
        </div>
      )}
      {showPopup && (
        <div className="popup-overlay">
          <div className="popup">
            <h2>DONE PICKING YOUR TEAM?</h2>
            <div className="popup-buttons">
              <button
                className="popup-btn yes"
                onClick={handleConfirmLockIn}
                disabled={saving}
              >
                YES
              </button>
              <button
                className="popup-btn no"
                onClick={() => setShowPopup(false)}
                disabled={saving}
              >
                NO
              </button>
            </div>
          </div>
        </div>
      )}
      {showLockedOverlay && (
        <div className="locked-overlay">
          <h1 className="locked-text">
            LOCKED
            <br />
            IN
          </h1>
        </div>
      )}
    </div>
  );
}

type PlayersDataResult = {
  data: PlayersData;
  map: Map<number, UIPlayer>;
};

function buildPlayersFromApi(response: GroupedPlayersResponse): PlayersDataResult {
  const mapped: PlayersData = {
    top: [],
    jungle: [],
    mid: [],
    adc: [],
    support: [],
  };
  const infoMap = new Map<number, UIPlayer>();

  ROLE_KEYS.forEach((key) => {
    const deckRole = ROLE_TO_DECK[key];
    const players = response.groupedByRole[deckRole] ?? [];
    mapped[key] = players.map((player) => {
      const displayName = player.nickname ?? player.name;
      const points = Math.max(20, Math.round(player.score));
      const cost = Math.max(10, Math.round(points / 3));
      const mappedPlayer: UIPlayer = {
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
      infoMap.set(player.id, mappedPlayer);
      return mappedPlayer;
    });
  });

  return { data: mapped, map: infoMap };
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

function mapDeckToDraft(
  deck: Deck,
  infoMap: Map<number, UIPlayer>
): DraftTeam {
  const next: DraftTeam = { ...emptyDraftTeam };
  ROLE_KEYS.forEach((key) => {
    const role = ROLE_TO_DECK[key];
    const card = deck.slots[role];
    if (!card) {
      next[key] = null;
      return;
    }
    const info = card.playerId ? infoMap.get(card.playerId) : undefined;
    next[key] = {
      id: card.playerId ?? -role.charCodeAt(0),
      name: info?.name ?? card.name,
      team: info?.team ?? "Current team",
      region: info?.region ?? "N/A",
      image: info?.image ?? resolvePlayerImage(card.name),
      deckRole: role,
      points: info?.points ?? card.points ?? 0,
      cost: info?.cost ?? card.value ?? 0,
      snapshot: card,
    };
  });
  return next;
}

function calculateDraftCost(draft: DraftTeam): number {
  return ROLE_KEYS.reduce((total, key) => total + (draft[key]?.cost ?? 0), 0);
}
