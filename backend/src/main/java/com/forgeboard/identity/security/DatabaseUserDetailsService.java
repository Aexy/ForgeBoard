package com.forgeboard.identity.security;

import java.util.Locale;

import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import com.forgeboard.identity.domain.ForgeBoardUser;
import com.forgeboard.identity.persistence.UserRepository;

@Service
class DatabaseUserDetailsService implements UserDetailsService {
    private final UserRepository users;

    DatabaseUserDetailsService(UserRepository users) { this.users = users; }

    @Override
    public UserDetails loadUserByUsername(String username) {
        ForgeBoardUser user = users.findByEmail(username.strip().toLowerCase(Locale.ROOT))
                .orElseThrow(() -> new UsernameNotFoundException("Unknown account"));
        return User.withUsername(user.email()).password(user.passwordHash()).disabled(!user.enabled())
                .authorities("ROLE_USER").build();
    }
}

