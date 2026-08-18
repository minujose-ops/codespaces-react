import { useEffect, useState } from 'react';
import './App.css';

// Primary fallback JSON - use local public folder first
const FALLBACK_JSON = '/codespaces-react/days.json';

// Secondary fallback if local isn't available
const SECONDARY_FALLBACK = 'https://jaicyjoy.github.io/40-days/data/days.json';

// The markdown file added to the repo contains bilingual content. We'll fetch it and create
// two filtered views: Malayalam-only and English-only (simple heuristics by character ranges).
const REPO_MD_PATH = 'വിശുദ്ധ കുർബാനയോടൊപ്പം 40 ദിനങ്ങൾ.md';
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
      // Replace the priest line in header with the centre name per request; do not duplicate content in header
      subtitle: 'Mount Carmel Retreat Centre',
      priest: '',
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
          // Ensure Day 1 has the requested theme/title
          const day1 = parsed.days.find(d => d.day === 1);
          if (day1) {
            day1.theme.en = 'Day 1: The Cosmic Temple';
            // keep Malayalam theme untouched if available
          }

          setContent(parsed);
          setSelectedDay(parsed.days[0]?.day || 1);
        } else {
          // fallback to local JSON first
          setLoadingMsg('Falling back to the packaged JSON guide...');
          fetch(FALLBACK_JSON)
            .then((r) => {
              if (!r.ok) throw new Error('Unable to load local JSON');
              return r.json();
            })
            .then((json) => setContent(json))
            .catch(() => {
              // If local JSON fails, try secondary fallback
              fetch(SECONDARY_FALLBACK)
                .then((r) => {
                  if (!r.ok) throw new Error('Unable to load secondary JSON');
                  return r.json();
                })
                .then((json) => setContent(json))
                .catch(() => setContent({ error: true }));
            });
        }
      })
      .catch(() => {
        // If the repo markdown isn't available, fallback to local JSON first
        setLoadingMsg('Falling back to the packaged JSON guide...');
        fetch(FALLBACK_JSON)
          .then((r) => {
            if (!r.ok) throw new Error('Unable to load local JSON');
            return r.json();
          })
          .then((json) => setContent(json))
          .catch(() => {
            // If local JSON fails, try secondary fallback
            fetch(SECONDARY_FALLBACK)
              .then((r) => {
                if (!r.ok) throw new Error('Unable to load secondary JSON');
                return r.json();
              })
              .then((json) => setContent(json))
              .catch(() => setContent({ error: true }));
          });
      });
  }, []);

  if (!content) return <main className="loading-screen">{loadingMsg}</main>;
  if (content.error) return <main className="loading-screen">The guide could not be loaded. Please refresh to try again.</main>;

  const day = content.days.find(({ day: dayNumber }) => dayNumber === selectedDay) || content.days[0];
  const { series } = content;

  const dayTileTitle = (item) => {
    if (item.day === 1 && lang === 'en') return 'Day 1: The Cosmic Temple';
    if (item.day === 1 && lang === 'ml') return item.theme && item.theme.ml ? item.theme.ml : 'Day 1: The Cosmic Temple';
    return (item.theme && item.theme[lang]) || item.title || '';
  };

  const indexHeading = lang === 'en' ? '40 Days · Eucharistic Deliverance Prayer' : 'വിശുദ്ധ കുർബാനയോടൊപ്പം 40 ദിനങ്ങൾ';

  // Hardcoded Day 1 content (English) as requested. Malayalam tab will show the same structure until translations are provided.
  const day1ContentEn = {
    scriptureReadings: [
      {
        ref: 'Genesis 1:1-2',
        text: '"In the beginning when God created the heavens and the earth, the earth was a formless void and darkness covered the face of the deep, while a wind from God swept over the face of the waters."'
      },
      {
        ref: 'Hebrews 4:9-10',
        text: '"So then, a sabbath rest still remains for the people of God; for those who enter God’s rest also cease from their labours as God did from his."'
      }
    ],
    relatedVerses: [
      'Genesis 2:2-3 — The account of God finishing His work, resting on the seventh day, and blessing it.'
    ],
    virtues: {
      title: 'Trust in God',
      description: 'Blindly trust and rely on God in all situations of life.'
    },
    vice: 'Self-reliance: Give up the pride and reliance solely on your own abilities and strengths.',
    practice: 'Choose five small, everyday tasks that you normally think you can do on your own without God\'s help (for example: walking to a place, eating a meal, doing chores, or driving). Consciously ask for God\'s help and pray while doing these five specific tasks today.',
    prayer: '"Jesus, I trust in You completely."',
    coreThought: 'God created the earth not just as a dwelling place but like a temple (a Cosmic Temple). After building the universe like a temple in six days, God sat on His throne and rested on the seventh day. We are called to enter into that unending seventh day, which is God\'s rest and His presence. The purpose of a human being\'s creation is fulfilled only when they worship God. Only through worship can one attain a life without complaints.',
    thingsToDo: [
      'Begin to live with the realization that you were created primarily to worship God.',
      'Surrender everything you do relying on your own abilities to the Lord, and start trusting solely in God.',
      'Consciously ask for God\'s help when doing the 5 small daily routines you chose for today\'s practice.',
      'Offer your prayers and adoration today as a reparation for the times the Holy Eucharist has been dishonored anywhere in the world (Adoration becomes Reparation).'
    ],
    myPrayer: `Lord, I thank You for creating me as Your worshipper. Grant me the grace to enter into Your rest and Your presence, reigning in this great cosmic temple of the universe. Remove from me the reliance on my own abilities, and teach me to depend entirely on You in all things. I ask for forgiveness for all the dishonor shown towards the Holy Eucharist, and for the times I have received Communion unworthily. Give me a heart that praises You constantly, living a life without complaints. Jesus, I trust in You completely. Amen.`
  };

  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="brand-mark" aria-hidden="true">✝️</div>
        <div>
          <p className="eyebrow">{series.title}</p>
          <h1>{series.subtitle}</h1>
        </div>

        <div className="header-right">
          <p className="page-count"><strong>{String(day.day).padStart(2, '0')}</strong> / {series.totalDays}</p>
        </div>
      </header>

      <section className="content-grid">
        <div className="tile-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Index</p>
              <h2>{indexHeading}</h2>
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
            {content.days && content.days.length > 0 ? (
              content.days.map((item) => (
                <button
                  className={`page-tile ${day.day === item.day ? 'is-active' : ''}`}
                  key={item.day}
                  onClick={() => setSelectedDay(item.day)}
                  type="button"
                  aria-pressed={day.day === item.day}
                >
                  <span className="tile-number">{String(item.day).padStart(2, '0')}</span>
                  <span className="tile-emoji" aria-hidden="true">{item.emoji || '🙏'}</span>
                  <span className="tile-title">{dayTileTitle(item)}</span>
                  <span className="tile-arrow" aria-hidden="true">↗</span>
                </button>
              ))
            ) : (
              <p>No days available</p>
            )}
          </div>

          {/* Full-text tabs: show the entire repo markdown split by language. */}
          {(fullTextEn || fullTextMl) && (
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
          )}
        </div>

        <aside className="detail-panel" aria-live="polite">
          <div className="detail-topline">
            <span>Selected day</span>
            <span>{String(day.day).padStart(2, '0')}</span>
          </div>
          <div className="detail-number">{day.emoji}</div>
          <p className="eyebrow">Day {day.day}</p>
          <h2>{(day.theme && (day.theme[lang] || day.theme.en)) || day.title || ''}</h2>

          {/* If Day 1, render the requested detailed structure */}
          {day.day === 1 ? (
            <div className="day-detail-body">
              <section>
                <h3>Scripture Readings:</h3>
                {day1ContentEn.scriptureReadings.map((s, i) => (
                  <p key={i} className="scripture">{s.ref} - {s.text}</p>
                ))}
              </section>

              <section>
                <h3>Related Verses:</h3>
                <ul>
                  {day1ContentEn.relatedVerses.map((rv, i) => <li key={i}>{rv}</li>)}
                </ul>
              </section>

              <section>
                <h3>Today's Virtues and Practices</h3>
                <p><strong>Virtue to Practice |</strong> {day1ContentEn.virtues.title}: {day1ContentEn.virtues.description}</p>
                <p><strong>Vice to Avoid |</strong> {day1ContentEn.vice}</p>
                <p><strong>Today's Practice |</strong> {day1ContentEn.practice}</p>
                <p><strong>Prayer to Repeat |</strong> {day1ContentEn.prayer}</p>
                <p><strong>Core Thought |</strong> {day1ContentEn.coreThought}</p>
              </section>

              <section>
                <h3>Things to Do Today</h3>
                <ul>
                  {day1ContentEn.thingsToDo.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </section>

              <section>
                <h3>My Prayer for Today</h3>
                <p>{day1ContentEn.myPrayer}</p>
              </section>
            </div>
          ) : (
            // Fallback rendering for other days
            <>
              {day.scripture && (day.scripture[lang] || day.scripture) && (
                <p className="scripture">{(day.scripture && day.scripture[lang]) || day.scripture}</p>
              )}
              {(day.summary && (day.summary[lang] || day.summary)) && (
                <p className="detail-copy">{(day.summary && day.summary[lang]) || day.summary}</p>
              )}

              <div className="detail-footer">
                {day.virtue && day.virtue.title && (
                  <span>Virtue: <strong>{day.virtue.title}</strong></span>
                )}
                {day.evil && day.evil.title && (
                  <span className="status-dot">● Avoid: <strong>{day.evil.title}</strong></span>
                )}
              </div>
            </>
          )}
        </aside>
      </section>
    </main>
  );
}

export default App;
