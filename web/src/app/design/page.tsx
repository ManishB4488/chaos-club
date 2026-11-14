import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AVATAR_IDS, PLAYER_COLORS } from "@/lib/avatars";
import { ACCENT_COLORS } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Development-only preview of the design system. Returns a 404 in production. */
export default function DesignPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-5 py-10">
      <h1 className="font-display text-4xl font-bold">Design system</h1>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-4">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <ButtonLink href="/" variant="secondary">
            Link button (to home)
          </ButtonLink>
        </div>
        <Button size="lg" fullWidth>
          Full width
        </Button>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap gap-3">
          <Badge>Neutral</Badge>
          {ACCENT_COLORS.map((tone) => (
            <Badge key={tone} tone={tone}>
              {tone}
            </Badge>
          ))}
        </div>
      </Section>

      <Section title="Cards">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <p className="font-display text-lg font-semibold">Plain card</p>
            <p className="text-ink-soft">Rounded corners, soft border.</p>
          </Card>
          {ACCENT_COLORS.map((accent) => (
            <Card key={accent} accent={accent}>
              <p className="font-display text-lg font-semibold">Glow: {accent}</p>
              <p className="text-ink-soft">Accent border with a soft glow.</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Avatars">
        <div className="flex flex-wrap items-end gap-4">
          <Avatar avatar="cat" color="bubblegum" label="Small" size="sm" />
          <Avatar avatar="cat" color="bubblegum" label="Medium" size="md" />
          <Avatar avatar="cat" color="bubblegum" label="Large" size="lg" />
          <Avatar avatar="cat" color="bubblegum" label="Extra large" size="xl" />
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <Avatar avatar="rocket" color="volt" label="Priya" size="lg" isHost status="connected" />
          <Avatar avatar="ghost" color="grape" label="Sam" size="lg" status="connected" />
          <Avatar avatar="bot" color="tangerine" label="Alex" size="lg" status="disconnected" />
        </div>
        <div className="flex flex-wrap gap-3">
          {AVATAR_IDS.map((avatar, index) => (
            <Avatar
              key={avatar}
              avatar={avatar}
              color={PLAYER_COLORS[index % PLAYER_COLORS.length] ?? "grape"}
              label={avatar}
            />
          ))}
        </div>
      </Section>
    </main>
  );
}
