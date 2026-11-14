const STEPS = [
  { title: "Create a room", text: "Pick a nickname and an avatar. You get a six character room code." },
  { title: "Invite your friends", text: "Share the code or the link. Two to four players fit in a room." },
  { title: "Pick a game", text: "The host chooses a game and starts it when everyone is ready." },
  { title: "Play together", text: "Everyone plays on their own screen, phone or computer, in real time." },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto w-full max-w-6xl scroll-mt-6 px-5 py-12">
      <h2 className="font-display text-4xl font-bold sm:text-5xl">How it works</h2>
      <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex flex-col gap-3">
            <span
              aria-hidden
              className="flex size-12 items-center justify-center rounded-full bg-sunny font-display text-xl font-bold text-night-950"
            >
              {index + 1}
            </span>
            <h3 className="font-display text-xl font-semibold">{step.title}</h3>
            <p className="text-ink-soft">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
