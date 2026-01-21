import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { ApiUser } from "../api/types";
import { apiFetch } from "../api/client";

const TOKEN_STORAGE_KEY = "fantasy-league.authToken";

type SessionContextValue = {
  user: ApiUser | null;
  setUser: (user: ApiUser | null) => void;
  setSession: (user: ApiUser, token: string) => void;
  logout: () => void;
  ready: boolean;
};

const SessionContext = createContext<SessionContextValue | undefined>(
  undefined
);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<ApiUser | null>(null);
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  });

  const setUser = useCallback((next: ApiUser | null) => {
    setUserState(next);
  }, []);

  const setSession = useCallback(
    (nextUser: ApiUser, nextToken: string) => {
      setUserState(nextUser);
      setToken(nextToken);
      if (typeof window === "undefined") {
        return;
      }
      try {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
      } catch {
        /* ignore */
      }
    },
    []
  );

  const logout = useCallback(() => {
    if (token) {
      apiFetch("/api/logout", { method: "POST", parseJson: false }).catch(() => {
        /* ignore */
      });
    }
    setUserState(null);
    setToken(null);
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setReady(true);
      return;
    }
    let canceled = false;
    apiFetch<ApiUser>("/api/me")
      .then((payload) => {
        if (!canceled) {
          setUserState(payload);
        }
      })
      .catch(() => {
        if (!canceled) {
          setToken(null);
          setUserState(null);
          try {
            window.localStorage.removeItem(TOKEN_STORAGE_KEY);
          } catch {
            /* ignore */
          }
        }
      })
      .finally(() => {
        if (!canceled) {
          setReady(true);
        }
      });
    return () => {
      canceled = true;
    };
  }, [token]);

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      setUser,
      setSession,
      logout,
      ready,
    }),
    [user, setUser, setSession, logout, ready]
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
