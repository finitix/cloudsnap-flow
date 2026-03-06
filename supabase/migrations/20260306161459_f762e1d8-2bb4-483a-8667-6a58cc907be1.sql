ALTER TABLE public.deployments DROP CONSTRAINT deployments_provider_check;
ALTER TABLE public.deployments ADD CONSTRAINT deployments_provider_check CHECK (provider IN ('vercel', 'render', 'aws'));