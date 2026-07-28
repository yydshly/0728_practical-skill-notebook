import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the Fabrica template identity', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Fabrica' })).toBeInTheDocument();
});
