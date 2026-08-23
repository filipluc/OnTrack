import { Link } from "react-router-dom";
import TabBar from "../components/TabBar";

export default function CupaSteleleViitorului() {
  return (
    <div className="dashboard">
      <Link to="/more" className="back-link">
        ← Back
      </Link>

      <header className="dashboard-header">
        <div className="header-title-block">
          <h1>Cupa Stelele Viitorului 2026</h1>
          <span className="signed-in-as">steleleviitorului.ro · FCSB base</span>
        </div>
      </header>

      <div className="more-list">
        {["2014", "2015", "2016", "2017"].map((year) => (
          <Link key={year} to={`/more/cupa-stelele-viitorului/${year}`} className="more-item">
            <span className="more-item-icon">🏆</span>
            <span className="more-item-label">{year}</span>
            <span className="more-item-arrow">›</span>
          </Link>
        ))}
      </div>

      <TabBar />
    </div>
  );
}
