import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <LegalPage title="About">
      <p>
        {SITE_NAME} is a set of party games for two to four friends. One person creates a private
        room, the others join with a code, and everyone plays together in real time on their own
        phone or computer.
      </p>
      <p>
        There are no accounts to create. Pick a nickname and an avatar, and you are in. The games
        are built to be quick, silly and easy to explain.
      </p>
    </LegalPage>
  );
}
