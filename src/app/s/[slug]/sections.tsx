import Link from "next/link";
import type { Product, Store } from "@/lib/db";
import { mediaUrl } from "@/lib/media";
import { formatEuros, type Section } from "@/lib/store-types";
import { NewsletterForm } from "./client";
import { Visual } from "./shared";

interface Ctx {
  store: Store;
  products: Product[];
  base: string;
  index: number;
}

const delay = (i: number) => ({ "--reveal-delay": `${Math.min(i, 6) * 0.08}s` }) as React.CSSProperties;

export function SectionView({ section, ctx }: { section: Section; ctx: Ctx }) {
  switch (section.type) {
    case "hero":
      return <Hero s={section} ctx={ctx} />;
    case "split":
      return <Split s={section} ctx={ctx} />;
    case "manifesto":
      return <Manifesto s={section} />;
    case "marquee":
      return <Marquee s={section} />;
    case "product_grid":
      return <ProductGrid s={section} ctx={ctx} />;
    case "featured_product":
      return <Featured s={section} ctx={ctx} />;
    case "gallery":
      return <Gallery s={section} />;
    case "features":
      return <Features s={section} />;
    case "faq":
      return <Faq s={section} />;
    case "newsletter":
      return <Newsletter s={section} ctx={ctx} />;
    case "text":
      return <TextBlock s={section} ctx={ctx} />;
  }
}

function Eyebrow({ children }: { children?: string }) {
  return children ? <p className="sf-eyebrow mb-5">{children}</p> : null;
}

function Hero({ s, ctx }: { s: Section; ctx: Ctx }) {
  const url = mediaUrl(s.image);
  const target = ctx.products.length > 0 ? `${ctx.base}/#collection` : undefined;
  if (url) {
    return (
      <section className="sf-hero sf-hero--image" data-hero-image>
        <div className="sf-hero-bg">
          {/* eslint-disable-next-line @next/next/no-img-element -- médiathèque */}
          <img src={url} alt="" fetchPriority="high" />
        </div>
        <div className="sf-hero-content sf-container">
          <div className={ctx.store.theme.template === "maison" ? "mx-auto max-w-5xl" : "max-w-4xl"}>
            <Eyebrow>{s.eyebrow}</Eyebrow>
            <h1 className="sf-display sf-h1">{s.title}</h1>
            {s.text && <p className="sf-lead mt-6 max-w-xl opacity-90 [.sf[data-template=maison]_&]:mx-auto">{s.text}</p>}
            {s.buttonLabel && target && (
              <Link href={target} className="sf-btn sf-btn--ghost mt-10">{s.buttonLabel}</Link>
            )}
          </div>
        </div>
      </section>
    );
  }
  // Sans image : une ouverture typographique, pleine page, qui assume l'absence de photo.
  return (
    <section className="sf-hero">
      <div className="sf-hero-content sf-container">
        <div className={ctx.store.theme.template === "maison" ? "mx-auto max-w-5xl" : "max-w-6xl"}>
          <div data-reveal>
            <Eyebrow>{s.eyebrow}</Eyebrow>
          </div>
          <h1 className="sf-display sf-h1" data-reveal style={delay(1)}>{s.title}</h1>
          {s.text && (
            <p className="sf-lead mt-8 max-w-xl [.sf[data-template=maison]_&]:mx-auto" data-reveal style={delay(2)}>
              {s.text}
            </p>
          )}
          {s.buttonLabel && target && (
            <div data-reveal style={delay(3)}>
              <Link href={target} className="sf-btn mt-10">{s.buttonLabel}</Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Split({ s, ctx }: { s: Section; ctx: Ctx }) {
  return (
    <section id={ctx.index > 0 ? "histoire" : undefined} className="sf-section">
      <div className="sf-container sf-split" data-image={s.imagePosition ?? "gauche"}>
        <div data-reveal>
          <Visual refs={[s.image]} label={s.title} ratio="4 / 5" />
        </div>
        <div className="max-w-xl" data-reveal style={delay(1)}>
          <Eyebrow>{s.eyebrow}</Eyebrow>
          <h2 className="sf-display sf-h2">{s.title}</h2>
          {s.text && <p className="sf-lead mt-8 whitespace-pre-line">{s.text}</p>}
          {s.buttonLabel && ctx.products.length > 0 && (
            <Link href={`${ctx.base}/#collection`} className="sf-btn sf-btn--ghost mt-10">{s.buttonLabel}</Link>
          )}
        </div>
      </div>
    </section>
  );
}

function Manifesto({ s }: { s: Section }) {
  return (
    <section id="histoire" className="sf-section">
      <div className="sf-container text-center">
        <div className="mx-auto max-w-5xl" data-reveal>
          <Eyebrow>{s.eyebrow}</Eyebrow>
          <p className="sf-display sf-h2 [.sf[data-template=maison]_&]:italic">{s.title}</p>
          {s.text && <p className="sf-lead mx-auto mt-8 max-w-2xl">{s.text}</p>}
        </div>
      </div>
    </section>
  );
}

function Marquee({ s }: { s: Section }) {
  const words = (s.items?.length ? s.items.map((i) => i.title) : [s.title]).filter(Boolean);
  // Contenu doublé pour une boucle continue ; la copie est masquée aux lecteurs d'écran.
  return (
    <section className="sf-marquee" aria-label={s.title}>
      <div className="sf-marquee-track">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex" aria-hidden={copy === 1}>
            {Array.from({ length: Math.max(2, Math.ceil(8 / words.length)) }).flatMap((_, r) =>
              words.map((w, i) => <span key={`${r}-${i}`}>{w}</span>),
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProductCard({ p, base, index }: { p: Product; base: string; index: number }) {
  return (
    <Link href={`${base}/produits/${p.handle}`} className="sf-card group block" data-reveal style={delay(index % 4)}>
      <Visual refs={p.images} label={p.title} ratio="4 / 5" />
      <div className="sf-card-info mt-4 space-y-1">
        <p className="sf-card-title">{p.title}</p>
        <p className="sf-muted text-sm">
          {formatEuros(p.priceCents)}
          {p.compareAtCents && p.compareAtCents > p.priceCents && (
            <s className="ml-2 opacity-70">{formatEuros(p.compareAtCents)}</s>
          )}
        </p>
      </div>
    </Link>
  );
}

function ProductGrid({ s, ctx }: { s: Section; ctx: Ctx }) {
  const products = ctx.products;
  return (
    <section id="collection" className="sf-section">
      <div className="sf-container">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6 [.sf[data-template=maison]_&]:justify-center [.sf[data-template=maison]_&]:text-center" data-reveal>
          <div>
            <Eyebrow>{s.eyebrow}</Eyebrow>
            <h2 className="sf-display sf-h2">{s.title}</h2>
            {s.text && <p className="sf-lead mt-4 max-w-xl">{s.text}</p>}
          </div>
        </div>
        {products.length === 0 ? (
          <p className="sf-muted">La collection arrive bientôt.</p>
        ) : (
          <div className="sf-grid" data-count={products.length}>
            {products.map((p, i) => (
              <ProductCard key={p.id} p={p} base={ctx.base} index={i} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Featured({ s, ctx }: { s: Section; ctx: Ctx }) {
  const p = ctx.products.find((x) => x.handle === s.productHandle) ?? ctx.products[0];
  if (!p) return null;
  const excerpt = p.description.split(/\n{2,}/)[0];
  return (
    <section className="sf-section sf-surface">
      <div className="sf-container grid items-center gap-[clamp(2rem,6vw,6rem)] md:grid-cols-[7fr_5fr]">
        <div data-reveal>
          <Visual refs={p.images} label={p.title} ratio="5 / 6" />
        </div>
        <div data-reveal style={delay(1)}>
          <Eyebrow>{s.eyebrow ?? "Pièce choisie"}</Eyebrow>
          <h2 className="sf-display sf-h2">{s.title || p.title}</h2>
          <p className="mt-6 text-lg">{formatEuros(p.priceCents)}</p>
          <p className="sf-lead mt-6">{s.text || excerpt}</p>
          <Link href={`${ctx.base}/produits/${p.handle}`} className="sf-btn mt-10">
            {s.buttonLabel ?? "Découvrir"}
          </Link>
        </div>
      </div>
    </section>
  );
}

function Gallery({ s }: { s: Section }) {
  const images = s.images?.length ? s.images : [undefined, undefined, undefined, undefined, undefined];
  return (
    <section className="sf-section">
      <div className="sf-container">
        {s.title && (
          <div className="mb-10" data-reveal>
            <Eyebrow>{s.eyebrow}</Eyebrow>
            <h2 className="sf-display sf-h2">{s.title}</h2>
          </div>
        )}
        <div className="sf-gallery">
          {images.slice(0, 5).map((ref, i) => (
            <div key={i} data-reveal style={delay(i)} className="h-full">
              <Visual refs={[ref]} label={s.title} ratio={i === 0 ? "1 / 1" : "4 / 5"} className="md:!aspect-auto md:h-full" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features({ s }: { s: Section }) {
  const items = s.items ?? [];
  return (
    <section className="sf-section">
      <div className="sf-container">
        <div className="mb-14 max-w-3xl" data-reveal>
          <Eyebrow>{s.eyebrow}</Eyebrow>
          <h2 className="sf-display sf-h2">{s.title}</h2>
        </div>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, i) => (
            <div key={item.title} className="sf-border border-t pt-6" data-reveal style={delay(i)}>
              <p className="sf-eyebrow mb-4">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="sf-display sf-h3">{item.title}</h3>
              {item.text && <p className="sf-muted mt-3 text-[0.95rem]">{item.text}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq({ s }: { s: Section }) {
  return (
    <section className="sf-section">
      <div className="sf-container grid gap-12 md:grid-cols-[1fr_1.6fr]">
        <div data-reveal>
          <Eyebrow>{s.eyebrow}</Eyebrow>
          <h2 className="sf-display sf-h2">{s.title}</h2>
        </div>
        <div className="sf-faq sf-border border-t" data-reveal style={delay(1)}>
          {(s.items ?? []).map((item) => (
            <details key={item.title}>
              <summary>{item.title}</summary>
              {item.text && <p className="sf-muted max-w-2xl pb-6">{item.text}</p>}
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Newsletter({ s, ctx }: { s: Section; ctx: Ctx }) {
  return (
    <section className="sf-section sf-surface">
      <div className="sf-container">
        <div className="mx-auto max-w-2xl text-center" data-reveal>
          <Eyebrow>{s.eyebrow}</Eyebrow>
          <h2 className="sf-display sf-h2">{s.title}</h2>
          {s.text && <p className="sf-lead mt-5">{s.text}</p>}
          <NewsletterForm store={ctx.store.slug} disabled={ctx.store.status !== "published"} />
        </div>
      </div>
    </section>
  );
}

function TextBlock({ s, ctx }: { s: Section; ctx: Ctx }) {
  return (
    <section id={ctx.index > 0 ? "histoire" : undefined} className="sf-section">
      <div className="sf-container">
        <div className="sf-narrow" data-reveal>
          <Eyebrow>{s.eyebrow}</Eyebrow>
          <h2 className="sf-display sf-h2">{s.title}</h2>
          {s.text && <p className="sf-lead mt-8 whitespace-pre-line">{s.text}</p>}
        </div>
      </div>
    </section>
  );
}
