import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { games } from '../games.ts';
import { describeBrowser, gameForPath, HOMEPAGE_OPTION, issueUrl, REPO_URL } from './feedback.ts';

const template = (name: string) => readFileSync(new URL(`../../.github/ISSUE_TEMPLATE/${name}`, import.meta.url), 'utf8');

describe('feedback links', () => {
  it('the issue forms list every game, plus the homepage', () => {
    for (const name of ['bug_report.yml', 'feature_request.yml']) {
      const yml = template(name);
      for (const g of games) expect(yml, `${name}: ${g.title}`).toContain(g.title);
      expect(yml).toContain(HOMEPAGE_OPTION);
    }
  });

  it('finds the game from the page URL', () => {
    expect(gameForPath('/lolbertarianism/vidya/ancapistan-tycoon.html')).toBe('Ancapistan Tycoon');
    expect(gameForPath('/lolbertarianism/vidya/road-to-liberty')).toBe('The Road to Liberty');
    expect(gameForPath('/lolbertarianism/')).toBeNull();
  });

  it('prefill the form, game and browser', () => {
    const url = new URL(issueUrl('bug', 'Ancapistan Tycoon', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0'));
    expect(url.origin + url.pathname).toBe(`${REPO_URL}/issues/new`);
    expect(url.searchParams.get('template')).toBe('bug_report.yml');
    expect(url.searchParams.get('game')).toBe('Ancapistan Tycoon');
    expect(url.searchParams.get('title')).toBe('[Bug] Ancapistan Tycoon: ');
    expect(url.searchParams.get('browser')).toBe('Firefox on Windows');

    const idea = new URL(issueUrl('idea', null, 'whatever'));
    expect(idea.searchParams.get('template')).toBe('feature_request.yml');
    expect(idea.searchParams.get('game')).toBe(HOMEPAGE_OPTION);
    expect(idea.searchParams.get('browser')).toBeNull(); // ideas don't need it
  });

  it('describe common browsers in plain words', () => {
    expect(describeBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toBe('Safari on iOS');
    expect(describeBrowser('Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36')).toBe('Chrome on Android');
    expect(describeBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0')).toBe('Edge on Windows');
    expect(describeBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15')).toBe('Safari on macOS');
  });
});
