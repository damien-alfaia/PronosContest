import '@testing-library/jest-dom/vitest';

// Initialise i18next (FR/EN) globalement : certains composants rendus pendant
// les tests (FullScreenSpinner, AuthLayout, …) consomment `useTranslation()`.
import '@/i18n';
