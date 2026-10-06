package com.hardik.momentum.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.widget.RemoteViews;
import com.hardik.momentum.MainActivity;
import com.hardik.momentum.R;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class BentoStatsWidgetProvider extends AppWidgetProvider {

    public static void refresh(Context context) {
        if (context == null) return;
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName component = new ComponentName(context, BentoStatsWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(component);
        for (int id : ids) {
            updateWidget(context, manager, id);
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    private static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_bento_stats);

        // Read snapshot
        SharedPreferences prefs = context.getSharedPreferences(WidgetBridgePlugin.PREFERENCES, Context.MODE_PRIVATE);
        String raw = prefs.getString(WidgetBridgePlugin.SNAPSHOT, null);

        float percent = 0f;
        String statusSubtext = "STATUS: NO TASKS";

        // Check if date has crossed midnight (resets to 0% if new day)
        String todayDate = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());

        if (raw != null && !raw.trim().isEmpty()) {
            try {
                JSONObject snapshot = new JSONObject(raw);
                String snapDate = snapshot.optString("date", "");

                // Reset to 0% at 12:00 AM / new day if snapshot is from previous day
                if (snapDate.equals(todayDate)) {
                    percent = (float) snapshot.optDouble("completionPercentage", 0.0);
                    int total = snapshot.optInt("totalCount", 0);
                    int completed = snapshot.optInt("completedCount", 0);
                    int pending = snapshot.optInt("pendingCount", 0);

                    if (total == 0) {
                        statusSubtext = "STATUS: ZERO TASKS";
                    } else if (pending == 0) {
                        statusSubtext = "STATUS: 100% COMPLETE ✓";
                    } else {
                        statusSubtext = completed + "/" + total + " DONE (" + pending + " LEFT)";
                    }
                } else {
                    // New day! Automatic 12:00 AM reset
                    percent = 0f;
                    statusSubtext = "STATUS: NEW DAY RESET";
                }
            } catch (Exception ignored) {
                percent = 0f;
            }
        } else {
            percent = 0f;
        }

        // Render circular progress ring with true %
        Bitmap ring = drawProgressRing(context, percent);
        views.setImageViewBitmap(R.id.bento_ring, ring);
        views.setTextViewText(R.id.bento_stats_percent, Math.round(percent) + "%");
        views.setTextViewText(R.id.bento_subtext, statusSubtext);

        // Click opens app
        Intent intent = new Intent(context, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_bento_container, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static Bitmap drawProgressRing(Context context, float percent) {
        float density = context.getResources().getDisplayMetrics().density;
        int size = (int) (120 * density);
        float strokeWidth = 6 * density;

        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);

        float pad = strokeWidth / 2f;
        RectF rect = new RectF(pad, pad, size - pad, size - pad);

        // Track (dark gray ring)
        Paint trackPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        trackPaint.setStyle(Paint.Style.STROKE);
        trackPaint.setStrokeWidth(strokeWidth);
        trackPaint.setColor(0xFF222222);
        trackPaint.setStrokeCap(Paint.Cap.ROUND);
        canvas.drawArc(rect, 0, 360, false, trackPaint);

        // Progress arc (pure white when > 0, emerald when 100%)
        if (percent > 0) {
            Paint progressPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            progressPaint.setStyle(Paint.Style.STROKE);
            progressPaint.setStrokeWidth(strokeWidth);
            progressPaint.setColor(percent >= 100f ? 0xFF10B981 : 0xFFFFFFFF);
            progressPaint.setStrokeCap(Paint.Cap.ROUND);
            float sweep = Math.min(360f, (percent / 100f) * 360f);
            canvas.drawArc(rect, -90, sweep, false, progressPaint);
        }

        return bitmap;
    }
}
