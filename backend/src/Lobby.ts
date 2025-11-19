import { User } from "./Types";

type LobbyUser = User & {
  totalBet: number;
};

export class Lobby {
  id: number;
  betValue: number;
  winnerId: number | null;
  private users: Map<number, LobbyUser>;
  private db;

  constructor(db:any/*yes explicit any, idc*/, id: number, betValue: number = 0, winnerId: number | null = null) {
    this.db = db;
    this.id = id;
    this.betValue = betValue;
    this.winnerId = winnerId;
    this.users = new Map();
  }

  // Fetch user from database and add to the lobby
  join(userId: number): boolean {
    if (this.users.has(userId)) {
      return false;
    }

    const stmt = this.db.prepare(`
      SELECT * FROM users WHERE id = ?
    `);

    const user = stmt.get(userId) as User | undefined;
    if (!user) return false; // user not found

    this.users.set(userId, {
      ...user,
      totalBet: 0
    });

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
    console.log('');

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