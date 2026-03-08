
-- GitHub accounts table
CREATE TABLE public.github_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  github_id bigint NOT NULL,
  username text NOT NULL,
  email text,
  avatar_url text,
  access_token text NOT NULL,
  connected_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(github_id)
);

ALTER TABLE public.github_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own github accounts"
  ON public.github_accounts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all github accounts"
  ON public.github_accounts FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- GitHub repositories table
CREATE TABLE public.github_repositories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  github_account_id uuid NOT NULL REFERENCES public.github_accounts(id) ON DELETE CASCADE,
  repo_id bigint NOT NULL,
  name text NOT NULL,
  full_name text NOT NULL,
  description text,
  is_private boolean NOT NULL DEFAULT false,
  default_branch text NOT NULL DEFAULT 'main',
  language text,
  html_url text,
  clone_url text,
  updated_at timestamp with time zone,
  synced_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, repo_id)
);

ALTER TABLE public.github_repositories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own github repositories"
  ON public.github_repositories FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all github repositories"
  ON public.github_repositories FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at on github_accounts
CREATE TRIGGER update_github_accounts_updated_at
  BEFORE UPDATE ON public.github_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
