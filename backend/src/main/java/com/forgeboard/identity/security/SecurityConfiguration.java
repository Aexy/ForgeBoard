package com.forgeboard.identity.security;

import java.time.Clock;
import java.util.Base64;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.SecurityContextHolderFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.web.util.matcher.RequestMatcher;

@Configuration
@EnableWebSecurity
public class SecurityConfiguration {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, TenantSelectionFilter tenantSelectionFilter,
            BearerTokenAuthenticationFilter bearerTokenAuthenticationFilter) throws Exception {
        RequestMatcher bearerRequest = request -> {
            String authorization = request.getHeader("Authorization");
            return authorization != null && authorization.startsWith("Bearer ");
        };
        return http
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers("/actuator/health", "/api/platform", "/api/onboarding/firms").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/auth/csrf").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/session", "/api/auth/grant", "/api/auth/refresh", "/api/auth/revoke").permitAll()
                        .anyRequest().authenticated())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .csrf(csrf -> csrf
                        .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                        .ignoringRequestMatchers("/api/onboarding/firms", "/api/auth/grant", "/api/auth/refresh", "/api/auth/revoke")
                        .ignoringRequestMatchers(bearerRequest))
                .exceptionHandling(exceptions -> exceptions
                        .defaultAuthenticationEntryPointFor(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED),
                                request -> request.getRequestURI().startsWith("/api/")))
                .addFilterAfter(bearerTokenAuthenticationFilter, SecurityContextHolderFilter.class)
                .addFilterAfter(tenantSelectionFilter, BearerTokenAuthenticationFilter.class)
                .build();
    }

    @Bean
    FilterRegistrationBean<TenantSelectionFilter> tenantSelectionFilterRegistration(TenantSelectionFilter tenantSelectionFilter) {
        FilterRegistrationBean<TenantSelectionFilter> registration = new FilterRegistrationBean<>(tenantSelectionFilter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(12); }
    @Bean Clock clock() { return Clock.systemUTC(); }
    @Bean AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    JwtEncoder apiJwtEncoder(@Value("${forgeboard.api-token.secret}") String configuredSecret) {
        return NimbusJwtEncoder.withSecretKey(apiTokenKey(configuredSecret)).build();
    }

    @Bean
    JwtDecoder apiJwtDecoder(@Value("${forgeboard.api-token.secret}") String configuredSecret) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(apiTokenKey(configuredSecret))
                .macAlgorithm(MacAlgorithm.HS256).build();
        OAuth2TokenValidator<Jwt> audience = jwt -> jwt.getAudience().contains("forgeboard-api")
                ? org.springframework.security.oauth2.core.OAuth2TokenValidatorResult.success()
                : org.springframework.security.oauth2.core.OAuth2TokenValidatorResult.failure(
                        new OAuth2Error("invalid_token", "Token audience is invalid", null));
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefaultWithIssuer("forgeboard"), audience));
        return decoder;
    }

    private SecretKey apiTokenKey(String configuredSecret) {
        if (configuredSecret == null || configuredSecret.isBlank()) {
            throw new IllegalStateException("FORGEBOARD_API_TOKEN_SECRET must be configured");
        }
        final byte[] key;
        try {
            key = Base64.getDecoder().decode(configuredSecret);
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("FORGEBOARD_API_TOKEN_SECRET must be valid Base64", exception);
        }
        if (key.length < 32) throw new IllegalStateException("FORGEBOARD_API_TOKEN_SECRET must contain at least 256 bits");
        return new SecretKeySpec(key, "HmacSHA256");
    }
}
