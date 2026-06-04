import { useParams } from "react-router-dom";
import { useRoomStore } from "../../shared/stores/roomStore";
import { PreJoinPage } from "../prejoin/PreJoinPage";
import { ConferenceRoomPage } from "../conference/ConferenceRoomPage";

export function RoomPage() {
  const { slug } = useParams<{ slug: string }>();
  const participantId = useRoomStore((state) => state.participantId);
  const signalingToken = useRoomStore((state) => state.signalingToken);

  if (!slug) return null;

  const isJoined = Boolean(participantId && signalingToken);
  return isJoined ? <ConferenceRoomPage slug={slug} /> : <PreJoinPage slug={slug} />;
}
