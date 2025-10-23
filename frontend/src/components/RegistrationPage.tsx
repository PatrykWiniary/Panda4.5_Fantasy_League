import { Link } from 'react-router-dom';
import '../styles/LogReg.css';

export default function RegistrationPage() {
  return (
      <div className="login-container">
      <h1 className="login-title login-title--main">SUMMONER'S LEAGUE</h1>
      <h2 className="login-title login-title--sub">SIGN UP</h2>

<div className="login-field">
  <input
    type="email"
    id="email"
    name="email"
    placeholder="EMAIL"
    className="login-input"
  />
</div>

<div className="login-field">
  <input
    type="text"
    id="username"
    name="username"
    placeholder="USERNAME"
    className="login-input"
  />
</div>

<div className="login-field">
  <input
    type="password"
    id="password"
    name="password"
    placeholder="PASSWORD"
    className="login-input"
  />
</div>
        <button type="submit" className="registration-button">SIGN UP</button>

        <div className="login-register">
         Already have an account?{' '}
          <Link to="/login" className="register-link">
            Sign in
          </Link>
        </div>

    </div>
  );
}
