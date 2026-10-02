package com.forgeboard.engagement.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import java.time.Clock;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

import com.forgeboard.client.ClientDirectory;
import com.forgeboard.engagement.persistence.EngagementRepository;
import com.forgeboard.engagement.persistence.EngagementReviewDecisionRepository;
import com.forgeboard.engagement.persistence.EngagementTemplateEnrollmentRepository;
import com.forgeboard.engagement.persistence.EngagementTemplateRepository;
import com.forgeboard.engagement.persistence.EngagementTemplateVersionChecklistItemRepository;
import com.forgeboard.engagement.persistence.EngagementTemplateVersionRepository;
import com.forgeboard.identity.ActivityRecorder;
import com.forgeboard.work.WorkflowDirectory;

class EngagementServiceContextTest {

    @Test
    void springCreatesEngagementServiceWithProductionCollaborators() {
        try (var context = new AnnotationConfigApplicationContext()) {
            registerMock(context, EngagementTemplateRepository.class);
            registerMock(context, EngagementTemplateVersionRepository.class);
            registerMock(context, EngagementTemplateVersionChecklistItemRepository.class);
            registerMock(context, EngagementTemplateEnrollmentRepository.class);
            registerMock(context, EngagementRepository.class);
            registerMock(context, EngagementReviewDecisionRepository.class);
            registerMock(context, WorkflowDirectory.class);
            registerMock(context, ClientDirectory.class);
            registerMock(context, ActivityRecorder.class);
            registerMock(context, Clock.class);
            registerMock(context, EngagementMaterializer.class);
            context.register(EngagementService.class);

            context.refresh();

            assertThat(context.getBean(EngagementService.class)).isNotNull();
        }
    }

    private static <T> void registerMock(AnnotationConfigApplicationContext context, Class<T> type) {
        context.registerBean(type, () -> mock(type));
    }
}
