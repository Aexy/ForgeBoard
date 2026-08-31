package com.forgeboard;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ForgeBoardApplication {
    public static void main(String[] args) {
        SpringApplication.run(ForgeBoardApplication.class, args);
    }
}
