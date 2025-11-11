import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { ApiUser } from "../api/types";

const LOCAL_STORAGE_KEY = "fantasy-league.loggedUser";

type SessionContextValue = {
  user: ApiUser | null;
  setUser: (user: ApiUser | null) => void;
  logout: () => void;
};

const SessionContext = createContext<SessionContextValue | undefined>(
  undefined
);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<ApiUser | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as ApiUser) : null;
    } catch {
      return null;
    }
  });

  const setUser = useCallback((next: ApiUser | null) => {
    setUserState(next);
    if (typeof window === "undefined") {
      return;
    }
    try {
      if (next) {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
      } else {
        window.localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, [setUser]);

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      setUser,
      logout,
    }),
    [user, setUser, logout]
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return ctx;
}
