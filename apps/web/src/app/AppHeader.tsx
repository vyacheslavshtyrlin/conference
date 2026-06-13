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

      <button className="header-new-btn" onClick={() => navigate("/")}>
        Новая комната
      </button>
    </header>
  );
}
