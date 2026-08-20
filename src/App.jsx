import { useEffect, useState } from 'react';
import './App.css';

// Primary fallback JSON - use local public folder first
const FALLBACK_JSON = '/codespaces-react/days.json';

// Secondary fallback if local isn't available
const SECONDARY_FALLBACK = 'https://jaicyjoy.github.io/40-days/data/days.json';

// The markdown file added to the repo contains bilingual content. We'll fetch it and create
// two filtered views: Malayalam-only and English-only (simple heuristics by character ranges).
const REPO_MD_PATH = 'വിശുദ്ധ കുർബാനയോടൊപ്പം 40 ദിനങ്ങൾ.md';
const RAW_MD_URL = `https://raw.githubusercontent.com/minujose-ops/codespaces-react/main/${encodeURIComponent(REPO_MD_PATH)}`;

function parseDocTextToContent(text) {
  const dayRegex = /(?:^|\n)Day\s*(\d+)\s*:\s*([^\n]*)[\s\S]*?(?=(?:\nDay\s*\d+\s*:)|$)/gi;
  const days = [];
  const sectionRegex = /Scripture Readings?:|Related Verses?:|Supporting Scriptures?:|Supporting Concepts from the Five Sacrifices:|Today's Virtues and Practices|Today's Virtue & Task|Things to Do Today|My Prayer (?:for )?Today/gi;
  const clean = (value) => value.replace(/\s+/g, ' ').replace(/^[-–—:]+\s*/, '').trim();
  const bullets = (value) => [...value.matchAll(/(?:^|\n)\s*[●*]\s*([\s\S]*?)(?=\n\s*[●*]\s*|$)/g)].map(([, item]) => clean(item));
  const section = (block, label) => {
    const start = block.search(new RegExp(label, 'i'));
    if (start < 0) return '';
    const remainder = block.slice(start + block.slice(start).match(new RegExp(label, 'i'))[0].length);
    const next = remainder.search(sectionRegex);
    return (next < 0 ? remainder : remainder.slice(0, next)).trim();
  };
  const labeledValue = (value, labels) => {
    const match = value.match(new RegExp(`(?:${labels})\\s*(?:\\||-|:)\\s*([\\s\\S]*)`, 'i'));
    return match ? clean(match[1]) : '';
  };

  for (const match of text.matchAll(dayRegex)) {
    const dayNum = Number(match[1]);
    const block = match[0].replace(/^\s*Day\s*\d+\s*:\s*[^\n]*/i, '').trim();
    const title = clean(match[2]) || clean(block.split(/\r?\n/).find((line) => line.trim()) || `Day ${dayNum}`);
    const scriptureBlock = section(block, 'Scripture Readings?:|Scripture Reading');
    const scriptureItems = bullets(scriptureBlock);
    const relatedItems = bullets(section(block, 'Related Verses?:|Supporting Scriptures?:|Supporting Concepts from the Five Sacrifices:'));
    const practiceBlock = section(block, "Today's Virtues and Practices|Today's Virtue & Task");
    const thingsToDo = bullets(section(block, 'Things to Do Today'));
    const prayerBlock = section(block, 'My Prayer (?:for )?Today');
    const coreMatch = practiceBlock.match(/(?:Core Thought|Key thought|मुख ചിന്ത)\s*\|\s*([\s\S]*?)(?=\n\s*(?:Things to Do|$))/i);

    days.push({
      day: dayNum,
      emoji: '🙏',
      available: true,
      theme: { en: title, ml: title },
      scripture: { en: scriptureItems.map((item) => item.split(/\s+-\s+|\s+—\s+/)[0]).join(', '), ml: '' },
      scriptureReadings: scriptureItems.map((item) => {
        const [reference, ...textParts] = item.split(/\s+-\s+|\s+—\s+/);
        return { reference: clean(reference), text: clean(textParts.join(' - ')) };
      }),
      relatedVerses: relatedItems,
      virtues: { en: labeledValue(practiceBlock, 'Virtue to Practice|Virtue to practise'), ml: '' },
      vices: { en: labeledValue(practiceBlock, 'Vice to Avoid|Vice to release'), ml: '' },
      practice: { en: labeledValue(practiceBlock, "Today's Practice|Today's practice|Today's practice -"), ml: '' },
      prayerToRepeat: { en: labeledValue(practiceBlock, 'Prayer to Repeat|Prayer to repeat'), ml: '' },
      coreThought: { en: coreMatch ? clean(coreMatch[1]) : '', ml: '' },
      thingsToDo,
      dailyPrayer: { en: clean(prayerBlock), ml: '' },
      summary: { en: coreMatch ? clean(coreMatch[1]) : clean(prayerBlock), ml: '' },
    });
  }

  if (days.length === 0) return null;
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

function localizedValue(value, language) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[language] || value.en || value.ml || '';
}

function normalizeDay(day) {
  return {
    ...day,
    theme: day.theme || day.title || '',
    coreThought: day.coreThought || day.keyThought || '',
    virtues: day.virtues || day.virtue?.detail || day.virtue?.title || '',
    vices: day.vices || day.evil?.detail || day.evil?.title || '',
    practice: day.practice || day.task?.detail || '',
    thingsToDo: day.thingsToDo || day.reflection || [],
    dailyPrayer: day.dailyPrayer || day.prayer?.text || day.closing || '',
  };
}

function ensureFortyDays(source) {
  const sourceDays = (source.days || []).map(normalizeDay);
  const days = Array.from({ length: 40 }, (_, index) => {
    const dayNumber = index + 1;
    const existingDay = sourceDays.find(({ day }) => day === dayNumber);
    return existingDay || {
      day: dayNumber,
      emoji: '○',
      available: false,
      theme: { en: `Day ${dayNumber}`, ml: `ദിവസം ${dayNumber}` },
    };
  }).map((day) => ({ ...day, available: day.available !== false }));

  return {
    ...source,
    series: { ...source.series, totalDays: 40 },
    days,
  };
}

function mergeDaySources(primary, secondary) {
  const primaryByDay = new Map((primary.days || []).map((day) => [day.day, day]));
  const days = (secondary.days || []).map((day) => primaryByDay.get(day.day) || day);
  const secondaryDayNumbers = new Set(days.map((day) => day.day));
  return {
    ...secondary,
    days: days.concat((primary.days || []).filter((day) => !secondaryDayNumbers.has(day.day))),
  };
}

function App() {
  const [content, setContent] = useState(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [lang, setLang] = useState('en');
  const [loadingMsg, setLoadingMsg] = useState('Loading the 40-day journey...');

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsDetailOpen(false);
    };

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isDetailOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isDetailOpen]);

  useEffect(() => {
    // Fetch the repo markdown file raw content and use it as primary source.
    fetch(RAW_MD_URL)
      .then((r) => {
        if (!r.ok) throw new Error('md not available');
        return r.text();
      })
      .then((md) => {
        // Try to parse the markdown into days; if parsing fails, fallback to JSON
        const parsed = parseDocTextToContent(md);
        if (parsed) {
          fetch(SECONDARY_FALLBACK)
            .then((r) => {
              if (!r.ok) throw new Error('Unable to load complete day data');
              return r.json();
            })
            .then((json) => setContent(ensureFortyDays(mergeDaySources(parsed, json))))
            .catch(() => {
              fetch(FALLBACK_JSON)
                .then((r) => {
                  if (!r.ok) throw new Error('Unable to load local JSON');
                  return r.json();
                })
                .then((json) => setContent(ensureFortyDays(json)))
                .catch(() => {
                  setContent(ensureFortyDays(parsed));
                  setSelectedDay(parsed.days[0]?.day || 1);
                });
            });
        } else {
          // fallback to local JSON first
          setLoadingMsg('Falling back to the packaged JSON guide...');
          fetch(FALLBACK_JSON)
            .then((r) => {
              if (!r.ok) throw new Error('Unable to load local JSON');
              return r.json();
            })
            .then((json) => setContent(ensureFortyDays(json)))
            .catch(() => {
              // If local JSON fails, try secondary fallback
              fetch(SECONDARY_FALLBACK)
                .then((r) => {
                  if (!r.ok) throw new Error('Unable to load secondary JSON');
                  return r.json();
                })
                .then((json) => setContent(ensureFortyDays(json)))
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
          .then((json) => setContent(ensureFortyDays(json)))
          .catch(() => {
            // If local JSON fails, try secondary fallback
            fetch(SECONDARY_FALLBACK)
              .then((r) => {
                if (!r.ok) throw new Error('Unable to load secondary JSON');
                return r.json();
              })
              .then((json) => setContent(ensureFortyDays(json)))
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
    return localizedValue(item.theme || item.title, lang) || 'Content coming soon';
  };

  const indexHeading = lang === 'en' ? '40 Days · Eucharistic Deliverance Prayer' : 'വിശുദ്ധ കുർബാനയോടൊപ്പം 40 ദിനങ്ങൾ';

  // Retain the detailed English Day 1 reference content.
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
          <p className="byline">Fr. Daniel Poovannathil</p>
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
                  className={`page-tile ${day.day === item.day ? 'is-active' : ''} ${item.available ? '' : 'is-unavailable'}`}
                  key={item.day}
                  onClick={() => {
                    setSelectedDay(item.day);
                    setIsDetailOpen(true);
                  }}
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

        </div>

      </section>

      {isDetailOpen && (
        <div className="detail-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setIsDetailOpen(false)}>
          <section className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="day-detail-title">
            <div className="detail-modal-header">
              <div>
                <p className="eyebrow">Day {day.day} · Selected day</p>
                <h2 id="day-detail-title">{localizedValue(day.theme || day.title, lang) || `Day ${day.day}`}</h2>
              </div>
              <button className="modal-close" type="button" onClick={() => setIsDetailOpen(false)} aria-label="Close day details">×</button>
            </div>

            <div className="detail-modal-scroll">
              <div className="detail-number">{day.emoji || '🙏'}</div>
              {!day.available && <DetailSection title="Content unavailable">This day's source content has not been provided yet.</DetailSection>}
              {day.available && localizedValue(day.scripture, lang) && <p className="scripture">Scripture: {localizedValue(day.scripture, lang)}</p>}
              {day.available && localizedValue(day.coreThought || day.summary, lang) && (
                <DetailSection title="Core thought">{localizedValue(day.coreThought || day.summary, lang)}</DetailSection>
              )}
              {day.available && day.scriptureReadings?.length > 0 && (
                <DetailSection title="Scripture readings">
                  {day.scriptureReadings.map((reading) => <p key={reading.reference}><strong>{reading.reference}</strong> {reading.text}</p>)}
                </DetailSection>
              )}
              {day.available && day.relatedVerses?.length > 0 && <DetailSection title="Related verses">{day.relatedVerses.map((verse) => <p key={verse}>{verse}</p>)}</DetailSection>}
              {day.available && localizedValue(day.practice, lang) && <DetailSection title="Today's practice">{localizedValue(day.practice, lang)}</DetailSection>}
              {day.available && day.thingsToDo?.length > 0 && <DetailSection title="Things to do"><ul>{day.thingsToDo.map((item) => <li key={item}>{item}</li>)}</ul></DetailSection>}
              {day.available && localizedValue(day.virtues, lang) && <DetailSection title="Virtue">{localizedValue(day.virtues, lang)}</DetailSection>}
              {day.available && localizedValue(day.vices, lang) && <DetailSection title="Vice to surrender">{localizedValue(day.vices, lang)}</DetailSection>}
              {day.available && localizedValue(day.prayerToRepeat, lang) && <DetailSection title="Prayer to repeat">{localizedValue(day.prayerToRepeat, lang)}</DetailSection>}
              {day.available && localizedValue(day.dailyPrayer, lang) && <DetailSection title="Daily prayer">{localizedValue(day.dailyPrayer, lang)}</DetailSection>}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function DetailSection({ title, children }) {
  return <section className="detail-section"><h3>{title}</h3><div>{children}</div></section>;
}

export default App;
