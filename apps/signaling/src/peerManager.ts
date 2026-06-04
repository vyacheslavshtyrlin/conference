import type { Participant, ParticipantMedia } from "@conference/contracts";

import type { JoinTokenPayload } from "./token.js";

const defaultMedia: ParticipantMedia = {
  mic: "off",
  camera: "off",
  screen: "off",
};

export class PeerManager {
  private readonly participants = new Map<string, Participant>();

  addPeer(payload: JoinTokenPayload): Participant {
    const existing = this.participants.get(payload.participantId);
    if (existing) {
      return existing;
    }

    const participant: Participant = {
      participantId: payload.participantId,
      displayName: payload.displayName,
      isCreator: payload.isCreator,
      joinedAt: new Date().toISOString(),
      connectionState: "online",
      media: { ...defaultMedia },
    };

    this.participants.set(participant.participantId, participant);
    return participant;
  }

  setMedia(participantId: string, media: ParticipantMedia): Participant | undefined {
    const participant = this.participants.get(participantId);
    if (!participant) {
      return undefined;
    }

    const next = { ...participant, media };
    this.participants.set(participantId, next);
    return next;
  }

  removePeer(participantId: string): Participant | undefined {
    const participant = this.participants.get(participantId);
    this.participants.delete(participantId);
    return participant;
  }

  getPeer(participantId: string): Participant | undefined {
    return this.participants.get(participantId);
  }

  list(): Participant[] {
    return Array.from(this.participants.values());
  }

  count(): number {
    return this.participants.size;
  }
}
