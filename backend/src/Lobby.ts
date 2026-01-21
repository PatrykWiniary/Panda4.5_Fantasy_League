import { User } from "./Types";

type LobbyUser = User & {
  totalBet: number;
};

export class Lobby {
  id: number;
  password: string = "";
  betValue: number = 0;
  winnerId: number | null = null;
  private users: Map<number, LobbyUser>;
  private db;

  constructor(
    db: any, // explicit any as requested
    id: number, // requested lobby id (may or may not exist)
    password: string = ""
  ) {
    this.db = db;

    // Try loading lobby from DB
    const row = this.db.prepare("SELECT * FROM lobby WHERE id = ?").get(id);

    if (row) {
      //lobby in db
      this.id = row.id;
      this.password = row.password ?? "";
      this.betValue = row.betValue ?? 0;
      this.winnerId = row.winner_id ?? null;
    } else {
      const insert = this.db.prepare(
        "INSERT INTO lobby (password, betValue, winner_id) VALUES (?, ?, ?)"
      );

      const result = insert.run(password, this.betValue, this.winnerId);
      const newId = Number(result.lastInsertRowid);

      // Load the newly created lobby row
      const created = this.db
        .prepare("SELECT * FROM lobby WHERE id = ?")
        .get(newId);

      this.id = created.id;
      this.password = created.password ?? "";
      this.betValue = created.betValue ?? 0;
      this.winnerId = created.winner_id ?? null;
    }

    this.users = new Map();
  }

  // Fetch user from database and add to the lobby
  join(userId: number, password: string = ""): boolean {
    if (this.users.has(userId)) {
      console.warn("JOIN LOBBY - User already in lobby");
      return false;
    }

    if (this.password.length > 0 && password != this.password) {
      console.warn("JOIN LOBBY - Incorrect password");
      return false;
    }

    const update_stmt = this.db.prepare(`
      UPDATE users
      SET lobby_id = ?
      WHERE id = ?`
    );
    update_stmt.run(this.id, userId);

    const stmt = this.db.prepare(`
      SELECT * FROM users WHERE id = ?
    `);
    const user = stmt.get(userId) as User | undefined;
    if (!user) return false; // user not found

    this.users.set(userId, {
      ...user,
      totalBet: 0,
    });

    return true;
  }

  leave(userId: number): boolean {
    if (this.users.has(userId) == false) {
      console.warn("JOIN LOBBY - User not in lobby");
      return false;
    }

    const stmt = this.db.prepare(`
      UPDATE users
      SET lobby_id = ?
      WHERE id = ?`
    );

    stmt.run(null, userId);

    this.users.delete(userId);

    return true;
  }

  // List users currently in lobby
  getUsers(): LobbyUser[] {
    return [...this.users.values()];
  }

  // Add betting amount from a specific user
  addToBet(userId: number, amount: number): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    if (amount <= 0 || user.currency - amount < 0) {
      console.log("Bet set too high: " + userId);
      return false;
    }

    console.log("User: " + user.id + " bets " + amount);
    user.totalBet += amount;
    this.betValue += amount;
    console.log("");

    return true;
  }

  // Winner = user with the highest personal bet
  decideWinner(): number | null {
    if (this.users.size === 0) {
      this.winnerId = null;
      return null;
    }

    let maxBet = -1;
    let winner: LobbyUser | null = null;

    for (const user of this.users.values()) {
      if (user.totalBet > maxBet) {
        maxBet = user.totalBet;
        winner = user;
      }
    }

    this.winnerId = winner ? winner.id : null;
    return this.winnerId;
  }
}
