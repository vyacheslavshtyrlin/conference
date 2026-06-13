import type { Participant } from "@conference/contracts";
import { Badge, Box, Text, Tooltip } from "@mantine/core";
import { Mic, MicOff, MonitorUp, UserRound, Video, VideoOff } from "lucide-react";

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
    return (
      <Box className="participant-panel">
        <Box className="participant-empty">
          <UserRound size={28} strokeWidth={1.6} />
          <Text component="p">Участников пока нет.</Text>
        </Box>
      </Box>
    );
  }

  const onlineCount = participants.filter((p) => p.connectionState === "online").length;
  const screenCount = participants.filter((p) => p.media.screen === "on").length;

  return (
    <Box className="participant-panel">
      <Box className="participant-panel__summary">
        <Box>
          <Text component="p" className="participant-panel__eyebrow">В комнате</Text>
          <Text component="p" className="participant-panel__count">{participants.length}</Text>
        </Box>
        <Box className="participant-panel__metrics">
          <Badge className="participant-summary-badge participant-summary-badge--online" variant="light">
            Онлайн {onlineCount}
          </Badge>
          <Badge className="participant-summary-badge participant-summary-badge--screen" variant="light">
            Экран {screenCount}
          </Badge>
        </Box>
      </Box>

      <Box className="participant-list">
      {participants.map((p) => {
        const micClass =
          p.media.mic === "on" ? "media-chip--on" :
          p.media.mic === "muted" ? "media-chip--muted" :
          "media-chip--off";

        const camClass = p.media.camera === "on" ? "media-chip--on" : "media-chip--off";
        const screenOn = p.media.screen === "on";
        const micLabel =
          p.media.mic === "on"
            ? "Микрофон включен"
            : p.media.mic === "muted"
              ? "Микрофон выключен"
              : "Микрофон недоступен";

        return (
          <Box
            key={p.participantId}
            className={`participant-item ${screenOn ? "participant-item--screen" : ""}`}
          >
            <Box className="participant-avatar">
              {p.displayName.slice(0, 2).toUpperCase()}
              <span className="participant-avatar__status" aria-hidden="true" />
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
              <Text className="participant-state">
                {formatConnectionState(p.connectionState)}
                {screenOn ? " · показывает экран" : ""}
              </Text>
            </Box>

            <Box className="participant-media">
              <Tooltip label={micLabel} withArrow>
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
    </Box>
  );
}
