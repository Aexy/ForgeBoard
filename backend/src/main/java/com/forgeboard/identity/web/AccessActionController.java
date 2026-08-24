package com.forgeboard.identity.web;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.forgeboard.identity.application.AcceptInvitationRequest;
import com.forgeboard.identity.application.AccessLifecycleService;
import com.forgeboard.identity.application.CompletePasswordResetRequest;
import com.forgeboard.identity.application.InvalidIdentityException;

/** Receives narrowly scoped invitation and password-reset redemption requests. */
@RestController
@RequestMapping("/api/access")
public class AccessActionController {
    private static final int DISPLAY_NAME_MAX_LENGTH = 160;
    private static final int PASSWORD_MIN_LENGTH = 12;
    private static final int PASSWORD_MAX_LENGTH = 200;

    private final AccessLifecycleService lifecycle;

    public AccessActionController(AccessLifecycleService lifecycle) { this.lifecycle = lifecycle; }

    @PostMapping("/invitations/{token}/accept-new")
    ResponseEntity<Void> acceptNew(@PathVariable String token, @RequestBody NewInvitationAcceptance request) {
        if (request == null || !validDisplayName(request.displayName()) || !validPassword(request.password())) invalid();
        lifecycle.acceptNewAccountInvitation(new AcceptInvitationRequest(token, request.displayName(), request.password()));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/invitations/{token}/accept-existing")
    ResponseEntity<Void> acceptExisting(@PathVariable String token, Authentication authentication) {
        lifecycle.acceptExistingAccountInvitation(authentication.getName(), new AcceptInvitationRequest(token));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/password-resets/{token}/complete")
    ResponseEntity<Void> completeReset(@PathVariable String token, @RequestBody PasswordResetCompletion request) {
        if (request == null || !validPassword(request.password())) invalid();
        lifecycle.completePasswordReset(null, new CompletePasswordResetRequest(token, request.password()));
        return ResponseEntity.noContent().build();
    }

    private static boolean validDisplayName(String value) {
        return value != null && !value.isBlank() && value.length() <= DISPLAY_NAME_MAX_LENGTH;
    }

    private static boolean validPassword(String value) {
        return value != null && !value.isBlank()
                && value.length() >= PASSWORD_MIN_LENGTH && value.length() <= PASSWORD_MAX_LENGTH;
    }

    private static void invalid() { throw new InvalidIdentityException("Access action is invalid or expired"); }

    record NewInvitationAcceptance(String displayName, String password) { }
    record PasswordResetCompletion(String password) { }
}
