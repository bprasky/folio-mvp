'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FaHome, FaLightbulb, FaNewspaper, FaStore, FaUsers, FaUser, FaPlus, FaSearch, FaEyeSlash, FaEye, FaUserFriends, FaStar, FaMapPin, FaBolt, FaCalendarAlt, FaMapMarkerAlt, FaCalendarPlus, FaHeart } from 'react-icons/fa';
import { useRole } from '../../contexts/RoleContext';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';

// --- Interfaces ---
interface User {
  name: string;
  photo: string;
  location: string;
  accountAge: number;
}

interface FeedPreview {
  type: 'project' | 'moodboard' | 'product' | 'event' | 'event-photo';
  title: string;
  image: string;
  location?: string;
  date?: string;
  engagement?: number;
  tags?: string[];
  likes?: number;
  likedBy?: string[];
}

interface FeedItem {
  user: User;
  action: string;
  preview: FeedPreview;
  time: string;
  engagement: number;
  likes?: number;
  likedBy?: string[];
}

interface CommunityFeedGroup {
  group: string;
  items: FeedItem[];
}

interface EventInvitee {
  name: string;
  role: string;
  location: string;
}

interface EventData {
  id: number;
  title: string;
  host: { name: string; type: string; };
  date: string;
  location: string;
  image: string;
  attendees: User[];
  status: 'attending' | 'noresponse' | 'declined';
  isAdmin: boolean;
  inviteRules?: string[];
  invited: EventInvitee[];
  gallery: { url: string; caption: string; user: string; }[];
  priorityWave?: string[];
}

// --- Mocked Data ---
const currentUser = {
  id: 1,
  name: 'You',
  isAdmin: true,
  location: 'Miami',
  follows: ['Ava Martinez', 'Lars Jensen', 'Kelly Wearstler'],
  role: 'Designer Pro',
  accountAge: 120, // days
  tags: ['Japandi', 'Minimalism']
};

const allUsers: User[] = [
  { name: 'Ava Martinez', photo: 'https://randomuser.me/api/portraits/women/44.jpg', location: 'Miami', accountAge: 30 },
  { name: 'Lars Jensen', photo: 'https://randomuser.me/api/portraits/men/32.jpg', location: 'New York', accountAge: 200 },
  { name: 'Kelly Wearstler', photo: 'https://randomuser.me/api/portraits/women/45.jpg', location: 'Miami', accountAge: 400 },
  { name: 'Norm Architects', photo: 'https://randomuser.me/api/portraits/men/33.jpg', location: 'Miami', accountAge: 60 },
  { name: 'Leaf & Co.', photo: 'https://randomuser.me/api/portraits/men/34.jpg', location: 'Miami', accountAge: 20 },
  { name: 'Sofia Lee', photo: 'https://randomuser.me/api/portraits/women/46.jpg', location: 'Miami', accountAge: 10 },
  { name: 'Marco Rossi', photo: 'https://randomuser.me/api/portraits/men/35.jpg', location: 'Los Angeles', accountAge: 15 },
  { name: 'Emily Chen', photo: 'https://randomuser.me/api/portraits/women/47.jpg', location: 'Miami', accountAge: 5 },
  { name: 'Studio Verde', photo: 'https://randomuser.me/api/portraits/men/36.jpg', location: 'Miami', accountAge: 80 },
  { name: 'Harper & Moss', photo: 'https://randomuser.me/api/portraits/women/48.jpg', location: 'Chicago', accountAge: 300 },
  { name: 'Tom Dixon', photo: 'https://randomuser.me/api/portraits/men/37.jpg', location: 'Miami', accountAge: 60 },
  { name: 'West Elm', photo: 'https://randomuser.me/api/portraits/men/38.jpg', location: 'Miami', accountAge: 120 }
];

// Add student users to allUsers array
const studentUsers: User[] = [
  { name: 'Alex Chen', photo: 'https://randomuser.me/api/portraits/men/50.jpg', location: 'New York', accountAge: 45 },
  { name: 'Emma Rodriguez', photo: 'https://randomuser.me/api/portraits/women/51.jpg', location: 'Austin', accountAge: 30 },
  { name: 'Maya Patel', photo: 'https://randomuser.me/api/portraits/women/52.jpg', location: 'San Francisco', accountAge: 60 },
  { name: 'James Wilson', photo: 'https://randomuser.me/api/portraits/men/53.jpg', location: 'Boston', accountAge: 25 }
];

// Add student users to main users array
allUsers.push(...studentUsers);

const communityFeed: CommunityFeedGroup[] = [
  {
    group: 'Today',
    items: [
      // Student Spotlight - Featured first
      { user: studentUsers[0], action: 'featured in Student Spotlight', preview: { type: 'project', title: 'Eco-Friendly Studio Apartment', image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=600&q=80', location: 'New York', engagement: 156, tags: ['Student Spotlight', 'Sustainable', 'Small Space'] }, time: '1 hour ago', engagement: 156 },
      { user: allUsers[0], action: 'posted a new project', preview: { type: 'project', title: 'Modern Loft', image: 'https://images.unsplash.com/photo-1618220179428-22790b461013?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', location: 'Miami', engagement: 80, tags: ['Minimalism'] }, time: '2 hours ago', engagement: 80 },
      { user: allUsers[1], action: "RSVP'd to an event", preview: { type: 'event', title: 'Designers Meetup', date: 'Today, 6:00 PM', location: 'New York', image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', engagement: 60, tags: ['Networking'] }, time: '3 hours ago', engagement: 60 },
      { user: allUsers[2], action: 'published a new product', preview: { type: 'product', title: 'Velvet Sofa', image: 'https://images.unsplash.com/photo-1583845112208-5eb7b0e24b0b?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', location: 'Miami', engagement: 120, tags: ['Luxury'] }, time: '5 hours ago', engagement: 120 },
      { user: allUsers[3], action: 'posted a new moodboard', preview: { type: 'moodboard', title: 'Urban Jungle', image: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', location: 'Miami', engagement: 30, tags: ['Biophilic'] }, time: '6 hours ago', engagement: 30 },
      { user: allUsers[4], action: "RSVP'd to an event", preview: { type: 'event', title: 'Spring Product Launch', date: 'Friday, 7:00 PM', location: 'Miami', image: 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', engagement: 90, tags: ['Product Launch'] }, time: '7 hours ago', engagement: 90 },
      // Student collaboration post
      { user: studentUsers[1], action: 'looking for collaboration partner', preview: { type: 'project', title: 'Modern Kitchen Design Challenge', image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=600&q=80', location: 'Austin', engagement: 45, tags: ['Collaboration', 'Kitchen Design', 'Student Project'] }, time: '6.5 hours ago', engagement: 45 },
      { user: allUsers[5], action: 'published a new product', preview: { type: 'product', title: 'Eco Table', image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', location: 'Miami', engagement: 110, tags: ['Sustainable'] }, time: '8 hours ago', engagement: 110 },
      { user: allUsers[6], action: 'posted a new project', preview: { type: 'project', title: 'LA Modern', image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', location: 'Los Angeles', engagement: 70, tags: ['Modern'] }, time: '9 hours ago', engagement: 70 },
      { user: allUsers[7], action: 'published a new product', preview: { type: 'product', title: 'Smart Lamp', image: 'https://images.unsplash.com/photo-1583845112229-2b9fc29b5d9f?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', location: 'Miami', engagement: 95, tags: ['Smart Lighting'] }, time: '10 hours ago', engagement: 95 },
      { user: allUsers[8], action: 'posted a new moodboard', preview: { type: 'moodboard', title: 'Japandi Calm', image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', location: 'Miami', engagement: 60, tags: ['Japandi'] }, time: '11 hours ago', engagement: 60 },
      { user: allUsers[9], action: 'posted a new project', preview: { type: 'project', title: 'Gallery Wall', image: 'https://images.unsplash.com/photo-1618220179428-22790b461013?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', location: 'Chicago', engagement: 50, tags: ['Art'] }, time: '12 hours ago', engagement: 50 },
      { user: allUsers[10], action: 'published a new product', preview: { type: 'product', title: 'Pendant Light', image: 'https://images.unsplash.com/photo-1583845112229-2b9fc29b5d9f?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', location: 'Miami', engagement: 105, tags: ['Lighting'] }, time: '13 hours ago', engagement: 105 },
      { user: allUsers[11], action: 'published a new product', preview: { type: 'product', title: 'Harmony Sofa', image: 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', location: 'Miami', engagement: 115, tags: ['Sofa'] }, time: '14 hours ago', engagement: 115 }
    ]
  },
  // This Week
  {
    group: 'This Week',
    items: [
      // Student mentorship success story
      { user: studentUsers[2], action: 'completed mentorship milestone', preview: { type: 'project', title: 'Portfolio Website Launch', image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=600&q=80', location: 'San Francisco', engagement: 78, tags: ['Student Achievement', 'Portfolio', 'Web Design'] }, time: '1 day ago', engagement: 78 },
      { user: allUsers[0], action: 'posted a new project', preview: { type: 'project', title: 'Minimalist Kitchen', image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', location: 'Miami', engagement: 85, tags: ['Minimalism'] }, time: '2 days ago', engagement: 85 },
      { user: allUsers[1], action: 'published a new product', preview: { type: 'product', title: 'Flower Table Lamp', image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', location: 'New York', engagement: 65, tags: ['Lighting'] }, time: '3 days ago', engagement: 65 },
      { user: allUsers[2], action: 'posted a new moodboard', preview: { type: 'moodboard', title: 'Luxury Living', image: 'https://images.unsplash.com/photo-1583845112208-5eb7b0e24b0b?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', location: 'Miami', engagement: 90, tags: ['Luxury'] }, time: '4 days ago', engagement: 90 },
      { user: allUsers[3], action: 'posted a new project', preview: { type: 'project', title: 'Biophilic Home', image: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', location: 'Miami', engagement: 75, tags: ['Biophilic'] }, time: '5 days ago', engagement: 75 },
      { user: allUsers[4], action: 'published a new product', preview: { type: 'product', title: 'Belle Nightstand', image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', location: 'Miami', engagement: 100, tags: ['Nightstand'] }, time: '6 days ago', engagement: 100 },
      { user: allUsers[5], action: 'posted a new moodboard', preview: { type: 'moodboard', title: 'Sustainable Living', image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', location: 'Miami', engagement: 80, tags: ['Sustainable'] }, time: '7 days ago', engagement: 80 },
      { user: allUsers[6], action: 'posted a new project', preview: { type: 'project', title: 'LA Penthouse', image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', location: 'Los Angeles', engagement: 60, tags: ['Modern'] }, time: '8 days ago', engagement: 60 },
      { user: allUsers[7], action: 'published a new product', preview: { type: 'product', title: 'Curved Sofa', image: 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', location: 'Miami', engagement: 110, tags: ['Sofa'] }, time: '9 days ago', engagement: 110 },
      { user: allUsers[8], action: 'posted a new moodboard', preview: { type: 'moodboard', title: 'Japandi Zen', image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', location: 'Miami', engagement: 70, tags: ['Japandi'] }, time: '10 days ago', engagement: 70 },
      { user: allUsers[9], action: 'posted a new project', preview: { type: 'project', title: 'Art Deco Revival', image: 'https://images.unsplash.com/photo-1618220179428-22790b461013?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', location: 'Chicago', engagement: 55, tags: ['Art Deco'] }, time: '11 days ago', engagement: 55 },
      { user: allUsers[10], action: 'published a new product', preview: { type: 'product', title: 'Textured Rug', image: 'https://images.unsplash.com/photo-1583845112229-2b9fc29b5d9f?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', location: 'Miami', engagement: 90, tags: ['Rug'] }, time: '12 days ago', engagement: 90 },
      { user: allUsers[11], action: 'published a new product', preview: { type: 'product', title: 'Worn Velvet Curtains', image: 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', location: 'Miami', engagement: 95, tags: ['Curtains'] }, time: '13 days ago', engagement: 95 }
    ]
  }
];

const allEventInvitees: EventInvitee[] = [
  { name: 'You', role: 'Designer Pro', location: 'Miami' },
  { name: 'Ava Martinez', role: 'Designer Pro', location: 'Miami' },
  { name: 'Lars Jensen', role: 'Designer', location: 'New York' },
  { name: 'Kelly Wearstler', role: 'Top Client', location: 'Miami' },
  { name: 'Norm Architects', role: 'Designer', location: 'Miami' },
  { name: 'Leaf & Co.', role: 'Vendor', location: 'Miami' }
];

const events: EventData[] = [
  { id: 1, title: 'Designers Meetup', host: { name: 'Lars Jensen', type: 'designer' }, date: '2024-06-10T18:00:00', location: 'New York', image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', attendees: [allUsers[0], allUsers[1]], status: 'attending', isAdmin: true, inviteRules: ['Designer Pro', 'Local'], invited: [], gallery: [], priorityWave: ['You', 'Ava Martinez'] },
  { id: 7, title: 'Student Portfolio Review & Networking', host: { name: 'Sarah Martinez', type: 'mentor' }, date: '2024-06-12T16:00:00', location: 'New York', image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', attendees: [studentUsers[0], studentUsers[1]], status: 'attending', isAdmin: false, inviteRules: ['Students', 'Mentors'], invited: [], gallery: [], priorityWave: ['Alex Chen', 'Emma Rodriguez'] },
  { id: 2, title: 'Spring Product Launch', host: { name: 'Leaf & Co.', type: 'vendor' }, date: '2024-06-14T19:00:00', location: 'Miami', image: 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', attendees: [allUsers[2]], status: 'noresponse', isAdmin: false, inviteRules: ['Top Clients', 'Local'], invited: [], gallery: [], priorityWave: ['Kelly Wearstler'] },
  { id: 3, title: 'VIP Client Preview', host: { name: 'Kelly Wearstler', type: 'designer' }, date: '2024-06-17T17:00:00', location: 'Miami', image: 'https://images.unsplash.com/photo-1583845112208-5eb7b0e24b0b?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', attendees: [allUsers[0]], status: 'declined', isAdmin: false, inviteRules: ['Designer Pro'], invited: [], gallery: [], priorityWave: ['You'] },
  { id: 4, title: 'Miami Design Week', host: { name: 'Sofia Lee', type: 'designer' }, date: '2024-06-20T10:00:00', location: 'Miami', image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', attendees: [allUsers[5], allUsers[7]], status: 'noresponse', isAdmin: false, inviteRules: ['Designer Pro', 'Local'], invited: [], gallery: [], priorityWave: ['Sofia Lee', 'Emily Chen'] },
  { id: 5, title: 'LA Modern Expo', host: { name: 'Marco Rossi', type: 'vendor' }, date: '2024-06-22T12:00:00', location: 'Los Angeles', image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', attendees: [allUsers[6]], status: 'noresponse', isAdmin: false, inviteRules: ['Local'], invited: [], gallery: [], priorityWave: ['Marco Rossi'] },
  { id: 6, title: 'Sustainable Living Panel', host: { name: 'Studio Verde', type: 'designer' }, date: '2024-06-25T15:00:00', location: 'Miami', image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&q=80', attendees: [allUsers[8]], status: 'noresponse', isAdmin: false, inviteRules: ['Designer Pro', 'Top Clients', 'Local'], invited: [], gallery: [], priorityWave: ['Studio Verde'] }
];

// --- Utility Functions (moved from HTML script) ---
const applyAutoInvites = (event: EventData) => {
  event.invited = [];
  if (!event.inviteRules) return;
  if (event.inviteRules.includes('Designer Pro')) {
    event.invited.push(...allEventInvitees.filter(u => u.role === 'Designer Pro'));
  }
  if (event.inviteRules.includes('Top Clients')) {
    event.invited.push(...allEventInvitees.filter(u => u.role === 'Top Client'));
  }
  if (event.inviteRules.includes('Local')) {
    event.invited.push(...allEventInvitees.filter(u => u.location === event.location));
  }
  // Remove duplicates
  event.invited = event.invited.filter((v,i,a)=>a.findIndex(t=>(t.name===v.name))===i);
};
events.forEach(applyAutoInvites);

const addToCalendar = (title: string, date: string, location: string) => {
  const start = new Date(date);
  const end = new Date(start.getTime() + 60*60*1000); // Add 1 hour
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `DTSTART:${start.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `DTEND:${end.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `SUMMARY:${title}`,
    `LOCATION:${location}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/\s+/g, '_')}.ics`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
};

// --- Components ---
const CommunityFeedItem = ({ item, onLike, isLiked }: { item: FeedItem; onLike: () => void; isLiked: boolean }) => {
  return (
    <RidgeCard className="p-4 mb-4">
      <div className="flex gap-4">
        <Image className="w-14 h-14 rounded-full object-cover" src={item.user.photo} alt={item.user.name} width={56} height={56} />
        <div className="flex-1">
          <div className="folio-ui text-[var(--text-primary)]">
            <span className="font-semibold">{item.user.name}</span>
            {' '}
            {item.user.accountAge < 90 && <span className="px-2 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)] rounded-full folio-meta mr-1">Rising</span>}
            {item.user.location === currentUser.location && <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full folio-meta">Local</span>}
            {' '}{item.action}
          </div>
          <div className="folio-meta text-[var(--text-tertiary)]">
            {item.time} <span className="ml-2 text-[var(--accent)]">{item.user.location || ''}</span>
          </div>
          <div className="mt-3">
            {item.preview.type === 'project' || item.preview.type === 'moodboard' || item.preview.type === 'product' ? (
              <>
                <div className="relative rounded-lg overflow-hidden">
                  <Image src={item.preview.image} alt={item.preview.title} width={320} height={180} className="w-full h-44 object-cover" />
                </div>
                <div className="mt-2 folio-ui font-medium text-[var(--text-primary)]">{item.preview.title}</div>
              </>
            ) : item.preview.type === 'event' ? (
              <div className="flex gap-4 items-center">
                <Image src={item.preview.image} alt={item.preview.title} width={120} height={120} className="w-28 h-28 object-cover rounded-lg" />
                <div>
                  <div className="folio-h3 text-[var(--text-primary)] mb-1">{item.preview.title}</div>
                  <div className="folio-meta text-[var(--text-secondary)] mb-1"><FaCalendarAlt className="mr-1 inline-block" /> {item.preview.date}</div>
                  <div className="folio-meta text-[var(--text-tertiary)]"><FaMapMarkerAlt className="mr-1 inline-block" /> {item.preview.location}</div>
                  {item.preview.tags && (
                    <div className="flex gap-2 mt-2">
                      {item.preview.tags.map((tag, index) => (
                        <span key={index} className="px-2 py-1 bg-[var(--bg-base)] rounded-full folio-meta text-[var(--text-secondary)]">{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      className={`flex items-center gap-1 px-3 py-1 rounded-full folio-ui ${isLiked ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-base)] text-[var(--text-secondary)]'}`}
                      onClick={onLike}
                    >
                      <FaHeart className={isLiked ? 'text-white' : 'text-[var(--accent)]'} />
                      <span>{item.likes || 0}</span>
                    </button>
                    {item.likedBy && item.likedBy.length > 0 && (
                      <div className="folio-meta text-[var(--text-tertiary)]">
                        Liked by {item.likedBy.slice(0, 3).join(', ')}
                        {item.likedBy.length > 3 && ` and ${item.likedBy.length - 3} others`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : item.preview.type === 'event-photo' ? (
              <>
                <Image src={item.preview.image} alt={item.preview.title} width={120} height={120} className="rounded-lg" />
                <div className="mt-2 folio-ui font-medium text-[var(--text-primary)]">{item.preview.title}</div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </RidgeCard>
  );
};

const EventCardComponent = ({ event, onRSVP, isInline = false }: { event: EventData; onRSVP: (eventId: number, status: 'attending' | 'noresponse' | 'declined') => void; isInline?: boolean }) => {
  const statusClass = event.status === 'attending' ? 'border-l-4 border-l-green-500' : event.status === 'declined' ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-[var(--accent)]';
  const isPriority = event.priorityWave && event.priorityWave.includes(currentUser.name);
  const isPast = new Date(event.date) < new Date();
  const isUpcoming = new Date(event.date).getTime() > Date.now() && new Date(event.date).getTime() < Date.now() + 7 * 24 * 60 * 60 * 1000;

  let inviteTypeJsx = null;
  if (event.inviteRules && event.inviteRules.includes('Local') && event.inviteRules.includes('Designer Pro')) {
    inviteTypeJsx = <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full folio-meta mr-1">Open Invite</span>;
  } else if (event.inviteRules && !event.inviteRules.includes('Local')) {
    inviteTypeJsx = <span className="px-2 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)] rounded-full folio-meta mr-1">Invite Only</span>;
  }
  if (event.attendees.some(u => u.name === currentUser.name)) {
    inviteTypeJsx = <>{inviteTypeJsx}<span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full folio-meta">Attending</span></>;
  }

  const eventPath = `/events/${event.id}`;

  const cardContent = (
    <RidgeCard className={`p-4 ${statusClass} ${isInline ? 'flex gap-4' : ''}`}>
      <Image className={`rounded-lg object-cover ${isInline ? 'w-48 h-36' : 'w-16 h-16'}`} src={event.image} alt={event.title} width={isInline ? 200 : 64} height={isInline ? 150 : 64} />
      <div className={isInline ? 'flex-1' : 'mt-3'}>
        <div className="folio-h3 text-[var(--text-primary)] mb-1">
          {event.title} {inviteTypeJsx} {isPriority && <span className="px-2 py-0.5 bg-[var(--accent)] text-white rounded-full folio-meta ml-1">Priority Access</span>} {isUpcoming && isInline && <span className="px-2 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)] rounded-full folio-meta ml-1">Upcoming</span>}
        </div>
        <div className="folio-meta text-[var(--text-secondary)] mb-1">Hosted by {event.host.name}</div>
        <div className="folio-meta text-[var(--text-secondary)]"><FaCalendarAlt className="mr-1 inline-block" /> {new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
        <div className="folio-meta text-[var(--text-tertiary)]"><FaMapMarkerAlt className="mr-1 inline-block" /> {event.location}</div>
        <div className="folio-meta text-[var(--text-tertiary)] mt-1">{event.attendees.length} attending</div>
        {!isPast && (
          <Button
            variant={event.status === 'attending' ? 'accent' : 'secondary'}
            size="sm"
            className="mt-2"
            onClick={(e) => {
              e.preventDefault();
              onRSVP(event.id, event.status === 'attending' ? 'noresponse' : 'attending');
            }}
          >
            {event.status === 'attending' ? 'Attending' : 'RSVP'}
          </Button>
        )}
      </div>
    </RidgeCard>
  );

  return isInline ? cardContent : (
    <Link href={eventPath} className="block hover:opacity-90 transition-opacity mb-4">
      {cardContent}
    </Link>
  );
};

export default function CommunityPage() {
  const { role } = useRole();
  const [feedFilter, setFeedFilter] = useState<'following' | 'forYou' | 'local' | 'rising'>('following');
  const [eventTypeFilter, setEventTypeFilter] = useState<'all' | 'open' | 'invite' | 'attending'>('all');
  const [eventsData, setEventsData] = useState<EventData[]>(events);
  const [eventsVisible, setEventsVisible] = useState(true);
  const [currentPanel, setCurrentPanel] = useState<'all' | 'feed' | 'events'>('all');
  const [likedItems, setLikedItems] = useState<{ [key: string]: boolean }>({});

  // Role-based profile link configuration
  const getProfileLink = () => {
    switch (role) {
      case 'designer':
        return '/designer';
      case 'vendor':
        return '/vendor';
      case 'student':
        return '/student';
      case 'homeowner':
      default:
        return '/homeowner';
    }
  };

  const handleLike = (itemId: string) => {
    setLikedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handleRSVP = (eventId: number, newStatus: 'attending' | 'noresponse' | 'declined') => {
    setEventsData(prevEvents => prevEvents.map(event =>
      event.id === eventId ? { ...event, status: newStatus } : event
    ));
  };

  const filterFeedItems = (items: FeedItem[]) => {
    return items.filter(item => {
      if (feedFilter === 'following') {
        return currentUser.follows.includes(item.user.name);
      } else if (feedFilter === 'local') {
        return item.user.location === currentUser.location;
      } else if (feedFilter === 'rising') {
        return item.user.accountAge < 90;
      }
      return true;
    });
  };

  const filterEventsItems = (eventsToFilter: EventData[]) => {
    return eventsToFilter.filter(event => {
      if (eventTypeFilter === 'open') {
        return event.inviteRules?.includes('Local');
      } else if (eventTypeFilter === 'invite') {
        return !event.inviteRules?.includes('Local');
      } else if (eventTypeFilter === 'attending') {
        return event.status === 'attending';
      }
      return true;
    });
  };

  const getCombinedFeed = () => {
    const allItems = communityFeed.flatMap(group => group.items);
    const filteredFeedItems = filterFeedItems(allItems);
    const filteredEvents = filterEventsItems(eventsData);

    // Convert events to feed items and flag hero events
    const eventFeedItems: FeedItem[] = filteredEvents.map(event => {
      const isUpcoming = new Date(event.date).getTime() > Date.now() && new Date(event.date).getTime() < Date.now() + 7 * 24 * 60 * 60 * 1000;
      const isEligibleForRSVP = event.inviteRules?.includes('Designer Pro') && currentUser.role === 'Designer Pro' ||
                                event.inviteRules?.includes('Local') && currentUser.location === event.location;

      const item: FeedItem = {
        user: { name: event.host.name, photo: event.host.type === 'designer' ? allUsers.find(u => u.name === event.host.name)?.photo || '' : '', location: event.location, accountAge: 0 },
        action: 'hosting an event',
        preview: {
          type: 'event',
          title: event.title,
          image: event.image,
          location: event.location,
          date: new Date(event.date).toLocaleString(),
          engagement: event.attendees.length,
          tags: event.inviteRules,
          likes: event.attendees.length,
          likedBy: event.attendees.map(a => a.name)
        },
        time: new Date(event.date).toLocaleDateString(),
        engagement: event.attendees.length,
        likes: event.attendees.length,
        likedBy: event.attendees.map(a => a.name)
      };

      // Attach event data for hero card rendering
      if (isUpcoming && isEligibleForRSVP) {
        (item.preview as any).heroEventData = event;
      }
      return item;
    });

    // Combine and sort by date
    const combined = [...filteredFeedItems, ...eventFeedItems].sort((a, b) => {
      const dateA = new Date(a.time);
      const dateB = new Date(b.time);
      return dateB.getTime() - dateA.getTime();
    });

    return combined;
  };

  // Update community badge logic
  useEffect(() => {
    const pending = eventsData.filter(e => e.status === 'noresponse').length;
    const badge = document.getElementById('community-badge');
    if (badge) {
      if (pending > 0) {
        badge.textContent = pending.toString();
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    }
  }, [eventsData]); // Recalculate if events data changes

  return (
    <div className="flex min-h-screen bg-[var(--bg-base)]">
      {/* Sidebar */}
      <div className="w-20 lg:w-56 p-4 lg:p-6 fixed h-full z-20 flex flex-col items-center lg:items-start bg-[var(--bg-elevated)] border-r border-[var(--border-color)]">
        <div className="w-10 h-10 rounded bg-[var(--accent)] flex items-center justify-center text-white font-bold text-xl mb-8">F</div>
        <nav className="flex-1 flex flex-col items-center lg:items-start space-y-4">
          <Link href="/" className="p-3 rounded hover:bg-[var(--bg-base)] flex flex-col items-center lg:flex-row lg:items-center w-full text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <FaHome className="text-lg" />
            <span className="hidden lg:inline ml-3 folio-ui">Home</span>
          </Link>
          <Link href="/inspire" className="p-3 rounded hover:bg-[var(--bg-base)] flex flex-col items-center lg:flex-row lg:items-center w-full text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <FaLightbulb className="text-lg" />
            <span className="hidden lg:inline ml-3 folio-ui">Inspire</span>
          </Link>
          <Link href="/community" className="p-3 rounded bg-[var(--accent)]/10 flex flex-col items-center lg:flex-row lg:items-center w-full text-[var(--accent)]" id="community-sidebar-link" style={{ position: 'relative' }}>
            <FaUsers className="text-lg" />
            <span className="hidden lg:inline ml-3 folio-ui">Community</span>
            <span id="community-badge" style={{ display: 'none', position: 'absolute', top: '8px', right: '10px', background: '#FF3B30', color: '#fff', fontSize: '0.75rem', fontWeight: '700', padding: '2px 7px', borderRadius: '9999px', zIndex: 10 }}>0</span>
          </Link>
          <div className="flex flex-col space-y-2 w-full">
            <button id="all-tab" className={`px-3 py-2 rounded folio-ui ${currentPanel === 'all' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-base)]'} w-full text-left`} onClick={() => setCurrentPanel('all')}>All</button>
            <button id="feed-tab" className={`px-3 py-2 rounded folio-ui ${currentPanel === 'feed' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-base)]'} w-full text-left`} onClick={() => setCurrentPanel('feed')}>Feed</button>
            <button id="events-tab" className={`px-3 py-2 rounded folio-ui ${currentPanel === 'events' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-base)]'} w-full text-left`} onClick={() => setCurrentPanel('events')}>Events</button>
          </div>
          <Link href="/editorials" className="p-3 rounded hover:bg-[var(--bg-base)] flex flex-col items-center lg:flex-row lg:items-center w-full text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <FaNewspaper className="text-lg" />
            <span className="hidden lg:inline ml-3 folio-ui">Editorials</span>
          </Link>
          <Link href="/shop" className="p-3 rounded hover:bg-[var(--bg-base)] flex flex-col items-center lg:flex-row lg:items-center w-full text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <FaStore className="text-lg" />
            <span className="hidden lg:inline ml-3 folio-ui">Shop</span>
          </Link>
          <Link href={getProfileLink()} className="p-3 rounded hover:bg-[var(--bg-base)] flex flex-col items-center lg:flex-row lg:items-center w-full text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <FaUser className="text-lg" />
            <span className="hidden lg:inline ml-3 folio-ui">Profile</span>
          </Link>
        </nav>
        <Button variant="accent" className="hidden lg:flex w-full mt-auto">
          <FaPlus className="mr-2" /> Design
        </Button>
        <button className="lg:hidden w-12 h-12 rounded-full bg-[var(--accent)] text-white flex items-center justify-center mt-auto">
          <FaPlus />
          <span className="sr-only">Design</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="ml-20 lg:ml-56 flex-1 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="w-full flex flex-col sm:flex-row items-center justify-between mb-8">
            <h1 className="folio-h1 text-[var(--text-primary)]">Community</h1>
          </div>

          {currentPanel === 'all' && (
            <div className="flex flex-col gap-8">
              <div className="flex gap-2 flex-wrap">
                <button className={`px-4 py-2 rounded-full folio-ui flex items-center ${feedFilter === 'following' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-base)]'}`} onClick={() => setFeedFilter('following')}><FaUserFriends className="mr-1" />Following</button>
                <button className={`px-4 py-2 rounded-full folio-ui flex items-center ${feedFilter === 'forYou' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-base)]'}`} onClick={() => setFeedFilter('forYou')}><FaStar className="mr-1" />For You</button>
                <button className={`px-4 py-2 rounded-full folio-ui flex items-center ${feedFilter === 'local' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-base)]'}`} onClick={() => setFeedFilter('local')}><FaMapPin className="mr-1" />Local</button>
                <button className={`px-4 py-2 rounded-full folio-ui flex items-center ${feedFilter === 'rising' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-base)]'}`} onClick={() => setFeedFilter('rising')}><FaBolt className="mr-1" />Rising</button>
              </div>
              <div>
                {getCombinedFeed().map((item, index) => (
                  <div key={`feed-${index}`}>
                    {(item.preview as any).heroEventData ? (
                      <EventCardComponent event={(item.preview as any).heroEventData} onRSVP={handleRSVP} isInline={true} />
                    ) : (
                      <CommunityFeedItem item={item} onLike={() => handleLike(`${item.user.name}-${item.preview.title}`)} isLiked={likedItems[`${item.user.name}-${item.preview.title}`] || false} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentPanel === 'feed' && (
            <div className="flex flex-col gap-8">
              <div className="flex gap-2 flex-wrap">
                <button className={`px-4 py-2 rounded-full folio-ui flex items-center ${feedFilter === 'following' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-base)]'}`} onClick={() => setFeedFilter('following')}><FaUserFriends className="mr-1" />Following</button>
                <button className={`px-4 py-2 rounded-full folio-ui flex items-center ${feedFilter === 'forYou' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-base)]'}`} onClick={() => setFeedFilter('forYou')}><FaStar className="mr-1" />For You</button>
                <button className={`px-4 py-2 rounded-full folio-ui flex items-center ${feedFilter === 'local' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-base)]'}`} onClick={() => setFeedFilter('local')}><FaMapPin className="mr-1" />Local</button>
                <button className={`px-4 py-2 rounded-full folio-ui flex items-center ${feedFilter === 'rising' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-base)]'}`} onClick={() => setFeedFilter('rising')}><FaBolt className="mr-1" />Rising</button>
              </div>
              <div>
                {communityFeed.map((group, groupIndex) => (
                  <div key={groupIndex}>
                    <h3 className="folio-h3 text-[var(--text-primary)] mb-4">{group.group}</h3>
                    <div className="space-y-4">
                      {filterFeedItems(group.items).map((item, index) => (
                        <div key={index}>
                          {item.preview.type === 'event' ? (
                             <EventCardComponent event={eventsData.find(e => e.title === item.preview.title) || {} as EventData} onRSVP={handleRSVP} isInline={true} />
                          ) : (
                            <CommunityFeedItem item={item} onLike={() => handleLike(`${item.user.name}-${item.preview.title}`)} isLiked={likedItems[`${item.user.name}-${item.preview.title}`] || false} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentPanel === 'events' && (
            <div className="flex flex-col gap-8">
              <div className={`w-full ${eventsVisible ? 'flex' : 'hidden'} flex-col relative`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="folio-h2 text-[var(--text-primary)]">Upcoming Events</h2>
                  <button className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-lg" title="Show/Hide Events" onClick={() => setEventsVisible(!eventsVisible)}>
                    {eventsVisible ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  <button className={`px-4 py-2 rounded-full folio-ui ${eventTypeFilter === 'all' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-base)]'}`} onClick={() => setEventTypeFilter('all')}>All</button>
                  <button className={`px-4 py-2 rounded-full folio-ui ${eventTypeFilter === 'open' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-base)]'}`} onClick={() => setEventTypeFilter('open')}>Open Invite</button>
                  <button className={`px-4 py-2 rounded-full folio-ui ${eventTypeFilter === 'invite' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-base)]'}`} onClick={() => setEventTypeFilter('invite')}>Invite Only</button>
                  <button className={`px-4 py-2 rounded-full folio-ui ${eventTypeFilter === 'attending' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-base)]'}`} onClick={() => setEventTypeFilter('attending')}>Attending</button>
                </div>
                <div>
                  {filterEventsItems(eventsData).length === 0 ? (
                    <div className='text-[var(--text-tertiary)] mt-8 text-center folio-body'>No events match this filter. Try adjusting your selections.</div>
                  ) : (
                    (() => {
                      let lastDay = '';
                      return filterEventsItems(eventsData).map((event, index) => {
                        const day = new Date(event.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
                        const dayHeader = day !== lastDay ? <div key={`header-${event.id}`} className='folio-h3 text-[var(--text-primary)] mb-2 mt-4'>{day}</div> : null;
                        lastDay = day;
                        return <div key={event.id}>{dayHeader}<EventCardComponent event={event} onRSVP={handleRSVP} isInline={false} /></div>;
                      });
                    })()
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
