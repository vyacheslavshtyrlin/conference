import { useMutation, useQuery } from "@tanstack/react-query";
import { createRoom, getRoom, joinRoom } from "./client";

export const roomQueryKeys = {
  room: (slug: string) => ["room", slug] as const,
};

export function useRoom(slug: string) {
  return useQuery({
    queryKey: roomQueryKeys.room(slug),
    queryFn: () => getRoom(slug),
    enabled: slug.length > 0,
  });
}

export function useCreateRoomMutation() {
  return useMutation({
    mutationFn: createRoom,
  });
}

export function useJoinRoomMutation() {
  return useMutation({
    mutationFn: ({ slug, displayName, creatorToken }: { slug: string; displayName: string; creatorToken?: string }) =>
      joinRoom(slug, { displayName, creatorToken }),
  });
}
