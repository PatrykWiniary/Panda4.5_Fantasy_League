import React from "react";
import { useState } from "react";
import "../styles/WaitingRoom.css";
import bg from "../assets/WaitingRoom/background.png";
import banners from "../assets/WaitingRoom/banners.png";


export default function WaitingRoomPage() {
    const avatars = "src/assets/WaitingRoom/users";
    const players = [
        { id: 1, name: "Faker2", avatar: avatars + "/user1.png" },
        { id: 2, name: "Faker3", avatar: avatars + "/user2.png" },
        { id: 3, name: "FakerHost123", avatar: avatars + "/user3.png", isHost: true },
        { id: 4, name: "Faker4", avatar: avatars + "/user4.png" },
    ];
    const [showSettings, setShowSettings] = useState(false);


    const [settings, setSettings] = useState({
        id: "12345",
        password: "",
        entryFee: 5,
        lobbyName: "test",
    });

var totalPrize=532;

const [tempSettings, setTempSettings] = useState(settings);

const openSettings = () => {
  setTempSettings(settings);
  setShowSettings(true);
};

const closeSettings = () => {
  setTempSettings(settings);
  setShowSettings(false);
};

const saveSettings = () => {
  setSettings(tempSettings);
  setShowSettings(false);
};


  const maxPlayers = 5;
  const isHost = true;
  var totalPrize = 532;

  const handleSettings = () => {
    if (!isHost) return;
    console.log("Settings opened (host only)");
  };

  const handleStartGame = () => {
    if (!isHost) return;
    console.log("Start game triggered (host only)");
  };

  return (
    <div className="waiting-room-root">
      <img src={bg} alt="background" className="wr-background" />

      <div className="banner-strip" style={{ backgroundImage: `url(${banners})` }}>
        <div className="banner-slots">
          {[...Array(maxPlayers)].map((_, idx) => {
            const player = players[idx];
            const isEmpty = !player;

            return (
              <div className="banner-slot" key={idx} data-slot={idx + 1}>
                {player ? (
                  <div className="slot-content">
                    <div className={`avatar-wrap ${player.isHost ? "host" : ""}`}>
                      <img src={player.avatar} alt={player.name} className="avatar-img" />
                    </div>
                    <div className="slot-name">{player.name}</div>
                  </div>
                ) : (
                  <div className="slot-content dots-wrap" aria-hidden="true">
                    <div className="dots">
                      <span className="dot" />
                      <span className="dot" />
                      <span className="dot" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    <div className="total-prize-container">
      <div className="total-prize">TOTAL PRIZE: {totalPrize}$</div>
    </div>
    <div className="button-containerwr">
        <button className="btnwr"><span>RETURN</span></button>

        <button
            className={`btnwr ${!isHost ? "disabled" : ""}`}
            onClick={() => isHost && openSettings()}
            disabled={!isHost}
        >
            <span>SETTINGS</span>
        </button>

        <button
            className={`btnwr  ${!isHost ? "disabled" : ""}`}
            onClick={handleStartGame}
            disabled={!isHost}
        >
            <span>START</span>
        </button>
    </div>
    {showSettings && (
  <div className="settings-overlay">
    <div className="settings-modal">

      <div className="settings-header">
        <div className="settings-actions">
          <button className="settings-btn small" onClick={saveSettings}><span>✔</span></button>
          <button className="settings-btn small" onClick={closeSettings}><span>✕</span></button>
        </div>
      </div>

      <div className="settings-group">
        <label>ID</label>
        <div className="settings-row">
          <input
            value={tempSettings.id}
            onChange={(e) =>
              setTempSettings({ ...tempSettings, id: e.target.value })
            }
          />
        </div>
      </div>

      <div className="settings-group">
        <label>PASSWORD</label>
        <div className="settings-row">
          <input
            value={tempSettings.password}
            type="password"
            onChange={(e) =>
              setTempSettings({ ...tempSettings, password: e.target.value })
            }
          />
        </div>
      </div>

      <div className="settings-group">
        <label>ENTRY FEE</label>
        <div className="settings-row">
        <input
          type="number"
          value={tempSettings.entryFee}
          onChange={(e) =>
            setTempSettings({
              ...tempSettings,
              entryFee: Number(e.target.value),
            })
          }
        />
        </div>
      </div>

      <div className="settings-group">
        <label>LOBBY’S NAME</label>
        <div className="settings-row">
        <input
          value={tempSettings.lobbyName}
          onChange={(e) =>
            setTempSettings({ ...tempSettings, lobbyName: e.target.value })
          }
        />
        </div>
      </div>

    </div>
  </div>
)}

</div>
  );
}
