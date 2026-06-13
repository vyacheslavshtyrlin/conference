import { Device } from "mediasoup-client";
import type { Consumer, Producer, Transport } from "mediasoup-client/types";
import { useEffect, useRef, useState } from "react";
import type {
  Participant,
  ParticipantMedia,
  ProducerAddedEvent,
} from "@conference/contracts";
import { SignalingClient, SignalingRequestError } from "../signaling/signalingClient";

export type RemoteTrackInfo = {
  track: MediaStreamTrack;
  participantId: string;
  producerId: string;
  source: "mic" | "camera" | "screen";
  kind: "audio" | "video";
};

export type ConferenceState = {
  connectionState: "connecting" | "connected" | "disconnected" | "error";
  participants: Participant[];
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  remoteVideoTracks: RemoteTrackInfo[];
  remoteAudioTracks: RemoteTrackInfo[];
  activeSpeakerParticipantId: string | null;
  micEnabled: boolean;
  micAvailable: boolean;
  cameraEnabled: boolean;
  cameraAvailable: boolean;
  screenEnabled: boolean;
  canShareScreen: boolean;
  error: string | null;
  clearError: () => void;
  toggleMic: () => void;
  toggleCamera: () => void;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => Promise<void>;
  leave: () => void;
};

type ConferenceOptions = {
  signalingUrl: string;
  token: string;
  participantId: string;
  initialMicEnabled: boolean;
  initialCameraEnabled: boolean;
  onLeave: () => void;
  onScreenShareBlocked?: (message: string) => void;
};

type TransportData = {
  id: string;
  iceParameters: object;
  iceCandidates: object[];
  dtlsParameters: object;
};

type ConsumeData = {
  id: string;
  producerId: string;
  kind: "audio" | "video";
  rtpParameters: object;
  participantId: string;
  source: "mic" | "camera" | "screen";
};

type InputDeviceAvailability = {
  mic: boolean;
  camera: boolean;
};

async function getInputDeviceAvailability(): Promise<InputDeviceAvailability> {
  if (!navigator.mediaDevices) {
    return { mic: false, camera: false };
  }

  if (typeof navigator.mediaDevices.enumerateDevices !== "function") {
    return { mic: true, camera: true };
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  return {
    mic: devices.some((device) => device.kind === "audioinput"),
    camera: devices.some((device) => device.kind === "videoinput"),
  };
}

export function useConference({
  signalingUrl,
  token,
  participantId: selfParticipantId,
  initialMicEnabled,
  initialCameraEnabled,
  onLeave,
  onScreenShareBlocked,
}: ConferenceOptions): ConferenceState {
  const [connectionState, setConnectionState] =
    useState<ConferenceState["connectionState"]>("connecting");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteVideoTracks, setRemoteVideoTracks] = useState<RemoteTrackInfo[]>(
    [],
  );
  const [remoteAudioTracks, setRemoteAudioTracks] = useState<RemoteTrackInfo[]>(
    [],
  );
  const [activeSpeakerParticipantId, setActiveSpeakerParticipantId] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(initialMicEnabled);
  const [micAvailable, setMicAvailable] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(initialCameraEnabled);
  const [cameraAvailable, setCameraAvailable] = useState(true);
  const [screenEnabled, setScreenEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canShareScreen] = useState(
    () => typeof navigator.mediaDevices?.getDisplayMedia === "function",
  );

  // WebRTC objects — never stored in React state
  const signalingRef = useRef<SignalingClient | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const audioProducerRef = useRef<Producer | null>(null);
  const videoProducerRef = useRef<Producer | null>(null);
  const screenProducerRef = useRef<Producer | null>(null);
  const consumersRef = useRef(new Map<string, Consumer>());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Mutable state used inside async closures (avoids stale closure on micEnabled/cameraEnabled)
  const mediaStateRef = useRef<ParticipantMedia>({
    mic: initialMicEnabled ? "on" : "off",
    camera: initialCameraEnabled ? "on" : "off",
    screen: "off",
  });
  const micEnabledRef = useRef(initialMicEnabled);
  const micAvailableRef = useRef(true);
  const cameraEnabledRef = useRef(initialCameraEnabled);
  const cameraAvailableRef = useRef(true);
  const screenEnabledRef = useRef(false);
  const leavingRef = useRef(false);
  const activeSpeakerParticipantIdRef = useRef<string | null>(null);
  const pendingActiveSpeakerParticipantIdRef = useRef<string | null>(null);
  const activeSpeakerTimerRef = useRef<number | null>(null);

  // Pending producers that arrive before recv transport is ready
  const pendingProducersRef = useRef<ProducerAddedEvent[]>([]);
  const recvReadyRef = useRef(false);

  // Keep onLeave stable without re-running the effect
  const onLeaveRef = useRef(onLeave);
  useEffect(() => {
    onLeaveRef.current = onLeave;
  }, [onLeave]);

  const onScreenShareBlockedRef = useRef(onScreenShareBlocked);
  useEffect(() => {
    onScreenShareBlockedRef.current = onScreenShareBlocked;
  }, [onScreenShareBlocked]);

  // ------------------------------------------------------------------ helpers

  function clearActiveSpeakerTimer(): void {
    if (activeSpeakerTimerRef.current === null) return;

    window.clearTimeout(activeSpeakerTimerRef.current);
    activeSpeakerTimerRef.current = null;
  }

  function setDisplayedActiveSpeaker(participantId: string | null): void {
    clearActiveSpeakerTimer();
    pendingActiveSpeakerParticipantIdRef.current = null;
    activeSpeakerParticipantIdRef.current = participantId;
    setActiveSpeakerParticipantId(participantId);
  }

  function scheduleActiveSpeaker(participantId: string | null): void {
    if (
      activeSpeakerParticipantIdRef.current === participantId &&
      pendingActiveSpeakerParticipantIdRef.current === null
    ) {
      return;
    }

    clearActiveSpeakerTimer();
    pendingActiveSpeakerParticipantIdRef.current = participantId;

    activeSpeakerTimerRef.current = window.setTimeout(() => {
      activeSpeakerTimerRef.current = null;
      pendingActiveSpeakerParticipantIdRef.current = null;
      activeSpeakerParticipantIdRef.current = participantId;
      setActiveSpeakerParticipantId(participantId);
    }, participantId ? 180 : 900);
  }

  function sendMediaState(partial: Partial<ParticipantMedia>): void {
    const next = { ...mediaStateRef.current, ...partial };
    mediaStateRef.current = next;
    signalingRef.current
      ?.request({ type: "media:setState", media: next })
      .catch(() => {});
  }

  function markMicUnavailable(): void {
    micAvailableRef.current = false;
    micEnabledRef.current = false;
    setMicAvailable(false);
    setMicEnabled(false);
    sendMediaState({ mic: "off" });
  }

  async function startMic(): Promise<void> {
    if (!micAvailableRef.current) return;

    const device = deviceRef.current;
    const sendTransport = sendTransportRef.current;
    if (!device || !sendTransport || !device.canProduce("audio")) {
      markMicUnavailable();
      return;
    }

    let micStream: MediaStream | null = null;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      const audioTrack = micStream.getAudioTracks()[0];
      if (!audioTrack || audioTrack.readyState !== "live") {
        micStream.getTracks().forEach((track) => track.stop());
        markMicUnavailable();
        return;
      }

      const producer = await sendTransport.produce({
        track: audioTrack,
        appData: { source: "mic" },
      });

      audioProducerRef.current = producer;

      const videoTracks = localStreamRef.current?.getVideoTracks() ?? [];
      const nextStream = new MediaStream([audioTrack, ...videoTracks]);
      localStreamRef.current = nextStream;
      setLocalStream(nextStream);

      micAvailableRef.current = true;
      micEnabledRef.current = true;
      setMicAvailable(true);
      setMicEnabled(true);
      sendMediaState({ mic: "on" });
    } catch (err) {
      micStream?.getTracks().forEach((track) => track.stop());
      markMicUnavailable();
      if (err instanceof Error && err.name !== "NotAllowedError") {
        setError("Microphone is unavailable: " + err.message);
      }
    }
  }

  function markCameraUnavailable(): void {
    cameraAvailableRef.current = false;
    cameraEnabledRef.current = false;
    setCameraAvailable(false);
    setCameraEnabled(false);
    sendMediaState({ camera: "off" });
  }

  async function startCamera(): Promise<void> {
    if (!cameraAvailableRef.current) return;

    const device = deviceRef.current;
    const sendTransport = sendTransportRef.current;
    if (!device || !sendTransport || !device.canProduce("video")) {
      markCameraUnavailable();
      return;
    }

    let cameraStream: MediaStream | null = null;
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      const videoTrack = cameraStream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState !== "live") {
        cameraStream.getTracks().forEach((track) => track.stop());
        markCameraUnavailable();
        return;
      }

      const producer = await sendTransport.produce({
        track: videoTrack,
        encodings: [
          { maxBitrate: 100_000 },
          { maxBitrate: 300_000 },
          { maxBitrate: 900_000 },
        ],
        codecOptions: { videoGoogleStartBitrate: 1000 },
        appData: { source: "camera" },
      });

      videoProducerRef.current = producer;

      const audioTracks = localStreamRef.current?.getAudioTracks() ?? [];
      const nextStream = new MediaStream([...audioTracks, videoTrack]);
      localStreamRef.current = nextStream;
      setLocalStream(nextStream);

      cameraAvailableRef.current = true;
      cameraEnabledRef.current = true;
      setCameraAvailable(true);
      setCameraEnabled(true);
      sendMediaState({ camera: "on" });
    } catch (err) {
      cameraStream?.getTracks().forEach((track) => track.stop());
      markCameraUnavailable();
      if (err instanceof Error && err.name !== "NotAllowedError") {
        setError("Camera is unavailable: " + err.message);
      }
    }
  }

  async function consumeProducer(event: ProducerAddedEvent): Promise<void> {
    const signaling = signalingRef.current;
    const device = deviceRef.current;
    const recvTransport = recvTransportRef.current;
    if (!signaling || !device || !recvTransport) return;
    if (event.participantId === selfParticipantId) return;

    try {
      const data = await signaling.request<ConsumeData>({
        type: "mediasoup:consume",
        transportId: recvTransport.id,
        producerId: event.producerId,
        rtpCapabilities: device.rtpCapabilities,
      });

      const consumer = await recvTransport.consume({
        id: data.id,
        producerId: data.producerId,
        kind: data.kind,
        rtpParameters: data.rtpParameters as Parameters<
          typeof recvTransport.consume
        >[0]["rtpParameters"],
      });

      consumersRef.current.set(event.producerId, consumer);

      const trackInfo: RemoteTrackInfo = {
        track: consumer.track,
        participantId: event.participantId,
        producerId: event.producerId,
        source: event.source,
        kind: event.kind,
      };

      if (event.kind === "audio") {
        setRemoteAudioTracks((prev) => [...prev, trackInfo]);
      } else {
        setRemoteVideoTracks((prev) => [...prev, trackInfo]);
      }

      // Guard against double-firing when both transportclose and observer:close fire together
      let consumerCleaned = false;
      function removeConsumerTrack() {
        if (consumerCleaned) return;
        consumerCleaned = true;
        consumersRef.current.delete(event.producerId);
        if (event.kind === "audio") {
          setRemoteAudioTracks((prev) =>
            prev.filter((t) => t.producerId !== event.producerId),
          );
        } else {
          setRemoteVideoTracks((prev) =>
            prev.filter((t) => t.producerId !== event.producerId),
          );
        }
      }

      // transportclose: recv transport closed (e.g., disconnect/leave)
      // observer:close: consumer.close() called explicitly (e.g., via producer:closed server event)
      consumer.on("transportclose", removeConsumerTrack);
      consumer.observer.on("close", removeConsumerTrack);
    } catch (err) {
      // Non-fatal: a producer may have already closed. Screen share failures are user-visible.
      if (event.source === "screen") {
        setError(
          err instanceof Error
            ? `Could not receive screen share: ${err.message}`
            : "Could not receive screen share.",
        );
      }
    }
  }

  async function createSendTransport(
    signaling: SignalingClient,
    device: Device,
  ): Promise<Transport> {
    const data = await signaling.request<TransportData>({
      type: "mediasoup:createWebRtcTransport",
      direction: "send",
    });

    const transport = device.createSendTransport({
      id: data.id,
      iceParameters: data.iceParameters as Parameters<
        typeof device.createSendTransport
      >[0]["iceParameters"],
      iceCandidates: data.iceCandidates as Parameters<
        typeof device.createSendTransport
      >[0]["iceCandidates"],
      dtlsParameters: data.dtlsParameters as Parameters<
        typeof device.createSendTransport
      >[0]["dtlsParameters"],
    });

    transport.on("connect", ({ dtlsParameters }, callback, errback) => {
      signaling
        .request({
          type: "mediasoup:connectTransport",
          transportId: transport.id,
          dtlsParameters,
        })
        .then(() => callback())
        .catch(errback);
    });

    transport.on(
      "produce",
      async ({ kind, rtpParameters, appData }, callback, errback) => {
        try {
          const { id } = await signaling.request<{ id: string }>({
            type: "mediasoup:produce",
            transportId: transport.id,
            kind,
            rtpParameters,
            appData: {
              source: (appData as { source?: string }).source ?? "mic",
            },
          });
          callback({ id });
        } catch (err) {
          errback(err as Error);
        }
      },
    );

    return transport;
  }

  async function createRecvTransport(
    signaling: SignalingClient,
    device: Device,
  ): Promise<Transport> {
    const data = await signaling.request<TransportData>({
      type: "mediasoup:createWebRtcTransport",
      direction: "recv",
    });

    const transport = device.createRecvTransport({
      id: data.id,
      iceParameters: data.iceParameters as Parameters<
        typeof device.createRecvTransport
      >[0]["iceParameters"],
      iceCandidates: data.iceCandidates as Parameters<
        typeof device.createRecvTransport
      >[0]["iceCandidates"],
      dtlsParameters: data.dtlsParameters as Parameters<
        typeof device.createRecvTransport
      >[0]["dtlsParameters"],
    });

    transport.on("connect", ({ dtlsParameters }, callback, errback) => {
      signaling
        .request({
          type: "mediasoup:connectTransport",
          transportId: transport.id,
          dtlsParameters,
        })
        .then(() => callback())
        .catch(errback);
    });

    return transport;
  }

  // ------------------------------------------------------------------ actions

  function toggleMic(): void {
    if (!micAvailableRef.current) return;

    const stream = localStreamRef.current;
    const audioTrack = stream?.getAudioTracks()[0];
    if (!audioTrack || audioTrack.readyState !== "live") {
      void startMic();
      return;
    }

    const newEnabled = !micEnabledRef.current;
    audioTrack.enabled = newEnabled;
    micEnabledRef.current = newEnabled;
    setMicEnabled(newEnabled);
    sendMediaState({ mic: newEnabled ? "on" : "muted" });
  }

  function toggleCamera(): void {
    if (!cameraAvailableRef.current) return;

    const stream = localStreamRef.current;
    const videoTrack = stream?.getVideoTracks()[0];
    if (!videoTrack || videoTrack.readyState !== "live") {
      void startCamera();
      return;
    }

    const newEnabled = !cameraEnabledRef.current;
    videoTrack.enabled = newEnabled;
    cameraEnabledRef.current = newEnabled;
    setCameraEnabled(newEnabled);
    sendMediaState({ camera: newEnabled ? "on" : "off" });
  }

  async function startScreenShare(): Promise<void> {
    if (!canShareScreen || screenEnabledRef.current) return;
    const sendTransport = sendTransportRef.current;
    if (!sendTransport) return;

    const activeScreenSharer = participants.find(
      (p) => p.participantId !== selfParticipantId && p.media.screen === "on",
    );
    if (activeScreenSharer) {
      onScreenShareBlockedRef.current?.(
        `${activeScreenSharer.displayName} is already sharing their screen.`,
      );
      return;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      if (!track) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const producer = await sendTransport.produce({
        track,
        appData: { source: "screen" },
      });

      screenProducerRef.current = producer;
      screenStreamRef.current = stream;
      screenEnabledRef.current = true;
      setScreenStream(stream);
      setScreenEnabled(true);
      sendMediaState({ screen: "on" });

      track.onended = () => {
        void stopScreenShare();
      };
    } catch (err) {
      stream?.getTracks().forEach((t) => t.stop());
      if (err instanceof Error && err.name !== "NotAllowedError") {
        const isScreenShareConflict =
          err.message.toLowerCase().includes("active screen share") ||
          (err instanceof SignalingRequestError &&
            err.code === "MEDIASOUP_ERROR" &&
            err.message.toLowerCase().includes("screen share"));

        if (isScreenShareConflict) {
          onScreenShareBlockedRef.current?.(
            "Someone else is already sharing their screen.",
          );
          return;
        }
        setError("Screen share failed: " + err.message);
      }
    }
  }

  async function stopScreenShare(): Promise<void> {
    const producer = screenProducerRef.current;
    screenProducerRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    screenEnabledRef.current = false;
    setScreenStream(null);
    setScreenEnabled(false);
    sendMediaState({ screen: "off" });

    if (!producer) return;

    try {
      await signalingRef.current?.request({
        type: "mediasoup:closeProducer",
        producerId: producer.id,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not stop screen share on server: ${err.message}`
          : "Could not stop screen share on server.",
      );
    } finally {
      producer.close();
    }
  }

  function leave(): void {
    if (leavingRef.current) return;
    leavingRef.current = true;

    signalingRef.current?.request({ type: "room:leave" }).catch(() => {});
    signalingRef.current?.close();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    sendTransportRef.current?.close();
    recvTransportRef.current?.close();

    setConnectionState("disconnected");
    setLocalStream(null);
    setScreenStream(null);

    onLeaveRef.current();
  }

  // ------------------------------------------------------------------ main effect

  useEffect(() => {
    // Guard: if invoked without valid params (e.g. no join result), do nothing
    if (!signalingUrl || !token || !selfParticipantId) return;

    const signaling = new SignalingClient();
    signalingRef.current = signaling;

    // Register server push handlers before connecting so no events are missed
    signaling.on("room:snapshot", (event) => {
      setParticipants(event.participants);
    });

    signaling.on("participant:joined", (event) => {
      setParticipants((prev) => {
        const exists = prev.some(
          (p) => p.participantId === event.participant.participantId,
        );
        return exists ? prev : [...prev, event.participant];
      });
    });

    signaling.on("participant:left", (event) => {
      setParticipants((prev) =>
        prev.filter((p) => p.participantId !== event.participantId),
      );
      if (
        activeSpeakerParticipantIdRef.current === event.participantId ||
        pendingActiveSpeakerParticipantIdRef.current === event.participantId
      ) {
        setDisplayedActiveSpeaker(null);
      }
    });

    signaling.on("participant:mediaChanged", (event) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.participantId === event.participantId
            ? { ...p, media: event.media }
            : p,
        ),
      );
    });

    signaling.on("participant:activeSpeakerChanged", (event) => {
      scheduleActiveSpeaker(event.participantId);
    });

    signaling.on("producer:added", (event) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.participantId === event.participantId
            ? { ...p, media: { ...p.media, [event.source]: "on" } }
            : p,
        ),
      );

      if (recvReadyRef.current) {
        void consumeProducer(event);
      } else {
        pendingProducersRef.current.push(event);
      }
    });

    signaling.on("producer:closed", (event) => {
      consumersRef.current.get(event.producerId)?.close();
      setParticipants((prev) =>
        prev.map((p) =>
          p.participantId === event.participantId
            ? { ...p, media: { ...p.media, [event.source]: "off" } }
            : p,
        ),
      );
    });

    signaling.on("disconnect", () => {
      if (!leavingRef.current) {
        setConnectionState("disconnected");
        setError("Disconnected from signaling server.");
      }
    });

    const run = async () => {
      try {
        await signaling.connect(signalingUrl, token);

        // Explicit join confirmation. The server auto-joins via token on connect,
        // but sending room:join makes the intent explicit per the contract spec.
        await signaling.request({ type: "room:join" });

        // Load mediasoup device with server router capabilities
        const rtpCapabilities = await signaling.request({
          type: "mediasoup:getRouterRtpCapabilities",
        });

        const device = new Device();
        await device.load({
          routerRtpCapabilities: rtpCapabilities as Parameters<
            typeof device.load
          >[0]["routerRtpCapabilities"],
        });
        deviceRef.current = device;

        // Create recv transport first so we can consume existing producers right away
        const recvTransport = await createRecvTransport(signaling, device);
        recvTransportRef.current = recvTransport;
        recvReadyRef.current = true;

        // Consume producers that arrived during setup
        for (const event of pendingProducersRef.current) {
          await consumeProducer(event);
        }
        pendingProducersRef.current = [];

        // Always create a send transport (needed for screen share even when mic/camera off)
        const sendTransport = await createSendTransport(signaling, device);
        sendTransportRef.current = sendTransport;

        const inputAvailability = await getInputDeviceAvailability().catch(() => ({
          mic: true,
          camera: true,
        }));

        micAvailableRef.current = inputAvailability.mic;
        cameraAvailableRef.current = inputAvailability.camera;
        setMicAvailable(inputAvailability.mic);
        setCameraAvailable(inputAvailability.camera);

        const unavailableMedia: Partial<ParticipantMedia> = {};
        if (!inputAvailability.mic) {
          micEnabledRef.current = false;
          setMicEnabled(false);
          unavailableMedia.mic = "off";
        }
        if (!inputAvailability.camera) {
          cameraEnabledRef.current = false;
          setCameraEnabled(false);
          unavailableMedia.camera = "off";
        }
        if (Object.keys(unavailableMedia).length > 0) {
          sendMediaState(unavailableMedia);
        }

        // Acquire and publish local media
        const wantAudio = initialMicEnabled && inputAvailability.mic;
        const wantVideo = initialCameraEnabled && inputAvailability.camera;

        if (wantAudio || wantVideo) {
          try {
            let stream: MediaStream;
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                audio: wantAudio,
                video: wantVideo
                  ? { width: { ideal: 1280 }, height: { ideal: 720 } }
                  : false,
              });
            } catch (firstErr) {
              if (
                wantAudio &&
                wantVideo &&
                firstErr instanceof Error &&
                (firstErr.name === "NotFoundError" || firstErr.name === "NotReadableError")
              ) {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
              } else {
                throw firstErr;
              }
            }

            localStreamRef.current = stream;
            setLocalStream(stream);

            const audioTrack = stream.getAudioTracks()[0];
            let didProduceAudio = false;
            if (audioTrack && device.canProduce("audio")) {
              audioTrack.enabled = initialMicEnabled;
              const producer = await sendTransport.produce({
                track: audioTrack,
                appData: { source: "mic" },
              });
              audioProducerRef.current = producer;
              didProduceAudio = true;
            }

            const videoTrack = stream.getVideoTracks()[0];
            let didProduceVideo = false;
            if (videoTrack && videoTrack.readyState === "live" && device.canProduce("video")) {
              videoTrack.enabled = initialCameraEnabled;
              const producer = await sendTransport.produce({
                track: videoTrack,
                encodings: [
                  { maxBitrate: 100_000 },
                  { maxBitrate: 300_000 },
                  { maxBitrate: 900_000 },
                ],
                codecOptions: { videoGoogleStartBitrate: 1000 },
                appData: { source: "camera" },
              });
              videoProducerRef.current = producer;
              didProduceVideo = true;
            }

            const nextMicAvailable = wantAudio ? didProduceAudio : true;
            micAvailableRef.current = nextMicAvailable;
            micEnabledRef.current = didProduceAudio && initialMicEnabled;
            setMicAvailable(nextMicAvailable);
            setMicEnabled(didProduceAudio && initialMicEnabled);

            const nextCameraAvailable = wantVideo ? didProduceVideo : true;
            cameraAvailableRef.current = nextCameraAvailable;
            cameraEnabledRef.current = didProduceVideo && initialCameraEnabled;
            setCameraAvailable(nextCameraAvailable);
            setCameraEnabled(didProduceVideo && initialCameraEnabled);

            sendMediaState({
              mic: didProduceAudio && initialMicEnabled ? "on" : "off",
              camera: didProduceVideo && initialCameraEnabled ? "on" : "off",
            });
          } catch (mediaErr) {
            const msg =
              mediaErr instanceof Error
                ? mediaErr.name === "NotAllowedError"
                  ? "Camera or microphone access was denied."
                  : mediaErr.message
                : "Could not access media devices.";
            setError(msg);
            micAvailableRef.current = !wantAudio;
            micEnabledRef.current = false;
            setMicAvailable(!wantAudio);
            setMicEnabled(false);
            cameraAvailableRef.current = !wantVideo;
            cameraEnabledRef.current = false;
            setCameraAvailable(!wantVideo);
            setCameraEnabled(false);
            sendMediaState({ mic: "off", camera: "off" });
            // Non-fatal — continue connected without media
          }
        }

        setConnectionState("connected");
      } catch (err) {
        if (!leavingRef.current) {
          setConnectionState("error");
          setError(err instanceof Error ? err.message : "Connection failed.");
        }
      }
    };

    void run();

    return () => {
      clearActiveSpeakerTimer();
      if (!leavingRef.current) {
        leavingRef.current = true;
        signaling.request({ type: "room:leave" }).catch(() => {});
        signaling.close();
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        screenStreamRef.current?.getTracks().forEach((t) => t.stop());
        sendTransportRef.current?.close();
        recvTransportRef.current?.close();
      }
    };
  }, []); // intentionally empty — runs once on mount, cleaned up on unmount

  return {
    connectionState,
    participants,
    localStream,
    screenStream,
    remoteVideoTracks,
    remoteAudioTracks,
    activeSpeakerParticipantId,
    micEnabled,
    micAvailable,
    cameraEnabled,
    cameraAvailable,
    screenEnabled,
    canShareScreen,
    error,
    clearError: () => setError(null),
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    leave,
  };
}
