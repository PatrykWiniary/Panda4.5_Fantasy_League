import { Link } from "react-router-dom";
import "../styles/LogReg.css";
import homeIcon from "../assets/home.svg";
import userIcon from "../assets/user.svg";

export default function CreateNewLeaguePage() {
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

      <div className="login-form">
        <h1 className="login-title login-title--main">CREATE LEAGUE</h1>
        <p className="profile-hint">
          League management is coming soon. In the meantime head to "Join new
          league" to draft a roster using live data from the backend.
        </p>
      </div>
    </div>
  );
}
