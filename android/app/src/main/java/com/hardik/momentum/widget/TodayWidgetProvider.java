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
  public static final String ACTION_QUICK_ADD = "com.hardik.momentum.ACTION_QUICK_ADD";
  public static final String EXTRA_TASK_ID = "extra_task_id";
  private static final int MAX_ROWS = 4;

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
  public void onReceive(Context context, Intent intent) {
    super.onReceive(context, intent);
    if (intent == null) return;

    if (ACTION_COMPLETE_TASK.equals(intent.getAction())) {
      String taskId = intent.getStringExtra(EXTRA_TASK_ID);
      if (taskId != null && !taskId.isEmpty()) {
        triggerHaptic(context);
        toggleTaskCompletionInSnapshot(context, taskId);
        refresh(context);
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
          // Recalculate pendingCount
          int pending = 0;
          for (int i = 0; i < tasks.length(); i++) {
            JSONObject item = tasks.optJSONObject(i);
            if (item != null && !item.optBoolean("completed", false)) {
              pending++;
            }
          }
          snapshot.put("pendingCount", pending);
          preferences.edit().putString(WidgetBridgePlugin.SNAPSHOT, snapshot.toString()).apply();

          // Record taskId in pending_completed_ids for sync with React
          String pendingList = preferences.getString(WidgetBridgePlugin.PENDING_COMPLETED, "");
          String updated = pendingList.isEmpty() ? taskId : pendingList + "," + taskId;
          preferences.edit().putString(WidgetBridgePlugin.PENDING_COMPLETED, updated).apply();
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

  private static void update(Context context, AppWidgetManager manager, int appWidgetId) {
    RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today);
    SharedPreferences preferences = context.getSharedPreferences(WidgetBridgePlugin.PREFERENCES, Context.MODE_PRIVATE);
    String saved = preferences.getString(WidgetBridgePlugin.SNAPSHOT, "");

    Calendar now = Calendar.getInstance();
    int currentMinutes = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);

    List<TaskItem> allTasks = new ArrayList<>();
    int reportedPending = 0;

    try {
      if (saved != null && !saved.isEmpty()) {
        JSONObject snapshot = new JSONObject(saved);
        reportedPending = snapshot.optInt("pendingCount", 0);
        JSONArray tasks = snapshot.optJSONArray("tasks");
        if (tasks != null) {
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

            // Calculate priority score (Time + Impact + Effort)
            int score = 0;

            // 1. Time factor
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
                score += 10000; // NOW Active block!
              } else if (startMinutes > currentMinutes) {
                // Upcoming sooner gets higher score
                score += 2000 - Math.min(1000, (startMinutes - currentMinutes));
              } else {
                // Past due earlier today
                score += 800;
              }
            } else {
              // Floating task without scheduled time
              score += 500;
            }

            // 2. Impact factor
            if ("high".equals(item.impact)) {
              score += 300;
            } else if ("medium".equals(item.impact)) {
              score += 150;
            } else {
              score += 50;
            }

            // 3. Effort factor (quick wins get bonus)
            score += Math.max(0, 100 - Math.min(100, item.durationMinutes));

            item.priorityScore = score;
            allTasks.add(item);
          }
        }
      }
    } catch (Exception ignored) {}

    // Sort: uncompleted first by priorityScore descending, then completed
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

    // Date in Header
    String headerDate = new SimpleDateFormat("EEEE, MMM d", Locale.getDefault()).format(new Date());
    views.setTextViewText(R.id.widget_header_date, headerDate);

    // Count badge
    int actualPending = 0;
    for (TaskItem t : allTasks) {
      if (!t.completed) actualPending++;
    }
    String badgeText;
    if (allTasks.isEmpty()) {
      badgeText = "0 tasks";
    } else if (actualPending == 0) {
      badgeText = "All done ✓";
    } else if (actualPending == 1) {
      badgeText = "1 left";
    } else {
      badgeText = actualPending + " left";
    }
    views.setTextViewText(R.id.widget_count_badge, badgeText);

    // Quick Add Button Intent
    Intent addIntent = new Intent(context, MainActivity.class);
    addIntent.setAction(ACTION_QUICK_ADD);
    addIntent.putExtra("widget_action", "quick_add");
    addIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent addPI = PendingIntent.getActivity(context, 99, addIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    views.setOnClickPendingIntent(R.id.widget_btn_add, addPI);

    // Root Click Intent (open app)
    Intent rootIntent = new Intent(context, MainActivity.class);
    rootIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent rootPI = PendingIntent.getActivity(context, 10, rootIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    views.setOnClickPendingIntent(R.id.widget_root, rootPI);

    // Rows and Empty View
    int[] rowIds = { R.id.widget_row_1, R.id.widget_row_2, R.id.widget_row_3, R.id.widget_row_4 };
    int[] checkIds = { R.id.widget_check_1, R.id.widget_check_2, R.id.widget_check_3, R.id.widget_check_4 };
    int[] contentIds = { R.id.widget_content_1, R.id.widget_content_2, R.id.widget_content_3, R.id.widget_content_4 };
    int[] titleIds = { R.id.widget_title_1, R.id.widget_title_2, R.id.widget_title_3, R.id.widget_title_4 };
    int[] metaIds = { R.id.widget_meta_1, R.id.widget_meta_2, R.id.widget_meta_3, R.id.widget_meta_4 };

    if (allTasks.isEmpty()) {
      views.setViewVisibility(R.id.widget_empty_view, View.VISIBLE);
      views.setOnClickPendingIntent(R.id.widget_empty_view, addPI);
      for (int i = 0; i < MAX_ROWS; i++) {
        views.setViewVisibility(rowIds[i], View.GONE);
      }
    } else {
      views.setViewVisibility(R.id.widget_empty_view, View.GONE);

      for (int i = 0; i < MAX_ROWS; i++) {
        if (i < allTasks.size()) {
          TaskItem item = allTasks.get(i);
          views.setViewVisibility(rowIds[i], View.VISIBLE);

          if (item.completed) {
            // Strikethrough for completed task
            SpannableString strikethrough = new SpannableString(item.title);
            strikethrough.setSpan(new StrikethroughSpan(), 0, strikethrough.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            views.setTextViewText(titleIds[i], strikethrough);
            views.setTextColor(titleIds[i], Color.parseColor("#64748B"));

            views.setInt(checkIds[i], "setBackgroundResource", R.drawable.widget_checkbox_checked);
            views.setTextViewText(checkIds[i], "✓");
            views.setTextColor(checkIds[i], Color.parseColor("#FFFFFF"));

            views.setInt(rowIds[i], "setBackgroundResource", R.drawable.widget_item_bg);
            views.setTextViewText(metaIds[i], "Done • Struck through");
            views.setTextColor(metaIds[i], Color.parseColor("#475569"));
          } else {
            // Pending task
            views.setTextViewText(titleIds[i], item.title);
            views.setInt(checkIds[i], "setBackgroundResource", R.drawable.widget_checkbox_bg);
            views.setTextViewText(checkIds[i], "");

            if (i == 0) {
              // Top priority NOW task highlight
              views.setInt(rowIds[i], "setBackgroundResource", R.drawable.widget_now_bg);
              views.setTextColor(titleIds[i], Color.parseColor("#FFFFFF"));
            } else {
              views.setInt(rowIds[i], "setBackgroundResource", R.drawable.widget_item_bg);
              views.setTextColor(titleIds[i], Color.parseColor("#F1F5F9"));
            }

            // Build rich metadata: [Area] • [Time] • [Duration] • [Steps]
            StringBuilder meta = new StringBuilder();
            if (i == 0) {
              meta.append("NOW");
            }
            if (!item.area.isEmpty()) {
              if (meta.length() > 0) meta.append(" • ");
              meta.append(item.area);
            }
            if (!item.startTime.isEmpty()) {
              if (meta.length() > 0) meta.append(" • ");
              meta.append(item.startTime);
            }
            if (item.durationMinutes > 0) {
              if (meta.length() > 0) meta.append(" • ");
              meta.append(item.durationMinutes).append("m");
            }
            if (item.subtasksCount > 0) {
              if (meta.length() > 0) meta.append(" • ");
              meta.append("[").append(item.subtasksDone).append("/").append(item.subtasksCount).append(" steps]");
            }

            views.setTextViewText(metaIds[i], meta.toString());
            views.setTextColor(metaIds[i], i == 0 ? Color.parseColor("#93C5FD") : Color.parseColor("#94A3B8"));
          }

          // Checkbox click intent (toggles task and haptic feedback)
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

          // Content click intent (opens app to task)
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
          // Hide unused row
          views.setViewVisibility(rowIds[i], View.GONE);
        }
      }
    }

    manager.updateAppWidget(appWidgetId, views);
  }
}
