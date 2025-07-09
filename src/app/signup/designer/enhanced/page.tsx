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
  ArrowRight,
  Image as ImageIcon,
  Users,
  Tag,
  Eye,
  EyeOff
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

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

export default function EnhancedDesignerSignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams?.get('event');
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
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
    setErrors({}); // Clear previous errors
    
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

      const data = await response.json();

      if (response.ok) {
        const { userId } = data;
        router.push(`/designer/onboarding-complete?userId=${userId}`);
      } else {
        // Handle specific error cases
        if (response.status === 409) {
          setErrors({ 
            submit: 'An account with this email already exists. Please use a different email or contact support to delete the existing account.' 
          });
        } else if (response.status === 400) {
          setErrors({ submit: data.error || 'Please check your information and try again.' });
        } else {
          setErrors({ submit: data.error || 'Something went wrong. Please try again.' });
        }
      }
    } catch (error) {
      console.error('Signup error:', error);
      setErrors({ submit: 'Network error. Please check your connection and try again.' });
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <Sparkles className="w-6 h-6 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">Folio</span>
            </Link>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">Already have an account?</span>
              <Link
                href="/auth"
                className="text-blue-600 hover:underline text-sm font-medium"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Join Folio as a Designer
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {eventId ? 
              'Create your profile and start earning from your portfolio at this event!' : 
              'Create your designer profile in minutes and start earning from your portfolio.'
            }
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((stepNumber) => (
            <div key={stepNumber} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= stepNumber 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-500'
              }`}>
                {step > stepNumber ? <CheckCircle className="w-5 h-5" /> : stepNumber}
              </div>
              {stepNumber < 3 && (
                <div className={`w-20 h-0.5 mx-2 ${
                  step > stepNumber ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Form */}
          <div className="space-y-6">
            {/* Step 1: Basic Info */}
            {step === 1 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Create Your Account</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className="pl-10 pr-4 py-3 w-full border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                        placeholder="your@email.com"
                      />
                    </div>
                    {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                        className="pl-10 pr-12 py-3 w-full border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Create a password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Studio Website
                    </label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="url"
                        value={formData.website}
                        onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                        className="pl-10 pr-4 py-3 w-full border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                        placeholder="https://yourstudio.com"
                      />
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      We'll automatically import your portfolio and team info
                    </p>
                    {errors.website && <p className="text-red-500 text-sm mt-1">{errors.website}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Studio Logo (Optional)
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                        id="logo-upload"
                      />
                      <label htmlFor="logo-upload" className="cursor-pointer">
                        <span className="text-blue-600 hover:text-blue-700">
                          Click to upload
                        </span>
                        <span className="text-gray-500"> or drag and drop</span>
                      </label>
                      {formData.logo && (
                        <p className="text-sm text-gray-700 mt-2">{formData.logo.name}</p>
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
                    <label htmlFor="terms" className="text-sm text-gray-700">
                      I agree to the{' '}
                      <a href="/terms" className="text-blue-600 hover:underline">Terms of Service</a>
                      {' '}and{' '}
                      <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>
                    </label>
                  </div>
                  {errors.terms && <p className="text-red-500 text-sm">{errors.terms}</p>}

                  <button
                    onClick={() => setStep(2)}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Continue to Import
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Website Scraping */}
            {step === 2 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Importing Your Portfolio</h2>
                
                <div className="text-center">
                  <div className="mb-6">
                    <Globe className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Analyzing your website
                    </h3>
                    <p className="text-gray-600 mb-4">
                      We're scanning {formData.website} to import your portfolio and team information
                    </p>
                  </div>

                  <div className="space-y-4 mb-8">
                    <div className="flex items-center justify-center space-x-3">
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                      <span className="text-gray-700">Extracting portfolio images...</span>
                    </div>
                    <div className="flex items-center justify-center space-x-3">
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                      <span className="text-gray-700">Finding team information...</span>
                    </div>
                    <div className="flex items-center justify-center space-x-3">
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                      <span className="text-gray-700">Generating project descriptions...</span>
                    </div>
                  </div>

                  <button
                    onClick={handleWebsiteScrape}
                    disabled={scraping}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
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
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Review Your Profile</h2>
                
                {errors.submit && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <p className="text-red-600 text-sm">{errors.submit}</p>
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
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

          {/* Right Column - Preview */}
          <div className="space-y-6">
            {/* Preview Card */}
            {scrapedData && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview</h3>
                
                <div className="space-y-4">
                  {/* About Section */}
                  {scrapedData.about && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">About Your Studio</h4>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg line-clamp-3">
                        {scrapedData.about}
                      </p>
                    </div>
                  )}

                  {/* Team Section */}
                  {scrapedData.team && scrapedData.team.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Team Members</h4>
                      <div className="space-y-2">
                        {scrapedData.team.slice(0, 3).map((member, index) => (
                          <div key={index} className="flex items-center space-x-2 bg-gray-50 p-2 rounded-lg">
                            {member.image && (
                              <Image
                                src={member.image}
                                alt={member.name}
                                width={24}
                                height={24}
                                className="rounded-full"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-700 truncate">{member.name}</p>
                              <p className="text-xs text-gray-500 truncate">{member.role}</p>
                            </div>
                          </div>
                        ))}
                        {scrapedData.team.length > 3 && (
                          <p className="text-xs text-gray-500">
                            +{scrapedData.team.length - 3} more team members
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Projects Section */}
                  {scrapedData.projects && scrapedData.projects.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Portfolio Projects</h4>
                      <div className="space-y-3">
                        {scrapedData.projects.slice(0, 2).map((project, index) => (
                          <div key={index} className="border border-gray-200 rounded-lg p-3">
                            <h5 className="font-medium text-gray-700 text-sm mb-1">{project.title}</h5>
                            <p className="text-xs text-gray-500 mb-2 line-clamp-2">{project.description}</p>
                            {project.images.length > 0 && (
                              <div className="flex space-x-1">
                                {project.images.slice(0, 2).map((image, imgIndex) => (
                                  <Image
                                    key={imgIndex}
                                    src={image}
                                    alt={`${project.title} image`}
                                    width={40}
                                    height={40}
                                    className="rounded object-cover"
                                  />
                                ))}
                                {project.images.length > 2 && (
                                  <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500">
                                    +{project.images.length - 2}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        {scrapedData.projects.length > 2 && (
                          <p className="text-xs text-gray-500">
                            And {scrapedData.projects.length - 2} more projects...
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Next Steps Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Tag className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Next Step: Start Tagging</h4>
                  <p className="text-sm text-gray-600">
                    Once you complete signup, you can start tagging products in your portfolio to begin earning commissions.
                  </p>
                </div>
              </div>
            </div>

            {/* Features Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">What You'll Get</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Smart Portfolio Import</p>
                    <p className="text-xs text-gray-500">Auto-import from your website</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Tag className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Product Tagging</p>
                    <p className="text-xs text-gray-500">Earn commissions on sales</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Client Discovery</p>
                    <p className="text-xs text-gray-500">Get matched with projects</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 