import LoginPage from "./components/LoginPage";
import RegistrationPage from "./components/RegistrationPage";
import HomePage from "./components/HomePage";
import ProfilePage from "./components/ProfilePage";
import OngLeaguePage from "./components/OngLeague";
import CreateNewLeaguePage from "./components/CreateNewLeague";
import JoinNewLeaguePage from "./components/JoinNewLeague";
import PageTransition from "./components/PageTransition";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SessionProvider } from "./context/SessionContext";

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PageTransition />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/registration" element={<RegistrationPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/ongleague" element={<OngLeaguePage />} />
            <Route path="/createnewleague" element={<CreateNewLeaguePage />} />
            <Route path="/joinnewleague" element={<JoinNewLeaguePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}
