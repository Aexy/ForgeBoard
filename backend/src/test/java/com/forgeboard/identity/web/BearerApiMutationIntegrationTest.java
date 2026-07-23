package com.forgeboard.identity.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Base64;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import com.forgeboard.identity.application.OnboardingRequest;
import com.forgeboard.identity.application.OnboardingResult;
import com.forgeboard.identity.application.OnboardingService;
import com.forgeboard.identity.security.TenantSelectionFilter;
import com.forgeboard.work.persistence.SavedWorkflowViewRepository;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class BearerApiMutationIntegrationTest {
    @Container
    static final PostgreSQLContainer postgres = new PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine"));

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("forgeboard.api-token.secret", () -> Base64.getEncoder().encodeToString(new byte[32]));
    }

    @Autowired MockMvc mockMvc;
    @Autowired OnboardingService onboarding;
    @Autowired SavedWorkflowViewRepository savedViews;

    @Test
    void realBearerGrantAuthenticatesAndPersistsATenantScopedMutationWithoutACookie() throws Exception {
        String suffix = UUID.randomUUID().toString();
        String email = "owner-" + suffix + "@example.com";
        OnboardingResult onboarded = onboarding.createFirm(new OnboardingRequest("Bearer Firm", "bearer-" + suffix,
                email, "Bearer Owner", "correct horse battery"));

        MvcResult grant = mockMvc.perform(post("/api/auth/grant")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"correct horse battery\"}"))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist("Set-Cookie"))
                .andReturn();
        String accessToken = accessToken(grant);

        mockMvc.perform(post("/api/workflows/views")
                        .header("Authorization", "Bearer " + accessToken)
                        .header(TenantSelectionFilter.FIRM_HEADER, onboarded.firmId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Overdue work\",\"dueState\":\"OVERDUE\"}"))
                .andExpect(status().isCreated())
                .andExpect(header().doesNotExist("Set-Cookie"));

        assertThat(savedViews.findAllByFirmIdOrderByNameAsc(onboarded.firmId()))
                .extracting(view -> view.name())
                .containsExactly("Overdue work");
    }

    private String accessToken(MvcResult grant) throws Exception {
        Matcher token = Pattern.compile("\\\"accessToken\\\":\\\"([^\\\"]+)\\\"")
                .matcher(grant.getResponse().getContentAsString());
        assertThat(token.find()).isTrue();
        return token.group(1);
    }
}
