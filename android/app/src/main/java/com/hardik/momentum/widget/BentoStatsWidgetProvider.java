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
import android.graphics.SweepGradient;
import android.os.Build;
import android.os.Bundle;
import android.util.SizeF;
import android.widget.RemoteViews;
import com.hardik.momentum.MainActivity;
import com.hardik.momentum.R;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

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

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager appWidgetManager, int appWidgetId, Bundle newOptions) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions);
        updateWidget(context, appWidgetManager, appWidgetId);
    }

    private static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(WidgetBridgePlugin.PREFERENCES, Context.MODE_PRIVATE);
        String raw = prefs.getString(WidgetBridgePlugin.SNAPSHOT, null);

        float percent = 84f;
        String velocityLabel = "OPTIMAL";
        String statusSubtext = "STATUS: NOMINAL";
        String tasksMetric = "6 / 8 DONE";

        String todayDate = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());

        if (raw != null && !raw.trim().isEmpty()) {
            try {
                JSONObject snapshot = new JSONObject(raw);
                String snapDate = snapshot.optString("date", "");

                if (snapDate.equals(todayDate)) {
                    percent = (float) snapshot.optDouble("completionPercentage", 84.0);
                    int total = snapshot.optInt("totalCount", 8);
                    int completed = snapshot.optInt("completedCount", 6);
                    int pending = snapshot.optInt("pendingCount", 2);

                    tasksMetric = completed + " / " + total + " DONE";

                    if (total == 0) {
                        percent = 84f;
                        velocityLabel = "OPTIMAL";
                        statusSubtext = "STATUS: NOMINAL";
                    } else if (pending == 0) {
                        velocityLabel = "PEAK";
                        statusSubtext = "100% COMPLETE ✓";
                    } else if (percent >= 75f) {
                        velocityLabel = "OPTIMAL";
                        statusSubtext = "STATUS: NOMINAL";
                    } else {
                        velocityLabel = "ACTIVE";
                        statusSubtext = pending + " REMAINING";
                    }
                }
            } catch (Exception ignored) {
                percent = 84f;
            }
        }

        Bitmap ring = drawProgressRing(context, percent);

        RemoteViews views;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            RemoteViews squareViews = new RemoteViews(context.getPackageName(), R.layout.widget_bento_stats);
            bindViews(context, squareViews, ring, percent, velocityLabel, statusSubtext, tasksMetric);

            RemoteViews wideViews = new RemoteViews(context.getPackageName(), R.layout.widget_bento_wide);
            bindViews(context, wideViews, ring, percent, velocityLabel, statusSubtext, tasksMetric);

            Map<SizeF, RemoteViews> viewMapping = new HashMap<>();
            viewMapping.put(new SizeF(90f, 90f), squareViews);
            viewMapping.put(new SizeF(180f, 70f), wideViews);
            views = new RemoteViews(viewMapping);
        } else {
            Bundle options = appWidgetManager.getAppWidgetOptions(appWidgetId);
            int minWidth = options != null ? options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) : 0;
            int layoutId = (minWidth >= 160) ? R.layout.widget_bento_wide : R.layout.widget_bento_stats;
            views = new RemoteViews(context.getPackageName(), layoutId);
            bindViews(context, views, ring, percent, velocityLabel, statusSubtext, tasksMetric);
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static void bindViews(Context context, RemoteViews views, Bitmap ring, float percent, String velocityLabel, String statusSubtext, String tasksMetric) {
        views.setImageViewBitmap(R.id.bento_ring, ring);
        views.setTextViewText(R.id.bento_stats_percent, Math.round(percent) + "%");
        try {
            views.setTextViewText(R.id.bento_velocity_label, velocityLabel);
        } catch (Exception ignored) {}
        views.setTextViewText(R.id.bento_subtext, statusSubtext);

        try {
            views.setTextViewText(R.id.bento_tasks_metric, tasksMetric);
        } catch (Exception ignored) {}

        // Click opens app
        Intent intent = new Intent(context, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_bento_container, pendingIntent);
    }

    private static Bitmap drawProgressRing(Context context, float percent) {
        float density = context.getResources().getDisplayMetrics().density;
        int size = (int) (120 * density);
        float strokeWidth = 8.5f * density;

        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);

        float pad = strokeWidth / 2f + (2 * density);
        RectF rect = new RectF(pad, pad, size - pad, size - pad);

        // Track (dark navy/slate ring)
        Paint trackPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        trackPaint.setStyle(Paint.Style.STROKE);
        trackPaint.setStrokeWidth(strokeWidth);
        trackPaint.setColor(0xFF1E2536);
        trackPaint.setStrokeCap(Paint.Cap.ROUND);
        canvas.drawArc(rect, 0, 360, false, trackPaint);

        // Progress arc (vibrant mint-to-cyan gradient arc)
        if (percent > 0) {
            Paint progressPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            progressPaint.setStyle(Paint.Style.STROKE);
            progressPaint.setStrokeWidth(strokeWidth);
            progressPaint.setColor(0xFF00F2FE);
            progressPaint.setStrokeCap(Paint.Cap.ROUND);
            float sweep = Math.min(360f, (percent / 100f) * 360f);
            canvas.drawArc(rect, -90, sweep, false, progressPaint);
        }

        return bitmap;
    }
}
