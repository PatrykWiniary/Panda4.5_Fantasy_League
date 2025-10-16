import { Link } from 'react-router-dom';
import '../styles/RegistrationPage.css';

export default function RegistrationPage() {
  return (
    <div className="login-container">
      <form className="login-form">
        <h2 className="login-title">Zarejestruj się</h2>

        <div className="login-field">
          <label htmlFor="username" className="login-label">Nazwa użytkownika</label>
          <input
            type="text"
            id="username"
            name="username"
            placeholder="Wpisz nazwę użytkownika"
            className="login-input"
          />
        </div>

        <div className="login-field">
          <label htmlFor="email" className="login-label">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            placeholder="Wpisz adres email"
            className="login-input"
          />
        </div>

        <div className="login-field">
          <label htmlFor="password" className="login-label">Hasło</label>
          <input
            type="password"
            id="password"
            name="password"
            placeholder="Wpisz hasło"
            className="login-input"
          />
        </div>

        <div className="login-field">
          <label htmlFor="confirmPassword" className="login-label">Potwierdź hasło</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            placeholder="Powtórz hasło"
            className="login-input"
          />
        </div>

        <button type="submit" className="login-button">Zarejestruj się</button>

        <div className="login-register">
          Masz już konto?{' '}
          <Link to="/login" className="register-link">
            Zaloguj się
          </Link>
        </div>
      </form>
    </div>
  );
}
