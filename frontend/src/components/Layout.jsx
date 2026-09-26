import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const ROLE_LABELS = {
  field_investigator: "Field Investigator",
  statistical_officer: "Statistical Officer",
  deputy_director: "Deputy Director (Statistics)",
  testing: "Testing",
};

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="sidebar__mark">Gyan Sarthi</div>
          <div className="sidebar__tagline">Dynamic competency learning</div>
        </div>

        <ul className="sidebar__nav">
          <li>
            <NavLink to="/dashboard" className={({ isActive }) => "sidebar__link" + (isActive ? " sidebar__link--active" : "")}>
              My competency
            </NavLink>
          </li>
          <li>
            <NavLink to="/roadmap" className={({ isActive }) => "sidebar__link" + (isActive ? " sidebar__link--active" : "")}>
              Learning roadmap
            </NavLink>
          </li>
          <li>
            <NavLink to="/quiz" className={({ isActive }) => "sidebar__link" + (isActive ? " sidebar__link--active" : "")}>
              Take an assessment
            </NavLink>
          </li>
          {user?.isAdmin && (
            <>
              <li>
                <NavLink to="/heatmap" className={({ isActive }) => "sidebar__link" + (isActive ? " sidebar__link--active" : "")}>
                  Organisation heat-map
                </NavLink>
              </li>
              <li>
                <NavLink to="/content" className={({ isActive }) => "sidebar__link" + (isActive ? " sidebar__link--active" : "")}>
                  Add training content
                </NavLink>
              </li>
            </>
          )}
        </ul>

        <div className="sidebar__footer">
          <div className="sidebar__user-name">{user?.name}</div>
          <div className="sidebar__user-role">
            {ROLE_LABELS[user?.roleId] || user?.roleId}
            {user?.isAdmin ? " · Admin" : ""}
          </div>
          <button className="sidebar__logout" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

export { ROLE_LABELS };
