package dk.jonathanb.books.widget

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.appwidget.action.ActionCallback

/**
 * Background tap handler for the widget's "I read today" button. Writes an
 * optimistic snapshot update + queues the dated mark in SharedPreferences, then
 * re-renders the widget — all without launching the app. The real `reading_days`
 * row is written when the app next runs and drains the pending queue.
 */
class MarkReadAction : ActionCallback {
  override suspend fun onAction(
    context: Context,
    glanceId: GlanceId,
    parameters: ActionParameters,
  ) {
    WidgetPrefs.applyOptimisticMark(context)
    BooksWidget().update(context, glanceId)
  }
}
