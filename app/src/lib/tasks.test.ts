import { describe, expect, it } from 'vitest';

import {
  addTask,
  clearDone,
  createTask,
  filterTasks,
  isFilter,
  parseTasks,
  remainingCount,
  removeTask,
  toggleTask,
  type Task,
} from './tasks';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'id-1',
    title: 'Testitehtävä',
    done: false,
    createdAt: 1,
    ...overrides,
  };
}

describe('createTask', () => {
  it('siistii otsikon välilyönneistä', () => {
    expect(createTask('  Osta maitoa  ').title).toBe('Osta maitoa');
  });

  it('luo tehtävän keskeneräisenä', () => {
    expect(createTask('Osta maitoa').done).toBe(false);
  });

  it('heittää virheen tyhjästä otsikosta', () => {
    expect(() => createTask('   ')).toThrow(/tyhjä/i);
  });

  it('antaa jokaiselle tehtävälle oman tunnisteen', () => {
    const first = createTask('A', 1000);
    const second = createTask('B', 1000);
    expect(first.id).not.toBe(second.id);
  });
});

describe('addTask', () => {
  it('lisää tehtävän listan loppuun muuttamatta alkuperäistä', () => {
    const tasks = [makeTask()];
    const result = addTask(tasks, makeTask({ id: 'id-2' }));

    expect(result).toHaveLength(2);
    expect(result[1]?.id).toBe('id-2');
    expect(tasks).toHaveLength(1);
  });
});

describe('toggleTask', () => {
  it('vaihtaa vain kohdetehtävän tilan', () => {
    const tasks = [makeTask(), makeTask({ id: 'id-2' })];
    const result = toggleTask(tasks, 'id-2');

    expect(result[0]?.done).toBe(false);
    expect(result[1]?.done).toBe(true);
  });

  it('palauttaa listan ennallaan tuntemattomalla tunnisteella', () => {
    const tasks = [makeTask()];
    expect(toggleTask(tasks, 'ei-löydy')).toEqual(tasks);
  });
});

describe('removeTask', () => {
  it('poistaa oikean tehtävän', () => {
    const tasks = [makeTask(), makeTask({ id: 'id-2' })];
    expect(removeTask(tasks, 'id-1').map((task) => task.id)).toEqual(['id-2']);
  });
});

describe('clearDone', () => {
  it('jättää jäljelle vain keskeneräiset', () => {
    const tasks = [makeTask({ done: true }), makeTask({ id: 'id-2' })];
    expect(clearDone(tasks).map((task) => task.id)).toEqual(['id-2']);
  });
});

describe('filterTasks', () => {
  const tasks = [makeTask({ done: true }), makeTask({ id: 'id-2' })];

  it('palauttaa kaikki', () => {
    expect(filterTasks(tasks, 'all')).toHaveLength(2);
  });

  it('palauttaa keskeneräiset', () => {
    expect(filterTasks(tasks, 'active').map((task) => task.id)).toEqual(['id-2']);
  });

  it('palauttaa valmiit', () => {
    expect(filterTasks(tasks, 'done').map((task) => task.id)).toEqual(['id-1']);
  });
});

describe('remainingCount', () => {
  it('laskee keskeneräiset tehtävät', () => {
    expect(remainingCount([makeTask(), makeTask({ id: 'id-2', done: true })])).toBe(1);
  });

  it('palauttaa nollan tyhjälle listalle', () => {
    expect(remainingCount([])).toBe(0);
  });
});

describe('isFilter', () => {
  it('tunnistaa kelvolliset suodattimet', () => {
    expect(isFilter('active')).toBe(true);
    expect(isFilter('roskaa')).toBe(false);
  });
});

describe('parseTasks', () => {
  it('hyväksyy oikean muotoiset tehtävät', () => {
    expect(parseTasks([makeTask()])).toEqual([makeTask()]);
  });

  it('hylkää virheelliset rivit', () => {
    expect(parseTasks([makeTask(), { id: 5 }, null, 'teksti'])).toHaveLength(1);
  });

  it('palauttaa tyhjän listan, jos data ei ole taulukko', () => {
    expect(parseTasks({ tasks: [] })).toEqual([]);
    expect(parseTasks(null)).toEqual([]);
  });
});
