import express from "express";
import cors from "cors";
import { getAllItems, addItem } from "./db";
import { LoLEsportsAPI } from "./fetchData";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/items", (req, res) => {
  const items = getAllItems();
  res.json(items);
});

app.post("/api/items", (req, res) => {
  const { name, qty } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const item = addItem(name, qty ?? 0);
  res.status(201).json(item);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});

(async () => {
  const api = new LoLEsportsAPI();
  const coding = "en-US";

  const leagues = await api.getLeagues();
  const league = leagues[0];

  const tournaments = await api.getTournamentsByLeague(coding, league.id);
  const tournament = tournaments[1];
  //   console.log(tournament)
  //   console.log('\n\n')

  const events = await api.getCompletedEvents(coding, tournament.id);
  const game = events.games[0];

  const standings = await api.getStandings(coding, tournament.id);

  let team = await api.getTeams(coding, standings.slug);
  team = team.filter(t => {
    return t?.name == 'T1'
  });
  console.log(team[0].players[7])//players

  // const stats = await api.getStats(team[0].players[7].slug, tournament.id);
  // console.log(team[0].players[7].slug)
  // console.log(stats)
})();

// api.getWindow().then(w => {
//     //console.log(w)
// })
