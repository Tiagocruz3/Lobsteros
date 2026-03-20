import { html, nothing } from "lit";
import type { AppViewState } from "../app-view-state.ts";
import { icons } from "../icons.ts";

// Calendar/Scheduler Types
type ViewMode = 'month' | 'week' | 'day' | 'list';

interface CalendarTask {
  id: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  allDay?: boolean;
  color?: string;
  recurring?: 'daily' | 'weekly' | 'monthly' | 'none';
  status?: 'pending' | 'running' | 'completed' | 'failed';
  agentId?: string;
}

// State
let currentView: ViewMode = 'month';
let currentDate = new Date();
let selectedDate: Date | null = null;
let selectedTask: CalendarTask | null = null;
let showTaskModal = false;
let showCreateModal = false;
let tasks: CalendarTask[] = [];

// Helper functions
function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getFirstDayOfMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function getWeekDays(): string[] {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
}

function getMonthDays(date: Date): Array<{ date: Date; currentMonth: boolean }> {
  const days: Array<{ date: Date; currentMonth: boolean }> = [];
  const year = date.getFullYear();
  const month = date.getMonth();
  
  const firstDay = getFirstDayOfMonth(date);
  const daysInMonth = getDaysInMonth(date);
  const daysInPrevMonth = getDaysInMonth(new Date(year, month - 1));
  
  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    days.push({
      date: new Date(year, month - 1, daysInPrevMonth - i),
      currentMonth: false
    });
  }
  
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({
      date: new Date(year, month, i),
      currentMonth: true
    });
  }
  
  // Next month days to fill grid
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({
      date: new Date(year, month + 1, i),
      currentMonth: false
    });
  }
  
  return days;
}

function getTasksForDate(date: Date): CalendarTask[] {
  return tasks.filter(task => {
    const taskDate = new Date(task.startDate);
    return taskDate.toDateString() === date.toDateString();
  });
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'running': return '#00d26a';
    case 'completed': return '#4488ff';
    case 'failed': return '#ff4444';
    default: return '#ffb000';
  }
}

// Navigation functions
function goToToday() {
  currentDate = new Date();
  requestRender();
}

function goToPrevious() {
  if (currentView === 'month') {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  } else if (currentView === 'week') {
    currentDate = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else {
    currentDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
  }
  requestRender();
}

function goToNext() {
  if (currentView === 'month') {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  } else if (currentView === 'week') {
    currentDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  } else {
    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
  }
  requestRender();
}

function setView(view: ViewMode) {
  currentView = view;
  requestRender();
}

function selectDate(date: Date) {
  selectedDate = date;
  requestRender();
}

function openCreateModal(date?: Date) {
  selectedDate = date || new Date();
  showCreateModal = true;
  requestRender();
}

function closeModals() {
  showTaskModal = false;
  showCreateModal = false;
  selectedTask = null;
  requestRender();
}

function createTask(taskData: Partial<CalendarTask>) {
  const newTask: CalendarTask = {
    id: `task-${Date.now()}`,
    title: taskData.title || 'New Task',
    description: taskData.description || '',
    startDate: taskData.startDate || new Date(),
    endDate: taskData.endDate,
    allDay: taskData.allDay || false,
    color: taskData.color || '#ff3333',
    recurring: taskData.recurring || 'none',
    status: 'pending',
    ...taskData
  };
  tasks.push(newTask);
  closeModals();
}

function deleteTask(taskId: string) {
  tasks = tasks.filter(t => t.id !== taskId);
  closeModals();
}

let requestRender: () => void;

export function renderCalendarScheduler(state: AppViewState, renderCallback: () => void) {
  requestRender = renderCallback;
  
  // Sample tasks if empty
  if (tasks.length === 0) {
    const today = new Date();
    tasks = [
      {
        id: '1',
        title: 'Daily Backup',
        description: 'Automated system backup',
        startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 2, 0),
        allDay: false,
        recurring: 'daily',
        status: 'completed',
        color: '#4488ff'
      },
      {
        id: '2',
        title: 'Agent Report Generation',
        description: 'Generate weekly performance reports',
        startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 9, 0),
        endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 10, 0),
        allDay: false,
        status: 'pending',
        color: '#ff3333'
      },
      {
        id: '3',
        title: 'System Maintenance',
        description: 'Monthly system check and updates',
        startDate: new Date(today.getFullYear(), today.getMonth(), 15, 0, 0),
        allDay: true,
        recurring: 'monthly',
        status: 'pending',
        color: '#00d26a'
      }
    ];
  }
  
  return html`
    <div class="calendar-scheduler">
      ${renderHeader()}
      ${renderToolbar()}
      ${currentView === 'month' ? renderMonthView() : 
        currentView === 'week' ? renderWeekView() :
        currentView === 'day' ? renderDayView() : renderListView()}
      ${showCreateModal ? renderCreateModal() : nothing}
      ${showTaskModal && selectedTask ? renderTaskModal() : nothing}
    </div>
  `;
}

function renderHeader() {
  return html`
    <div class="calendar-header">
      <div class="calendar-header__left">
        <button class="calendar-btn calendar-btn--today" @click=${goToToday}>Today</button>
        <div class="calendar-nav">
          <button class="calendar-nav__btn" @click=${goToPrevious}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <button class="calendar-nav__btn" @click=${goToNext}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
        <h2 class="calendar-title">${formatDate(currentDate)}</h2>
      </div>
      
      <div class="calendar-header__right">
        <div class="calendar-view-toggle">
          ${['month', 'week', 'day', 'list'].map(view => html`
            <button 
              class="calendar-view-btn ${currentView === view ? 'active' : ''}"
              @click=${() => setView(view as ViewMode)}
            >
              ${view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          `)}
        </div>
        <button class="calendar-btn calendar-btn--primary" @click=${() => openCreateModal()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Create
        </button>
      </div>
    </div>
  `;
}

function renderToolbar() {
  return html`
    <div class="calendar-toolbar">
      <div class="calendar-filters">
        <label class="calendar-filter">
          <input type="checkbox" checked />
          <span class="filter-dot" style="background: #ff3333;"></span>
          Pending
        </label>
        <label class="calendar-filter">
          <input type="checkbox" checked />
          <span class="filter-dot" style="background: #00d26a;"></span>
          Running
        </label>
        <label class="calendar-filter">
          <input type="checkbox" checked />
          <span class="filter-dot" style="background: #4488ff;"></span>
          Completed
        </label>
      </div>
      <div class="calendar-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <input type="text" placeholder="Search tasks..." />
      </div>
    </div>
  `;
}

function renderMonthView() {
  const days = getMonthDays(currentDate);
  const weekDays = getWeekDays();
  
  return html`
    <div class="calendar-month">
      <div class="calendar-weekdays">
        ${weekDays.map(day => html`
          <div class="calendar-weekday">${day}</div>
        `)}
      </div>
      <div class="calendar-days">
        ${days.map(({ date, currentMonth }) => {
          const dayTasks = getTasksForDate(date);
          const isToday = date.toDateString() === new Date().toDateString();
          const isSelected = selectedDate?.toDateString() === date.toDateString();
          
          return html`
            <div 
              class="calendar-day ${!currentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}"
              @click=${() => selectDate(date)}
              @dblclick=${() => openCreateModal(date)}
            >
              <div class="calendar-day__number">${date.getDate()}</div>
              <div class="calendar-day__tasks">
                ${dayTasks.slice(0, 3).map(task => html`
                  <div 
                    class="calendar-task-dot"
                    style="background: ${task.color};"
                    title="${task.title}"
                    @click=${(e: Event) => {
                      e.stopPropagation();
                      selectedTask = task;
                      showTaskModal = true;
                      requestRender();
                    }}
                  ></div>
                `)}
                ${dayTasks.length > 3 ? html`
                  <div class="calendar-task-more">+${dayTasks.length - 3}</div>
                ` : nothing}
              </div>
              ${dayTasks.slice(0, 2).map(task => html`
                <div 
                  class="calendar-day__task"
                  style="border-left-color: ${task.color};"
                  @click=${(e: Event) => {
                    e.stopPropagation();
                    selectedTask = task;
                    showTaskModal = true;
                    requestRender();
                  }}
                >
                  ${task.allDay ? html`<span class="task-badge">All day</span>` : nothing}
                  ${task.title}
                </div>
              `)}
            </div>
          `;
        })}
      </div>
    </div>
  `;
}

function renderWeekView() {
  const weekStart = new Date(currentDate);
  weekStart.setDate(currentDate.getDate() - currentDate.getDay());
  
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  return html`
    <div class="calendar-week">
      <div class="calendar-week__header">
        <div class="calendar-week__time-col">GMT</div>
        ${getWeekDays().map((day, i) => {
          const date = new Date(weekStart);
          date.setDate(weekStart.getDate() + i);
          const isToday = date.toDateString() === new Date().toDateString();
          return html`
            <div class="calendar-week__day-header ${isToday ? 'today' : ''}">
              <div class="day-name">${day}</div>
              <div class="day-number">${date.getDate()}</div>
            </div>
          `;
        })}
      </div>
      <div class="calendar-week__grid">
        ${hours.map(hour => html`
          <div class="calendar-week__row">
            <div class="calendar-week__time">${hour}:00</div>
            ${getWeekDays().map((_, dayIndex) => {
              const date = new Date(weekStart);
              date.setDate(weekStart.getDate() + dayIndex);
              date.setHours(hour);
              
              const hourTasks = tasks.filter(task => {
                const taskDate = new Date(task.startDate);
                return taskDate.toDateString() === date.toDateString() && 
                       taskDate.getHours() === hour;
              });
              
              return html`
                <div 
                  class="calendar-week__cell"
                  @click=${() => openCreateModal(date)}
                >
                  ${hourTasks.map(task => html`
                    <div 
                      class="calendar-week__task"
                      style="background: ${task.color}20; border-left: 3px solid ${task.color};"
                      @click=${(e: Event) => {
                        e.stopPropagation();
                        selectedTask = task;
                        showTaskModal = true;
                        requestRender();
                      }}
                    >
                      <span class="task-time">${formatTime(new Date(task.startDate))}</span>
                      ${task.title}
                    </div>
                  `)}
                </div>
              `;
            })}
          </div>
        `)}
      </div>
    </div>
  `;
}

function renderDayView() {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const dayTasks = tasks.filter(task => {
    const taskDate = new Date(task.startDate);
    return taskDate.toDateString() === currentDate.toDateString();
  });
  
  return html`
    <div class="calendar-day-view">
      <div class="calendar-day-view__header">
        <div class="day-view-date">
          <div class="day-view-day">${currentDate.toLocaleDateString('en-US', { weekday: 'long' })}</div>
          <div class="day-view-date-full">${formatDate(currentDate)}</div>
        </div>
        <div class="day-view-stats">
          <div class="day-view-stat">
            <span class="stat-value">${dayTasks.length}</span>
            <span class="stat-label">Tasks</span>
          </div>
          <div class="day-view-stat">
            <span class="stat-value">${dayTasks.filter(t => t.status === 'completed').length}</span>
            <span class="stat-label">Done</span>
          </div>
        </div>
      </div>
      <div class="calendar-day-view__timeline">
        ${hours.map(hour => {
          const hourTasks = dayTasks.filter(task => {
            const taskDate = new Date(task.startDate);
            return taskDate.getHours() === hour;
          });
          
          return html`
            <div class="day-view-hour">
              <div class="day-view-hour__time">${hour}:00</div>
              <div 
                class="day-view-hour__content"
                @click=${() => {
                  const date = new Date(currentDate);
                  date.setHours(hour);
                  openCreateModal(date);
                }}
              >
                ${hourTasks.map(task => html`
                  <div 
                    class="day-view-task"
                    style="background: ${task.color}15; border-left: 4px solid ${task.color};"
                    @click=${(e: Event) => {
                      e.stopPropagation();
                      selectedTask = task;
                      showTaskModal = true;
                      requestRender();
                    }}
                  >
                    <div class="day-view-task__time">${formatTime(new Date(task.startDate))}</div>
                    <div class="day-view-task__title">${task.title}</div>
                    ${task.description ? html`
                      <div class="day-view-task__desc">${task.description}</div>
                    ` : nothing}
                    ${task.recurring !== 'none' ? html`
                      <div class="day-view-task__recurring">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                          <path d="M21 3v5h-5"/>
                        </svg>
                        ${task.recurring}
                      </div>
                    ` : nothing}
                  </div>
                `)}
              </div>
            </div>
          `;
        })}
      </div>
    </div>
  `;
}

function renderListView() {
  const sortedTasks = [...tasks].sort((a, b) => 
    new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
  
  // Group by date
  const grouped = sortedTasks.reduce((acc, task) => {
    const dateKey = new Date(task.startDate).toDateString();
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(task);
    return acc;
  }, {} as Record<string, CalendarTask[]>);
  
  return html`
    <div class="calendar-list">
      ${Object.entries(grouped).map(([dateKey, dateTasks]) => {
        const date = new Date(dateKey);
        const isToday = date.toDateString() === new Date().toDateString();
        
        return html`
          <div class="calendar-list__group">
            <div class="calendar-list__date ${isToday ? 'today' : ''}">
              <span class="date-day">${isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'long' })}</span>
              <span class="date-full">${formatShortDate(date)}</span>
            </div>
            <div class="calendar-list__tasks">
              ${dateTasks.map(task => html`
                <div 
                  class="calendar-list__task"
                  style="border-left-color: ${task.color};"
                  @click=${() => {
                    selectedTask = task;
                    showTaskModal = true;
                    requestRender();
                  }}
                >
                  <div class="list-task__time">
                    ${task.allDay ? 'All day' : formatTime(new Date(task.startDate))}
                  </div>
                  <div class="list-task__content">
                    <div class="list-task__title">${task.title}</div>
                    ${task.description ? html`
                      <div class="list-task__desc">${task.description}</div>
                    ` : nothing}
                  </div>
                  <div class="list-task__status">
                    <span class="status-badge" style="background: ${getStatusColor(task.status || 'pending')}20; color: ${getStatusColor(task.status || 'pending')};">
                      ${task.status}
                    </span>
                  </div>
                </div>
              `)}
            </div>
          </div>
        `;
      })}
    </div>
  `;
}

function renderCreateModal() {
  const date = selectedDate || new Date();
  
  return html`
    <div class="calendar-modal" @click=${closeModals}>
      <div class="calendar-modal__content" @click=${(e: Event) => e.stopPropagation()}>
        <div class="calendar-modal__header">
          <h3>Create Task</h3>
          <button class="modal-close" @click=${closeModals}>×</button>
        </div>
        <form class="calendar-form" @submit=${(e: Event) => {
          e.preventDefault();
          const form = e.target as HTMLFormElement;
          const formData = new FormData(form);
          createTask({
            title: formData.get('title') as string,
            description: formData.get('description') as string,
            startDate: new Date(formData.get('startDate') as string),
            allDay: formData.get('allDay') === 'on',
            recurring: formData.get('recurring') as string,
            color: formData.get('color') as string
          });
        }}>
          <div class="form-group">
            <label>Title</label>
            <input type="text" name="title" required placeholder="Task name..." />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea name="description" rows="3" placeholder="Add details..."></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Date & Time</label>
              <input type="datetime-local" name="startDate" 
                value="${date.toISOString().slice(0, 16)}" required />
            </div>
            <div class="form-group">
              <label>Color</label>
              <div class="color-picker">
                ${['#ff3333', '#00d26a', '#4488ff', '#ffb000', '#b347d9'].map(color => html`
                  <label class="color-option">
                    <input type="radio" name="color" value="${color}" ${color === '#ff3333' ? 'checked' : ''} />
                    <span style="background: ${color};"></span>
                  </label>
                `)}
              </div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" name="allDay" />
                <span>All day</span>
              </label>
            </div>
            <div class="form-group">
              <label>Repeat</label>
              <select name="recurring">
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="calendar-btn" @click=${closeModals}>Cancel</button>
            <button type="submit" class="calendar-btn calendar-btn--primary">Create Task</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderTaskModal() {
  if (!selectedTask) return nothing;
  
  return html`
    <div class="calendar-modal" @click=${closeModals}>
      <div class="calendar-modal__content" @click=${(e: Event) => e.stopPropagation()}>
        <div class="calendar-modal__header">
          <h3>Task Details</h3>
          <button class="modal-close" @click=${closeModals}>×</button>
        </div>
        <div class="task-details">
          <div class="task-details__header" style="border-left-color: ${selectedTask.color};">
            <h4>${selectedTask.title}</h4>
            <span class="task-status" style="background: ${getStatusColor(selectedTask.status || 'pending')}20; color: ${getStatusColor(selectedTask.status || 'pending')};">
              ${selectedTask.status}
            </span>
          </div>
          ${selectedTask.description ? html`
            <div class="task-details__section">
              <label>Description</label>
              <p>${selectedTask.description}</p>
            </div>
          ` : nothing}
          <div class="task-details__section">
            <label>When</label>
            <p>
              ${selectedTask.allDay ? 'All day' : formatTime(new Date(selectedTask.startDate))}
              • ${selectedTask.startDate.toLocaleDateString()}
            </p>
          </div>
          ${selectedTask.recurring !== 'none' ? html`
            <div class="task-details__section">
              <label>Repeats</label>
              <p>${selectedTask.recurring}</p>
            </div>
          ` : nothing}
          ${selectedTask.agentId ? html`
            <div class="task-details__section">
              <label>Agent</label>
              <p>${selectedTask.agentId}</p>
            </div>
          ` : nothing}
        </div>
        <div class="form-actions">
          <button class="calendar-btn calendar-btn--danger" @click=${() => deleteTask(selectedTask!.id)}>
            Delete
          </button>
          <button class="calendar-btn calendar-btn--primary" @click=${closeModals}>Close</button>
        </div>
      </div>
    </div>
  `;
}
