import PublicLayout from "@/components/PublicLayout";

export default function Terms() {
  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-6 py-20">
        <h1 className="text-4xl font-bold mb-8">Terms & Conditions</h1>
        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-muted-foreground">
          <p className="text-sm"><strong className="text-foreground">Last updated:</strong> March 8, 2026</p>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Acceptance of Terms</h2>
            <p>By accessing and using Cloudsnap Studio ("Service"), you agree to be bound by these Terms and Conditions. If you do not agree, please do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Description of Service</h2>
            <p>Cloudsnap Studio provides automated cloud deployment services, including project analysis, build configuration, deployment to third-party cloud providers, and monitoring capabilities.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. User Accounts</h2>
            <p>You must create an account to use the Service. You are responsible for maintaining the confidentiality of your credentials and all activities under your account. You must provide accurate information during registration.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Cloud Provider Tokens</h2>
            <p>You provide API tokens for third-party services (Vercel, Render, etc.) at your own risk. Cloudsnap Studio uses these tokens solely for deployment operations and does not share them with any other parties.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Acceptable Use</h2>
            <p>You agree not to: (a) violate any laws; (b) deploy malicious code; (c) attempt to gain unauthorized access; (d) interfere with the Service; (e) use the Service for illegal activities.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Data & Privacy</h2>
            <p>We collect and process data as described in our Privacy Policy. Your source code is processed temporarily for analysis and deployment but is not permanently stored on our servers.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Limitation of Liability</h2>
            <p>Cloudsnap Studio is provided "as is" without warranties. We are not liable for deployment failures, data loss, downtime of third-party providers, or any indirect damages arising from use of the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. Termination</h2>
            <p>We may suspend or terminate your account at any time for violation of these terms. You may delete your account at any time through the Settings page.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">9. Changes</h2>
            <p>We reserve the right to modify these terms at any time. Continued use of the Service after changes constitutes acceptance.</p>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}
