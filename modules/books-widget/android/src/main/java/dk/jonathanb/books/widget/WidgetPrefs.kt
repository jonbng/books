package dk.jonathanb.books.widget

import android.content.Context
import android.content.SharedPreferences
import java.util.Calendar
import org.json.JSONArray
import org.json.JSONObject

/**
 * Shared storage between the React Native app (which writes the snapshot from JS
 * via [BooksWidgetModule]) and the Glance widget (which reads it). Both sides run
 * in the app process and key the prefs file off `context.packageName`, so the name
 * always matches regardless of the resolved applicationId.
 */
object WidgetPrefs {
  const val KEY_SNAPSHOT = "snapshot"
  const val KEY_PENDING_MARKS = "pendingMarks"

  fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(context.packageName + ".widget", Context.MODE_PRIVATE)

  fun readSnapshot(context: Context): WidgetSnapshot? {
    val json = prefs(context).getString(KEY_SNAPSHOT, null) ?: return null
    return WidgetSnapshot.parse(json)
  }

  /**
   * Keep the snapshot honest across midnight without the app running. If the
   * stored snapshot is from an earlier day, clear today's read state (and, on a
   * new week, the whole dot row) so the widget never shows a stale "Read ✓".
   * Persisted so a subsequent [applyOptimisticMark] builds on the fresh state.
   * Called at the top of every render and before every mark.
   */
  fun reconcileToToday(context: Context) {
    val p = prefs(context)
    val raw = p.getString(KEY_SNAPSHOT, null) ?: return
    val obj = try {
      JSONObject(raw)
    } catch (_: Exception) {
      return
    }
    val today = WidgetDates.todayIso()
    val snapDay = obj.optString("today", "")
    if (snapDay == today) return

    obj.put("readToday", false)
    if (snapDay.isEmpty() || WidgetDates.mondayIso(snapDay) != WidgetDates.mondayIso(today)) {
      // New week (or unknown): reset the week frame. Streak stays — the forgiving
      // model never breaks mid-week, and the app re-syncs the real value on launch.
      obj.put("weekDots", JSONArray(List(7) { false }))
      obj.put("daysRead", 0)
      obj.put("status", "in-progress")
    }
    obj.put("today", today)
    p.edit().putString(KEY_SNAPSHOT, obj.toString()).commit()
  }

  /**
   * Optimistically record a "read today" tap from the widget: flip the snapshot's
   * read state, fill today's dot, and queue the dated mark for the app to write to
   * the database on next launch. Uses the device's real current date (not the
   * possibly-stale snapshot date). No-op if already read today.
   */
  fun applyOptimisticMark(context: Context) {
    reconcileToToday(context)
    val p = prefs(context)
    val raw = p.getString(KEY_SNAPSHOT, null) ?: return
    val obj = try {
      JSONObject(raw)
    } catch (_: Exception) {
      return
    }
    if (obj.optBoolean("readToday", false)) return

    val today = WidgetDates.todayIso()
    obj.put("readToday", true)

    val idx = WidgetDates.weekdayIndex(today)
    val dots = obj.optJSONArray("weekDots") ?: JSONArray(List(7) { false })
    if (idx in 0 until dots.length() && !dots.optBoolean(idx, false)) {
      dots.put(idx, true)
      obj.put("daysRead", obj.optInt("daysRead", 0) + 1)
    }
    obj.put("weekDots", dots)

    val pending = try {
      JSONArray(p.getString(KEY_PENDING_MARKS, "[]"))
    } catch (_: Exception) {
      JSONArray()
    }
    pending.put(today)

    p.edit()
      .putString(KEY_SNAPSHOT, obj.toString())
      .putString(KEY_PENDING_MARKS, pending.toString())
      .commit()
  }

  /** Read and clear the queue of widget-tapped dates. */
  fun takePendingMarks(context: Context): String {
    val p = prefs(context)
    val queue = p.getString(KEY_PENDING_MARKS, "[]") ?: "[]"
    p.edit().remove(KEY_PENDING_MARKS).commit()
    return queue
  }
}

/** Local-timezone date helpers, matching the app's ISO `YYYY-MM-DD`, Monday-first week. */
object WidgetDates {
  fun todayIso(): String = isoOf(Calendar.getInstance())

  /** Monday (week start) of the week containing [iso], as ISO. */
  fun mondayIso(iso: String): String {
    val cal = calendarOf(iso) ?: return iso
    cal.add(Calendar.DAY_OF_YEAR, -weekdayIndex(iso))
    return isoOf(cal)
  }

  /** Weekday index with Monday = 0 .. Sunday = 6 for an ISO date. -1 if unparseable. */
  fun weekdayIndex(iso: String): Int {
    val cal = calendarOf(iso) ?: return -1
    // Calendar.DAY_OF_WEEK: Sunday = 1 .. Saturday = 7. Rotate so Monday = 0.
    return (cal.get(Calendar.DAY_OF_WEEK) + 5) % 7
  }

  private fun isoOf(cal: Calendar): String {
    val y = cal.get(Calendar.YEAR)
    val m = cal.get(Calendar.MONTH) + 1
    val d = cal.get(Calendar.DAY_OF_MONTH)
    return "%04d-%02d-%02d".format(y, m, d)
  }

  private fun calendarOf(iso: String): Calendar? {
    return try {
      val (y, m, d) = iso.split("-").map { it.toInt() }
      Calendar.getInstance().apply {
        clear()
        set(y, m - 1, d)
      }
    } catch (_: Exception) {
      null
    }
  }
}

data class WidgetBook(
  val id: Int,
  val title: String,
  val percent: Int,
  val coverPath: String?,
)

data class WidgetSnapshot(
  val today: String,
  val readToday: Boolean,
  val weekStreak: Int,
  val weeklyTarget: Int,
  val daysRead: Int,
  val status: String,
  val weekDots: List<Boolean>,
  val availableFreezes: Int,
  val longestStreak: Int,
  /** Yearly book-count goal, or -1 if unset. */
  val yearlyGoal: Int,
  val booksFinishedThisYear: Int,
  val book: WidgetBook?,
) {
  val isFrozen: Boolean get() = status == "frozen"
  val isWeekComplete: Boolean get() = status == "complete"

  /** A run that ties the all-time best (and is worth celebrating). */
  val isBestStreak: Boolean get() = weekStreak >= 2 && weekStreak >= longestStreak

  companion object {
    fun parse(json: String): WidgetSnapshot? {
      return try {
        val o = JSONObject(json)
        val dotsArr = o.optJSONArray("weekDots")
        val dots = ArrayList<Boolean>(7)
        if (dotsArr != null) {
          for (i in 0 until dotsArr.length()) dots.add(dotsArr.optBoolean(i, false))
        }
        val bookObj = o.optJSONObject("book")
        val book = if (bookObj != null) {
          WidgetBook(
            id = bookObj.optInt("id", -1),
            title = bookObj.optString("title", ""),
            percent = bookObj.optInt("percent", 0),
            coverPath = bookObj.optString("coverPath", "").ifEmpty { null },
          )
        } else null
        WidgetSnapshot(
          today = o.optString("today", ""),
          readToday = o.optBoolean("readToday", false),
          weekStreak = o.optInt("weekStreak", 0),
          weeklyTarget = o.optInt("weeklyTarget", 5),
          daysRead = o.optInt("daysRead", 0),
          status = o.optString("status", "in-progress"),
          weekDots = dots,
          availableFreezes = o.optInt("availableFreezes", 0),
          longestStreak = o.optInt("longestStreak", 0),
          yearlyGoal = o.optInt("yearlyGoal", -1),
          booksFinishedThisYear = o.optInt("booksFinishedThisYear", 0),
          book = book,
        )
      } catch (_: Exception) {
        null
      }
    }
  }
}
