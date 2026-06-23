package dk.jonathanb.books.widget

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.LinearProgressIndicator
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.color.ColorProvider
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
// `defaultWeight()` is a scoped extension on RowScope / ColumnScope — it resolves
// inside Row { } / Column { } content lambdas and has no importable top-level symbol.
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle

// Warm & cozy palette with day/night pairs, mirrored from the app's theme
// (constants/theme.ts Colors.light / Colors.dark).
private val BG = ColorProvider(day = Color(0xFFF4EEE2), night = Color(0xFF1A1611))
private val ELEMENT = ColorProvider(day = Color(0xFFEDE5D5), night = Color(0xFF241F18))
// A step darker than ELEMENT so unfilled dots / tracks read against the warm card.
private val MUTED = ColorProvider(day = Color(0xFFD8C8AE), night = Color(0xFF3A3024))
private val INK = ColorProvider(day = Color(0xFF2E2A24), night = Color(0xFFF2EADD))
private val SECONDARY = ColorProvider(day = Color(0xFF7C6F5E), night = Color(0xFFB0A492))
private val ACCENT = ColorProvider(day = Color(0xFFC0694A), night = Color(0xFFD98A63))
private val ON_ACCENT = ColorProvider(day = Color(0xFFFBF6EE), night = Color(0xFF1A1611))
private val FROST = ColorProvider(day = Color(0xFF5E81A4), night = Color(0xFF8FB0D4))
// Translucent dark so the cover's progress track reads over any cover art.
private val SCRIM = ColorProvider(day = Color(0x66000000), night = Color(0x66000000))

class BooksWidget : GlanceAppWidget() {

  // One widget, four buckets. The system snaps LocalSize.current to the closest
  // declared size, so each layout's content is sized to actually fill that cell
  // (a short layout stretched into a tall cell is what leaves dead whitespace).
  private val small = DpSize(120.dp, 120.dp) // ~2x2
  private val medium = DpSize(250.dp, 120.dp) // ~4x2, short & wide
  private val tall = DpSize(250.dp, 190.dp) // ~4x3
  private val large = DpSize(250.dp, 270.dp) // ~4x4

  override val sizeMode = SizeMode.Responsive(setOf(small, medium, tall, large))

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    // Keep the snapshot honest across midnight (persists if the day rolled over),
    // then render from the fresh state.
    WidgetPrefs.reconcileToToday(context)
    val snapshot = WidgetPrefs.readSnapshot(context)
    val cover: Bitmap? = snapshot?.book?.coverPath?.let {
      try {
        // Downsample: app-widget bitmaps travel through RemoteViews, which has a
        // hard transaction-size cap. Half dimensions = 1/4 the memory.
        val opts = BitmapFactory.Options().apply { inSampleSize = 2 }
        BitmapFactory.decodeFile(it, opts)
      } catch (_: Exception) {
        null
      }
    }
    provideContent {
      val size = LocalSize.current
      when {
        size.height >= large.height -> LargeLayout(context, snapshot, cover)
        size.height >= tall.height -> TallLayout(context, snapshot, cover)
        size.width >= medium.width -> MediumLayout(context, snapshot, cover)
        else -> SmallLayout(context, snapshot, cover)
      }
    }
  }

  // --- layouts ---------------------------------------------------------------
  //
  // The cover is the hero: on every size but the tiny 2x2 it fills the full card
  // height, so it's as large as the cell allows and there's no dead whitespace.
  // The streak, dots, and action sit in a column beside it. The whole card wears a
  // soft accent ring while today is unread, going calm once it's marked.

  /** Small ~2x2: cover above a single full-width action. Most minimal. */
  @Composable
  private fun SmallLayout(context: Context, snapshot: WidgetSnapshot?, cover: Bitmap?) {
    Frame(context, snapshot, 10.dp) {
      Column(
        modifier = GlanceModifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Cover(context, snapshot?.book, cover, GlanceModifier.width(48.dp).height(72.dp), 22.sp)
        Spacer(GlanceModifier.height(8.dp))
        MarkButton(snapshot?.readToday ?: false, GlanceModifier.fillMaxWidth())
      }
    }
  }

  /** Medium ~4x2: full-height cover beside the streak, dots, and action. */
  @Composable
  private fun MediumLayout(context: Context, snapshot: WidgetSnapshot?, cover: Bitmap?) =
    SideLayout(context, snapshot, cover, pad = 12.dp, coverW = 58.dp, headlineSp = 17.sp, dot = 10.dp, gap = 5.dp, badges = false)

  /** Tall ~4x3: a big full-height cover with the streak, badge, dots, and action. */
  @Composable
  private fun TallLayout(context: Context, snapshot: WidgetSnapshot?, cover: Bitmap?) =
    SideLayout(context, snapshot, cover, pad = 14.dp, coverW = 112.dp, headlineSp = 22.sp, dot = 12.dp, gap = 6.dp, badges = true)

  /** Shared cover-left / details-right layout. Cover fills the card height. */
  @Composable
  private fun SideLayout(
    context: Context,
    snapshot: WidgetSnapshot?,
    cover: Bitmap?,
    pad: Dp,
    coverW: Dp,
    headlineSp: TextUnit,
    dot: Dp,
    gap: Dp,
    badges: Boolean,
  ) {
    Frame(context, snapshot, pad) {
      Row(modifier = GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
        Cover(context, snapshot?.book, cover, GlanceModifier.width(coverW).fillMaxHeight(), coverW.value.times(0.4f).sp)
        Spacer(GlanceModifier.width(16.dp))
        Column(modifier = GlanceModifier.defaultWeight()) {
          Headline(snapshot, headlineSp)
          if (badges) Badge(snapshot)
          Spacer(GlanceModifier.height(10.dp))
          DotsRow(snapshot, dot = dot, gap = gap)
          Spacer(GlanceModifier.height(12.dp))
          MarkButton(snapshot?.readToday ?: false, GlanceModifier.fillMaxWidth())
        }
      }
    }
  }

  /** Large ~4x4: a big full-height cover, with title, badge, dots, yearly goal. */
  @Composable
  private fun LargeLayout(context: Context, snapshot: WidgetSnapshot?, cover: Bitmap?) {
    val book = snapshot?.book
    Frame(context, snapshot, 16.dp) {
      Row(modifier = GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
        Cover(context, book, cover, GlanceModifier.width(132.dp).fillMaxHeight(), 52.sp)
        Spacer(GlanceModifier.width(16.dp))
        Column(modifier = GlanceModifier.defaultWeight()) {
          Headline(snapshot, 24.sp)
          if (book != null) {
            Spacer(GlanceModifier.height(6.dp))
            Text(
              text = book.title,
              maxLines = 2,
              style = TextStyle(color = SECONDARY, fontSize = 13.sp, fontWeight = FontWeight.Medium),
            )
          }
          Badge(snapshot)
          Spacer(GlanceModifier.height(12.dp))
          DotsRow(snapshot, dot = 12.dp, gap = 6.dp)
          YearlyLine(snapshot)
          Spacer(GlanceModifier.height(14.dp))
          MarkButton(snapshot?.readToday ?: false, GlanceModifier.fillMaxWidth())
        }
      }
    }
  }

  // --- shared pieces ---------------------------------------------------------

  /**
   * The cozy card surface. Tapping a neutral region opens the Today screen. While
   * today is unread, a soft accent ring frames the card (an outer accent Box with
   * a hair of padding) to gently nudge; once read it sits flush and calm.
   */
  @Composable
  private fun Frame(context: Context, snapshot: WidgetSnapshot?, pad: Dp, content: @Composable () -> Unit) {
    val unread = snapshot?.readToday != true
    Box(
      modifier = GlanceModifier
        .fillMaxSize()
        .cornerRadius(26.dp)
        .background(if (unread) ACCENT else BG)
        .padding(if (unread) 2.5.dp else 0.dp)
        .clickable(open(context, "books://")),
    ) {
      Box(modifier = GlanceModifier.fillMaxSize().cornerRadius(24.dp).background(BG).padding(pad)) {
        content()
      }
    }
  }

  /**
   * The book cover. [sizeMod] sets its footprint (often width + fillMaxHeight); a
   * thin warm progress fill rides along the bottom for currently-reading books.
   * Taps to the book, or the shelf when empty. [phSp] sizes the empty placeholder.
   */
  @Composable
  private fun Cover(context: Context, book: WidgetBook?, cover: Bitmap?, sizeMod: GlanceModifier, phSp: TextUnit) {
    val dest = if (book != null) "books://book/${book.id}" else "books://shelf"
    val box = sizeMod.cornerRadius(12.dp).clickable(open(context, dest))
    val showProgress = book != null && book.percent > 0
    Box(
      modifier = box.background(ELEMENT),
      contentAlignment = if (cover != null) Alignment.BottomCenter else Alignment.Center,
    ) {
      if (cover != null) {
        Image(
          provider = ImageProvider(cover),
          contentDescription = book?.title,
          contentScale = ContentScale.Crop,
          modifier = GlanceModifier.fillMaxSize().cornerRadius(12.dp),
        )
        if (showProgress) {
          LinearProgressIndicator(
            progress = book!!.percent.coerceIn(0, 100) / 100f,
            modifier = GlanceModifier.fillMaxWidth().height(6.dp),
            color = ACCENT,
            backgroundColor = SCRIM,
          )
        }
      } else {
        Text(
          text = book?.title?.take(1)?.uppercase() ?: "📖",
          style = TextStyle(color = SECONDARY, fontSize = phSp),
        )
      }
    }
  }

  /** The streak as the headline: "8 weeks 🔥", "❄️ Frozen", or a gentle default. */
  @Composable
  private fun Headline(snapshot: WidgetSnapshot?, fontSize: TextUnit) {
    val frozen = snapshot?.isFrozen == true
    val streak = snapshot?.weekStreak ?: 0
    val text = when {
      frozen -> "❄️ Frozen"
      streak > 0 -> "$streak ${if (streak == 1) "week" else "weeks"} 🔥"
      else -> "This week"
    }
    Text(
      text = text,
      maxLines = 1,
      style = TextStyle(color = if (frozen) FROST else INK, fontSize = fontSize, fontWeight = FontWeight.Bold),
    )
  }

  /** A small celebratory line when the week's hit or the streak ties the record. */
  @Composable
  private fun Badge(snapshot: WidgetSnapshot?) {
    val text = when {
      snapshot?.isWeekComplete == true -> "Week complete 🎉"
      snapshot?.isBestStreak == true -> "🏆 Personal best"
      else -> return
    }
    Spacer(GlanceModifier.height(4.dp))
    Text(
      text = text,
      maxLines = 1,
      style = TextStyle(color = ACCENT, fontSize = 12.sp, fontWeight = FontWeight.Bold),
    )
  }

  /** Yearly book-count goal progress (large size, only when a goal is set). */
  @Composable
  private fun YearlyLine(snapshot: WidgetSnapshot?) {
    val goal = snapshot?.yearlyGoal ?: -1
    if (goal <= 0) return
    val done = snapshot?.booksFinishedThisYear ?: 0
    Spacer(GlanceModifier.height(10.dp))
    Text(
      text = "📚 $done / $goal this year",
      maxLines = 1,
      style = TextStyle(color = SECONDARY, fontSize = 12.sp, fontWeight = FontWeight.Medium),
    )
    Spacer(GlanceModifier.height(6.dp))
    LinearProgressIndicator(
      progress = (done.toFloat() / goal).coerceIn(0f, 1f),
      modifier = GlanceModifier.fillMaxWidth().height(4.dp).cornerRadius(2.dp),
      color = ACCENT,
      backgroundColor = MUTED,
    )
  }

  @Composable
  private fun DotsRow(snapshot: WidgetSnapshot?, dot: Dp, gap: Dp) {
    val dots = snapshot?.weekDots ?: List(7) { false }
    Row(verticalAlignment = Alignment.CenterVertically) {
      for (i in 0 until 7) {
        val filled = dots.getOrElse(i) { false }
        Box(
          modifier = GlanceModifier
            .size(dot)
            .cornerRadius(dot / 2f)
            .background(if (filled) ACCENT else MUTED),
        ) {}
        if (i < 6) Spacer(GlanceModifier.width(gap))
      }
    }
  }

  /** Full-width primary action. Filled accent when unread, quiet when done. */
  @Composable
  private fun MarkButton(readToday: Boolean, modifier: GlanceModifier) {
    val base = modifier.cornerRadius(16.dp).padding(vertical = 11.dp, horizontal = 12.dp)
    if (readToday) {
      Box(modifier = base.background(ELEMENT), contentAlignment = Alignment.Center) {
        Text(
          text = "Read today ✓",
          maxLines = 1,
          style = TextStyle(color = SECONDARY, fontSize = 14.sp, fontWeight = FontWeight.Bold),
        )
      }
    } else {
      Box(
        modifier = base.background(ACCENT).clickable(actionRunCallback<MarkReadAction>()),
        contentAlignment = Alignment.Center,
      ) {
        Text(
          text = "I read today",
          maxLines = 1,
          style = TextStyle(color = ON_ACCENT, fontSize = 14.sp, fontWeight = FontWeight.Bold),
        )
      }
    }
  }

  private fun open(context: Context, uri: String) = actionStartActivity(
    Intent(Intent.ACTION_VIEW, Uri.parse(uri)).apply {
      `package` = context.packageName
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
  )
}
