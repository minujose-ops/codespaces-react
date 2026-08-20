import { beforeEach, expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import App from './App';

const testData = {
  series: { title: '40 Days', subtitle: 'Eucharistic Deliverance Prayer', priest: 'Fr Daniel Poovannathil', totalDays: 40 },
  days: Array.from({ length: 40 }, (_, index) => ({
    day: index + 1,
    theme: index === 2 ? 'The Seventh Day' : `Day theme ${index + 1}`,
    summary: index === 2 ? 'The Eucharist calls us into His rest.' : 'A daily reflection.',
    scripture: 'Genesis 2:1-3',
    emoji: '🕊️',
    virtue: { title: 'Openness', detail: 'Open the soul.' },
    evil: { title: 'Blindness', detail: 'Turn toward God.' },
  })),
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(testData) })));
});

test('renders the page atlas with 40 tiles', async () => {
  render(<App />);
  expect(await screen.findByRole('heading', { level: 1, name: /eucharistic deliverance prayer/i })).toBeDefined();
  expect(within(screen.getByLabelText('Page index')).getAllByRole('button')).toHaveLength(40);
});

test('shows the selected page information when a tile is clicked', async () => {
  const user = (await import('@testing-library/user-event')).default.setup();
  render(<App />);

  await user.click(await screen.findByRole('button', { name: /03 the seventh day/i }));

  expect(screen.getByRole('heading', { name: 'The Seventh Day' })).toBeDefined();
  expect(screen.getByText(/the eucharist calls us into his rest/i)).toBeDefined();
});
