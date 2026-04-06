import { Metadata } from 'next';
import { LegalPageLayout } from '@/components/legal/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Cookie Policy | FOLIO',
  description: 'Folio Cookie Policy - Learn how we use cookies and similar technologies on our platform.',
};

const tocItems = [
  { id: 'introduction', title: '1. Introduction', level: 1 },
  { id: 'what-are-cookies', title: '2. What Are Cookies?', level: 1 },
  { id: 'types-of-cookies', title: '3. Types of Cookies We Use', level: 1 },
  { id: 'third-party-cookies', title: '4. Third-Party Cookies', level: 1 },
  { id: 'managing-cookies', title: '5. Managing Your Cookie Preferences', level: 1 },
  { id: 'cookie-duration', title: '6. Cookie Duration', level: 1 },
  { id: 'cookies-and-privacy', title: '7. Cookies and Your Privacy', level: 1 },
  { id: 'updates', title: '8. Updates to This Policy', level: 1 },
  { id: 'regional-information', title: '9. Regional Information', level: 1 },
  { id: 'contact', title: '10. Contact Us', level: 1 },
  { id: 'cookie-summary', title: '11. Cookie Table Summary', level: 1 },
];

export default function CookiePolicyPage() {
  return (
    <LegalPageLayout
      title="Cookie Policy"
      lastUpdated="January 2026"
      effectiveDate="January 2026"
      tocItems={tocItems}
    >
      <section id="introduction">
        <h2>1. Introduction</h2>
        <p>
          This Cookie Policy explains how Folio AD, LLC (&quot;Folio,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) uses cookies and similar technologies on our platform at folioad.com (the &quot;Platform&quot;). This policy is part of our Privacy Policy.
        </p>
        <p>
          By using the Platform, you consent to our use of cookies as described in this policy. You can manage your cookie preferences as described in Section 5.
        </p>
      </section>

      <section id="what-are-cookies">
        <h2>2. What Are Cookies?</h2>
        <p>
          Cookies are small text files that are stored on your device (computer, tablet, or mobile phone) when you visit a website. They help websites remember information about your visit, making it easier for you to use the site and making the site more useful to you.
        </p>
        <p><strong>Similar technologies</strong> we may use include:</p>
        <ul>
          <li><strong>Local Storage:</strong> Browser storage that persists across sessions</li>
          <li><strong>Session Storage:</strong> Temporary browser storage cleared when you close the browser</li>
          <li><strong>Pixels/Beacons:</strong> Small images that track when content is viewed</li>
        </ul>
      </section>

      <section id="types-of-cookies">
        <h2>3. Types of Cookies We Use</h2>

        <h3>3.1 Strictly Necessary Cookies</h3>
        <p>
          These cookies are essential for the Platform to function. They enable core functionality such as security, account access, and session management. <strong>You cannot opt out of these cookies</strong> because the Platform cannot operate without them.
        </p>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Cookie Name</th>
                <th>Purpose</th>
                <th>Duration</th>
                <th>Provider</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>next-auth.session-token</code></td>
                <td>Authenticates your session and keeps you logged in</td>
                <td>Session</td>
                <td>Folio</td>
              </tr>
              <tr>
                <td><code>__Secure-next-auth.session-token</code></td>
                <td>Secure version of session cookie (production)</td>
                <td>Session</td>
                <td>Folio</td>
              </tr>
              <tr>
                <td><code>next-auth.csrf-token</code></td>
                <td>Protects against cross-site request forgery attacks</td>
                <td>Session</td>
                <td>Folio</td>
              </tr>
              <tr>
                <td><code>next-auth.callback-url</code></td>
                <td>Stores the URL to return to after authentication</td>
                <td>Session</td>
                <td>Folio</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h4>Security features of our authentication cookies:</h4>
        <ul>
          <li><code>httpOnly</code>: Cannot be accessed by JavaScript (prevents XSS attacks)</li>
          <li><code>secure</code>: Only transmitted over HTTPS (production)</li>
          <li><code>sameSite: lax</code>: Provides CSRF protection</li>
        </ul>

        <h3>3.2 Functional Cookies</h3>
        <p>These cookies enable enhanced functionality and personalization. They may be set by us or by third-party providers whose services we use.</p>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Cookie/Storage</th>
                <th>Purpose</th>
                <th>Duration</th>
                <th>Provider</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Local Storage (UI preferences)</td>
                <td>Remembers your interface preferences (e.g., collapsed panels, view settings)</td>
                <td>Persistent</td>
                <td>Folio</td>
              </tr>
              <tr>
                <td>Session Storage (filters)</td>
                <td>Temporarily stores filter and search settings</td>
                <td>Session</td>
                <td>Folio</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>3.3 Analytics Cookies</h3>
        <p>
          <strong>We currently do not use third-party analytics cookies</strong> such as Google Analytics, Facebook Pixel, or similar tracking services.
        </p>
        <p>
          We track usage patterns through our own internal systems (see &quot;Behavioral Tracking&quot; in our Privacy Policy), but this does not involve third-party analytics cookies.
        </p>
        <p><em>If we add analytics cookies in the future, we will update this policy and obtain your consent where required.</em></p>

        <h3>3.4 Advertising/Marketing Cookies</h3>
        <p><strong>We currently do not use advertising or marketing cookies.</strong> We do not engage in:</p>
        <ul>
          <li>Targeted advertising</li>
          <li>Retargeting/remarketing</li>
          <li>Cross-site behavioral tracking</li>
          <li>Sale of your data to advertisers</li>
        </ul>
        <p><em>If we add advertising cookies in the future, we will update this policy and obtain your consent.</em></p>
      </section>

      <section id="third-party-cookies">
        <h2>4. Third-Party Cookies</h2>

        <h3>4.1 Current Third-Party Cookies</h3>
        <p>We currently use the following third-party services that may set cookies:</p>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Purpose</th>
                <th>Privacy Policy</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Supabase</td>
                <td>Database and file storage</td>
                <td><a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">Supabase Privacy</a></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p><strong>Note:</strong> Supabase provides backend infrastructure and does not set user-facing tracking cookies.</p>

        <h3>4.2 Social Media Features</h3>
        <p>
          If we integrate social media features (e.g., Instagram sharing), those services may set their own cookies when you interact with them. We do not control these cookies. Please review the privacy policies of those services:
        </p>
        <ul>
          <li>Instagram: <a href="https://help.instagram.com/519522125107875" target="_blank" rel="noopener noreferrer">Instagram Privacy</a></li>
        </ul>

        <h3>4.3 Embedded Content</h3>
        <p>
          Our Platform may display embedded content (e.g., videos, maps) from third parties. When you view this content, those third parties may set cookies. We do not control these cookies.
        </p>
      </section>

      <section id="managing-cookies">
        <h2>5. Managing Your Cookie Preferences</h2>

        <h3>5.1 Browser Settings</h3>
        <p>Most web browsers allow you to control cookies through their settings. You can:</p>
        <ul>
          <li>View what cookies are stored on your device</li>
          <li>Delete all or specific cookies</li>
          <li>Block all cookies or cookies from specific sites</li>
          <li>Block third-party cookies</li>
          <li>Accept all cookies</li>
        </ul>

        <h4>How to access cookie settings:</h4>
        <ul>
          <li><strong>Chrome:</strong> Settings &rarr; Privacy and security &rarr; Cookies</li>
          <li><strong>Firefox:</strong> Settings &rarr; Privacy &amp; Security &rarr; Cookies</li>
          <li><strong>Safari:</strong> Preferences &rarr; Privacy &rarr; Cookies</li>
          <li><strong>Edge:</strong> Settings &rarr; Cookies and site permissions</li>
        </ul>
        <p><strong>Warning:</strong> Blocking or deleting essential cookies will prevent you from logging in and using the Platform.</p>

        <h3>5.2 Do Not Track</h3>
        <p>
          Some browsers have a &quot;Do Not Track&quot; (DNT) feature that signals websites not to track your activity. There is currently no industry standard for DNT, so we do not respond to DNT signals. However, since we do not use third-party tracking cookies, this has limited impact on our Platform.
        </p>

        <h3>5.3 Mobile Devices</h3>
        <p>On mobile devices, you can manage cookies and tracking through your device settings:</p>
        <ul>
          <li><strong>iOS:</strong> Settings &rarr; Safari &rarr; Privacy &amp; Security</li>
          <li><strong>Android:</strong> Chrome &rarr; Settings &rarr; Site settings &rarr; Cookies</li>
        </ul>
      </section>

      <section id="cookie-duration">
        <h2>6. Cookie Duration</h2>
        <p>Cookies can be categorized by how long they remain on your device:</p>
        <p>
          <strong>Session Cookies:</strong> These are temporary and are deleted when you close your browser. Our authentication cookies are session cookies for security.
        </p>
        <p>
          <strong>Persistent Cookies:</strong> These remain on your device until they expire or you delete them. We use persistent local storage for UI preferences.
        </p>
      </section>

      <section id="cookies-and-privacy">
        <h2>7. Cookies and Your Privacy</h2>

        <h3>7.1 What Cookies Do NOT Collect</h3>
        <p>Our cookies do not:</p>
        <ul>
          <li>Store your password (passwords are never stored in cookies)</li>
          <li>Track you across other websites</li>
          <li>Share information with advertisers</li>
          <li>Contain sensitive personal information</li>
        </ul>

        <h3>7.2 Relationship to Privacy Policy</h3>
        <p>Our use of cookies is governed by our Privacy Policy, which describes:</p>
        <ul>
          <li>How we use information collected through cookies</li>
          <li>Your rights regarding your personal information</li>
          <li>How to request deletion of your data</li>
        </ul>
      </section>

      <section id="updates">
        <h2>8. Updates to This Policy</h2>
        <p>We may update this Cookie Policy from time to time to reflect changes in:</p>
        <ul>
          <li>The cookies we use</li>
          <li>Legal or regulatory requirements</li>
          <li>Our business practices</li>
        </ul>
        <p>
          We will post any changes on this page and update the &quot;Last Updated&quot; date. For material changes, we will provide notice through the Platform or via email.
        </p>
      </section>

      <section id="regional-information">
        <h2>9. Regional Information</h2>

        <h3>9.1 European Union (GDPR)</h3>
        <p>If you are in the European Economic Area, you have rights under the General Data Protection Regulation regarding cookies:</p>
        <ul>
          <li>We must obtain your consent before setting non-essential cookies</li>
          <li>You can withdraw consent at any time</li>
          <li>You can request information about our cookie usage</li>
        </ul>
        <p>Currently, all cookies we use are strictly necessary for the Platform to function. If we add non-essential cookies, we will implement a cookie consent mechanism.</p>

        <h3>9.2 California (CCPA)</h3>
        <p>If you are a California resident:</p>
        <ul>
          <li>We do not &quot;sell&quot; personal information (including through cookies)</li>
          <li>We do not use cookies for cross-context behavioral advertising</li>
          <li>You have the right to opt out of the sale of personal information (though we do not sell)</li>
        </ul>

        <h3>9.3 United Kingdom</h3>
        <p>Our cookie practices comply with the UK GDPR and the Privacy and Electronic Communications Regulations (PECR).</p>
      </section>

      <section id="contact">
        <h2>10. Contact Us</h2>
        <p>If you have questions about our use of cookies, please contact us:</p>
        <p><strong>Email:</strong> privacy@folioad.com</p>
      </section>

      <section id="cookie-summary">
        <h2>11. Cookie Table Summary</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Cookie Name</th>
                <th>Purpose</th>
                <th>Essential?</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Authentication</td>
                <td><code>next-auth.session-token</code></td>
                <td>Keeps you logged in</td>
                <td>Yes</td>
                <td>Session</td>
              </tr>
              <tr>
                <td>Authentication</td>
                <td><code>__Secure-next-auth.session-token</code></td>
                <td>Secure session (production)</td>
                <td>Yes</td>
                <td>Session</td>
              </tr>
              <tr>
                <td>Security</td>
                <td><code>next-auth.csrf-token</code></td>
                <td>Prevents CSRF attacks</td>
                <td>Yes</td>
                <td>Session</td>
              </tr>
              <tr>
                <td>Authentication</td>
                <td><code>next-auth.callback-url</code></td>
                <td>Redirect after login</td>
                <td>Yes</td>
                <td>Session</td>
              </tr>
              <tr>
                <td>Functional</td>
                <td>Local Storage (UI state)</td>
                <td>Interface preferences</td>
                <td>No</td>
                <td>Persistent</td>
              </tr>
              <tr>
                <td>Analytics</td>
                <td><em>None currently</em></td>
                <td>&mdash;</td>
                <td>&mdash;</td>
                <td>&mdash;</td>
              </tr>
              <tr>
                <td>Advertising</td>
                <td><em>None currently</em></td>
                <td>&mdash;</td>
                <td>&mdash;</td>
                <td>&mdash;</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <hr />
      <p className="text-center text-folio-text-tertiary">
        &copy; 2026 Folio AD, LLC. All rights reserved.
      </p>
    </LegalPageLayout>
  );
}
