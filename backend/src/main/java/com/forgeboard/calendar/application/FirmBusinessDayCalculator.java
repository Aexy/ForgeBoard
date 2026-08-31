package com.forgeboard.calendar.application;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import com.forgeboard.calendar.persistence.FirmCalendarClosureRepository;

@Service
public class FirmBusinessDayCalculator {
    private final AustrianHolidayCalculator holidays;
    private final FirmCalendarClosureRepository closures;

    public FirmBusinessDayCalculator(AustrianHolidayCalculator holidays, FirmCalendarClosureRepository closures) {
        this.holidays = holidays; this.closures = closures;
    }

    public LocalDate precedingBusinessDay(UUID firmId, LocalDate candidate) {
        LocalDate date = candidate;
        while (!isBusinessDay(firmId, date)) date = date.minusDays(1);
        return date;
    }

    public LocalDate firstBusinessDayOnOrAfter(UUID firmId, LocalDate candidate) {
        LocalDate date = candidate;
        while (!isBusinessDay(firmId, date)) date = date.plusDays(1);
        return date;
    }

    public boolean isBusinessDay(UUID firmId, LocalDate date) {
        if (date.getDayOfWeek() == DayOfWeek.SATURDAY || date.getDayOfWeek() == DayOfWeek.SUNDAY) return false;
        if (holidays.holidays(date.getYear()).containsKey(date)) return false;
        return !closures.existsByFirmIdAndClosureDate(firmId, date);
    }
}
