package com.forgeboard.identity.web;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.forgeboard.identity.application.SessionLoginRequest;
import com.forgeboard.identity.security.ApiTokenService;
import com.forgeboard.identity.security.ApiTokenService.ApiGrant;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/auth")
@Validated
public class ApiAuthenticationController {
    private final ApiTokenService tokens;

    public ApiAuthenticationController(ApiTokenService tokens) { this.tokens = tokens; }

    @PostMapping("/grant")
    ApiGrant grant(@Valid @RequestBody SessionLoginRequest request) { return tokens.grant(request); }

    @PostMapping("/refresh")
    ApiGrant refresh(@Valid @RequestBody RefreshRequest request) { return tokens.refresh(request.refreshToken()); }

    @PostMapping("/revoke")
    Map<String, Boolean> revoke(@Valid @RequestBody RefreshRequest request) {
        tokens.revoke(request.refreshToken());
        return Map.of("revoked", true);
    }

    record RefreshRequest(@NotBlank @Size(max = 512) String refreshToken) { }
}

@RestControllerAdvice(assignableTypes = ApiAuthenticationController.class)
class ApiAuthenticationExceptionHandler {
    @ExceptionHandler(AuthenticationException.class)
    ProblemDetail invalidCredentials(AuthenticationException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, "Invalid API credentials");
    }
}
