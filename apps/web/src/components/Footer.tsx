import "./Footer.css";

export function Footer() {
  return (
    <footer className="footer">
      <p>Eskiz v0.1.0</p>
      <div className="footer-links">
        <a href="https://github.com/IViol" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        <span className="footer-separator">·</span>
        <a href="https://violentov.com" target="_blank" rel="noopener noreferrer">
          Website
        </a>
      </div>
    </footer>
  );
}
