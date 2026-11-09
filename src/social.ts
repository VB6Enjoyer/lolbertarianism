// Link previews (Open Graph and Twitter cards), so a shared link shows a
// picture, a title and a description instead of a bare URL. The tags are added
// to every page at build time by vite.config.ts, from the list in games.ts.

import type { Game } from './games.ts';

/** Where the site is published (link previews need absolute URLs). */
export const SITE_URL = 'https://vb6enjoyer.github.io/lolbertarianism/';
export const SITE_NAME = 'Lolbertarianism';
export const SITE_DESCRIPTION = 'A free-market arcade of libertarian in-jokes. Free to play, no taxes, no sign-up.';

export interface Preview {
  title: string;
  description: string;
  /** Absolute URL of the page and of its 1200×630 picture (public/og/). */
  url: string;
  image: string;
  imageAlt: string;
}

export function homePreview(): Preview {
  return {
    title: `${SITE_NAME}: the libertarian arcade`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    image: `${SITE_URL}og/home.jpg`,
    imageAlt: 'The Lolbertarianism arcade: a yellow and black homepage full of libertarian joke games',
  };
}

export function gamePreview(game: Game): Preview {
  return {
    title: `${game.title} · ${SITE_NAME}`,
    description: `${game.blurb} Free to play in your browser.`,
    url: `${SITE_URL}vidya/${game.slug}.html`,
    image: `${SITE_URL}og/${game.slug}.jpg`,
    imageAlt: `A screenshot of ${game.title}`,
  };
}

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The <meta> tags for a page. `withDescription` adds the plain description
 * too (skip it when the page already has one).
 */
export function previewTags(p: Preview, withDescription: boolean): string {
  const meta = (attr: 'name' | 'property', key: string, value: string) => `<meta ${attr}="${key}" content="${escape(value)}">`;
  return [
    withDescription ? meta('name', 'description', p.description) : '',
    `<link rel="canonical" href="${escape(p.url)}">`,
    meta('name', 'theme-color', '#f7d02c'),
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', SITE_NAME),
    meta('property', 'og:title', p.title),
    meta('property', 'og:description', p.description),
    meta('property', 'og:url', p.url),
    meta('property', 'og:image', p.image),
    meta('property', 'og:image:type', 'image/jpeg'),
    meta('property', 'og:image:width', '1200'),
    meta('property', 'og:image:height', '630'),
    meta('property', 'og:image:alt', p.imageAlt),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', p.title),
    meta('name', 'twitter:description', p.description),
    meta('name', 'twitter:image', p.image),
    meta('name', 'twitter:image:alt', p.imageAlt),
  ]
    .filter(Boolean)
    .join('\n    ');
}
