package com.forgeboard.identity;

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

import com.forgeboard.identity.domain.FirmMembership;
import com.forgeboard.identity.domain.ForgeBoardUser;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.application.EmployeeView;
import com.forgeboard.identity.persistence.FirmMembershipRepository;
import com.forgeboard.identity.persistence.FirmMembershipRepository.FirmStaffRow;
import com.forgeboard.identity.persistence.UserRepository;

@ExtendWith(MockitoExtension.class)
class EmployeeDirectoryTest {
    @Mock FirmMembershipRepository memberships;
    @Mock UserRepository users;

    @Test
    void returnsDisplayNamesOnlyForUsersWhoBelongToTheSelectedFirm() {
        UUID firmId = UUID.randomUUID();
        UUID memberId = UUID.randomUUID();
        UUID otherFirmUserId = UUID.randomUUID();
        Instant now = Instant.parse("2026-07-16T00:00:00Z");
        when(memberships.findAllByFirmIdAndUserIdIn(firmId, List.of(memberId, otherFirmUserId))).thenReturn(List.of(
                new FirmMembership(UUID.randomUUID(), firmId, memberId, MembershipRole.MEMBER, now)));
        when(users.findAllById(List.of(memberId))).thenReturn(List.of(
                new ForgeBoardUser(memberId, "mira@example.com", "Mira Miller", "hash", now)));

        Map<UUID, String> displayNames = new EmployeeDirectory(memberships, users)
                .displayNames(firmId, List.of(memberId, otherFirmUserId));

        assertThat(displayNames).containsExactly(Map.entry(memberId, "Mira Miller"));
        verify(memberships).findAllByFirmIdAndUserIdIn(firmId, List.of(memberId, otherFirmUserId));
        verify(users).findAllById(List.of(memberId));
    }

    @Test
    void listsEnabledFirmStaffInMembershipCreationOrder() {
        UUID firmId = UUID.randomUUID();
        EmployeeView first = new EmployeeView(UUID.randomUUID(), UUID.randomUUID(), "Mira Miller", "mira@example.com", MembershipRole.MEMBER);
        EmployeeView second = new EmployeeView(UUID.randomUUID(), UUID.randomUUID(), "Omar Owner", "omar@example.com", MembershipRole.OWNER);
        when(memberships.findStaffByFirmIdOrderByCreatedAtAsc(firmId)).thenReturn(List.of(
                new FirmStaffRow(first.membershipId(), first.userId(), first.displayName(), first.email(), first.role()),
                new FirmStaffRow(second.membershipId(), second.userId(), second.displayName(), second.email(), second.role())));

        assertThat(new EmployeeDirectory(memberships, users).list(firmId)).containsExactly(first, second);
    }

}
