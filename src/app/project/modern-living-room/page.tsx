'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FaArrowLeft, FaTag, FaDownload, FaShareAlt, FaPencilAlt, FaFilePdf, FaPrint, FaTimes } from 'react-icons/fa';
import { useState } from 'react';

export default function ModernLivingRoomProjectPage() {
  // Mock data for the project
  const project = {
    title: "Modern Living Room",
    heroImage: "https://source.unsplash.com/random/1600x900?modern-living-room,interior",
    designer: {
      name: "Diana Matta",
      profileImage: "https://source.unsplash.com/random/800x800?portrait,woman,designer",
      profileLink: "/designer/diana-matta",
    },
    tags: ["Modern", "Minimalist", "Urban", "Neutral Palette"],
    intro: "This project focused on creating a serene and functional living space with a strong emphasis on clean lines, natural light, and sustainable materials. The goal was to blend comfort with contemporary aesthetics, providing a versatile environment for both relaxation and entertaining.",
    specs: {
      squareFootage: "350 sq ft",
      location: "New York City, USA",
      completionDate: "Spring 2023",
      materials: ["Oak Wood", "Recycled Concrete", "Linen Fabrics", "Brushed Steel"],
    },
    contentTimeline: [
      {
        type: "story",
        id: "story-1",
        title: "Initial Concept Sketch",
        imageUrl: "https://source.unsplash.com/random/400x600?sketch,interior-design",
        description: "Early sketches exploring spatial flow and furniture arrangement.",
        isPortrait: true,
      },
      {
        type: "video",
        id: "video-1",
        title: "Walkthrough: Virtual Tour",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ", // Placeholder YouTube embed
        description: "A virtual walkthrough showcasing the finalized layout and material choices.",
      },
      {
        type: "editorial",
        id: "editorial-1",
        title: "Material Palette Selection",
        imageUrl: "https://source.unsplash.com/random/800x500?materials,swatches",
        content: "Selecting the right materials was crucial. We opted for a palette that evokes calm and warmth, using natural wood tones, muted grays, and soft textures.",
      },
      {
        type: "story",
        id: "story-2",
        title: "Furniture Installation Day",
        imageUrl: "https://source.unsplash.com/random/400x600?furniture-installation",
        description: "Behind-the-scenes look at the furniture delivery and setup.",
        isPortrait: true,
      },
    ],
    taggedImages: [
      { id: "img-1", url: "https://source.unsplash.com/random/800x600?living-room-detail-1", tags: [{ product: "Eco Modular Sofa", link: "/product/eco-modular-sofa" }] },
      { id: "img-2", url: "https://source.unsplash.com/random/800x600?living-room-detail-2", tags: [{ product: "Geometric Coffee Table", link: "#/product/coffee-table" }] },
      { id: "img-3", url: "https://source.unsplash.com/random/800x600?living-room-detail-3", tags: [{ product: "Minimalist Floor Lamp", link: "#/product/floor-lamp" }] },
      { id: "img-4", url: "https://source.unsplash.com/random/800x600?living-room-detail-4", tags: [] },
    ],
    productBank: [
      { id: "prod-1", name: "Eco Modular Sofa", thumbnail: "https://source.unsplash.com/random/200x150?modular-sofa", link: "/product/eco-modular-sofa" },
      { id: "prod-2", name: "Geometric Coffee Table", thumbnail: "https://source.unsplash.com/random/200x150?coffee-table", link: "#/product/coffee-table" },
      { id: "prod-3", name: "Minimalist Floor Lamp", thumbnail: "https://source.unsplash.com/random/200x150?floor-lamp", link: "#/product/floor-lamp" },
      { id: "prod-4", name: "Handwoven Area Rug", thumbnail: "https://source.unsplash.com/random/200x150?area-rug", link: "#/product/area-rug" },
    ],
    engagement: {
      saves: 1200,
      likes: 3500,
      clickThroughs: 580,
    },
    designerQuote: {
      quote: "This project truly embodies the fusion of sustainable design with contemporary living. Every detail was meticulously chosen to create a space that inspires tranquility.",
      designerName: "Diana Matta",
      designerProfileImage: "https://source.unsplash.com/random/800x800?portrait,woman,designer"
    }
  };

  // State for image lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<any | null>(null);

  const openLightbox = (image: any) => {
    setSelectedImage(image);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setSelectedImage(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Back Button */}
      <div className="p-4 bg-white shadow-sm">
        <Link href={project.designer.profileLink} className="flex items-center text-blue-600 hover:underline">
          <FaArrowLeft className="mr-2" /> Back to Designer Profile
        </Link>
      </div>

      {/* Project Hero Section */}
      <section className="relative w-full h-96 md:h-[600px] overflow-hidden flex items-end p-8">
        <Image
          src={project.heroImage}
          alt={project.title}
          fill
          sizes="100vw"
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-80"></div>
        
        <div className="relative z-10 text-white w-full">
          <h1 className="text-5xl md:text-7xl font-bold mb-4">{project.title}</h1>
          <div className="flex items-center gap-3 mb-4">
            <Link href={project.designer.profileLink} className="flex items-center gap-3 group">
              <div className="relative w-12 h-12 rounded-full overflow-hidden">
                <Image
                  src={project.designer.profileImage}
                  alt={project.designer.name}
                  fill
                  className="object-cover"
                />
              </div>
              <span className="text-lg md:text-xl text-gray-300 group-hover:text-amber-300 transition-colors">
                By {project.designer.name}
              </span>
            </Link>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {project.tags.map(tag => (
              <span key={tag} className="bg-gray-700 text-gray-200 text-sm px-3 py-1 rounded-full flex items-center">
                <FaTag className="mr-1" /> {tag}
              </span>
            ))}
          </div>
          {/* Optional CTA */}
          <Link href={project.designer.profileLink} className="inline-block mt-6 px-6 py-3 bg-amber-500 text-black font-semibold rounded-full hover:bg-amber-600 transition">
            Request a Consultation with {project.designer.name}
          </Link>
        </div>
      </section>

      <main className="container mx-auto p-8 grid grid-cols-1 lg:grid-cols-4 gap-12">
        {/* Main Content Column */}
        <div className="lg:col-span-3 space-y-10">

          {/* Overview Section */}
          <section className="bg-white p-8 rounded-lg shadow-md">
            <h2 className="text-3xl font-bold mb-4">Overview</h2>
            <p className="text-gray-700 leading-relaxed mb-6">{project.intro}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
              {project.specs.squareFootage && <p><span className="font-semibold">Size:</span> {project.specs.squareFootage}</p>}
              {project.specs.location && <p><span className="font-semibold">Location:</span> {project.specs.location}</p>}
              {project.specs.completionDate && <p><span className="font-semibold">Completed:</span> {project.specs.completionDate}</p>}
              {project.specs.materials && project.specs.materials.length > 0 && (
                <p><span className="font-semibold">Materials:</span> {project.specs.materials.join(', ')}</p>
              )}
            </div>
          </section>

          {/* Story + Content Timeline */}
          <section className="space-y-8">
            <h2 className="text-3xl font-bold mb-6">Project Journey</h2>
            {project.contentTimeline.map((item) => (
              <div key={item.id} className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-2xl font-semibold mb-3">{item.title}</h3>
                {item.type === "story" && item.imageUrl && (
                  <div className="relative w-full h-80 rounded-lg overflow-hidden mb-4">
                    <Image src={item.imageUrl} alt={item.title} fill className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                  </div>
                )}
                {item.type === "video" && item.videoUrl && (
                  <div className="relative w-full h-96 mb-4 rounded-lg overflow-hidden">
                    <iframe
                      src={item.videoUrl}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute top-0 left-0 w-full h-full"
                    ></iframe>
                  </div>
                )}
                {item.type === "editorial" && item.imageUrl && (
                  <div className="relative w-full h-64 rounded-lg overflow-hidden mb-4">
                    <Image src={item.imageUrl} alt={item.title} fill className="object-cover" />
                  </div>
                )}
                <p className="text-gray-700 leading-relaxed">{item.description || item.content}</p>
                {/* Developer comment: Future integration for 'read more' for editorial posts */}
              </div>
            ))}
          </section>

          {/* Tagged Image Gallery */}
          <section className="bg-white p-8 rounded-lg shadow-md">
            <h2 className="text-3xl font-bold mb-6">Tagged Designs</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-min">
              {project.taggedImages.map((img) => (
                <div 
                  key={img.id} 
                  className="relative group cursor-pointer overflow-hidden rounded-lg shadow-sm hover:shadow-lg transition-all duration-300"
                  onClick={() => openLightbox(img)}
                >
                  <Image 
                    src={img.url} 
                    alt="Tagged design"
                    width={800}
                    height={600}
                    className="w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {img.tags && img.tags.length > 0 && (
                    <div className="absolute bottom-2 left-2 flex flex-wrap gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      {img.tags.map((tag, index) => (
                        <Link 
                          key={index} 
                          href={tag.link}
                          className="bg-black/70 text-white text-xs px-2 py-1 rounded-full hover:bg-black/90 transition-colors"
                          onClick={(e) => e.stopPropagation()} // Prevent lightbox from opening on tag click
                        >
                          {tag.product}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Developer comment: Implement image lightbox functionality for full screen view with product tooltips */}
          </section>

          {/* Product Bank (Shoppable Section) */}
          <section className="bg-white p-8 rounded-lg shadow-md">
            <h2 className="text-3xl font-bold mb-6">Products Used in This Project</h2>
            {/* Optional Filters - Developer comment: Implement category, brand, color filters */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {project.productBank.map((product) => (
                <div key={product.id} className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition">
                  <Link href={product.link}>
                    <Image src={product.thumbnail} alt={product.name} width={200} height={150} className="w-full h-28 object-cover" />
                    <div className="p-3">
                      <h3 className="font-semibold text-base mb-1">{product.name}</h3>
                      <button className="mt-2 bg-amber-500 text-black text-sm px-4 py-2 rounded-full font-semibold hover:bg-amber-600 transition">
                        Add to Mood Board
                      </button>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar Column */}
        <aside className="lg:col-span-1 space-y-8">
          {/* Smart Features - Engagement Stats */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Project Insights</h2>
            <div className="space-y-3">
              <p className="flex justify-between items-center text-lg">
                <span>Saves:</span> <span className="font-bold text-blue-600">{project.engagement.saves.toLocaleString()}</span>
              </p>
              <p className="flex justify-between items-center text-lg">
                <span>Likes:</span> <span className="font-bold text-red-600">{project.engagement.likes.toLocaleString()}</span>
              </p>
              <p className="flex justify-between items-center text-lg">
                <span>Product Clicks:</span> <span className="font-bold text-green-600">{project.engagement.clickThroughs.toLocaleString()}</span>
              </p>
            </div>
            {/* "Used in Projects" Badge - Adjusted for this context */}
            <div className="mt-6 bg-blue-100 border border-blue-200 text-blue-800 p-4 rounded-lg">
              <p className="font-bold text-center">Used in 17 Projects by 9 Designers</p> {/* Placeholder, will be dynamic */}
            </div>
            {/* "Saved to Mood Boards" - Adjusted for this context */}
            <div className="mt-4 bg-green-100 border border-green-200 text-green-800 p-4 rounded-lg">
              <p className="font-bold text-center">Saved to 21 Mood Boards</p> {/* Placeholder, will be dynamic */}
            </div>
          </div>

          {/* Featured Designer Quote */}
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
            <p className="italic text-gray-700 mb-4 text-lg">"{project.designerQuote.quote}"</p>
            <div className="flex items-center">
              <Image
                src={project.designerQuote.designerProfileImage}
                alt={project.designerQuote.designerName}
                width={40}
                height={40}
                className="rounded-full mr-3"
              />
              <p className="font-semibold text-blue-700">- {project.designerQuote.designerName}</p>
            </div>
          </div>

          {/* Project Files & Downloads */}
          <section className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Project Files & Downloads</h2>
            <div className="space-y-3">
              <button className="flex items-center w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-full font-medium hover:bg-gray-300 transition">
                <FaFilePdf className="mr-2" /> Project Summary (PDF)
              </button>
              <button className="flex items-center w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-full font-medium hover:bg-gray-300 transition">
                <FaDownload className="mr-2" /> Designer Boards (PDF)
              </button>
              <button className="flex items-center w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-full font-medium hover:bg-gray-300 transition">
                <FaDownload className="mr-2" /> Renderings (DWG, GLB)
              </button>
            </div>
          </section>

          {/* Share & Submit */}
          <section className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Share & Submit</h2>
            <div className="space-y-3">
              <button className="flex items-center w-full bg-blue-600 text-white px-4 py-2 rounded-full font-semibold hover:bg-blue-700 transition">
                <FaPencilAlt className="mr-2" /> Submit to Folio Editorial
              </button>
              <button className="flex items-center w-full bg-green-600 text-white px-4 py-2 rounded-full font-semibold hover:bg-green-700 transition">
                <FaPrint className="mr-2" /> Generate Print-Friendly Version
              </button>
              <button className="flex items-center w-full bg-gray-700 text-white px-4 py-2 rounded-full font-semibold hover:bg-gray-600 transition">
                <FaShareAlt className="mr-2" /> Share Link with Client
              </button>
            </div>
          </section>
        </aside>
      </main>

      {/* Lightbox for Tagged Images */}
      {lightboxOpen && selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={closeLightbox} // Close on backdrop click
        >
          <div 
            className="relative max-w-4xl max-h-[90vh]"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on image content
          >
            <button 
              onClick={closeLightbox} 
              className="absolute top-4 right-4 bg-white/20 text-white p-2 rounded-full z-10 hover:bg-white/40 transition"
            >
              <FaTimes className="text-xl" />
            </button>
            <Image 
              src={selectedImage.url} 
              alt="Full screen tagged design"
              width={1200} // Max width for lightbox image
              height={800} // Max height for lightbox image
              className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
            />
            {selectedImage.tags && selectedImage.tags.length > 0 && (
              <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
                {selectedImage.tags.map((tag: any, index: number) => (
                  <Link 
                    key={index} 
                    href={tag.link}
                    className="bg-amber-500 text-black text-sm px-3 py-1 rounded-full font-semibold hover:bg-amber-600 transition"
                    onClick={(e) => e.stopPropagation()} // Prevent lightbox from closing on tag click
                  >
                    {tag.product}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 