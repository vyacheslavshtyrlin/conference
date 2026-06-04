import type { Participant } from "@conference/contracts";
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

function getGridClass(count: number): string {
  if (count <= 1) return "video-grid video-grid--1x1";
  if (count <= 2) return "video-grid video-grid--2x1";
  if (count <= 3) return "video-grid video-grid--3x1";
  if (count <= 4) return "video-grid video-grid--2x2";
  if (count <= 6) return "video-grid video-grid--3x2";
  if (count <= 9) return "video-grid video-grid--3x3";
  return "video-grid video-grid--4x3";
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
            />
          ))}
        </div>
      )}
    </>
  );
}
