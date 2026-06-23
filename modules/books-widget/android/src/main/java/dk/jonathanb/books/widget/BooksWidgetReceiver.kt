package dk.jonathanb.books.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import java.util.Calendar

/**
 * The broadcast receiver Android instantiates for the widget (see AndroidManifest).
 *
 * Beyond hosting the Glance widget, it keeps a battery-friendly daily alarm that
 * re-renders the widget at local midnight, so a "Read ✓" state flips to a fresh
 * day even when the app process never runs. The alarm is inexact
 * (`setAndAllowWhileIdle`) so it needs no exact-alarm permission, and re-arms
 * itself on each fire to track timezone/DST changes.
 */
class BooksWidgetReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = BooksWidget()

  override fun onEnabled(context: Context) {
    super.onEnabled(context)
    scheduleNextMidnight(context)
  }

  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray,
  ) {
    super.onUpdate(context, appWidgetManager, appWidgetIds)
    scheduleNextMidnight(context)
  }

  override fun onDisabled(context: Context) {
    super.onDisabled(context)
    cancelAlarm(context)
  }

  companion object {
    private fun alarmIntent(context: Context): PendingIntent {
      val ids = AppWidgetManager.getInstance(context)
        .getAppWidgetIds(ComponentName(context, BooksWidgetReceiver::class.java))
      val intent = Intent(context, BooksWidgetReceiver::class.java).apply {
        action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
        putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
      }
      return PendingIntent.getBroadcast(
        context,
        0,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }

    fun scheduleNextMidnight(context: Context) {
      val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val next = Calendar.getInstance().apply {
        add(Calendar.DAY_OF_YEAR, 1)
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }.timeInMillis
      // Inexact + allow-while-idle: no SCHEDULE_EXACT_ALARM permission; a refresh
      // within the post-midnight maintenance window is plenty for a habit widget.
      am.setAndAllowWhileIdle(AlarmManager.RTC, next, alarmIntent(context))
    }

    fun cancelAlarm(context: Context) {
      val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      am.cancel(alarmIntent(context))
    }
  }
}
