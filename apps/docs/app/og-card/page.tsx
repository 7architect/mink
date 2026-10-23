import type { Metadata } from 'next';
import PatternWaves from '@/components/PatternWaves';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Mink social card',
  robots: { index: false, follow: false },
};

export default function OgCardPage() {
  return (
    <main className="relative h-[630px] w-[1200px] overflow-hidden bg-[#080808] text-[#f5f5f5]">
      <div className="absolute inset-0">
        <PatternWaves
          preset="silk"
          color="#c4c4c4"
          backgroundColor="#080808"
          opacity={0.62}
          speed={0.18}
          fade="edges"
          interactive={false}
          cursorSize={50}
          cursorStrength={0.6}
          intro={false}
        />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_24%_42%,rgba(8,8,8,0.2)_0%,rgba(8,8,8,0.62)_46%,rgba(8,8,8,0.94)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,8,8,0.82)_0%,rgba(8,8,8,0.42)_38%,rgba(8,8,8,0.08)_64%,rgba(8,8,8,0.74)_100%)]" />

      <div className="relative flex h-full flex-col p-16">
        <div className="flex items-center">
          <img src="/logo-wordmark.svg" alt="Mink" className="h-9 w-auto" />
        </div>

        <div className="flex flex-1 items-center">
          <div className="grid w-full grid-cols-[1fr_460px] items-center gap-16">
            <div>
              <h1 className="text-[58px] leading-[1.03] font-normal tracking-[-0.045em]">
                Your repo&apos;s commands,
                <br />
                <span className="text-[#8a8a8a]">one palette away.</span>
              </h1>
              <p className="mt-6 max-w-[540px] text-xl leading-relaxed text-[#9a9a9a]">
                Find the scripts, pipelines, and services already in your repository. Run them from
                one terminal palette.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#0c0c0c] p-1.5 shadow-2xl shadow-black/70">
              <img
                src="/screenshots/hero-live.png"
                alt="Mink command palette"
                className="block h-[240px] w-full rounded-xl object-cover object-bottom"
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
