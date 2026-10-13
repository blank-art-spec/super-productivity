import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { NotebookCalendarComponent } from './notebook-calendar.component';
import { DateService } from '../../../core/date/date.service';
import { DateTimeFormatService } from '../../../core/date-time-format/date-time-format.service';
import { GlobalConfigService } from '../../config/global-config.service';

describe('Notebook calendar dialog', () => {
  const close = jasmine.createSpy('close');
  beforeEach(() => {
    close.calls.reset();
    TestBed.configureTestingModule({
      imports: [NotebookCalendarComponent, TranslateModule.forRoot()],
      providers: [
        { provide: DIALOG_DATA, useValue: '2026-10-31' },
        { provide: DialogRef, useValue: { close } },
        { provide: DateService, useValue: { todayStr: () => '2026-10-12' } },
        { provide: DateTimeFormatService, useValue: { textLocale: signal('zh-CN') } },
        {
          provide: GlobalConfigService,
          useValue: { localization: signal({ firstDayOfWeek: 1 }) },
        },
      ],
    });
  });
  it('renders all six weeks and navigates months safely from the 31st', () => {
    const fixture = TestBed.createComponent(NotebookCalendarComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.month-grid button').length).toBe(42);
    fixture.componentInstance.navigate(1);
    expect(fixture.componentInstance.month()).toBe('2026-11');
    expect(fixture.componentInstance.selected()).toBe('2026-10-31');
    fixture.componentInstance.navigate(-1);
    expect(fixture.componentInstance.month()).toBe('2026-10');
  });
  it('commits the selected day only on confirmation and keeps lunar visibility local', () => {
    const fixture = TestBed.createComponent(NotebookCalendarComponent);
    fixture.componentInstance.selected.set('2026-10-12');
    fixture.componentInstance.showLunar.set(false);
    fixture.componentInstance.close(false);
    expect(close).toHaveBeenCalledWith(undefined);
    fixture.componentInstance.close(true);
    expect(close).toHaveBeenCalledWith('2026-10-12');
  });
});
