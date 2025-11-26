import { useEffect, useState } from "react";
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
      }, 600);
      return () => clearTimeout(timeout);
    }
  }, [transitionStage, nextPath, navigate]);

  // przy zmianie lokalizacji (np. wstecz)
  useEffect(() => {
    setTransitionStage("fade-in");
  }, [location.pathname]);

  // STYLE bezpośrednio w komponencie
  const styles = `
    .page-transition {
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;        /* BLOKUJE scroll */
      z-index: 999999;         /* nad całą stroną */
      pointer-events: none;    /* nie blokuje kliknięć */
    }

    .page-transition * {
      pointer-events: auto;    /* ale wnętrze można klikać */
    }

    .page-transition.fade-in {
      opacity: 1;
      transition: opacity 0.6s ease;
    }

    .page-transition.fade-out {
      opacity: 0;
      transition: opacity 0.6s ease;
    }
  `;

  return (
    <>
      <style>{styles}</style>

      <div className={`page-transition ${transitionStage}`}>
        <Outlet />
      </div>
    </>
  );
}
