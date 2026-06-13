import { Anchor, Button } from "@mantine/core";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function AppHeader() {
  const navigate = useNavigate();

  return (
    <header className="app-header">
      <Anchor
        className="app-logo"
        href="/"
        onClick={(e) => {
          e.preventDefault();
          navigate("/");
        }}
      >
        <span className="app-logo-comet" aria-hidden="true">
          <span className="app-logo-comet__tail" />
          <span className="app-logo-comet__wake" />
          <span className="app-logo-comet__core" />
          <span className="app-logo-comet__spark" />
        </span>
        Comet
      </Anchor>

      <Button
        className="header-new-btn"
        variant="subtle"
        leftSection={<Plus size={16} />}
        onClick={() => navigate("/")}
      >
        Новая комната
      </Button>
    </header>
  );
}
