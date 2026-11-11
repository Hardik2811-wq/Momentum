import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

const SCHEDULE_ACTION_TYPE = 'SCHEDULE_ACTIONS';
const TASK_ACTION_TYPE = 'TASK_ACTIONS';

/**
 * Check if running in a native Capacitor mobile container (Android/iOS)
 */
export const isNative = () => {
  return typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
};

/**
 * Request necessary notification permissions from the OS (Android 13+ POST_NOTIFICATIONS, etc.)
 */
export const requestNotificationPermissions = async () => {
  if (isNative()) {
    try {
      const status = await LocalNotifications.checkPermissions();
      if (status.display === 'granted') return true;
      const { display } = await LocalNotifications.requestPermissions();
      return display === 'granted';
    } catch (e) {
      console.warn("LocalNotifications requestPermissions error:", e);
      return false;
    }
  }

  // Web desktop fallback
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      if (Notification.permission === 'granted') return true;
      const res = await Notification.requestPermission();
      return res === 'granted';
    } catch (e) {
      console.warn("Web Notification requestPermission error:", e);
      return false;
    }
  }

  return false;
};

/**
 * Configure Android Notification Channels (API 26+) and interactive action buttons.
 */
export const setupNotificationChannels = async () => {
  if (!isNative()) return;

  try {
    // 1. Register interactive action buttons on notification tray
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: SCHEDULE_ACTION_TYPE,
          actions: [
            { id: 'mark_done', title: 'Mark Done' },
            { id: 'snooze', title: 'Snooze 10m' }
          ]
        },
        {
          id: TASK_ACTION_TYPE,
          actions: [
            { id: 'mark_done', title: 'Mark Done' },
            { id: 'snooze', title: 'Snooze 10m' }
          ]
        },
        {
          id: 'DAILY_BRIEFING_ACTIONS',
          actions: [
            { id: 'open_app', title: 'View Day' }
          ]
        }
      ]
    });

    // 2. Android 8.0+ High-Priority Notification Channels
    await LocalNotifications.createChannel({
      id: 'momentum_reminders',
      name: 'Class & Schedule Reminders',
      description: 'Heads-up reminders 10 minutes before university classes and scheduled blocks',
      importance: 5, // IMPORTANCE_HIGH: heads-up banner with sound and vibration
      visibility: 1, // VISIBILITY_PUBLIC on lockscreen
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#4F46E5'
    });

    await LocalNotifications.createChannel({
      id: 'momentum_tasks',
      name: 'Task & Focus Reminders',
      description: 'Reminders for scheduled tasks and upcoming deep focus sessions',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#10B981'
    });

    await LocalNotifications.createChannel({
      id: 'momentum_daily',
      name: 'Daily Morning Briefing',
      description: '8:00 AM overview of today priorities, classes, and tasks',
      importance: 3, // Standard importance
      visibility: 1
    });

    await LocalNotifications.createChannel({
      id: 'momentum_alerts',
      name: 'System & Timer Alerts',
      description: 'Focus timer completion chimes, AI suggestions, and system alerts',
      importance: 4,
      visibility: 1,
      vibration: true
    });
  } catch (e) {
    console.warn("LocalNotifications setup channels error:", e);
  }
};

/**
 * Setup listeners for when the user clicks an action button or notification.
 */
export const setupListeners = () => {
  if (!isNative()) return;

  try {
    LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
      const { actionId, notification } = notificationAction;
      const extra = notification.extra || {};

      console.log(`Notification action invoked: ${actionId} on ${notification.id}`, extra);

      if (actionId === 'mark_done') {
        // Dispatch window event so App.jsx and store mark the task complete
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('momentum:notification_action', {
              detail: { actionId: 'mark_done', taskId: extra.taskId, scheduleId: extra.scheduleId }
            })
          );
        }
      } else if (actionId === 'snooze') {
        // Reschedule for 10 minutes from now
        LocalNotifications.schedule({
          notifications: [
            {
              id: (notification.id + 10000) % 2147483647,
              title: notification.title,
              body: `(Snoozed) ${notification.body}`,
              channelId: notification.channelId || 'momentum_reminders',
              schedule: { at: new Date(Date.now() + 10 * 60000) },
              actionTypeId: notification.actionTypeId || SCHEDULE_ACTION_TYPE,
              extra
            }
          ]
        });
      }
    });
  } catch (e) {
    console.warn("LocalNotifications listener error:", e);
  }
};

/**
 * Send an immediate alert notification (works across Android native and web desktop)
 */
export const sendLocalNotification = async (title, options = {}) => {
  if (isNative()) {
    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== 'granted') return;
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 2000000000),
            title,
            body: options.body || '',
            channelId: 'momentum_alerts',
            schedule: { at: new Date(Date.now() + 100) },
            extra: options.extra || {}
          }
        ]
      });
    } catch (err) {
      console.warn('Native notification failed:', err);
    }
    return;
  }

  // Web desktop fallback
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { icon: '/favicon.svg', ...options });
    } catch (e) {
      console.warn('Web notification failed:', e);
    }
  }
};

/**
 * Sync the Daily Morning Briefing notification (8:00 AM every morning).
 */
export const syncDailyBriefing = async () => {
  if (!isNative()) return;

  try {
    const briefingId = 999999;
    await LocalNotifications.cancel({ notifications: [{ id: briefingId }] });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: briefingId,
          title: "Good Morning",
          body: "Your daily briefing is ready. Tap to view today's schedules and tasks.",
          channelId: 'momentum_daily',
          schedule: { on: { hour: 8, minute: 0 } },
          actionTypeId: 'DAILY_BRIEFING_ACTIONS'
        }
      ]
    });
  } catch (e) {
    console.warn("Error scheduling daily briefing:", e);
  }
};

const parseTime = (timeStr) => {
  if (!timeStr) return { hour: 9, minute: 0 };
  const [h, m] = timeStr.split(':').map(Number);
  return { hour: isNaN(h) ? 9 : h, minute: isNaN(m) ? 0 : m };
};

const getReminderTime = (timeStr, offsetMinutes = 10) => {
  const { hour, minute } = parseTime(timeStr);
  const total = hour * 60 + minute - offsetMinutes;
  const normalized = ((total % 1440) + 1440) % 1440;
  return { hour: Math.floor(normalized / 60), minute: normalized % 60 };
};

const stringToNumericId = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 2000000000;
};

/**
 * Sync schedule block reminders (classes, lectures, labs).
 */
export const syncScheduleReminders = async (schedules) => {
  if (!isNative() || !Array.isArray(schedules) || schedules.length === 0) return;

  try {
    const notificationsToSchedule = [];
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    schedules.forEach(sched => {
      if (!sched.startTime) return;
      const { hour, minute } = getReminderTime(sched.startTime, 10);
      const reminderMins = hour * 60 + minute;
      const baseId = stringToNumericId(`sched-${sched.id}`);

      const days = Array.isArray(sched.repeatDays) ? sched.repeatDays : [];
      if (days.length === 0) {
        // Non-recurring: only schedule if reminder time today is in the future
        if (reminderMins > currentMins) {
          const targetDate = new Date();
          targetDate.setHours(hour, minute, 0, 0);
          notificationsToSchedule.push({
            id: baseId,
            title: sched.title || "Upcoming Class",
            body: `Starts in 10 minutes (at ${sched.startTime})`,
            channelId: 'momentum_reminders',
            schedule: { at: targetDate },
            actionTypeId: SCHEDULE_ACTION_TYPE,
            extra: { scheduleId: sched.id }
          });
        }
      } else {
        // Recurring: schedule weekly occurrences
        days.forEach(dayIndex => {
          const capWeekday = (Number(dayIndex) % 7) + 1;
          notificationsToSchedule.push({
            id: (baseId + capWeekday) % 2000000000,
            title: sched.title || "Upcoming Class",
            body: `Starts in 10 minutes (at ${sched.startTime})`,
            channelId: 'momentum_reminders',
            schedule: { on: { weekday: capWeekday, hour, minute } },
            actionTypeId: SCHEDULE_ACTION_TYPE,
            extra: { scheduleId: sched.id }
          });
        });
      }
    });

    if (notificationsToSchedule.length > 0) {
      await LocalNotifications.schedule({ notifications: notificationsToSchedule });
    }
  } catch (e) {
    console.warn("Error syncing schedule reminders:", e);
  }
};

/**
 * Sync timed task reminders (Option: 10m pre-start heads-up for scheduled tasks).
 */
export const syncTaskReminders = async (tasks) => {
  if (!isNative() || !Array.isArray(tasks) || tasks.length === 0) return;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    const notificationsToSchedule = [];

    tasks.forEach(task => {
      if (task.completed || !task.startTime) return;
      const pDate = task.plannedDate || task.date;
      if (pDate && pDate !== today) return; // Only schedule for today

      const { hour, minute } = getReminderTime(task.startTime, 10);
      const reminderMins = hour * 60 + minute;

      // Only schedule if reminder is in the future today
      if (reminderMins > currentMins) {
        const targetDate = new Date();
        targetDate.setHours(hour, minute, 0, 0);
        const taskId = stringToNumericId(`task-${task.id}`);

        notificationsToSchedule.push({
          id: taskId,
          title: task.title || "Upcoming Task",
          body: `Task starts in 10 minutes (at ${task.startTime})`,
          channelId: 'momentum_tasks',
          schedule: { at: targetDate },
          actionTypeId: TASK_ACTION_TYPE,
          extra: { taskId: task.id }
        });
      }
    });

    if (notificationsToSchedule.length > 0) {
      await LocalNotifications.schedule({ notifications: notificationsToSchedule });
    }
  } catch (e) {
    console.warn("Error syncing task reminders:", e);
  }
};
