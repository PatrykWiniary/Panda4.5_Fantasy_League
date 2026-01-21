import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/WaitingRoom.css";
import bg from "../assets/WaitingRoom/background.png";
import banners from "../assets/WaitingRoom/banners.png";
import { apiFetch, ApiError } from "../api/client";
import type { LobbyByUserResponse, LobbyResponse } from "../api/types";
import { useSession } from "../context/SessionContext";
import { resolveProfileAvatar } from "../utils/profileAvatars";

export default function WaitingRoomPage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [lobby, setLobby] = useState<LobbyResponse | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [navigated, setNavigated] = useState(false);
  const [tempSettings, setTempSettings] = useState({
    id: "",
    password: "",
    clearPassword: false,
    entryFee: 0,
    lobbyName: "",
  });

  useEffect(() => {
    if (!user) {
      setLobby(null);
      setStatus("Sign in to view your lobby.");
      return;
    }

    let canceled = false;

    const loadLobby = async () => {
      try {
        const response = await apiFetch<LobbyByUserResponse>("/api/lobbies");
        if (canceled) return;
        if (!response.lobby) {
          setLobby(null);
          setStatus("No active lobby yet.");
          return;
        }
        setLobby(response.lobby);
        setStatus(null);
      } catch (error) {
        if (canceled) return;
        if (error instanceof ApiError && error.status === 404) {
          setStatus("User not found.");
        } else {
          setStatus("Failed to load lobby.");
        }
      }
    };

    loadLobby();
    const interval = window.setInterval(loadLobby, 5000);

    return () => {
      canceled = true;
      window.clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    if (lobby?.lobby.status === "started" && !navigated) {
      setNavigated(true);
      navigate("/playerpick");
    }
  }, [lobby?.lobby.status, navigated, navigate]);

  const openSettings = () => {
    if (!lobby) return;
    setTempSettings({
      id: String(lobby.lobby.id),
      password: "",
      clearPassword: false,
      entryFee: lobby.lobby.entryFee ?? 0,
      lobbyName: lobby.lobby.name ?? "",
    });
    setShowSettings(true);
  };

  const closeSettings = () => {
    setShowSettings(false);
  };

  const saveSettings = async () => {
    if (!lobby || !user) return;
    try {
      const payload: {
        name: string;
        entryFee: number;
        password?: string;
      } = {
        name: tempSettings.lobbyName,
        entryFee: tempSettings.entryFee,
      };
      if (tempSettings.clearPassword) {
        payload.password = "";
      } else if (tempSettings.password.trim().length > 0) {
        payload.password = tempSettings.password;
      }
      const updated = await apiFetch<LobbyResponse>(
        `/api/lobbies/${lobby.lobby.id}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        }
      );
      setLobby(updated);
      setShowSettings(false);
      setStatus(null);
    } catch (error) {
      if (error instanceof ApiError) {
        const body = error.body as { error?: string; message?: string };
        setStatus(body?.message ?? body?.error ?? "Unable to update lobby.");
      } else {
        setStatus("Unable to update lobby.");
      }
    }
  };

  const handleLeaveLobby = async () => {
    if (!lobby || !user) {
      navigate("/");
      return;
    }
    try {
      await apiFetch(`/api/lobbies/${lobby.lobby.id}/leave`, {
        method: "POST",
      });
    } catch {
      /* ignore */
    } finally {
      navigate("/");
    }
  };

  const handleStartGame = () => {
    if (!lobby) return;
    if (lobby.lobby.status === "started") {
      if (isHost && lobby.lobby.allReady) {
        if (!user) return;
        apiFetch<{ match: unknown; lobby: LobbyResponse | null }>(
          `/api/lobbies/${lobby.lobby.id}/simulate`,
          {
            method: "POST",
          }
        )
          .then((payload) => {
            if (payload.lobby) {
              setLobby(payload.lobby);
            }
            setStatus("Match simulated. Scores updated.");
          })
          .catch((error) => {
            if (error instanceof ApiError) {
              const body = error.body as { error?: string; message?: string };
              setStatus(body?.message ?? body?.error ?? "Unable to simulate match.");
            } else {
              setStatus("Unable to simulate match.");
            }
          });
        return;
      }
      setNavigated(true);
      navigate("/playerpick");
      return;
    }
    if (!isHost || !user) return;
    apiFetch<LobbyResponse>(`/api/lobbies/${lobby.lobby.id}/start`, {
      method: "POST",
    })
      .then((updated) => {
        setLobby(updated);
        setStatus(null);
        setNavigated(true);
        navigate("/playerpick");
      })
      .catch((error) => {
        if (error instanceof ApiError) {
          const body = error.body as { error?: string; message?: string };
          setStatus(body?.message ?? body?.error ?? "Unable to start lobby.");
        } else {
          setStatus("Unable to start lobby.");
        }
      });
  };

  const players = lobby?.players ?? [];
  const maxPlayers = 5;
  const isHost = Boolean(lobby?.lobby.hostId && lobby?.lobby.hostId === user?.id);
  const isStarted = lobby?.lobby.status === "started";
  const allReady = Boolean(lobby?.lobby.allReady);
  const entryFee = lobby?.lobby.entryFee ?? 0;
  const totalPrize = entryFee * players.length;

  const playersRaw = lobby?.players ?? [];
  const hostId = lobby?.lobby.hostId;
  const passwordProtectedPreview = tempSettings.clearPassword
    ? false
    : tempSettings.password.trim().length > 0
      ? true
      : lobby?.lobby.passwordProtected ?? false;

  const playersOrdered = (() => {
    if (!hostId) return playersRaw;
    const host = playersRaw.find(p => p.id === hostId) ?? playersRaw.find(p => p.isHost);
    const rest = playersRaw.filter(p => p !== host);
    return host ? [host, ...rest] : playersRaw;
  })();

  const slotOrder = [3, 1, 2, 4, 5]; // idx 0 -> slot 3, idx 1 -> slot 1, itd.


  return (
    <div className="waiting-room-root">
      <img src={bg} alt="background" className="wr-background" />

      <div className="banner-strip" style={{ backgroundImage: `url(${banners})` }}>
        <div className="banner-slots">
          {slotOrder.map((slotNumber, idx) => {
            const player = playersOrdered[idx];
            const avatarSrc = player ? resolveProfileAvatar(player.avatar) : "";

            return (
              <div className="banner-slot" key={slotNumber} data-slot={slotNumber}>
                {player ? (
                  <div className="slot-content">
                    <div className={`avatar-wrap ${player.id === hostId ? "host" : ""}`}>
                      <img src={avatarSrc} alt={player.name} className="avatar-img" />
                    </div>
                    <div className="slot-name">{player.name}</div>
                  </div>
                ) : (
                  <div className="slot-content dots-wrap" aria-hidden="true">
                    <div className="dots">
                      <span className="dot" />
                      <span className="dot" />
                      <span className="dot" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {!showSettings && (
        <div className="total-prize-container">
          <div className="total-prize">TOTAL PRIZE: {totalPrize}$</div>
        </div>
      )}
      <div className="button-containerwr">
        <button className="btnwr" onClick={handleLeaveLobby}>
          <span>RETURN</span>
        </button>

        <button
          className={`btnwr ${!isHost ? "disabled" : ""}`}
          onClick={() => isHost && openSettings()}
          disabled={!isHost}
        >
          <span>SETTINGS</span>
        </button>

        <button
          className={`btnwr  ${!isHost && !isStarted ? "disabled" : ""}`}
          onClick={handleStartGame}
          disabled={!isHost && !isStarted}
        >
          <span>{isStarted && isHost && allReady ? "SIMULATE" : isStarted ? "DRAFT" : "START"}</span>
        </button>
      </div>
      {showSettings && (
        <div className="settings-overlay">
          <div className="settings-modal">
            <div className="settings-header">
              <div className="settings-actions">
                <button className="settings-btn small" onClick={saveSettings}>
                  <span>OK</span>
                </button>
                <button className="settings-btn small" onClick={closeSettings}>
                  <span>X</span>
                </button>
              </div>
            </div>

            <div className="settings-group">
              <label>ID</label>
              <div className="settings-row">
                <input
                  type="text"
                  value={tempSettings.id}
                  readOnly
                  onChange={(e) =>
                    setTempSettings({ ...tempSettings, id: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="settings-group">
              <label>PASSWORD</label>
              <div className="settings-row">
                <input
                  value={tempSettings.password}
                  type="password"
                  placeholder={
                    passwordProtectedPreview
                      ? "Password set (enter to change)"
                      : "Set new password"
                  }
                  onChange={(e) =>
                    setTempSettings({
                      ...tempSettings,
                      password: e.target.value,
                      clearPassword: false,
                    })
                  }
                />
              </div>
              <div className="settings-row">
                <button
                  type="button"
                  className="settings-btn clear-password-btn"
                  onClick={() =>
                    setTempSettings({
                      ...tempSettings,
                      clearPassword: true,
                      password: "",
                    })
                  }
                >
                  CLEAR PASSWORD
                </button>
              </div>
            </div>

            <div className="settings-group">
              <label>ENTRY FEE</label>
              <div className="settings-row">
                <input
                  type="number"
                  value={tempSettings.entryFee}
                  min={0}
                  onChange={(e) =>
                    setTempSettings({
                      ...tempSettings,
                      entryFee: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="settings-group">
              <label>LOBBY'S NAME</label>
              <div className="settings-row">
                <input
                  type="text"
                  value={tempSettings.lobbyName}
                  onChange={(e) =>
                    setTempSettings({ ...tempSettings, lobbyName: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {status && <p className="form-status">{status}</p>}
    </div>
  );
}
