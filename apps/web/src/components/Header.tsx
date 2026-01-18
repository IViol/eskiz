import { Link, useLocation } from "react-router-dom";
import "./Header.css";

export function Header() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="header">
      <nav className="nav">
        <Link to="/" className="logo">
          Eskiz
        </Link>
        <div className="nav-links">
          <Link to="/" className={isActive("/") ? "active" : ""}>
            Home
          </Link>
          <Link to="/how-it-works" className={isActive("/how-it-works") ? "active" : ""}>
            How It Works
          </Link>
          <Link to="/about" className={isActive("/about") ? "active" : ""}>
            About
          </Link>
        </div>
      </nav>
    </header>
  );
}
