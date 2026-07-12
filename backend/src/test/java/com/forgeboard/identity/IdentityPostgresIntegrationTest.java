package com.forgeboard.identity;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import com.forgeboard.identity.application.OnboardingRequest;
import com.forgeboard.identity.application.OnboardingService;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class IdentityPostgresIntegrationTest {
    @Container
    static final PostgreSQLContainer postgres = new PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine"));

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired OnboardingService onboarding;
    @Autowired JdbcClient jdbc;

    @Test
    void flywaySchemaPersistsOnboardingAndItsAuditEvent() {
        onboarding.createFirm(new OnboardingRequest("Hearth Accounting", "hearth-accounting",
                "owner@example.com", "Alex Owner", "correct horse battery"));

        assertThat(count("firms")).isEqualTo(1);
        assertThat(count("users")).isEqualTo(1);
        assertThat(count("firm_memberships")).isEqualTo(1);
        assertThat(count("activity_events")).isEqualTo(1);
        assertThat(jdbc.sql("select action from activity_events").query(String.class).single())
                .isEqualTo("firm.created");
    }

    private long count(String table) {
        return jdbc.sql("select count(*) from " + table).query(Long.class).single();
    }
}
