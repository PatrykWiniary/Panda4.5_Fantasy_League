import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/LogReg.css";
import homeIcon from "../assets/home.svg";
import userIcon from "../assets/user.svg";
import { apiFetch, ApiError } from "../api/client";
import type { LobbyListEntry, LobbyListResponse, LobbyResponse } from "../api/types";
import { useSession } from "../context/SessionContext";

export default function JoinNewLeaguePage() {
  const navigate = useNavigate();
  const { user, setUser } = useSession();
  const [lobbyId, setLobbyId] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [lobbies, setLobbies] = useState<LobbyListEntry[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      setStatus("Sign in to join a lobby.");
      return;
    }
    const parsedLobbyId = Number(lobbyId);
    if (!Number.isInteger(parsedLobbyId) || parsedLobbyId <= 0) {
      setStatus("Provide a valid lobby ID.");
      return;
    }
    setSubmitting(true);
    setStatus(null);
    try {
      await apiFetch<LobbyResponse>(`/api/lobbies/${parsedLobbyId}/join`, {
        method: "POST",
        body: JSON.stringify({
          password,
        }),
      });
      navigate("/waitingroom");
    } catch (error) {
      if (error instanceof ApiError) {
        const body = error.body as { error?: string; message?: string };
        if (error.status === 404 && body?.error === "USER_NOT_FOUND") {
          setUser(null);
          setStatus("Session expired. Sign in again.");
          navigate("/login");
          return;
        }
        setStatus(body?.message ?? body?.error ?? "Unable to join lobby.");
      } else {
        setStatus("Unable to join lobby.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    let canceled = false;
    setLoadingList(true);
    const timer = window.setTimeout(() => {
      apiFetch<LobbyListResponse>(
        `/api/lobbies/list?openOnly=1${search.trim().length > 0 ? `&q=${encodeURIComponent(search.trim())}` : ""}`
      )
        .then((payload) => {
          if (!canceled) {
            setLobbies(payload.lobbies);
          }
        })
        .catch(() => {
          if (!canceled) {
            setLobbies([]);
          }
        })
        .finally(() => {
          if (!canceled) {
            setLoadingList(false);
          }
        });
    }, 250);
    return () => {
      canceled = true;
      window.clearTimeout(timer);
    };
  }, [search]);

  return (
    <div className="login-container">
      <div className="page-icons">
        <Link to="/" className="page-icon home-icon">
          <img src={homeIcon} alt="Home" className="icon-image" />
        </Link>
        <Link to="/profile" className="page-icon user-icon">
          <img src={userIcon} alt="Profile" className="icon-image" />
        </Link>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        <h1 className="login-title login-title--main">JOIN LOBBY</h1>
        <h2 className="login-title login-title--sub">ENTER ID</h2>

        <input
          type="number"
          placeholder="LOBBY ID"
          className="login-input"
          min={1}
          value={lobbyId}
          onChange={(event) => setLobbyId(event.target.value)}
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="PASSWORD (OPTIONAL)"
          className="login-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="login-actions">
          <button className="login-button" disabled={submitting}>
            {submitting ? "Joining..." : "JOIN LOBBY"}
          </button>
        </div>

        {status && <p className="form-status">{status}</p>}
      </form>

      <div className="lobby-list">
        <h2 className="login-title login-title--sub">LOBBY LIST</h2>
        <input
          type="text"
          placeholder="SEARCH BY NAME"
          className="login-input lobby-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {loadingList ? (
          <p className="form-status">Loading lobbies...</p>
        ) : lobbies.length === 0 ? (
          <p className="form-status">No lobbies found.</p>
        ) : (
          <div className="lobby-list-items">
            {lobbies.map((entry) => (
              <button
                type="button"
                key={entry.id}
                className="lobby-list-item"
                onClick={() => {
                  setLobbyId(String(entry.id));
                  setPassword("");
                }}
              >
                <div className="lobby-list-main">
                  <span className="lobby-list-name">{entry.name}</span>
                  <span className="lobby-list-id">#{entry.id}</span>
                </div>
                <div className="lobby-list-meta">
                  <span>{entry.playerCount}/5 players</span>
                  <span>Entry: {entry.entryFee}</span>
                  <span className={entry.passwordProtected ? "locked" : "open"}>
                    {entry.passwordProtected ? "LOCKED" : "OPEN"}
                  </span>
                  <span className={entry.status === "started" ? "started" : "waiting"}>
                    {entry.status === "started" ? "STARTED" : "WAITING"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
