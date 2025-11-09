import { fetchAllPlayers, fetchPlayersByTeamId, fetchRegionNameById, simulateMatch, getTeamId } from "../db";
import { Player } from "../Types";
import { sampleData } from "../../data/SampleData.json";

export default class FootabalolGame {
  regionId: number = -1;
  regionName: string = "";
  players: Player[] = [];
  torunamentMVP = {};
  teams = sampleData.teams;

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

  simulateMatch() {
    return {...simulateMatch(this.players, this.regionName)};
  }

  *simulateTournament(region: number, gameNumber: number) {
    let i = 0;
    while (i < gameNumber) {
      const {region, teams, winningTeam, MVP} = this.simulateMatch();
      this.torunamentMVP = MVP;
      let team1 = getTeamId(teams[0]);
      let team2 = getTeamId(teams[1]);
      yield {
        region: region,
        teams: teams,//2 teams
        winner: winningTeam,
        MVP: MVP,
        players: [...fetchPlayersByTeamId(team1.id), ...fetchPlayersByTeamId(team2.id)],
        //players: [],
        gameNumber: i + 1,
      };
      i++;
    }

    return {
      region: region,
        teams: this.teams,//all teams
        winner: "SKT T1",
        MVP: this.torunamentMVP,
        players: [...fetchAllPlayers(this.regionId)],
        //players: [],
        numberOfGames: i,
    };
  }

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
