import { useEffect, useState } from 'react';
import './App.css';

const DATA_URL = 'https://jaicyjoy.github.io/40-days/data/days.json';

function App() {
  const [content, setContent] = useState(null);
  const [selectedDay, setSelectedDay] = useState(1);

  useEffect(() => {
    fetch(DATA_URL)
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load the 40-day guide');
        return response.json();
      })
      .then(setContent)
      .catch(() => setContent({ error: true }));
  }, []);

  if (!content) return <main className="loading-screen">Loading the 40-day journey...</main>;
  if (content.error) return <main className="loading-screen">The guide could not be loaded. Please refresh to try again.</main>;

  const day = content.days.find(({ day: dayNumber }) => dayNumber === selectedDay) || content.days[0];
  const { series } = content;

  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="brand-mark" aria-hidden="true">🍞</div>
        <div>
          <p className="eyebrow">{series.title}</p>
          <h1>{series.subtitle}</h1>
          <p className="byline">By {series.priest}</p>
        </div>
        <p className="page-count"><strong>{String(day.day).padStart(2, '0')}</strong> / {series.totalDays}</p>
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
                <span className="tile-emoji" aria-hidden="true">{item.emoji}</span>
                <span className="tile-title">{item.theme}</span>
                <span className="tile-arrow" aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
        </div>

        <aside className="detail-panel" aria-live="polite">
          <div className="detail-topline"><span>Selected day</span><span>{String(day.day).padStart(2, '0')}</span></div>
          <div className="detail-number">{day.emoji}</div>
          <p className="eyebrow">Day {day.day}</p>
          <h2>{day.theme}</h2>
          <p className="scripture">{day.scripture}</p>
          <p className="detail-copy">{day.summary}</p>
          <div className="detail-footer"><span>Virtue: {day.virtue.title}</span><span className="status-dot">● {day.evil.title} to avoid</span></div>
        </aside>
      </section>
    </main>
  );
}

export default App;
