package com.hardik.momentum.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.StrikethroughSpan;
import android.view.View;
import android.widget.RemoteViews;
import com.hardik.momentum.MainActivity;
import com.hardik.momentum.R;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class TodayWidgetProvider extends AppWidgetProvider {
  public static final String ACTION_COMPLETE_TASK = "com.hardik.momentum.ACTION_COMPLETE_TASK";
  public static final String ACTION_TOGGLE_HABIT = "com.hardik.momentum.ACTION_TOGGLE_HABIT";
  public static final String ACTION_QUICK_ADD = "com.hardik.momentum.ACTION_QUICK_ADD";
  public static final String EXTRA_TASK_ID = "extra_task_id";
  public static final String EXTRA_HABIT_ID = "extra_habit_id";
  private static final int MAX_TASK_ROWS = 3;
  private static final int MAX_HABIT_ROWS = 2;

  public static void refresh(Context context) {
    AppWidgetManager manager = AppWidgetManager.getInstance(context);
    ComponentName component = new ComponentName(context, TodayWidgetProvider.class);
    for (int id : manager.getAppWidgetIds(component)) {
      update(context, manager, id);
    }
  }

  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
    for (int id : appWidgetIds) {
      update(context, manager, id);
    }
  }

  @Override
  public void onAppWidgetOptionsChanged(Context context, AppWidgetManager appWidgetManager, int appWidgetId, android.os.Bundle newOptions) {
    super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions);
    update(context, appWidgetManager, appWidgetId);
  }

  @Override
  public void onReceive(Context context, Intent intent) {
    super.onReceive(context, intent);
    if (intent == null) return;

    if (ACTION_COMPLETE_TASK.equals(intent.getAction())) {
      String taskId = intent.getStringExtra(EXTRA_TASK_ID);
      if (taskId != null && !taskId.isEmpty()) {
        triggerHaptic(context);
        toggleTaskCompletionInSnapshot(context, taskId);
        refresh(context);
        BentoStatsWidgetProvider.refresh(context);
        UpcomingPillWidgetProvider.refresh(context);
      }
    } else if (ACTION_TOGGLE_HABIT.equals(intent.getAction())) {
      String habitId = intent.getStringExtra(EXTRA_HABIT_ID);
      if (habitId != null && !habitId.isEmpty()) {
        triggerHaptic(context);
        toggleHabitCompletionInSnapshot(context, habitId);
        refresh(context);
        HabitWidgetProvider.refresh(context);
      }
    }
  }

  private static void triggerHaptic(Context context) {
    try {
      Vibrator vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
      if (vibrator != null && vibrator.hasVibrator()) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          vibrator.vibrate(VibrationEffect.createOneShot(35, VibrationEffect.DEFAULT_AMPLITUDE));
        } else {
          vibrator.vibrate(35);
        }
      }
    } catch (Exception ignored) {}
  }

  private static void toggleTaskCompletionInSnapshot(Context context, String taskId) {
    SharedPreferences preferences = context.getSharedPreferences(WidgetBridgePlugin.PREFERENCES, Context.MODE_PRIVATE);
    String raw = preferences.getString(WidgetBridgePlugin.SNAPSHOT, "");
    if (raw == null || raw.isEmpty()) return;

    try {
      JSONObject snapshot = new JSONObject(raw);
      JSONArray tasks = snapshot.optJSONArray("tasks");
      if (tasks != null) {
        boolean toggled = false;
        for (int i = 0; i < tasks.length(); i++) {
          JSONObject item = tasks.optJSONObject(i);
          if (item != null && taskId.equals(item.optString("id", ""))) {
            boolean current = item.optBoolean("completed", false);
            item.put("completed", !current);
            toggled = true;
            break;
          }
        }

        if (toggled) {
          int pending = 0;
          int completed = 0;
          boolean isNowDone = false;
          for (int i = 0; i < tasks.length(); i++) {
            JSONObject item = tasks.optJSONObject(i);
            if (item != null) {
              if (item.optBoolean("completed", false)) {
                completed++;
              } else {
                pending++;
              }
              if (taskId.equals(item.optString("id", ""))) {
                isNowDone = item.optBoolean("completed", false);
              }
            }
          }
          int total = pending + completed;
          double percent = total > 0 ? Math.round((completed * 100.0) / total) : 84.0;
          snapshot.put("pendingCount", pending);
          snapshot.put("completedCount", completed);
          snapshot.put("totalCount", total);
          snapshot.put("completionPercentage", percent);
          preferences.edit().putString(WidgetBridgePlugin.SNAPSHOT, snapshot.toString()).apply();

          String pendingList = preferences.getString(WidgetBridgePlugin.PENDING_COMPLETED, "");
          String entry = taskId + ":" + (isNowDone ? "1" : "0");
          String updated = pendingList.isEmpty() ? entry : pendingList + "," + entry;
          preferences.edit().putString(WidgetBridgePlugin.PENDING_COMPLETED, updated).apply();
        }
      }
    } catch (Exception ignored) {}
  }

  private static void toggleHabitCompletionInSnapshot(Context context, String habitId) {
    SharedPreferences preferences = context.getSharedPreferences(WidgetBridgePlugin.PREFERENCES, Context.MODE_PRIVATE);
    String raw = preferences.getString(WidgetBridgePlugin.SNAPSHOT, "");
    if (raw == null || raw.isEmpty()) return;

    try {
      JSONObject snapshot = new JSONObject(raw);
      JSONArray habits = snapshot.optJSONArray("habits");
      if (habits != null) {
        boolean toggled = false;
        for (int i = 0; i < habits.length(); i++) {
          JSONObject item = habits.optJSONObject(i);
          if (item != null && habitId.equals(item.optString("id", ""))) {
            boolean current = item.optBoolean("isDone", false);
            item.put("isDone", !current);
            toggled = true;
            break;
          }
        }

        if (toggled) {
          preferences.edit().putString(WidgetBridgePlugin.SNAPSHOT, snapshot.toString()).apply();

          boolean isNowDone = false;
          for (int i = 0; i < habits.length(); i++) {
            JSONObject item = habits.optJSONObject(i);
            if (item != null && habitId.equals(item.optString("id", ""))) {
              isNowDone = item.optBoolean("isDone", false);
              break;
            }
          }

          String pendingList = preferences.getString(WidgetBridgePlugin.PENDING_COMPLETED_HABITS, "");
          String entry = habitId + ":" + (isNowDone ? "1" : "0");
          String updated = pendingList.isEmpty() ? entry : pendingList + "," + entry;
          preferences.edit().putString(WidgetBridgePlugin.PENDING_COMPLETED_HABITS, updated).apply();
        }
      }
    } catch (Exception ignored) {}
  }

  static class TaskItem {
    String id;
    String title;
    boolean completed;
    String startTime;
    int durationMinutes;
    String impact;
    String area;
    int subtasksCount;
    int subtasksDone;
    int priorityScore;
  }

  static class HabitItem {
    String id;
    String title;
    boolean isDone;
    int streakCount;
  }

  private static void update(Context context, AppWidgetManager manager, int appWidgetId) {
    RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today);
    SharedPreferences preferences = context.getSharedPreferences(WidgetBridgePlugin.PREFERENCES, Context.MODE_PRIVATE);
    String saved = preferences.getString(WidgetBridgePlugin.SNAPSHOT, "");

    Calendar now = Calendar.getInstance();
    int currentMinutes = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);

    List<TaskItem> allTasks = new ArrayList<>();
    List<HabitItem> allHabits = new ArrayList<>();
    int totalTaskCount = 0;
    int totalHabitCount = 0;

    try {
      if (saved != null && !saved.isEmpty()) {
        JSONObject snapshot = new JSONObject(saved);
        JSONArray tasks = snapshot.optJSONArray("tasks");
        if (tasks != null) {
          totalTaskCount = tasks.length();
          for (int i = 0; i < tasks.length(); i++) {
            JSONObject t = tasks.optJSONObject(i);
            if (t == null) continue;
            TaskItem item = new TaskItem();
            item.id = t.optString("id", String.valueOf(i));
            item.title = t.optString("title", "").trim();
            if (item.title.isEmpty()) continue;
            item.completed = t.optBoolean("completed", false);
            item.startTime = t.optString("startTime", "").trim();
            item.durationMinutes = t.optInt("durationMinutes", 45);
            item.impact = t.optString("impact", "medium").toLowerCase(Locale.ROOT);
            item.area = t.optString("area", "").trim();
            item.subtasksCount = t.optInt("subtasksCount", 0);
            item.subtasksDone = t.optInt("subtasksDone", 0);

            int score = 0;
            int startMinutes = -1;
            if (!item.startTime.isEmpty()) {
              try {
                String[] parts = item.startTime.split(":");
                startMinutes = Integer.parseInt(parts[0].trim()) * 60 + Integer.parseInt(parts[1].trim());
              } catch (Exception ignored) {}
            }

            if (startMinutes >= 0) {
              int endMinutes = startMinutes + Math.max(15, item.durationMinutes);
              if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
                score += 10000;
              } else if (startMinutes > currentMinutes) {
                score += 2000 - Math.min(1000, (startMinutes - currentMinutes));
              } else {
                score += 800;
              }
            } else {
              score += 500;
            }

            if ("high".equals(item.impact)) {
              score += 300;
            } else if ("medium".equals(item.impact)) {
              score += 150;
            } else {
              score += 50;
            }
            score += Math.max(0, 100 - Math.min(100, item.durationMinutes));

            item.priorityScore = score;
            allTasks.add(item);
          }
        }

        JSONArray habits = snapshot.optJSONArray("habits");
        if (habits != null) {
          totalHabitCount = habits.length();
          for (int i = 0; i < habits.length(); i++) {
            JSONObject h = habits.optJSONObject(i);
            if (h == null) continue;
            HabitItem item = new HabitItem();
            item.id = h.optString("id", String.valueOf(i));
            item.title = h.optString("title", "").trim();
            if (item.title.isEmpty()) continue;
            item.isDone = h.optBoolean("isDone", false);
            item.streakCount = h.optInt("streakCount", 0);
            allHabits.add(item);
          }
        }
      }
    } catch (Exception ignored) {}

    if (allTasks.isEmpty()) {
      TaskItem t1 = new TaskItem();
      t1.id = "stitch_t1"; t1.title = "DEEP WORK • SPRINT 03"; t1.startTime = "09:00 - 11:30"; t1.durationMinutes = 42;
      allTasks.add(t1);

      TaskItem t2 = new TaskItem();
      t2.id = "stitch_t2"; t2.title = "Q3 Design System Review"; t2.durationMinutes = 30;
      allTasks.add(t2);

      TaskItem t3 = new TaskItem();
      t3.id = "stitch_t3"; t3.title = "Sync w/ Engineering"; t3.durationMinutes = 15;
      allTasks.add(t3);
    }

    // Sort tasks: pending first by priority score, then completed
    Collections.sort(allTasks, new Comparator<TaskItem>() {
      @Override
      public int compare(TaskItem a, TaskItem b) {
        if (a.completed != b.completed) {
          return a.completed ? 1 : -1;
        }
        if (!a.completed) {
          return Integer.compare(b.priorityScore, a.priorityScore);
        }
        return 0;
      }
    });

    // Header Streak Badge
    views.setTextViewText(R.id.widget_count_badge, "🔥 14d STREAK");

    // Quick Add Button
    Intent addIntent = new Intent(context, MainActivity.class);
    addIntent.setAction(ACTION_QUICK_ADD);
    addIntent.putExtra("widget_action", "quick_add");
    addIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent addPI = PendingIntent.getActivity(context, 99, addIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    views.setOnClickPendingIntent(R.id.widget_btn_add, addPI);

    // Root click opens app
    Intent rootIntent = new Intent(context, MainActivity.class);
    rootIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent rootPI = PendingIntent.getActivity(context, 10, rootIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    views.setOnClickPendingIntent(R.id.widget_root, rootPI);

    // Task Rows Binding
    int[] rowIds = { R.id.widget_row_1, R.id.widget_row_2, R.id.widget_row_3 };
    int[] checkIds = { R.id.widget_check_1, R.id.widget_check_2, R.id.widget_check_3 };
    int[] contentIds = { R.id.widget_content_1, R.id.widget_content_2, R.id.widget_content_3 };
    int[] titleIds = { R.id.widget_title_1, R.id.widget_title_2, R.id.widget_title_3 };
    int[] metaIds = { R.id.widget_meta_1, R.id.widget_meta_2, R.id.widget_meta_3 };

    // Check widget options for responsive height
    android.os.Bundle widgetOptions = manager.getAppWidgetOptions(appWidgetId);
    int widgetMinHeight = widgetOptions != null ? widgetOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0) : 0;
    int maxDisplayTasks = (widgetMinHeight > 0 && widgetMinHeight < 140) ? 2 : MAX_TASK_ROWS;

    if (allTasks.isEmpty()) {
      views.setViewVisibility(R.id.widget_empty_view, View.VISIBLE);
      for (int i = 0; i < MAX_TASK_ROWS; i++) {
        views.setViewVisibility(rowIds[i], View.GONE);
      }
    } else {
      views.setViewVisibility(R.id.widget_empty_view, View.GONE);

      for (int i = 0; i < MAX_TASK_ROWS; i++) {
        if (i < allTasks.size() && i < maxDisplayTasks) {
          TaskItem item = allTasks.get(i);
          views.setViewVisibility(rowIds[i], View.VISIBLE);

          int dotRes = (i == 0) ? R.drawable.widget_dot_cyan : (i == 1 ? R.drawable.widget_dot_green : R.drawable.widget_dot_violet);
          if (item.completed) {
            SpannableString strikethrough = new SpannableString(item.title);
            strikethrough.setSpan(new StrikethroughSpan(), 0, strikethrough.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            views.setTextViewText(titleIds[i], strikethrough);
            views.setTextColor(titleIds[i], Color.parseColor("#64748B"));

            views.setImageViewResource(checkIds[i], R.drawable.widget_checkbox_checked);

            views.setInt(rowIds[i], "setBackgroundResource", R.drawable.widget_item_bg);
            views.setTextViewText(metaIds[i], "Completed");
            views.setTextColor(metaIds[i], Color.parseColor("#475569"));
          } else {
            views.setTextViewText(titleIds[i], item.title);
            views.setImageViewResource(checkIds[i], dotRes);

            if (i == 0) {
              views.setInt(rowIds[i], "setBackgroundResource", R.drawable.widget_now_bg);
              views.setTextColor(titleIds[i], Color.parseColor("#FFFFFF"));
            } else {
              views.setInt(rowIds[i], "setBackgroundResource", R.drawable.widget_item_bg);
              views.setTextColor(titleIds[i], Color.parseColor("#F1F5F9"));
            }

            if (i == 0) {
              try {
                views.setTextViewText(R.id.widget_time_pill_1, item.startTime.isEmpty() ? "09:00 - 11:30" : item.startTime);
                views.setTextViewText(R.id.widget_meta_1, (item.durationMinutes > 0 ? item.durationMinutes : 42) + "m remaining");
                views.setProgressBar(R.id.widget_progress_bar_1, 100, 65, false);
              } catch (Exception ignored) {}
            } else if (i == 1) {
              views.setTextViewText(R.id.widget_meta_2, (item.durationMinutes > 0 ? item.durationMinutes : 30) + "m");
            } else if (i == 2) {
              views.setTextViewText(R.id.widget_meta_3, (item.durationMinutes > 0 ? item.durationMinutes : 15) + "m");
            }
          }

          // Checkbox toggle
          Intent checkIntent = new Intent(context, TodayWidgetProvider.class);
          checkIntent.setAction(ACTION_COMPLETE_TASK);
          checkIntent.setData(Uri.parse("momentum://task/complete/" + item.id));
          checkIntent.putExtra(EXTRA_TASK_ID, item.id);
          PendingIntent checkPI = PendingIntent.getBroadcast(
              context,
              i + 200,
              checkIntent,
              PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
          );
          views.setOnClickPendingIntent(checkIds[i], checkPI);

          // Content click
          Intent openIntent = new Intent(context, MainActivity.class);
          openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
          openIntent.setData(Uri.parse("momentum://task/open/" + item.id));
          PendingIntent openPI = PendingIntent.getActivity(
              context,
              i + 300,
              openIntent,
              PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
          );
          views.setOnClickPendingIntent(contentIds[i], openPI);
        } else {
          views.setViewVisibility(rowIds[i], View.GONE);
        }
      }
    }

    manager.updateAppWidget(appWidgetId, views);
  }
}
