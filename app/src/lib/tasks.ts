/**
 * Tehtävälistan tilalogiikka. Kaikki funktiot ovat puhtaita ja palauttavat
 * uuden taulukon, joten tilan muutokset ovat helposti testattavissa.
 */

export type Task = {
  readonly id: string;
  readonly title: string;
  readonly done: boolean;
  readonly createdAt: number;
};

export type Filter = 'all' | 'active' | 'done';

export const FILTERS: readonly Filter[] = ['all', 'active', 'done'];

export function isFilter(value: string): value is Filter {
  return (FILTERS as readonly string[]).includes(value);
}

/** Luo uuden tehtävän. Heittää virheen, jos otsikko on tyhjä. */
export function createTask(title: string, now: number = Date.now()): Task {
  const trimmed = title.trim();
  if (trimmed === '') {
    throw new Error('Tehtävän otsikko ei voi olla tyhjä');
  }

  return {
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title: trimmed,
    done: false,
    createdAt: now,
  };
}

export function addTask(tasks: readonly Task[], task: Task): Task[] {
  return [...tasks, task];
}

export function toggleTask(tasks: readonly Task[], id: string): Task[] {
  return tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task));
}

export function removeTask(tasks: readonly Task[], id: string): Task[] {
  return tasks.filter((task) => task.id !== id);
}

export function clearDone(tasks: readonly Task[]): Task[] {
  return tasks.filter((task) => !task.done);
}

export function filterTasks(tasks: readonly Task[], filter: Filter): Task[] {
  switch (filter) {
    case 'active':
      return tasks.filter((task) => !task.done);
    case 'done':
      return tasks.filter((task) => task.done);
    case 'all':
      return [...tasks];
  }
}

export function remainingCount(tasks: readonly Task[]): number {
  return tasks.reduce((count, task) => (task.done ? count : count + 1), 0);
}

/** Varmistaa, että tallennettu data on oikean muotoinen ennen käyttöä. */
export function parseTasks(raw: unknown): Task[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter(isTask).map((task) => ({
    id: task.id,
    title: task.title,
    done: task.done,
    createdAt: task.createdAt,
  }));
}

function isTask(value: unknown): value is Task {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['id'] === 'string' &&
    typeof candidate['title'] === 'string' &&
    typeof candidate['done'] === 'boolean' &&
    typeof candidate['createdAt'] === 'number'
  );
}
