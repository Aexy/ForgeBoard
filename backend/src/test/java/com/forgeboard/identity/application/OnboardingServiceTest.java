package com.forgeboard.identity.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.forgeboard.identity.domain.Firm;
import com.forgeboard.identity.domain.FirmMembership;
import com.forgeboard.identity.domain.ForgeBoardUser;
import com.forgeboard.identity.domain.MembershipRole;
import com.forgeboard.identity.persistence.FirmMembershipRepository;
import com.forgeboard.identity.persistence.FirmRepository;
import com.forgeboard.identity.persistence.UserRepository;

@ExtendWith(MockitoExtension.class)
class OnboardingServiceTest {
    @Mock FirmRepository firms;
    @Mock UserRepository users;
    @Mock FirmMembershipRepository memberships;
    @Mock PasswordEncoder passwordEncoder;
    @Mock ActivityAuditService audit;
    OnboardingService onboarding;

    @BeforeEach
    void setUp() {
        onboarding = new OnboardingService(firms, users, memberships, passwordEncoder,
                Clock.fixed(Instant.parse("2026-07-12T20:00:00Z"), ZoneOffset.UTC), audit);
    }

    @Test
    void createsAnOwnerMembershipWithNormalizedIdentity() {
        when(passwordEncoder.encode("correct horse battery")).thenReturn("encoded-password");
        OnboardingResult result = onboarding.createFirm(new OnboardingRequest(
                " Hearth Accounting ", "Hearth Accounting!", " Owner@Example.COM ", " Alex Owner ",
                "correct horse battery"));

        ArgumentCaptor<Firm> firm = ArgumentCaptor.forClass(Firm.class);
        ArgumentCaptor<ForgeBoardUser> user = ArgumentCaptor.forClass(ForgeBoardUser.class);
        ArgumentCaptor<FirmMembership> membership = ArgumentCaptor.forClass(FirmMembership.class);
        verify(firms).save(firm.capture());
        verify(users).save(user.capture());
        verify(memberships).save(membership.capture());
        assertThat(firm.getValue().slug()).isEqualTo("hearth-accounting");
        assertThat(user.getValue().email()).isEqualTo("owner@example.com");
        assertThat(user.getValue().passwordHash()).isEqualTo("encoded-password");
        assertThat(membership.getValue().role()).isEqualTo(MembershipRole.OWNER);
        assertThat(result.firmId()).isEqualTo(firm.getValue().id());
        verify(audit).recordUserAction(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void rejectsAnExistingEmailBeforeWriting() {
        when(users.existsByEmail("owner@example.com")).thenReturn(true);
        assertThatThrownBy(() -> onboarding.createFirm(new OnboardingRequest(
                "Firm", "valid-firm", "owner@example.com", "Owner", "correct horse battery")))
                .isInstanceOf(DuplicateIdentityException.class)
                .hasMessage("Email is already registered");
    }

    @Test
    void rejectsAnEmptyNormalizedSlug() {
        assertThatThrownBy(() -> OnboardingService.normalizeSlug("---"))
                .isInstanceOf(InvalidIdentityException.class);
    }
}
