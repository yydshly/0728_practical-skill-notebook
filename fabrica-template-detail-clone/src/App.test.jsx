import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import App from './App';

test('renders the Fabrica template identity', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Fabrica' })).toBeInTheDocument();
});

test('opens and closes the category search overlay', () => {
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: 'Search templates' }));
  expect(screen.getByRole('dialog', { name: 'Search templates' })).toBeVisible();
  expect(screen.getByRole('searchbox', { name: 'Search for categories or templates' })).toBeVisible();

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog', { name: 'Search templates' })).toBeNull();
});

test('opens and closes the mobile navigation panel', () => {
  render(<App />);

  const menuButton = screen.getByRole('button', { name: 'Open menu' });
  fireEvent.click(menuButton);
  expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  const mobileNavigation = screen.getByRole('navigation', { name: 'Mobile navigation' });
  expect(mobileNavigation).toBeVisible();
  expect(within(mobileNavigation).getByRole('link', { name: 'Webflow' })).toHaveAttribute('href', '/templates/webflow');
  expect(within(mobileNavigation).queryByRole('link', { name: 'X' })).toBeNull();
  expect(within(mobileNavigation).queryByRole('link', { name: 'Instagram' })).toBeNull();

  fireEvent.click(within(mobileNavigation).getByRole('button', { name: 'Close navigation' }));
  expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).toBeNull();
});

test('switches the preview control from pause to play after the media pauses', () => {
  render(<App />);
  const video = screen.getByLabelText('Fabrica template preview');
  let isPaused = false;
  Object.defineProperty(video, 'paused', { configurable: true, get: () => isPaused });
  const pause = vi.spyOn(video, 'pause').mockImplementation(() => {
    isPaused = true;
    fireEvent(video, new Event('pause', { bubbles: true }));
  });

  fireEvent.click(screen.getByRole('button', { name: 'Pause video' }));
  expect(pause).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'Play video' })).toBeVisible();
  pause.mockRestore();
});

test('keeps the preview control ready to play when restart is rejected', async () => {
  render(<App />);
  const video = screen.getByLabelText('Fabrica template preview');
  let isPaused = true;
  Object.defineProperty(video, 'paused', { configurable: true, get: () => isPaused });
  fireEvent(video, new Event('pause', { bubbles: true }));
  expect(screen.getByRole('button', { name: 'Play video' })).toBeVisible();
  const play = vi.spyOn(video, 'play').mockImplementation(() => {
    isPaused = false;
    return Promise.reject(new Error('Playback was blocked'));
  });

  fireEvent.click(screen.getByRole('button', { name: 'Play video' }));

  await waitFor(() => expect(screen.getByRole('button', { name: 'Play video' })).toBeVisible());
  play.mockRestore();
});

test('renders the complete metadata table', () => {
  render(<App />);

  expect(screen.getByText('Overall score')).toBeVisible();
  expect(
    screen.getByText(
      'Fabrica works best for portfolio and agency projects that need smooth motion and video backgrounds.',
    ),
  ).toBeVisible();
});

test('renders all recommended templates and dismisses the cookie banner', async () => {
  render(<App />);

  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(18);

  fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

  expect(screen.queryByText('We use cookies')).toBeNull();
  expect(window.localStorage.getItem('fabrica-cookie-accepted')).toBe('true');
});
