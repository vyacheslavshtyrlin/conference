import { ActionIcon, Box, Text } from "@mantine/core";
import { Maximize2 } from "lucide-react";
import type { MouseEvent } from "react";
import { useEffect, useRef } from "react";

type VideoTileProps = {
  label: string;
  isCreator?: boolean;
  stream?: MediaStream | null;
  track?: MediaStreamTrack | null;
  muted?: boolean;
  cameraOff?: boolean;
  presentation?: boolean;
  selected?: boolean;
  fullscreenLabel?: string;
  onSelect?: () => void;
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
  selected = false,
  fullscreenLabel = "Открыть на весь экран",
  onSelect,
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
  const isSelectable = Boolean(onSelect);

  return (
    <Box
      className={`video-tile ${presentation ? "video-tile--presentation" : ""} ${selected ? "video-tile--selected" : ""} ${isSelectable ? "video-tile--selectable" : ""}`}
      role={isSelectable ? "button" : undefined}
      tabIndex={isSelectable ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (!onSelect || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        onSelect();
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        style={{ display: hasVideo ? "block" : "none" }}
      />

      {!hasVideo && (
        <Box className="video-tile__empty">
          <Box className="video-tile__avatar">{initials}</Box>
          <Text component="p" className="video-tile__cam-off-text">Камера выключена</Text>
        </Box>
      )}

      <Box className="video-tile__label">
        <Text component="span" className="video-tile__name">{label}</Text>
        {isCreator && <Text component="span" className="video-tile__creator">Создатель</Text>}
      </Box>

      {hasVideo && onOpenFullscreen && (
        <ActionIcon
          className="video-tile__fullscreen"
          aria-label={fullscreenLabel}
          title={fullscreenLabel}
          variant="subtle"
          onClick={(event: MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            onOpenFullscreen();
          }}
        >
          <Maximize2 size={16} strokeWidth={1.8} />
        </ActionIcon>
      )}
    </Box>
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
