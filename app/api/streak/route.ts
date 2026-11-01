export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('user') || 'karthikeya1220';

  try {
    const svg = await generateStreakSVG(username);
    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        'Vary': 'user',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[streak-badge] Error:', message);
    const svg = errorSVG(message);
    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=60',
      },
    });
  }
}

// ─── SVG Generation ─────────────────────────────────────────────────────────

function generateStreakSVG(username: string): Promise<string> {
  return (async () => {
    const token = process.env.GITHUB_TOKEN;
    if (!token || token.length < 10) throw new Error('GITHUB_TOKEN not configured');

    const query = `query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }`;

    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'github-streak-badge',
      },
      body: JSON.stringify({ query, variables: { login: username } }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GitHub API returned ${res.status}: ${text.slice(0, 100)}`);
    }

    const data = await res.json();
    if (data.errors?.length) throw new Error(data.errors.map((e: any) => e.message).join('; '));
    if (!data.data?.user) throw new Error(`User "${username}" not found`);

    const weeks = data.data.user.contributionsCollection.contributionCalendar.weeks;

    // Flatten all days
    const allDays: { date: string; count: number }[] = [];
    for (const week of weeks) {
      if (week.contributionDays) {
        for (const day of week.contributionDays) {
          allDays.push({ date: day.date, count: day.contributionCount });
        }
      }
    }

    if (allDays.length === 0) {
      return fallbackSVG(username, 'No contribution data available');
    }

    // Last calendar day (UTC)
    const lastDayDate = new Date(allDays[allDays.length - 1].date + 'T00:00:00Z');

    // ── Streak start date (user-specified, e.g. 2025-10-17)
    // Falls before calendar start, so we use the calendar's first day as the effective start
    const streakStartDateStr = process.env.STREAK_START_DATE || '';
    const streakStartDate = streakStartDateStr
      ? new Date(streakStartDateStr + 'T00:00:00Z')
      : null;

    // ── Current streak: walk backwards from last calendar day, track start index
    let currentStreak = 0;
    let streakStartIdx = -1;
    let cursor = new Date(lastDayDate.getTime());
    for (let i = allDays.length - 1; i >= 0; i--) {
      const dd = new Date(allDays[i].date + 'T00:00:00Z');
      if (dd.getTime() === cursor.getTime() && allDays[i].count > 0) {
        currentStreak++;
        if (streakStartIdx === -1) streakStartIdx = i;
        cursor.setTime(cursor.getTime() - 86400000);
      } else if (dd.getTime() < cursor.getTime()) {
        break;
      }
    }
    const streakStart = streakStartIdx >= 0
      ? new Date(allDays[streakStartIdx].date + 'T00:00:00Z')
      : lastDayDate;

    // ── Effective streak start for display: use STREAK_START_DATE if earlier than calendar
    const displayStreakStart = (streakStartDate && streakStartDate < streakStart)
      ? streakStartDate
      : streakStart;

    // ── Total contributions from streak start date (or from calendar start if no custom date)
    const totalFromStreakStart = allDays
      .filter(d => {
        const dd = new Date(d.date + 'T00:00:00Z');
        return !streakStartDate || dd >= streakStartDate;
      })
      .reduce((s, d) => s + d.count, 0);

    // ── Longest streak: forward scan with index tracking
    let longest = 0;
    let temp = 0;
    let tempStartIdx = -1;
    let bestStartIdx = -1;
    let bestEndIdx = -1;

    for (let i = 0; i < allDays.length; i++) {
      const dd = new Date(allDays[i].date + 'T00:00:00Z');
      if (allDays[i].count > 0) {
        if (temp === 0) tempStartIdx = i;
        temp++;
      } else {
        if (temp > longest && tempStartIdx >= 0) {
          longest = temp;
          bestStartIdx = tempStartIdx;
          bestEndIdx = i - 1;
        }
        temp = 0;
        tempStartIdx = -1;
      }
    }
    if (temp > longest && tempStartIdx >= 0) {
      longest = temp;
      bestStartIdx = tempStartIdx;
      bestEndIdx = allDays.length - 1;
    }

    const longestStart = bestStartIdx >= 0
      ? new Date(allDays[bestStartIdx].date + 'T00:00:00Z')
      : new Date(0);
    const longestEnd = bestEndIdx >= 0
      ? new Date(allDays[bestEndIdx].date + 'T00:00:00Z')
      : new Date(0);

    // ── Render
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const fmtShort = (d: Date) => `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
    const fmtLong = (d: Date) => `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;

    // Use long format for streak start if it's in a previous year, short otherwise
    const useLongFormat = (displayStreakStart.getUTCFullYear() < lastDayDate.getUTCFullYear());
    const streakStartFmt = useLongFormat ? fmtLong(displayStreakStart) : fmtShort(displayStreakStart);
    const streakEndFmt = fmtLong(lastDayDate);
    const streakRange = `${streakStartFmt} – ${streakEndFmt}`;

    const longestRange = `${fmtLong(longestStart)} – ${fmtLong(longestEnd)}`;
    const totalContributions = totalFromStreakStart.toLocaleString();

    return `
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="210" viewBox="0 0 420 210">
  <rect width="420" height="210" fill="#0d1117" rx="8"/>
  <rect x="0.5" y="0.5" width="419" height="209" fill="none" stroke="#30363d" stroke-width="1" rx="8"/>

  <text x="190" y="28" text-anchor="end" font-family="Inter,system-ui,sans-serif" font-size="15" font-weight="700" fill="#c9d1d9">${esc(username)}</text>
  <text x="190" y="44" text-anchor="end" font-family="Inter,system-ui,sans-serif" font-size="10" fill="#8b949e">GITHUB STREAK</text>

  <line x1="20" y1="55" x2="400" y2="55" stroke="#30363d" stroke-width="1"/>

  <text x="20" y="74" font-family="Inter,system-ui,sans-serif" font-size="9" font-weight="600" fill="#8b949e" letter-spacing="1">CURRENT STREAK</text>
  <text x="20" y="102" font-family="Inter,system-ui,sans-serif" font-size="36" font-weight="700" fill="#58a6ff">${currentStreak}</text>
  <text x="88" y="106" font-family="Inter,system-ui,sans-serif" font-size="12" fill="#c9d1d9">days</text>
  <text x="20" y="118" font-family="Inter,system-ui,sans-serif" font-size="10" fill="#8b949e">${esc(streakRange)}</text>

  <text x="20" y="140" font-family="Inter,system-ui,sans-serif" font-size="9" font-weight="600" fill="#8b949e" letter-spacing="1">LONGEST STREAK</text>
  <text x="20" y="166" font-family="Inter,system-ui,sans-serif" font-size="26" font-weight="700" fill="#58a6ff">${longest}</text>
  <text x="76" y="170" font-family="Inter,system-ui,sans-serif" font-size="10" fill="#8b949e">days</text>
  <text x="20" y="180" font-family="Inter,system-ui,sans-serif" font-size="9" fill="#8b949e">${esc(longestRange)}</text>

  <text x="400" y="74" text-anchor="end" font-family="Inter,system-ui,sans-serif" font-size="9" font-weight="600" fill="#8b949e" letter-spacing="1">TOTAL CONTRIBUTIONS</text>
  <text x="400" y="102" text-anchor="end" font-family="Inter,system-ui,sans-serif" font-size="36" font-weight="700" fill="#c9d1d9">${totalContributions}</text>
</svg>`.trim();
  })();
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function errorSVG(message: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="80" viewBox="0 0 420 80">
  <rect width="420" height="80" fill="#0d1117" rx="8"/>
  <rect x="0.5" y="0.5" width="419" height="79" fill="none" stroke="#30363d" stroke-width="1" rx="8"/>
  <text x="210" y="35" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="12" font-weight="600" fill="#f85149">Warning: streak data unavailable</text>
  <text x="210" y="55" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="10" fill="#8b949e">${esc(message.slice(0, 100))}</text>
</svg>`;
}

function fallbackSVG(username: string, reason: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="210" viewBox="0 0 420 210">
  <rect width="420" height="210" fill="#0d1117" rx="8"/>
  <rect x="0.5" y="0.5" width="419" height="209" fill="none" stroke="#30363d" stroke-width="1" rx="8"/>
  <text x="210" y="90" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="12" font-weight="600" fill="#f85149">${esc(reason)}</text>
  <text x="210" y="110" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="10" fill="#8b949e">Configure GITHUB_TOKEN to enable streak badge</text>
</svg>`;
}
