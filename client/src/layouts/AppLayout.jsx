import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  Bookmark,
  Briefcase,
  Building2,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  FlaskConical,
  GraduationCap,
  Home,
  LayoutGrid,
  LogOut,
  MessageSquare,
  Moon,
  Search,
  Settings,
  Shield,
  Sun,
  User,
  UserPlus,
  Users,
  BedDouble,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../services/api.js';
import { useInterval } from '../hooks/index.js';
import { Avatar, Button, Menu, MenuItem, PageLoader } from '../components/ui.jsx';
import { RightRail } from './RightRail.jsx';
import { BrandMark } from './PublicLayout.jsx';

export const NAV = [
  { section: 'Community' },
  { to: '/feed', label: 'Home feed', icon: Home },
  { to: '/communities', label: 'Communities', icon: Users },
  { to: '/messages', label: 'Messages', icon: MessageSquare, count: 'messages' },
  { to: '/network', label: 'My network', icon: UserPlus },
  { section: 'Academics' },
  { to: '/resources', label: 'Notes & resources', icon: BookOpen },
  { to: '/departments', label: 'Departments & faculty', icon: Building2 },
  { to: '/research', label: 'Research hub', icon: FlaskConical },
  { section: 'Campus life' },
  { to: '/housing', label: 'Housing', icon: BedDouble },
  { to: '/events', label: 'Events', icon: CalendarDays },
  { to: '/careers', label: 'Careers', icon: Briefcase },
  { to: '/alumni', label: 'Alumni network', icon: GraduationCap },
  { section: 'You' },
  { to: '/saved', label: 'Saved items', icon: Bookmark },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function Brand() {
  return (
    <Link to="/feed" className="brand" aria-label="DIU Student Hub home">
      <BrandMark />
      <span className="brand-name hide-mobile-sm">
        DIU Student Hub
        <small>Independent community</small>
      </span>
    </Link>
  );
}

function TopSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const ref = useRef(null);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  useEffect(() => {
    // Ctrl/⌘+K or "/" focuses search (ignored while typing in another field).
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <form
      className="topbar-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim().length >= 2) {
          navigate(`/search?q=${encodeURIComponent(q.trim())}`);
          ref.current?.blur();
        }
      }}
    >
      <div className="input-icon">
        <Search size={17} aria-hidden="true" />
        <input ref={ref} className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search posts, people, notes, research…" aria-label="Search DIU Student Hub" aria-keyshortcuts="Control+K /" />
      </div>
      <kbd className="kbd" aria-hidden="true">
        {isMac ? '⌘K' : 'Ctrl K'}
      </kbd>
    </form>
  );
}

export default function AppLayout() {
  const { user, logout, isStaff } = useAuth();
  const { theme, toggleTheme, sidebarCollapsed, toggleSidebar } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [counts, setCounts] = useState({ notifications: 0, messages: 0 });
  const [drawer, setDrawer] = useState(false);

  const loadCounts = useCallback(async () => {
    try {
      const [n, m] = await Promise.all([api.get('/notifications/unread-count'), api.get('/conversations/unread-count')]);
      setCounts({ notifications: n.count, messages: m.count });
    } catch {
      /* ignore transient errors */
    }
  }, []);
  useEffect(() => {
    loadCounts();
  }, [loadCounts, location.pathname]);
  useInterval(loadCounts, 30000);
  useEffect(() => setDrawer(false), [location.pathname]);
  useEffect(() => {
    const h = () => loadCounts();
    window.addEventListener('hub:counts-changed', h);
    return () => window.removeEventListener('hub:counts-changed', h);
  }, [loadCounts]);

  // The right rail is for social pages; directory/marketplace pages use the full width for grids.
  const hideRail = !/^\/(feed|posts|communities|network|notifications|search|saved|u)(\/|$)/.test(location.pathname);

  const onLogout = async () => {
    await logout();
    toast.info('You have signed out.');
    navigate('/');
  };

  const [resent, setResent] = useState(false);
  const resend = async () => {
    try {
      const r = await api.post('/auth/resend-verification');
      setResent(true);
      toast.info(r.message);
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {user && !user.emailVerified && (
        <div className="banner">
          Please verify your email address.{' '}
          {resent ? 'Check your inbox.' : <button onClick={resend}>Resend link</button>}
        </div>
      )}
      <header className="topbar">
        <Brand />
        <TopSearch />
        <div className="topbar-actions">
          <Link to="/search" className="icon-btn show-mobile" aria-label="Search">
            <Search size={20} />
          </Link>
          <button className="icon-btn hide-mobile" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <Link to="/messages" className="icon-btn hide-mobile" aria-label={`Messages${counts.messages ? `, ${counts.messages} unread` : ''}`}>
            <MessageSquare size={20} />
            {counts.messages > 0 && <span className="dot">{counts.messages > 9 ? '9+' : counts.messages}</span>}
          </Link>
          <Link to="/notifications" className="icon-btn" aria-label={`Notifications${counts.notifications ? `, ${counts.notifications} unread` : ''}`}>
            <Bell size={20} />
            {counts.notifications > 0 && <span className="dot">{counts.notifications > 9 ? '9+' : counts.notifications}</span>}
          </Link>
          <Menu
            label="Account menu"
            trigger={({ toggle, ...aria }) => (
              <button className="profile-btn" onClick={toggle} {...aria}>
                <Avatar user={user} size="sm" />
              </button>
            )}
          >
            <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
              <div className="bold truncate">{user?.name}</div>
              <div className="xs muted truncate">{user?.email}</div>
            </div>
            <MenuItem icon={User} to={`/u/${user?._id}`}>
              My profile
            </MenuItem>
            <MenuItem icon={Bookmark} to="/saved">
              Saved items
            </MenuItem>
            <MenuItem icon={Settings} to="/settings">
              Settings
            </MenuItem>
            {isStaff && (
              <MenuItem icon={Shield} to="/admin">
                Admin & moderation
              </MenuItem>
            )}
            <MenuItem icon={theme === 'dark' ? Sun : Moon} onClick={toggleTheme}>
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </MenuItem>
            <MenuItem icon={LogOut} onClick={onLogout} danger>
              Sign out
            </MenuItem>
          </Menu>
        </div>
      </header>

      <div className={`shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${hideRail ? 'no-rail' : ''}`}>
        <nav className="sidebar" aria-label="Main navigation">
          <Link to={`/u/${user?._id}`} className="me-card" title="View my profile">
            <Avatar user={user} />
            <div className="me-text grow" style={{ lineHeight: 1.3 }}>
              <div className="bold truncate">{user?.name}</div>
              <div className="xs muted truncate">
                {[user?.department?.code, user?.affiliation].filter(Boolean).join(' · ')}
                {user?.affiliationVerified ? ' · verified' : ''}
              </div>
            </div>
          </Link>
          {NAV.map((item, i) =>
            item.section ? (
              <div key={i} className="nav-section">
                {item.section}
              </div>
            ) : (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title={item.label}>
                <item.icon size={19} aria-hidden="true" />
                <span className="nav-label">{item.label}</span>
                {item.count && counts[item.count] > 0 && <span className="nav-count">{counts[item.count]}</span>}
              </NavLink>
            )
          )}
          {isStaff && (
            <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Admin & moderation">
              <Shield size={19} aria-hidden="true" />
              <span className="nav-label">Admin & moderation</span>
            </NavLink>
          )}
          <Button variant="ghost" size="sm" className="collapse-btn" icon={sidebarCollapsed ? ChevronsRight : ChevronsLeft} onClick={toggleSidebar} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {sidebarCollapsed ? null : <span className="nav-label">Collapse</span>}
          </Button>
        </nav>

        <main id="main" className="main" tabIndex={-1}>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>

        {!hideRail && <RightRail />}
      </div>

      <nav className="bottom-nav" aria-label="Quick navigation">
        <NavLink to="/feed">
          <Home size={22} aria-hidden="true" />
          Home
        </NavLink>
        <NavLink to="/resources">
          <BookOpen size={22} aria-hidden="true" />
          Notes
        </NavLink>
        <NavLink to="/messages">
          <MessageSquare size={22} aria-hidden="true" />
          {counts.messages > 0 && <span className="dot" aria-hidden="true" />}
          Messages
        </NavLink>
        <NavLink to="/events">
          <CalendarDays size={22} aria-hidden="true" />
          Events
        </NavLink>
        <button onClick={() => setDrawer(true)} aria-haspopup="dialog" aria-expanded={drawer}>
          <LayoutGrid size={22} aria-hidden="true" />
          More
        </button>
      </nav>

      {drawer && (
        <>
          <div className="drawer-backdrop" onClick={() => setDrawer(false)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label="All sections">
            <div className="drawer-handle" aria-hidden="true" />
            <div className="drawer-grid">
              {NAV.filter((n) => !n.section).map((n) => (
                <Link key={n.to} to={n.to}>
                  <n.icon size={22} aria-hidden="true" />
                  {n.label}
                </Link>
              ))}
              <Link to={`/u/${user?._id}`}>
                <User size={22} aria-hidden="true" />
                My profile
              </Link>
              {isStaff && (
                <Link to="/admin">
                  <Shield size={22} aria-hidden="true" />
                  Admin
                </Link>
              )}
              <button onClick={toggleTheme}>
                {theme === 'dark' ? <Sun size={22} aria-hidden="true" /> : <Moon size={22} aria-hidden="true" />}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              <button onClick={onLogout}>
                <LogOut size={22} aria-hidden="true" />
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
