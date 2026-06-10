import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const INITIALS_SPLIT_REGEX = /\s+/;

/** Up to two uppercase initials from a name/email, for avatar fallbacks. */
export function getInitials(value: string | null | undefined): string {
  const source = value?.trim();
  if (!source) {
    return "?";
  }
  const parts = source.split(INITIALS_SPLIT_REGEX).filter(Boolean);
  const letters =
    parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2);
  return letters.toUpperCase();
}
