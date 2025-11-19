import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/LogReg.css";
import homeIcon from "../assets/home.svg";
import userIcon from "../assets/user.svg";
import { apiFetch, ApiError } from "../api/client";
import type { ApiUser } from "../api/types";
import { useSession } from "../context/SessionContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useSession();
  const [mail, setMail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!mail || !password) {
      setStatus("Provide both email and password.");
      return;
    }
    setSubmitting(true);
    setStatus(null);
    try {
      const user = await apiFetch<ApiUser>("/api/login", {
        method: "POST",
        body: JSON.stringify({ mail, password }),
      });
      setUser(user);
      setStatus("Signed in successfully.");
      navigate("/profile");
    } catch (error) {
      if (error instanceof ApiError) {
        const body = error.body as { error?: string; message?: string };
        setStatus(body?.message ?? "Unable to sign in.");
      } else {
        setStatus("Unable to sign in.");
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
        <div className="page-icon user-icon disabled-icon">
          <img src={userIcon} alt="Profile" className="icon-image" />
        </div>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        <h1 className="login-title login-title--main">SUMMONER'S LEAGUE</h1>
        <h2 className="login-title login-title--sub">SIGN IN</h2>

        <input
          type="email"
          placeholder="EMAIL"
          className="login-input"
          autoComplete="username"
          value={mail}
          onChange={(event) => setMail(event.target.value)}
          required
        />
        <input
          type="password"
          placeholder="PASSWORD"
          className="login-input"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <div className="login-actions">
          <button className="login-button" disabled={submitting}>
            {submitting ? "Signing in..." : "SIGN IN"}
          </button>
        </div>

        {status && <p className="form-status">{status}</p>}

        <div className="login-register">
          <Link to="/registration" className="register-link">
            Create account
          </Link>
        </div>
      </form>
    </div>
  );
}
