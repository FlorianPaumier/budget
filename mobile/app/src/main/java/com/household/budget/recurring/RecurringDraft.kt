package com.household.budget.recurring

import org.json.JSONObject
import java.time.LocalDate

data class RecurringDraft(
    val name: String, val kind: String = "bill", val amountCad: String,
    val frequency: String = "monthly", val interval: Int = 1,
    val startsOn: String, val endsOn: String? = null,
    val categoryId: String? = null, val days: List<Int>? = null, val active: Boolean = true,
)
fun recurringDraftToJson(draft: RecurringDraft): JSONObject = JSONObject().apply {
    require(validateRecurringDraft(draft).isEmpty()) { "Invalid recurring rule" }
    put("name", draft.name.trim())
    put("kind", draft.kind)
    put("amountCents", com.household.budget.ui.parseCadCents(draft.amountCad))
    put("frequency", draft.frequency)
    put("interval", draft.interval)
    put("startsOn", draft.startsOn)
    put("endsOn", draft.endsOn ?: JSONObject.NULL)
    put("categoryId", draft.categoryId ?: JSONObject.NULL)
    put("scheduleDetails", draft.days?.let { JSONObject().put("days", org.json.JSONArray(it)) } ?: JSONObject.NULL)
    put("active", draft.active)
}
fun validRecurringDate(raw: String): Boolean =
    Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(raw) && runCatching { LocalDate.parse(raw) }.isSuccess

fun validateRecurringDraft(draft: RecurringDraft): Map<String, String> {
    val errors = mutableMapOf<String, String>()
    if (draft.name.trim().length !in 1..160) errors["name"] = "Saisissez un nom de 1 à 160 caractères."
    if (draft.kind !in listOf("income", "bill", "subscription")) errors["kind"] = "Choisissez revenu, facture ou abonnement."
    val cents = com.household.budget.ui.parseCadCents(draft.amountCad)
    if (cents == null || cents !in 1..9007199254740991L) errors["amountCad"] = "Saisissez un montant positif en dollars canadiens."
    if (draft.frequency !in listOf("daily", "weekly", "biweekly", "twice_monthly", "monthly", "yearly")) errors["frequency"] = "Choisissez une fréquence."
    if (draft.interval !in 1..1000) errors["interval"] = "Choisissez un intervalle entre 1 et 1000."
    val start = draft.startsOn.takeIf(::validRecurringDate)?.let(LocalDate::parse)
    if (start == null) errors["startsOn"] = "Saisissez une date de début valide (AAAA-MM-JJ)."
    if (draft.endsOn != null) {
        val end = draft.endsOn.takeIf(::validRecurringDate)?.let(LocalDate::parse)
        if (end == null || (start != null && end < start)) errors["endsOn"] = "La date de fin doit suivre la date de début."
    }
    if (draft.frequency == "twice_monthly" && (draft.days?.size != 2 || draft.days.any { it !in 1..31 })) {
        errors["days"] = "Choisissez deux jours du mois entre 1 et 31."
    }
    if (draft.categoryId != null && runCatching { java.util.UUID.fromString(draft.categoryId) }.isFailure) errors["categoryId"] = "Cette catégorie n’est pas valide."
    return errors
}
fun previewRecurringDates(draft: RecurringDraft, from: LocalDate, through: LocalDate): List<LocalDate> {
    val start = LocalDate.parse(draft.startsOn)
    val end = draft.endsOn?.let(LocalDate::parse)?.coerceAtMost(through) ?: through
    require(from <= through && draft.interval in 1..1000)
    val result = mutableSetOf<LocalDate>()
    fun add(date: LocalDate) { if (date >= start && date >= from && date <= end) result.add(date) }
    if (draft.frequency == "twice_monthly") {
        val days = requireNotNull(draft.days)
        require(days.size == 2 && days.all { it in 1..31 })
        var month = java.time.YearMonth.from(start)
        while (month.atDay(1) <= end) {
            days.forEach { add(month.atDay(it.coerceAtMost(month.lengthOfMonth()))) }
            month = month.plusMonths(1)
        }
    } else {
        var index = 0L
        while (true) {
            val step = index * draft.interval
            val date = when (draft.frequency) {
                "daily" -> start.plusDays(step)
                "weekly" -> start.plusWeeks(step)
                "biweekly" -> start.plusWeeks(step * 2)
                "monthly" -> start.plusMonths(step)
                "yearly" -> start.plusYears(step)
                else -> throw IllegalArgumentException("Invalid frequency")
            }
            if (date > end) break
            add(date)
            index++
        }
    }
    return result.sorted()
}
