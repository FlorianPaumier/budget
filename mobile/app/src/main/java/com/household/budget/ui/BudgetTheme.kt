package com.household.budget.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.remember
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.font.Font
import com.household.budget.R
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.platform.LocalView
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.ui.Modifier
import androidx.core.view.WindowCompat
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

enum class ThemePreference(val label: String) { SYSTEM("Automatique"), LIGHT("Clair"), DARK("Sombre") }
object BudgetTokens {
    val Space = 16.dp
    val Page = 20.dp
    val CardRadius = 24.dp
    const val Motion = 220
    val CategoryColors = listOf(Color(0xFF397C70), Color(0xFFB56B35), Color(0xFF547BB0), Color(0xFF976C9C), Color(0xFFB28B25), Color(0xFF788580))
}
private val Light = lightColorScheme(
    primary = Color(0xFF185D50), onPrimary = Color.White,
    primaryContainer = Color(0xFFDCEDE5), onPrimaryContainer = Color(0xFF153E34),
    secondary = Color(0xFF805331), secondaryContainer = Color(0xFFFFE7D5),
    background = Color(0xFFF5F6F2), onBackground = Color(0xFF1C302A),
    surface = Color(0xFFFFFFFF), onSurface = Color(0xFF1C302A),
    surfaceVariant = Color(0xFFE9EEE8), onSurfaceVariant = Color(0xFF53635C),
    surfaceContainer = Color(0xFFEDF1EB),
    surfaceContainerLowest = Color.White, surfaceContainerLow = Color(0xFFF9FBF7),
    surfaceContainerHigh = Color(0xFFE6EEE7), surfaceContainerHighest = Color(0xFFDDE7DE),
    tertiary = Color(0xFF46627F), onTertiary = Color.White, tertiaryContainer = Color(0xFFDFE9F3), onTertiaryContainer = Color(0xFF20354D),
    outline = Color(0xFF718279), outlineVariant = Color(0xFFDCE3DD),
    error = Color(0xFFAE392E), errorContainer = Color(0xFFFFE4DE))
private val Dark = darkColorScheme(
    primary = Color(0xFFA0D8BB), onPrimary = Color(0xFF123C2F),
    primaryContainer = Color(0xFF234D3D), onPrimaryContainer = Color(0xFFD9F2E3),
    secondary = Color(0xFFEABB97), secondaryContainer = Color(0xFF493425),
    background = Color(0xFF101B17), onBackground = Color(0xFFE4EDE5),
    surface = Color(0xFF192821), onSurface = Color(0xFFE4EDE5),
    surfaceVariant = Color(0xFF2C3C33), onSurfaceVariant = Color(0xFFB8C7BC),
    surfaceContainer = Color(0xFF1E3027),
    surfaceContainerLowest = Color(0xFF0D1612), surfaceContainerLow = Color(0xFF16241D),
    surfaceContainerHigh = Color(0xFF273D31), surfaceContainerHighest = Color(0xFF304D3B),
    tertiary = Color(0xFFB6CFE5), onTertiary = Color(0xFF20354D), tertiaryContainer = Color(0xFF2C4359), onTertiaryContainer = Color(0xFFDCEAF5),
    outline = Color(0xFF8F9E94), outlineVariant = Color(0xFF35493E),
    error = Color(0xFFFFB4A5), errorContainer = Color(0xFF58261E))

@Composable
fun BudgetTheme(preference: ThemePreference = ThemePreference.SYSTEM, content: @Composable () -> Unit) {
    val dark = when (preference) { ThemePreference.SYSTEM -> isSystemInDarkTheme(); ThemePreference.DARK -> true; ThemePreference.LIGHT -> false }
    val context = LocalContext.current
    val configuration = LocalConfiguration.current
    val frenchConfiguration = remember(configuration) { android.content.res.Configuration(configuration).apply { setLocale(java.util.Locale.CANADA_FRENCH) } }
    val frenchContext = remember(context, frenchConfiguration) { context.createConfigurationContext(frenchConfiguration) }
    val family = FontFamily(Font(R.font.manrope))
    val view = LocalView.current
    if (!view.isInEditMode) SideEffect {
        var context = view.context
        while (context is android.content.ContextWrapper && context !is android.app.Activity) context = context.baseContext
        (context as? android.app.Activity)?.let { activity ->
            val controller = WindowCompat.getInsetsController(activity.window, view)
            controller.isAppearanceLightStatusBars = !dark
            controller.isAppearanceLightNavigationBars = !dark
        }
    }
    CompositionLocalProvider(LocalContext provides frenchContext, LocalConfiguration provides frenchConfiguration) {
    MaterialTheme(colorScheme = if (dark) Dark else Light,
        shapes = Shapes(small = RoundedCornerShape(12.dp), medium = RoundedCornerShape(18.dp), large = RoundedCornerShape(BudgetTokens.CardRadius)),
        typography = Typography(
            headlineLarge = TextStyle(fontFamily = family, fontWeight = FontWeight.SemiBold, fontSize = 34.sp, lineHeight = 42.sp, letterSpacing = (-1).sp),
            headlineMedium = TextStyle(fontFamily = family, fontWeight = FontWeight.SemiBold, fontSize = 28.sp, lineHeight = 36.sp),
            titleLarge = TextStyle(fontFamily = family, fontWeight = FontWeight.SemiBold, fontSize = 22.sp, lineHeight = 28.sp),
            titleMedium = TextStyle(fontFamily = family, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 24.sp),
            titleSmall = TextStyle(fontFamily = family, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 20.sp),
            bodyMedium = TextStyle(fontFamily = family, fontSize = 14.sp, lineHeight = 22.sp),
            bodySmall = TextStyle(fontFamily = family, fontSize = 12.sp, lineHeight = 18.sp),
            labelLarge = TextStyle(fontFamily = family, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 20.sp),
            labelMedium = TextStyle(fontFamily = family, fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 16.sp),
            labelSmall = TextStyle(fontFamily = family, fontWeight = FontWeight.Medium, fontSize = 11.sp, lineHeight = 16.sp),
            bodyLarge = TextStyle(fontFamily = family, fontSize = 16.sp, lineHeight = 24.sp)), content = { Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) { Box(Modifier.fillMaxSize().safeDrawingPadding()) { content() } } })
    }
}
