import type { Participant } from "@conference/contracts";
import type { CSSProperties } from "react";
import { useState } from "react";
import type { RemoteTrackInfo } from "../../shared/webrtc/useConference";
import { RemoteAudio, VideoTile } from "./VideoTile";

type VideoGridProps = {
  selfParticipantId: string;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  localCameraEnabled: boolean;
  localScreenEnabled: boolean;
  participants: Participant[];
  remoteVideoTracks: RemoteTrackInfo[];
  remoteAudioTracks: RemoteTrackInfo[];
};

type TileInfo = {
  key: string;
  label: string;
  isCreator?: boolean;
  stream: MediaStream | null;
  track: MediaStreamTrack | null;
  muted: boolean;
  cameraOff?: boolean;
  presentation?: boolean;
};

function getGridClass(count: number): string {
  if (count <= 1) return "video-grid video-grid--1x1";
  if (count <= 2) return "video-grid video-grid--2x1";
  if (count <= 3) return "video-grid video-grid--3x1";
  if (count <= 4) return "video-grid video-grid--2x2";
  if (count <= 6) return "video-grid video-grid--3x2";
  if (count <= 9) return "video-grid video-grid--3x3";
  return "video-grid video-grid--4x3";
}

function clampZoom(value: number): number {
  return Math.min(4, Math.max(1, value));
}

export function VideoGrid({
  selfParticipantId,
  localStream,
  screenStream,
  localCameraEnabled,
  localScreenEnabled,
  participants,
  remoteVideoTracks,
  remoteAudioTracks,
}: VideoGridProps) {
  const [fullscreenTile, setFullscreenTile] = useState<TileInfo | null>(null);
  const [fullscreenZoom, setFullscreenZoom] = useState(1);
  const self = participants.find((p) => p.participantId === selfParticipantId);
  const remoteParticipants = participants.filter((p) => p.participantId !== selfParticipantId);

  const cameraTrackByParticipant = new Map<string, RemoteTrackInfo>();
  for (const t of remoteVideoTracks) {
    if (t.source === "camera") cameraTrackByParticipant.set(t.participantId, t);
  }

  const remoteScreenTrack = remoteVideoTracks.find(
    (t) => t.source === "screen" && t.participantId !== selfParticipantId,
  );
  const screenSharingRemote = remoteScreenTrack
    ? remoteParticipants.find((p) => p.participantId === remoteScreenTrack.participantId)
    : undefined;
  const activeScreenParticipantId =
    localScreenEnabled && screenStream
      ? selfParticipantId
      : remoteScreenTrack?.participantId;

  const activeScreenTile =
    localScreenEnabled && screenStream
      ? {
          key: `${selfParticipantId}:screen`,
          label: `${self?.displayName ?? "You"} (screen)`,
          stream: screenStream,
          track: null,
          muted: true,
        }
      : screenSharingRemote
        ? {
            key: `${screenSharingRemote.participantId}:screen`,
            label: `${screenSharingRemote.displayName} (screen)`,
            stream: null,
            track: remoteScreenTrack!.track,
            muted: false,
          }
        : remoteScreenTrack
          ? {
              key: `${remoteScreenTrack.participantId}:screen`,
              label: "Screen share",
              stream: null,
              track: remoteScreenTrack.track,
              muted: false,
            }
        : null;

  const cameraTiles = [
    {
      key: selfParticipantId,
      label: self?.displayName ?? "You",
      isCreator: self?.isCreator,
      stream: localStream,
      track: null,
      muted: true,
      cameraOff: !localCameraEnabled,
    },
    ...remoteParticipants
      .filter((p) => p.participantId !== activeScreenParticipantId)
      .map((p) => {
      const cameraInfo = cameraTrackByParticipant.get(p.participantId);
      return {
        key: p.participantId,
        label: p.displayName,
        isCreator: p.isCreator,
        stream: null,
        track: cameraInfo?.track ?? null,
        muted: false,
        cameraOff: p.media.camera !== "on" || !cameraInfo,
      };
    }),
  ].filter((tile) => tile.key !== activeScreenParticipantId);

  const tileCount = cameraTiles.length;
  const openFullscreen = (tile: TileInfo) => {
    setFullscreenZoom(1);
    setFullscreenTile(tile);
  };

  const closeFullscreen = () => {
    setFullscreenTile(null);
    setFullscreenZoom(1);
  };

  return (
    <>
      {/* Hidden audio elements per remote track */}
      {remoteAudioTracks.map((t) => (
        <RemoteAudio key={t.producerId} track={t.track} />
      ))}

      {activeScreenTile ? (
        <div
          className={`video-stage video-stage--screen ${
            cameraTiles.length > 0 ? "video-stage--with-participants" : ""
          }`}
        >
          <div className="video-stage__main">
            <VideoTile
              key={activeScreenTile.key}
              label={activeScreenTile.label}
              stream={activeScreenTile.stream}
              track={activeScreenTile.track}
              muted={activeScreenTile.muted}
              presentation
              fullscreenLabel={`Открыть ${activeScreenTile.label} на весь экран`}
              onOpenFullscreen={() => openFullscreen({ ...activeScreenTile, presentation: true })}
            />
          </div>

          {cameraTiles.length > 0 && (
            <div className="video-stage__participants" aria-label="Participants">
              {cameraTiles.map((tile) => (
                <VideoTile
                  key={tile.key}
                  label={tile.label}
                  isCreator={tile.isCreator}
                  stream={tile.stream}
                  track={tile.track}
                  muted={tile.muted}
                  cameraOff={tile.cameraOff}
                  fullscreenLabel={`Открыть ${tile.label} на весь экран`}
                  onOpenFullscreen={() => openFullscreen(tile)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className={getGridClass(tileCount)}>
          {cameraTiles.map((tile) => (
            <VideoTile
              key={tile.key}
              label={tile.label}
              isCreator={tile.isCreator}
              stream={tile.stream}
              track={tile.track}
              muted={tile.muted}
              cameraOff={tile.cameraOff}
              fullscreenLabel={`Открыть ${tile.label} на весь экран`}
              onOpenFullscreen={() => openFullscreen(tile)}
            />
          ))}
        </div>
      )}

      {fullscreenTile && (
        <div
          className="media-fullscreen"
          role="dialog"
          aria-modal="true"
          aria-label={fullscreenTile.label}
          style={{ "--media-zoom": fullscreenZoom } as CSSProperties}
          onWheel={(event) => {
            event.preventDefault();
            setFullscreenZoom((zoom) => clampZoom(zoom + (event.deltaY < 0 ? 0.18 : -0.18)));
          }}
        >
          <div className="media-fullscreen__zoom-value">{Math.round(fullscreenZoom * 100)}%</div>

          <div className="media-fullscreen__stage">
            <VideoTile
              label={fullscreenTile.label}
              isCreator={fullscreenTile.isCreator}
              stream={fullscreenTile.stream}
              track={fullscreenTile.track}
              muted={fullscreenTile.muted}
              cameraOff={fullscreenTile.cameraOff}
              presentation={fullscreenTile.presentation}
            />
          </div>

          <button
            className="media-fullscreen__close"
            type="button"
            aria-label="Закрыть полноэкранный режим"
            title="Закрыть"
            onClick={closeFullscreen}
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              width={18}
              height={18}
            >
              <path d="M4 4l12 12" />
              <path d="M16 4L4 16" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
