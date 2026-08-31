package com.forgeboard.calendar.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import com.forgeboard.calendar.persistence.FirmCalendarClosureRepository;

@ExtendWith(MockitoExtension.class)
class FirmBusinessDayCalculatorTest {
    @Mock FirmCalendarClosureRepository closures;
    private final UUID firmId = UUID.randomUUID();

    @Test
    void shiftsBackAcrossWeekendAndAustrianHoliday() {
        FirmBusinessDayCalculator calculator = new FirmBusinessDayCalculator(new AustrianHolidayCalculator(), closures);
        when(closures.existsByFirmIdAndClosureDate(firmId, LocalDate.of(2026, 4, 3))).thenReturn(false);
        assertThat(calculator.precedingBusinessDay(firmId, LocalDate.of(2026, 4, 6)))
                .isEqualTo(LocalDate.of(2026, 4, 3));
    }

    @Test
    void recognizesEditableFirmClosureAndFindsNextBusinessDay() {
        FirmBusinessDayCalculator calculator = new FirmBusinessDayCalculator(new AustrianHolidayCalculator(), closures);
        when(closures.existsByFirmIdAndClosureDate(firmId, LocalDate.of(2026, 8, 3))).thenReturn(true);
        when(closures.existsByFirmIdAndClosureDate(firmId, LocalDate.of(2026, 8, 4))).thenReturn(false);
        assertThat(calculator.firstBusinessDayOnOrAfter(firmId, LocalDate.of(2026, 8, 1)))
                .isEqualTo(LocalDate.of(2026, 8, 4));
    }
}
