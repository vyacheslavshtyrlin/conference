import { Drawer } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useLocalMediaStore } from "../../shared/stores/localMediaStore";
import { useRoomStore } from "../../shared/stores/roomStore";
import { useConference } from "../../shared/webrtc/useConference";
import { VideoGrid } from "./VideoGrid";
import { ParticipantList } from "./ParticipantList";

type ConferenceRoomPageProps = { slug: string };

/* ── Inline SVG icons ─────────────────────────────────────── */
function IconMic({ on }: { on: boolean }) {
  return on ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}>
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 11.9 5.2" />
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
      <path d="M9 9v3a3 3 0 0 0 2.83 3" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

function IconCamera({ on }: { on: boolean }) {
  return on ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}>
      <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34" />
      <line x1="23" y1="7" x2="23" y2="17" />
      <path d="M17 12l6-5" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

function IconScreen({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}>
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconLeave() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function ConferenceRoomPage({ slug }: ConferenceRoomPageProps) {
  const [participantsOpen, participantsDrawer] = useDisclosure(false);

  const micEnabled = useLocalMediaStore((s) => s.micEnabled);
  const cameraEnabled = useLocalMediaStore((s) => s.cameraEnabled);
  const participantId = useRoomStore((s) => s.participantId);
  const signalingToken = useRoomStore((s) => s.signalingToken);
  const signalingUrl = useRoomStore((s) => s.signalingUrl);
  const resetRoom = useRoomStore((s) => s.resetRoom);

  const hasJoinResult = Boolean(participantId && signalingToken && signalingUrl);

  const conference = useConference(
    hasJoinResult
      ? {
          signalingUrl: signalingUrl!,
          token: signalingToken!,
          participantId: participantId!,
          initialMicEnabled: micEnabled,
          initialCameraEnabled: cameraEnabled,
          onLeave: () => resetRoom(),
          onScreenShareBlocked: (message) => {
            notifications.show({
              color: "yellow",
              title: "Screen share is already active",
              message,
            });
          },
        }
      : {
          signalingUrl: "",
          token: "",
          participantId: "",
          initialMicEnabled: false,
          initialCameraEnabled: false,
          onLeave: () => resetRoom(),
          onScreenShareBlocked: (message) => {
            notifications.show({
              color: "yellow",
              title: "Screen share is already active",
              message,
            });
          },
        },
  );

  if (!hasJoinResult) {
    return (
      <div className="page-shell">
        <div className="alert alert--warn" style={{ maxWidth: 480, width: "100%" }}>
          No join result found.{" "}
          <button
            onClick={() => resetRoom()}
            style={{ background: "none", border: "none", color: "inherit", textDecoration: "underline", cursor: "pointer", padding: 0, font: "inherit" }}
          >
            Back to pre-join
          </button>
        </div>
      </div>
    );
  }

  const {
    connectionState,
    participants,
    localStream,
    screenStream,
    remoteVideoTracks,
    remoteAudioTracks,
    screenEnabled,
    canShareScreen,
    error,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    leave,
  } = conference;

  const connDotClass = `conn-dot conn-dot--${connectionState}`;

  return (
    <div className="conf-shell">
      {/* ── Topbar ── */}
      <div className="conf-topbar">
        <div className="conf-topbar-left">
          <a className="app-logo" href="/" onClick={(e) => { e.preventDefault(); }}>
            <span className="app-logo-dot" />
            Comet
          </a>
          <span className="conf-room-code">{slug}</span>
        </div>

        <div className="conf-topbar-right">
          {error && (
            <span className="alert alert--error" style={{ padding: "4px 10px", margin: 0, fontSize: 12 }}>
              {error}
              <button className="alert-close" onClick={conference.clearError}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" width={12} height={12}>
                  <line x1="3" y1="3" x2="13" y2="13" /><line x1="13" y1="3" x2="3" y2="13" />
                </svg>
              </button>
            </span>
          )}
          {connectionState === "disconnected" && (
            <button
              onClick={() => resetRoom()}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--warn)", fontSize: 12, padding: 0, font: "inherit" }}
            >
              Reconnect
            </button>
          )}
          <div className="conf-conn">
            <span className={connDotClass} />
            {connectionState}
          </div>
        </div>
      </div>

      {/* ── Video area ── */}
      <div className="conf-video-area">
        <VideoGrid
          selfParticipantId={participantId!}
          localStream={localStream}
          screenStream={screenStream}
          localCameraEnabled={conference.cameraEnabled}
          localScreenEnabled={screenEnabled}
          participants={participants}
          remoteVideoTracks={remoteVideoTracks}
          remoteAudioTracks={remoteAudioTracks}
        />
      </div>

      {/* ── Control bar ── */}
      <div className="conf-control-bar">
        {/* Center: media controls */}
        <div className="ctrl-group" style={{ flex: 1 }} />

        <div className="ctrl-group">
          <button
            className={`ctrl-btn ${conference.micEnabled ? "ctrl-btn--on" : ""}`}
            onClick={toggleMic}
            title={conference.micEnabled ? "Mute" : "Unmute"}
            aria-label={conference.micEnabled ? "Mute microphone" : "Unmute microphone"}
          >
            <IconMic on={conference.micEnabled} />
          </button>

          <button
            className={`ctrl-btn ${conference.cameraEnabled ? "ctrl-btn--on" : ""}`}
            onClick={toggleCamera}
            title={conference.cameraEnabled ? "Turn camera off" : "Turn camera on"}
            aria-label={conference.cameraEnabled ? "Turn camera off" : "Turn camera on"}
          >
            <IconCamera on={conference.cameraEnabled} />
          </button>

          {canShareScreen && (
            <button
              className={`ctrl-btn ${screenEnabled ? "ctrl-btn--on" : ""}`}
              onClick={screenEnabled ? () => { void stopScreenShare(); } : () => { void startScreenShare(); }}
              title={screenEnabled ? "Stop sharing" : "Share screen"}
              aria-label={screenEnabled ? "Stop screen share" : "Share screen"}
            >
              <IconScreen on={screenEnabled} />
            </button>
          )}
        </div>

        {/* Right: secondary actions */}
        <div className="ctrl-group" style={{ flex: 1, justifyContent: "flex-end" }}>
          <button className="ctrl-label-btn" onClick={participantsDrawer.open}>
            <IconUsers />
            Participants
            <span className="badge-count">{participants.length}</span>
          </button>

          <button className="ctrl-leave-btn" onClick={leave}>
            <IconLeave />
            Leave
          </button>
        </div>
      </div>

      {/* ── Participants drawer ── */}
      <Drawer
        opened={participantsOpen}
        onClose={participantsDrawer.close}
        title="Participants"
        position="right"
        size="sm"
        styles={{
          content: { backgroundColor: "#0a1020", borderLeft: "1px solid rgba(255,255,255,0.07)" },
          header: { backgroundColor: "#0a1020", borderBottom: "1px solid rgba(255,255,255,0.07)", paddingBottom: 14 },
          title: { fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: "#edf2f7" },
          close: { color: "#7a90a8" },
        }}
      >
        <ParticipantList participants={participants} />
      </Drawer>
    </div>
  );
}
