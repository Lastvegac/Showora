-- Runtime and resolver roles must be provisioned independently from migration credentials.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO showora_app, showora_resolver;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO showora_app;
REVOKE ALL ON _prisma_migrations FROM showora_app;
REVOKE INSERT, UPDATE, DELETE ON permissions, subscription_plans, plan_versions FROM showora_app;
REVOKE UPDATE, DELETE ON audit_logs FROM showora_app;

DO $$
DECLARE tab text;
BEGIN
  FOREACH tab IN ARRAY ARRAY['tenant_domains','tenant_members','roles','role_permissions','member_roles','sales_teams','team_members','member_invitations','subscriptions','usage_records','website_settings','audit_logs'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tab);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tab);
    EXECUTE format('CREATE POLICY tenant_scope ON %I TO showora_app USING (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid)', tab);
  END LOOP;
  FOREACH tab IN ARRAY ARRAY['role_permissions','member_roles','sales_teams','team_members','member_invitations','usage_records','audit_logs'] LOOP
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT', tab, tab || '_tenant_fk');
  END LOOP;
END $$;

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_self ON tenants TO showora_app USING (id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (id = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- Narrow hostname lookup, no arbitrary tenant header and no runtime RLS bypass.
GRANT SELECT ON tenant_domains, tenants TO showora_resolver;
CREATE POLICY domain_resolution ON tenant_domains FOR SELECT TO showora_resolver USING (true);
CREATE POLICY domain_tenant_resolution ON tenants FOR SELECT TO showora_resolver USING (true);
CREATE FUNCTION resolve_tenant_host(requested_host text) RETURNS TABLE(tenant_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$ SELECT d.tenant_id FROM public.tenant_domains d JOIN public.tenants t ON t.id = d.tenant_id WHERE d.hostname = requested_host AND d.status = 'active' AND d.verified_at IS NOT NULL $$;
ALTER FUNCTION resolve_tenant_host(text) OWNER TO showora_resolver;
REVOKE ALL ON FUNCTION resolve_tenant_host(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_tenant_host(text) TO showora_app;

CREATE UNIQUE INDEX onboarding_reserved_subdomain ON onboarding_requests(subdomain) WHERE status = 'pending';
CREATE UNIQUE INDEX one_onboarding_plan ON plan_versions(is_onboarding) WHERE is_onboarding;
CREATE UNIQUE INDEX one_pending_invitation ON member_invitations(tenant_id,email) WHERE accepted_at IS NULL AND revoked_at IS NULL;

ALTER TABLE tenant_members ADD CONSTRAINT member_status_check CHECK (status IN ('active','disabled'));
ALTER TABLE role_permissions ADD CONSTRAINT permission_scope_check CHECK (scope IN ('own','team','all'));
ALTER TABLE team_members ADD CONSTRAINT team_role_check CHECK (role IN ('manager','sales'));
ALTER TABLE usage_records ADD CONSTRAINT usage_nonnegative CHECK (used >= 0);
ALTER TABLE plan_versions ADD CONSTRAINT trial_positive CHECK (trial_days > 0);
ALTER TABLE subscriptions ADD CONSTRAINT subscription_period_check CHECK (period_end > period_start);
ALTER TABLE member_invitations ADD CONSTRAINT invitation_inviter_fk FOREIGN KEY (tenant_id,inviter_id) REFERENCES tenant_members(tenant_id,id) ON DELETE RESTRICT;
ALTER TABLE auth_sessions ADD CONSTRAINT session_member_user_fk FOREIGN KEY (tenant_id,member_id,user_id) REFERENCES tenant_members(tenant_id,id,user_id) ON DELETE RESTRICT;
ALTER TABLE audit_logs ADD CONSTRAINT audit_actor_membership_fk FOREIGN KEY (tenant_id,actor_id) REFERENCES tenant_members(tenant_id,user_id) ON DELETE RESTRICT;
ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_parent_fk FOREIGN KEY (parent_id) REFERENCES refresh_tokens(id) ON DELETE RESTRICT;

-- Invitation arrays contain a grant intent, but must still reference roles in this tenant.
CREATE FUNCTION validate_invitation_roles() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE rid uuid;
BEGIN
  IF cardinality(NEW.role_ids) < 1 OR cardinality(NEW.role_ids) > 10 THEN RAISE EXCEPTION 'Invalid role count' USING ERRCODE = '23514'; END IF;
  FOREACH rid IN ARRAY NEW.role_ids LOOP
    IF NOT EXISTS (SELECT 1 FROM public.roles WHERE tenant_id = NEW.tenant_id AND id = rid AND key <> 'TENANT_OWNER') THEN
      RAISE EXCEPTION 'Invalid tenant role reference' USING ERRCODE = '23503';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER invitation_role_scope BEFORE INSERT OR UPDATE OF role_ids ON member_invitations FOR EACH ROW EXECUTE FUNCTION validate_invitation_roles();
REVOKE ALL ON FUNCTION validate_invitation_roles() FROM PUBLIC;
