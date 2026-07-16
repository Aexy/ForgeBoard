package com.forgeboard.identity;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import com.forgeboard.identity.application.TenantAuthorizationService;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.persistence.FirmMembershipRepository;

@ExtendWith(MockitoExtension.class)
class MembershipAccessTest {
    @Mock TenantAuthorizationService authorization;
    @Mock FirmMembershipRepository memberships;

    @Test
    void permitsOnlyOwnersAndAdministratorsToManageSharedWorkflowViews() {
        MembershipAccess access = new MembershipAccess(authorization, memberships);

        assertThatCode(() -> access.requireWorkflowViewManagement(tenant(MembershipRole.OWNER))).doesNotThrowAnyException();
        assertThatCode(() -> access.requireWorkflowViewManagement(tenant(MembershipRole.ADMINISTRATOR))).doesNotThrowAnyException();
        assertThatThrownBy(() -> access.requireWorkflowViewManagement(tenant(MembershipRole.MANAGER)))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> access.requireWorkflowViewManagement(tenant(MembershipRole.MEMBER)))
                .isInstanceOf(AccessDeniedException.class);
    }

    private SelectedTenant tenant(MembershipRole role) {
        return new SelectedTenant(UUID.randomUUID(), UUID.randomUUID(), "user@example.com", role);
    }
}
