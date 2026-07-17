package com.forgeboard.work.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers(disabledWithoutDocker = true)
class WorkflowPublicIdentifierEmptyMigrationPostgresIntegrationTest {
    @Container
    static final PostgreSQLContainer postgres = new PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine"));

    @Test
    void appliesV015ToAnEmptySchemaWithFirmScopedUniqueConstraintsAndFirstTaskReference() throws Exception {
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("classpath:db/migration").load().migrate();

        try (Connection connection = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
            assertThat(stringValue(connection, "select 'FB-' || nextval('work_item_task_reference_sequence')"))
                    .isEqualTo("FB-1");
            assertThat(count(connection, "select count(*) from pg_constraint where conname in "
                    + "('workflows_firm_workflow_slug_unique', 'work_items_firm_task_reference_unique')"))
                    .isEqualTo(2);
        }
    }

    private String stringValue(Connection connection, String sql) throws Exception {
        try (Statement statement = connection.createStatement(); ResultSet result = statement.executeQuery(sql)) {
            result.next();
            return result.getString(1);
        }
    }

    private int count(Connection connection, String sql) throws Exception {
        try (Statement statement = connection.createStatement(); ResultSet result = statement.executeQuery(sql)) {
            result.next();
            return result.getInt(1);
        }
    }
}
