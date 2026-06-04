import { notifications } from "@mantine/notifications";
import { useEffect, useRef, useState } from "react";
import { useJoinRoomMutation, useRoom } from "../../shared/api/roomQueries";
import { creatorTokenKey } from "../../shared/storage/sessionStorageKeys";
import { useLocalMediaStore } from "../../shared/stores/localMediaStore";
import { useRoomStore } from "../../shared/stores/roomStore";

type PreJoinPageProps = { slug: string };

function CameraPreview({ enabled }: { enabled: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setPreviewError(null);
      return;
    }

    let stream: MediaStream | null = null;
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        setPreviewError(null);
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPreviewError(
          err instanceof Error &&
            (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")
            ? "Camera access was denied."
            : "Could not access camera.",
        );
      });

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [enabled]);

  return (
    <div className="camera-preview">
      {/* Hidden video always rendered so srcObject can be set */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ display: enabled && !previewError ? "block" : "none" }}
      />
      {!enabled && (
        <div className="camera-placeholder">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            width={32}
            height={32}
          >
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          <p>Camera is off</p>
        </div>
      )}
      {enabled && previewError && (
        <div className="camera-placeholder">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            width={32}
            height={32}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p>{previewError}</p>
        </div>
      )}
    </div>
  );
}

export function PreJoinPage({ slug }: PreJoinPageProps) {
  const roomQuery = useRoom(slug);
  const joinMutation = useJoinRoomMutation();
  const displayName = useLocalMediaStore((s) => s.displayName);
  const micEnabled = useLocalMediaStore((s) => s.micEnabled);
  const cameraEnabled = useLocalMediaStore((s) => s.cameraEnabled);
  const setDisplayName = useLocalMediaStore((s) => s.setDisplayName);
  const setMicEnabled = useLocalMediaStore((s) => s.setMicEnabled);
  const setCameraEnabled = useLocalMediaStore((s) => s.setCameraEnabled);
  const setPrejoinRoom = useRoomStore((s) => s.setPrejoinRoom);
  const setJoinResult = useRoomStore((s) => s.setJoinResult);

  useEffect(() => {
    if (roomQuery.data) setPrejoinRoom({ slug, roomId: roomQuery.data.roomId });
    else setPrejoinRoom({ slug });
  }, [roomQuery.data, setPrejoinRoom, slug]);

  const canJoin = displayName.trim().length > 0;
  const isExpiredOrMissing = roomQuery.isError;

  const handleJoin = () => {
    if (!canJoin) {
      notifications.show({
        color: "red",
        title: "Display name required",
        message: "Enter the name other participants will see.",
      });
      return;
    }

    const creatorToken = sessionStorage.getItem(creatorTokenKey(slug)) ?? undefined;

    joinMutation.mutate(
      { slug, displayName: displayName.trim(), creatorToken },
      {
        onSuccess: (result) => {
          setJoinResult({
            participantId: result.participantId,
            isCreator: result.isCreator,
            signalingToken: result.token,
            signalingUrl: result.signalingUrl,
          });
        },
        onError: (err) => {
          notifications.show({
            color: "red",
            title: "Could not join room",
            message: err instanceof Error ? err.message : "Try again later.",
          });
        },
      },
    );
  };

  const isActive = roomQuery.data?.status === "active";

  return (
    <div className="page-shell">
      <div className="prejoin-grid">
        {/* ─── Left panel: join form ─── */}
        <div className="glass-panel">
          {/* Room code + status row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <span className="prejoin-room-tag">{slug}</span>
            {!roomQuery.isLoading && (
              <span className={`room-badge ${isActive ? "room-badge--active" : "room-badge--inactive"}`}>
                <span className="room-badge-dot" />
                {roomQuery.data?.status ?? "Pending"}
              </span>
            )}
          </div>

          <h2 className="prejoin-title">Ready to join?</h2>
          <p className="prejoin-subtitle">Set up your display name and devices below.</p>

          {isExpiredOrMissing && (
            <div className="alert alert--error">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={16} height={16} style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="10" cy="10" r="8" />
                <line x1="10" y1="6" x2="10" y2="10" />
                <line x1="10" y1="13" x2="10.01" y2="13" />
              </svg>
              Room not available. It may have expired — ask for a new link.
            </div>
          )}

          <div className="form-field">
            <label className="form-label" htmlFor="display-name">
              Your name
            </label>
            <input
              id="display-name"
              className="form-input"
              type="text"
              placeholder="Alex"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleJoin();
              }}
            />
          </div>

          <div className="toggle-rows">
            <div className="toggle-row">
              <span className="toggle-row-label">
                <span className="toggle-row-icon">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}>
                    <path d="M10 2a2.5 2.5 0 0 0-2.5 2.5v5a2.5 2.5 0 0 0 5 0V4.5A2.5 2.5 0 0 0 10 2Z" />
                    <path d="M16 9.5v.5a6 6 0 0 1-12 0v-.5" />
                    <line x1="10" y1="16" x2="10" y2="19" />
                    <line x1="7" y1="19" x2="13" y2="19" />
                  </svg>
                </span>
                Microphone on when joining
              </span>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={micEnabled}
                  onChange={(e) => setMicEnabled(e.currentTarget.checked)}
                />
                <span className="toggle-track" />
              </label>
            </div>

            <div className="toggle-row">
              <span className="toggle-row-label">
                <span className="toggle-row-icon">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}>
                    <polygon points="19 6 13 10 19 14 19 6" />
                    <rect x="1" y="4" width="12" height="12" rx="2" />
                  </svg>
                </span>
                Camera on when joining
              </span>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={cameraEnabled}
                  onChange={(e) => setCameraEnabled(e.currentTarget.checked)}
                />
                <span className="toggle-track" />
              </label>
            </div>
          </div>

          <button
            className="join-btn"
            disabled={!canJoin || isExpiredOrMissing || joinMutation.isPending}
            onClick={handleJoin}
          >
            {joinMutation.isPending ? (
              <>
                <span className="spinner" />
                Joining…
              </>
            ) : (
              <>
                Join room
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={17} height={17}>
                  <path d="M4 10h12M11 5l5 5-5 5" />
                </svg>
              </>
            )}
          </button>
        </div>

        {/* ─── Right panel: camera preview ─── */}
        <div className="glass-panel">
          <p className="preview-panel-title">Device preview</p>
          <CameraPreview enabled={cameraEnabled} />
          <p className="camera-hint">
            {cameraEnabled
              ? "Your stream starts only after you click Join."
              : "Enable the camera toggle on the left to see a preview."}
          </p>
        </div>
      </div>
    </div>
  );
}
