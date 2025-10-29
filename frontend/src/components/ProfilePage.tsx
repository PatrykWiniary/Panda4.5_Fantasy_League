import { Link } from 'react-router-dom';
import '../styles/LogReg.css'; 
import homeIcon from "../assets/home.svg"; 
import userIcon from "../assets/user.svg";
import avatarIcon from "../assets/faker.svg";

export default function ProfilePage() {
  const player = {
    name: "<JoeMama>",
    avatar: avatarIcon, 
    champions: [
      { id: 1, icon: "/path/to/champ1.png" },
      { id: 2, icon: "/path/to/champ2.png" },
      { id: 3, icon: "/path/to/champ3.png" },
      { id: 4, icon: "/path/to/champ4.png" },
      { id: 5, icon: "/path/to/champ5.png" },
    ],
  };

  return (
    <div className="profile-page">
      <div className="page-icons">
        <Link to="/" className="page-icon home-icon">
          <img src={homeIcon} alt="Home" className="icon-image" />
        </Link>
        <Link to="/profile" className="page-icon user-icon">
          <img src={userIcon} alt="Profile" className="icon-image" />
        </Link>
      </div>

      <div className="profile-header">
        <img src={player.avatar} alt="Avatar" className="profile-avatar" />
        <h2 className="player-name">{player.name}</h2>
      </div>

      <div className="profile-champions">
        {player.champions.map(champ => (
          <div key={champ.id} className="champion-card">
            <img src={champ.icon} alt={`Champion ${champ.id}`} className="champion-icon" />
          </div>
        ))}
      </div>
    </div>
  );
}
