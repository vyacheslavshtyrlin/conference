import { Box, Button } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCreateRoomMutation } from "../../shared/api/roomQueries";
import { creatorTokenKey } from "../../shared/storage/sessionStorageKeys";

export function CreateRoomPage() {
  const navigate = useNavigate();
  const createRoomMutation = useCreateRoomMutation();

  const handleCreateRoom = () => {
    createRoomMutation.mutate(undefined, {
      onSuccess: (room) => {
        sessionStorage.setItem(creatorTokenKey(room.slug), room.creatorToken);
        notifications.show({
          title: "Комната создана",
          message: "Проверьте камеру и микрофон перед входом.",
          color: "violet",
        });
        navigate(`/r/${room.slug}`);
      },
      onError: (error) => {
        notifications.show({
          color: "red",
          title: "Не удалось создать комнату",
          message: error instanceof Error ? error.message : "Попробуйте еще раз.",
        });
      },
    });
  };

  return (
    <Box className="page-shell">
      <Box className="home-hero">
        <Box className="home-action-stage">
          <Box className="home-comet-scene" aria-hidden="true">
            <span className="home-star home-star--a" />
            <span className="home-star home-star--b" />
            <span className="home-star home-star--c" />
            <span className="home-star home-star--d" />
            <span className="home-orbit home-orbit--outer" />
            <span className="home-orbit home-orbit--inner" />
            <span className="home-comet">
              <span className="home-comet__tail" />
              <span className="home-comet__core" />
            </span>
          </Box>

          <Button
            className="home-cta"
            loading={createRoomMutation.isPending}
            loaderProps={{ type: "oval" }}
            rightSection={!createRoomMutation.isPending ? <ArrowRight size={18} /> : undefined}
            onClick={handleCreateRoom}
          >
            {createRoomMutation.isPending ? "Создаем комнату..." : "Создать встречу"}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
