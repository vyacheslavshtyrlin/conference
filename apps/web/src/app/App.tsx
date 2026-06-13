import { QueryClientProvider } from "@tanstack/react-query";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { Route, Routes } from "react-router-dom";
import { CreateRoomPage } from "../features/create-room/CreateRoomPage";
import { RoomPage } from "../features/room/RoomPage";
import { queryClient } from "../shared/api/queryClient";
import { AppHeader } from "./AppHeader";
import { theme } from "./theme";

export function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <Notifications position="top-center" zIndex={9999} />
      <QueryClientProvider client={queryClient}>
        {/* AppHeader is sticky; ConferenceRoomPage uses position:fixed overlay when active */}
        <AppHeader />
        <main>
          <Routes>
            <Route path="/" element={<CreateRoomPage />} />
            <Route path="/комната/:slug" element={<RoomPage />} />
            <Route path="/r/:slug" element={<RoomPage />} />
          </Routes>
        </main>
      </QueryClientProvider>
    </MantineProvider>
  );
}
