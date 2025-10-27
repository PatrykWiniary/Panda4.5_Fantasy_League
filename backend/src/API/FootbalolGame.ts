import { fetchAllPlayers, fetchRegionNameById, simulateMatch } from "../db";
import { Player, TournamentData } from "../Types";

export default class FootabalolGame {
  regionId: number = -1;
  regionName: string = "";
  players: Player[] = [];

  setRegion(regionId: number = 1) {
    this.regionId = regionId;
    this.regionName = fetchRegionNameById(regionId);
    this.loadPlayers();
  }

  getRegion() {
    return { id: this.regionId, name: this.regionName };
  }

  loadPlayers() {
    this.players = fetchAllPlayers(this.regionId);
  }

  /** Simulate a match that randomly updates player stats */
  simulateMatch() {
    simulateMatch(this.players, this.regionName);
  }

  *simulateTournament(region: number, gameNumber: number) {
    let i = 0;
    while (i < gameNumber) {
      this.simulateMatch();
      yield {
        region: region,
        players: [...fetchAllPlayers(region)],
        gameNumber: i + 1,
      };
      i++;
    }

    const kda = (p:Player) => p.kills + 0.8 * p.deaths + 0.5 * p.assists;
    const avg = (arr:Player[]) => arr.reduce((a, p) => a + kda(p), 0) / arr.length;
    const players = fetchAllPlayers(region);

    const blue = avg(players.slice(0, 5));
    const red = avg(players.slice(5));

    return {
      region: region,
      players: [...fetchAllPlayers(region)],
      winner: blue > red ? "Blue" : "Red",
    };

    //include gold as a wincon
  }

  /** Log stats for a specific player by name */
  logPlayerStats(name: string) {
    const player = this.players.find((p) => p.name === name);
    if (!player) {
      console.log(`Player "${name}" not found in region ${this.regionName}`);
      return;
    }
    console.log(
      `${player.name} [Region: ${this.regionName}] → Kills: ${player.kills}, Deaths: ${player.deaths}, Assists: ${player.assists}, CS: ${player.cs}`
    );
  }
}
