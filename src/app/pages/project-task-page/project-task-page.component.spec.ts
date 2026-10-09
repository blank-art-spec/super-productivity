import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { ProjectTaskPageComponent } from './project-task-page.component';
import { ProjectService } from '../../features/project/project.service';
import { Project } from '../../features/project/project.model';
import { DEFAULT_PROJECT } from '../../features/project/project.const';
import { WorkContextService } from '../../features/work-context/work-context.service';
import { PlainspaceClaimPoolService } from '../../features/plainspace/plainspace-claim-pool.service';

describe('Project List and Matrix views', () => {
  it('keeps Matrix on task updates, resets for another project and reveals search in List', () => {
    const project = new BehaviorSubject<Project>({
      ...DEFAULT_PROJECT,
      id: 'a',
      title: 'A',
    });
    const params = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      imports: [ProjectTaskPageComponent],
      providers: [
        { provide: ProjectService, useValue: { currentProject$: project } },
        { provide: ActivatedRoute, useValue: { queryParamMap: params } },
        {
          provide: PlainspaceClaimPoolService,
          useValue: { unclaimedTasksForProject$: () => of([]) },
        },
        {
          provide: WorkContextService,
          useValue: {
            activeWorkContext$: project,
            backlogTasks$: of([]),
            doneTasks$: of([]),
            undoneTasks$: of([]),
          },
        },
      ],
    }).overrideComponent(ProjectTaskPageComponent, {
      set: { template: '', imports: [] },
    });
    const component = TestBed.createComponent(ProjectTaskPageComponent).componentInstance;
    expect(component.isMatrixView()).toBe(false);
    component.isMatrixView.set(true);
    project.next({ ...project.value, taskIds: ['new-task'] });
    expect(component.isMatrixView()).toBe(true);
    project.next({ ...project.value, id: 'b' });
    expect(component.isMatrixView()).toBe(false);
    component.isMatrixView.set(true);
    params.next(convertToParamMap({ focusItem: 'task-from-search' }));
    expect(component.isMatrixView()).toBe(false);
  });
});
