import { useEffect, useRef } from "react";

type VideoTileProps = {
  label: string;
  isCreator?: boolean;
  stream?: MediaStream | null;
  track?: MediaStreamTrack | null;
  muted?: boolean;
  cameraOff?: boolean;
  presentation?: boolean;
  fullscreenLabel?: string;
  onOpenFullscreen?: () => void;
};

export function VideoTile({
  label,
  isCreator,
  stream,
  track,
  muted = false,
  cameraOff = false,
  presentation = false,
  fullscreenLabel = "Open fullscreen",
  onOpenFullscreen,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const internalStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (stream) {
      el.srcObject = stream;
      void el.play().catch(() => {});
      return () => { el.srcObject = null; };
    }

    if (track) {
      if (!internalStreamRef.current || internalStreamRef.current.getTracks()[0] !== track) {
        internalStreamRef.current = new MediaStream([track]);
      }
      el.srcObject = internalStreamRef.current;
      void el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }

    return () => { el.srcObject = null; };
  }, [stream, track]);

  const hasVideo = !cameraOff && (stream != null || track != null);
  const initials = label.slice(0, 2).toUpperCase();

  return (
    <div className={`video-tile ${presentation ? "video-tile--presentation" : ""}`}>
      {/* Video always rendered; visibility toggled */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        style={{ display: hasVideo ? "block" : "none" }}
      />

      {!hasVideo && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div className="video-tile__avatar">{initials}</div>
          <p className="video-tile__cam-off-text">Camera off</p>
        </div>
      )}

      <div className="video-tile__label">
        <span className="video-tile__name">{label}</span>
        {isCreator && <span className="video-tile__creator">Host</span>}
      </div>

      {hasVideo && onOpenFullscreen && (
        <button
          className="video-tile__fullscreen"
          type="button"
          aria-label={fullscreenLabel}
          title={fullscreenLabel}
          onClick={onOpenFullscreen}
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            width={16}
            height={16}
          >
            <path d="M7 3H3v4" />
            <path d="M13 3h4v4" />
            <path d="M17 13v4h-4" />
            <path d="M3 13v4h4" />
          </svg>
        </button>
      )}
    </div>
  );
}

type RemoteAudioProps = { track: MediaStreamTrack };

export function RemoteAudio({ track }: RemoteAudioProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    if (!streamRef.current || streamRef.current.getTracks()[0] !== track) {
      streamRef.current = new MediaStream([track]);
    }
    el.srcObject = streamRef.current;
    void el.play().catch(() => {});

    return () => { el.srcObject = null; };
  }, [track]);

  return <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />;
}
