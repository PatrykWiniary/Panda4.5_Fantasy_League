import LoginPage from "./components/LoginPage";
import RegistrationPage from "./components/RegistrationPage";
import HomePage from "./components/HomePage";
import ProfilePage from "./components/ProfilePage";
import OngLeaguePage from "./components/OngLeague";
import CreateNewLeaguePage from "./components/CreateNewLeague";
import JoinNewLeaguePage from "./components/JoinNewLeague";
import PlayerPick from "./components/PlayerPick";
import LeaderboardPage from "./components/LeaderboardPage";
import MatchHistoryPage from "./components/MatchHistoryPage";
import TournamentPage from "./components/TournamentPage";
import PageTransition from "./components/PageTransition";
import WaitingRoom from "./components/WaitingRoom";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { SessionProvider, useSession } from "./context/SessionContext";
import MarketPage from "./components/MarketPage";

function RequireAuth() {
  const { user, ready } = useSession();
  if (!ready) {
    return null;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PageTransition />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/registration" element={<RegistrationPage />} />
            <Route element={<RequireAuth />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/ongleague" element={<OngLeaguePage />} />
              <Route path="/createnewleague" element={<CreateNewLeaguePage />} />
              <Route path="/joinnewleague" element={<JoinNewLeaguePage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/matches" element={<MatchHistoryPage />} />
              <Route path="/tournament" element={<TournamentPage />} />
              <Route path="/waitingroom" element={<WaitingRoom />} />
              <Route path="/playerpick" element={<PlayerPick />} />
              <Route path="/market" element={<MarketPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}
