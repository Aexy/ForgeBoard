package com.forgeboard.platform.web;

import java.time.Instant;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/platform")
public class PlatformController {
    @GetMapping
    Map<String, Object> platform() {
        return Map.of("name", "ForgeBoard", "product", "LedgerFlow", "milestone", "M0",
                "status", "foundation", "time", Instant.now().toString());
    }
}

