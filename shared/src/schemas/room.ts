import { z } from "zod";
import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from "../constants";

/** Normalises to upper case, then checks length and allowed characters. */
export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`), "Invalid room code");

/** Letters (any language), numbers, spaces, underscore and hyphen only. */
export const nicknameSchema = z
  .string()
  .trim()
  .min(NICKNAME_MIN_LENGTH, `Nickname must be at least ${NICKNAME_MIN_LENGTH} characters`)
  .max(NICKNAME_MAX_LENGTH, `Nickname must be at most ${NICKNAME_MAX_LENGTH} characters`)
  .regex(/^[\p{L}\p{N} _-]+$/u, "Nickname contains characters that are not allowed");
