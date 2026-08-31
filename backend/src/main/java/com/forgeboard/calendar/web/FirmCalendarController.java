package com.forgeboard.calendar.web;

import java.net.URI;
import java.time.Year;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.forgeboard.calendar.application.FirmCalendarClosureRequest;
import com.forgeboard.calendar.application.FirmCalendarClosureView;
import com.forgeboard.calendar.application.FirmCalendarService;
import com.forgeboard.calendar.application.FirmCalendarView;
import com.forgeboard.identity.SelectedTenant;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/firm-calendar")
public class FirmCalendarController {
    private final FirmCalendarService calendar;
    public FirmCalendarController(FirmCalendarService calendar) { this.calendar = calendar; }
    @GetMapping
    FirmCalendarView get(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @RequestParam(required = false) Integer year) {
        return calendar.calendar(tenant, year == null ? Year.now().getValue() : year);
    }
    @PostMapping("/closures")
    ResponseEntity<FirmCalendarClosureView> addClosure(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @Valid @RequestBody FirmCalendarClosureRequest request) {
        FirmCalendarClosureView created = calendar.addClosure(tenant, request);
        return ResponseEntity.created(URI.create("/api/firm-calendar/closures/" + created.id())).body(created);
    }
    @DeleteMapping("/closures/{closureId}")
    ResponseEntity<Void> removeClosure(@RequestAttribute(SelectedTenant.REQUEST_ATTRIBUTE) SelectedTenant tenant,
            @PathVariable UUID closureId) {
        calendar.removeClosure(tenant, closureId);
        return ResponseEntity.noContent().build();
    }
}
