import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/MarketPage.css";
import homeIcon from "../assets/home.svg";
import userIcon from "../assets/user.svg";
import { apiFetch, ApiError } from "../api/client";
import type {
  CollectionResponse,
  MarketBuyResponse,
  MarketSellResponse,
  MarketPlayersResponse,
  DeckRole,
  DeckResponse,
  LeaderboardResponse,
  TransferHistoryResponse,
  TransferStateResponse,
} from "../api/types";
import { useSession } from "../context/SessionContext";
import { resolvePlayerImage } from "../utils/playerImages";

type StatusState = {
  type: "success" | "error";
  message: string;
} | null;

const REQUIRED_ROLES: DeckRole[] = ["Top", "Jgl", "Mid", "Adc", "Supp"];

export default function MarketPage() {
  const { user, setUser } = useSession();
  const [market, setMarket] = useState<MarketPlayersResponse | null>(null);
  const [transferState, setTransferState] = useState<TransferStateResponse | null>(null);
  const [history, setHistory] = useState<TransferHistoryResponse | null>(null);
  const [collection, setCollection] = useState<CollectionResponse | null>(null);
  const [deck, setDeck] = useState<DeckResponse["deck"] | null>(null);
  const [status, setStatus] = useState<StatusState>(null);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [sellingId, setSellingId] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<
    "price" | "name" | "role" | "trend" | "score"
  >("price");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [roleFilter, setRoleFilter] = useState<DeckRole | "all">("all");
  const [regionFilter, setRegionFilter] = useState<number | "all">("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<
    "all" | "affordable" | "owned"
  >("all");

  const resetFilters = () => {
    setSortKey("price");
    setSortDir("desc");
    setRoleFilter("all");
    setRegionFilter("all");
    setAvailabilityFilter("all");
  };

  const refreshUserMarketState = async (userId: number) => {
    const [transferPayload, historyPayload, collectionPayload] = await Promise.all([
      apiFetch<TransferStateResponse>(`/api/market/transfer-state?userId=${userId}`),
      apiFetch<TransferHistoryResponse>(`/api/market/history?userId=${userId}&limit=20`),
      apiFetch<CollectionResponse>(`/api/collection?userId=${userId}`),
    ]);
    setTransferState(transferPayload);
    setHistory(historyPayload);
    setCollection(collectionPayload);
    if (user && transferPayload.currency !== user.currency) {
      setUser({ ...user, currency: transferPayload.currency });
    }
  };

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    Promise.all([
      apiFetch<MarketPlayersResponse>("/api/market/players"),
      user ? apiFetch<TransferStateResponse>(`/api/market/transfer-state?userId=${user.id}`) : Promise.resolve(null),
      user ? apiFetch<TransferHistoryResponse>(`/api/market/history?userId=${user.id}&limit=20`) : Promise.resolve(null),
      user ? apiFetch<CollectionResponse>(`/api/collection?userId=${user.id}`) : Promise.resolve(null),
      user
        ? apiFetch<DeckResponse>(`/api/decks/${user.id}`).catch(() => null)
        : Promise.resolve(null),
      user
        ? apiFetch<LeaderboardResponse>(`/api/users/leaderboard?userId=${user.id}&mode=global`).catch(() => null)
        : Promise.resolve(null),
    ])
      .then(
        ([
          marketPayload,
          transferPayload,
          historyPayload,
          collectionPayload,
          deckPayload,
          leaderboardPayload,
        ]) => {
        if (canceled) return;
        setMarket(marketPayload);
        setTransferState(transferPayload);
        setHistory(historyPayload);
        setCollection(collectionPayload);
        setDeck(deckPayload?.deck ?? null);
        if (user && transferPayload && transferPayload.currency !== user.currency) {
          setUser({ ...user, currency: transferPayload.currency });
        }
        const userEntry = leaderboardPayload?.userEntry ?? null;
        if (user && userEntry && user.currency !== userEntry.currency) {
          setUser({ ...user, currency: userEntry.currency });
        }
      })
      .catch(() => {
        if (!canceled) {
          setStatus({ type: "error", message: "Failed to load market data." });
        }
      })
      .finally(() => {
        if (!canceled) {
          setLoading(false);
        }
      });
    return () => {
      canceled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const raw = window.localStorage.getItem("fantasy-market.filters.v1");
    if (!raw) {
      return;
    }
    try {
      const saved = JSON.parse(raw) as {
        sortKey?: typeof sortKey;
        sortDir?: typeof sortDir;
        roleFilter?: typeof roleFilter;
        regionFilter?: typeof regionFilter;
        availabilityFilter?: typeof availabilityFilter;
      };
      if (saved.sortKey) setSortKey(saved.sortKey);
      if (saved.sortDir) setSortDir(saved.sortDir);
      if (saved.roleFilter) setRoleFilter(saved.roleFilter);
      if (saved.regionFilter !== undefined) setRegionFilter(saved.regionFilter);
      if (saved.availabilityFilter) setAvailabilityFilter(saved.availabilityFilter);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      "fantasy-market.filters.v1",
      JSON.stringify({
        sortKey,
        sortDir,
        roleFilter,
        regionFilter,
        availabilityFilter,
      })
    );
  }, [sortKey, sortDir, roleFilter, regionFilter, availabilityFilter]);

  const ownedIds = useMemo(
    () => new Set(collection?.players.map((player) => player.id) ?? []),
    [collection]
  );

  const wallet = transferState?.currency ?? user?.currency ?? 0;
  const transferFee = transferState?.transferFeePerCard ?? 0;
  const missingRoles = useMemo(() => {
    if (!collection) {
      return [];
    }
    const ownedRoles = new Set(collection.players.map((player) => player.role));
    return REQUIRED_ROLES.filter((role) => !ownedRoles.has(role));
  }, [collection]);

  const regionOptions = useMemo(() => {
    if (!market) return [];
    const map = new Map<number, string>();
    market.players.forEach((player) => {
      map.set(player.region.id, player.region.name);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [market]);

  const filteredPlayers = useMemo(() => {
    if (!market) return [];
    return market.players.filter((player) => {
      if (roleFilter !== "all" && player.role !== roleFilter) {
        return false;
      }
      if (regionFilter !== "all" && player.region.id !== regionFilter) {
        return false;
      }
      if (availabilityFilter === "owned") {
        return ownedIds.has(player.id);
      }
      if (availabilityFilter === "affordable") {
        return player.marketValue + transferFee <= wallet;
      }
      return true;
    });
  }, [market, roleFilter, regionFilter, availabilityFilter, ownedIds, transferFee, wallet]);

  const sortedPlayers = useMemo(() => {
    const sorted = [...filteredPlayers];
    sorted.sort((a, b) => {
      let delta = 0;
      switch (sortKey) {
        case "name":
          delta = (a.nickname ?? a.name).localeCompare(b.nickname ?? b.name);
          break;
        case "role":
          delta = a.role.localeCompare(b.role);
          break;
        case "trend":
          delta = a.trendDelta - b.trendDelta;
          break;
        case "score":
          delta = a.score - b.score;
          break;
        case "price":
        default:
          delta = a.marketValue - b.marketValue;
          break;
      }
      return sortDir === "asc" ? delta : -delta;
    });
    return sorted;
  }, [filteredPlayers, sortKey, sortDir]);

  const handleBuy = async (playerId: number) => {
    if (!user) {
      setStatus({ type: "error", message: "Sign in to buy cards." });
      return;
    }
    setBuyingId(playerId);
    setStatus(null);
    try {
      const payload = await apiFetch<MarketBuyResponse>("/api/market/buy", {
        method: "POST",
        body: JSON.stringify({ userId: user.id, playerId }),
      });
      setStatus({ type: "success", message: `Bought ${payload.purchased.name}.` });
      setUser({ ...user, currency: payload.currency });
      try {
        await refreshUserMarketState(user.id);
      } catch {
        /* ignore refresh failures */
      }
    } catch (error) {
      let message = "Purchase failed.";
      if (error instanceof ApiError) {
        const body = error.body as { message?: string; error?: string };
        message = body?.message ?? body?.error ?? `Request failed (${error.status})`;
      }
      setStatus({ type: "error", message });
    } finally {
      setBuyingId(null);
    }
  };

  const handleSell = async (playerId: number) => {
    if (!user) {
      setStatus({ type: "error", message: "Sign in to sell cards." });
      return;
    }
    setSellingId(playerId);
    setStatus(null);
    try {
      const payload = await apiFetch<MarketSellResponse>("/api/market/sell", {
        method: "POST",
        body: JSON.stringify({ userId: user.id, playerId }),
      });
      setStatus({ type: "success", message: `Sold ${payload.sold.name}.` });
      setUser({ ...user, currency: payload.currency });
      try {
        await refreshUserMarketState(user.id);
      } catch {
        /* ignore refresh failures */
      }
    } catch (error) {
      let message = "Sale failed.";
      if (error instanceof ApiError) {
        const body = error.body as { message?: string; error?: string };
        message = body?.message ?? body?.error ?? `Request failed (${error.status})`;
      }
      setStatus({ type: "error", message });
    } finally {
      setSellingId(null);
    }
  };

  return (
    <div className="market-page fade-in">
      <div className="page-icons">
        <Link to="/" className="page-icon home-icon">
          <img src={homeIcon} alt="Home" className="icon-image" />
        </Link>
        <Link to="/profile" className="page-icon user-icon">
          <img src={userIcon} alt="Profile" className="icon-image" />
        </Link>
      </div>

      <div className="market-header">
        <h1>Market & Transfers</h1>
        <p>Track prices, trends, and manage your transfers between stages.</p>
        {user ? (
          <p className="market-wallet">Wallet: {wallet}</p>
        ) : (
          <p className="market-wallet">Sign in to see your wallet.</p>
        )}
        {user && !loading && (
          <p className="market-deck-status">
            {deck
              ? missingRoles.length > 0
                ? `Missing roles: ${missingRoles.join(", ")}`
                : "Deck complete"
              : "No deck saved yet"}
          </p>
        )}
      </div>

      {status && <p className={`market-status ${status.type}`}>{status.message}</p>}

      <div className="market-grid">
        <section className="market-card">
          <h2>Transfer State</h2>
          {!user && <p className="market-muted">Sign in to see transfer limits.</p>}
          {user && transferState && (
            <div className="transfer-state">
              <div>
                <span>Status</span>
                <strong>{transferState.windowOpen ? "Open" : "Locked"}</strong>
              </div>
              <div>
                <span>Window</span>
                <strong>{transferState.windowLabel}</strong>
              </div>
              <div>
                <span>Limit</span>
                <strong>
                  {transferState.transferLimit ?? "Unlimited"}
                </strong>
              </div>
              <div>
                <span>Used</span>
                <strong>{transferState.transfersUsed ?? "-"}</strong>
              </div>
              <div>
                <span>Remaining</span>
                <strong>{transferState.remainingTransfers ?? "-"}</strong>
              </div>
              <div>
                <span>Fee / card</span>
                <strong>{transferState.transferFeePerCard}</strong>
              </div>
            </div>
          )}
        </section>

        <section className="market-card">
          <h2>Transfers Log</h2>
          {!user && <p className="market-muted">Sign in to see your history.</p>}
          {user && history && history.history.length === 0 && (
            <p className="market-muted">No transfers yet.</p>
          )}
          {user && history && history.history.length > 0 && (
            <ul className="transfer-list">
              {history.history.map((entry) => (
                <li key={entry.id}>
                  <span className={`action ${entry.action}`}>
                    {entry.action.toUpperCase()}
                  </span>
                  <span>{entry.playerName}</span>
                  <span>{entry.role}</span>
                  <span>{entry.price}</span>
                  <span>{entry.fee > 0 ? `Fee ${entry.fee}` : "No fee"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="market-card market-wide">
          <h2>Player Prices</h2>
          <div className="market-controls">
            <label>
              Sort by
              <select
                value={sortKey}
                onChange={(event) =>
                  setSortKey(
                    event.target.value as "price" | "name" | "role" | "trend" | "score"
                  )
                }
              >
                <option value="price">Price</option>
                <option value="name">Name</option>
                <option value="role">Role</option>
                <option value="trend">Trend</option>
                <option value="score">Score</option>
              </select>
            </label>
            <label>
              Role
              <select
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(event.target.value as DeckRole | "all")
                }
              >
                <option value="all">All</option>
                <option value="Top">Top</option>
                <option value="Jgl">Jungle</option>
                <option value="Mid">Mid</option>
                <option value="Adc">Adc</option>
                <option value="Supp">Support</option>
              </select>
            </label>
            <label>
              Region
              <select
                value={regionFilter}
                onChange={(event) =>
                  setRegionFilter(
                    event.target.value === "all"
                      ? "all"
                      : Number(event.target.value)
                  )
                }
              >
                <option value="all">All</option>
                {regionOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Availability
              <select
                value={availabilityFilter}
                onChange={(event) =>
                  setAvailabilityFilter(
                    event.target.value as "all" | "affordable" | "owned"
                  )
                }
              >
                <option value="all">All</option>
                <option value="affordable">Affordable</option>
                <option value="owned">Owned</option>
              </select>
            </label>
            <button
              className="market-button sort-toggle"
              onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
              type="button"
            >
              {sortDir === "asc" ? "Asc" : "Desc"}
            </button>
            <div className="market-chips">
              <button
                className={`market-chip ${
                  availabilityFilter === "affordable" ? "active" : ""
                }`}
                type="button"
                onClick={() =>
                  setAvailabilityFilter(
                    availabilityFilter === "affordable" ? "all" : "affordable"
                  )
                }
              >
                Affordable
              </button>
              <button
                className={`market-chip ${
                  availabilityFilter === "owned" ? "active" : ""
                }`}
                type="button"
                onClick={() =>
                  setAvailabilityFilter(
                    availabilityFilter === "owned" ? "all" : "owned"
                  )
                }
              >
                Owned
              </button>
            </div>
            <button className="market-chip clear-filters" type="button" onClick={resetFilters}>
              Clear filters
            </button>
          </div>
          {loading && <p className="market-muted">Loading market...</p>}
          {!loading && market && (
            <div className="market-table">
              <div className="market-row header">
                <span />
                <span>Player</span>
                <span>Role</span>
                <span>Price</span>
                <span>Trend</span>
                <span>Last prices</span>
                <span />
              </div>
              {sortedPlayers.map((player) => (
                <div
                  key={player.id}
                  className={`market-row ${
                    missingRoles.includes(player.role) ? "missing-role" : ""
                  }`}
                >
                  <span className="player-icon">
                    <img
                      src={resolvePlayerImage(player.nickname ?? player.name)}
                      alt={player.nickname ?? player.name}
                    />
                  </span>
                  <span>
                    {player.nickname ?? player.name}
                    {ownedIds.has(player.id) && <em className="owned-tag">Owned</em>}
                  </span>
                  <span>{player.role}</span>
                  <span>
                    {player.marketValue}
                    {user && player.marketValue + transferFee > wallet && (
                      <em className="affordability">
                        Need {player.marketValue + transferFee - wallet}
                      </em>
                    )}
                  </span>
                  <span className={player.trendDelta >= 0 ? "trend up" : "trend down"}>
                    {player.trendDelta >= 0 ? "+" : ""}
                    {player.trendDelta.toFixed(1)}
                  </span>
                  <span className="scores">
                    {player.recentPrices.length > 0
                      ? player.recentPrices.join(", ")
                      : "-"}
                  </span>
                  <span>
                    <button
                      className="market-button"
                      onClick={() => handleBuy(player.id)}
                      disabled={
                        !user ||
                        buyingId === player.id ||
                        ownedIds.has(player.id) ||
                        (transferState ? !transferState.windowOpen : false) ||
                        player.marketValue + transferFee > wallet
                      }
                    >
                      {ownedIds.has(player.id)
                        ? "Owned"
                        : buyingId === player.id
                          ? "Buying..."
                          : "Buy"}
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="market-card market-wide">
          <h2>Owned Players</h2>
          {!user && <p className="market-muted">Sign in to see your collection.</p>}
          {user && collection && collection.players.length === 0 && (
            <p className="market-muted">No players owned yet.</p>
          )}
          {user && collection && collection.players.length > 0 && (
            <div className="market-table">
              <div className="market-row header">
                <span />
                <span>Player</span>
                <span>Role</span>
                <span>Price</span>
                <span>Trend</span>
                <span>Last prices</span>
                <span />
              </div>
              {collection.players.map((player) => (
                <div
                  key={player.id}
                  className={`market-row ${
                    missingRoles.includes(player.role) ? "missing-role" : ""
                  }`}
                >
                  <span className="player-icon">
                    <img
                      src={resolvePlayerImage(player.nickname ?? player.name)}
                      alt={player.nickname ?? player.name}
                    />
                  </span>
                  <span>{player.nickname ?? player.name}</span>
                  <span>{player.role}</span>
                  <span>{player.marketValue}</span>
                  <span className={player.trendDelta >= 0 ? "trend up" : "trend down"}>
                    {player.trendDelta >= 0 ? "+" : ""}
                    {player.trendDelta.toFixed(1)}
                  </span>
                  <span className="scores">
                    {player.recentPrices.length > 0
                      ? player.recentPrices.join(", ")
                      : "-"}
                  </span>
                  <span>
                    <button
                      className="market-button"
                      onClick={() => handleSell(player.id)}
                      disabled={!user || sellingId === player.id}
                    >
                      {sellingId === player.id ? "Selling..." : "Sell"}
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
