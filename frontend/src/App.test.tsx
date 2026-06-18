import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the live setlist tracker hero', () => {
  render(<App />);
  expect(screen.getByText(/NANA LIVE ACC\./i)).toBeInTheDocument();
  expect(screen.getByText(/LIVE SETLIST/i)).toBeInTheDocument();
});
