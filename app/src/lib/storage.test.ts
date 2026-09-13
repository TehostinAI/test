import { beforeEach, describe, expect, it } from 'vitest';

import { loadTasks, saveTasks } from './storage';
import type { Task } from './tasks';

const task: Task = { id: 'id-1', title: 'Osta maitoa', done: false, createdAt: 1 };

describe('loadTasks / saveTasks', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('tallentaa ja lukee tehtävät', () => {
    expect(saveTasks([task])).toBe(true);
    expect(loadTasks()).toEqual([task]);
  });

  it('palauttaa tyhjän listan, kun mitään ei ole tallennettu', () => {
    expect(loadTasks()).toEqual([]);
  });

  it('palauttaa tyhjän listan rikkinäisestä datasta', () => {
    localStorage.setItem('app.tasks.v1', '{ ei json');
    expect(loadTasks()).toEqual([]);
  });

  it('palauttaa false, jos tallennus epäonnistuu', () => {
    const failing = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
    } as unknown as Storage;

    expect(saveTasks([task], failing)).toBe(false);
  });
});
