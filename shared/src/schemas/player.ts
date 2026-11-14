import { z } from "zod";
import { AVATAR_IDS, PLAYER_COLORS } from "../constants";

export const avatarIdSchema = z.enum(AVATAR_IDS);
export const playerColorSchema = z.enum(PLAYER_COLORS);
