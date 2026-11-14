import { GameCards } from "@/components/home/GameCards";
import { Hero } from "@/components/home/Hero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { HowToPlay } from "@/components/home/HowToPlay";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      <GameCards />
      <HowItWorks />
      <HowToPlay />
    </main>
  );
}
