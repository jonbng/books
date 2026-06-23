package dk.jonathanb.books.widget

import org.junit.Assert.assertEquals
import org.junit.Test

/** Pure date math — runs on the plain JVM (java.util.Calendar). */
class WidgetDatesTest {
  @Test
  fun weekdayIndexIsMondayZero() {
    // 2026-06-22 is a Monday, 06-24 Wednesday, 06-28 Sunday.
    assertEquals(0, WidgetDates.weekdayIndex("2026-06-22"))
    assertEquals(2, WidgetDates.weekdayIndex("2026-06-24"))
    assertEquals(6, WidgetDates.weekdayIndex("2026-06-28"))
  }

  @Test
  fun mondayIsoSnapsToWeekStart() {
    assertEquals("2026-06-22", WidgetDates.mondayIso("2026-06-22")) // Monday
    assertEquals("2026-06-22", WidgetDates.mondayIso("2026-06-24")) // Wednesday
    assertEquals("2026-06-22", WidgetDates.mondayIso("2026-06-28")) // Sunday
    assertEquals("2026-06-29", WidgetDates.mondayIso("2026-06-29")) // next Monday
  }

  @Test
  fun mondayIsoCrossesMonthBoundary() {
    // 2026-07-01 is a Wednesday; its Monday is in June.
    assertEquals("2026-06-29", WidgetDates.mondayIso("2026-07-01"))
  }
}
