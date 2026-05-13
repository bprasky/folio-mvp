'use client';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <div style={{ 
      padding: '60px 20px', 
      fontFamily: 'Arial, sans-serif',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      <h1 style={{ fontSize: 'var(--type-stat)', marginBottom: '20px' }}>FOLIO MVP - Home Page</h1>
      <p style={{ fontSize: 'var(--type-h4)', lineHeight: 'var(--lh-body)', marginBottom: '20px' }}>
        This is a minimal test page to verify Next.js routing works.
      </p>
      <p style={{ fontSize: 'var(--type-h4)', lineHeight: 'var(--lh-body)', marginBottom: '30px' }}>
        If you can see this, the basic routing is working.
      </p>
      <div style={{ 
        padding: '20px', 
        backgroundColor: '#f5f5f5', 
        borderRadius: '8px',
        marginTop: '40px'
      }}>
        <h2 style={{ fontSize: 'var(--type-h4)', marginBottom: '10px' }}>Quick Links:</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ marginBottom: '10px' }}>
            <a href="/auth/signin" style={{ color: '#0066cc', textDecoration: 'none' }}>
              Sign In →
            </a>
          </li>
          <li style={{ marginBottom: '10px' }}>
            <a href="/designer" style={{ color: '#0066cc', textDecoration: 'none' }}>
              Designer Dashboard →
            </a>
          </li>
          <li style={{ marginBottom: '10px' }}>
            <a href="/vendor" style={{ color: '#0066cc', textDecoration: 'none' }}>
              Vendor Dashboard →
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}