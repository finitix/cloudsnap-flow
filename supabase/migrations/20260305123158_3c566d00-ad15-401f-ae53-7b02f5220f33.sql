DELETE FROM public.deployments WHERE provider = 'netlify' OR provider = 'railway';
DELETE FROM public.cloud_connections WHERE provider = 'netlify' OR provider = 'railway';
ALTER TABLE public.cloud_connections DROP CONSTRAINT cloud_connections_provider_check;
ALTER TABLE public.cloud_connections ADD CONSTRAINT cloud_connections_provider_check CHECK (provider = ANY (ARRAY['vercel'::text, 'render'::text, 'aws'::text]));