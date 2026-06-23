package dk.jonathanb.books.widget

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** Snapshot parsing + derived badge flags. Robolectric supplies real org.json. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class WidgetSnapshotTest {
  @Test
  fun parsesAFullSnapshot() {
    val json = """
      {"today":"2026-06-22","readToday":true,"weekStreak":3,"weeklyTarget":5,
       "daysRead":2,"status":"in-progress",
       "weekDots":[true,true,false,false,false,false,false],
       "availableFreezes":1,"longestStreak":4,"yearlyGoal":30,"booksFinishedThisYear":12,
       "book":{"id":7,"title":"Atomic Habits","percent":38,"coverPath":"/x.jpg"}}
    """.trimIndent()
    val s = WidgetSnapshot.parse(json)!!
    assertEquals("2026-06-22", s.today)
    assertTrue(s.readToday)
    assertEquals(3, s.weekStreak)
    assertEquals(7, s.weekDots.size)
    assertEquals(2, s.weekDots.count { it })
    assertEquals(1, s.availableFreezes)
    assertEquals(4, s.longestStreak)
    assertEquals(30, s.yearlyGoal)
    assertEquals(12, s.booksFinishedThisYear)
    assertEquals(7, s.book!!.id)
    assertEquals(38, s.book!!.percent)
    assertEquals("/x.jpg", s.book!!.coverPath)
  }

  @Test
  fun nullYearlyGoalBecomesSentinel() {
    val s = WidgetSnapshot.parse("""{"today":"2026-06-22","yearlyGoal":null}""")!!
    assertEquals(-1, s.yearlyGoal)
  }

  @Test
  fun missingBookIsNull() {
    val s = WidgetSnapshot.parse("""{"today":"2026-06-22"}""")!!
    assertNull(s.book)
  }

  @Test
  fun invalidJsonReturnsNull() {
    assertNull(WidgetSnapshot.parse("not json at all"))
  }

  @Test
  fun derivedBadgeFlags() {
    val complete = WidgetSnapshot.parse("""{"status":"complete","weekStreak":3,"longestStreak":3}""")!!
    assertTrue(complete.isWeekComplete)
    assertTrue(complete.isBestStreak)

    val frozen = WidgetSnapshot.parse("""{"status":"frozen"}""")!!
    assertTrue(frozen.isFrozen)

    val early = WidgetSnapshot.parse("""{"status":"in-progress","weekStreak":1,"longestStreak":5}""")!!
    assertFalse(early.isBestStreak) // streak < 2 and below the record
  }
}
