package com.forgeboard.calendar.application;

import java.time.LocalDate;
import java.util.UUID;

public record FirmCalendarClosureView(UUID id, LocalDate closureDate, String label) {}
