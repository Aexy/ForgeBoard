package com.forgeboard.platform.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.forgeboard.platform.security.SecurityConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(PlatformController.class)
@Import(SecurityConfiguration.class)
class PlatformControllerTest {
    @Autowired MockMvc mockMvc;

    @Test
    void describesTheCurrentFoundation() throws Exception {
        mockMvc.perform(get("/api/platform"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("ForgeBoard"))
                .andExpect(jsonPath("$.product").value("LedgerFlow"))
                .andExpect(jsonPath("$.milestone").value("M0"));
    }
}
