import type { Participant } from "@conference/contracts";
import { create } from "zustand";

type RoomConnectionState = "idle" | "prejoin" | "joining" | "connected" | "disconnected" | "error";

type RoomState = {
  slug: string | null;
  roomId: string | null;
  participantId: string | null;
  isCreator: boolean;
  signalingToken: string | null;
  signalingUrl: string | null;
  connectionState: RoomConnectionState;
  participants: Participant[];
  setPrejoinRoom: (room: { slug: string; roomId?: string }) => void;
  setJoinResult: (result: {
    participantId: string;
    isCreator: boolean;
    signalingToken: string;
    signalingUrl: string;
  }) => void;
  setConnectionState: (connectionState: RoomConnectionState) => void;
  setParticipants: (participants: Participant[]) => void;
  resetRoom: () => void;
};

const initialState = {
  slug: null,
  roomId: null,
  participantId: null,
  isCreator: false,
  signalingToken: null,
  signalingUrl: null,
  connectionState: "idle" as const,
  participants: [],
};

export const useRoomStore = create<RoomState>((set) => ({
  ...initialState,
  setPrejoinRoom: ({ slug, roomId }) => {
    set({ slug, roomId: roomId ?? null, connectionState: "prejoin" });
  },
  setJoinResult: ({ participantId, isCreator, signalingToken, signalingUrl }) => {
    set({ participantId, isCreator, signalingToken, signalingUrl, connectionState: "joining" });
  },
  setConnectionState: (connectionState) => {
    set({ connectionState });
  },
  setParticipants: (participants) => {
    set({ participants });
  },
  resetRoom: () => {
    set(initialState);
  },
}));
