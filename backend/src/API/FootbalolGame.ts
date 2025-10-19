import { fetchAllPlayers, fetchRegionNameById, simulateMatch } from "../db";
import { Player } from "../Types";


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
