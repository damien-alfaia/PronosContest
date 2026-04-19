import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { RedirectIfAuth } from '@/features/auth/guards/redirect-if-auth';
import { RequireAuth } from '@/features/auth/guards/require-auth';
import { useAuthStore } from '@/stores/auth-store';

type FakeUser = { id: string; email: string };

const resetStore = () => {
  useAuthStore.setState({ session: null, user: null, isReady: false });
};

const setAuth = (authed: boolean, ready = true) => {
  useAuthStore.setState({
    session: authed ? ({ user: { id: 'u1' } } as never) : null,
    user: authed ? ({ id: 'u1', email: 'a@b.co' } as FakeUser as never) : null,
    isReady: ready,
  });
};

const Protected = () => <div>protected-content</div>;
const LoginStub = () => <div>login-page</div>;
const DashboardStub = () => <div>dashboard</div>;

/**
 * On duplique JAMAIS les mêmes chemins dans et hors du guard :
 * sinon le `<Navigate />` du guard relance sa propre évaluation → loop.
 */
const renderWithRequireAuth = (initialPath: string) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/app/dashboard" element={<Protected />} />
        </Route>
        <Route path="/auth/login" element={<LoginStub />} />
      </Routes>
    </MemoryRouter>,
  );

const renderWithRedirectIfAuth = (initialPath: string) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<RedirectIfAuth />}>
          <Route path="/auth/login" element={<LoginStub />} />
        </Route>
        <Route path="/app/dashboard" element={<DashboardStub />} />
      </Routes>
    </MemoryRouter>,
  );

describe('<RequireAuth />', () => {
  beforeEach(resetStore);

  it('affiche un spinner tant que isReady=false', () => {
    setAuth(false, false);
    renderWithRequireAuth('/app/dashboard');
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('protected-content')).not.toBeInTheDocument();
  });

  it('redirige vers /auth/login si non authentifié', () => {
    setAuth(false, true);
    renderWithRequireAuth('/app/dashboard');
    expect(screen.getByText('login-page')).toBeInTheDocument();
  });

  it('laisse passer si authentifié', () => {
    setAuth(true, true);
    renderWithRequireAuth('/app/dashboard');
    expect(screen.getByText('protected-content')).toBeInTheDocument();
  });
});

describe('<RedirectIfAuth />', () => {
  beforeEach(resetStore);

  it('redirige vers /app/dashboard si déjà connecté', () => {
    setAuth(true, true);
    renderWithRedirectIfAuth('/auth/login');
    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });

  it('laisse voir la page si non connecté', () => {
    setAuth(false, true);
    renderWithRedirectIfAuth('/auth/login');
    expect(screen.getByText('login-page')).toBeInTheDocument();
  });

  it('spinner tant que isReady=false', () => {
    setAuth(false, false);
    renderWithRedirectIfAuth('/auth/login');
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
