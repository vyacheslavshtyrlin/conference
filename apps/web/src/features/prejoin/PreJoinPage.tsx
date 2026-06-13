import { Alert, Badge, Box, Button, Group, Loader, Paper, Stack, Switch, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { AlertCircle, ArrowRight, Camera, CameraOff, Mic } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useJoinRoomMutation, useRoom } from "../../shared/api/roomQueries";
import { creatorTokenKey } from "../../shared/storage/sessionStorageKeys";
import { useLocalMediaStore } from "../../shared/stores/localMediaStore";
import { useRoomStore } from "../../shared/stores/roomStore";

type PreJoinPageProps = { slug: string };

function CameraPreview({ enabled }: { enabled: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setPreviewError(null);
      return;
    }

    let stream: MediaStream | null = null;
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        setPreviewError(null);
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPreviewError(
          err instanceof Error &&
            (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")
            ? "Доступ к камере запрещен."
            : "Не удалось получить доступ к камере.",
        );
      });

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [enabled]);

  return (
    <Box className="camera-preview">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ display: enabled && !previewError ? "block" : "none" }}
      />

      {!enabled && (
        <Box className="camera-placeholder">
          <CameraOff size={32} strokeWidth={1.5} />
          <Text component="p">Камера выключена</Text>
        </Box>
      )}

      {enabled && previewError && (
        <Box className="camera-placeholder">
          <AlertCircle size={32} strokeWidth={1.5} />
          <Text component="p">{previewError}</Text>
        </Box>
      )}
    </Box>
  );
}

export function PreJoinPage({ slug }: PreJoinPageProps) {
  const roomQuery = useRoom(slug);
  const joinMutation = useJoinRoomMutation();
  const displayName = useLocalMediaStore((s) => s.displayName);
  const micEnabled = useLocalMediaStore((s) => s.micEnabled);
  const cameraEnabled = useLocalMediaStore((s) => s.cameraEnabled);
  const setDisplayName = useLocalMediaStore((s) => s.setDisplayName);
  const setMicEnabled = useLocalMediaStore((s) => s.setMicEnabled);
  const setCameraEnabled = useLocalMediaStore((s) => s.setCameraEnabled);
  const setPrejoinRoom = useRoomStore((s) => s.setPrejoinRoom);
  const setJoinResult = useRoomStore((s) => s.setJoinResult);

  useEffect(() => {
    if (roomQuery.data) setPrejoinRoom({ slug, roomId: roomQuery.data.roomId });
    else setPrejoinRoom({ slug });
  }, [roomQuery.data, setPrejoinRoom, slug]);

  if (roomQuery.isLoading) {
    return (
      <Box className="page-shell">
        <Paper className="prejoin-loading" role="status">
          <Box className="prejoin-loading__preview" />
          <Box className="prejoin-loading__content">
            <Loader size="xs" color="teal" />
            <Text component="span">Проверяем комнату...</Text>
          </Box>
        </Paper>
      </Box>
    );
  }

  const canJoin = displayName.trim().length > 0;
  const isExpiredOrMissing = roomQuery.isError;

  const handleJoin = () => {
    if (!canJoin) {
      notifications.show({
        color: "red",
        title: "Укажите имя",
        message: "Введите имя, которое увидят другие участники.",
      });
      return;
    }

    const creatorToken = sessionStorage.getItem(creatorTokenKey(slug)) ?? undefined;

    joinMutation.mutate(
      { slug, displayName: displayName.trim(), creatorToken },
      {
        onSuccess: (result) => {
          setJoinResult({
            participantId: result.participantId,
            isCreator: result.isCreator,
            signalingToken: result.token,
            signalingUrl: result.signalingUrl,
          });
        },
        onError: (err) => {
          notifications.show({
            color: "red",
            title: "Не удалось войти в комнату",
            message: err instanceof Error ? err.message : "Попробуйте позже.",
          });
        },
      },
    );
  };

  const isActive = roomQuery.data?.status === "active";

  return (
    <Box className="page-shell">
      <Box className="prejoin-grid">
        <Paper className="glass-panel">
          <Group justify="space-between" align="center" mb={20}>
            <Badge className="prejoin-room-tag" variant="light">{slug}</Badge>
            <Badge
              className={`room-badge ${isActive ? "room-badge--active" : "room-badge--inactive"}`}
              leftSection={<span className="room-badge-dot" />}
              variant="light"
            >
              {isActive ? "Активна" : "Ожидает"}
            </Badge>
          </Group>

          <Title order={2} className="prejoin-title">Готовы подключиться?</Title>
          <Text component="p" className="prejoin-subtitle">
            Проверьте имя, микрофон и камеру перед входом.
          </Text>

          {isExpiredOrMissing && (
            <Alert
              className="alert alert--error"
              color="red"
              icon={<AlertCircle size={16} />}
              mb={18}
            >
              Комната недоступна. Возможно, срок действия истек. Попросите новую ссылку.
            </Alert>
          )}

          <Stack gap={18}>
            <TextInput
              id="display-name"
              label="Ваше имя"
              placeholder="Алексей"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleJoin();
              }}
              classNames={{ root: "form-field", label: "form-label", input: "form-input" }}
            />

            <Stack className="toggle-rows" gap={10}>
              <Group className="toggle-row" justify="space-between" wrap="nowrap">
                <Group className="toggle-row-label" gap={10}>
                  <Mic size={16} strokeWidth={1.8} />
                  <Text component="span">Войти с микрофоном</Text>
                </Group>
                <Switch
                  checked={micEnabled}
                  onChange={(e) => setMicEnabled(e.currentTarget.checked)}
                  aria-label="Войти с микрофоном"
                />
              </Group>

              <Group className="toggle-row" justify="space-between" wrap="nowrap">
                <Group className="toggle-row-label" gap={10}>
                  <Camera size={16} strokeWidth={1.8} />
                  <Text component="span">Войти с камерой</Text>
                </Group>
                <Switch
                  checked={cameraEnabled}
                  onChange={(e) => setCameraEnabled(e.currentTarget.checked)}
                  aria-label="Войти с камерой"
                />
              </Group>
            </Stack>

            <Button
              className="join-btn"
              disabled={!canJoin || isExpiredOrMissing}
              loading={joinMutation.isPending}
              loaderProps={{ type: "oval" }}
              rightSection={!joinMutation.isPending ? <ArrowRight size={17} /> : undefined}
              onClick={handleJoin}
            >
              {joinMutation.isPending ? "Подключаемся..." : "Войти в комнату"}
            </Button>
          </Stack>
        </Paper>

        <Paper className="glass-panel">
          <Text component="p" className="preview-panel-title">Проверка устройств</Text>
          <CameraPreview enabled={cameraEnabled} />
          <Text component="p" className="camera-hint">
            {cameraEnabled
              ? "Трансляция начнется только после входа в комнату."
              : "Включите камеру, чтобы увидеть превью."}
          </Text>
        </Paper>
      </Box>
    </Box>
  );
}
