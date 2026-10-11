import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { TagTaskPageComponent } from './tag-task-page.component';
import { WorkContextService } from '../../features/work-context/work-context.service';
import { TODAY_TAG } from '../../features/tag/tag.const';

describe('Tag List and Matrix views', () => {
  it('keeps a selected view on task updates, resets on tag/search navigation, and preserves Today', () => {
    const params = new BehaviorSubject(convertToParamMap({ id: 'learning' }));
    const query = new BehaviorSubject(convertToParamMap({}));
    const tasks = new BehaviorSubject([]);
    TestBed.configureTestingModule({
      imports: [TagTaskPageComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: params, queryParamMap: query } },
        {
          provide: WorkContextService,
          useValue: {
            backlogTasks$: of([]),
            doneTasks$: of([]),
            undoneTasks$: tasks,
          },
        },
      ],
    }).overrideComponent(TagTaskPageComponent, { set: { template: '', imports: [] } });
    const component = TestBed.createComponent(TagTaskPageComponent).componentInstance;
    expect(component.isMatrixAvailable()).toBe(true);
    expect(component.isMatrixView()).toBe(false);
    component.isMatrixView.set(true);
    tasks.next([]);
    expect(component.isMatrixView()).toBe(true);
    params.next(convertToParamMap({ id: 'personal' }));
    expect(component.isMatrixView()).toBe(false);
    component.isMatrixView.set(true);
    query.next(convertToParamMap({ focusItem: 'found-task' }));
    expect(component.isMatrixView()).toBe(false);
    params.next(convertToParamMap({ id: TODAY_TAG.id }));
    expect(component.isMatrixAvailable()).toBe(false);
  });
});
