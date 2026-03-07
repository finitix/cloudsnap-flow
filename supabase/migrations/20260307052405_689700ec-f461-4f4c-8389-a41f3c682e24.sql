ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS backend_framework text,
ADD COLUMN IF NOT EXISTS backend_start_command text,
ADD COLUMN IF NOT EXISTS backend_build_command text,
ADD COLUMN IF NOT EXISTS frontend_framework text,
ADD COLUMN IF NOT EXISTS frontend_build_command text,
ADD COLUMN IF NOT EXISTS frontend_output_dir text;