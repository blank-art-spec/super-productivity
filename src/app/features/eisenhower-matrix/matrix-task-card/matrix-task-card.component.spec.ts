import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { signal } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MatrixTaskCardComponent } from './matrix-task-card.component';
import { DEFAULT_TASK } from '../../tasks/task.model';
import { DateTimeFormatService } from '../../../core/date-time-format/date-time-format.service';

describe('Notebook task card', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [MatrixTaskCardComponent, TranslateModule.forRoot()],
      providers: [
        {
          provide: DateTimeFormatService,
          useValue: {
            currentLocale: signal('zh-CN'),
            dateFormat: signal({ raw: 'shortDate' }),
          },
        },
      ],
    }),
  );

  it('shows a checklist for parents and opens their children under a global backdrop', () => {
    const fixture = TestBed.createComponent(MatrixTaskCardComponent);
    const parent = {
      ...DEFAULT_TASK,
      id: 'parent',
      title: 'Parent',
      subTaskIds: ['child'],
    };
    const child = { ...DEFAULT_TASK, id: 'child', title: 'Child', parentId: 'parent' };
    fixture.componentRef.setInput('task', parent);
    fixture.componentRef.setInput('notebook', true);
    fixture.componentRef.setInput('children', [child]);
    fixture.detectChanges();
    expect(
      fixture.nativeElement
        .querySelector('.notebook-task-check use')
        .getAttribute('href'),
    ).toContain('#checklist');
    fixture.nativeElement.querySelector('.notebook-task-check').click();
    fixture.detectChanges();
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    expect(overlay.querySelector('.notebook-overlay-backdrop')).not.toBeNull();
    expect(overlay.querySelector('.popup-children')!.textContent).toContain('Child');
    const complete = jasmine.createSpy('complete');
    fixture.componentInstance.complete.subscribe(complete);
    (overlay.querySelector('.popup-children button') as HTMLButtonElement).click();
    expect(complete).toHaveBeenCalledWith(child);
    (overlay.querySelector('.cdk-overlay-backdrop') as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.showChildren()).toBeFalse();
  });

  it('uses the circular arrow for plain plans and completes them without opening children', () => {
    const fixture = TestBed.createComponent(MatrixTaskCardComponent);
    const task = { ...DEFAULT_TASK, id: 'plain', title: 'Plain' };
    fixture.componentRef.setInput('task', task);
    fixture.componentRef.setInput('notebook', true);
    fixture.detectChanges();
    const complete = jasmine.createSpy('complete');
    fixture.componentInstance.complete.subscribe(complete);
    fixture.nativeElement.querySelector('.notebook-task-check').click();
    expect(fixture.componentInstance.icon()).toBe('repeat');
    expect(complete).toHaveBeenCalledWith(task);
    expect(fixture.componentInstance.showChildren()).toBeFalse();
  });

  it('hides footer metadata on notebook cards and preserves it in scoped matrices', () => {
    const fixture = TestBed.createComponent(MatrixTaskCardComponent);
    fixture.componentRef.setInput('task', {
      ...DEFAULT_TASK,
      id: 'past-plan',
      title: 'Past plan',
      dueDay: '2026-10-11',
      isDone: true,
    });
    fixture.componentRef.setInput('today', '2026-10-12');
    fixture.componentRef.setInput('notebook', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.task-status')).toBeNull();
    expect(fixture.nativeElement.querySelector('.task-meta')).toBeNull();
    fixture.componentRef.setInput('notebook', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.task-meta')).not.toBeNull();
  });
});
