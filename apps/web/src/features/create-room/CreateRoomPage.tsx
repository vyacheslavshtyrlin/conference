import { notifications } from "@mantine/notifications";
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
          color: "teal",
        });
        navigate(`/комната/${room.slug}`);
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
    <div className="page-shell">
      <div className="home-hero">
        <button
          className="home-cta"
          disabled={createRoomMutation.isPending}
          onClick={handleCreateRoom}
        >
          {createRoomMutation.isPending ? (
            <>
              <span className="spinner" />
              Создаем комнату...
            </>
          ) : (
            <>
              Создать встречу
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                width={18}
                height={18}
              >
                <path d="M4 10h12M11 5l5 5-5 5" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
