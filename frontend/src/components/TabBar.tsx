import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/", icon: "🗓️", label: "Schedule", end: true },
  { to: "/agenda", icon: "✅", label: "Agenda", end: false },
  { to: "/reports", icon: "📊", label: "Reports", end: false },
];

export default function TabBar() {
  return (
    <nav className="tab-bar">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `tab-bar-item ${isActive ? "active" : ""}`}
        >
          <span className="tab-bar-icon">{tab.icon}</span>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
