export class LoLEsportsAPI {
  private API_KEY = { "x-api-key": "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z" };
  private API_URL = 'https://prod-relapi.ewp.gg/persisted/gw';
  private API_URL_WINDOW = "https://feed.lolesports.com/livestats/v1"
  
  //private API_URL = "https://esports-api.lolesports.com/persisted/gw";
  private API_URL_THREE = 'https://api.lolesports.com/api/v1'

  async getLeagues(hl: string = "en-US") {
    const res = await fetch(`${this.API_URL}/getLeagues?hl=${hl}`, {
      headers: this.API_KEY,
    });

    const json = await res.json();
    return json.data.leagues;
  }

  async getTournamentsByLeague(hl: string = "en-US", leagueID: string) {
    const res = await fetch(`${this.API_URL}/getTournamentsForLeague?hl=${hl}&leagueId=${leagueID}`, {
      headers: this.API_KEY,
    });

    const json = await res.json();
    return json.data.leagues[0].tournaments;
  }

  async getCompletedEvents(hl: string = "en-US", leagueID: string) {
    const res = await fetch(`${this.API_URL}/getCompletedEvents?hl=${hl}&leagueId=${leagueID}`, {
      headers: this.API_KEY,
    });

    const json = await res.json();
    return json.data.schedule.events[0];
  }

  async getEventDetails(hl: string = "en-US", gameId: string) {
    const res = await fetch(`${this.API_URL}/getEventDetails?hl=${hl}&id=${gameId}`, {
      headers: this.API_KEY,
    });

    const json = await res.json();
    return json.data;
  }

  async getTeams(hl: string = "en-US", gameId?: string) {
    const res = await fetch(`${this.API_URL}/getTeams?hl=${hl}`, {
      headers: this.API_KEY,
    });

    const json = await res.json();
    return json.data.teams;
  }

  async getPlayers(slug: string, tournamentId?: string) {
    const res = await fetch(`${this.API_URL_THREE}/teams?slug=${slug}&tournament=${tournamentId}`, {
      headers: this.API_KEY,
    });

    const json = await res.json();
    return json;
  }

  async getStats(slug: string, tournamentId: string) {
    const res = await fetch(`${this.API_URL_THREE}/players?slug=${slug}&tournament=${tournamentId}`, {
      headers: this.API_KEY,
    });

    const json = await res.json();
    return json;
  }

  async getStandings(hl: string = "en-US", tournamentId?: string) {
    const res = await fetch(`${this.API_URL}/getStandings?hl=${hl}&tournamentId=${tournamentId}`, {
      headers: this.API_KEY,
    });

    const json = await res.json();
    return json.data.standings[0].stages[1].sections[0].matches[0].teams[0];
  }

  async getDetails(hl: string = "en-US", gameId: string) {
    const res = await fetch(`${this.API_URL_WINDOW}/details/${gameId}`, {
      headers: this.API_KEY,
    });

    const json = await res.json();
    return json;
  }
}
