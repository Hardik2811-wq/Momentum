import { Capacitor, registerPlugin } from '@capacitor/core';

const WidgetBridge = registerPlugin('WidgetBridge');

export function syncAndroidTodayWidget(snapshot) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return Promise.resolve();
  return WidgetBridge.setToday({ snapshot }).catch(() => {});
}

export async function getPendingWidgetCompletedTasks() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return [];
  try {
    const res = await WidgetBridge.getPendingCompletedTasks();
    return Array.isArray(res?.taskIds) ? res.taskIds : [];
  } catch {
    return [];
  }
}

export async function getPendingWidgetCompletedHabits() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return [];
  try {
    const res = await WidgetBridge.getPendingCompletedHabits();
    return Array.isArray(res?.habitIds) ? res.habitIds : [];
  } catch {
    return [];
  }
}

export async function getPendingWidgetAction() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return null;
  try {
    const res = await WidgetBridge.getPendingAction();
    return res?.action || null;
  } catch {
    return null;
  }
}

export async function pinAndroidWidget(type = 'today') {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return false;
  try {
    await WidgetBridge.pinWidget({ type });
    return true;
  } catch {
    return false;
  }
}

