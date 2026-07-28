import { fireEvent, render, screen } from '@testing-library/react';
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
  expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Webflow' })).toHaveAttribute('href', '/templates/webflow');

  fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));
  expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).toBeNull();
});
