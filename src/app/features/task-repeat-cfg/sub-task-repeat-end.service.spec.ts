import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { DEFAULT_TASK, Task } from '../tasks/task.model';
import { DEFAULT_TASK_REPEAT_CFG } from './task-repeat-cfg.model';
import { selectTaskEntities } from '../tasks/store/task.selectors';
import { selectAllTaskRepeatCfgs } from './store/task-repeat-cfg.selectors';
import { SubTaskRepeatEndService } from './sub-task-repeat-end.service';
import { updateTaskRepeatCfg } from './store/task-repeat-cfg.actions';
import { TaskSharedActions } from '../../root-store/meta/task-shared.actions';

describe('SubTaskRepeatEndService', () => {
  const parent: Task = {
    ...DEFAULT_TASK,
    projectId: 'project',
    id: 'parent',
    title: 'Parent',
    repeatCfgId: 'repeat',
    subTaskIds: ['parent_sub_0', 'parent_sub_1'],
  };
  const child: Task = {
    ...DEFAULT_TASK,
    projectId: 'project',
    id: 'parent_sub_0',
    title: 'Child',
    parentId: parent.id,
  };
  const cfg = {
    ...DEFAULT_TASK_REPEAT_CFG,
    id: 'repeat',
    shouldInheritSubtasks: true,
    disableAutoUpdateSubtasks: true,
    endDate: '2026-10-20',
    subTaskTemplates: [{ title: 'Child' }, { title: 'Sibling' }],
  };
  let store: MockStore;
  let service: SubTaskRepeatEndService;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideMockStore({
          selectors: [
            {
              selector: selectTaskEntities,
              value: { [parent.id]: parent, [child.id]: child },
            },
            { selector: selectAllTaskRepeatCfgs, value: [cfg] },
          ],
        }),
      ],
    });
    store = TestBed.inject(MockStore);
    service = TestBed.inject(SubTaskRepeatEndService);
  });
  afterEach(() => store.resetSelectors());

  it('updates the selected template and child through ordinary patches, even with auto-update disabled', () => {
    const dispatch = spyOn(store, 'dispatch');
    service.setEndDate(child.id, '2026-10-19');
    const actions = dispatch.calls.allArgs().map(([action]) => action);
    expect(actions).toHaveSize(2);
    expect(actions[0]).toEqual(
      updateTaskRepeatCfg({
        taskRepeatCfg: {
          id: cfg.id,
          changes: {
            subTaskTemplates: [
              {
                title: 'Child',
                id: 'repeat:legacy-0',
                sourceTaskId: 'parent_sub_0',
                repeatEndDate: '2026-10-19',
              },
              { title: 'Sibling', id: 'repeat:legacy-1', sourceTaskId: 'parent_sub_1' },
            ],
          },
        },
        isAskToUpdateAllTaskInstances: false,
      }),
    );
    expect(actions[1]).toEqual(
      TaskSharedActions.updateTask({
        task: {
          id: child.id,
          changes: { repeatEndDate: '2026-10-19', repeatSubTaskId: 'repeat:legacy-0' },
        },
      }),
    );
    expect(cfg.subTaskTemplates[0]).toEqual({ title: 'Child' });
  });

  it('uses null for clearing so the date removal survives JSON and replay', () => {
    const dispatch = spyOn(store, 'dispatch');
    service.setEndDate(child.id, null);
    const action = dispatch.calls.mostRecent().args[0];
    expect(JSON.parse(JSON.stringify(action)).task.changes.repeatEndDate).toBeNull();
  });

  it('offers no cutoff for a top-level or unrelated task and ignores missing tasks', () => {
    const dispatch = spyOn(store, 'dispatch');
    expect(service.getContext(parent)).toBeNull();
    service.setEndDate('deleted', '2026-10-19');
    expect(dispatch).not.toHaveBeenCalled();
  });
});
