package com.forgeboard.identity.web;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.forgeboard.identity.application.SessionIdentity;
import com.forgeboard.identity.application.SessionLoginRequest;
import com.forgeboard.identity.security.SessionAuthenticationService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class SessionController {
    private final SessionAuthenticationService sessions;

    public SessionController(SessionAuthenticationService sessions) { this.sessions = sessions; }

    @GetMapping("/csrf")
    Map<String, String> csrf(CsrfToken token) {
        return Map.of("headerName", token.getHeaderName(), "token", token.getToken());
    }

    @PostMapping("/session")
    SessionIdentity login(@Valid @RequestBody SessionLoginRequest credentials,
            HttpServletRequest request, HttpServletResponse response) {
        return sessions.login(credentials, request, response);
    }

    @GetMapping("/session")
    SessionIdentity current(Authentication authentication) {
        return new SessionIdentity(authentication.getName());
    }

    @DeleteMapping("/session")
    ResponseEntity<Void> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) session.invalidate();
        return ResponseEntity.noContent().build();
    }
}

