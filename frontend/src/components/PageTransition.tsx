import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

export default function PageTransition() {
  const location = useLocation();
  const navigate = useNavigate();
  const [transitionStage, setTransitionStage] = useState("fade-in");
  const [nextPath, setNextPath] = useState<string | null>(null);

  // Funkcja blokująca scroll
  const blockScroll = () => {
    document.body.style.overflow = "hidden";
  };

  const unblockScroll = () => {
    document.body.style.overflow = "";
  };

  // Obsługa kliknięć linków <a>
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
      blockScroll(); // blokujemy scroll podczas fade-out
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [location.pathname]);

  // Po fade-out przejdź na nową stronę
  useEffect(() => {
    if (transitionStage === "fade-out" && nextPath) {
      const timeout = setTimeout(() => {
        navigate(nextPath);
        setNextPath(null);
        setTransitionStage("fade-in");
        // Po zakończeniu fade-in odblokuj scroll
        setTimeout(() => unblockScroll(), 600);
      }, 600);
      return () => clearTimeout(timeout);
    }
  }, [transitionStage, nextPath, navigate]);

  // Przy zmianie lokalizacji (np. back button)
  useEffect(() => {
    setTransitionStage("fade-in");
    // Odblokuj scroll jeśli ktoś wraca np. przycisk wstecz
    unblockScroll();
  }, [location.pathname]);

  const styles = `
    .page-transition {
      position: relative;
      width: 100%;
      min-height: 100%;
      transition: opacity 0.6s ease;
    }

    .page-transition.fade-in {
      opacity: 1;
    }

    .page-transition.fade-out {
      opacity: 0;
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
