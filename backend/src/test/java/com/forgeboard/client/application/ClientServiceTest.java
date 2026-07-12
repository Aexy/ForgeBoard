package com.forgeboard.client.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import com.forgeboard.client.domain.ClientAccount;
import com.forgeboard.client.persistence.ClientRepository;
import com.forgeboard.identity.ActivityRecorder;
import com.forgeboard.identity.SelectedTenant;
import com.forgeboard.identity.domain.MembershipRole;

@ExtendWith(MockitoExtension.class)
class ClientServiceTest {
    @Mock ClientRepository clients;
    @Mock ActivityRecorder activity;
    ClientService service;
    UUID firmId;
    UUID userId;

    @BeforeEach
    void setUp() {
        firmId = UUID.randomUUID();
        userId = UUID.randomUUID();
        service = new ClientService(clients, activity,
                Clock.fixed(Instant.parse("2026-07-12T21:00:00Z"), ZoneOffset.UTC));
    }

    @Test
    void createsAClientInsideTheSelectedFirm() {
        SelectedTenant tenant = new SelectedTenant(firmId, userId, "owner@example.com", MembershipRole.OWNER);
        ClientView created = service.create(tenant,
                new ClientRequest(" Northstar Studio GmbH ", " Northstar Studio ", " HELLO@NORTHSTAR.AT "));

        assertThat(created.displayName()).isEqualTo("Northstar Studio");
        assertThat(created.primaryEmail()).isEqualTo("hello@northstar.at");
        verify(clients).save(any(ClientAccount.class));
        verify(activity).recordRestUserAction(any(), any(), any(), any(), any(), any());
    }

    @Test
    void cannotReadAClientFromAnotherFirm() {
        UUID clientId = UUID.randomUUID();
        SelectedTenant tenant = new SelectedTenant(firmId, userId, "owner@example.com", MembershipRole.OWNER);
        when(clients.findByIdAndFirmId(clientId, firmId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(tenant, clientId)).isInstanceOf(ClientNotFoundException.class);
        verify(clients, never()).findById(clientId);
    }

    @Test
    void readOnlyMembersCannotChangeClients() {
        SelectedTenant tenant = new SelectedTenant(firmId, userId, "reader@example.com", MembershipRole.READ_ONLY);
        assertThatThrownBy(() -> service.create(tenant, new ClientRequest("Legal", "Display", null)))
                .isInstanceOf(AccessDeniedException.class);
        verify(clients, never()).save(any());
    }
}
