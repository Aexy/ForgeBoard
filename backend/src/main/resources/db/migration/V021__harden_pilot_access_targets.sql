alter table firm_memberships
    add column invitation_email varchar(320),
    add column invitation_display_name varchar(160);

update firm_memberships membership
set invitation_email = lower(btrim(account.email)),
    invitation_display_name = account.display_name
from users account
where membership.user_id = account.id;

update firm_memberships membership
set invitation_email = lower(btrim(latest.target_email))
from (
    select distinct on (membership_id) membership_id, target_email
    from access_actions
    where action_type = 'INVITATION'
    order by membership_id, created_at desc, id desc
) latest
where membership.id = latest.membership_id
  and membership.status = 'INVITED';

-- A V020-valid unbound invited row without any invitation action has no durable
-- recipient identity and cannot be redeemed or safely presented to an operator.
delete from firm_memberships membership
where membership.status = 'INVITED'
  and membership.user_id is null
  and membership.invitation_email is null;

-- All lifecycle writers normalize addresses. Canonicalize legacy/raw SQL rows
-- before deduplicating them so case variants cannot evade the live-link indexes.
update access_actions
set target_email = lower(btrim(target_email));

-- A returning user may already have a removed membership while a legacy unbound
-- invitation for the same firm/email is pending. Promote the bound membership as
-- the durable identity before the general pending-row deduplication below.
with latest_pending as (
    select distinct on (removed.id)
           removed.id as canonical_id,
           invited.role,
           invited.invitation_display_name,
           invited.updated_at
    from firm_memberships removed
    join firm_memberships invited
      on invited.firm_id = removed.firm_id
     and invited.invitation_email = removed.invitation_email
     and invited.status = 'INVITED'
     and invited.user_id is null
    where removed.status = 'REMOVED' and removed.user_id is not null
    order by removed.id, invited.updated_at desc, invited.created_at desc, invited.id desc
)
update firm_memberships canonical
set status = 'INVITED',
    role = latest_pending.role,
    invitation_display_name = coalesce(latest_pending.invitation_display_name, canonical.invitation_display_name),
    updated_at = greatest(canonical.updated_at, latest_pending.updated_at)
from latest_pending
where canonical.id = latest_pending.canonical_id;

update access_actions action
set membership_id = canonical.id,
    user_id = coalesce(action.user_id, canonical.user_id)
from firm_memberships duplicate,
     firm_memberships canonical
where action.membership_id = duplicate.id
  and duplicate.status = 'INVITED'
  and duplicate.user_id is null
  and canonical.status = 'INVITED'
  and canonical.user_id is not null
  and canonical.firm_id = duplicate.firm_id
  and canonical.invitation_email = duplicate.invitation_email;

delete from firm_memberships duplicate
using firm_memberships canonical
where duplicate.status = 'INVITED'
  and duplicate.user_id is null
  and canonical.status = 'INVITED'
  and canonical.user_id is not null
  and canonical.firm_id = duplicate.firm_id
  and canonical.invitation_email = duplicate.invitation_email;

-- V018 permitted revoke-then-reinvite to create duplicate unbound pending rows. Keep the
-- most recently managed membership as the durable identity and retain every action on it.
with ranked as (
    select id,
           first_value(id) over (
               partition by firm_id, invitation_email
               order by updated_at desc, created_at desc, id desc
           ) as canonical_id,
           row_number() over (
               partition by firm_id, invitation_email
               order by updated_at desc, created_at desc, id desc
           ) as row_number
    from firm_memberships
    where status = 'INVITED' and invitation_email is not null
)
update access_actions action
set membership_id = ranked.canonical_id
from ranked
where ranked.row_number > 1
  and action.membership_id = ranked.id;

with ranked as (
    select id,
           row_number() over (
               partition by firm_id, invitation_email
               order by updated_at desc, created_at desc, id desc
           ) as row_number
    from firm_memberships
    where status = 'INVITED' and invitation_email is not null
)
delete from firm_memberships membership
using ranked
where ranked.row_number > 1
  and membership.id = ranked.id;

-- V018-V020 invitation acceptance bound the membership but not the action.
-- Restore that durable audit correlation for both consumed and revoked history.
update access_actions action
set user_id = membership.user_id
from firm_memberships membership
where action.action_type = 'INVITATION'
  and action.firm_id = membership.firm_id
  and action.membership_id = membership.id
  and action.user_id is null
  and membership.user_id is not null;

alter table firm_memberships
    add constraint firm_memberships_invited_identity_check check (
        status <> 'INVITED'
        or (invitation_email is not null
            and btrim(invitation_email) <> ''
            and invitation_email = lower(btrim(invitation_email)))
    );

create unique index firm_memberships_one_pending_invitation_idx
    on firm_memberships (firm_id, invitation_email)
    where status = 'INVITED';

-- Password resets created before firm/membership binding cannot be redeemed safely.
update access_actions
set revoked_at = coalesce(revoked_at, current_timestamp)
where action_type = 'PASSWORD_RESET'
  and (firm_id is null or membership_id is null or user_id is null);

with ranked as (
    select id,
           row_number() over (
               partition by firm_id, target_email
               order by created_at desc, id desc
           ) as row_number
    from access_actions
    where action_type = 'INVITATION' and consumed_at is null and revoked_at is null
)
update access_actions action
set revoked_at = current_timestamp
from ranked
where ranked.row_number > 1
  and action.id = ranked.id;

with ranked as (
    select id,
           row_number() over (
               partition by user_id
               order by created_at desc, id desc
           ) as row_number
    from access_actions
    where action_type = 'PASSWORD_RESET' and consumed_at is null and revoked_at is null
)
update access_actions action
set revoked_at = current_timestamp
from ranked
where ranked.row_number > 1
  and action.id = ranked.id;

alter table access_actions
    add constraint access_actions_live_reset_scope_check check (
        action_type <> 'PASSWORD_RESET'
        or consumed_at is not null
        or revoked_at is not null
        or (firm_id is not null and membership_id is not null and user_id is not null)
    );

create unique index access_actions_one_live_invitation_identity_idx
    on access_actions (firm_id, target_email)
    where action_type = 'INVITATION' and consumed_at is null and revoked_at is null;

create unique index access_actions_one_live_invitation_membership_idx
    on access_actions (firm_id, membership_id)
    where action_type = 'INVITATION' and consumed_at is null and revoked_at is null;

create unique index access_actions_one_live_password_reset_idx
    on access_actions (user_id)
    where action_type = 'PASSWORD_RESET' and consumed_at is null and revoked_at is null;

alter table access_actions
    add constraint access_actions_target_email_normalized_check check (
        target_email = lower(btrim(target_email)) and btrim(target_email) <> ''
    );
