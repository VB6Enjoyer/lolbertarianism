// Links to the GitHub issue forms in .github/ISSUE_TEMPLATE/, prefilled with the
// game and the player's browser. There's no backend: feedback lives in GitHub issues.

import { games } from '../games.ts';

export const REPO_URL = 'https://github.com/VB6Enjoyer/lolbertarianism';

export type FeedbackKind = 'bug' | 'idea';

/** Matches the "The arcade (homepage)" option in the issue forms. */
export const HOMEPAGE_OPTION = 'The arcade (homepage)';

/** The game a page belongs to, from its URL (vidya/<slug>.html), or null on the homepage. */
export function gameForPath(pathname: string): string | null {
  const slug = /\/vidya\/([^/]+?)(?:\.html)?$/.exec(pathname)?.[1];
  return games.find((g) => g.slug === slug)?.title ?? null;
}

/** A short "Browser on OS" description, e.g. "Firefox on Windows". */
export function describeBrowser(userAgent: string): string {
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\//.test(userAgent)
      ? 'Opera'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Chrome\//.test(userAgent)
          ? 'Chrome'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : 'Unknown browser';
  const os = /iPhone|iPad|iPod/.test(userAgent)
    ? 'iOS'
    : /Android/.test(userAgent)
      ? 'Android'
      : /Windows/.test(userAgent)
        ? 'Windows'
        : /Mac OS X|Macintosh/.test(userAgent)
          ? 'macOS'
          : /CrOS/.test(userAgent)
            ? 'ChromeOS'
            : /Linux/.test(userAgent)
              ? 'Linux'
              : 'unknown OS';
  return `${browser} on ${os}`;
}

/** The "new issue" link for a bug report or an idea, prefilled where possible. */
export function issueUrl(kind: FeedbackKind, game: string | null, userAgent = ''): string {
  const params = new URLSearchParams({
    template: kind === 'bug' ? 'bug_report.yml' : 'feature_request.yml',
    title: `${kind === 'bug' ? '[Bug]' : '[Idea]'} ${game ? `${game}: ` : ''}`,
    game: game ?? HOMEPAGE_OPTION,
  });
  if (kind === 'bug' && userAgent) params.set('browser', describeBrowser(userAgent));
  return `${REPO_URL}/issues/new?${params}`;
}
