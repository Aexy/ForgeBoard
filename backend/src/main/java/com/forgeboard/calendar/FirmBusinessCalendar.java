package com.forgeboard.calendar;

import java.time.LocalDate;
import java.util.UUID;
import org.springframework.stereotype.Service;
import com.forgeboard.calendar.application.FirmBusinessDayCalculator;

/** Public calendar-module contract for firm-aware business-day rules. */
@Service
public class FirmBusinessCalendar {
    private final FirmBusinessDayCalculator calculator;
    public FirmBusinessCalendar(FirmBusinessDayCalculator calculator) { this.calculator = calculator; }
    public LocalDate precedingBusinessDay(UUID firmId, LocalDate candidate) { return calculator.precedingBusinessDay(firmId, candidate); }
    public LocalDate firstBusinessDayOnOrAfter(UUID firmId, LocalDate candidate) { return calculator.firstBusinessDayOnOrAfter(firmId, candidate); }
}
