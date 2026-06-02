import "@mantine/core/styles.css";

import { MantineProvider, Stack, Text, Title } from "@mantine/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

function App() {
  return (
    <MantineProvider>
      <Stack align="center" justify="center" mih="100vh" p="md">
        <Title order={1}>Conference MVP</Title>
        <Text ta="center" c="dimmed">
          Web placeholder is ready. Room, pre-join and conference UI are implemented in later phases.
        </Text>
      </Stack>
    </MantineProvider>
  );
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element was not found");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
