import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ToothMark from './ToothMark';
import InstallAppButton from './InstallAppButton';
import NotificationBell from './NotificationBell';
import { daysLeft, fmtDate } from '../lib/formatters';

// navItems: [{ to, label, icon, end, badge, quick, group }]
//   icon  — emoji shown in both the quick-bar and the drawer
//   quick — true for the handful shown inline in the compact top strip
//   group — drawer section heading; items without one land in "More"
// navItems: [{ to, label, icon, end, badge, quick, group }]
//   icon  — emoji shown in both the quick-bar and the drawer
//   quick — true for the handful shown inline in the compact top strip
//   group — drawer section heading; items without one land in "More"
//
// bottomNavItems (optional): [{ to, label, icon, end, badge }] — when
// passed, renders a fixed bottom tab bar (mobile-app style primary nav)
// and hides the top quick-bar, since the bottom bar takes over that
// job. Only the Examinee dashboard passes this; the other three roles
// are unaffected and keep the top quick-bar exactly as before.
export default function DashboardLayout({ title, navItems, bottomNavItems, drawerProfile, appVersion, children }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const quickItems = navItems.filter((i) => i.quick);

  const groups = [];
  navItems.forEach((item) => {
    const groupLabel = item.group || 'More';
    let g = groups.find((x) => x.label === groupLabel);
    if (!g) { g = { label: groupLabel, items: [] }; groups.push(g); }
    g.items.push(item);
  });

  const renderLink = (item, onClick) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      onClick={onClick}
      className={({ isActive }) => 'dash-tab' + (isActive ? ' dash-tab-active' : '')}
    >
      {item.icon && <span className="dash-tab-icon">{item.icon}</span>}
      {item.label}
      {item.badge > 0 && <span className="dash-tab-badge">{item.badge > 9 ? '9+' : item.badge}</span>}
    </NavLink>
  );

  return (
    <div className={bottomNavItems ? 'dash-shell dash-shell-has-bottomnav' : 'dash-shell'}>
      <header className="dash-topbar">
        <div className="dash-topbar-left">
          <button
            className="dash-hamburger-btn"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
          <div className="dash-brand">
            <ToothMark size={30} />
            <div className="dash-brand-text">
              <span className="dash-brand-word">DentalMCQ</span>
              <span className="dash-brand-sub">{title}</span>
            </div>
          </div>
        </div>
        <div className="dash-topbar-user">
          <NotificationBell />
          {!bottomNavItems && <button onClick={handleLogout} className="btn-logout">Log out</button>}
        </div>
      </header>

      {/* Bottom nav replaces the quick-bar as primary navigation when present. */}
      {!bottomNavItems && (
        <nav className="dash-quickbar">
          {quickItems.map((item) => renderLink(item))}
        </nav>
      )}

      {/* Backdrop + side drawer — the full nav list, grouped, reachable via ☰ */}
      {drawerOpen && <div className="dash-drawer-backdrop" onClick={() => setDrawerOpen(false)} />}
      <aside className={drawerOpen ? 'dash-drawer dash-drawer-open' : 'dash-drawer'}>
        <div className="dash-drawer-head">
          <div className="dash-brand">
            <ToothMark size={28} />
            <div className="dash-brand-text">
              <span className="dash-brand-word">DentalMCQ</span>
              <span className="dash-brand-sub">{title}</span>
            </div>
          </div>
          <button className="dash-drawer-close" onClick={() => setDrawerOpen(false)} aria-label="Close menu">✕</button>
        </div>

        {bottomNavItems ? (
          <div className="dash-drawer-profile">
            <div className="dash-drawer-profile-avatar">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" />
              ) : (
                <span>{profile?.full_name?.[0]?.toUpperCase() || '👤'}</span>
              )}
            </div>
            <div>
              <div className="dash-drawer-profile-name">{profile?.full_name}</div>
              {drawerProfile ? (
                <>
                  <div className="dash-drawer-profile-package">{drawerProfile.packageName}</div>
                  {drawerProfile.expiresAt ? (
                    <div className="dash-drawer-profile-expiry">
                      Expires {fmtDate(drawerProfile.expiresAt)} · {daysLeft(drawerProfile.expiresAt)} days left
                    </div>
                  ) : (
                    <div className="dash-drawer-profile-expiry">Lifetime access</div>
                  )}
                </>
              ) : (
                <div className="dash-drawer-profile-expiry">No active subscription</div>
              )}
            </div>
          </div>
        ) : (
          <div className="dash-drawer-user">{profile?.full_name}</div>
        )}

        <div className="dash-drawer-body">
          {groups.map((g) => (
            <div key={g.label} className="dash-drawer-group">
              <div className="dash-drawer-group-label">{g.label}</div>
              {g.items.map((item) => renderLink(item, () => setDrawerOpen(false)))}
            </div>
          ))}
        </div>

        {bottomNavItems && (
          <div className="dash-drawer-footer">
            {appVersion && <div className="dash-drawer-version">{appVersion}</div>}
            <button onClick={handleLogout} className="dash-drawer-logout">Log out</button>
          </div>
        )}
      </aside>

      <InstallAppButton />

      <main className="dash-content">{children}</main>

      {bottomNavItems && (
        <nav className="dash-bottomnav">
          {bottomNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => 'dash-bottomnav-tab' + (isActive ? ' dash-bottomnav-tab-active' : '')}
            >
              <span className="dash-bottomnav-icon">
                {item.icon}
                {item.badge > 0 && <span className="dash-bottomnav-badge">{item.badge > 9 ? '9+' : item.badge}</span>}
              </span>
              <span className="dash-bottomnav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
