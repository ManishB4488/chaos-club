"use client";

import { useId, useState, type FormEvent } from "react";
import { createRoomSchema, roomCodeSchema } from "@chaos/shared";
import { ACCENT_BG } from "@/components/home/game-visuals";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { AVATAR_IDS, PLAYER_COLORS, type AvatarId, type PlayerColor } from "@/lib/avatars";
import { cn } from "@/lib/cn";
import { loadProfile, type ProfileValues } from "@/lib/session";

type ProfileFormProps = {
  /** "join" shows a room code box unless fixedCode is given. */
  mode: "create" | "join";
  fixedCode?: string;
  submitLabel: string;
  /** Returns an error message to show, or null when it worked. */
  onSubmit: (profile: ProfileValues, code: string) => Promise<string | null>;
};

const inputClass =
  "min-h-12 w-full rounded-2xl border-2 border-white/15 bg-night-800 px-4 text-lg text-ink placeholder:text-ink-soft/70";

/** Nickname, avatar and color. Used when creating a room, joining by code, and joining from an invite link. */
export function ProfileForm({ mode, fixedCode, submitLabel, onSubmit }: ProfileFormProps) {
  const nicknameId = useId();
  const codeId = useId();
  const [saved] = useState(loadProfile);
  const [nickname, setNickname] = useState(saved?.nickname ?? "");
  const [avatar, setAvatar] = useState<AvatarId>(saved?.avatar ?? "ghost");
  const [color, setColor] = useState<PlayerColor>(saved?.color ?? "grape");
  const [code, setCode] = useState(fixedCode ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const profile = createRoomSchema.safeParse({ nickname, avatar, color });
    if (!profile.success) {
      setError(profile.error.issues[0]?.message ?? "Please check your details.");
      return;
    }

    let finalCode = fixedCode ?? "";
    if (mode === "join" && !fixedCode) {
      const parsedCode = roomCodeSchema.safeParse(code);
      if (!parsedCode.success) {
        setError("Enter the 6 character room code.");
        return;
      }
      finalCode = parsedCode.data;
    }

    setBusy(true);
    setError(null);
    const message = await onSubmit(profile.data, finalCode);
    setBusy(false);
    if (message) setError(message);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {mode === "join" && !fixedCode && (
        <div className="flex flex-col gap-2">
          <label htmlFor={codeId} className="font-semibold">
            Room code
          </label>
          <input
            id={codeId}
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="ABC234"
            className={cn(inputClass, "font-display tracking-widest")}
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor={nicknameId} className="font-semibold">
          Nickname
        </label>
        <input
          id={nicknameId}
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          maxLength={16}
          autoComplete="nickname"
          placeholder="What should we call you?"
          className={inputClass}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">Avatar</legend>
        <div className="flex flex-wrap gap-2">
          {AVATAR_IDS.map((id) => (
            <label key={id} className="cursor-pointer">
              <input
                type="radio"
                name="avatar"
                value={id}
                checked={avatar === id}
                onChange={() => setAvatar(id)}
                className="peer sr-only"
              />
              <span className="block rounded-full ring-4 ring-transparent peer-checked:ring-white peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sunny">
                <Avatar avatar={id} color={color} label={id} />
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">Color</legend>
        <div className="flex flex-wrap gap-3">
          {PLAYER_COLORS.map((name) => (
            <label key={name} className="cursor-pointer">
              <input
                type="radio"
                name="color"
                value={name}
                checked={color === name}
                onChange={() => setColor(name)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "block size-11 rounded-full ring-4 ring-transparent peer-checked:ring-white peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sunny",
                  ACCENT_BG[name],
                )}
              />
              <span className="sr-only">{name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="font-semibold text-bubblegum">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" fullWidth loading={busy}>
        {submitLabel}
      </Button>
    </form>
  );
}
