import { ActionIcon, Alert, Anchor, Badge, Box, Button, Drawer, Group, Loader, Modal, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { Camera, CameraOff, LogOut, Mic, MicOff, MonitorUp, Share2, Users, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useLocalMediaStore } from "../../shared/stores/localMediaStore";
import { useRoomStore } from "../../shared/stores/roomStore";
import { useConference } from "../../shared/webrtc/useConference";
import { ParticipantList } from "./ParticipantList";
import { VideoGrid } from "./VideoGrid";

type ConferenceRoomPageProps = { slug: string };

function formatConferenceConnectionState(state: string): string {
  switch (state) {
    case "connecting":
      return "Подключение";
    case "connected":
      return "Подключено";
    case "disconnected":
      return "Нет связи";
    case "error":
      return "Ошибка";
    default:
      return state;
  }
}

export function ConferenceRoomPage({ slug }: ConferenceRoomPageProps) {
  const [participantsOpen, participantsDrawer] = useDisclosure(false);
  const [leaveConfirmOpen, leaveConfirm] = useDisclosure(false);
  const connectedToastShownRef = useRef(false);

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
              title: "Демонстрация уже запущена",
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
              title: "Демонстрация уже запущена",
              message,
            });
          },
        },
  );

  const {
    connectionState,
    participants,
    localStream,
    screenStream,
    remoteVideoTracks,
    remoteAudioTracks,
    activeSpeakerParticipantId,
    screenEnabled,
    canShareScreen,
    error,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    leave,
  } = conference;

  useEffect(() => {
    if (!hasJoinResult || connectedToastShownRef.current || connectionState !== "connected") return;

    connectedToastShownRef.current = true;
    notifications.show({
      color: "teal",
      title: "Вы подключились",
      message: "Комната готова к встрече.",
    });
  }, [connectionState, hasJoinResult]);

  if (!hasJoinResult) {
    return (
      <Box className="page-shell">
        <Alert className="alert alert--warn" color="yellow" maw={480} w="100%">
          Нет данных для входа.{" "}
          <Button variant="subtle" color="yellow" size="compact-sm" onClick={() => resetRoom()}>
            Вернуться к проверке устройств
          </Button>
        </Alert>
      </Box>
    );
  }

  const connDotClass = `conn-dot conn-dot--${connectionState}`;
  const remoteScreenParticipant = participants.find(
    (p) => p.participantId !== participantId && p.media.screen === "on",
  );
  const isScreenShareBusy = Boolean(remoteScreenParticipant && !screenEnabled);
  const isMicUnavailable = !conference.micAvailable;
  const isCameraUnavailable = !conference.cameraAvailable;

  const handleScreenShareClick = () => {
    if (screenEnabled) {
      void stopScreenShare();
      return;
    }

    if (isScreenShareBusy) {
      notifications.show({
        color: "yellow",
        title: "Экран уже показывают",
        message: `${remoteScreenParticipant?.displayName ?? "Другой участник"} сейчас демонстрирует экран.`,
      });
      return;
    }

    void startScreenShare();
  };

  const handleLeaveConfirm = () => {
    leaveConfirm.close();
    leave();
  };

  const handleShareLink = async () => {
    const shareUrl = `${window.location.origin}/r/${slug}`;
    const shareData = {
      title: "Comet",
      text: "Ссылка на трансляцию",
      url: shareUrl,
    };

    const copyShareUrl = async () => {
      await navigator.clipboard.writeText(shareUrl);
      notifications.show({
        color: "teal",
        title: "Ссылка скопирована",
        message: "Отправьте ее участникам встречи.",
      });
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await copyShareUrl();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;

      try {
        await copyShareUrl();
      } catch {
        notifications.show({
          color: "red",
          title: "Не удалось поделиться ссылкой",
          message: "Скопируйте адрес комнаты из строки браузера.",
        });
      }
    }
  };

  return (
    <Box className="conf-shell">
      <Box className="conf-topbar">
        <Group className="conf-topbar-left" gap={12}>
          <Anchor
            className="app-logo"
            href="/"
            onClick={(e) => {
              e.preventDefault();
            }}
          >
            <span className="app-logo-comet" aria-hidden="true">
              <span className="app-logo-comet__tail" />
              <span className="app-logo-comet__wake" />
              <span className="app-logo-comet__core" />
              <span className="app-logo-comet__spark" />
            </span>
            Comet
          </Anchor>
          <Badge className="conf-room-code" variant="light">{slug}</Badge>
        </Group>

        <Group className="conf-topbar-right" gap={10}>
          {error && (
            <Alert
              className="conf-error-alert"
              color="red"
              variant="light"
              py={4}
              px={10}
              withCloseButton
              closeButtonLabel="Закрыть"
              onClose={conference.clearError}
            >
              {error}
            </Alert>
          )}

          {connectionState === "disconnected" && (
            <Button
              variant="subtle"
              color="yellow"
              size="compact-sm"
              onClick={() => resetRoom()}
            >
              Подключиться заново
            </Button>
          )}

          <Button
            className="conf-share-btn"
            variant="subtle"
            leftSection={<Share2 size={18} />}
            aria-label="Поделиться ссылкой на трансляцию"
            title="Поделиться ссылкой"
            onClick={() => { void handleShareLink(); }}
          >
            <span className="conf-share-label">Поделиться</span>
          </Button>

          <Box className="conf-conn">
            <span className={connDotClass} />
            {formatConferenceConnectionState(connectionState)}
          </Box>
        </Group>
      </Box>

      <Box className="conf-video-area">
        {connectionState === "connecting" ? (
          <Box className="conference-loading" role="status">
            <Box className="conference-loading__tile" />
            <Box className="conference-loading__panel">
              <Loader size="xs" color="teal" />
              <Text component="span">Подключаемся к комнате...</Text>
            </Box>
          </Box>
        ) : (
          <VideoGrid
            selfParticipantId={participantId!}
            localStream={localStream}
            screenStream={screenStream}
            localCameraEnabled={conference.cameraEnabled}
            localScreenEnabled={screenEnabled}
            participants={participants}
            remoteVideoTracks={remoteVideoTracks}
            remoteAudioTracks={remoteAudioTracks}
            activeSpeakerParticipantId={activeSpeakerParticipantId}
            onShareLink={handleShareLink}
          />
        )}
      </Box>

      <Box className="conf-control-bar">
        <Box className="ctrl-spacer" />

        <Group className="ctrl-group" gap={8}>
          <ActionIcon
            className={`ctrl-btn ${conference.micEnabled ? "ctrl-btn--on" : ""} ${isMicUnavailable ? "ctrl-btn--disabled" : ""}`}
            variant="subtle"
            onClick={toggleMic}
            disabled={isMicUnavailable}
            title={
              isMicUnavailable
                ? "Микрофон недоступен"
                : conference.micEnabled
                  ? "Выключить микрофон"
                  : "Включить микрофон"
            }
            aria-label={
              isMicUnavailable
                ? "Микрофон недоступен"
                : conference.micEnabled
                  ? "Выключить микрофон"
                  : "Включить микрофон"
            }
          >
            {conference.micEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          </ActionIcon>

          <ActionIcon
            className={`ctrl-btn ${conference.cameraEnabled ? "ctrl-btn--on" : ""} ${isCameraUnavailable ? "ctrl-btn--disabled" : ""}`}
            variant="subtle"
            onClick={toggleCamera}
            disabled={isCameraUnavailable}
            title={
              isCameraUnavailable
                ? "Камера недоступна"
                : conference.cameraEnabled
                  ? "Выключить камеру"
                  : "Включить камеру"
            }
            aria-label={
              isCameraUnavailable
                ? "Камера недоступна"
                : conference.cameraEnabled
                  ? "Выключить камеру"
                  : "Включить камеру"
            }
          >
            {conference.cameraEnabled ? <Camera size={20} /> : <CameraOff size={20} />}
          </ActionIcon>

          {canShareScreen && (
            <ActionIcon
              className={`ctrl-btn ${screenEnabled ? "ctrl-btn--on" : ""} ${isScreenShareBusy ? "ctrl-btn--disabled" : ""}`}
              variant="subtle"
              onClick={handleScreenShareClick}
              title={screenEnabled ? "Остановить демонстрацию" : isScreenShareBusy ? "Экран уже показывают" : "Показать экран"}
              aria-label={screenEnabled ? "Остановить демонстрацию экрана" : isScreenShareBusy ? "Экран уже показывают" : "Показать экран"}
              aria-disabled={isScreenShareBusy}
            >
              <MonitorUp size={20} fill={screenEnabled ? "currentColor" : "none"} />
            </ActionIcon>
          )}
        </Group>

        <Group className="ctrl-group ctrl-group--secondary" gap={8}>
          <Button
            className="ctrl-label-btn"
            variant="subtle"
            leftSection={<Users size={18} />}
            rightSection={<Badge className="badge-count">{participants.length}</Badge>}
            onClick={participantsDrawer.open}
          >
            <span className="ctrl-label-text">Участники</span>
          </Button>

          <Button
            className="ctrl-leave-btn"
            variant="subtle"
            leftSection={<LogOut size={18} />}
            onClick={leaveConfirm.open}
          >
            <span className="ctrl-label-text">Выйти</span>
          </Button>
        </Group>
      </Box>

      <Drawer
        opened={participantsOpen}
        onClose={participantsDrawer.close}
        title="Участники"
        position="right"
        size="sm"
        withCloseButton
        closeButtonProps={{
          "aria-label": "Закрыть список участников",
          size: "lg",
        }}
        overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
        classNames={{
          content: "participants-drawer",
          header: "participants-drawer__header",
          body: "participants-drawer__body",
          title: "participants-drawer__title",
        }}
      >
        <ParticipantList participants={participants} />
      </Drawer>

      <Modal
        opened={leaveConfirmOpen}
        onClose={leaveConfirm.close}
        title="Выйти из комнаты?"
        centered
      >
        <Text c="dimmed" size="sm" mb="md">
          Вы отключитесь от звонка. Вернуться можно будет по ссылке комнаты, пока она активна.
        </Text>
        <Group justify="flex-end">
          <Button variant="subtle" onClick={leaveConfirm.close}>Остаться</Button>
          <Button color="red" leftSection={<X size={16} />} onClick={handleLeaveConfirm}>
            Выйти
          </Button>
        </Group>
      </Modal>
    </Box>
  );
}
