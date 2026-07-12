package com.forgeboard.platform.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.forgeboard.identity.security.SecurityConfiguration;
import com.forgeboard.identity.security.TenantSelectionFilter;
import com.forgeboard.identity.application.TenantAuthorizationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@WebMvcTest(PlatformController.class)
@Import({SecurityConfiguration.class, TenantSelectionFilter.class})
class PlatformControllerTest {
    @Autowired MockMvc mockMvc;
    @MockitoBean TenantAuthorizationService tenantAuthorizationService;

    @Test
    void describesTheCurrentFoundation() throws Exception {
        mockMvc.perform(get("/api/platform"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("ForgeBoard"))
                .andExpect(jsonPath("$.product").value("LedgerFlow"))
                .andExpect(jsonPath("$.milestone").value("M0"));
    }
}
