import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";

type LegalPageProps = {
  title: string;
  /** Shows a visible draft notice. Used for text that still needs the owner's review. */
  draft?: boolean;
  children: ReactNode;
};

export function LegalPage({ title, draft = false, children }: LegalPageProps) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-10">
      <div>
        <ButtonLink href="/" variant="ghost" size="sm">
          Back to home
        </ButtonLink>
      </div>
      <h1 className="font-display text-4xl font-bold sm:text-5xl">{title}</h1>
      {draft && (
        <div className="flex flex-col gap-2 rounded-card border border-sunny/40 bg-sunny/10 p-4">
          <Badge tone="sunny" className="self-start">
            Draft
          </Badge>
          <p>
            This page is a draft and has not been reviewed. It must be checked, and made to match
            what the finished site really does, before launch.
          </p>
        </div>
      )}
      <div className="flex flex-col gap-4 text-ink-soft [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
        {children}
      </div>
    </main>
  );
}
