-- SAFE REGRESSION FIXTURE
-- Minimal production schema contract required by submission-workflow-regression.
-- Contains no production rows, credentials, tokens, passwords, or provider data.
CREATE TABLE public.warga_profiles (
    agama character varying(30)
);