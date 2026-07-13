package com.forgeboard.document.application;
import java.time.LocalDate; import java.util.UUID; import jakarta.validation.constraints.*;
public record DocumentRequestInput(@NotNull UUID clientId, @NotBlank @Size(max=200) String label, @Size(max=1000) String externalReference, LocalDate dueDate) {}
