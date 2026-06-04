import { useNavigate } from "react-router-dom";

export function AppHeader() {
  const navigate = useNavigate();

  return (
    <header className="app-header">
      <a
        className="app-logo"
        href="/"
        onClick={(e) => {
          e.preventDefault();
          navigate("/");
        }}
      >
        <span className="app-logo-dot" />
        Comet
      </a>

      <span className="app-header-hint">Rooms expire after 30 min</span>

      <button className="header-new-btn" onClick={() => navigate("/")}>
        New room
      </button>
    </header>
  );
}
