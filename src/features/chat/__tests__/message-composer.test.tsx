import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { MessageComposer } from '@/features/chat/message-composer';
import { MESSAGE_BODY_MAX } from '@/features/chat/schemas';
import { i18n } from '@/i18n';

/**
 * Tests unitaires de `<MessageComposer />`.
 *
 * On vérifie :
 *   - Le bouton est disabled par défaut (body vide).
 *   - Saisie → bouton devient enabled, click → onSend appelé avec body.
 *   - Ctrl+Enter (ou Cmd+Enter) submit aussi.
 *   - Après succès : le textarea est reset à vide.
 *   - Après erreur : le texte reste dans le champ (pour retry).
 *   - `disabled=true` : textarea + bouton disabled, placeholder alternatif.
 *   - Compteur visible dès ~80% de la limite + rouge quand dépassé.
 *   - Erreur Zod (bodyRequired) traduite via la clé i18n stockée dans Zod.
 *
 * On utilise `fireEvent` / `fireEvent.change` plutôt que `userEvent`
 * (pas installé) pour piloter le textarea. Pour que React Hook Form
 * capte la valeur, on passe par `fireEvent.input` quand nécessaire.
 */

const setBody = (textarea: HTMLTextAreaElement, value: string) => {
  // React Hook Form (mode onChange) écoute `input` — fireEvent.change
  // dispatch bien `input` + `change`, donc ça suffit pour les deux.
  fireEvent.change(textarea, { target: { value } });
};

beforeAll(async () => {
  await i18n.changeLanguage('fr');
});

describe('<MessageComposer />', () => {
  it('bouton Send disabled quand le body est vide', () => {
    render(<MessageComposer onSend={vi.fn()} isSending={false} />);
    const btn = screen.getByRole('button', { name: /envoyer/i });
    expect(btn).toBeDisabled();
  });

  it("appelle onSend avec le body après saisie + click", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<MessageComposer onSend={onSend} isSending={false} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    setBody(textarea, 'Salut équipe');

    const btn = screen.getByRole('button', { name: /envoyer/i });
    await waitFor(() => {
      expect(btn).not.toBeDisabled();
    });
    await act(async () => {
      fireEvent.click(btn);
    });

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith('Salut équipe');
  });

  it('Ctrl+Enter déclenche le submit', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<MessageComposer onSend={onSend} isSending={false} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    setBody(textarea, 'via raccourci');

    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    });

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith('via raccourci');
    });
  });

  it('Cmd+Enter (metaKey) déclenche aussi le submit (macOS)', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<MessageComposer onSend={onSend} isSending={false} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    setBody(textarea, 'via cmd');

    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
    });

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith('via cmd');
    });
  });

  it('Enter seul (sans Ctrl/Cmd) n appelle PAS onSend (insertion de ligne)', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<MessageComposer onSend={onSend} isSending={false} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    setBody(textarea, 'hello');
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("après un envoi réussi : le champ est reset à vide", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<MessageComposer onSend={onSend} isSending={false} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    setBody(textarea, 'draft');

    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    });

    await waitFor(() => {
      expect(onSend).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(textarea.value).toBe('');
    });
  });

  it("après un échec d'envoi : le texte reste dans le champ", async () => {
    const onSend = vi.fn().mockRejectedValue(new Error('boom'));
    render(<MessageComposer onSend={onSend} isSending={false} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    setBody(textarea, 'draft critique');

    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    });

    await waitFor(() => {
      expect(onSend).toHaveBeenCalled();
    });
    // Le texte doit être préservé pour que l'utilisateur puisse réessayer.
    expect(textarea.value).toBe('draft critique');
  });

  it('disabled=true : textarea disabled + placeholder "disabled"', () => {
    render(
      <MessageComposer onSend={vi.fn()} isSending={false} disabled />,
    );
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDisabled();
    expect(textarea).toHaveAttribute(
      'placeholder',
      i18n.t('chat.composer.placeholderDisabled'),
    );
  });

  it('isSending=true : bouton disabled même avec du texte', () => {
    render(<MessageComposer onSend={vi.fn()} isSending />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    setBody(textarea, 'hey');

    const btn = screen.getByRole('button', { name: /envoyer/i });
    expect(btn).toBeDisabled();
  });

  it('compteur visible dès ~80% de la limite, avec valeur restante', async () => {
    render(<MessageComposer onSend={vi.fn()} isSending={false} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    // 850 caractères → compteur visible (seuil 80% = 800).
    setBody(textarea, 'x'.repeat(850));

    // remaining = 1000 - 850 = 150, affiché quelque part.
    await waitFor(() => {
      expect(screen.getByText('150')).toBeInTheDocument();
    });
  });

  it("compteur passe en destructive (rouge) quand on dépasse la limite", async () => {
    render(<MessageComposer onSend={vi.fn()} isSending={false} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    setBody(textarea, 'x'.repeat(MESSAGE_BODY_MAX + 10));

    // Le compteur devient négatif (−10), et il porte la classe text-destructive.
    await waitFor(() => {
      const counter = screen.getByText('-10');
      expect(counter.className).toContain('text-destructive');
    });
  });

  it('affiche un message d erreur quand le body est vide et qu on tente de submit', async () => {
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} isSending={false} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    // On saisit puis on efface pour déclencher une validation en mode onChange.
    setBody(textarea, 'a');
    setBody(textarea, '');

    // Le message est la clé i18n résolue par t()
    const errLabel = i18n.t('chat.errors.bodyRequired');
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(errLabel);
    });
  });
});
