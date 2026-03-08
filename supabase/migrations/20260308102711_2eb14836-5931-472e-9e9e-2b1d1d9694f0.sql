
-- AWS Connections table for storing AWS credentials
CREATE TABLE public.aws_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  display_name text NOT NULL DEFAULT 'My AWS Account',
  access_key_id text NOT NULL,
  secret_access_key text NOT NULL,
  default_region text NOT NULL DEFAULT 'us-east-1',
  connection_type text NOT NULL DEFAULT 'iam_keys',
  role_arn text,
  is_active boolean NOT NULL DEFAULT true,
  free_tier_alerts boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.aws_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own AWS connections" ON public.aws_connections FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can read all AWS connections" ON public.aws_connections FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_aws_connections_updated_at BEFORE UPDATE ON public.aws_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- AWS Infrastructure table - tracks VPC/subnet/SG per project
CREATE TABLE public.aws_infrastructure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  aws_connection_id uuid NOT NULL REFERENCES public.aws_connections(id) ON DELETE CASCADE,
  region text NOT NULL DEFAULT 'us-east-1',
  vpc_id text,
  public_subnet_id text,
  private_subnet_id text,
  internet_gateway_id text,
  security_group_id text,
  db_subnet_group_name text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  estimated_monthly_cost numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.aws_infrastructure ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own infrastructure" ON public.aws_infrastructure FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can read all infrastructure" ON public.aws_infrastructure FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_aws_infrastructure_updated_at BEFORE UPDATE ON public.aws_infrastructure FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- AWS Resources table - individual resources (EC2, RDS, ALB, S3)
CREATE TABLE public.aws_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  infrastructure_id uuid NOT NULL REFERENCES public.aws_infrastructure(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  resource_arn text,
  status text NOT NULL DEFAULT 'creating',
  config jsonb DEFAULT '{}'::jsonb,
  public_url text,
  public_ip text,
  monthly_cost_estimate numeric DEFAULT 0,
  auto_stop_enabled boolean DEFAULT true,
  last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.aws_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own resources" ON public.aws_resources FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can read all resources" ON public.aws_resources FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_aws_resources_updated_at BEFORE UPDATE ON public.aws_resources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add AWS-specific columns to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS aws_region text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS database_engine text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS aws_connection_id uuid REFERENCES public.aws_connections(id);

-- Enable realtime for aws_resources to track deployment progress
ALTER PUBLICATION supabase_realtime ADD TABLE public.aws_resources;
ALTER PUBLICATION supabase_realtime ADD TABLE public.aws_infrastructure;
