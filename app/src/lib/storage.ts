import { parseTasks, type Task } from './tasks';

const STORAGE_KEY = 'app.tasks.v1';

/** Lukee tehtävät selaimen tallennustilasta. Palauttaa tyhjän listan virhetilanteissa. */
export function loadTasks(storage: Storage = localStorage): Task[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) {
      return [];
    }
    return parseTasks(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Tallentaa tehtävät. Palauttaa false, jos tallennus ei onnistunut. */
export function saveTasks(tasks: readonly Task[], storage: Storage = localStorage): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch {
    return false;
  }
}
