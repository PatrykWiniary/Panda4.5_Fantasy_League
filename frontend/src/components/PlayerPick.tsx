import { useState } from "react";
import "./PlayerPick.css";
import bg from "../assets/rift.png";

import iconTop from "../assets/roleIcons/top.png";
import iconJungle from "../assets/roleIcons/jungle.png";
import iconMid from "../assets/roleIcons/mid.png";
import iconAdc from "../assets/roleIcons/adc.png";
import iconSupport from "../assets/roleIcons/support.png";

const playerIcons = "/src/assets/playerPics/";

export default function PlayerPick() {
  const playersData = {
    top: [
      { name: "Zeus", team: "HLE", region: "LCK", image: playerIcons + "Zeus.webp" },
      { name: "Bin", team: "BLG", region: "LPL", image: playerIcons + "Bin.webp" },
    ],
    jungle: [
      { name: "Oner", team: "T1", region: "LCK", image: playerIcons + "Oner.webp" },
      { name: "Canyon", team: "Gen.G", region: "LCK", image: playerIcons + "Canyon.webp" },
    ],
    mid: [
      { name: "Faker", team: "T1", region: "LCK", image: playerIcons + "Faker.webp" },
      { name: "Chovy", team: "Gen.G", region: "LCK", image: playerIcons + "Chovy.webp" },
    ],
    adc: [
      { name: "Gumayusi", team: "T1", region: "LCK", image: playerIcons + "Gumayusi.webp" },
      { name: "Ruler", team: "Gen.G", region: "LCK", image: playerIcons + "Ruler.webp" },
    ],
    support: [
      { name: "Keria", team: "T1", region: "LCK", image: playerIcons + "Keria.webp" },
      { name: "Duro", team: "Gen.G", region: "LCK", image: playerIcons + "Duro.webp" },
    ],
  };

  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [draftTeam, setDraftTeam] = useState<Record<string, any>>({});

  const positions = [
    { id: "top", top: "15%", left: "28%", icon: iconTop },
    { id: "jungle", top: "38%", left: "33%", icon: iconJungle },
    { id: "mid", top: "42%", left: "50%", icon: iconMid },
    { id: "adc", top: "75%", left: "68%", icon: iconAdc },
    { id: "support", top: "80%", left: "80%", icon: iconSupport },
  ];

  const handleCircleClick = (role: string) => {
    setSelectedRole(role);
    setSelectedPlayer(draftTeam[role] || playersData[role][0]);
  };

  const handlePlayerSelect = (player: any) => {
    setSelectedPlayer(player);
    // Save immediately after clicking a player
    if (selectedRole) {
      setDraftTeam((prev) => ({
        ...prev,
        [selectedRole]: player,
      }));
    }
  };

  const closeModal = () => {
    setSelectedRole(null);
    setSelectedPlayer(null);
  };

  const handleSubmitTeam = () => {
    console.log("Drafted team:", draftTeam);
  };

  return (
    <div className={`pick-your-team ${selectedRole ? "blurred" : ""}`}>
      <div className="rift-container">
        <img src={bg} alt="rift background" className="bg-img" />

        {positions.map((pos) => (
          <div key={pos.id} className="player-slot" style={{ top: pos.top, left: pos.left }}>
            <div
              className="player-circle"
              onClick={() => handleCircleClick(pos.id)}
              title={pos.id.toUpperCase()}
            >
              {draftTeam[pos.id]?.image ? (
                <img
                  src={draftTeam[pos.id].image}
                  alt={draftTeam[pos.id].name}
                  className="circle-image"
                />
              ) : null}
            </div>
            <img src={pos.icon} alt={`${pos.id} icon`} className="role-icon" />
          </div>
        ))}
      </div>

      <h1 className="title">PICK YOUR TEAM</h1>

      <div className="button-container">
        <button className="btn return"><span>RETURN</span></button>
        <button className="btn confirm" onClick={handleSubmitTeam}><span>CONFIRM</span></button>
      </div>

{selectedRole && (
  <div className="modal-overlay">
    <div className="modal">
      <button className="close-btn" onClick={closeModal}>✕</button>
      
      <div className="modal-header">{selectedRole.toUpperCase()}</div>

      <div className="modal-body">
        <div className="player-grid">
          {playersData[selectedRole].map((player) => (
            <div
              key={player.name}
              className={`player-grid-item ${
                selectedPlayer?.name === player.name ? "active" : ""
              }`}
              onClick={() => {
                setSelectedPlayer(player);
                setDraftTeam((prev) => ({
                  ...prev,
                  [selectedRole]: player,
                }));
              }}
            >
              <img src={player.image} alt={player.name} />
            </div>
          ))}
        </div>
      </div>
    </div>
    {selectedPlayer && (
          <div className="player-preview">
            <img
              src={selectedPlayer.image}
              alt={selectedPlayer.name}
              className="preview-image"
            />
            <div className="preview-info">
              <h2>{selectedPlayer.name}</h2>
              <p>TEAM: {selectedPlayer.team}</p>
              <p>REGION: {selectedPlayer.region}</p>
            </div>
          </div>
        )}
  </div>
)}
    </div>
  );
}
