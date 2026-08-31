package com.forgeboard.calendar.application;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.forgeboard.calendar.domain.FirmCalendarClosure;
import com.forgeboard.calendar.persistence.FirmCalendarClosureRepository;
import com.forgeboard.identity.ActivityRecorder;
import com.forgeboard.identity.FirmDirectory;
import com.forgeboard.identity.SelectedTenant;

@Service
public class FirmCalendarService {
    private static final String DEFAULT_TIMEZONE = "Europe/Vienna";
    private final FirmDirectory firms;
    private final FirmCalendarClosureRepository closures;
    private final AustrianHolidayCalculator holidays;
    private final ActivityRecorder activity;
    private final Clock clock;

    public FirmCalendarService(FirmDirectory firms, FirmCalendarClosureRepository closures,
            AustrianHolidayCalculator holidays, ActivityRecorder activity, Clock clock) {
        this.firms = firms; this.closures = closures; this.holidays = holidays; this.activity = activity; this.clock = clock;
    }

    @Transactional(readOnly = true)
    public FirmCalendarView calendar(SelectedTenant tenant, int year) {
        requireFirm(tenant.firmId());
        LocalDate from = LocalDate.of(year, 1, 1), to = LocalDate.of(year, 12, 31);
        List<FirmCalendarView.Holiday> statutory = holidays.holidays(year).entrySet().stream()
                .map(entry -> new FirmCalendarView.Holiday(entry.getKey(), entry.getValue())).toList();
        List<FirmCalendarClosureView> firmClosures = closures.findAllByFirmIdAndClosureDateBetweenOrderByClosureDateAsc(tenant.firmId(), from, to)
                .stream().map(this::view).toList();
        return new FirmCalendarView(DEFAULT_TIMEZONE, year, statutory, firmClosures);
    }

    @Transactional
    public FirmCalendarClosureView addClosure(SelectedTenant tenant, FirmCalendarClosureRequest request) {
        requireCalendarManagement(tenant);
        requireFirm(tenant.firmId());
        if (closures.existsByFirmIdAndClosureDate(tenant.firmId(), request.closureDate()))
            throw new IllegalStateException("A firm closure already exists for this date");
        FirmCalendarClosure created = closures.save(new FirmCalendarClosure(UUID.randomUUID(), tenant.firmId(),
                request.closureDate(), request.label().strip(), tenant.userId(), clock.instant()));
        activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "firm-calendar.closure-added", "firm-calendar-closure",
                created.id(), java.util.Map.of("date", created.closureDate().toString()));
        return view(created);
    }

    @Transactional
    public void removeClosure(SelectedTenant tenant, UUID closureId) {
        requireCalendarManagement(tenant);
        FirmCalendarClosure closure = closures.findByIdAndFirmId(closureId, tenant.firmId())
                .orElseThrow(() -> new FirmCalendarNotFoundException("Firm closure was not found in the selected firm"));
        closures.delete(closure);
        activity.recordRestUserAction(tenant.firmId(), tenant.userId(), "firm-calendar.closure-removed", "firm-calendar-closure",
                closure.id(), java.util.Map.of("date", closure.closureDate().toString()));
    }

    private void requireFirm(UUID firmId) {
        if (!firms.exists(firmId)) throw new FirmCalendarNotFoundException("Firm was not found");
    }
    private void requireCalendarManagement(SelectedTenant tenant) {
        if (!tenant.canManageFirmCalendar())
            throw new AccessDeniedException("Only owners, administrators, and managers can manage the firm calendar");
    }
    private FirmCalendarClosureView view(FirmCalendarClosure closure) {
        return new FirmCalendarClosureView(closure.id(), closure.closureDate(), closure.label());
    }
}
