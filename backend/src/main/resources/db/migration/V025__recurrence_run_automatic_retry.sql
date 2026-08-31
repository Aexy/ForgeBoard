alter table engagement_recurrence_runs
    add column automatic_retry_attempted boolean not null default false;
