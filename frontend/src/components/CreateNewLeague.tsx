import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/LogReg.css";
import homeIcon from "../assets/home.svg";
import userIcon from "../assets/user.svg";
import { apiFetch, ApiError } from "../api/client";
import type { LobbyResponse } from "../api/types";
import { useSession } from "../context/SessionContext";

export default function CreateNewLeaguePage() {
  const navigate = useNavigate();
  const { user, setUser } = useSession();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [entryFee, setEntryFee] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      setStatus("Sign in to create a lobby.");
      return;
    }

    const parsedEntryFee = Number(entryFee);
    if (Number.isNaN(parsedEntryFee) || parsedEntryFee < 0) {
      setStatus("Entry fee must be a non-negative number.");
      return;
    }

    setSubmitting(true);
    setStatus(null);
    try {
      await apiFetch<LobbyResponse>("/api/lobbies", {
        method: "POST",
        body: JSON.stringify({
          name,
          password,
          entryFee: parsedEntryFee,
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
        setStatus(body?.message ?? body?.error ?? "Unable to create lobby.");
      } else {
        setStatus("Unable to create lobby.");
      }
    } finally {
      setSubmitting(false);
    }
  };

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
        <h1 className="login-title login-title--main">CREATE LOBBY</h1>
        <h2 className="login-title login-title--sub">SETTINGS</h2>

        <input
          type="text"
          placeholder="LOBBY NAME"
          className="login-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="PASSWORD (OPTIONAL)"
          className="login-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          type="number"
          placeholder="ENTRY FEE"
          className="login-input"
          min={0}
          value={entryFee}
          onChange={(event) => setEntryFee(event.target.value)}
        />

        <div className="login-actions">
          <button className="login-button" disabled={submitting}>
            {submitting ? "Creating..." : "CREATE LOBBY"}
          </button>
        </div>

        {status && <p className="form-status">{status}</p>}
      </form>
    </div>
  );
}
