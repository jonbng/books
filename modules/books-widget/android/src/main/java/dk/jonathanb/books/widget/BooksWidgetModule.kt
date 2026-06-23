package dk.jonathanb.books.widget

import kotlinx.coroutines.runBlocking
import androidx.glance.appwidget.updateAll
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * JS-callable bridge for the Android home-screen widget. Writes the snapshot the
 * Glance widget renders from, triggers re-renders, and hands back the queue of
 * marks tapped on the widget so the app can reconcile them into SQLite.
 *
 * Android-only; on other platforms `requireOptionalNativeModule('BooksWidget')`
 * returns null and the JS service no-ops.
 */
class BooksWidgetModule : Module() {
  private val context
    get() = requireNotNull(appContext.reactContext) { "React context unavailable" }

  override fun definition() = ModuleDefinition {
    Name("BooksWidget")

    AsyncFunction("writeSnapshot") { json: String ->
      WidgetPrefs.prefs(context).edit().putString(WidgetPrefs.KEY_SNAPSHOT, json).commit()
    }

    AsyncFunction("refreshWidget") {
      // updateAll re-runs provideGlance for every live instance, re-reading prefs.
      runBlocking { BooksWidget().updateAll(context) }
    }

    AsyncFunction("getPendingMarks") {
      WidgetPrefs.takePendingMarks(context)
    }
  }
}
