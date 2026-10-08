package com.hardik.momentum.widget;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {
  public static final String PREFERENCES = "momentum_widget";
  public static final String SNAPSHOT = "today_snapshot";
  public static final String PENDING_COMPLETED = "pending_completed_ids";
  public static final String PENDING_COMPLETED_HABITS = "pending_completed_habit_ids";
  public static final String PENDING_ACTION = "pending_widget_action";

  public static void setPendingAction(Context context, String action) {
    if (context == null || action == null) return;
    SharedPreferences prefs = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    prefs.edit().putString(PENDING_ACTION, action).apply();
  }

  @PluginMethod
  public void setToday(PluginCall call) {
    JSObject snapshot = call.getObject("snapshot");
    if (snapshot == null) {
      call.reject("Missing widget snapshot.");
      return;
    }
    SharedPreferences preferences = getContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    preferences.edit().putString(SNAPSHOT, snapshot.toString()).apply();
    TodayWidgetProvider.refresh(getContext());
    BentoStatsWidgetProvider.refresh(getContext());
    HabitWidgetProvider.refresh(getContext());
    QuickActionsWidgetProvider.refresh(getContext());
    UpcomingPillWidgetProvider.refresh(getContext());
    call.resolve();
  }

  @PluginMethod
  public void getPendingCompletedTasks(PluginCall call) {
    SharedPreferences preferences = getContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    String raw = preferences.getString(PENDING_COMPLETED, "");
    if (!raw.trim().isEmpty()) {
      preferences.edit().remove(PENDING_COMPLETED).apply();
    }

    JSObject result = new JSObject();
    JSArray array = new JSArray();
    if (!raw.trim().isEmpty()) {
      String[] parts = raw.split(",");
      for (String part : parts) {
        String clean = part.trim();
        if (!clean.isEmpty()) array.put(clean);
      }
    }
    result.put("taskIds", array);
    call.resolve(result);
  }

  @PluginMethod
  public void getPendingCompletedHabits(PluginCall call) {
    SharedPreferences preferences = getContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    String raw = preferences.getString(PENDING_COMPLETED_HABITS, "");
    if (!raw.trim().isEmpty()) {
      preferences.edit().remove(PENDING_COMPLETED_HABITS).apply();
    }

    JSObject result = new JSObject();
    JSArray array = new JSArray();
    if (!raw.trim().isEmpty()) {
      String[] parts = raw.split(",");
      for (String part : parts) {
        String clean = part.trim();
        if (!clean.isEmpty()) array.put(clean);
      }
    }
    result.put("habitIds", array);
    call.resolve(result);
  }

  @PluginMethod
  public void getPendingAction(PluginCall call) {
    SharedPreferences preferences = getContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    String action = preferences.getString(PENDING_ACTION, null);
    if (action != null) {
      preferences.edit().remove(PENDING_ACTION).apply();
    }
    JSObject result = new JSObject();
    result.put("action", action);
    call.resolve(result);
  }
}
