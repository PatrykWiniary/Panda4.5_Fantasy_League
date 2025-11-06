import React, { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

export default function PageTransition() {
  const location = useLocation();
  const navigate = useNavigate();
  const [transitionStage, setTransitionStage] = useState("fade-in");
  const [nextPath, setNextPath] = useState<string | null>(null);

  // Kliknięcia linków <a>
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("http")) return;
      if (href === location.pathname) return;

      e.preventDefault();
      setNextPath(href);
      setTransitionStage("fade-out");
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [location.pathname]);

  // po fade-out przejdź na nową stronę
  useEffect(() => {
    if (transitionStage === "fade-out" && nextPath) {
      const timeout = setTimeout(() => {
        navigate(nextPath);
        setNextPath(null);
        setTransitionStage("fade-in");
      }, 600); // czas musi pasować do CSS
      return () => clearTimeout(timeout);
    }
  }, [transitionStage, nextPath, navigate]);

  // przy zmianie lokalizacji (np. wstecz)
  useEffect(() => {
    setTransitionStage("fade-in");
  }, [location.pathname]);

  return (
    <div className={`page-transition ${transitionStage}`}>
      <Outlet />
    </div>
  );
}
