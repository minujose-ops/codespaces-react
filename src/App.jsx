import { useEffect, useState } from 'react';
import './App.css';

// Primary fallback JSON if parsing from the repo markdown fails.
const FALLBACK_JSON = 'https://jaicyjoy.github.io/40-days/data/days.json';

// The markdown file added to the repo contains bilingual content. We'll fetch it and create
// two filtered views: Malayalam-only and English-only (simple heuristics by character ranges).
const REPO_MD_PATH = 'വിശുദ്ധ കുർബാനയോടൊപ്പം 40 ദിനങ്ങൾ.md';
const RAW_MD_URL = `https://raw.githubusercontent.com/minujose-ops/codespaces-react/main/${encodeURIComponent(REPO_MD_PATH)}`;

function parseDocTextToContent(text) {
  // Try to split the export by "Day <n>" markers. This is heuristic and depends on doc structure.
  const dayRegex = /Day\s*(\d+)\b[\s\S]*?(?=(?:\nDay\s*\d+\b)|$)/gi;
  const days = [];
  let match;

  while ((match = dayRegex.exec(text)) !== null) {
    const dayBlock = match[0];
    const dayNum = parseInt(match[1], 10);

    // Remove the "Day X" heading from the block
    const block = dayBlock.replace(new RegExp('^Day\\s*' + dayNum, 'i'), '').trim();

    // Split into lines and try to detect Malayalam vs English lines
    const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    // Heuristic: English lines are mostly Latin characters; Malayalam has characters in \u0D00-\u0D7F
    const isMalayalam = (s) => /[\u0D00-\u0D7F]/.test(s);

    // Collect english and malayalam content
    let en = '';
    let ml = '';

    // If there are explicit labels like "English:" or "Malayalam:" use them
    const labeledEn = lines.find(l => /^English[:\-]/i.test(l) || /^EN[:\-]/i.test(l));
    const labeledMl = lines.find(l => /^Malayalam[:\-]/i.test(l) || /^ML[:\-]/i.test(l));

    if (labeledEn || labeledMl) {
      if (labeledEn) en = labeledEn.replace(/^English[:\-]\s*/i, '').replace(/^EN[:\-]\s*/i, '');
      if (labeledMl) ml = labeledMl.replace(/^Malayalam[:\-]\s*/i, '').replace(/^ML[:\-]\s*/i, '');
    } else {
      // Fallback heuristics: first Latin line -> English, first Malayalam line -> Malayalam
      for (const line of lines) {
        if (!en && !isMalayalam(line)) en = line;
        if (!ml && isMalayalam(line)) ml = line;
        if (en && ml) break;
      }

      // If we didn't find a Malayalam line, but there are multiple lines, assume the second line is Malayalam
      if (!ml && lines.length >= 2) ml = lines[1];
      if (!en && lines.length >= 1) en = lines[0];
    }

    // For tile title and summary, use the first short sentence/line detected per language
    const pickTitle = (s) => {
      if (!s) return '';
      const parts = s.split(/\.|\n|–|-|—/).map(p => p.trim()).filter(Boolean);
      return parts[0];
    };

    days.push({
      day: dayNum,
      emoji: '🙏',
      theme: { en: pickTitle(en), ml: pickTitle(ml) },
      scripture: { en: '', ml: '' },
      summary: { en, ml },
      virtue: { title: '', description: '' },
      evil: { title: '' },
    });
  }

  // If we could not parse any days, return null so caller can fallback to JSON
  if (days.length === 0) return null;

  // Sort by day
  days.sort((a, b) => a.day - b.day);

  return {
    series: {
      title: '40 Days · Eucharistic Deliverance Prayer',
      subtitle: 'Fr Daniel Poovannathil',
      priest: 'Fr Daniel Poovannathil',
      totalDays: days.length,
    },
    days,
  };
}

function App() {
  const [content, setContent] = useState(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [lang, setLang] = useState('en');
  const [loadingMsg, setLoadingMsg] = useState('Loading the 40-day journey...');

  // Full-file text views (filtered)
  const [fullTextEn, setFullTextEn] = useState('');
  const [fullTextMl, setFullTextMl] = useState('');

  useEffect(() => {
    // Fetch the repo markdown file raw content and use it as primary source.
    fetch(RAW_MD_URL)
      .then((r) => {
        if (!r.ok) throw new Error('md not available');
        return r.text();
      })
      .then((md) => {
        // Build full-text panels
        const lines = md.split(/\r?\n/);
        const isMalayalam = (s) => /[\u0D00-\u0D7F]/.test(s);
        const enLines = [];
        const mlLines = [];
        for (const line of lines) {
          if (isMalayalam(line)) {
            mlLines.push(line);
          } else if (/[A-Za-z0-9]/.test(line)) {
            enLines.push(line);
          } else {
            // neutral lines (empty or punctuation) - push to both so spacing remains
            mlLines.push(line);
            enLines.push(line);
          }
        }
        setFullTextEn(enLines.join('\n'));
        setFullTextMl(mlLines.join('\n'));

        // Try to parse the markdown into days; if parsing fails, fallback to JSON
        const parsed = parseDocTextToContent(md);
        if (parsed) {
          setContent(parsed);
          setSelectedDay(parsed.days[0]?.day || 1);
        } else {
          // fallback to packaged JSON
          setLoadingMsg('Falling back to the packaged JSON guide...');
          fetch(FALLBACK_JSON)
            .then((r) => {
              if (!r.ok) throw new Error('Unable to load fallback JSON');
              return r.json();
            })
            .then((json) => setContent(json))
            .catch(() => setContent({ error: true }));
        }
      })
      .catch(() => {
        // If the repo markdown isn't available, fallback to JSON
        setLoadingMsg('Falling back to the packaged JSON guide...');
        fetch(FALLBACK_JSON)
          .then((r) => {
            if (!r.ok) throw new Error('Unable to load fallback JSON');
            return r.json();
          })
          .then((json) => setContent(json))
          .catch(() => setContent({ error: true }));
      });
  }, []);

  if (!content) return <main className="loading-screen">{loadingMsg}</main>;
  if (content.error) return <main className="loading-screen">The guide could not be loaded. Please refresh to try again.</main>;

  const day = content.days.find(({ day: dayNumber }) => dayNumber === selectedDay) || content.days[0];
  const { series } = content;

  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="brand-mark" aria-hidden="true">✝️</div>
        <div>
          <p className="eyebrow">{series.title}</p>
          <h1>{series.subtitle}</h1>
          <p className="byline">By {series.priest}</p>
        </div>
        <div className="header-right">
          <div className="center-name">Mount Carmel Retreat Centre</div>
          <p className="page-count"><strong>{String(day.day).padStart(2, '0')}</strong> / {series.totalDays}</p>
        </div>
      </header>

      <section className="content-grid">
        <div className="tile-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Index</p>
              <h2>Choose a day</h2>
            </div>
            <span className="hint">Click any tile to explore</span>
          </div>

          <div className="language-tabs" role="tablist" aria-label="Language tabs">
            <button
              type="button"
              role="tab"
              aria-selected={lang === 'en'}
              className={"lang-tab " + (lang === 'en' ? 'active' : '')}
              onClick={() => setLang('en')}
            >
              English
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={lang === 'ml'}
              className={"lang-tab " + (lang === 'ml' ? 'active' : '')}
              onClick={() => setLang('ml')}
            >
              Malayalam
            </button>
          </div>

          <div className="tile-grid" aria-label="Page index">
            {content.days.map((item) => (
              <button
                className={`page-tile ${day.day === item.day ? 'is-active' : ''}`}
                key={item.day}
                onClick={() => setSelectedDay(item.day)}
                type="button"
                aria-pressed={day.day === item.day}
              >
                <span className="tile-number">{String(item.day).padStart(2, '0')}</span>
                <span className="tile-emoji" aria-hidden="true">{item.emoji || '🙏'}</span>
                <span className="tile-title">{(item.theme && item.theme[lang]) || item.theme || item.title || ''}</span>
                <span className="tile-arrow" aria-hidden="true">↗</span>
              </button>
            ))}
          </div>

          {/* Full-text tabs: show the entire repo markdown split by language. */}
          <div className="full-text-section">
            <div className="full-text-heading">
              <p className="eyebrow">Full text</p>
              <h3>Complete content</h3>
            </div>
            <div className="full-text-tabs" role="tablist" aria-label="Full text language tabs">
              <button
                type="button"
                role="tab"
                aria-selected={lang === 'ml'}
                className={"full-tab " + (lang === 'ml' ? 'active' : '')}
                onClick={() => setLang('ml')}
              >
                Malayalam
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={lang === 'en'}
                className={"full-tab " + (lang === 'en' ? 'active' : '')}
                onClick={() => setLang('en')}
              >
                English
              </button>
            </div>

            <div className="full-text-panel">
              {lang === 'ml' ? (
                <pre className="full-text" aria-label="Malayalam full text">{fullTextMl || 'Malayalam content not available.'}</pre>
              ) : (
                <pre className="full-text" aria-label="English full text">{fullTextEn || 'English content not available.'}</pre>
              )}
            </div>
          </div>
        </div>

        <aside className="detail-panel" aria-live="polite">
          <div className="detail-topline"><span>Selected day</span><span>{String(day.day).padStart(2, '0')}</span></div>
          <div className="detail-number">{day.emoji}</div>
          <p className="eyebrow">Day {day.day}</p>
          <h2>{(day.theme && day.theme[lang]) || day.theme || day.title}</h2>
          <p className="scripture">{(day.scripture && day.scripture[lang]) || day.scripture}</p>
          <p className="detail-copy">{(day.summary && day.summary[lang]) || day.summary}</p>
          <div className="detail-footer"><span>Virtue: {(day.virtue && day.virtue.title) || ''}</span><span className="status-dot">● {(day.evil && day.evil.title) || 'what to avoid'}</span></div>
        </aside>
      </section>
    </main>
  );
}

export default App;
