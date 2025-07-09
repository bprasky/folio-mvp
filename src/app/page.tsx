'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaStore, FaUser, FaHome, FaGraduationCap, FaPlus, FaArrowRight, FaCheck, FaExclamationTriangle } from 'react-icons/fa';

interface User {
  id: string;
  name: string;
  profileType: string;
  profileImage?: string;
  bio?: string;
  location?: string;
}

// Define roles as a constant for consistency and reuse
const ROLES = [
  {
    key: 'designer',
    title: 'Designer',
    description: 'Showcase your portfolio, connect with vendors, and grow your design business.',
    features: [
      'Professional portfolio showcase',
      'Project management tools',
      'Vendor collaboration network',
      'Client lead generation',
      'Analytics and insights'
    ],
    icon: FaUser,
    color: 'from-folio-accent to-folio-text'
  },
  {
    key: 'vendor',
    title: 'Vendor',
    description: 'Showcase your products and connect with top interior designers.',
    features: [
      'Product catalog management',
      'Designer engagement analytics',
      'Lead generation tools',
      'Brand visibility',
      'Direct designer connections'
    ],
    icon: FaStore,
    color: 'from-folio-accent to-folio-text'
  },
  {
    key: 'homeowner',
    title: 'Homeowner',
    description: 'Connect with talented interior designers for your home project.',
    features: [
      'Browse designer portfolios',
      'Get project quotes',
      'Save favorite designs',
      'Track project progress',
      'Direct messaging'
    ],
    icon: FaHome,
    color: 'from-folio-accent to-folio-text'
  },
  {
    key: 'student',
    title: 'Student',
    description: 'Learn from professionals and build your design career.',
    features: [
      'Mentorship opportunities',
      'Portfolio building tools',
      'Industry networking',
      'Educational resources',
      'Career guidance'
    ],
    icon: FaGraduationCap,
    color: 'from-folio-accent to-folio-text'
  }
];

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    bio: '',
    location: '',
    companyName: ''
  });
  const router = useRouter();

  // Load users from database
  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/users');
        
        if (!response.ok) {
          throw new Error('Failed to load users');
        }
        
        const data = await response.json();
        setUsers(data.users || []);
      } catch (error) {
        console.error('Failed to load users:', error);
        setError('Failed to load users. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, []);

  // Filter users by selected role - exact match with database profileType
  const filteredUsers = users.filter(user => 
    selectedRole ? user.profileType === selectedRole : true
  );

  const handleRoleSelect = (role: string) => {
    setSelectedRole(role);
    setSelectedUser(null); // Reset user selection when role changes
  };

  const handleUserSelect = (userId: string) => {
    setSelectedUser(userId);
  };

  const handleCreateUser = async () => {
    if (!newUser.name.trim()) return;

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newUser,
          profileType: selectedRole,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create user');
      }

      const createdUser = await response.json();
      setUsers([...users, createdUser]);
      setSelectedUser(createdUser.id);
      setShowCreateUser(false);
      setNewUser({ name: '', email: '', bio: '', location: '', companyName: '' });
    } catch (error) {
      console.error('Failed to create user:', error);
      setError('Failed to create user. Please try again.');
    }
  };

  const handleLogin = () => {
    if (selectedUser) {
      const user = users.find(u => u.id === selectedUser);
      if (user) {
        // Store user info in localStorage for dev mode
        localStorage.setItem('currentUser', JSON.stringify(user));
        localStorage.setItem('userRole', user.profileType);
        
        // Debug logging
        console.log('User logged in:', {
          id: user.id,
          name: user.name,
          role: user.profileType
        });
        
        // Navigate based on role
        switch (user.profileType) {
          case 'designer':
            router.push('/designer');
            break;
          case 'vendor':
            router.push('/vendor');
            break;
          case 'homeowner':
            router.push('/homeowner');
            break;
          case 'student':
            router.push('/student');
            break;
          default:
            router.push('/feed');
        }
      }
    }
  };

  const getRoleInfo = (roleKey: string) => {
    return ROLES.find(role => role.key === roleKey) || null;
  };

  return (
    <div className="min-h-screen bg-folio-background flex items-center justify-center p-4">
      <div className="max-w-6xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-folio-text mb-4">Welcome to Folio</h1>
          <p className="text-folio-border text-xl mb-6">The premier platform for interior design professionals</p>
          <div className="flex items-center justify-center space-x-4">
            <a
              href="/test-scraper"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              🧪 Test Scraper
            </a>
            <a
              href="/signup/designer/enhanced"
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              ✨ Enhanced Signup
            </a>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Role Selection */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-folio-text mb-6">Choose Your Role</h2>
            
            <div className="grid grid-cols-2 gap-4">
              {ROLES.map((role) => {
                const IconComponent = role.icon;
                
                return (
                  <div
                    key={role.key}
                    className={`glass-panel p-6 rounded-lg cursor-pointer transition-all duration-300 ${
                      selectedRole === role.key ? 'ring-2 ring-folio-accent bg-folio-accent bg-opacity-10' : 'hover:bg-folio-muted hover:bg-opacity-50'
                    }`}
                    onClick={() => handleRoleSelect(role.key)}
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${role.color} flex items-center justify-center mb-4`}>
                        <IconComponent className="text-2xl text-white" />
                      </div>
                      <h3 className="text-lg font-semibold text-folio-text mb-2">{role.title}</h3>
                      <p className="text-sm text-folio-border">{role.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* User Selection */}
            {selectedRole && (
              <div className="mt-8">
                <h3 className="text-xl font-semibold text-folio-text mb-4">Select User</h3>
                
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-folio-accent"></div>
                  </div>
                ) : error ? (
                  <div className="glass-panel p-6 rounded-lg border border-red-500">
                    <div className="flex items-center space-x-3 text-red-500">
                      <FaExclamationTriangle />
                      <span>{error}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => (
                        <div
                          key={user.id}
                          className={`glass-panel p-4 rounded-lg cursor-pointer transition-all duration-300 ${
                            selectedUser === user.id ? 'ring-2 ring-folio-accent bg-folio-accent bg-opacity-10' : 'hover:bg-folio-muted hover:bg-opacity-50'
                          }`}
                          onClick={() => handleUserSelect(user.id)}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-folio-accent to-folio-text flex items-center justify-center">
                              {user.profileImage ? (
                                <img src={user.profileImage} alt={user.name} className="w-12 h-12 rounded-full object-cover" />
                              ) : (
                                <span className="text-white font-semibold">{user.name.charAt(0)}</span>
                              )}
                            </div>
                            <div className="flex-1">
                              <h4 className="text-folio-text font-medium">{user.name}</h4>
                              <p className="text-folio-border text-sm">{user.location || 'No location'}</p>
                            </div>
                            {selectedUser === user.id && (
                              <FaCheck className="text-folio-accent text-xl" />
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="glass-panel p-6 rounded-lg text-center">
                        <p className="text-folio-border mb-4">No users found for this role.</p>
                      </div>
                    )}
                    
                    {/* Create New User Button - always show for better UX */}
                    <button
                      className="w-full glass-panel p-4 rounded-lg border-2 border-dashed border-folio-border hover:border-folio-accent transition-all duration-300 text-folio-border hover:text-folio-accent"
                      onClick={() => setShowCreateUser(true)}
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <FaPlus />
                        <span>Create New User</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Role Information */}
          <div className="space-y-6">
            {selectedRole ? (
              <div>
                {(() => {
                  const info = getRoleInfo(selectedRole);
                  if (!info) return null;
                  const IconComponent = info.icon;
                  
                  return (
                    <div className="glass-panel p-8 rounded-lg">
                      <div className="text-center mb-8">
                        <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${info.color} flex items-center justify-center mx-auto mb-6`}>
                          <IconComponent className="text-4xl text-white" />
                        </div>
                        <h2 className="text-3xl font-bold text-folio-text mb-4">Become a Folio {info.title}</h2>
                        <p className="text-folio-border text-lg">{info.description}</p>
                      </div>
                      
                      <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-folio-text mb-4">What you'll get:</h3>
                        {info.features.map((feature, index) => (
                          <div key={index} className="flex items-center space-x-3">
                            <div className="w-2 h-2 bg-folio-accent rounded-full"></div>
                            <span className="text-folio-text">{feature}</span>
                          </div>
                        ))}
                      </div>
                      
                      {selectedUser && (
                        <button
                          onClick={handleLogin}
                          className="w-full mt-8 bg-folio-accent text-white font-semibold py-3 px-6 rounded-lg hover:bg-opacity-90 transition-all duration-300 flex items-center justify-center space-x-2"
                        >
                          <span>Continue as {users.find(u => u.id === selectedUser)?.name}</span>
                          <FaArrowRight />
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="glass-panel p-8 rounded-lg">
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-folio-text mb-4">Select a Role</h3>
                  <p className="text-folio-border">
                    Choose your role to see detailed information about what Folio offers for your needs.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Create User Modal */}
        {showCreateUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-folio-text bg-opacity-50 backdrop-blur-sm">
            <div className="glass-panel p-8 rounded-lg max-w-md w-full mx-4">
              <h3 className="text-2xl font-bold text-folio-text mb-6">Create New User</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-folio-text text-sm font-medium mb-2">Name *</label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                    className="w-full px-4 py-2 bg-folio-muted border border-folio-border rounded-lg text-folio-text placeholder-folio-border focus:outline-none focus:ring-2 focus:ring-folio-accent"
                    placeholder="Enter name"
                  />
                </div>
                
                <div>
                  <label className="block text-folio-text text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    className="w-full px-4 py-2 bg-folio-muted border border-folio-border rounded-lg text-folio-text placeholder-folio-border focus:outline-none focus:ring-2 focus:ring-folio-accent"
                    placeholder="Enter email"
                  />
                </div>
                
                <div>
                  <label className="block text-folio-text text-sm font-medium mb-2">Bio</label>
                  <textarea
                    value={newUser.bio}
                    onChange={(e) => setNewUser({...newUser, bio: e.target.value})}
                    className="w-full px-4 py-2 bg-folio-muted border border-folio-border rounded-lg text-folio-text placeholder-folio-border focus:outline-none focus:ring-2 focus:ring-folio-accent"
                    placeholder="Enter bio"
                    rows={3}
                  />
                </div>
                
                <div>
                  <label className="block text-folio-text text-sm font-medium mb-2">Location</label>
                  <input
                    type="text"
                    value={newUser.location}
                    onChange={(e) => setNewUser({...newUser, location: e.target.value})}
                    className="w-full px-4 py-2 bg-folio-muted border border-folio-border rounded-lg text-folio-text placeholder-folio-border focus:outline-none focus:ring-2 focus:ring-folio-accent"
                    placeholder="Enter location"
                  />
                </div>
                
                {selectedRole === 'vendor' && (
                  <div>
                    <label className="block text-folio-text text-sm font-medium mb-2">Company Name</label>
                    <input
                      type="text"
                      value={newUser.companyName}
                      onChange={(e) => setNewUser({...newUser, companyName: e.target.value})}
                      className="w-full px-4 py-2 bg-folio-muted border border-folio-border rounded-lg text-folio-text placeholder-folio-border focus:outline-none focus:ring-2 focus:ring-folio-accent"
                      placeholder="Enter company name"
                    />
                  </div>
                )}
              </div>
              
              <div className="flex space-x-4 mt-8">
                <button
                  onClick={() => setShowCreateUser(false)}
                  className="flex-1 px-4 py-2 bg-folio-card text-folio-text rounded-lg hover:bg-folio-border hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateUser}
                  disabled={!newUser.name.trim()}
                  className="flex-1 px-4 py-2 bg-folio-accent text-white rounded-lg hover:bg-opacity-90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create User
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 