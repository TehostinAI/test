import { beforeEach, describe, expect, it, vi } from 'vitest';

const MARKUP = `
  <form id="task-form">
    <input id="task-input" type="text" />
    <button type="submit">Lisää</button>
  </form>
  <div class="filters">
    <button class="filter is-active" type="button" data-filter="all">Kaikki</button>
    <button class="filter" type="button" data-filter="active">Kesken</button>
    <button class="filter" type="button" data-filter="done">Valmiit</button>
  </div>
  <ul id="task-list"></ul>
  <p id="task-status"></p>
`;

async function mountApp(): Promise<void> {
  document.body.innerHTML = MARKUP;
  localStorage.clear();
  // Moduuli kytkeytyy DOM:iin latautuessaan, joten se suoritetaan uudestaan joka testissä.
  vi.resetModules();
  await import('./main');
}

function addTaskViaUi(title: string): void {
  const input = document.querySelector<HTMLInputElement>('#task-input')!;
  const form = document.querySelector<HTMLFormElement>('#task-form')!;

  input.value = title;
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

function titles(): string[] {
  return Array.from(document.querySelectorAll('.task-title')).map((el) => el.textContent ?? '');
}

describe('käyttöliittymä', () => {
  beforeEach(async () => {
    await mountApp();
  });

  it('näyttää tyhjän tilan viestin', () => {
    expect(document.querySelector('#task-status')?.textContent).toBe('Ei tehtäviä vielä.');
  });

  it('lisää tehtävän lomakkeelta ja tyhjentää kentän', () => {
    addTaskViaUi('Osta maitoa');

    expect(titles()).toEqual(['Osta maitoa']);
    expect(document.querySelector<HTMLInputElement>('#task-input')?.value).toBe('');
    expect(document.querySelector('#task-status')?.textContent).toBe('1 / 1 tehtävää kesken.');
  });

  it('ei lisää tyhjää tehtävää', () => {
    addTaskViaUi('   ');
    expect(titles()).toEqual([]);
  });

  it('merkitsee tehtävän valmiiksi ja suodattaa sen pois', () => {
    addTaskViaUi('Osta maitoa');
    document.querySelector<HTMLInputElement>('[data-action="toggle"]')!.click();

    expect(document.querySelector('.task')?.classList.contains('is-done')).toBe(true);
    expect(document.querySelector('#task-status')?.textContent).toBe('0 / 1 tehtävää kesken.');

    document.querySelector<HTMLButtonElement>('[data-filter="active"]')!.click();
    expect(titles()).toEqual([]);

    document.querySelector<HTMLButtonElement>('[data-filter="done"]')!.click();
    expect(titles()).toEqual(['Osta maitoa']);
  });

  it('poistaa tehtävän', () => {
    addTaskViaUi('Osta maitoa');
    document.querySelector<HTMLButtonElement>('[data-action="remove"]')!.click();

    expect(titles()).toEqual([]);
  });

  it('tallentaa tehtävät selaimen muistiin', () => {
    addTaskViaUi('Osta maitoa');

    const stored = JSON.parse(localStorage.getItem('app.tasks.v1') ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].title).toBe('Osta maitoa');
  });
});
