import { Metadata } from 'next';
import { LegalPageLayout } from '@/components/legal/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Terms of Service | FOLIO',
  description: 'Folio Terms of Service - The terms and conditions governing your use of the Folio platform.',
};

const tocItems = [
  { id: 'introduction', title: '1. Introduction and Acceptance', level: 1 },
  { id: 'description', title: '2. Description of the Platform', level: 1 },
  { id: 'user-accounts', title: '3. User Accounts', level: 1 },
  { id: 'user-conduct', title: '4. User Conduct', level: 1 },
  { id: 'user-content', title: '5. User Content', level: 1 },
  { id: 'intellectual-property', title: '6. Intellectual Property', level: 1 },
  { id: 'marketplace', title: '7. Marketplace and Transactions', level: 1 },
  { id: 'subscriptions', title: '8. Subscriptions and Payments', level: 1 },
  { id: 'events', title: '9. Events', level: 1 },
  { id: 'disclaimers', title: '10. Disclaimers', level: 1 },
  { id: 'limitation-of-liability', title: '11. Limitation of Liability', level: 1 },
  { id: 'indemnification', title: '12. Indemnification', level: 1 },
  { id: 'dispute-resolution', title: '13. Dispute Resolution', level: 1 },
  { id: 'termination', title: '14. Termination', level: 1 },
  { id: 'general-provisions', title: '15. General Provisions', level: 1 },
  { id: 'contact', title: '16. Contact Information', level: 1 },
];

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      lastUpdated="January 2026"
      effectiveDate="January 2026"
      tocItems={tocItems}
    >
      <section id="introduction">
        <h2>1. Introduction and Acceptance</h2>

        <h3>1.1 Agreement to Terms</h3>
        <p>
          These Terms of Service (&quot;Terms&quot;) constitute a legally binding agreement between you (&quot;User,&quot; &quot;you,&quot; or &quot;your&quot;) and Folio AD, LLC (&quot;Folio,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) governing your access to and use of the Folio platform, including our website at folioad.com, mobile applications, and related services (collectively, the &quot;Platform&quot;).
        </p>
        <p>
          <strong>By accessing or using the Platform, you agree to be bound by these Terms.</strong> If you do not agree to these Terms, you may not access or use the Platform.
        </p>

        <h3>1.2 Eligibility</h3>
        <p>To use the Platform, you must:</p>
        <ul>
          <li>Be at least 18 years of age</li>
          <li>Have the legal capacity to enter into a binding agreement</li>
          <li>Not be prohibited from using the Platform under applicable law</li>
        </ul>
        <p>If you are using the Platform on behalf of a company or organization, you represent that you have authority to bind that entity to these Terms.</p>

        <h3>1.3 Additional Terms</h3>
        <p>Certain features of the Platform may be subject to additional terms and conditions, including:</p>
        <ul>
          <li>Vendor Agreement (for vendor accounts)</li>
          <li>Designer Program Terms (for verified designers)</li>
          <li>Event Terms (for event participation)</li>
          <li>Marketplace Terms (for transactions)</li>
        </ul>
        <p>Such additional terms are incorporated into these Terms by reference.</p>
      </section>

      <section id="description">
        <h2>2. Description of the Platform</h2>

        <h3>2.1 What Folio Is</h3>
        <p>Folio is a professional platform for the interior design industry that enables:</p>
        <ul>
          <li><strong>Designers</strong> to create portfolios, manage projects, publish editorial content, and connect with vendors and clients</li>
          <li><strong>Vendors</strong> to showcase products, gain attribution insights, and connect with designers</li>
          <li><strong>Individuals</strong> to discover design inspiration, find designers, and explore shoppable content</li>
        </ul>

        <h3>2.2 What Folio Is Not</h3>
        <p>Folio is not:</p>
        <ul>
          <li>A general social media platform</li>
          <li>An employer of designers or vendors</li>
          <li>A party to transactions between users</li>
          <li>A guarantor of any user&apos;s work, products, or services</li>
          <li>A licensed design firm, contractor, or professional services provider</li>
        </ul>

        <h3>2.3 Platform Role</h3>
        <p>Folio provides technology infrastructure to connect users. We do not:</p>
        <ul>
          <li>Employ or control designers, vendors, or other users</li>
          <li>Guarantee the quality, safety, or legality of any services or products</li>
          <li>Guarantee that any transaction will be completed</li>
          <li>Mediate or resolve disputes between users (except as required by law)</li>
        </ul>
      </section>

      <section id="user-accounts">
        <h2>3. User Accounts</h2>

        <h3>3.1 Account Registration</h3>
        <p>To access most features of the Platform, you must create an account. When registering, you agree to:</p>
        <ul>
          <li>Provide accurate, current, and complete information</li>
          <li>Maintain and promptly update your account information</li>
          <li>Keep your password secure and confidential</li>
          <li>Accept responsibility for all activity under your account</li>
          <li>Notify us immediately of any unauthorized access</li>
        </ul>

        <h3>3.2 Account Types</h3>
        <p>The Platform offers different account types:</p>
        <ul>
          <li><strong>Designer Accounts:</strong> For interior designers, architects, and design professionals</li>
          <li><strong>Vendor Accounts:</strong> For manufacturers, suppliers, showrooms, and product vendors</li>
          <li><strong>Individual Accounts:</strong> For homeowners, clients, and design enthusiasts</li>
          <li><strong>Organization Accounts:</strong> For design firms, studios, and vendor organizations</li>
        </ul>

        <h3>3.3 Account Verification</h3>
        <p>Certain account types require verification:</p>
        <ul>
          <li><strong>Designer Verification:</strong> We may require proof of professional practice (e.g., business license, portfolio, client references)</li>
          <li><strong>Architect Verification:</strong> We may require professional license information</li>
          <li><strong>Vendor Verification:</strong> We may require business registration documentation</li>
        </ul>
        <p>We reserve the right to approve, reject, or revoke verification status at our discretion.</p>

        <h3>3.4 Account Approval</h3>
        <p>Some account types require approval before full access is granted. During the approval process:</p>
        <ul>
          <li>Your account may be in &quot;pending&quot; status with limited functionality</li>
          <li>We may request additional information</li>
          <li>We may approve or reject your application at our discretion</li>
          <li>Rejection does not entitle you to an explanation (though we may provide one)</li>
        </ul>

        <h3>3.5 One Account Per Person</h3>
        <p>You may maintain only one personal account. Organizations may maintain one organization account. Creating multiple accounts to circumvent restrictions or abuse the Platform is prohibited.</p>
      </section>

      <section id="user-conduct">
        <h2>4. User Conduct</h2>

        <h3>4.1 Acceptable Use</h3>
        <p>You agree to use the Platform only for lawful purposes and in accordance with these Terms. You agree NOT to:</p>

        <h4>Content Violations:</h4>
        <ul>
          <li>Post false, misleading, or deceptive content</li>
          <li>Impersonate any person or entity</li>
          <li>Post content that infringes intellectual property rights</li>
          <li>Post content that is defamatory, obscene, or offensive</li>
          <li>Post content that promotes illegal activity</li>
        </ul>

        <h4>Platform Abuse:</h4>
        <ul>
          <li>Attempt to gain unauthorized access to any part of the Platform</li>
          <li>Use automated tools to scrape, crawl, or extract data (except as permitted)</li>
          <li>Interfere with or disrupt the Platform&apos;s operation</li>
          <li>Circumvent any security measures or access restrictions</li>
          <li>Use the Platform for spam, phishing, or malicious purposes</li>
        </ul>

        <h4>Professional Conduct:</h4>
        <ul>
          <li>Misrepresent your qualifications, credentials, or experience</li>
          <li>Engage in harassment, discrimination, or bullying</li>
          <li>Solicit users for competing platforms</li>
          <li>Engage in price fixing or anti-competitive behavior</li>
          <li>Manipulate reviews, ratings, or engagement metrics</li>
        </ul>

        <h4>Prohibited Topics:</h4>
        <ul>
          <li>Political campaigning or partisan content</li>
          <li>Content unrelated to interior design (no fashion, healthcare, etc.)</li>
          <li>Multi-level marketing or pyramid schemes</li>
          <li>Adult or sexually explicit content</li>
        </ul>

        <h3>4.2 Professional Standards</h3>
        <p>If you are a Designer or Vendor, you additionally agree to:</p>
        <ul>
          <li>Maintain appropriate professional licenses (where required by law)</li>
          <li>Provide honest and accurate information about your services and products</li>
          <li>Respond to client inquiries in a timely and professional manner</li>
          <li>Honor commitments made through the Platform</li>
          <li>Comply with all applicable professional regulations and standards</li>
        </ul>

        <h3>4.3 Enforcement</h3>
        <p>We reserve the right to:</p>
        <ul>
          <li>Remove or disable content that violates these Terms</li>
          <li>Suspend or terminate accounts for violations</li>
          <li>Report illegal activity to law enforcement</li>
          <li>Take legal action for serious violations</li>
        </ul>
      </section>

      <section id="user-content">
        <h2>5. User Content</h2>

        <h3>5.1 Your Content</h3>
        <p>&quot;User Content&quot; includes all content you submit, post, or transmit through the Platform, including:</p>
        <ul>
          <li>Profile information and photos</li>
          <li>Project images and descriptions</li>
          <li>Product information and specifications</li>
          <li>Interview responses and editorial contributions</li>
          <li>Comments, messages, and communications</li>
          <li>Audio and video recordings</li>
        </ul>

        <h3>5.2 Ownership of Your Content</h3>
        <p><strong>You retain ownership of your User Content.</strong> We do not claim ownership of the content you create and share on the Platform.</p>

        <h3>5.3 License to Folio</h3>
        <p>By submitting User Content, you grant Folio a worldwide, non-exclusive, royalty-free, sublicensable, and transferable license to:</p>
        <ul>
          <li>Host, store, and display your content on the Platform</li>
          <li>Reproduce and distribute your content as part of the Platform&apos;s functionality</li>
          <li>Modify your content for technical purposes (e.g., formatting, compression)</li>
          <li>Use your content to promote the Platform (e.g., featuring projects in marketing)</li>
          <li>Create derivative works using AI (e.g., generating editorial content from your interviews)</li>
          <li>Analyze your content to improve our services and recommendations</li>
        </ul>
        <p><strong>This license continues for as long as your content remains on the Platform</strong> and for a reasonable period after removal (to account for backups and cached copies).</p>
        <p><strong>For published/public content:</strong> If you publish a project publicly, you grant us additional rights to feature, promote, and distribute that content, including in editorial features, social media, and marketing materials.</p>

        <h3>5.4 AI Processing of Your Content</h3>
        <p>You acknowledge and consent that your User Content may be processed by artificial intelligence systems to:</p>
        <ul>
          <li>Classify images and detect design elements, colors, materials, and styles</li>
          <li>Generate editorial content, captions, and descriptions</li>
          <li>Create embeddings for search and recommendations</li>
          <li>Build your aesthetic profile for personalization</li>
          <li>Generate derivative images (e.g., cutouts, variations)</li>
        </ul>
        <p>This processing may involve sending your content to third-party AI service providers (Anthropic, OpenAI, Roboflow, Stability AI). See our Privacy Policy for details.</p>
        <p><strong>You may opt out of AI processing</strong> by contacting privacy@folioad.com, but this will disable AI-powered features for your account.</p>

        <h3>5.5 Ownership of AI-Generated Content</h3>
        <p>Content generated by AI based on your inputs (e.g., editorial drafts, image classifications) is owned as follows:</p>
        <ul>
          <li><strong>AI-generated text</strong> (e.g., editorial drafts): You own the output and may edit, publish, or delete it</li>
          <li><strong>AI classifications and tags:</strong> Folio owns the metadata and may use it to improve the Platform</li>
          <li><strong>AI-generated images:</strong> Subject to the terms of the AI provider; generally, you may use outputs for any purpose</li>
        </ul>

        <h3>5.6 Content Representations</h3>
        <p>By submitting User Content, you represent and warrant that:</p>
        <ul>
          <li>You own the content or have the right to submit it</li>
          <li>The content does not infringe any third party&apos;s intellectual property rights</li>
          <li>The content does not violate any person&apos;s privacy or publicity rights</li>
          <li>The content is accurate and not misleading</li>
          <li>You have obtained necessary releases for any identifiable individuals in photos</li>
        </ul>

        <h3>5.7 Content Removal</h3>
        <p>You may remove your User Content at any time through the Platform&apos;s features or by contacting us. However:</p>
        <ul>
          <li>Cached or archived copies may persist temporarily</li>
          <li>Content shared by other users may remain</li>
          <li>Content in completed transactions may be retained as records</li>
          <li>We may retain anonymized versions of published content</li>
        </ul>

        <h3>5.8 Folio&apos;s Right to Remove Content</h3>
        <p>We reserve the right to remove or disable any User Content that:</p>
        <ul>
          <li>Violates these Terms</li>
          <li>Is subject to a valid legal complaint (e.g., copyright takedown)</li>
          <li>We determine is harmful to the Platform or other users</li>
          <li>Is abandoned (e.g., from deleted accounts)</li>
        </ul>
      </section>

      <section id="intellectual-property">
        <h2>6. Intellectual Property</h2>

        <h3>6.1 Folio&apos;s Intellectual Property</h3>
        <p>The Platform, including its design, features, content, software, algorithms, and technology, is owned by Folio and protected by intellectual property laws. This includes:</p>
        <ul>
          <li>The Folio name, logo, and branding</li>
          <li>The Atelier recommendation system</li>
          <li>Platform software and code</li>
          <li>Original content created by Folio</li>
          <li>Aggregated data and analytics</li>
        </ul>
        <p>You may not copy, modify, distribute, sell, or lease any part of the Platform without our written permission.</p>

        <h3>6.2 Trademarks</h3>
        <p>&quot;Folio,&quot; &quot;Folio AD,&quot; &quot;Atelier,&quot; and our logos are trademarks of Folio AD, LLC. You may not use our trademarks without prior written permission, except:</p>
        <ul>
          <li>To accurately describe your use of the Platform</li>
          <li>As permitted by trademark fair use doctrines</li>
        </ul>

        <h3>6.3 Feedback</h3>
        <p>If you provide feedback, suggestions, or ideas about the Platform (&quot;Feedback&quot;), you grant us a perpetual, irrevocable, royalty-free license to use that Feedback for any purpose without compensation or attribution to you.</p>

        <h3>6.4 Copyright Infringement (DMCA)</h3>
        <p>We respect intellectual property rights and respond to valid notices of alleged copyright infringement under the Digital Millennium Copyright Act (DMCA).</p>
        <p><strong>To submit a DMCA takedown notice,</strong> send the following to our designated agent:</p>
        <ul>
          <li>Identification of the copyrighted work</li>
          <li>Identification of the infringing material and its location</li>
          <li>Your contact information</li>
          <li>A statement of good faith belief that the use is not authorized</li>
          <li>A statement under penalty of perjury that your notice is accurate</li>
          <li>Your physical or electronic signature</li>
        </ul>
        <p><strong>DMCA Agent:</strong></p>
        <p>Folio AD, LLC<br />Email: dmca@folioad.com</p>
        <p><strong>Counter-Notification:</strong> If you believe your content was wrongly removed, you may submit a counter-notification with the required information under the DMCA.</p>
      </section>

      <section id="marketplace">
        <h2>7. Marketplace and Transactions</h2>

        <h3>7.1 Designer-Client Relationships</h3>
        <p>The Platform may facilitate connections between designers and clients. When engaging through Folio:</p>
        <ul>
          <li><strong>Folio is not a party to any agreement</strong> between designers and clients</li>
          <li>Designers and clients are responsible for their own contracts and terms</li>
          <li>Folio does not guarantee the quality, completion, or outcome of any project</li>
          <li>Fees charged by designers are set by the designer, not Folio</li>
        </ul>

        <h3>7.2 Product Information</h3>
        <p>Product information on the Platform (prices, availability, specifications) is provided by vendors or sourced from public information. Folio does not guarantee:</p>
        <ul>
          <li>Accuracy of product information</li>
          <li>Availability of products</li>
          <li>Pricing (which may change without notice)</li>
          <li>Compatibility or suitability for any purpose</li>
        </ul>

        <h3>7.3 Affiliate and Referral Programs</h3>
        <p>Designers may earn commissions or credits through affiliate programs when users purchase products they recommend. By participating:</p>
        <ul>
          <li>You agree to disclose affiliate relationships as required by law (FTC guidelines)</li>
          <li>Folio may display affiliate disclosures on your behalf</li>
          <li>Commission rates and terms are subject to change</li>
          <li>Folio is not responsible for vendor payment of commissions</li>
        </ul>

        <h3>7.4 Folio Credits</h3>
        <p>The Platform may offer a credit system for transactions. Folio Credits:</p>
        <ul>
          <li>Have no cash value and cannot be redeemed for cash</li>
          <li>May expire as specified in program terms</li>
          <li>Are non-transferable (except as permitted)</li>
          <li>May be forfeited upon account termination for cause</li>
        </ul>

        <h3>7.5 Vendor Trade Accounts</h3>
        <p>Vendors may provide trade portal credentials for integration purposes. By providing credentials:</p>
        <ul>
          <li>You authorize Folio to access your trade portals on your behalf</li>
          <li>You represent you have authority to share these credentials</li>
          <li>Folio will store credentials securely (encrypted)</li>
          <li>Folio is not responsible for changes to third-party portal access</li>
        </ul>
      </section>

      <section id="subscriptions">
        <h2>8. Subscriptions and Payments</h2>

        <h3>8.1 Subscription Tiers</h3>
        <p>The Platform offers various subscription tiers with different features and pricing. Current tiers include:</p>
        <ul>
          <li><strong>Free:</strong> Basic features with limitations</li>
          <li><strong>Pro:</strong> Enhanced features for professionals</li>
          <li><strong>Studio:</strong> Team and collaboration features</li>
        </ul>

        <h3>8.2 Billing</h3>
        <p>For paid subscriptions:</p>
        <ul>
          <li>You authorize us to charge your payment method on a recurring basis</li>
          <li>Subscription fees are billed in advance (monthly or annually)</li>
          <li>All fees are non-refundable except as required by law</li>
          <li>You are responsible for applicable taxes</li>
        </ul>

        <h3>8.3 Price Changes</h3>
        <p>We may change subscription prices with 30 days&apos; notice. Price changes take effect at your next billing cycle. Continued use after a price change constitutes acceptance.</p>

        <h3>8.4 Cancellation</h3>
        <p>You may cancel your subscription at any time through account settings. Upon cancellation:</p>
        <ul>
          <li>You retain access until the end of your current billing period</li>
          <li>No refunds are provided for partial periods</li>
          <li>Your account reverts to Free tier features</li>
          <li>Your content remains accessible (subject to storage limits)</li>
        </ul>
      </section>

      <section id="events">
        <h2>9. Events</h2>

        <h3>9.1 Event Listings</h3>
        <p>The Platform may feature events related to interior design. Event information is provided by event organizers and Folio does not guarantee:</p>
        <ul>
          <li>Accuracy of event details</li>
          <li>That events will occur as scheduled</li>
          <li>Safety or quality of events</li>
          <li>Availability of space or tickets</li>
        </ul>

        <h3>9.2 RSVP and Attendance</h3>
        <p>When you RSVP to an event through Folio:</p>
        <ul>
          <li>Your attendance information may be shared with event organizers</li>
          <li>You agree to the event organizer&apos;s terms and policies</li>
          <li>Folio is not responsible for event cancellations or changes</li>
        </ul>

        <h3>9.3 Folio-Hosted Events</h3>
        <p>For events hosted or sponsored by Folio:</p>
        <ul>
          <li>Attendance may be recorded (photos, video)</li>
          <li>You grant us the right to use your likeness in event coverage</li>
          <li>You agree to our event code of conduct</li>
        </ul>
      </section>

      <section id="disclaimers">
        <h2>10. Disclaimers</h2>

        <h3>10.1 &quot;As Is&quot; Provision</h3>
        <p>THE PLATFORM IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:</p>
        <ul>
          <li>WARRANTIES OF MERCHANTABILITY</li>
          <li>FITNESS FOR A PARTICULAR PURPOSE</li>
          <li>NON-INFRINGEMENT</li>
          <li>ACCURACY OR COMPLETENESS OF CONTENT</li>
          <li>UNINTERRUPTED OR ERROR-FREE OPERATION</li>
        </ul>

        <h3>10.2 No Professional Advice</h3>
        <p>Content on the Platform is for informational purposes only and does not constitute:</p>
        <ul>
          <li>Professional design advice</li>
          <li>Legal, financial, or tax advice</li>
          <li>Endorsement of any designer, vendor, or product</li>
          <li>Guarantee of any outcome</li>
        </ul>
        <p>You should consult appropriate professionals for specific advice.</p>

        <h3>10.3 Third-Party Content</h3>
        <p>We do not control and are not responsible for:</p>
        <ul>
          <li>User Content posted by other users</li>
          <li>Products or services offered by vendors</li>
          <li>Third-party websites linked from the Platform</li>
          <li>Actions or omissions of other users</li>
        </ul>

        <h3>10.4 AI Limitations</h3>
        <p>AI-powered features are provided for convenience and may:</p>
        <ul>
          <li>Produce inaccurate or incomplete results</li>
          <li>Not reflect current information</li>
          <li>Require human review and verification</li>
          <li>Change or be discontinued without notice</li>
        </ul>
      </section>

      <section id="limitation-of-liability">
        <h2>11. Limitation of Liability</h2>

        <h3>11.1 Liability Cap</h3>
        <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, FOLIO&apos;S TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING FROM OR RELATED TO THESE TERMS OR THE PLATFORM SHALL NOT EXCEED:</p>
        <ul>
          <li>THE AMOUNTS YOU PAID TO FOLIO IN THE 12 MONTHS PRECEDING THE CLAIM, OR</li>
          <li>$100 USD, WHICHEVER IS GREATER</li>
        </ul>

        <h3>11.2 Exclusion of Damages</h3>
        <p>FOLIO SHALL NOT BE LIABLE FOR ANY:</p>
        <ul>
          <li>INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES</li>
          <li>LOSS OF PROFITS, REVENUE, OR DATA</li>
          <li>BUSINESS INTERRUPTION</li>
          <li>COST OF SUBSTITUTE SERVICES</li>
          <li>DAMAGES RESULTING FROM UNAUTHORIZED ACCESS TO YOUR ACCOUNT</li>
        </ul>

        <h3>11.3 Exceptions</h3>
        <p>These limitations do not apply to:</p>
        <ul>
          <li>Folio&apos;s gross negligence or willful misconduct</li>
          <li>Liability that cannot be limited by law</li>
          <li>Claims arising from Folio&apos;s breach of confidentiality obligations</li>
        </ul>

        <h3>11.4 Basis of the Bargain</h3>
        <p>You acknowledge that these limitations reflect a reasonable allocation of risk and are a fundamental basis of the bargain between you and Folio.</p>
      </section>

      <section id="indemnification">
        <h2>12. Indemnification</h2>
        <p>You agree to indemnify, defend, and hold harmless Folio, its affiliates, officers, directors, employees, and agents from any claims, damages, losses, liabilities, costs, and expenses (including attorneys&apos; fees) arising from:</p>
        <ul>
          <li>Your use of the Platform</li>
          <li>Your User Content</li>
          <li>Your violation of these Terms</li>
          <li>Your violation of any third party&apos;s rights</li>
          <li>Your professional services or products (for Designers and Vendors)</li>
          <li>Any dispute between you and another user</li>
        </ul>
      </section>

      <section id="dispute-resolution">
        <h2>13. Dispute Resolution</h2>

        <h3>13.1 Informal Resolution</h3>
        <p>Before filing any claim, you agree to attempt informal resolution by contacting us at legal@folioad.com. We will attempt to resolve your concern within 30 days.</p>

        <h3>13.2 Arbitration Agreement</h3>
        <p><strong>Any dispute, claim, or controversy arising from or relating to these Terms or the Platform shall be resolved by binding arbitration</strong> rather than in court, except:</p>
        <ul>
          <li>Small claims court actions (if eligible)</li>
          <li>Injunctive relief for intellectual property violations</li>
          <li>Claims that cannot be arbitrated by law</li>
        </ul>

        <h3>13.3 Arbitration Procedures</h3>
        <p>Arbitration shall be conducted by:</p>
        <ul>
          <li><strong>Administrator:</strong> JAMS or AAA</li>
          <li><strong>Rules:</strong> Streamlined Arbitration Rules / Consumer Arbitration Rules</li>
          <li><strong>Location:</strong> Remote at your election</li>
          <li><strong>Language:</strong> English</li>
        </ul>

        <h3>13.4 Class Action Waiver</h3>
        <p><strong>YOU AGREE TO RESOLVE DISPUTES ONLY ON AN INDIVIDUAL BASIS AND WAIVE ANY RIGHT TO PARTICIPATE IN CLASS ACTIONS, CLASS ARBITRATIONS, OR REPRESENTATIVE ACTIONS.</strong></p>

        <h3>13.5 Opt-Out of Arbitration</h3>
        <p>You may opt out of arbitration by sending written notice to legal@folioad.com within 30 days of first accepting these Terms. The notice must include your name, address, and a clear statement opting out.</p>

        <h3>13.6 Governing Law</h3>
        <p>These Terms are governed by the laws of the State of Delaware, without regard to conflict of law principles.</p>

        <h3>13.7 Venue</h3>
        <p>For any claims not subject to arbitration, you consent to exclusive jurisdiction in the state and federal courts located in Delaware.</p>
      </section>

      <section id="termination">
        <h2>14. Termination</h2>

        <h3>14.1 Termination by You</h3>
        <p>You may terminate your account at any time by:</p>
        <ul>
          <li>Using the account deletion feature in settings</li>
          <li>Contacting support@folioad.com</li>
        </ul>

        <h3>14.2 Termination by Folio</h3>
        <p>We may suspend or terminate your account immediately if you:</p>
        <ul>
          <li>Violate these Terms</li>
          <li>Engage in fraudulent or illegal activity</li>
          <li>Pose a risk to other users or the Platform</li>
          <li>Fail to pay applicable fees</li>
        </ul>
        <p>We may also terminate your account for any reason with 30 days&apos; notice.</p>

        <h3>14.3 Effect of Termination</h3>
        <p>Upon termination:</p>
        <ul>
          <li>Your right to access the Platform ceases immediately</li>
          <li>You remain liable for obligations incurred before termination</li>
          <li>Provisions that by nature should survive will survive (e.g., indemnification, limitation of liability, dispute resolution)</li>
          <li>We may retain your data as described in our Privacy Policy</li>
        </ul>

        <h3>14.4 Data After Termination</h3>
        <p>Following termination:</p>
        <ul>
          <li>We will delete your personal data as described in our Privacy Policy</li>
          <li>Published content may be retained in anonymized form</li>
          <li>Transaction records may be retained as required by law</li>
        </ul>
      </section>

      <section id="general-provisions">
        <h2>15. General Provisions</h2>

        <h3>15.1 Entire Agreement</h3>
        <p>These Terms, together with our Privacy Policy and any additional terms, constitute the entire agreement between you and Folio regarding the Platform.</p>

        <h3>15.2 Amendments</h3>
        <p>We may modify these Terms at any time by posting the revised Terms on the Platform. Material changes will be communicated via email or Platform notification. Continued use after changes constitutes acceptance.</p>

        <h3>15.3 Waiver</h3>
        <p>Our failure to enforce any provision of these Terms does not waive our right to enforce it later. A waiver must be in writing to be effective.</p>

        <h3>15.4 Severability</h3>
        <p>If any provision of these Terms is found unenforceable, the remaining provisions remain in effect. The unenforceable provision will be modified to the minimum extent necessary to make it enforceable.</p>

        <h3>15.5 Assignment</h3>
        <p>You may not assign your rights or obligations under these Terms without our written consent. We may assign our rights and obligations without restriction.</p>

        <h3>15.6 No Third-Party Beneficiaries</h3>
        <p>These Terms do not create any third-party beneficiary rights.</p>

        <h3>15.7 Force Majeure</h3>
        <p>Neither party is liable for delays or failures due to causes beyond reasonable control, including natural disasters, war, terrorism, labor disputes, or government actions.</p>

        <h3>15.8 Notices</h3>
        <p>We may send notices to you via:</p>
        <ul>
          <li>Email to your registered address</li>
          <li>In-app notifications</li>
          <li>Posting on the Platform</li>
        </ul>
        <p>Notices to Folio must be sent to legal@folioad.com.</p>

        <h3>15.9 Relationship</h3>
        <p>Nothing in these Terms creates a partnership, joint venture, employment, or agency relationship between you and Folio.</p>
      </section>

      <section id="contact">
        <h2>16. Contact Information</h2>
        <p>If you have questions about these Terms, please contact us:</p>
        <p><strong>Folio AD, LLC</strong></p>
        <p>Email: legal@folioad.com</p>
        <p>Support: support@folioad.com</p>
      </section>

      <hr />
      <p className="text-center text-folio-text-tertiary">
        &copy; 2026 Folio AD, LLC. All rights reserved.
      </p>
    </LegalPageLayout>
  );
}
