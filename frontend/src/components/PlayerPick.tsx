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
      { name: "Zeus", team: "HLE", region: "LCK", cost: 60, image: playerIcons + "Zeus.webp" },
      { name: "Bin", team: "BLG", region: "LPL", cost: 40, image: playerIcons + "Bin.webp" },
    ],
    jungle: [
      { name: "Oner", team: "T1", region: "LCK", cost: 60, image: playerIcons + "Oner.webp" },
      { name: "Canyon", team: "Gen.G", region: "LCK", cost: 40, image: playerIcons + "Canyon.webp" },
    ],
    mid: [
      { name: "Faker", team: "T1", region: "LCK", cost: 60, image: playerIcons + "Faker.webp" },
      { name: "Chovy", team: "Gen.G", region: "LCK", cost: 40, image: playerIcons + "Chovy.webp" },
    ],
    adc: [
      { name: "Gumayusi", team: "T1", region: "LCK", cost: 60, image: playerIcons + "Gumayusi.webp" },
      { name: "Ruler", team: "Gen.G", region: "LCK", cost: 40, image: playerIcons + "Ruler.webp" },
    ],
    support: [
      { name: "Keria", team: "T1", region: "LCK", cost: 60, image: playerIcons + "Keria.webp" },
      { name: "Duro", team: "Gen.G", region: "LCK", cost: 40, image: playerIcons + "Duro.webp" },
    ],
  };

  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [draftTeam, setDraftTeam] = useState<Record<string, any>>({});
  const [showPopup, setShowPopup] = useState(false);
  const [isLockedIn, setIsLockedIn] = useState(false);
  const [showLockedOverlay, setShowLockedOverlay] = useState(false);


  const maxBudget = 250;
  const draftCost = Object.values(draftTeam).reduce((sum, player: any) => sum + (player?.cost || 0), 0);
  const remainingBudget = maxBudget - draftCost;

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
    if (draftCost > maxBudget) {
      alert("You can’t lock in with insufficient eurogąbki!");
      return;
    }
    setShowPopup(false);
    setShowLockedOverlay(true);
    setIsLockedIn(true);
    setTimeout(() => {
      setShowLockedOverlay(false);
    }, 3000);
    console.log("Drafted team:", draftTeam);
  };

  return (
    <div className={`pick-your-team ${selectedRole ? "blurred" : ""}`}>
      <div className="rift-container">
        <img src={bg} alt="rift background" className="bg-img" />

        {positions.map((pos) => (
          <div key={pos.id} className="player-slot" style={{ top: pos.top, left: pos.left }}>
            <div
              className={`player-circle ${isLockedIn ? 'disabled' : ''}`}
              onClick={() => !isLockedIn && handleCircleClick(pos.id)}
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
      <p className="deadline">⏱ DUE IN: 23.11.2025 23:59</p>

      <div className="draft-info">
        <div className="info-item">
          <span className="label">DRAFT COST</span>
          <span className="value">{draftCost}</span>
        </div>
        <div className="info-item">
          <span className="label">REMAINING EUROGĄBKI</span>
          <span className="value">{remainingBudget}</span>
        </div>
      </div>


      <div className="button-container">
        <button className="btn return"><span>RETURN</span></button>
        <button
          className={`btn confirm ${isLockedIn ? 'disabled' : ''}`}
          onClick={() => !isLockedIn && setShowPopup(true)}
        >
          <span>LOCK IN</span>
        </button>
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
              <p>COST: {selectedPlayer.cost}</p>
            </div>
          </div>
        )}
  </div>
)}
{showPopup && (
  <div className="popup-overlay">
    <div className="popup">
      <h2>DONE PICKING YOUR TEAM?</h2>
      <div className="popup-buttons">
        <button className="popup-btn yes" onClick={handleSubmitTeam}>YES</button>
        <button className="popup-btn no" onClick={() => setShowPopup(false)}>NO</button>
      </div>
    </div>
  </div>
)}
{showLockedOverlay && (
  <div className="locked-overlay">
    <h1 className="locked-text">LOCKED<br/>IN</h1>
  </div>
)}
    </div>
  );
}
