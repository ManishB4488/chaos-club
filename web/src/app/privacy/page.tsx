import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" draft>
      <p>This draft describes what the site is intended to do. It is not legal advice.</p>
      <h2>What we collect</h2>
      <ul>
        <li>The nickname and avatar you choose. You do not need an account.</li>
        <li>What you type or draw during a game, so other players in your room can see it.</li>
        <li>Reports about inappropriate content, which may include the reported text.</li>
      </ul>
      <h2>How it is used</h2>
      <ul>
        <li>To run the room and the game you are playing, and nothing else.</li>
        <li>To review reported content and keep the site safe.</li>
      </ul>
      <h2>Your browser</h2>
      <ul>
        <li>A random session code is kept in your browser tab so you can rejoin after a refresh.</li>
      </ul>
    </LegalPage>
  );
}
