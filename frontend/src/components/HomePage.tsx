import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/HomePage.css";
import homeIcon from "../assets/home.svg";
import userIcon from "../assets/user.svg";
import { apiFetch } from "../api/client";
import type { LobbyByUserResponse } from "../api/types";
import { useSession } from "../context/SessionContext";

export default function HomePage() {
  const { user } = useSession();
  const [fadeOut, setFadeOut] = useState(false);
  const [activeLobby, setActiveLobby] = useState<LobbyByUserResponse["lobby"] | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const navigate = useNavigate();
  const onboardingSteps = [
    {
      title: "Build your roster",
      body: "Buy players in Market, then pick a full team in PlayerPick.",
    },
    {
      title: "Transfers & prices",
      body: "Prices move with recent matches. Transfers are limited per tournament stage.",
    },
    {
      title: "Boosts",
      body: "Assign boosts to a single player for match or tournament bonuses.",
    },
    {
      title: "Match feedback",
      body: "After simulations, check the market movers to see who spiked or dipped.",
    },
  ];

  const handleLinkClick = (e: MouseEvent<HTMLAnchorElement>, to: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) {
      return;
    }
    e.preventDefault();
    setFadeOut(true);
    setTimeout(() => {
      navigate(to);
    }, 700);
  };

  const hasOngoingLeague = Boolean(user);
  const hasLobby = Boolean(activeLobby);
  const lobbyStarted = activeLobby?.lobby.status === "started";

  useEffect(() => {
    if (!user) {
      setActiveLobby(null);
      return;
    }
    let canceled = false;
    apiFetch<LobbyByUserResponse>(`/api/lobbies?userId=${user.id}`)
      .then((payload) => {
        if (!canceled) {
          setActiveLobby(payload.lobby);
        }
      })
      .catch(() => {
        if (!canceled) {
          setActiveLobby(null);
        }
      });
    return () => {
      canceled = true;
    };
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const key = "fantasy-league.onboarding.v1";
    const seen = window.localStorage.getItem(key);
    if (!seen) {
      setShowOnboarding(true);
    }
  }, []);

  return (
    <div className={`homepage ${fadeOut ? "fade-out" : "fade-in"}`}>
      <div className="page-icons">
        <div className="page-icon home-icon disabled-icon">
          <img src={homeIcon} alt="Home (disabled)" className="icon-image" />
        </div>
        <Link
          to="/profile"
          className="page-icon user-icon"
          onClick={(e) => handleLinkClick(e, "/profile")}
        >
          <img src={userIcon} alt="Profile" className="icon-image" />
        </Link>
      </div>

      <h1 className="homepage-title">SUMMONER’S LEAGUE</h1>
      <p className="homepage-subtitle">
        {user ? `Welcome back, ${user.name}!` : "Sign in to manage your roster."}
      </p>

      <div className="homepage-buttons">
        <Link
          to={hasOngoingLeague ? "/ongleague" : "#"}
          className={`homepage-button ${!hasOngoingLeague ? "disabled" : ""}`}
          onClick={(e) =>
            hasOngoingLeague && handleLinkClick(e, "/ongleague")
          }
        >
          ONGOING LEAGUE
        </Link>
        {hasLobby && (
          <Link
            to={lobbyStarted ? "/playerpick" : "/waitingroom"}
            className="homepage-button"
          >
            {lobbyStarted ? "RETURN TO DRAFT" : "WAITING ROOM"}
          </Link>
        )}
        <Link to="/createnewleague" className="homepage-button">
          CREATE NEW LOBBY
        </Link>

        <Link to="/joinnewleague" className="homepage-button">
          JOIN LOBBY
        </Link>



        <Link
          to="/leaderboard"
          className="homepage-button"
          onClick={(e) => handleLinkClick(e, "/leaderboard")}
        >
          LEADERBOARD
        </Link>

        <Link
          to="/matches"
          className="homepage-button"
          onClick={(e) => handleLinkClick(e, "/matches")}
        >
          MATCH HISTORY
        </Link>

        <Link
          to="/market"
          className="homepage-button"
          onClick={(e) => handleLinkClick(e, "/market")}
        >
          MARKET & TRANSFERS
        </Link>

        <Link
          to="/tournament"
          className="homepage-button"
          onClick={(e) => handleLinkClick(e, "/tournament")}
        >
          TOURNAMENT CONTROL
        </Link>
        
        <Link to="/login" className="homepage-button">
          SIGN OUT
        </Link>
      </div>

      {showOnboarding && (
        <div className="onboarding-overlay">
          <div className="onboarding-card">
            <h2>{onboardingSteps[onboardingStep].title}</h2>
            <p>{onboardingSteps[onboardingStep].body}</p>
            <div className="onboarding-dots">
              {onboardingSteps.map((_, index) => (
                <span
                  key={index}
                  className={index === onboardingStep ? "active" : ""}
                />
              ))}
            </div>
            <div className="onboarding-actions">
              <button
                className="homepage-button outline"
                onClick={() => {
                  setShowOnboarding(false);
                  window.localStorage.setItem("fantasy-league.onboarding.v1", "1");
                }}
              >
                Skip
              </button>
              <div className="onboarding-nav">
                <button
                  className="homepage-button outline"
                  onClick={() =>
                    setOnboardingStep((prev) => Math.max(0, prev - 1))
                  }
                  disabled={onboardingStep === 0}
                >
                  Back
                </button>
                <button
                  className="homepage-button"
                  onClick={() => {
                    if (onboardingStep === onboardingSteps.length - 1) {
                      setShowOnboarding(false);
                      window.localStorage.setItem(
                        "fantasy-league.onboarding.v1",
                        "1"
                      );
                    } else {
                      setOnboardingStep((prev) => prev + 1);
                    }
                  }}
                >
                  {onboardingStep === onboardingSteps.length - 1 ? "Done" : "Next"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
