package com.forgeboard.calendar.application;

import static org.assertj.core.api.Assertions.assertThat;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class AustrianHolidayCalculatorTest {
    private final AustrianHolidayCalculator calculator = new AustrianHolidayCalculator();

    @Test
    void calculatesAllThirteenAustrianStatutoryHolidaysIncludingMovableDates() {
        var holidays = calculator.holidays(2026);
        assertThat(holidays).hasSize(13);
        assertThat(holidays).containsEntry(LocalDate.of(2026, 4, 6), "Ostermontag")
                .containsEntry(LocalDate.of(2026, 5, 14), "Christi Himmelfahrt")
                .containsEntry(LocalDate.of(2026, 5, 25), "Pfingstmontag")
                .containsEntry(LocalDate.of(2026, 6, 4), "Fronleichnam")
                .containsEntry(LocalDate.of(2026, 12, 26), "Stephanstag");
    }
}
