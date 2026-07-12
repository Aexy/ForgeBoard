package com.forgeboard.identity.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;

import com.forgeboard.identity.application.SessionIdentity;
import com.forgeboard.identity.application.SessionLoginRequest;

@ExtendWith(MockitoExtension.class)
class SessionAuthenticationServiceTest {
    @Mock AuthenticationManager authenticationManager;

    @Test
    void storesAValidatedAuthenticationInTheHttpSession() {
        Authentication authenticated = UsernamePasswordAuthenticationToken.authenticated(
                "owner@example.com", null, java.util.List.of());
        when(authenticationManager.authenticate(any())).thenReturn(authenticated);
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        SessionIdentity identity = new SessionAuthenticationService(authenticationManager).login(
                new SessionLoginRequest("owner@example.com", "correct horse battery"), request, response);

        assertThat(identity.email()).isEqualTo("owner@example.com");
        assertThat(request.getSession(false)).isNotNull();
        assertThat(request.getSession().getAttribute(
                HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY)).isNotNull();
    }
}

