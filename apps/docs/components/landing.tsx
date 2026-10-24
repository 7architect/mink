'use client';

import { ArrowRight } from 'lucide-react';
import { useEffect, useRef, type CSSProperties } from 'react';
import {
  DiscoverVisual,
  KeysVisual,
  ParametersVisual,
  PipelineVisual,
  ServicesVisual,
  ThemesVisual,
} from '@/components/bento-visuals';
import MagicBento from '@/components/MagicBento';
import { HeroWaves } from '@/components/hero-waves';
import { Reveal } from '@/components/reveal';
import { useLandingAnimations } from '@/components/use-landing-animations';
import { SiteFooter } from '@/components/arc/blocks/site-footer/site-footer';
import { Compare7, type CompareRow } from '@/components/compare-7';
import { Faq1 } from '@/components/faq-1';
import {
  landingCopy,
  localeFlag,
  localeHref,
  localeName,
  localeShort,
  locales,
  type Locale,
} from '@/components/landing-copy';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from '@/components/ui/navigation-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { absoluteUrl, repoUrl } from '@/lib/seo';
import { withBasePath } from '@/lib/base-path';

const repo = 'https://github.com/yaroslavlky/mink';

const painLines = [
  'npm run lint:fix',
  'make db-reset',
  'docker compose up -d redis',
  './scripts/seed.sh --region eu',
  'cd services/api && yarn dev',
  'grep -A3 "Run" README.md',
];

const bentoStyle = {
  '--mb-surface': 'linear-gradient(180deg, #111111 0%, #0b0b0b 100%)',
  '--mb-tile': 'linear-gradient(180deg, #1c1c1c 0%, #151515 100%)',
} as CSSProperties;

const LANGUAGES = locales.map((value) => ({
  value,
  flag: localeFlag[value],
  short: localeShort[value],
  name: localeName[value],
}));

const bentoLayout = [
  { colSpan: 1, visual: <DiscoverVisual /> },
  { colSpan: 2, visual: <ParametersVisual /> },
  { colSpan: 2, visual: <PipelineVisual /> },
  { colSpan: 1, visual: <ServicesVisual /> },
  { colSpan: 1, visual: <KeysVisual /> },
  { colSpan: 2, visual: <ThemesVisual /> },
];

function GitHubLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="currentColor"
      className={className}
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function TerminalMockup({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-[#0c0c0c] shadow-2xl shadow-black/70">
      <div className="flex items-center gap-1.5 border-b border-border bg-[#141414] px-3 py-1.5">
        <span className="size-2 rounded-full bg-[#3a3a3a]" />
        <span className="size-2 rounded-full bg-[#3a3a3a]" />
        <span className="size-2 rounded-full bg-[#3a3a3a]" />
        <span className="ml-2 font-mono text-[11px] text-muted-foreground">
          mink · acme-checkout
        </span>
      </div>
      <img src={src} alt={alt} className="block w-full" />
    </div>
  );
}

export function Landing({ locale }: { locale: Locale }) {
  const copy = landingCopy[locale];
  const rootRef = useRef<HTMLDivElement>(null);
  useLandingAnimations(rootRef);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const navItems = [
    [copy.nav.features, '#features'],
    [copy.nav.compare, '#compare'],
    [copy.nav.docs, withBasePath('/overview/')],
    [copy.nav.faq, '#faq'],
  ] as const;

  const bentoItems = copy.features.items.map((item, index) => ({
    ...item,
    ...bentoLayout[index],
  }));

  const compareRows: CompareRow[] = copy.compare.rows;

  const faqItems = copy.faq.items.map((item, index) => ({
    id: `faq-${index}`,
    question: item.question,
    answer: item.answer,
  }));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Mink',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Windows, Linux, macOS',
    description: copy.meta.description,
    url: absoluteUrl(localeHref[locale]),
    downloadUrl: repoUrl,
    license: 'https://opensource.org/licenses/MIT',
    inLanguage: locale,
  };

  return (
    <div ref={rootRef} className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header
        data-gsap="header"
        className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur"
      >
        <div className="mx-auto grid max-w-[1280px] grid-cols-[1fr_auto_1fr] items-center gap-6 px-6 py-3">
          <a
            href={withBasePath(localeHref[locale])}
            aria-label="Mink home"
            className="justify-self-start"
          >
            <img src={withBasePath('/logo-wordmark.svg')} alt="Mink" className="h-7 w-auto" />
          </a>
          <NavigationMenu viewport={false} className="hidden justify-self-center lg:flex">
            <NavigationMenuList>
              {navItems.map(([label, href]) => (
                <NavigationMenuItem key={label}>
                  <NavigationMenuLink
                    href={href}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {label}
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
          <div className="flex items-center justify-self-end gap-2">
            <Select
              value={locale}
              onValueChange={(value) => {
                if (!value) return;
                window.location.href = withBasePath(localeHref[value as Locale]);
              }}
            >
              <SelectTrigger
                id="landing-locale"
                size="sm"
                aria-label={copy.languageSwitcher}
                className="h-8 justify-start gap-2 rounded-full border-border bg-background px-3 text-xs text-muted-foreground hover:text-foreground"
              >
                <SelectValue>
                  {(() => {
                    const language = LANGUAGES.find((item) => item.value === locale);
                    return language ? (
                      <span className="flex items-center gap-1.5">
                        <span aria-hidden className="text-sm leading-none">
                          {language.flag}
                        </span>
                        <span className="font-mono text-[10px] tracking-wider">
                          {language.short}
                        </span>
                      </span>
                    ) : null;
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="end"
                sideOffset={8}
                className="w-60 border border-[#2a2a2a] bg-[#111111] p-1 text-[#f5f5f5] shadow-2xl shadow-black/70 ring-1 ring-white/10"
              >
                {LANGUAGES.map((language) => (
                  <SelectItem
                    key={language.value}
                    value={language.value}
                    className="py-1.5 text-[#f5f5f5] focus:bg-[#1c1c1c] focus:text-[#f5f5f5]"
                  >
                    <span className="flex w-full items-center gap-2.5">
                      <span aria-hidden className="text-base leading-none">
                        {language.flag}
                      </span>
                      <span className="flex-1 whitespace-nowrap">{language.name}</span>
                      <span className="font-mono text-[10px] text-[#8a8a8a]">{language.short}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" asChild>
              <a href={repo} target="_blank" rel="noreferrer">
                <GitHubLogo className="size-4" />
                GitHub
              </a>
            </Button>
          </div>
        </div>
      </header>

      <section data-gsap="hero-section" className="relative isolate overflow-hidden">
        <div data-gsap="hero-waves" className="absolute inset-0 -z-10 h-[860px]">
          <HeroWaves
            preset="silk"
            color="#a3a3a3"
            backgroundColor="#080808"
            opacity={0.42}
            speed={0.22}
            fade="edges"
            interactive={false}
            cursorSize={50}
            cursorStrength={0.6}
          />
        </div>
        <div className="absolute inset-0 -z-10 h-[860px] bg-[radial-gradient(ellipse_at_25%_45%,rgba(8,8,8,0.8)_0%,rgba(8,8,8,0.55)_40%,rgba(8,8,8,0.1)_75%)]" />
        <div className="absolute inset-x-0 top-[560px] -z-10 h-64 bg-gradient-to-b from-transparent to-background" />
        <div className="mx-auto grid max-w-[1280px] items-center gap-14 px-6 pt-32 pb-24 md:pt-40 lg:grid-cols-[0.9fr_1.1fr]">
          <div data-gsap="hero-copy" className="flex flex-col items-start gap-8">
            <h1 className="text-5xl leading-[1.05] font-normal tracking-[-0.03em] text-foreground md:text-7xl">
              {copy.hero.titleLead}
              <br />
              <span className="text-[#888888]">{copy.hero.titleAccent}</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-[#9a9a9a]">
              {copy.hero.description}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="rounded-full px-5" asChild>
                <a href={withBasePath('/quickstart/')}>
                  {copy.hero.primaryCta} <ArrowRight />
                </a>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-border bg-background/40 px-5"
                asChild
              >
                <a href={withBasePath('/overview/')}>{copy.hero.secondaryCta}</a>
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <code className="rounded-md border border-border bg-background/60 px-2.5 py-1.5 font-mono text-xs text-foreground">
                pnpm build:packages
              </code>
              <span>{copy.hero.installThen}</span>
              <code className="rounded-md border border-border bg-background/60 px-2.5 py-1.5 font-mono text-xs text-foreground">
                node packages/cli/dist/index.js ui
              </code>
            </div>
          </div>
          <div data-gsap="hero-visual">
            <TerminalMockup
              src={withBasePath('/screenshots/hero-live.png')}
              alt={copy.hero.imageAlt}
            />
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1280px] space-y-32 px-6 pb-32">
        <section id="features" className="scroll-mt-24 space-y-10">
          <div data-gsap="section" className="space-y-4">
            <h2 className="text-[30px] leading-[1.2] font-normal tracking-[-0.025em] md:text-[34px]">
              {copy.features.heading}
            </h2>
          </div>
          <div data-gsap="bento">
            <MagicBento
              items={bentoItems}
              columns={3}
              rowHeight={340}
              gap={12}
              glowColor="#a3a3a3"
              enableTilt={false}
              intro={false}
              style={bentoStyle}
            />
          </div>
        </section>

        <section
          data-gsap="section"
          className="grid gap-12 md:grid-cols-[1fr_1.1fr] md:items-center"
        >
          <div className="space-y-6">
            <h2 className="text-[30px] leading-[1.2] font-normal tracking-[-0.025em] md:text-[34px]">
              {copy.problem.heading}
            </h2>
            <p className="max-w-md text-muted-foreground">{copy.problem.description}</p>
          </div>
          <Card className="bg-card">
            <CardContent className="space-y-3 font-mono text-sm">
              {painLines.map((line, index) => (
                <Reveal key={line} delay={index * 220}>
                  <div className="truncate text-muted-foreground">$ {line}</div>
                </Reveal>
              ))}
              <Reveal delay={painLines.length * 220 + 400}>
                <div className="mt-5 border-t border-border pt-5 text-foreground">
                  $ mink <span className="text-muted-foreground"># {copy.problem.resultNote}</span>
                </div>
              </Reveal>
            </CardContent>
          </Card>
        </section>

        <div id="compare" data-gsap="section" className="scroll-mt-24">
          <Compare7
            heading={copy.compare.heading}
            description={copy.compare.description}
            primaryLabel={copy.compare.primaryLabel}
            secondaryLabel={copy.compare.secondaryLabel}
            rows={compareRows}
            className="py-0"
          />
        </div>

        <div id="faq" className="scroll-mt-24">
          <Faq1 heading={copy.faq.heading} items={faqItems} className="py-0" />
        </div>
      </main>

      <div data-gsap="section" className="mx-auto max-w-[1280px] px-6">
        <SiteFooter
          variant="columns"
          brand={{
            name: 'Mink',
            href: withBasePath(localeHref[locale]),
            mark: (
              <img src={withBasePath('/logo-wordmark.svg')} alt="Mink" className="h-7 w-auto" />
            ),
          }}
          tagline={copy.footer.tagline}
          columns={[
            {
              title: copy.footer.product,
              links: [
                { label: copy.footer.features, href: '#features' },
                { label: copy.footer.compare, href: '#compare' },
                { label: copy.footer.faq, href: '#faq' },
              ],
            },
            {
              title: copy.footer.docs,
              links: [
                { label: copy.footer.overview, href: withBasePath('/overview/') },
                { label: copy.footer.quickstart, href: withBasePath('/quickstart/') },
              ],
            },
            {
              title: copy.footer.project,
              links: [
                { label: copy.footer.github, href: repo, external: true },
                { label: copy.footer.issues, href: `${repo}/issues`, external: true },
              ],
            },
          ]}
          legal={[{ label: copy.footer.legal, href: `${repo}/blob/main/LICENSE`, external: true }]}
          socials={[]}
          newsletter={null}
          status={{ label: copy.footer.status, tone: 'warning' }}
        />
      </div>
    </div>
  );
}
