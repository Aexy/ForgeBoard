package com.forgeboard.calendar.persistence;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.forgeboard.calendar.domain.FirmCalendarClosure;

public interface FirmCalendarClosureRepository extends JpaRepository<FirmCalendarClosure, UUID> {
    List<FirmCalendarClosure> findAllByFirmIdAndClosureDateBetweenOrderByClosureDateAsc(UUID firmId, LocalDate from, LocalDate to);
    List<FirmCalendarClosure> findAllByFirmIdAndClosureDateIn(UUID firmId, Collection<LocalDate> dates);
    Optional<FirmCalendarClosure> findByIdAndFirmId(UUID id, UUID firmId);
    boolean existsByFirmIdAndClosureDate(UUID firmId, LocalDate closureDate);
}
