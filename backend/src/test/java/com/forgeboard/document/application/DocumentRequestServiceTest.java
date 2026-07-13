package com.forgeboard.document.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.forgeboard.client.ClientDirectory;
import com.forgeboard.document.domain.DocumentRequest;
import com.forgeboard.document.persistence.DocumentRequestRepository;
import com.forgeboard.identity.ActivityRecorder;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.domain.MembershipRole;

@ExtendWith(MockitoExtension.class)
class DocumentRequestServiceTest {
    @Mock DocumentRequestRepository requests;
    @Mock ClientDirectory clients;
    @Mock ActivityRecorder activity;

    DocumentRequestService service;
    SelectedTenant tenant;
    Instant now;

    @BeforeEach
    void setUp() {
        now = Instant.parse("2026-07-13T09:00:00Z");
        tenant = new SelectedTenant(UUID.randomUUID(), UUID.randomUUID(), "owner@example.com", MembershipRole.OWNER);
        service = new DocumentRequestService(requests, clients, activity, Clock.fixed(now, ZoneOffset.UTC));
    }

    @Test
    void createsAndReceivesTenantScopedDocumentRequest() {
        UUID clientId = UUID.randomUUID();
        when(clients.exists(tenant.firmId(), clientId)).thenReturn(true);
        when(requests.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        DocumentRequestView created = service.create(tenant,
                new DocumentRequestInput(clientId, "Bank statements", null, LocalDate.of(2026, 7, 20)));
        DocumentRequest stored = new DocumentRequest(created.id(), tenant.firmId(), clientId,
                "Bank statements", null, LocalDate.of(2026, 7, 20), now);
        when(requests.findByIdAndFirmId(created.id(), tenant.firmId())).thenReturn(Optional.of(stored));

        DocumentRequestView received = service.receive(tenant, created.id());

        assertThat(received.status().name()).isEqualTo("RECEIVED");
        verify(activity, times(2)).recordRestUserAction(any(), any(), any(), any(), any(), any());
    }

    @Test
    void receivingAnAlreadyReceivedRequestDoesNotCreateAnotherAuditEvent() {
        UUID requestId = UUID.randomUUID();
        DocumentRequest stored = new DocumentRequest(requestId, tenant.firmId(), UUID.randomUUID(),
                "Bank statements", null, null, now);
        stored.receive(now);
        when(requests.findByIdAndFirmId(requestId, tenant.firmId())).thenReturn(Optional.of(stored));

        DocumentRequestView received = service.receive(tenant, requestId);

        assertThat(received.status().name()).isEqualTo("RECEIVED");
        verify(activity, times(0)).recordRestUserAction(any(), any(), any(), any(), any(), any());
    }
}
