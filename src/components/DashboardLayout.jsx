import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function DashboardLayout({ title, navItems, children }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="dash-shell">
      <header className="dash-topbar">
        <div className="dash-topbar-title">{title}</div>
        <div className="dash-topbar-user">
          <span>{profile?.full_name}</span>
          <button onClick={handleLogout} className="btn-logout">Log out</button>
        </div>
      </header>

      <nav className="dash-tabs">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => 'dash-tab' + (isActive ? ' dash-tab-active' : '')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main className="dash-content">{children}</main>
    </div>
  );
}
