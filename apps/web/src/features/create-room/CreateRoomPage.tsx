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
          title: "Room created",
          message: "Check your camera and mic before joining.",
          color: "teal",
        });
        navigate(`/r/${room.slug}`);
      },
      onError: (error) => {
        notifications.show({
          color: "red",
          title: "Could not create room",
          message: error instanceof Error ? error.message : "Try again later.",
        });
      },
    });
  };

  return (
    <div className="page-shell">
      <div className="home-hero">
        <div className="home-eyebrow">
          <span className="home-eyebrow-dot" />
          End-to-end encrypted
        </div>

        <h1>
          Meet, without<br />
          <em>the friction.</em>
        </h1>

        <p>
          Instant video rooms. No downloads, no accounts.<br />
          Share a link and you're in.
        </p>

        <button
          className="home-cta"
          disabled={createRoomMutation.isPending}
          onClick={handleCreateRoom}
        >
          {createRoomMutation.isPending ? (
            <>
              <span className="spinner" />
              Creating room…
            </>
          ) : (
            <>
              Start a meeting
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

        <div className="home-features">
          {["No install required", "HD video & audio", "Screen sharing", "Up to 30 min free"].map(
            (f) => (
              <span key={f} className="home-feature">
                <span className="home-feature-dot" />
                {f}
              </span>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
