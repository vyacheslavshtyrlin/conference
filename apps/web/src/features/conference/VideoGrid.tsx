import type { Participant } from "@conference/contracts";
import { ActionIcon, Box, Button, Text } from "@mantine/core";
import { RotateCcw, X } from "lucide-react";
import type { CSSProperties } from "react";
import { useState } from "react";
import type { RemoteTrackInfo } from "../../shared/webrtc/useConference";
import { hasLiveVideoTrack, RemoteAudio, VideoTile } from "./VideoTile";

type VideoGridProps = {
  selfParticipantId: string;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  localCameraEnabled: boolean;
  localScreenEnabled: boolean;
  participants: Participant[];
  remoteVideoTracks: RemoteTrackInfo[];
  remoteAudioTracks: RemoteTrackInfo[];
  activeSpeakerParticipantId: string | null;
  onShareLink?: () => void | Promise<void>;
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
  isActiveSpeaker?: boolean;
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

function tileHasMedia(tile: TileInfo): boolean {
  return !tile.cameraOff && hasLiveVideoTrack(tile.stream, tile.track);
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
  activeSpeakerParticipantId,
  onShareLink,
}: VideoGridProps) {
  const [fullscreenTile, setFullscreenTile] = useState<TileInfo | null>(null);
  const [fullscreenZoom, setFullscreenZoom] = useState(1);
  const [spotlightTileKey, setSpotlightTileKey] = useState<string | null>(null);
  const self = participants.find((p) => p.participantId === selfParticipantId);
  const remoteParticipants = participants.filter((p) => p.participantId !== selfParticipantId);
  const hasOnlySelf = remoteParticipants.length === 0;

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
          label: `Экран: ${self?.displayName ?? "Вы"}`,
          stream: screenStream,
          track: null,
          muted: true,
        }
      : screenSharingRemote
        ? {
            key: `${screenSharingRemote.participantId}:screen`,
            label: `Экран: ${screenSharingRemote.displayName}`,
            stream: null,
            track: remoteScreenTrack!.track,
            muted: false,
          }
        : remoteScreenTrack
          ? {
              key: `${remoteScreenTrack.participantId}:screen`,
              label: "Демонстрация экрана",
              stream: null,
              track: remoteScreenTrack.track,
              muted: false,
            }
        : null;

  const cameraTiles = [
    {
      key: selfParticipantId,
      label: "Вы",
      isCreator: self?.isCreator,
      stream: localStream,
      track: null,
      muted: true,
      cameraOff: !localCameraEnabled,
      isActiveSpeaker: activeSpeakerParticipantId === selfParticipantId,
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
          isActiveSpeaker: activeSpeakerParticipantId === p.participantId,
        };
      }),
  ].filter((tile) => tile.key !== activeScreenParticipantId);

  const tileCount = cameraTiles.length;
  const spotlightTile =
    !activeScreenTile && tileCount > 1
      ? cameraTiles.find((tile) => tile.key === spotlightTileKey && tileHasMedia(tile)) ?? null
      : null;
  const sideTiles = spotlightTile
    ? cameraTiles.filter((tile) => tile.key !== spotlightTile.key)
    : cameraTiles;
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
        <Box
          className={`video-stage video-stage--screen ${
            cameraTiles.length > 0 ? "video-stage--with-participants" : ""
          }`}
        >
          <Box className="video-stage__main">
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
          </Box>

          {cameraTiles.length > 0 && (
            <Box className="video-stage__participants" aria-label="Участники">
              {cameraTiles.map((tile) => (
                <VideoTile
                  key={tile.key}
                  label={tile.label}
                  isCreator={tile.isCreator}
                  stream={tile.stream}
                  track={tile.track}
                  muted={tile.muted}
                  cameraOff={tile.cameraOff}
                  activeSpeaker={tile.isActiveSpeaker}
                  fullscreenLabel={`Открыть ${tile.label} на весь экран`}
                  onOpenFullscreen={tileHasMedia(tile) ? () => openFullscreen(tile) : undefined}
                />
              ))}
            </Box>
          )}
        </Box>
      ) : (
        <Box className="video-grid-shell">
          {spotlightTile ? (
            <Box className="video-stage video-stage--spotlight video-stage--with-participants">
              <Box className="video-stage__main">
                <VideoTile
                  key={spotlightTile.key}
                  label={spotlightTile.label}
                  isCreator={spotlightTile.isCreator}
                  stream={spotlightTile.stream}
                  track={spotlightTile.track}
                  muted={spotlightTile.muted}
                  cameraOff={spotlightTile.cameraOff}
                  selected
                  activeSpeaker={spotlightTile.isActiveSpeaker}
                  fullscreenLabel={`Открыть ${spotlightTile.label} на весь экран`}
                  onSelect={() => setSpotlightTileKey(null)}
                  onOpenFullscreen={() => openFullscreen(spotlightTile)}
                />
              </Box>

              <Box className="video-stage__participants" aria-label="Участники">
                {sideTiles.map((tile) => (
                  <VideoTile
                    key={tile.key}
                    label={tile.label}
                    isCreator={tile.isCreator}
                    stream={tile.stream}
                    track={tile.track}
                    muted={tile.muted}
                    cameraOff={tile.cameraOff}
                    activeSpeaker={tile.isActiveSpeaker}
                    fullscreenLabel={`Открыть ${tile.label} на весь экран`}
                    onSelect={tileHasMedia(tile) ? () => setSpotlightTileKey(tile.key) : undefined}
                    onOpenFullscreen={tileHasMedia(tile) ? () => openFullscreen(tile) : undefined}
                  />
                ))}
              </Box>
            </Box>
          ) : (
            <Box className={getGridClass(tileCount)}>
              {cameraTiles.map((tile) => (
                <VideoTile
                  key={tile.key}
                  label={tile.label}
                  isCreator={tile.isCreator}
                  stream={tile.stream}
                  track={tile.track}
                  muted={tile.muted}
                  cameraOff={tile.cameraOff}
                  activeSpeaker={tile.isActiveSpeaker}
                  fullscreenLabel={`Открыть ${tile.label} на весь экран`}
                  onSelect={tileCount > 1 && tileHasMedia(tile) ? () => setSpotlightTileKey(tile.key) : undefined}
                  onOpenFullscreen={tileHasMedia(tile) ? () => openFullscreen(tile) : undefined}
                />
              ))}
            </Box>
          )}

          {hasOnlySelf && (
            <Box className="room-invite" role="status">
              <Box>
                <Text component="p" className="room-invite__title">Вы в комнате</Text>
                <Text component="p" className="room-invite__text">Отправьте ссылку участникам, чтобы начать встречу.</Text>
              </Box>

              {onShareLink && (
                <Button
                  className="room-invite__btn"
                  variant="subtle"
                  onClick={() => {
                    void onShareLink();
                  }}
                >
                  Поделиться ссылкой
                </Button>
              )}
            </Box>
          )}
        </Box>
      )}

      {fullscreenTile && (
        <Box
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
          <Box className="media-fullscreen__zoom-value">{Math.round(fullscreenZoom * 100)}%</Box>
          <Text component="div" className="media-fullscreen__hint">Колесико - масштаб</Text>
          <Button
            className="media-fullscreen__reset"
            variant="subtle"
            leftSection={<RotateCcw size={13} />}
            onClick={() => setFullscreenZoom(1)}
          >
            100%
          </Button>

          <Box className="media-fullscreen__stage">
            <VideoTile
              label={fullscreenTile.label}
              isCreator={fullscreenTile.isCreator}
              stream={fullscreenTile.stream}
              track={fullscreenTile.track}
              muted={fullscreenTile.muted}
              cameraOff={fullscreenTile.cameraOff}
              presentation={fullscreenTile.presentation}
              activeSpeaker={fullscreenTile.isActiveSpeaker}
            />
          </Box>

          <ActionIcon
            className="media-fullscreen__close"
            variant="subtle"
            aria-label="Закрыть полноэкранный режим"
            title="Закрыть"
            onClick={closeFullscreen}
          >
            <X size={18} strokeWidth={2} />
          </ActionIcon>
        </Box>
      )}
    </>
  );
}
