import PublicLayout from "@/components/PublicLayout";

export default function Privacy() {
  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-6 py-20">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-muted-foreground">
          <p className="text-sm"><strong className="text-foreground">Last updated:</strong> March 8, 2026</p>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Information We Collect</h2>
            <p>We collect: (a) account information (email, display name); (b) cloud provider API tokens you provide; (c) project metadata (names, frameworks, build commands); (d) deployment logs and status data; (e) usage analytics.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. How We Use Your Information</h2>
            <p>Your data is used to: (a) provide deployment services; (b) analyze and configure your projects; (c) monitor deployment health; (d) provide auto-healing capabilities; (e) improve our services; (f) communicate with you about your account.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Source Code</h2>
            <p>Your source code is downloaded temporarily during the deployment process for analysis and building. It is not permanently stored on our servers. ZIP uploads are stored in secure, encrypted storage buckets accessible only to your account.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. API Tokens</h2>
            <p>Cloud provider API tokens are stored securely and encrypted at rest. They are used exclusively for deployment operations to your specified providers and are never shared with third parties.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Data Sharing</h2>
            <p>We do not sell your personal information. We may share data with: (a) cloud providers you connect (only deployment data); (b) AI services for error analysis (only error logs, no source code); (c) as required by law.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Data Retention</h2>
            <p>Account data is retained while your account is active. Deployment logs are retained for 90 days. You may request deletion of your data at any time by deleting your account.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Security</h2>
            <p>We implement industry-standard security measures including encryption at rest and in transit, row-level security policies, and regular security audits.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. Your Rights</h2>
            <p>You have the right to: (a) access your data; (b) correct inaccurate data; (c) delete your account and data; (d) export your data; (e) withdraw consent.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">9. Contact</h2>
            <p>For privacy inquiries, contact us at privacy@cloudsnap.studio or use our Contact page.</p>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}
