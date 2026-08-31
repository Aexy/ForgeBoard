package com.forgeboard.calendar.application;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Stateless Austrian statutory-holiday calendar, including Easter-relative dates. */
@Component
public class AustrianHolidayCalculator {
    public Map<LocalDate, String> holidays(int year) {
        LocalDate easterSunday = easterSunday(year);
        Map<LocalDate, String> result = new LinkedHashMap<>();
        result.put(LocalDate.of(year, 1, 1), "Neujahr");
        result.put(LocalDate.of(year, 1, 6), "Heilige Drei Könige");
        result.put(easterSunday.plusDays(1), "Ostermontag");
        result.put(LocalDate.of(year, 5, 1), "Staatsfeiertag");
        result.put(easterSunday.plusDays(39), "Christi Himmelfahrt");
        result.put(easterSunday.plusDays(50), "Pfingstmontag");
        result.put(easterSunday.plusDays(60), "Fronleichnam");
        result.put(LocalDate.of(year, 8, 15), "Mariä Himmelfahrt");
        result.put(LocalDate.of(year, 10, 26), "Nationalfeiertag");
        result.put(LocalDate.of(year, 11, 1), "Allerheiligen");
        result.put(LocalDate.of(year, 12, 8), "Mariä Empfängnis");
        result.put(LocalDate.of(year, 12, 25), "Weihnachten");
        result.put(LocalDate.of(year, 12, 26), "Stephanstag");
        return Map.copyOf(result);
    }

    // Meeus/Jones/Butcher Gregorian computus.
    private LocalDate easterSunday(int year) {
        int a = year % 19, b = year / 100, c = year % 100, d = b / 4, e = b % 4;
        int f = (b + 8) / 25, g = (b - f + 1) / 3, h = (19 * a + b - d - g + 15) % 30;
        int i = c / 4, k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
        int m = (a + 11 * h + 22 * l) / 451;
        int month = (h + l - 7 * m + 114) / 31;
        int day = (h + l - 7 * m + 114) % 31 + 1;
        return LocalDate.of(year, month, day);
    }
}
