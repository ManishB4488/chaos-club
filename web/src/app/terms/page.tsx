import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms" draft>
      <p>This draft describes the intended rules. It is not legal advice.</p>
      <ul>
        <li>Play fair and be kind. Do not harass, threaten or target other players.</li>
        <li>What you write or draw in a room is visible to the other players in that room.</li>
        <li>We may remove content or close rooms that break these rules.</li>
        <li>The games are provided as they are, without promises that they are always available.</li>
        <li>These terms may change as the site grows.</li>
      </ul>
    </LegalPage>
  );
}
