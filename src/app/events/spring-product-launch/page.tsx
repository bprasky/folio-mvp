'use client';
import Image from 'next/image';
import { useState, useEffect } from 'react';

const SpringProductLaunch = () => {
  const eventDate = new Date('2024-06-14T19:00:00');

  const [currentUser, setCurrentUser] = useState({
    name: 'You',
    isDesignerPro: true,
    follows: ['Leaf & Co.', 'Ava Martinez'], // Added Leaf & Co. to follows by default for easier testing of follow button
    rsvp: false,
  });

  const [attendees, setAttendees] = useState([
    { name: 'Ava Martinez', avatar: 'https://randomuser.me/api/portraits/women/44.jpg', isDesignerPro: true, isMutual: true },
    { name: 'Lars Jensen', avatar: 'https://randomuser.me/api/portraits/men/32.jpg', isDesignerPro: false, isMutual: false },
    { name: 'Kelly Wearstler', avatar: 'https://randomuser.me/api/portraits/women/45.jpg', isDesignerPro: true, isMutual: false },
    { name: 'Norm Architects', avatar: 'https://randomuser.me/api/portraits/men/33.jpg', isDesignerPro: false, isMutual: true },
    { name: 'Leaf & Co.', avatar: 'https://randomuser.me/api/portraits/men/34.jpg', isDesignerPro: false, isMutual: false },
    { name: 'Sofia Lee', avatar: 'https://randomuser.me/api/portraits/women/46.jpg', isDesignerPro: true, isMutual: false },
    { name: 'Emily Chen', avatar: 'https://randomuser.me/api/portraits/women/47.jpg', isDesignerPro: false, isMutual: false },
    { name: 'Studio Verde', avatar: 'https://randomuser.me/api/portraits/men/36.jpg', isDesignerPro: false, isMutual: false },
    { name: 'Marco Rossi', avatar: 'https://randomuser.me/api/portraits/men/35.jpg', isDesignerPro: false, isMutual: false },
    { name: 'Tom Dixon', avatar: 'https://randomuser.me/api/portraits/men/37.jpg', isDesignerPro: false, isMutual: false },
    { name: 'West Elm', avatar: 'https://randomuser.me/api/portraits/men/38.jpg', isDesignerPro: false, isMutual: false },
    { name: 'You', avatar: 'https://randomuser.me/api/portraits/men/39.jpg', isDesignerPro: true, isMutual: false }
  ]);

  const [gallery, setGallery] = useState([
    { url: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=400&q=80', user: 'Ava Martinez', time: '2h ago' },
    { url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80', user: 'Norm Architects', time: '3h ago' }
  ]);

  const [comments, setComments] = useState([
    { author: 'Ava Martinez', text: 'Excited for this event!', time: '1h ago' },
    { author: 'You', text: 'Looking forward to seeing everyone!', time: 'just now' }
  ]);

  const [featuredProducts, setFeaturedProducts] = useState([
    { id: 101, name: "Eco Modular Sofa", brand: "Leaf & Co.", image: "https://images.unsplash.com/photo-1583845112208-5eb7b0e24b0b?auto=format&fit=crop&w=800&q=80", price: "$2,499", desc: "Sustainable, modular seating for modern spaces." },
    { id: 102, name: "Biophilic Table Lamp", brand: "Leaf & Co.", image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80", price: "$320", desc: "Nature-inspired lighting for a calming ambiance." },
    { id: 103, name: "Textured Area Rug", brand: "Leaf & Co.", image: "https://images.unsplash.com/photo-1583845112229-2b9fc29b5d9f?auto=format&fit=crop&w=800&q=80", price: "$799", desc: "Soft, tactile, and perfect for layering." },
    { id: 104, name: "Modern Planter Set", brand: "Leaf & Co.", image: "https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=800&q=80", price: "$120", desc: "Minimalist planters for a biophilic touch." }
  ]);

  const [addedToCollection, setAddedToCollection] = useState<number[]>([]);
  const [savedMoodboard, setSavedMoodboard] = useState<string[]>([]);
  const [showGuestList, setShowGuestList] = useState(false);
  const [showInviteDropdown, setShowInviteDropdown] = useState(false);
  const [rsvpAnimation, setRsvpAnimation] = useState(false);

  // --- RSVP Logic ---
  const updateRSVPBtn = () => {
    const now = new Date();
    if (now > eventDate) {
      return "Event Concluded";
    }
    if (currentUser.rsvp) {
      return "You're attending 🎉";
    } else {
      return "RSVP Now";
    }
  };

  const handleRSVP = () => {
    if (new Date() > eventDate) return;
    setCurrentUser(prev => ({ ...prev, rsvp: true }));
    if (!attendees.find(a => a.name === currentUser.name)) {
      setAttendees(prev => [
        ...prev,
        { name: currentUser.name, avatar: 'https://randomuser.me/api/portraits/men/39.jpg', isDesignerPro: true, isMutual: false },
      ]);
    }
    setRsvpAnimation(true);
    setTimeout(() => setRsvpAnimation(false), 1000);
  };

  // --- Attendees Grid ---
  const renderAttendees = () => {
    return attendees.slice(0, 8).map((a, index) => {
      let tooltip = `${a.name}`;
      if (a.isDesignerPro && a.isMutual) tooltip += ' — Designer Pro, Mutual Follower';
      else if (a.isDesignerPro) tooltip += ' — Designer Pro';
      else if (a.isMutual) tooltip += ' — Mutual Follower';
      return (
        <div key={index} className="flex flex-col items-center avatar-tooltip relative group">
          <Image src={a.avatar} alt={a.name} width={56} height={56} className={`w-14 h-14 rounded-full shadow ${a.isMutual ? 'mutual-follower' : ''}`} title={tooltip} />
          <span className="tooltip">{tooltip}</span>
          <span className="text-xs mt-1">{a.name.split(' ')[0]}</span>
          {a.isDesignerPro && <span className="designer-pro">Designer Pro</span>}
        </div>
      );
    });
  };

  const insightsBarContent = () => {
    const designerPros = attendees.filter(a => a.isDesignerPro).length;
    const mutuals = attendees.filter(a => a.isMutual).length;
    return (
      <div className="mt-4 text-gray-400 text-sm flex items-center justify-center">
        <span>{attendees.length} total attending</span>
        <span className="mx-2">&bull;</span>
        <span>{designerPros} Designer Pros</span>
        <span className="mx-2">&bull;</span>
        <span>{mutuals} people you follow</span>
      </div>
    );
  };

  // --- Guest List Toggle ---
  const handleToggleGuestList = () => {
    setShowGuestList(prev => !prev);
  };

  // --- Gallery ---
  const renderGallery = () => {
    if (gallery.length === 0) {
      return <div className="text-gray-400">No photos yet. Be the first to upload!</div>;
    }
    return gallery.map((g, idx) => (
      <div key={idx} className="relative flex flex-col items-center">
        <Image src={g.url} alt="Gallery image" width={128} height={96} className="gallery-img w-32 h-24 object-cover rounded-lg shadow" />
        <div className="absolute bottom-1 left-1 bg-black/60 text-xs px-2 py-0.5 rounded">{g.user}</div>
        <div className="absolute bottom-1 right-1 text-xs text-gray-300">{g.time}</div>
        <button
          className={`mt-2 px-2 py-1 text-xs bg-gray-800 text-green-300 rounded save-moodboard-btn relative ${
            savedMoodboard.includes(g.url) ? 'show-tooltip' : ''
          }`}
          onClick={() => handleSaveToMoodboard(g.url)}
        >
          <span>Save to Moodboard</span>
          <span className="tooltip" style={{ bottom: '120%' }}>Saved!</span>
        </button>
      </div>
    ));
  };

  const handleSaveToMoodboard = (url: string) => {
    setSavedMoodboard(prev => {
      if (!prev.includes(url)) {
        return [...prev, url];
      }
      return prev;
    });
  };

  const uploadPhotoHandler = () => {
    const url = prompt('Paste image URL:');
    if (!url) return;
    setGallery(prev => [...prev, { url, user: currentUser.name, time: 'just now' }]);
  };

  // --- Invite Dropdown ---
  const handleInviteToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowInviteDropdown(prev => !prev);
  };

  const filterInvite = (type: string) => {
    alert('Filter invitees by: ' + type);
    setShowInviteDropdown(false);
  };

  useEffect(() => {
    const handleClickOutside = () => {
      setShowInviteDropdown(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // --- Comments/Discussion ---
  const renderComments = () => {
    return comments.map((c, index) => (
      <div key={index} className="comment-bubble">
        <span className="comment-author">{c.author}</span>
        <span className="comment-time">{c.time}</span>
        <div>{c.text}</div>
      </div>
    ));
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const inputElement = (e.target as HTMLFormElement).elements.namedItem('comment-input') as HTMLInputElement;
    const commentText = inputElement.value.trim();
    if (!commentText) return;
    setComments(prev => [...prev, { author: currentUser.name, text: commentText, time: 'just now' }]);
    inputElement.value = '';
  };

  // --- Follow CTA ---
  const updateFollowBtnText = () => {
    if (currentUser.follows.includes('Leaf & Co.')) {
      return 'Following';
    }
    return 'Follow Leaf & Co.';
  };

  const handleFollow = () => {
    if (!currentUser.follows.includes('Leaf & Co.')) {
      setCurrentUser(prev => ({ ...prev, follows: [...prev.follows, 'Leaf & Co.'] }));
      alert('You are now following Leaf & Co.!');
    }
  };

  // --- Featured Products ---
  const renderFeaturedProducts = () => {
    return featuredProducts.map(prod => (
      <div key={prod.id} className="bg-gray-900 rounded-lg shadow-md p-4 w-64 flex flex-col items-center relative border border-green-700">
        <Image src={prod.image} alt={prod.name} width={256} height={144} className="w-full h-36 object-cover rounded mb-3" />
        <div className="font-bold text-lg text-green-200 mb-1">{prod.name}</div>
        <div className="text-green-400 font-medium mb-1">By {prod.brand}</div>
        <div className="text-amber-300 font-semibold mb-2">{prod.price}</div>
        <div className="text-gray-300 text-sm mb-3 text-center">{prod.desc}</div>
        <button
          className={`px-4 py-1 rounded-full bg-green-500 text-black font-semibold mt-auto add-to-collection-btn ${
            addedToCollection.includes(prod.id) ? 'bg-green-700 text-white' : ''
          }`}
          onClick={() => handleAddToCollection(prod.id)}
        >
          {addedToCollection.includes(prod.id) ? 'Added!' : 'Add to Collection'}
        </button>
      </div>
    ));
  };

  const handleAddToCollection = (id: number) => {
    setAddedToCollection(prev => {
      if (!prev.includes(id)) {
        return [...prev, id];
      }
      return prev;
    });
  };

  useEffect(() => {
    // This effect handles the pulse animation for the RSVP button
    if (rsvpAnimation) {
      const rsvpBtn = document.getElementById('rsvp-btn');
      if (rsvpBtn) {
        rsvpBtn.classList.add('pulse-anim');
        const confetti = document.createElement('span');
        confetti.className = 'confetti';
        confetti.textContent = '🎉';
        rsvpBtn.appendChild(confetti);
        setTimeout(() => {
          rsvpBtn.classList.remove('pulse-anim');
          if (confetti.parentNode) confetti.parentNode.removeChild(confetti);
        }, 1200);
      }
    }
  }, [rsvpAnimation]);

  // This useEffect ensures the FAB button display logic on mobile
  useEffect(() => {
    const uploadFab = document.getElementById('upload-photo-fab');
    if (uploadFab) {
      const handleFabDisplay = () => {
        if (window.innerWidth < 640) {
          uploadFab.style.display = 'flex';
        } else {
          uploadFab.style.display = 'none';
        }
      };
      window.addEventListener('resize', handleFabDisplay);
      handleFabDisplay(); // Initial check
      return () => {
        window.removeEventListener('resize', handleFabDisplay);
      };
    }
  }, []);

  return (
    <div className="relative w-full min-h-screen flex flex-col items-center justify-start overflow-hidden">
      {/* Hero Section */}
      <div className="relative w-full h-screen min-h-[340px] flex items-end justify-center overflow-hidden">
        <div
          className="absolute inset-0 w-full h-full bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1707923761706-0b81c3c7e099?q=80&w=2000&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')" }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/10"></div>
        <div className="relative z-10 w-full max-w-3xl mx-auto px-6 py-8 text-center">
          <h1 className="text-3xl md:text-5xl font-bold mb-2 drop-shadow-lg">Spring Product Launch</h1>
          <div className="text-lg md:text-2xl font-medium mb-2 flex flex-col md:flex-row items-center justify-center gap-2">
            <span><i className="fas fa-calendar-alt mr-1"></i>Friday, 7:00 PM</span>
            <span className="hidden md:inline">&middot;</span>
            <span><i className="fas fa-map-marker-alt mr-1"></i>Downtown Loft, Miami</span>
          </div>
          <button
            id="rsvp-btn"
            className={`mt-4 px-6 py-2 rounded-full font-semibold rsvp-btn relative ${
              new Date() > eventDate
                ? 'bg-gray-700 text-gray-300 cursor-not-allowed'
                : currentUser.rsvp
                ? 'active'
                : 'inactive'
            }`}
            onClick={handleRSVP}
            disabled={new Date() > eventDate || currentUser.rsvp}
          >
            {updateRSVPBtn()}
          </button>
        </div>
      </div>

      {/* Featured Products Section */}
      <div className="max-w-4xl mx-auto px-4 pt-8 pb-4">
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <i className="fas fa-star text-yellow-400 text-2xl mr-3"></i>
            <h2 className="text-2xl font-bold text-white">Featured Products for This Event</h2>
          </div>
          <div className="flex flex-wrap gap-6 justify-center">
            {renderFeaturedProducts()}
          </div>
        </div>
      </div>

      {/* Brand Section */}
      <div className="max-w-4xl mx-auto px-4 py-10 section-mobile-pad">
        <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
          <Image src="https://randomuser.me/api/portraits/men/34.jpg" alt="Leaf & Co. Logo" width={96} height={96} className="w-24 h-24 rounded-full border-4 border-green-400 shadow-lg" />
          <div>
            <h2 className="text-2xl font-bold flex items-center">Leaf & Co.<span className="brand-badge">Host</span></h2>
            <p className="mt-2 text-lg text-gray-300 max-w-xl">Leaf & Co. is a leader in sustainable, biophilic design, bringing nature-inspired products to modern interiors. Their Miami showroom is a hub for designers and clients seeking the latest in eco-friendly luxury.</p>
            <div className="flex gap-4 mt-4">
              <Image src="https://images.unsplash.com/photo-1698295627685-611c0f16bb06?q=80&w=400&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Product 1" width={112} height={80} className="w-28 h-20 object-cover rounded-lg shadow-md" />
              <Image src="https://images.unsplash.com/photo-1549887552-cb1071d3507d?q=80&w=400&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Product 2" width={112} height={80} className="w-28 h-20 object-cover rounded-lg shadow-md" />
              <Image src="https://images.unsplash.com/photo-1618302324128-d7031102ca16?q=80&w=400&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Product 3" width={112} height={80} className="w-28 h-20 object-cover rounded-lg shadow-md" />
            </div>
          </div>
        </div>

        {/* Who's Going */}
        <div className="mb-10 section-mobile-pad">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-semibold">Who's Going</h3>
            <span className="text-green-400 font-bold">{attendees.length} Attending</span>
            <button onClick={handleToggleGuestList} className="text-sm text-green-300 underline ml-4">
              {showGuestList ? 'Hide Guest List' : 'See Guest List'}
            </button>
          </div>
          <div className="flex flex-wrap gap-4 mt-2">
            {renderAttendees()}
          </div>
          {insightsBarContent()}
          {showGuestList && ( // Conditionally render full guest list
            <div className="mt-4">
              {attendees.map((a, index) => (
                <div key={index} className="flex items-center gap-3 mb-2">
                  <Image src={a.avatar} alt={a.name} width={40} height={40} className={`w-10 h-10 rounded-full ${a.isMutual ? 'mutual-follower' : ''}`} />
                  <span className="font-medium">{a.name}</span>
                  {a.isDesignerPro && <span className="designer-pro">Designer Pro</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Event Gallery */}
        <div className="mb-10 section-mobile-pad">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-semibold">Event Gallery</h3>
            <button onClick={uploadPhotoHandler} className="text-sm text-green-300 underline hidden sm:inline-block">Upload Photo</button>
          </div>
          <div className="flex flex-wrap gap-4 mt-2">
            {renderGallery()}
          </div>
          <button id="upload-photo-fab" className="sticky-upload-btn bg-green-500 text-black shadow-lg fixed bottom-6 right-6 sm:hidden" style={{ display: 'none' }} onClick={uploadPhotoHandler}><span className="text-3xl">+</span></button>
        </div>

        {/* Engagement */}
        <div className="mb-10">
          <h3 className="text-xl font-semibold mb-2">Engagement</h3>
          <div className="flex flex-wrap gap-4 mb-4">
            <button className="px-4 py-2 rounded-full bg-green-500 text-black font-semibold shadow hover:bg-green-400 transition">Share to Feed</button>
            <div className="relative">
              <button onClick={handleInviteToggle} className="px-4 py-2 rounded-full bg-emerald-700 text-white font-semibold shadow hover:bg-emerald-600 transition">Invite Others <i className="fas fa-caret-down ml-1"></i></button>
              {showInviteDropdown && (
                <div className="absolute left-0 mt-2 bg-gray-900 border border-green-400 rounded shadow-lg p-2 z-20">
                  <button className="block w-full text-left px-3 py-1 hover:bg-green-800 rounded" onClick={() => filterInvite('all')}>All</button>
                  <button className="block w-full text-left px-3 py-1 hover:bg-green-800 rounded" onClick={() => filterInvite('designerpro')}>Designer Pro</button>
                  <button className="block w-full text-left px-3 py-1 hover:bg-green-800 rounded" onClick={() => filterInvite('local')}>Local</button>
                </div>
              )}
            </div>
          </div>
          {/* Comments/Discussion (MVP) */}
          <div className="glass p-4">
            <h4 className="font-semibold mb-2">Discussion</h4>
            <div className="comments-list">
              {renderComments()}
            </div>
            <form onSubmit={handleCommentSubmit} className="flex gap-2 mt-2">
              <input id="comment-input" type="text" placeholder="Add a comment..." className="flex-1 px-3 py-2 rounded bg-gray-800 text-white focus:outline-none" required />
              <button type="submit" className="px-4 py-2 rounded bg-green-500 text-black font-semibold">Post</button>
            </form>
          </div>
        </div>
      </div>

      {/* Footer: Map & Follow CTA */}
      <div className="w-full bg-gray-900 py-8 mt-8 section-mobile-pad">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-8 px-4">
          <div className="flex-1">
            <h4 className="font-semibold mb-2">Event Location</h4>
            <iframe className="rounded-lg w-full h-48" src="https://www.openstreetmap.org/export/embed.html?bbox=-80.200,25.770,-80.190,25.780&amp;layer=mapnik" style={{ border: '1px solid #4ade80' }}></iframe>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
            <h4 className="font-semibold mb-2">Stay Connected</h4>
            <button
              onClick={handleFollow}
              className={`px-6 py-2 rounded-full bg-green-500 text-black font-semibold shadow hover:bg-green-400 transition ${
                currentUser.follows.includes('Leaf & Co.') ? 'opacity-60 cursor-not-allowed' : ''
              }`}
              disabled={currentUser.follows.includes('Leaf & Co.')}
            >
              {updateFollowBtnText()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpringProductLaunch; 