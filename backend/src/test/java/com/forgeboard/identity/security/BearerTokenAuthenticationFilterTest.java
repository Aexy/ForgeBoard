package com.forgeboard.identity.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;

import jakarta.servlet.FilterChain;

class BearerTokenAuthenticationFilterTest {
    @Test
    void rejectsARevokedBearerToken() throws Exception {
        JwtDecoder decoder = token -> Jwt.withTokenValue(token).header("alg", "HS256").subject("owner@example.com")
                .claim("jti", UUID.randomUUID().toString()).issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();
        ApiTokenService tokens = org.mockito.Mockito.mock(ApiTokenService.class);
        when(tokens.isAccessTokenActive(org.mockito.ArgumentMatchers.any())).thenReturn(false);
        StaticListableBeanFactory beans = new StaticListableBeanFactory();
        beans.addBean("tokens", tokens);
        BearerTokenAuthenticationFilter filter = new BearerTokenAuthenticationFilter(decoder, beans.getBeanProvider(ApiTokenService.class));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/workflows");
        request.addHeader("Authorization", "Bearer signed-token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (FilterChain) (ignoredRequest, ignoredResponse) -> { });

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getHeader("WWW-Authenticate")).isEqualTo("Bearer");
        assertThat(response.getContentAsString()).doesNotContain("signed-token");
    }
}
