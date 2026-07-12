package com.forgeboard.identity.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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

        List<ActivityView> history = new ActivityQueryService(events).recent(tenant, "work-item", itemId);
        assertThat(history).extracting(ActivityView::action).containsExactly("work-item.moved");
        verify(events).findTop100ByFirmIdAndTargetTypeAndTargetIdOrderByOccurredAtDesc(
                firmId, "work-item", itemId);
    }
}
