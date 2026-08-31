package com.forgeboard.calendar.application;

import java.time.LocalDate;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record FirmCalendarClosureRequest(@NotNull LocalDate closureDate, @NotBlank @Size(max = 160) String label) {}
