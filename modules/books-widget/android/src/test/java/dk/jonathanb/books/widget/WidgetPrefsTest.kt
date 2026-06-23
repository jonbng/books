package dk.jonathanb.books.widget

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** The optimistic-mark + day-rollover reconcile logic, against a real Context. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class WidgetPrefsTest {
  private val context: Context get() = ApplicationProvider.getApplicationContext()

  private fun writeSnapshot(json: String) {
    WidgetPrefs.prefs(context).edit().putString(WidgetPrefs.KEY_SNAPSHOT, json).commit()
  }

  private fun freshDaySnapshot(): String =
    """{"today":"${WidgetDates.todayIso()}","readToday":false,
       "weekDots":[false,false,false,false,false,false,false],"daysRead":0,"status":"in-progress"}"""

  @Test
  fun optimisticMarkSetsReadAndQueuesToday() {
    writeSnapshot(freshDaySnapshot())
    WidgetPrefs.applyOptimisticMark(context)

    val s = WidgetPrefs.readSnapshot(context)!!
    assertTrue(s.readToday)

    val pending = JSONArray(WidgetPrefs.takePendingMarks(context))
    assertEquals(1, pending.length())
    assertEquals(WidgetDates.todayIso(), pending.getString(0))
  }

  @Test
  fun markingTwiceQueuesOnce() {
    writeSnapshot(freshDaySnapshot())
    WidgetPrefs.applyOptimisticMark(context)
    WidgetPrefs.applyOptimisticMark(context) // already read → no-op

    val pending = JSONArray(WidgetPrefs.takePendingMarks(context))
    assertEquals(1, pending.length())
  }

  @Test
  fun reconcileClearsStaleReadStateAndAdvancesDay() {
    writeSnapshot(
      """{"today":"2000-01-01","readToday":true,
         "weekDots":[true,true,true,true,true,true,true],"daysRead":7,"status":"complete"}"""
    )
    WidgetPrefs.reconcileToToday(context)

    val s = WidgetPrefs.readSnapshot(context)!!
    assertFalse(s.readToday)
    assertEquals(WidgetDates.todayIso(), s.today)
    assertEquals(0, s.weekDots.count { it }) // new week → dots reset
  }

  @Test
  fun takePendingMarksClearsTheQueue() {
    writeSnapshot(freshDaySnapshot())
    WidgetPrefs.applyOptimisticMark(context)
    WidgetPrefs.takePendingMarks(context) // drain
    assertEquals(0, JSONArray(WidgetPrefs.takePendingMarks(context)).length())
  }
}
