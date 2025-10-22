import { useState } from "react";
import "./PlayerPick.css";
import bg from "../assets/rift.png";

import iconTop from "../assets/roleIcons/top.png";
import iconJungle from "../assets/roleIcons/jungle.png";
import iconMid from "../assets/roleIcons/mid.png";
import iconAdc from "../assets/roleIcons/adc.png";
import iconSupport from "../assets/roleIcons/support.png";

export default function PlayerPick() {
  const [selected, setSelected] = useState<string | null>(null);
  const positions = [
    { id: "top", top: "15%", left: "28%", icon: iconTop },
    { id: "jungle", top: "38%", left: "33%", icon: iconJungle },
    { id: "mid", top: "42%", left: "50%", icon: iconMid },
    { id: "adc", top: "75%", left: "68%", icon: iconAdc },
    { id: "support", top: "80%", left: "80%", icon: iconSupport },
  ];

  return (
    <div className="pick-your-team">
      <div className="rift-container">
        <img src={bg} alt="rift background" className="bg-img" />

        {positions.map((pos) => (
          <div
            key={pos.id}
            className="player-slot"
            style={{ top: pos.top, left: pos.left }}
          >
            <div
              className={`player-circle ${
                selected === pos.id ? "selected" : ""
              }`}
              onClick={() => setSelected(pos.id)}
              title={pos.id.toUpperCase()}
            ></div>
            <img src={pos.icon} alt={`${pos.id} icon`} className="role-icon" />
          </div>
        ))}
      </div>

      <h1 className="title">PICK YOUR TEAM</h1>

      <div className="button-container">
        <button className="btn return"><span>RETURN</span></button>
        <button className="btn confirm"><span>CONFIRM</span></button>
      </div>
    </div>
  );
}
