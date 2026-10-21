import { Suspense } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { PageLoader } from '../components/ui.jsx';

export function BrandMark({ size = 20 }) {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 64 64">
        <defs>
          <linearGradient id="pbm" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#5a8bff" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <path d="M14 14h16c11 0 20 7 20 18s-9 18-20 18H14z" fill="none" stroke="url(#pbm)" strokeWidth="8" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <Link to="/" className="brand" style={{ marginBottom: 12 }}>
            <BrandMark />
            <span>DIU Student Hub</span>
          </Link>
          <p className="muted small" style={{ maxWidth: 360 }}>
            An independent, student-run community platform for the Dhaka International University community. Not officially operated, approved or endorsed by Dhaka International University.
          </p>
        </div>
        <div>
          <h4>Platform</h4>
          <ul>
            <li>
              <Link to="/register">Join</Link>
            </li>
            <li>
              <Link to="/login">Sign in</Link>
            </li>
            <li>
              <Link to="/about">About</Link>
            </li>
          </ul>
        </div>
        <div>
          <h4>Policies</h4>
          <ul>
            <li>
              <Link to="/guidelines">Community guidelines</Link>
            </li>
            <li>
              <Link to="/privacy">Privacy policy</Link>
            </li>
            <li>
              <Link to="/terms">Terms of use</Link>
            </li>
          </ul>
        </div>
        <div>
          <h4>Help</h4>
          <ul>
            <li>
              <Link to="/contact">Contact</Link>
            </li>
            <li>
              <Link to="/guidelines#copyright">Copyright takedown</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="container subtle xs" style={{ marginTop: 24 }}>
        © {new Date().getFullYear()} DIU Student Hub community project.
      </div>
    </footer>
  );
}

export default function PublicLayout() {
  const { isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="public-nav">
        <Link to="/" className="brand">
          <BrandMark />
          <span>DIU Student Hub</span>
        </Link>
        <nav aria-label="Site">
          <a href="/#features">Features</a>
          <a href="/#research">Research</a>
          <a href="/#events">Events</a>
          <Link to="/about">About</Link>
        </nav>
        <div className="row" style={{ marginLeft: 'auto' }}>
          <button className="icon-btn" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          {isAuthenticated ? (
            <Link to="/feed" className="btn btn-primary btn-sm">
              Open hub
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">
                Sign in
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Join free
              </Link>
            </>
          )}
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
