import { fireEvent, render, screen, within } from '@testing-library/react';
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
  expect(screen.getByRole('link', { name: 'Webflow' })).toHaveAttribute('href', '/templates/webflow');
  expect(within(mobileNavigation).queryByRole('link', { name: 'X' })).toBeNull();
  expect(within(mobileNavigation).queryByRole('link', { name: 'Instagram' })).toBeNull();

  fireEvent.click(within(mobileNavigation).getByRole('button', { name: 'Close navigation' }));
  expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).toBeNull();
});

test('switches the preview control from pause to play', () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: 'Pause video' }));
  expect(screen.getByRole('button', { name: 'Play video' })).toBeVisible();
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
