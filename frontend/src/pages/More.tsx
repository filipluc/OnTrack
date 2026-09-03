import { Link } from "react-router-dom";
import TabBar from "../components/TabBar";

export default function More() {
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>More</h1>
      </header>

      <div className="more-list">
        <Link to="/more/elite-u13" className="more-item">
          <span className="more-item-icon">⚽</span>
          <span className="more-item-label">Elite U13 Schedule</span>
          <span className="more-item-arrow">›</span>
        </Link>
        <Link to="/more/workit" className="more-item">
          <span className="more-item-icon">⚽</span>
          <span className="more-item-label">AJF U12 2026/2027</span>
          <span className="more-item-arrow">›</span>
        </Link>
        <Link to="/more/cupa-stelele-viitorului" className="more-item">
          <span className="more-item-icon">🏆</span>
          <span className="more-item-label">Cupa Stelele Viitorului 2026</span>
          <span className="more-item-arrow">›</span>
        </Link>
      </div>

      <TabBar />
    </div>
  );
}
