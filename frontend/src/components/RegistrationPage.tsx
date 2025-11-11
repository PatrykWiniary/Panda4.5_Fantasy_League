import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/LogReg.css";
import homeIcon from "../assets/home.svg";
import userIcon from "../assets/user.svg";
import { apiFetch, ApiError } from "../api/client";
import type { ApiUser } from "../api/types";
import { useSession } from "../context/SessionContext";

export default function RegistrationPage() {
  const navigate = useNavigate();
  const { setUser } = useSession();
  const [mail, setMail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [currency, setCurrency] = useState("150");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);
    try {
      const payload = {
        name,
        mail,
        password,
        currency: Number(currency) || 0,
      };
      const user = await apiFetch<ApiUser>("/api/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setUser(user);
      setStatus("Account created successfully.");
      navigate("/profile");
    } catch (error) {
      if (error instanceof ApiError) {
        const body = error.body as { error?: string; message?: string };
        setStatus(body?.message ?? "Unable to create account.");
      } else {
        setStatus("Unable to create account.");
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
        <h2 className="login-title login-title--sub">SIGN UP</h2>

        <input
          type="text"
          placeholder="USERNAME"
          className="login-input"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <input
          type="email"
          placeholder="EMAIL"
          className="login-input"
          autoComplete="email"
          value={mail}
          onChange={(event) => setMail(event.target.value)}
          required
        />
        <input
          type="password"
          placeholder="PASSWORD"
          className="login-input"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <input
          type="number"
          min={0}
          placeholder="STARTING GOLD"
          className="login-input"
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
        />

        <div className="login-actions">
          <button type="submit" className="login-button" disabled={submitting}>
            {submitting ? "Creating..." : "SIGN UP"}
          </button>
        </div>

        {status && <p className="form-status">{status}</p>}

        <div className="login-register">
          Already have an account?{" "}
          <Link to="/login" className="register-link">
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
