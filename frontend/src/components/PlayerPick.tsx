import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/PlayerPick.css";
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
  LobbyByUserResponse,
  BoostAssignResponse,
  BoostsResponse,
  CollectionResponse,
  OwnedPlayer,
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
  marketValue: number;
  source?: OwnedPlayer;
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
  const navigate = useNavigate();
  const { user } = useSession();
  const [playersData, setPlayersData] = useState<PlayersData>(emptyPlayersData);
  const [playerInfoMap, setPlayerInfoMap] = useState<Map<number, UIPlayer>>(
    () => new Map()
  );
  const [selectedRole, setSelectedRole] = useState<RoleKey | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<UIPlayer | null>(null);
  const [draftTeam, setDraftTeam] = useState<DraftTeam>({ ...emptyDraftTeam });
  const [savedDeck, setSavedDeck] = useState<Deck | null>(null);
  const [boosts, setBoosts] = useState<BoostsResponse | null>(null);
  const [saveStatus, setSaveStatus] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [isLockedIn, setIsLockedIn] = useState(false);
  const [showLockedOverlay, setShowLockedOverlay] = useState(false);
  const [activeLobby, setActiveLobby] = useState<LobbyByUserResponse["lobby"] | null>(null);
  const totalCost = calculateDraftCost(draftTeam);
  const wallet = user?.currency ?? 0;
  const missingRoles = ROLE_KEYS.filter((key) => !draftTeam[key]);
  const missingOwnedRoles = ROLE_KEYS.filter((key) => playersData[key].length === 0);
  const assignedBoosts =
    selectedPlayer && boosts
      ? boosts.boosts.filter((boost) => boost.assignedPlayerId === selectedPlayer.id)
      : [];
  const recommendations = useMemo(() => {
    return ROLE_KEYS.map((role) => {
      if (!missingRoles.includes(role)) {
        return null;
      }
      const sorted = [...playersData[role]].sort((a, b) => {
        if (a.cost !== b.cost) {
          return a.cost - b.cost;
        }
        return b.points - a.points;
      });
      const player = sorted[0];
      return player ? { role, player } : null;
    }).filter(Boolean) as Array<{ role: RoleKey; player: UIPlayer }>;
  }, [missingRoles, playersData]);
  const boostByPlayerId = useMemo(() => {
    const map = new Map<number, BoostsResponse["boosts"][number]>();
    if (boosts) {
      boosts.boosts.forEach((boost) => {
        if (boost.assignedPlayerId) {
          map.set(boost.assignedPlayerId, boost);
        }
      });
    }
    return map;
  }, [boosts]);

  useEffect(() => {
    if (!user) {
      setPlayersData(emptyPlayersData);
      setPlayerInfoMap(new Map());
      return;
    }
    let canceled = false;
    apiFetch<CollectionResponse>(`/api/collection?userId=${user.id}`)
      .then((payload) => {
        if (canceled) return;
        const result = buildPlayersFromApi(payload);
        setPlayersData(result.data);
        setPlayerInfoMap(result.map);
      })
      .catch(() => {
        if (!canceled) {
          setPlayersData(emptyPlayersData);
          setPlayerInfoMap(new Map());
        }
      });
    return () => {
      canceled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setSavedDeck(null);
      setDraftTeam({ ...emptyDraftTeam });
      setBoosts(null);
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
    if (!user) {
      setBoosts(null);
      return;
    }
    let canceled = false;
    apiFetch<BoostsResponse>(`/api/boosts?userId=${user.id}`)
      .then((payload) => {
        if (!canceled) {
          setBoosts(payload);
        }
      })
      .catch(() => {
        if (!canceled) {
          setBoosts(null);
        }
      });
    return () => {
      canceled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (savedDeck) {
      setDraftTeam(mapDeckToDraft(savedDeck, playerInfoMap));
    }
  }, [playerInfoMap, savedDeck]);

  useEffect(() => {
    if (!user) {
      setActiveLobby(null);
      setIsLockedIn(false);
      return;
    }
    let canceled = false;
    apiFetch<LobbyByUserResponse>(`/api/lobbies?userId=${user.id}`)
      .then((payload) => {
        if (canceled) return;
        setActiveLobby(payload.lobby);
        const ready =
          payload.lobby?.players.find((player) => player.id === user.id)?.ready ??
          false;
        setIsLockedIn(ready);
      })
      .catch(() => {
        if (!canceled) {
          setActiveLobby(null);
          setIsLockedIn(false);
        }
      });
    return () => {
      canceled = true;
    };
  }, [user?.id]);

  const handleCircleClick = (role: RoleKey) => {
    if (isLockedIn) {
      return;
    }
    if (playersData[role].length === 0) {
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

    if (missingRoles.length > 0) {
      setSaveStatus({
        type: "error",
        message:
          missingOwnedRoles.length > 0
            ? `You don't own a player for: ${missingOwnedRoles.join(", ")}.`
            : "Fill every role before saving.",
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

  const handleAssignBoost = async (boostType: string) => {
    if (!user || !selectedPlayer) {
      return;
    }
    setSaveStatus(null);
    try {
      const response = await apiFetch<BoostAssignResponse>("/api/boosts/assign", {
        method: "POST",
        body: JSON.stringify({
          userId: user.id,
          boostType,
          playerId: selectedPlayer.id,
        }),
      });
      setBoosts((prev) =>
        prev
          ? {
              boosts: prev.boosts.map((boost) =>
                boost.id === response.boost.id ? response.boost : boost
              ),
            }
          : prev
      );
      setSaveStatus({
        type: "success",
        message: `Boost assigned: ${response.boost.boostType}.`,
      });
    } catch (error) {
      let message = "Boost assignment failed.";
      if (error instanceof ApiError) {
        const body = error.body as { message?: string; error?: string };
        message = body?.message ?? body?.error ?? `Request failed (${error.status})`;
      }
      setSaveStatus({ type: "error", message });
    }
  };

  const handleConfirmLockIn = async () => {
    if (isLockedIn) {
      return;
    }
    setShowPopup(false);
    const success = await handleSubmitTeam();
    if (success) {
      if (user) {
        try {
          const lobbyResponse = await apiFetch<LobbyByUserResponse>(
            `/api/lobbies?userId=${user.id}`
          );
          if (lobbyResponse.lobby?.lobby.status === "started") {
            await apiFetch(`/api/lobbies/${lobbyResponse.lobby.lobby.id}/ready`, {
              method: "POST",
              body: JSON.stringify({ userId: user.id, ready: true }),
            });
            setActiveLobby(lobbyResponse.lobby);
            setIsLockedIn(true);
          }
        } catch {
          /* ignore lobby ready failures */
        }
      }
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
          const hasOptions = playersData[pos.key].length > 0;
          const assignedBoost =
            filled && filled.id > 0 ? boostByPlayerId.get(filled.id) : undefined;
          return (
            <div
              key={pos.key}
              className="player-slot"
              style={{ top: pos.top, left: pos.left }}
            >
              <div
                className={`player-circle ${filled ? "selected" : "empty"} ${
                  hasOptions ? "" : "disabled"
                }`}
                onClick={() => handleCircleClick(pos.key)}
                title={
                  hasOptions
                    ? pos.key.toUpperCase()
                    : `${pos.key.toUpperCase()} (no owned players)`
                }
              >
                {!filled && <span className="empty-fill" />}
                {filled && (
                  <img
                    src={filled.image}
                    alt={filled.name}
                    className="circle-image"
                  />
                )}
                {assignedBoost && (
                  <span
                    className={`boost-badge ${
                      assignedBoost.usesRemaining > 0 ? "" : "used"
                    }`}
                  >
                    {assignedBoost.boostType === "DOUBLE_POINTS" ? "x2" : "HS"}
                  </span>
                )}
              </div>
              <img src={pos.icon} alt={`${pos.key} icon`} className="role-icon" />
            </div>
          );
        })}
      </div>
      <div className="title-wrapper">
        <h1 className="title">PICK YOUR TEAM</h1>
        <p className="deadline">⏱ DUE IN: 23.11.2025 23:59</p>
      </div>

      <div className="draft-info">
        <div className="info-item">
          <span className="label">TEAM VALUE</span>
          <span className="value">{totalCost}</span>
        </div>
        <div className="info-item">
          <span className="label">WALLET</span>
          <span className="value">{wallet}</span>
        </div>
      </div>
      <div className="status-container">
        {saveStatus && (
          <div
            className={`form-status ${saveStatus.type}`}
            style={{ display: saveStatus ? "block" : "none" }}
          >
            {saveStatus.message}
          </div>
        )}
        {user && !saveStatus && missingRoles.length > 0 && (
          <div className="form-status error" style={{ display: "block" }}>
            {missingOwnedRoles.length > 0
              ? `Missing owned roles: ${missingOwnedRoles.join(", ")}.`
              : `Select players for: ${missingRoles.join(", ")}.`}
          </div>
        )}
        {recommendations.length > 0 && (
          <div className="recommendations">
            <span>Recommended:</span>
            {recommendations.map((entry) => (
              <span key={entry.role}>
                {entry.role.toUpperCase()} → {entry.player.name} ({entry.player.cost})
              </span>
            ))}
            <button
              className="recommend-apply"
              type="button"
              onClick={() => {
                setDraftTeam((prev) => {
                  const next = { ...prev };
                  recommendations.forEach((entry) => {
                    next[entry.role] = entry.player;
                  });
                  return next;
                });
                setSelectedRole(null);
                setSelectedPlayer(null);
              }}
            >
              Apply recommended
            </button>
          </div>
        )}
      </div>
      <div className="button-container">
        <button
          className="btn return"
          onClick={() => {
            navigate("/");
          }}
        >
          <span>RETURN</span>
        </button>
        <button
          className="btn return"
          onClick={() => {
            navigate("/market");
          }}
        >
          <span>GO TO MARKET</span>
        </button>
        {activeLobby && user && (
          <button
            className="btn return"
            onClick={async () => {
              try {
                await apiFetch(`/api/lobbies/${activeLobby.lobby.id}/leave`, {
                  method: "POST",
                  body: JSON.stringify({ userId: user.id }),
                });
              } finally {
                navigate("/");
              }
            }}
          >
            <span>LEAVE LOBBY</span>
          </button>
        )}
        <button
          className={`btn confirm ${
            isLockedIn || missingRoles.length > 0 ? "disabled" : ""
          }`}
          onClick={() => !isLockedIn && setShowPopup(true)}
          disabled={isLockedIn || saving || missingRoles.length > 0}
        >
          <span>{saving ? "SAVING..." : "LOCK IN"}</span>
        </button>
      </div>


      {selectedRole && (
        <div className="modal-overlay">
          <div className="modal">
            <button className="close-btn" onClick={closeModal}>
              X
            </button>

            <div className="modal-header">{selectedRole.toUpperCase()}</div>

            <div className="modal-body">
              {playersData[selectedRole].length === 0 && (
                <p className="modal-empty">
                  No owned players for this role. Visit the market to buy one.
                </p>
              )}
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
                    {assignedBoosts.length > 0 ? (
                      <p className="boost-info">
                        BOOST:{" "}
                        {assignedBoosts
                          .map((boost) => {
                            const status =
                              boost.usesRemaining > 0 ? "ready" : "used";
                            return `${boost.boostType} (${boost.scope}) - ${status}`;
                          })
                          .join(", ")}
                      </p>
                    ) : (
                      <p className="boost-info">BOOST: none</p>
                    )}
                  </div>
                  {boosts && boosts.boosts.length > 0 && (
                    <div className="boost-button-container">
                      {boosts.boosts.map((boost) => (
                        <button
                          key={boost.id}
                          className={`btn confirm ${
                            boost.usesRemaining <= 0 ||
                            (boost.assignedPlayerId !== null &&
                              boost.assignedPlayerId !== selectedPlayer.id)
                              ? "boost-disabled"
                              : ""
                          }`}
                          onClick={() => handleAssignBoost(boost.boostType)}
                          disabled={
                            !user ||
                            isLockedIn ||
                            boost.usesRemaining <= 0 ||
                            (boost.assignedPlayerId !== null &&
                              boost.assignedPlayerId !== selectedPlayer.id)
                          }
                        >
                          <span>
                            {boost.boostType}
                            {boost.assignedPlayerId !== null &&
                            boost.assignedPlayerId !== selectedPlayer.id
                              ? " (assigned)"
                              : boost.usesRemaining <= 0
                                ? " (used)"
                                : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
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

function buildPlayersFromApi(response: CollectionResponse): PlayersDataResult {
  const mapped: PlayersData = {
    top: [],
    jungle: [],
    mid: [],
    adc: [],
    support: [],
  };
  const infoMap = new Map<number, UIPlayer>();

  const players = response.players ?? [];
  players.forEach((player) => {
    const displayName = player.nickname ?? player.name;
    const points = Math.max(20, Math.round(player.score));
    const cost = Math.max(10, Math.round(player.marketValue));
    const mappedPlayer: UIPlayer = {
      id: player.id,
      name: displayName,
      nickname: player.nickname,
      team: player.team.name,
      region: player.region.name,
      image: resolvePlayerImage(player.nickname ?? player.name),
      deckRole: player.role,
      points,
      cost,
      marketValue: player.marketValue,
      source: player,
    };
    infoMap.set(player.id, mappedPlayer);
    const key = Object.keys(ROLE_TO_DECK).find(
      (roleKey) => ROLE_TO_DECK[roleKey as RoleKey] === player.role
    ) as RoleKey | undefined;
    if (key) {
      mapped[key].push(mappedPlayer);
    }
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
      value: Math.max(10, Math.round(selection.marketValue)),
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
    if (card.playerId && !info) {
      next[key] = null;
      return;
    }
    next[key] = {
      id: card.playerId ?? -role.charCodeAt(0),
      name: info?.name ?? card.name,
      team: info?.team ?? "Current team",
      region: info?.region ?? "N/A",
      image: info?.image ?? resolvePlayerImage(card.name),
      deckRole: role,
      points: info?.points ?? card.points ?? 0,
      cost: info?.marketValue ?? card.value ?? 0,
      marketValue: info?.marketValue ?? card.value ?? 0,
      snapshot: info?.marketValue ? { ...card, value: info.marketValue } : card,
    };
  });
  return next;
}

function calculateDraftCost(draft: DraftTeam): number {
  return ROLE_KEYS.reduce((total, key) => total + (draft[key]?.cost ?? 0), 0);
}

