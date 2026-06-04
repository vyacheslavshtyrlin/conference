import type { Participant } from "@conference/contracts";

type ParticipantListProps = { participants: Participant[] };

function IconMicSmall({ state }: { state: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" width={13} height={13}>
      <path d="M8 1.5a2 2 0 0 0-2 2v4a2 2 0 0 0 4 0v-4a2 2 0 0 0-2-2Z" />
      <path d="M12.5 7v.5a4.5 4.5 0 0 1-9 0V7" />
      <line x1="8" y1="12.5" x2="8" y2="14.5" />
      <line x1="5.5" y1="14.5" x2="10.5" y2="14.5" />
      {state !== "on" && <line x1="2" y1="2" x2="14" y2="14" />}
    </svg>
  );
}

function IconCamSmall({ state }: { state: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" width={13} height={13}>
      <polygon points="15 5 10.5 8 15 11 15 5" />
      <rect x="1" y="3.5" width="9.5" height="9" rx="1.5" />
      {state !== "on" && <line x1="2" y1="2" x2="14" y2="14" />}
    </svg>
  );
}

function IconScreenSmall() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" width={13} height={13}>
      <rect x="1" y="2" width="14" height="10" rx="1.5" />
      <line x1="5.5" y1="14" x2="10.5" y2="14" />
      <line x1="8" y1="12" x2="8" y2="14" />
    </svg>
  );
}

export function ParticipantList({ participants }: ParticipantListProps) {
  if (participants.length === 0) {
    return <p className="participant-empty">No participants yet.</p>;
  }

  return (
    <div>
      {participants.map((p) => {
        const micClass =
          p.media.mic === "on" ? "media-chip--on" :
          p.media.mic === "muted" ? "media-chip--muted" :
          "media-chip--off";

        const camClass = p.media.camera === "on" ? "media-chip--on" : "media-chip--off";
        const screenOn = p.media.screen === "on";

        return (
          <div key={p.participantId} className="participant-item">
            <div className="participant-avatar">
              {p.displayName.slice(0, 2).toUpperCase()}
            </div>

            <div className="participant-info">
              <div className="participant-name">
                {p.displayName}
                {p.isCreator && <span className="participant-creator-badge">Host</span>}
              </div>
              <div className="participant-state">{p.connectionState}</div>
            </div>

            <div className="participant-media">
              <div className={`media-chip ${micClass}`}>
                <IconMicSmall state={p.media.mic} />
              </div>
              <div className={`media-chip ${camClass}`}>
                <IconCamSmall state={p.media.camera} />
              </div>
              {screenOn && (
                <div className="media-chip media-chip--on">
                  <IconScreenSmall />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
