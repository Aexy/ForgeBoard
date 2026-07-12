create table firms (
    id uuid primary key,
    name varchar(160) not null,
    slug varchar(80) not null unique,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    version bigint not null default 0
);

create table users (
    id uuid primary key,
    email varchar(320) not null unique,
    display_name varchar(160) not null,
    password_hash varchar(255) not null,
    enabled boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    version bigint not null default 0,
    constraint users_email_lowercase check (email = lower(email))
);

create table firm_memberships (
    id uuid primary key,
    firm_id uuid not null references firms(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    role varchar(32) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    version bigint not null default 0,
    constraint firm_memberships_unique unique (firm_id, user_id),
    constraint firm_memberships_role check (role in ('OWNER', 'ADMINISTRATOR', 'MANAGER', 'MEMBER', 'READ_ONLY'))
);
create index firm_memberships_user_id_idx on firm_memberships(user_id);

create table activity_events (
    id uuid primary key,
    firm_id uuid not null references firms(id) on delete cascade,
    actor_user_id uuid references users(id) on delete set null,
    actor_type varchar(32) not null,
    source varchar(32) not null,
    action varchar(100) not null,
    target_type varchar(100) not null,
    target_id uuid,
    summary jsonb not null default '{}'::jsonb,
    occurred_at timestamptz not null default now(),
    constraint activity_events_actor_type check (actor_type in ('USER', 'SERVICE', 'SYSTEM')),
    constraint activity_events_source check (source in ('WEB', 'REST', 'MCP', 'JOB'))
);
create index activity_events_firm_occurred_idx on activity_events(firm_id, occurred_at desc);

