package com.forgeboard.identity.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doNothing;
import static org.mockito.ArgumentMatchers.any;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.domain.ActivityActorType;
import com.forgeboard.identity.domain.ActivityEvent;
import com.forgeboard.identity.domain.ActivitySource;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.persistence.ActivityEventRepository;

@ExtendWith(MockitoExtension.class)
class ActivityQueryServiceTest {
    @Mock ActivityEventRepository events;
    @Mock TenantAuthorizationService authorization;

    @Test
    void readsHistoryOnlyFromTheSelectedFirm() {
        UUID firmId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        SelectedTenant tenant = new SelectedTenant(firmId, userId, "owner@example.com", MembershipRole.OWNER);
        ActivityEvent event = new ActivityEvent(UUID.randomUUID(), firmId, userId, ActivityActorType.USER,
                ActivitySource.REST, "work-item.moved", "work-item", itemId, Map.of(), Instant.now());
        when(events.findTop100ByFirmIdAndTargetTypeAndTargetIdOrderByOccurredAtDesc(
                firmId, "work-item", itemId)).thenReturn(List.of(event));

        List<ActivityView> history = new ActivityQueryService(events, authorization).recent(tenant, "work-item", itemId);
        assertThat(history).extracting(ActivityView::action).containsExactly("work-item.moved");
        verify(events).findTop100ByFirmIdAndTargetTypeAndTargetIdOrderByOccurredAtDesc(
                firmId, "work-item", itemId);
    }

    @Test
    void returnsAnOwnerOnlyFilteredAuditPage() {
        UUID firmId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Instant time = Instant.parse("2026-07-16T10:00:00Z");
        SelectedTenant owner = new SelectedTenant(firmId, userId, "owner@example.com", MembershipRole.OWNER);
        ActivityEvent event = new ActivityEvent(UUID.randomUUID(), firmId, userId, ActivityActorType.USER,
                ActivitySource.WEB, "work-item.moved", "work-item", UUID.randomUUID(), Map.of(), time);
        doNothing().when(authorization).requireAuditTrailAccess(owner);
        when(events.findFirstAuditTrailPage(org.mockito.ArgumentMatchers.eq(firmId), org.mockito.ArgumentMatchers.eq("work-item.moved"),
                org.mockito.ArgumentMatchers.eq(ActivityActorType.USER), org.mockito.ArgumentMatchers.isNull(),
                org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.isNull(),
                any(Pageable.class)))
                .thenReturn(List.of(event));

        AuditTrailPage page = new ActivityQueryService(events, authorization).auditTrail(owner,
                new AuditTrailFilter("work-item.moved", ActivityActorType.USER, null, null, null), null, 50);

        assertThat(page.items()).extracting(ActivityView::action).containsExactly("work-item.moved");
        assertThat(page.nextCursor()).isNull();
    }

    @Test
    void usesTheCursorQueryOnlyForLaterAuditPages() {
        UUID firmId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Instant time = Instant.parse("2026-07-16T10:00:00Z");
        UUID eventId = UUID.randomUUID();
        SelectedTenant owner = new SelectedTenant(firmId, userId, "owner@example.com", MembershipRole.OWNER);
        doNothing().when(authorization).requireAuditTrailAccess(owner);
        when(events.findAuditTrailPageAfterCursor(org.mockito.ArgumentMatchers.eq(firmId),
                org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.isNull(),
                org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.isNull(),
                org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.eq(time),
                org.mockito.ArgumentMatchers.eq(eventId), any(Pageable.class))).thenReturn(List.of());

        new ActivityQueryService(events, authorization).auditTrail(owner,
                new AuditTrailFilter(null, null, null, null, null),
                new AuditTrailCursor(time, eventId).encode(), 50);

        verify(events).findAuditTrailPageAfterCursor(org.mockito.ArgumentMatchers.eq(firmId),
                org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.isNull(),
                org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.isNull(),
                org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.eq(time),
                org.mockito.ArgumentMatchers.eq(eventId), any(Pageable.class));
    }

    @Test
    void refusesAuditTrailForMembers() {
        SelectedTenant member = new SelectedTenant(UUID.randomUUID(), UUID.randomUUID(), "member@example.com", MembershipRole.MEMBER);
        org.mockito.Mockito.doThrow(new AccessDeniedException("denied")).when(authorization).requireAuditTrailAccess(member);
        assertThatThrownBy(() -> new ActivityQueryService(events, authorization).auditTrail(member,
                new AuditTrailFilter(null, null, null, null, null), null, 50)).isInstanceOf(AccessDeniedException.class);
    }
}
