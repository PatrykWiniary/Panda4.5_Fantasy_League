import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/LogReg.css";
import homeIcon from "../assets/home.svg";
import userIcon from "../assets/user.svg";
import { useSession } from "../context/SessionContext";
import { resolveProfileAvatar, PROFILE_AVATAR_OPTIONS } from "../utils/profileAvatars";
import { apiFetch, ApiError } from "../api/client";
import type { ApiUser } from "../api/types";
import AvatarPicker from "./AvatarPicker";

export default function ProfilePage() {
  const { user, logout, setUser } = useSession();
  const [avatarChoice, setAvatarChoice] = useState(
    user?.avatar ?? PROFILE_AVATAR_OPTIONS[0]?.key ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setAvatarChoice(user?.avatar ?? PROFILE_AVATAR_OPTIONS[0]?.key ?? "");
  }, [user]);

  const handleSaveAvatar = async () => {
    if (!user) {
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const updated = await apiFetch<ApiUser>(`/api/users/${user.id}/avatar`, {
        method: "POST",
        body: JSON.stringify({ avatar: avatarChoice || null }),
      });
      setUser(updated);
      setStatus("Avatar updated.");
    } catch (error) {
      if (error instanceof ApiError) {
        const body = error.body as { error?: string; message?: string };
        setStatus(body?.message ?? "Unable to update avatar.");
      } else {
        setStatus("Unable to update avatar.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="login-container profile-page">
      <div className="page-icons">
        <Link to="/" className="page-icon home-icon">
          <img src={homeIcon} alt="Home" className="icon-image" />
        </Link>
        <div className="page-icon user-icon disabled-icon">
          <img src={userIcon} alt="Profile" className="icon-image" />
        </div>
      </div>

      {user ? (
        <div className="profile-card">
          <div className="profile-identity">
            <img
              src={resolveProfileAvatar(user.avatar)}
              alt="Avatar"
              className="profile-avatar"
            />
            <h2 className="player-name">{user.name}</h2>
            <p className="profile-meta">
              Score: {user.score ?? 0} | Gold: {user.currency}
            </p>
          </div>

          <AvatarPicker
            value={avatarChoice}
            onChange={setAvatarChoice}
            disabled={saving}
            title="Choose your profile icon"
          />

          <div className="profile-actions">
            <button
              className="login-button"
              type="button"
              onClick={handleSaveAvatar}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save avatar"}
            </button>
            <button className="login-button outline" type="button" onClick={logout}>
              Sign out
            </button>
          </div>

          {status && <p className="form-status">{status}</p>}
          <p className="profile-hint">
            Head to "Join new league" to draft your next roster.
          </p>
        </div>
      ) : (
        <div className="profile-card profile-empty-card">
          <h2 className="player-name">You are not signed in.</h2>
          <Link to="/login" className="homepage-button">
            Go to login
          </Link>
        </div>
      )}
    </div>
  );
}
