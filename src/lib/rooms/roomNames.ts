/** Suggestions, not project rooms: these never create records until selected. */
export const STANDARD_ROOM_NAMES = [
  // Living, entertaining and circulation.
  'Living Room', 'Formal Living Room', 'Family Room', 'Great Room', 'Drawing Room',
  'Sitting Room', 'Parlor', 'Salon', 'Den', 'Lounge', 'Conversation Room',
  'Dining Room', 'Formal Dining Room', 'Breakfast Room', 'Breakfast Nook',
  'Morning Room', 'Sunroom', 'Conservatory', 'Garden Room', 'Orangery', 'Atrium',
  'Entryway', 'Foyer', 'Entrance Hall', 'Vestibule', 'Hallway', 'Corridor',
  'Gallery', 'Staircase', 'Stair Hall', 'Landing', 'Elevator Lobby', 'Mezzanine',
  // Kitchens, utility and service spaces.
  'Kitchen', 'Eat-in Kitchen', 'Open Kitchen', 'Chef’s Kitchen', 'Prep Kitchen',
  'Back Kitchen', 'Catering Kitchen', 'Spice Kitchen', 'Pantry', 'Walk-in Pantry',
  "Butler's Pantry", 'Scullery', 'Coffee Bar', 'Tea Room', 'Wine Room', 'Wine Cellar',
  'Tasting Room', 'Bar', 'Wet Bar', 'Dry Bar', 'Cocktail Lounge', 'Service Hall',
  'Mudroom', 'Boot Room', 'Laundry Room', 'Laundry Closet', 'Utility Room',
  'Storage Room', 'Linen Closet', 'Broom Closet', 'Mechanical Room', 'Equipment Room',
  'Garage', 'Carport', 'Workshop', 'Potting Room', 'Dog Wash', 'Pet Room',
  // Bedrooms, bathrooms and dressing.
  'Primary Suite', 'Primary Bedroom', 'Primary Bathroom', 'Primary Closet',
  'Primary Sitting Room', 'Bedroom', 'Bathroom', 'Guest Suite', 'Guest Bedroom',
  'Guest Bathroom', 'Guest Powder Room', 'Powder Room', 'Half Bath', 'Full Bath',
  'Ensuite Bathroom', 'Jack and Jill Bathroom', 'Pool Bathroom', 'Outdoor Bathroom',
  'Shower Room', 'Steam Shower', 'Water Closet', 'Dressing Room', 'Walk-in Closet',
  'Closet', 'Wardrobe', 'Vanity Area', 'Nursery', "Children's Bedroom",
  "Children's Bathroom", 'Teen Bedroom', 'Bunk Room', 'Playroom', 'Toy Room',
  // Work, hobbies, wellness and recreation.
  'Home Office', 'Office', 'Study', 'Library', 'Reading Room', 'Reading Nook',
  'Homework Room', 'Studio', 'Art Studio', 'Craft Room', 'Sewing Room',
  'Photography Studio', 'Recording Studio', 'Music Room', 'Practice Room',
  'Media Room', 'TV Room', 'Home Theater', 'Screening Room', 'Game Room',
  'Recreation Room', 'Billiards Room', 'Poker Room', 'Golf Simulator', 'Bowling Alley',
  'Gym', 'Home Gym', 'Fitness Studio', 'Yoga Studio', 'Pilates Studio',
  'Dance Studio', 'Meditation Room', 'Prayer Room', 'Wellness Room',
  'Spa', 'Sauna', 'Steam Room', 'Massage Room', 'Treatment Room',
  'Cold Plunge', 'Indoor Pool', 'Lap Pool', 'Locker Room', 'Changing Room',
  // Outdoor rooms, landscapes and exterior architecture.
  'Exterior', 'Front Exterior', 'Rear Exterior', 'Facade', 'Entrance',
  'Front Door', 'Front Yard', 'Backyard', 'Side Yard', 'Garden', 'Formal Garden',
  'Kitchen Garden', 'Herb Garden', 'Courtyard', 'Entry Courtyard', 'Interior Courtyard',
  'Patio', 'Terrace', 'Roof Terrace', 'Balcony', 'Deck', 'Pool Deck', 'Rooftop',
  'Porch', 'Front Porch', 'Back Porch', 'Screened Porch', 'Veranda', 'Loggia',
  'Lanai', 'Breezeway', 'Pergola', 'Pavilion', 'Gazebo', 'Outdoor Living Room',
  'Outdoor Lounge', 'Outdoor Kitchen', 'Outdoor Dining', 'Outdoor Bar',
  'Summer Kitchen', 'Fire Pit', 'Outdoor Fireplace', 'Outdoor Shower',
  'Pool', 'Swimming Pool', 'Plunge Pool', 'Hot Tub', 'Pool House', 'Cabana',
  'Guest House', 'Casita', 'Carriage House', 'Greenhouse', 'Garden Shed',
  'Driveway', 'Motor Court', 'Porte Cochère', 'Walkway', 'Garden Path',
  'Entry Gate', 'Dock', 'Boathouse', 'Tennis Court', 'Pickleball Court',
  'Basketball Court', 'Sport Court', 'Playground', 'Lawn', 'Water Feature',
  'Fountain', 'Pond', 'Retaining Wall', 'Landscape', 'Outdoor Staircase',
  // Workplace, shared residential and commercial spaces.
  'Reception', 'Reception Area', 'Lobby', 'Waiting Room', 'Waiting Area',
  'Conference Room', 'Meeting Room', 'Boardroom', 'Huddle Room', 'Phone Booth',
  'Private Office', 'Executive Office', 'Open Office', 'Coworking Space',
  'Break Room', 'Staff Kitchen', 'Staff Lounge', 'Staff Room', 'Training Room',
  'Collaboration Space', 'Presentation Room', 'Mailroom', 'Copy Room', 'Server Room',
  'Restroom', 'Accessible Restroom', 'Family Restroom', 'Wellness Suite',
  'Clubhouse', 'Club Room', 'Residents’ Lounge', 'Amenity Lounge', 'Amenity Deck',
  'Package Room', 'Bicycle Storage', 'Parking Garage', 'Elevator',
  // Hospitality, retail, public and specialty interiors.
  'Hotel Lobby', 'Hotel Room', 'Hotel Suite', 'Penthouse', 'Penthouse Suite',
  'Presidential Suite', 'Restaurant', 'Dining Area', 'Private Dining Room',
  'Banquet Hall', 'Ballroom', 'Event Space', 'Event Hall', 'Pre-function Area',
  'Café', 'Coffee Shop', 'Bakery', 'Bistro', 'Restaurant Bar', 'Rooftop Bar',
  'Hotel Bar', 'Pool Bar', 'Beach Club', 'Commercial Kitchen', 'Service Kitchen',
  'Showroom', 'Retail Space', 'Storefront', 'Boutique', 'Sales Floor',
  'Display Area', 'Fitting Room', 'Checkout Area', 'Stockroom', 'Gallery Space',
  'Exhibition Space', 'Museum', 'Auditorium', 'Theater', 'Performance Space',
  'Classroom', 'Lecture Hall', 'School Library', 'Cafeteria', 'Student Lounge',
  'Childcare Room', 'Clinic', 'Consultation Room', 'Exam Room', 'Therapy Room',
  'Dental Office', 'Beauty Salon', 'Hair Salon', 'Nail Salon', 'Barbershop',
  'Bridal Suite', 'Chapel', 'Sanctuary', 'Community Room', 'Multipurpose Room',
  'Yacht Salon', 'Yacht Cabin', 'Yacht Deck', 'Stables', 'Tack Room', 'Barn',
] as const;

export const cleanRoomName = (name: string) => name.trim().replace(/\s+/g, ' ');
export const roomNameKey = (name: string) => cleanRoomName(name).normalize('NFKC').replace(/[‘’]/g, "'").toLocaleLowerCase('en-US');
const searchKey = (name: string) => roomNameKey(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/'/g, '').replace(/[-–—]/g, ' ');
export type RoomNameOption = { name: string; roomId?: string; source: 'project' | 'saved' | 'standard' };

export function roomNameOptions(rooms: { id: string; name: string }[], saved: string[]): RoomNameOption[] {
  const unique = new Map<string, RoomNameOption>();
  const options: RoomNameOption[] = [
    ...rooms.map(room => ({ name: room.name, roomId: room.id, source: 'project' as const })),
    ...saved.map(name => ({ name, source: 'saved' as const })),
    ...STANDARD_ROOM_NAMES.map(name => ({ name, source: 'standard' as const })),
  ];
  for (const option of options) if (!unique.has(roomNameKey(option.name))) unique.set(roomNameKey(option.name), option);
  return Array.from(unique.values());
}

// Damerau-Levenshtein catches missing letters and adjacent transpositions locally.
function distance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  rows[0] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
  }
  return rows[a.length][b.length];
}

export function suggestRoomNames(value: string, options: RoomNameOption[]) {
  const query = roomNameKey(value);
  const exact = options.find(option => roomNameKey(option.name) === query);
  if (!query || exact) return { exact, matches: [] as RoomNameOption[], correction: undefined as RoomNameOption | undefined };
  const search = searchKey(value);
  const prefix = options.filter(option => searchKey(option.name).startsWith(search));
  const words = options.filter(option => !prefix.includes(option) && searchKey(option.name).split(' ').some(word => word.startsWith(search)));
  const matches = [...prefix, ...words].slice(0, 3);
  if (matches.length || query.length < 4 || query.length > 120) return { exact, matches, correction: undefined };
  const ranked = options.filter(option => (query.match(/\d+/g) || []).join(',') === (option.name.match(/\d+/g) || []).join(','))
    .map(option => ({ option, distance: distance(query, roomNameKey(option.name)) }))
    .filter(item => item.distance <= (query.length >= 9 ? 2 : 1)).sort((a, b) => a.distance - b.distance);
  // Ambiguous guesses never block a custom name.
  const correction = ranked.length && (!ranked[1] || ranked[0].distance < ranked[1].distance) ? ranked[0].option : undefined;
  return { exact, matches, correction };
}
