import { Alert, Badge, Box, Button, Group, Loader, Paper, Stack, Switch, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { AlertCircle, ArrowRight, Camera, CameraOff, Mic, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useJoinRoomMutation, useRoom } from "../../shared/api/roomQueries";
import { creatorTokenKey } from "../../shared/storage/sessionStorageKeys";
import { useLocalMediaStore } from "../../shared/stores/localMediaStore";
import { useRoomStore } from "../../shared/stores/roomStore";

type PreJoinPageProps = { slug: string };

type DeviceAvailability = {
  mic: boolean;
  camera: boolean;
  checked: boolean;
};

const UNKNOWN_DEVICE_AVAILABILITY: DeviceAvailability = {
  mic: true,
  camera: true,
  checked: false,
};

function formatParticipantCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? "участник"
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? "участника"
        : "участников";

  return `${count} ${word}`;
}

function isMissingMediaDeviceError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "NotFoundError" ||
      error.name === "DevicesNotFoundError" ||
      error.name === "OverconstrainedError")
  );
}

async function getDeviceAvailability(): Promise<DeviceAvailability> {
  if (!navigator.mediaDevices) {
    return { mic: false, camera: false, checked: true };
  }

  if (typeof navigator.mediaDevices.enumerateDevices !== "function") {
    return { mic: true, camera: true, checked: true };
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  return {
    mic: devices.some((device) => device.kind === "audioinput"),
    camera: devices.some((device) => device.kind === "videoinput"),
    checked: true,
  };
}

function CameraPreview({
  enabled,
  onMissingCamera,
}: {
  enabled: boolean;
  onMissingCamera: () => void;
}) {
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
        if (isMissingMediaDeviceError(err)) {
          onMissingCamera();
        }
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
  }, [enabled, onMissingCamera]);

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

function MicrophoneMeter({
  enabled,
  unavailable,
  onMissingMic,
}: {
  enabled: boolean;
  unavailable: boolean;
  onMissingMic: () => void;
}) {
  const [level, setLevel] = useState(0);
  const [meterError, setMeterError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || unavailable) {
      setLevel(0);
      setMeterError(null);
      return;
    }

    let cancelled = false;
    let frameId = 0;
    let stream: MediaStream | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let audioContext: AudioContext | null = null;

    const run = async () => {
      try {
        if (!navigator.mediaDevices) {
          onMissingMic();
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const audioTrack = stream.getAudioTracks()[0];
        if (!audioTrack || audioTrack.readyState !== "live") {
          onMissingMic();
          return;
        }

        const AudioContextCtor =
          window.AudioContext ??
          (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

        if (!AudioContextCtor) {
          setMeterError("Браузер не поддерживает проверку громкости.");
          return;
        }

        audioContext = new AudioContextCtor();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.72;
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const samples = new Uint8Array(analyser.fftSize);
        const updateLevel = () => {
          if (!analyser || cancelled) return;

          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (const sample of samples) {
            const value = (sample - 128) / 128;
            sum += value * value;
          }

          const rms = Math.sqrt(sum / samples.length);
          const nextLevel = Math.min(1, rms * 3.8);
          setLevel((prev) => prev * 0.62 + nextLevel * 0.38);
          frameId = requestAnimationFrame(updateLevel);
        };

        setMeterError(null);
        updateLevel();
      } catch (err) {
        if (cancelled) return;

        setLevel(0);
        if (isMissingMediaDeviceError(err)) {
          onMissingMic();
          return;
        }

        setMeterError(
          err instanceof Error &&
            (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")
            ? "Доступ к микрофону запрещен."
            : "Не удалось проверить громкость микрофона.",
        );
      }
    };

    void run();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      source?.disconnect();
      analyser?.disconnect();
      void audioContext?.close();
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [enabled, onMissingMic, unavailable]);

  const stateText = unavailable
    ? "Микрофон не найден"
    : enabled
      ? "Говорите, чтобы проверить уровень"
      : "Микрофон выключен";

  return (
    <Box className={`mic-meter ${enabled && !unavailable ? "mic-meter--active" : "mic-meter--idle"}`}>
      <Box className="mic-meter__header">
        <Group gap={8} wrap="nowrap">
          <Mic size={15} strokeWidth={1.9} />
          <Text component="span">Громкость микрофона</Text>
        </Group>
        <Text component="span" className="mic-meter__state">{stateText}</Text>
      </Box>

      <Box className="mic-meter__track" aria-label="Уровень громкости микрофона">
        <Box className="mic-meter__fill" style={{ width: `${Math.round(level * 100)}%` }} />
        <Box className="mic-meter__ticks" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, index) => (
            <span key={index} />
          ))}
        </Box>
      </Box>

      {meterError && <Text component="p" className="mic-meter__error">{meterError}</Text>}
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
  const [deviceAvailability, setDeviceAvailability] = useState<DeviceAvailability>(
    UNKNOWN_DEVICE_AVAILABILITY,
  );

  useEffect(() => {
    if (roomQuery.data) setPrejoinRoom({ slug, roomId: roomQuery.data.roomId });
    else setPrejoinRoom({ slug });
  }, [roomQuery.data, setPrejoinRoom, slug]);

  useEffect(() => {
    let cancelled = false;

    const syncDeviceAvailability = async () => {
      try {
        const next = await getDeviceAvailability();
        if (cancelled) return;

        setDeviceAvailability(next);
        if (!next.mic) setMicEnabled(false);
        if (!next.camera) setCameraEnabled(false);
      } catch {
        if (!cancelled) setDeviceAvailability((prev) => ({ ...prev, checked: true }));
      }
    };

    void syncDeviceAvailability();

    const mediaDevices = navigator.mediaDevices;
    mediaDevices?.addEventListener?.("devicechange", syncDeviceAvailability);

    return () => {
      cancelled = true;
      mediaDevices?.removeEventListener?.("devicechange", syncDeviceAvailability);
    };
  }, [setCameraEnabled, setMicEnabled]);

  const markMicUnavailable = useCallback(() => {
    setDeviceAvailability((prev) => ({ ...prev, mic: false, checked: true }));
    setMicEnabled(false);
  }, [setMicEnabled]);

  const markCameraUnavailable = useCallback(() => {
    setDeviceAvailability((prev) => ({ ...prev, camera: false, checked: true }));
    setCameraEnabled(false);
  }, [setCameraEnabled]);

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
  const micUnavailable = deviceAvailability.checked && !deviceAvailability.mic;
  const cameraUnavailable = deviceAvailability.checked && !deviceAvailability.camera;

  const handleMicChange = (checked: boolean) => {
    if (micUnavailable) return;
    setMicEnabled(checked);
  };

  const handleCameraChange = (checked: boolean) => {
    if (cameraUnavailable) return;
    setCameraEnabled(checked);
  };

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
  const participantCount = roomQuery.data?.participantCount ?? 0;

  return (
    <Box className="page-shell">
      <Box className="prejoin-grid">
        <Paper className="glass-panel">
          <Group justify="space-between" align="center" mb={20}>
            <Badge className="prejoin-room-tag" variant="light">{slug}</Badge>
            <Group gap={8} className="prejoin-room-status" justify="flex-end">
              <Badge
                className={`room-badge ${isActive ? "room-badge--active" : "room-badge--inactive"}`}
                leftSection={<span className="room-badge-dot" />}
                variant="light"
              >
                {isActive ? "Активна" : "Ожидает"}
              </Badge>
              <Badge
                className="room-count-badge"
                leftSection={<Users size={13} strokeWidth={1.8} />}
                variant="light"
              >
                {formatParticipantCount(participantCount)}
              </Badge>
            </Group>
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
              <Group className={`toggle-row ${micUnavailable ? "toggle-row--disabled" : ""}`} justify="space-between" wrap="nowrap">
                <Group className="toggle-row-label" gap={10}>
                  <Mic size={16} strokeWidth={1.8} />
                  <Text component="span">Войти с микрофоном</Text>
                  {micUnavailable && <Badge className="device-missing-badge" variant="light">Не найден</Badge>}
                </Group>
                <Switch
                  checked={micEnabled && !micUnavailable}
                  disabled={micUnavailable}
                  onChange={(e) => handleMicChange(e.currentTarget.checked)}
                  aria-label="Войти с микрофоном"
                />
              </Group>

              <Group className={`toggle-row ${cameraUnavailable ? "toggle-row--disabled" : ""}`} justify="space-between" wrap="nowrap">
                <Group className="toggle-row-label" gap={10}>
                  <Camera size={16} strokeWidth={1.8} />
                  <Text component="span">Войти с камерой</Text>
                  {cameraUnavailable && <Badge className="device-missing-badge" variant="light">Не найдена</Badge>}
                </Group>
                <Switch
                  checked={cameraEnabled && !cameraUnavailable}
                  disabled={cameraUnavailable}
                  onChange={(e) => handleCameraChange(e.currentTarget.checked)}
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
          <CameraPreview enabled={cameraEnabled && !cameraUnavailable} onMissingCamera={markCameraUnavailable} />
          <Text component="p" className="camera-hint">
            {cameraUnavailable
              ? "Камера не найдена на этом устройстве."
              : cameraEnabled
                ? "Трансляция начнется только после входа в комнату."
                : "Включите камеру, чтобы увидеть превью."}
          </Text>
          <MicrophoneMeter
            enabled={micEnabled && !micUnavailable}
            unavailable={micUnavailable}
            onMissingMic={markMicUnavailable}
          />
        </Paper>
      </Box>
    </Box>
  );
}
