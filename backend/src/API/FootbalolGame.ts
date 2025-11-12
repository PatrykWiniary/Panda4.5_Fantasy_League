import {
  fetchAllPlayers,
  fetchPlayersByTeamId,
  fetchRegionNameById,
  simulateMatch as simulatePlayerStats,
  getTeamId,
  getTeamsOverview,
  TeamOverview,
} from "../db";
import { Player } from "../Types";

export default class FootabalolGame {
  regionId: number = -1;
  regionName: string = "";
  players: Player[] = [];
  torunamentMVP: { name?: string; score?: number } = {};
  teams: TeamOverview[] = [];

  setRegion(regionId: number = 1) {
    this.regionId = regionId;
    this.regionName = fetchRegionNameById(regionId);
    this.loadPlayers();
    this.loadTeams();
  }

  getRegion() {
    return { id: this.regionId, name: this.regionName };
  }

  loadPlayers() {
    this.players = fetchAllPlayers(this.regionId);
  }

  loadTeams() {
    this.teams = getTeamsOverview(this.regionId);
  }

  simulateMatch() {
    const stats = simulatePlayerStats(this.players, this.regionName);
    if (this.teams.length < 2) {
      return { ...stats };
    }

    const availableTeams = [...this.teams];
    while (availableTeams.length > 2) {
      const index = Math.floor(Math.random() * availableTeams.length);
      availableTeams.splice(index, 1);
    }

    const matchup =
      availableTeams.length === 2
        ? availableTeams
        : this.teams.slice(0, 2);
    const winningTeam =
      matchup[Math.floor(Math.random() * matchup.length)] ?? matchup[0];

    return {
      ...stats,
      teams: matchup.map((team) => team.name),
      teamIds: matchup.map((team) => team.id),
      winningTeam: winningTeam?.name ?? stats.winningTeam,
      winningTeamId: winningTeam?.id,
    };
  }

  *simulateTournament(_region: number, gameNumber: number) {
    let i = 0;
    while (i < gameNumber) {
      const { region: regionName, teams, teamIds, winningTeam, MVP } =
        this.simulateMatch();
      this.torunamentMVP = MVP;
      const idsFromMatch =
        teamIds && Array.isArray(teamIds) && teamIds.length === 2
          ? teamIds
          : teams
              .map((teamName) => {
                try {
                  return getTeamId(teamName);
                } catch {
                  return undefined;
                }
              })
              .filter((id): id is number => typeof id === "number");

      const roster =
        idsFromMatch.length >= 2
          ? [
              ...fetchPlayersByTeamId(idsFromMatch[0]),
              ...fetchPlayersByTeamId(idsFromMatch[1]),
            ]
          : fetchAllPlayers(this.regionId);

      yield {
        region: regionName,
        teams,
        winner: winningTeam,
        MVP,
        players: roster,
        teamIds: idsFromMatch,
        gameNumber: i + 1,
      };
      i++;
    }

    return {
      region: this.regionName,
      teams: this.teams.map((team) => team.name),
      teamIds: this.teams.map((team) => team.id),
      winner: this.teams[0]?.name ?? "SKT T1",
      MVP: this.torunamentMVP,
      players: [...fetchAllPlayers(this.regionId)],
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
      `${
        player.nickname ?? player.name
      } [Region: ${this.regionName}] → Kills: ${player.kills}, Deaths: ${player.deaths}, Assists: ${player.assists}, CS: ${player.cs}`
    );
  }
}
