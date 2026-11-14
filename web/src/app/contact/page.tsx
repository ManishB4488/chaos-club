import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <LegalPage title="Contact" draft>
      <p>
        Questions, bug reports or content to report? Email{" "}
        <a className="text-ink underline" href="mailto:contact@example.com">
          contact@example.com
        </a>
        .
      </p>
      <p>This address is a placeholder and must be replaced with a real one before launch.</p>
    </LegalPage>
  );
}
