package com.forgeboard.identity.web;

import java.net.URI;

import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.forgeboard.identity.application.OnboardingRequest;
import com.forgeboard.identity.application.OnboardingResult;
import com.forgeboard.identity.application.OnboardingService;

import jakarta.validation.Valid;

@Validated
@RestController
@RequestMapping("/api/onboarding/firms")
public class OnboardingController {
    private final OnboardingService onboarding;

    public OnboardingController(OnboardingService onboarding) { this.onboarding = onboarding; }

    @PostMapping
    ResponseEntity<OnboardingResult> create(@Valid @RequestBody OnboardingRequest request) {
        OnboardingResult result = onboarding.createFirm(request);
        return ResponseEntity.created(URI.create("/api/firms/" + result.firmId())).body(result);
    }
}

