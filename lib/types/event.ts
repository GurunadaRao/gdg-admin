/**
 * Types for the legacy "events" Firestore collection.
 *
 * ⚠ Storage quirk: Several fields (tags, Theme, keyHighlights, eventGallery, isDone)
 * are stored as JSON-stringified strings in Firestore. The app normalises these at
 * read time via `lib/normalize.ts`, so the types below reflect the *normalised* shape.
 */

export type LegacyEventStatus =
  | "Upcoming"
  | "Ongoing"
  | "Completed"
  | "Cancelled";

/**
 * Shape returned by `normalizeEventData()` — the canonical client-side representation.
 * Subcollections: members, instructors, guests, judges, workshops, hackathons.
 */
export interface LegacyEvent {
  id: string; // Firestore document ID
  title: string;
  description: string;
  Date: string; // "YYYY-MM-DD HH:MM:SS"
  Time: string; // e.g. "09:00 - 16:00"
  venue: string;
  organizer: string;
  coOrganizer: string;
  status: LegacyEventStatus;
  isDone: boolean;
  rank: number;
  MembersParticipated: number;
  keyHighlights: string[];
  tags: string[];
  Theme: string[]; // Up to 5 hex colour strings
  eventGallery: string[]; // Cloudinary image URLs
  imageUrl: string; // Display/poster image URL
  coverUrl: string; // Cover banner image URL
}

/**
 * Raw shape as stored in Firestore (before normalisation).
 * Array fields and isDone are JSON-stringified strings.
 */
export interface LegacyEventRaw {
  id: string;
  title: string;
  description: string;
  Date: string | { _seconds: number; _nanoseconds: number };
  Time: string;
  venue: string;
  organizer: string;
  coOrganizer: string;
  status: string;
  isDone: string; // "true" / "false"
  rank: number;
  MembersParticipated: number;
  keyHighlights: string; // JSON-stringified string[]
  tags: string; // JSON-stringified string[]
  Theme: string; // JSON-stringified string[]
  eventGallery: string; // JSON-stringified string[]
  imageUrl: string;
  coverUrl: string;
}

/** Fields allowed in a PATCH update to /api/admin/events/[id]. */
export type LegacyEventUpdateFields = Partial<
  Pick<
    LegacyEvent,
    | "title"
    | "description"
    | "Date"
    | "Time"
    | "venue"
    | "organizer"
    | "coOrganizer"
    | "keyHighlights"
    | "tags"
    | "status"
    | "imageUrl"
    | "coverUrl"
    | "MembersParticipated"
    | "isDone"
    | "Theme"
    | "rank"
    | "eventGallery"
  >
>;
