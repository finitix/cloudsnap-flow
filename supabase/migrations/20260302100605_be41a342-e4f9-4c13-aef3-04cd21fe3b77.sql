
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Cloud connections table
CREATE TABLE public.cloud_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('vercel', 'netlify')),
  token TEXT NOT NULL,
  team_id TEXT,
  display_name TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cloud_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own connections" ON public.cloud_connections FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('zip', 'github')),
  github_url TEXT,
  framework TEXT,
  project_type TEXT,
  build_command TEXT,
  output_dir TEXT,
  status TEXT NOT NULL DEFAULT 'analyzing' CHECK (status IN ('analyzing', 'ready', 'deploying', 'live', 'error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own projects" ON public.projects FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Deployments table
CREATE TABLE public.deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cloud_connection_id UUID REFERENCES public.cloud_connections(id),
  provider TEXT NOT NULL CHECK (provider IN ('vercel', 'netlify')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'building', 'deploying', 'live', 'error')),
  live_url TEXT,
  deploy_id TEXT,
  error_message TEXT,
  logs TEXT,
  cpu_usage REAL,
  memory_usage REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own deployments" ON public.deployments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Enable realtime for deployments
ALTER PUBLICATION supabase_realtime ADD TABLE public.deployments;

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deployments_updated_at BEFORE UPDATE ON public.deployments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for project uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('project-uploads', 'project-uploads', false);
CREATE POLICY "Users can upload project files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'project-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can read own project files" ON storage.objects FOR SELECT USING (bucket_id = 'project-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
