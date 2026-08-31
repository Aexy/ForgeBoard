package com.forgeboard.calendar.application;

import java.time.LocalDate;
import java.util.List;

public record FirmCalendarView(String timezone, int year, List<Holiday> statutoryHolidays,
        List<FirmCalendarClosureView> closures) {
    public record Holiday(LocalDate date, String label) {}
}
