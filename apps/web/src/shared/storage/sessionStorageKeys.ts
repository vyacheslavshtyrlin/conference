export const SESSION_KEYS = {
  displayName: "conference.displayName",
  localMedia: "conference.localMedia",
  creatorTokenPrefix: "conference.creatorToken.",
} as const;

export function creatorTokenKey(slug: string) {
  return `${SESSION_KEYS.creatorTokenPrefix}${slug}`;
}
