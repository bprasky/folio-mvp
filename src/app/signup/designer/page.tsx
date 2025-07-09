'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Globe, 
  Mail, 
  Lock, 
  Upload, 
  Sparkles, 
  CheckCircle, 
  Loader2,
  ExternalLink,
  Users,
  Image as ImageIcon,
  Tag
} from 'lucide-react';
import Image from 'next/image';

interface ScrapedData {
  about?: string;
  team?: Array<{ name: string; role: string; image?: string }>;
  projects?: Array<{
    title: string;
    description: string;
    images: string[];
    category?: string;
  }>;
  logo?: string;
  companyName?: string;
}

export default function DesignerSignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams?.get('event');
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    website: '',
    logo: null as File | null,
    acceptTerms: false
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.password) newErrors.password = 'Password is required';
    if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (!formData.website) newErrors.website = 'Website URL is required';
    if (!formData.acceptTerms) newErrors.terms = 'You must accept the terms';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleWebsiteScrape = async () => {
    if (!formData.website) return;
    
    setScraping(true);
    try {
      const response = await fetch('/api/scrape-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: formData.website,
          eventId 
        })
      });

      if (response.ok) {
        const data = await response.json();
        setScrapedData(data);
        setStep(3);
      } else {
        throw new Error('Failed to scrape website');
      }
    } catch (error) {
      console.error('Scraping error:', error);
      setStep(3);
    } finally {
      setScraping(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/auth/signup/designer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          eventId,
          scrapedData
        })
      });

      if (response.ok) {
        const { userId } = await response.json();
        router.push(`/designer/onboarding-complete?userId=${userId}`);
      } else {
        const error = await response.json();
        setErrors({ submit: error.message });
      }
    } catch (error) {
      setErrors({ submit: 'Something went wrong. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, logo: file }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-folio-background to-folio-muted flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-folio-accent mr-3" />
            <h1 className="text-3xl font-bold text-folio-text">Designer Signup</h1>
          </div>
          <p className="text-folio-border mb-4">
            {eventId ? 'Join us at the event and start earning from your portfolio!' : 'Create your designer profile in minutes'}
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 mb-2">
              <strong>New:</strong> Try our enhanced signup with automatic portfolio import!
            </p>
            <a
              href={`/signup/designer/enhanced${eventId ? `?event=${eventId}` : ''}`}
              className="inline-flex items-center text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Try Enhanced Signup
            </a>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((stepNumber) => (
            <div key={stepNumber} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= stepNumber 
                  ? 'bg-folio-accent text-white' 
                  : 'bg-folio-card text-folio-border'
              }`}>
                {step > stepNumber ? <CheckCircle className="w-4 h-4" /> : stepNumber}
              </div>
              {stepNumber < 3 && (
                <div className={`w-16 h-0.5 mx-2 ${
                  step > stepNumber ? 'bg-folio-accent' : 'bg-folio-card'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="bg-white rounded-xl shadow-sm border border-folio-border p-8">
            <h2 className="text-xl font-semibold text-folio-text mb-6">Tell us about yourself</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-folio-text mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-folio-border w-4 h-4" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="pl-10 pr-4 py-3 w-full border border-folio-border rounded-lg focus:ring-folio-accent focus:border-folio-accent"
                    placeholder="your@email.com"
                  />
                </div>
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-folio-text mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-folio-border w-4 h-4" />
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="pl-10 pr-4 py-3 w-full border border-folio-border rounded-lg focus:ring-folio-accent focus:border-folio-accent"
                    placeholder="Create a password"
                  />
                </div>
                {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-folio-text mb-2">
                  Studio Website
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-folio-border w-4 h-4" />
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                    className="pl-10 pr-4 py-3 w-full border border-folio-border rounded-lg focus:ring-folio-accent focus:border-folio-accent"
                    placeholder="https://yourstudio.com"
                  />
                </div>
                <p className="text-sm text-folio-border mt-1">
                  We'll automatically import your portfolio and team info
                </p>
                {errors.website && <p className="text-red-500 text-sm mt-1">{errors.website}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-folio-text mb-2">
                  Studio Logo (Optional)
                </label>
                <div className="border-2 border-dashed border-folio-border rounded-lg p-6 text-center">
                  <Upload className="w-8 h-8 text-folio-border mx-auto mb-2" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    id="logo-upload"
                  />
                  <label htmlFor="logo-upload" className="cursor-pointer">
                    <span className="text-folio-accent hover:text-opacity-80">
                      Click to upload
                    </span>
                    <span className="text-folio-border"> or drag and drop</span>
                  </label>
                  {formData.logo && (
                    <p className="text-sm text-folio-text mt-2">{formData.logo.name}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="terms"
                  checked={formData.acceptTerms}
                  onChange={(e) => setFormData(prev => ({ ...prev, acceptTerms: e.target.checked }))}
                  className="mt-1 mr-3"
                />
                <label htmlFor="terms" className="text-sm text-folio-text">
                  I agree to the{' '}
                  <a href="/terms" className="text-folio-accent hover:underline">Terms of Service</a>
                  {' '}and{' '}
                  <a href="/privacy" className="text-folio-accent hover:underline">Privacy Policy</a>
                </label>
              </div>
              {errors.terms && <p className="text-red-500 text-sm">{errors.terms}</p>}

              <button
                onClick={() => setStep(2)}
                className="w-full bg-folio-accent text-white py-3 rounded-lg hover:bg-opacity-90 transition-colors font-medium"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Website Scraping */}
        {step === 2 && (
          <div className="bg-white rounded-xl shadow-sm border border-folio-border p-8">
            <h2 className="text-xl font-semibold text-folio-text mb-6">Importing your portfolio</h2>
            
            <div className="text-center">
              <div className="mb-6">
                <Globe className="w-16 h-16 text-folio-accent mx-auto mb-4" />
                <h3 className="text-lg font-medium text-folio-text mb-2">
                  Analyzing your website
                </h3>
                <p className="text-folio-border mb-4">
                  We're scanning {formData.website} to import your portfolio and team information
                </p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-center space-x-3">
                  <Loader2 className="w-5 h-5 text-folio-accent animate-spin" />
                  <span className="text-folio-text">Extracting portfolio images...</span>
                </div>
                <div className="flex items-center justify-center space-x-3">
                  <Loader2 className="w-5 h-5 text-folio-accent animate-spin" />
                  <span className="text-folio-text">Finding team information...</span>
                </div>
                <div className="flex items-center justify-center space-x-3">
                  <Loader2 className="w-5 h-5 text-folio-accent animate-spin" />
                  <span className="text-folio-text">Generating project descriptions...</span>
                </div>
              </div>

              <button
                onClick={handleWebsiteScrape}
                disabled={scraping}
                className="bg-folio-accent text-white px-6 py-3 rounded-lg hover:bg-opacity-90 transition-colors font-medium disabled:opacity-50"
              >
                {scraping ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                    Importing...
                  </>
                ) : (
                  'Start Import'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Preview & Complete */}
        {step === 3 && (
          <div className="bg-white rounded-xl shadow-sm border border-folio-border p-8">
            <h2 className="text-xl font-semibold text-folio-text mb-6">Review your profile</h2>
            
            {scrapedData && (
              <div className="space-y-6 mb-8">
                {/* About Section */}
                {scrapedData.about && (
                  <div>
                    <h3 className="text-lg font-medium text-folio-text mb-2">About Your Studio</h3>
                    <p className="text-folio-text bg-folio-muted p-4 rounded-lg">
                      {scrapedData.about}
                    </p>
                  </div>
                )}

                {/* Team Section */}
                {scrapedData.team && scrapedData.team.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-folio-text mb-2">Team Members</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {scrapedData.team.map((member, index) => (
                        <div key={index} className="flex items-center space-x-3 bg-folio-muted p-3 rounded-lg">
                          {member.image && (
                            <Image
                              src={member.image}
                              alt={member.name}
                              width={40}
                              height={40}
                              className="rounded-full"
                            />
                          )}
                          <div>
                            <p className="font-medium text-folio-text">{member.name}</p>
                            <p className="text-sm text-folio-border">{member.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Projects Section */}
                {scrapedData.projects && scrapedData.projects.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-folio-text mb-2">Portfolio Projects</h3>
                    <div className="space-y-4">
                      {scrapedData.projects.slice(0, 3).map((project, index) => (
                        <div key={index} className="border border-folio-border rounded-lg p-4">
                          <h4 className="font-medium text-folio-text mb-2">{project.title}</h4>
                          <p className="text-sm text-folio-border mb-3">{project.description}</p>
                          {project.images.length > 0 && (
                            <div className="flex space-x-2">
                              {project.images.slice(0, 3).map((image, imgIndex) => (
                                <Image
                                  key={imgIndex}
                                  src={image}
                                  alt={`${project.title} image`}
                                  width={60}
                                  height={60}
                                  className="rounded object-cover"
                                />
                              ))}
                              {project.images.length > 3 && (
                                <div className="w-15 h-15 bg-folio-muted rounded flex items-center justify-center text-xs text-folio-border">
                                  +{project.images.length - 3}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      {scrapedData.projects.length > 3 && (
                        <p className="text-sm text-folio-border">
                          And {scrapedData.projects.length - 3} more projects...
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="bg-folio-accent bg-opacity-10 border border-folio-accent rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <Tag className="w-5 h-5 text-folio-accent mt-0.5" />
                <div>
                  <h4 className="font-medium text-folio-text mb-1">Next Step: Start Tagging</h4>
                  <p className="text-sm text-folio-border">
                    Once you complete signup, you can start tagging products in your portfolio to begin earning commissions.
                  </p>
                </div>
              </div>
            </div>

            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-600 text-sm">{errors.submit}</p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-folio-accent text-white py-3 rounded-lg hover:bg-opacity-90 transition-colors font-medium disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                  Creating your profile...
                </>
              ) : (
                'Complete Signup'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 