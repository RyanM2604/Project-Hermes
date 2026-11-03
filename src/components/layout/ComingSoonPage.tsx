import Image from "next/image";
import { HermesMotion } from "@/components/motion/HermesMotion";

interface ComingSoonPageProps {
  accent?: string;
  description?: string;
  eyebrow?: string;
  highlights?: unknown[];
  title?: string;
  visual?: string;
}

export function ComingSoonPage({}: ComingSoonPageProps) {
  return (
    <HermesMotion variant="coming-soon"><main className="hm-coming-soon">
      <div className="hm-coming-soon-inner" data-motion="coming-soon-content">
        <Image
          src="/under-construction.svg"
          alt="Illustration of a construction worker wearing a yellow hard hat"
          width={1024}
          height={1024}
          priority
          className="hm-coming-soon-illustration"
        />
        <h1>
          under construction
        </h1>
      </div>
    </main></HermesMotion>
  );
}
