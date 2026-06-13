import type { Participant } from "@conference/contracts";
import { Badge, Box, Text, Tooltip } from "@mantine/core";
import { Mic, MicOff, MonitorUp, Video, VideoOff } from "lucide-react";

type ParticipantListProps = { participants: Participant[] };

function formatConnectionState(state: Participant["connectionState"]): string {
  switch (state) {
    case "online":
      return "Онлайн";
    default:
      return state;
  }
}

export function ParticipantList({ participants }: ParticipantListProps) {
  if (participants.length === 0) {
    return <Text component="p" className="participant-empty">Участников пока нет.</Text>;
  }

  return (
    <Box>
      {participants.map((p) => {
        const micClass =
          p.media.mic === "on" ? "media-chip--on" :
          p.media.mic === "muted" ? "media-chip--muted" :
          "media-chip--off";

        const camClass = p.media.camera === "on" ? "media-chip--on" : "media-chip--off";
        const screenOn = p.media.screen === "on";

        return (
          <Box key={p.participantId} className="participant-item">
            <Box className="participant-avatar">
              {p.displayName.slice(0, 2).toUpperCase()}
            </Box>

            <Box className="participant-info">
              <Box className="participant-name">
                <Text component="span">{p.displayName}</Text>
                {p.isCreator && (
                  <Badge className="participant-creator-badge" variant="filled">
                    Создатель
                  </Badge>
                )}
              </Box>
              <Text className="participant-state">{formatConnectionState(p.connectionState)}</Text>
            </Box>

            <Box className="participant-media">
              <Tooltip label={p.media.mic === "on" ? "Микрофон включен" : "Микрофон выключен"} withArrow>
                <Box className={`media-chip ${micClass}`}>
                  {p.media.mic === "on" ? <Mic size={13} /> : <MicOff size={13} />}
                </Box>
              </Tooltip>
              <Tooltip label={p.media.camera === "on" ? "Камера включена" : "Камера выключена"} withArrow>
                <Box className={`media-chip ${camClass}`}>
                  {p.media.camera === "on" ? <Video size={13} /> : <VideoOff size={13} />}
                </Box>
              </Tooltip>
              {screenOn && (
                <Tooltip label="Показывает экран" withArrow>
                  <Box className="media-chip media-chip--on">
                    <MonitorUp size={13} />
                  </Box>
                </Tooltip>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
