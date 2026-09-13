import './style.css';

import { loadTasks, saveTasks } from './lib/storage';
import {
  addTask,
  createTask,
  filterTasks,
  isFilter,
  remainingCount,
  removeTask,
  toggleTask,
  type Filter,
  type Task,
} from './lib/tasks';

const form = requireElement<HTMLFormElement>('#task-form');
const input = requireElement<HTMLInputElement>('#task-input');
const list = requireElement<HTMLUListElement>('#task-list');
const status = requireElement<HTMLParagraphElement>('#task-status');
const filterButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.filter'));

let tasks: Task[] = loadTasks();
let filter: Filter = 'all';

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const title = input.value.trim();
  if (title === '') {
    return;
  }

  tasks = addTask(tasks, createTask(title));
  input.value = '';
  input.focus();
  update();
});

list.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const id = target.closest<HTMLLIElement>('li[data-id]')?.dataset['id'];
  if (id === undefined) {
    return;
  }

  if (target.matches('[data-action="remove"]')) {
    tasks = removeTask(tasks, id);
    update();
  } else if (target.matches('[data-action="toggle"]')) {
    tasks = toggleTask(tasks, id);
    update();
  }
});

for (const button of filterButtons) {
  button.addEventListener('click', () => {
    const value = button.dataset['filter'] ?? 'all';
    filter = isFilter(value) ? value : 'all';
    update();
  });
}

function update(): void {
  render();
  saveTasks(tasks);
}

function render(): void {
  list.replaceChildren(...filterTasks(tasks, filter).map(renderTask));

  for (const button of filterButtons) {
    button.classList.toggle('is-active', button.dataset['filter'] === filter);
  }

  const remaining = remainingCount(tasks);
  status.textContent =
    tasks.length === 0
      ? 'Ei tehtäviä vielä.'
      : `${remaining} / ${tasks.length} tehtävää kesken.`;
}

function renderTask(task: Task): HTMLLIElement {
  const item = document.createElement('li');
  item.className = task.done ? 'task is-done' : 'task';
  item.dataset['id'] = task.id;

  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.className = 'task-toggle';
  toggle.checked = task.done;
  toggle.dataset['action'] = 'toggle';
  toggle.setAttribute('aria-label', `Merkitse tehtävä "${task.title}" valmiiksi`);

  const title = document.createElement('span');
  title.className = 'task-title';
  title.textContent = task.title;

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'task-remove';
  remove.dataset['action'] = 'remove';
  remove.textContent = '×';
  remove.setAttribute('aria-label', `Poista tehtävä "${task.title}"`);

  item.append(toggle, title, remove);
  return item;
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Elementtiä ei löytynyt: ${selector}`);
  }
  return element;
}

render();
