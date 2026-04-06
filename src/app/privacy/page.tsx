import { Metadata } from 'next';
import { LegalPageLayout } from '@/components/legal/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Privacy Policy | FOLIO',
  description: 'Folio Privacy Policy - Learn how we collect, use, and protect your personal information.',
};

const tocItems = [
  { id: 'introduction', title: '1. Introduction', level: 1 },
  { id: 'information-we-collect', title: '2. Information We Collect', level: 1 },
  { id: 'how-we-use-your-information', title: '3. How We Use Your Information', level: 1 },
  { id: 'how-we-share-your-information', title: '4. How We Share Your Information', level: 1 },
  { id: 'your-rights-and-choices', title: '5. Your Rights and Choices', level: 1 },
  { id: 'california-privacy-rights', title: '6. California Privacy Rights (CCPA/CPRA)', level: 1 },
  { id: 'european-privacy-rights', title: '7. European Privacy Rights (GDPR)', level: 1 },
  { id: 'data-retention', title: '8. Data Retention', level: 1 },
  { id: 'data-security', title: '9. Data Security', level: 1 },
  { id: 'childrens-privacy', title: "10. Children's Privacy", level: 1 },
  { id: 'third-party-links', title: '11. Third-Party Links', level: 1 },
  { id: 'changes-to-policy', title: '12. Changes to This Privacy Policy', level: 1 },
  { id: 'contact-us', title: '13. Contact Us', level: 1 },
  { id: 'additional-disclosures', title: '14. Additional Disclosures', level: 1 },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      lastUpdated="January 2026"
      effectiveDate="January 2026"
      tocItems={tocItems}
    >
      <section id="introduction">
        <h2>1. Introduction</h2>
        <p>
          Folio AD, LLC (&quot;Folio,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the Folio platform at folioad.com (the &quot;Platform&quot;), an interior design ecosystem connecting designers, vendors, and individuals. This Privacy Policy explains how we collect, use, disclose, and protect your personal information when you use our Platform.
        </p>
        <p>
          We are committed to protecting your privacy and handling your data transparently. Please read this Privacy Policy carefully. By using the Platform, you acknowledge that you have read and understood this Privacy Policy.
        </p>
        <h3>Contact Information:</h3>
        <ul>
          <li>Email: privacy@folioad.com</li>
        </ul>
      </section>

      <section id="information-we-collect">
        <h2>2. Information We Collect</h2>
        <p>
          We collect information in several ways: directly from you, automatically through your use of the Platform, and from third-party sources.
        </p>

        <h3>2.1 Information You Provide Directly</h3>
        <h4>Account Information:</h4>
        <ul>
          <li>Email address (required)</li>
          <li>Full name (required)</li>
          <li>Password (stored in encrypted/hashed form only)</li>
          <li>Phone number (optional)</li>
          <li>Location/city/state (optional)</li>
          <li>Profile photo (optional)</li>
          <li>Biography (optional)</li>
        </ul>

        <h4>Professional Information (Designers, Architects, Builders):</h4>
        <ul>
          <li>Professional title and studio/firm name</li>
          <li>Company affiliation</li>
          <li>Professional specializations and specialties</li>
          <li>Website and social media links (Instagram, LinkedIn)</li>
          <li>Professional license numbers (for architects)</li>
          <li>States of licensure</li>
          <li>Years in business</li>
          <li>Project types and scale</li>
        </ul>

        <h4>Client/Individual Information:</h4>
        <ul>
          <li>Budget range for projects</li>
          <li>Desired rooms for design work</li>
          <li>Service level preferences</li>
          <li>Project status and timeline</li>
        </ul>

        <h4>Project and Content Information:</h4>
        <ul>
          <li>Project titles, descriptions, and categories</li>
          <li>Project images and photos you upload</li>
          <li>Product selections and specifications</li>
          <li>Design notes and annotations</li>
          <li>Interview responses and design philosophy statements</li>
          <li>Audio recordings (if you choose voice input for interviews)</li>
        </ul>

        <h4>Commerce Information:</h4>
        <ul>
          <li>Order history and purchase details</li>
          <li>Shipping information</li>
          <li>Payment method (processed by third-party payment processors)</li>
        </ul>

        <h4>Vendor Trade Account Information (Vendors Only):</h4>
        <ul>
          <li>Trade portal login credentials (encrypted)</li>
          <li>API credentials (encrypted)</li>
          <li>Discount and payment terms</li>
          <li>Sales representative contact information</li>
        </ul>

        <h3>2.2 Information Collected Automatically</h3>
        <p>When you use the Platform, we automatically collect certain information about your device and usage patterns.</p>

        <h4>Device and Technical Information:</h4>
        <ul>
          <li>IP address</li>
          <li>Browser type and version</li>
          <li>Operating system</li>
          <li>Device identifiers</li>
          <li>Time zone and language settings</li>
        </ul>

        <h4>Usage Information:</h4>
        <ul>
          <li>Pages and features you access</li>
          <li>Time spent on pages</li>
          <li>Click patterns and navigation paths</li>
          <li>Search queries within the Platform</li>
          <li>Features you interact with</li>
        </ul>

        <h4>Behavioral Signals (Atelier System):</h4>
        <p>We collect behavioral data to power our recommendation and personalization system (&quot;Atelier&quot;). This includes:</p>
        <ul>
          <li>Products you view, save, or add to projects</li>
          <li>Images you save or interact with</li>
          <li>Design styles and aesthetics you engage with</li>
          <li>Vendors and designers you follow or interact with</li>
          <li>Tags and keywords associated with your activity</li>
          <li>Time-based patterns of your usage</li>
        </ul>
        <p>
          This behavioral data is used to build a &quot;designer fingerprint&quot; or &quot;aesthetic profile&quot; that helps us personalize your experience and provide relevant recommendations. See Section 3.3 for more details.
        </p>

        <h4>Designer Voice Profile:</h4>
        <p>
          If you use voice input features or participate in recorded interviews, we may analyze your communication patterns to create a &quot;voice profile&quot; that includes:
        </p>
        <ul>
          <li>Vocabulary and terminology preferences</li>
          <li>Writing and speaking style characteristics</li>
          <li>Communication tone indicators</li>
        </ul>
        <p>This profile helps us generate content that matches your authentic voice when creating editorial features about your work.</p>

        <h3>2.3 Information from Third Parties</h3>
        <h4>Social Media:</h4>
        <p>If you connect social media accounts (e.g., Instagram), we may receive your public profile information and content you choose to share.</p>

        <h4>Vendor Product Information:</h4>
        <p>We may collect publicly available product information from vendor websites to populate our product catalog.</p>

        <h4>Event Partners:</h4>
        <p>If you attend events promoted through Folio, event organizers may share attendance information with us.</p>

        <h3>2.4 Sensitive Information</h3>
        <p>We may collect the following categories of sensitive information:</p>
        <ul>
          <li><strong>Professional credentials:</strong> License numbers for architects and other licensed professionals</li>
          <li><strong>Biometric-adjacent data:</strong> Voice embeddings derived from audio recordings (with your consent)</li>
          <li><strong>Financial indicators:</strong> Budget ranges and pricing information</li>
          <li><strong>Precise location:</strong> Only if you choose to add location data to projects or selections</li>
        </ul>
        <p>We do not collect health information, genetic data, racial or ethnic origin, political opinions, religious beliefs, sexual orientation, or criminal history.</p>
      </section>

      <section id="how-we-use-your-information">
        <h2>3. How We Use Your Information</h2>

        <h3>3.1 Providing and Improving the Platform</h3>
        <p>We use your information to:</p>
        <ul>
          <li>Create and manage your account</li>
          <li>Enable you to create, manage, and publish projects</li>
          <li>Connect designers with vendors and clients</li>
          <li>Process transactions and orders</li>
          <li>Provide customer support</li>
          <li>Send service-related communications</li>
          <li>Maintain Platform security and prevent fraud</li>
          <li>Analyze usage patterns to improve the Platform</li>
          <li>Fix bugs and troubleshoot issues</li>
        </ul>

        <h3>3.2 Personalization and Recommendations</h3>
        <p>We use your information to personalize your experience:</p>
        <ul>
          <li>Recommend products, designers, and vendors based on your preferences</li>
          <li>Curate your discovery feed based on your aesthetic profile</li>
          <li>Suggest design styles and materials you may like</li>
          <li>Match clients with designers whose style aligns with their preferences</li>
          <li>Surface relevant content and opportunities</li>
        </ul>

        <h3>3.3 Atelier Intelligence System</h3>
        <p>
          Our proprietary Atelier system analyzes your interactions to build an &quot;aesthetic fingerprint&quot; that captures your design preferences and style. This system:
        </p>
        <ul>
          <li>Observes which products, images, and styles you engage with</li>
          <li>Identifies patterns in your design decisions</li>
          <li>Creates embeddings (mathematical representations) of your aesthetic preferences</li>
          <li>Uses these patterns to improve recommendations for you and others</li>
          <li>Helps vendors understand which designers resonate with their products</li>
        </ul>

        <h4>Your Atelier data is used to:</h4>
        <ul>
          <li>Personalize your feed and recommendations</li>
          <li>Help clients find designers whose style matches their preferences</li>
          <li>Provide vendors with aggregated (not individual) insights about design trends</li>
          <li>Improve our AI models for better recommendations</li>
        </ul>
        <p><strong>You can request deletion of your Atelier data at any time</strong> by contacting privacy@folioad.com or using the account deletion feature.</p>

        <h3>3.4 AI-Powered Features</h3>
        <p>We use artificial intelligence to enhance your experience:</p>
        <ul>
          <li><strong>Image Classification:</strong> Analyzing uploaded images to detect colors, materials, styles, and design elements</li>
          <li><strong>Editorial Generation:</strong> Creating draft editorial content about your projects based on your interviews and project details</li>
          <li><strong>Product Detection:</strong> Identifying products and materials in images</li>
          <li><strong>Content Recommendations:</strong> Suggesting relevant content based on your interests</li>
        </ul>
        <p><strong>Important:</strong> To provide these AI features, we send certain data to third-party AI service providers. See Section 4 for details.</p>

        <h3>3.5 Communications</h3>
        <p>We may use your information to send:</p>
        <ul>
          <li>Service announcements and updates</li>
          <li>Notifications about activity on your projects or profile</li>
          <li>Marketing communications (with your consent, where required)</li>
          <li>Event invitations and industry news</li>
        </ul>
        <p>You can opt out of marketing communications at any time.</p>

        <h3>3.6 Analytics and Research</h3>
        <p>We use aggregated and anonymized data to:</p>
        <ul>
          <li>Understand design trends and preferences</li>
          <li>Conduct research on interior design industry patterns</li>
          <li>Improve our AI models and recommendation systems</li>
          <li>Create industry reports (using only aggregated, non-identifying data)</li>
        </ul>

        <h3>3.7 Legal and Safety</h3>
        <p>We may use your information to:</p>
        <ul>
          <li>Comply with legal obligations</li>
          <li>Enforce our Terms of Service</li>
          <li>Protect the rights, safety, and property of Folio, our users, and the public</li>
          <li>Detect and prevent fraud, abuse, and security incidents</li>
        </ul>
      </section>

      <section id="how-we-share-your-information">
        <h2>4. How We Share Your Information</h2>

        <h3>4.1 With Other Users</h3>
        <p>Depending on your settings and how you use the Platform:</p>
        <ul>
          <li><strong>Public Profiles:</strong> Your profile information may be visible to other users</li>
          <li><strong>Published Projects:</strong> Projects you publish are visible according to your privacy settings</li>
          <li><strong>Designer-Client Connections:</strong> If you engage with a designer or client, relevant information is shared to facilitate the relationship</li>
          <li><strong>Vendor Attribution:</strong> When you tag products in projects, vendors may see that their products were used (but not your personal details unless you choose to share them)</li>
        </ul>

        <h3>4.2 With Service Providers</h3>
        <p>We share information with third-party service providers who help us operate the Platform:</p>

        <h4>Infrastructure and Hosting:</h4>
        <ul>
          <li><strong>Supabase:</strong> Database hosting and file storage (PostgreSQL database, image storage)</li>
          <li><strong>Vercel:</strong> Application hosting and content delivery</li>
        </ul>

        <h4>AI Service Providers:</h4>
        <ul>
          <li><strong>Anthropic (Claude):</strong> We send project image URLs for classification and analysis. Anthropic processes this data to identify colors, materials, styles, and design elements. Per Anthropic&apos;s policies, API data is not used to train their models.</li>
          <li><strong>OpenAI:</strong> We send interview text, project descriptions, and prompts for editorial content generation, embeddings, and image generation. Per OpenAI&apos;s API policies, this data is not used to train their models.</li>
          <li><strong>Roboflow:</strong> We send product images for background removal and object segmentation.</li>
          <li><strong>Stability AI:</strong> We may send prompts for AI image generation (optional feature).</li>
        </ul>

        <h4>Other Service Providers:</h4>
        <ul>
          <li>Payment processors (for transactions)</li>
          <li>Email service providers (for communications)</li>
          <li>Analytics tools (for usage analysis)</li>
        </ul>
        <p>All service providers are contractually obligated to protect your information and use it only for the purposes we specify.</p>

        <h3>4.3 With Vendors (Aggregated Data)</h3>
        <p>We may share aggregated, non-personally-identifiable analytics with vendors, including:</p>
        <ul>
          <li>Trends in product engagement (e.g., &quot;brass fixtures are trending&quot;)</li>
          <li>Regional design preferences</li>
          <li>Style category performance</li>
          <li>Event-driven interest patterns</li>
        </ul>
        <p>We do not share individual user data with vendors without your consent, except as necessary to facilitate transactions you initiate.</p>

        <h3>4.4 For Legal Reasons</h3>
        <p>We may disclose your information:</p>
        <ul>
          <li>To comply with applicable laws, regulations, or legal processes</li>
          <li>To respond to lawful requests from government authorities</li>
          <li>To protect Folio&apos;s rights, privacy, safety, or property</li>
          <li>To protect the safety of our users or the public</li>
          <li>In connection with an investigation of suspected or actual illegal activity</li>
        </ul>

        <h3>4.5 Business Transfers</h3>
        <p>
          If Folio is involved in a merger, acquisition, bankruptcy, or sale of assets, your information may be transferred as part of that transaction. We will notify you of any such change and any choices you may have.
        </p>

        <h3>4.6 With Your Consent</h3>
        <p>We may share your information for other purposes with your explicit consent.</p>
      </section>

      <section id="your-rights-and-choices">
        <h2>5. Your Rights and Choices</h2>

        <h3>5.1 Access and Portability</h3>
        <p>You have the right to:</p>
        <ul>
          <li>Access the personal information we hold about you</li>
          <li>Receive a copy of your data in a portable format (JSON)</li>
        </ul>
        <p><strong>To exercise this right:</strong> Use the data export feature in your account settings or contact privacy@folioad.com. We will provide your data within 30 days.</p>

        <h3>5.2 Correction</h3>
        <p>You have the right to correct inaccurate personal information. You can update most information directly in your account settings. For other corrections, contact privacy@folioad.com.</p>

        <h3>5.3 Deletion</h3>
        <p>You have the right to request deletion of your personal information.</p>
        <p><strong>To exercise this right:</strong> Use the account deletion feature in your account settings or contact privacy@folioad.com.</p>

        <h4>What happens when you delete your account:</h4>
        <ul>
          <li>Your profile is deactivated and no longer visible</li>
          <li>Your personal information (name, email, etc.) is anonymized</li>
          <li>Your private/unpublished projects are deleted</li>
          <li>Published projects may be retained in anonymized form (attributed to &quot;Former User&quot;)</li>
          <li>Behavioral data (Atelier signals) is deleted</li>
          <li>Voice profiles and embeddings are deleted</li>
          <li>We retain certain information as required by law or for legitimate business purposes (e.g., transaction records)</li>
        </ul>

        <h3>5.4 Opt-Out of Marketing</h3>
        <p>You can opt out of marketing communications by:</p>
        <ul>
          <li>Clicking &quot;unsubscribe&quot; in any marketing email</li>
          <li>Adjusting your notification preferences in account settings</li>
          <li>Contacting privacy@folioad.com</li>
        </ul>

        <h3>5.5 Opt-Out of Behavioral Tracking</h3>
        <p>If you do not want us to build an aesthetic profile based on your behavior, you can:</p>
        <ul>
          <li>Contact privacy@folioad.com to opt out of Atelier profiling</li>
          <li>Note: This may significantly reduce the personalization and recommendation features available to you</li>
        </ul>

        <h3>5.6 Opt-Out of AI Processing</h3>
        <p>If you do not want your content processed by AI services, you can:</p>
        <ul>
          <li>Disable AI features in your account settings (where available)</li>
          <li>Contact privacy@folioad.com to request that your content not be sent to AI providers</li>
          <li>Note: This will disable AI-powered features like image classification, editorial generation, and smart recommendations</li>
        </ul>
      </section>

      <section id="california-privacy-rights">
        <h2>6. California Privacy Rights (CCPA/CPRA)</h2>
        <p>If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA) and California Privacy Rights Act (CPRA).</p>

        <h3>6.1 Right to Know</h3>
        <p>You have the right to request information about:</p>
        <ul>
          <li>The categories of personal information we collect</li>
          <li>The purposes for which we use your information</li>
          <li>The categories of third parties with whom we share your information</li>
          <li>The specific pieces of personal information we have collected about you</li>
        </ul>

        <h3>6.2 Right to Delete</h3>
        <p>You have the right to request deletion of your personal information, subject to certain exceptions.</p>

        <h3>6.3 Right to Correct</h3>
        <p>You have the right to request correction of inaccurate personal information.</p>

        <h3>6.4 Right to Opt-Out of Sale/Sharing</h3>
        <p><strong>We do not sell your personal information</strong> for monetary consideration.</p>
        <p><strong>We do not share your personal information</strong> for cross-context behavioral advertising.</p>
        <p>If this changes in the future, we will provide a &quot;Do Not Sell or Share My Personal Information&quot; link and update this policy.</p>

        <h3>6.5 Right to Limit Use of Sensitive Personal Information</h3>
        <p>You have the right to limit our use of sensitive personal information (such as professional license numbers) to what is necessary to provide the services you request.</p>

        <h3>6.6 Non-Discrimination</h3>
        <p>We will not discriminate against you for exercising your privacy rights.</p>

        <h3>6.7 Categories of Information Collected</h3>
        <p>In the preceding 12 months, we have collected the following categories of personal information:</p>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Examples</th>
                <th>Collected</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Identifiers</td>
                <td>Name, email, IP address</td>
                <td>Yes</td>
              </tr>
              <tr>
                <td>Customer Records</td>
                <td>Phone, address, payment info</td>
                <td>Yes</td>
              </tr>
              <tr>
                <td>Protected Classifications</td>
                <td>None</td>
                <td>No</td>
              </tr>
              <tr>
                <td>Commercial Information</td>
                <td>Purchase history, products viewed</td>
                <td>Yes</td>
              </tr>
              <tr>
                <td>Biometric Information</td>
                <td>Voice embeddings (with consent)</td>
                <td>Yes</td>
              </tr>
              <tr>
                <td>Internet Activity</td>
                <td>Browsing history, interactions</td>
                <td>Yes</td>
              </tr>
              <tr>
                <td>Geolocation Data</td>
                <td>City/state, IP-derived location</td>
                <td>Yes</td>
              </tr>
              <tr>
                <td>Sensory Data</td>
                <td>Photos, audio recordings</td>
                <td>Yes</td>
              </tr>
              <tr>
                <td>Professional Information</td>
                <td>License numbers, job title</td>
                <td>Yes</td>
              </tr>
              <tr>
                <td>Inferences</td>
                <td>Aesthetic preferences, style profiles</td>
                <td>Yes</td>
              </tr>
              <tr>
                <td>Sensitive Personal Information</td>
                <td>Professional credentials</td>
                <td>Yes</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>6.8 How to Exercise Your Rights</h3>
        <p>To exercise your California privacy rights:</p>
        <ul>
          <li>Email: privacy@folioad.com</li>
          <li>Use the in-app data export or deletion features</li>
          <li>We will verify your identity before processing requests</li>
          <li>You may designate an authorized agent to make requests on your behalf</li>
        </ul>
      </section>

      <section id="european-privacy-rights">
        <h2>7. European Privacy Rights (GDPR)</h2>
        <p>If you are located in the European Economic Area (EEA), United Kingdom, or Switzerland, you have additional rights under the General Data Protection Regulation (GDPR).</p>

        <h3>7.1 Legal Basis for Processing</h3>
        <p>We process your personal information based on the following legal grounds:</p>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Purpose</th>
                <th>Legal Basis</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Account creation and management</td>
                <td>Contract performance</td>
              </tr>
              <tr>
                <td>Providing Platform features</td>
                <td>Contract performance</td>
              </tr>
              <tr>
                <td>Processing transactions</td>
                <td>Contract performance</td>
              </tr>
              <tr>
                <td>Personalization and recommendations</td>
                <td>Legitimate interest</td>
              </tr>
              <tr>
                <td>Atelier behavioral profiling</td>
                <td>Consent</td>
              </tr>
              <tr>
                <td>AI processing of content</td>
                <td>Consent</td>
              </tr>
              <tr>
                <td>Marketing communications</td>
                <td>Consent</td>
              </tr>
              <tr>
                <td>Analytics and improvement</td>
                <td>Legitimate interest</td>
              </tr>
              <tr>
                <td>Security and fraud prevention</td>
                <td>Legitimate interest</td>
              </tr>
              <tr>
                <td>Legal compliance</td>
                <td>Legal obligation</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>7.2 Your Rights</h3>
        <p>Under GDPR, you have the right to:</p>
        <ul>
          <li><strong>Access:</strong> Request a copy of your personal data</li>
          <li><strong>Rectification:</strong> Correct inaccurate data</li>
          <li><strong>Erasure:</strong> Request deletion of your data (&quot;right to be forgotten&quot;)</li>
          <li><strong>Restriction:</strong> Request limitation of processing</li>
          <li><strong>Portability:</strong> Receive your data in a machine-readable format</li>
          <li><strong>Object:</strong> Object to processing based on legitimate interests</li>
          <li><strong>Withdraw Consent:</strong> Withdraw consent at any time (without affecting prior processing)</li>
          <li><strong>Automated Decision-Making:</strong> Not be subject to solely automated decisions with legal effects</li>
        </ul>

        <h3>7.3 International Data Transfers</h3>
        <p>Your information may be transferred to and processed in countries outside the EEA, including the United States, where our servers and service providers are located.</p>
        <p>When we transfer data outside the EEA, we ensure appropriate safeguards are in place:</p>
        <ul>
          <li>Standard Contractual Clauses approved by the European Commission</li>
          <li>Adequacy decisions by the European Commission</li>
          <li>Other lawful transfer mechanisms</li>
        </ul>

        <h3>7.4 Data Protection Authority</h3>
        <p>You have the right to lodge a complaint with your local data protection authority if you believe we have violated your privacy rights.</p>

        <h3>7.5 Data Protection Contact</h3>
        <p>For GDPR-related inquiries:</p>
        <ul>
          <li>Email: privacy@folioad.com</li>
        </ul>
      </section>

      <section id="data-retention">
        <h2>8. Data Retention</h2>
        <p>We retain your personal information for as long as necessary to:</p>
        <ul>
          <li>Provide services to you</li>
          <li>Comply with legal obligations</li>
          <li>Resolve disputes</li>
          <li>Enforce our agreements</li>
        </ul>

        <h3>Specific retention periods:</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Data Type</th>
                <th>Retention Period</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Account information</td>
                <td>Until account deletion + 30 days</td>
              </tr>
              <tr>
                <td>Published projects</td>
                <td>Indefinitely (may be anonymized)</td>
              </tr>
              <tr>
                <td>Unpublished projects</td>
                <td>Until account deletion</td>
              </tr>
              <tr>
                <td>Behavioral signals</td>
                <td>Until account deletion or opt-out</td>
              </tr>
              <tr>
                <td>Transaction records</td>
                <td>7 years (legal requirement)</td>
              </tr>
              <tr>
                <td>Voice profiles</td>
                <td>Until account deletion or opt-out</td>
              </tr>
              <tr>
                <td>Server logs</td>
                <td>90 days</td>
              </tr>
              <tr>
                <td>Backup data</td>
                <td>30 days after deletion</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="data-security">
        <h2>9. Data Security</h2>
        <p>We implement appropriate technical and organizational measures to protect your personal information:</p>

        <h3>Technical Measures:</h3>
        <ul>
          <li>Encryption of passwords using bcrypt hashing</li>
          <li>HTTPS encryption for all data transmission</li>
          <li>Secure, httpOnly cookies for session management</li>
          <li>Rate limiting to prevent abuse</li>
          <li>Regular security assessments</li>
        </ul>

        <h3>Organizational Measures:</h3>
        <ul>
          <li>Limited employee access to personal data</li>
          <li>Security training for personnel</li>
          <li>Incident response procedures</li>
          <li>Vendor security assessments</li>
        </ul>

        <h3>Image Upload Security:</h3>
        <p>We automatically strip EXIF metadata (including GPS coordinates) from uploaded images to protect your location privacy.</p>
        <p>Despite our efforts, no method of transmission or storage is 100% secure. If you have reason to believe your interaction with us is no longer secure, please contact us immediately.</p>
      </section>

      <section id="childrens-privacy">
        <h2>10. Children&apos;s Privacy</h2>
        <p>The Platform is not intended for children under 18 years of age. We do not knowingly collect personal information from children under 18. If you are a parent or guardian and believe your child has provided us with personal information, please contact us at privacy@folioad.com, and we will delete such information.</p>
      </section>

      <section id="third-party-links">
        <h2>11. Third-Party Links</h2>
        <p>The Platform may contain links to third-party websites, services, or applications. This Privacy Policy does not apply to those third-party services. We encourage you to read the privacy policies of any third-party services you visit.</p>
      </section>

      <section id="changes-to-policy">
        <h2>12. Changes to This Privacy Policy</h2>
        <p>We may update this Privacy Policy from time to time. We will notify you of material changes by:</p>
        <ul>
          <li>Posting the updated policy on the Platform</li>
          <li>Updating the &quot;Last Updated&quot; date</li>
          <li>Sending you an email notification (for material changes)</li>
        </ul>
        <p>Your continued use of the Platform after changes become effective constitutes acceptance of the updated policy.</p>
      </section>

      <section id="contact-us">
        <h2>13. Contact Us</h2>
        <p>If you have questions, concerns, or requests regarding this Privacy Policy or our privacy practices, please contact us:</p>
        <p><strong>Email:</strong> privacy@folioad.com</p>
        <p><strong>Response Time:</strong> We aim to respond to all privacy inquiries within 30 days.</p>
      </section>

      <section id="additional-disclosures">
        <h2>14. Additional Disclosures</h2>

        <h3>14.1 AI Training Data</h3>
        <p>
          We do not use your personal content to train our own AI models. When we send your content to third-party AI providers (Anthropic, OpenAI, Roboflow), their current API terms state that API data is not used for model training. We will update this policy if these terms change.
        </p>

        <h3>14.2 Automated Decision-Making</h3>
        <p>We use automated processing to:</p>
        <ul>
          <li>Generate recommendations and personalize your feed</li>
          <li>Classify images and detect design elements</li>
          <li>Calculate &quot;editorial scores&quot; for content curation</li>
          <li>Match clients with designers based on aesthetic alignment</li>
        </ul>
        <p>
          These automated processes help improve your experience but do not make decisions that produce legal or similarly significant effects on you. You can contact us to request human review of any automated decision.
        </p>

        <h3>14.3 Do Not Track</h3>
        <p>
          Some browsers have a &quot;Do Not Track&quot; feature. We do not currently respond to Do Not Track signals because there is no industry standard for compliance. We will update this policy if a standard is established.
        </p>
      </section>

      <hr />
      <p className="text-center text-folio-text-tertiary">
        &copy; 2026 Folio AD, LLC. All rights reserved.
      </p>
    </LegalPageLayout>
  );
}
