create table access_action_serialization_locks (
    lock_key varchar(64) primary key,
    created_at timestamptz not null,
    constraint access_action_serialization_locks_key_sha256_check check (lock_key ~ '^[0-9a-f]{64}$')
);
