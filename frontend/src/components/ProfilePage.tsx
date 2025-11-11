import { Link } from "react-router-dom";
import "../styles/LogReg.css";
import homeIcon from "../assets/home.svg";
import userIcon from "../assets/user.svg";
import avatarIcon from "../assets/user.svg";
import { useSession } from "../context/SessionContext";

export default function ProfilePage() {
  const { user, logout } = useSession();

  return (
    <div className="profile-page">
      <div className="page-icons">
        <Link to="/" className="page-icon home-icon">
          <img src={homeIcon} alt="Home" className="icon-image" />
        </Link>
        <div className="page-icon user-icon disabled-icon">
          <img src={userIcon} alt="Profile" className="icon-image" />
        </div>
      </div>

      {user ? (
        <>
          <div className="profile-header">
            <img src={avatarIcon} alt="Avatar" className="profile-avatar" />
            <h2 className="player-name">{user.name}</h2>
            <p className="profile-meta">
              Score: {user.score ?? 0} • Gold: {user.currency}
            </p>
            <button className="login-button" onClick={logout}>
              Sign out
            </button>
          </div>
          <p className="profile-hint">
            Head to “Join new league” to draft your next roster.
          </p>
        </>
      ) : (
        <div className="profile-empty">
          <h2>You are not signed in.</h2>
          <Link to="/login" className="homepage-button">
            Go to login
          </Link>
        </div>
      )}
    </div>
  );
}
