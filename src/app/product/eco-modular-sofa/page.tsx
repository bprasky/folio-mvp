'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FaArrowLeft, FaBookmark, FaInfoCircle, FaCube, FaFilePdf, FaDownload, FaUsers, FaUserPlus, FaComments } from 'react-icons/fa';
import { useState } from 'react';

export default function EcoModularSofaPage() {
  const [selectedSwatch, setSelectedSwatch] = useState('Slate Gray');
  const [selectedDimension, setSelectedDimension] = useState('2-piece');

  // Mock data for the product (will be replaced by real data later)
  const product = {
    name: "Eco Modular Sofa",
    images: [
      "https://source.unsplash.com/random/1200x800?modern-sofa,living-room,interior",
      "https://source.unsplash.com/random/1200x800?sofa,design,sustainable",
      "https://source.unsplash.com/random/1200x800?modular-sofa,home,comfort",
    ],
    marketingCopy: "A sustainable, modular seating system designed for flexible modern living.",
    specs: [
      "FSC-certified wood frame",
      "Recycled foam cushions",
      "Oeko-Tex certified fabric options",
      "Easy-to-assemble modular design",
      "Low VOC finishes",
      "Hypoallergenic materials",
    ],
    swatches: [
      { name: "Slate Gray", color: "#64748B" },
      { name: "Sand", color: "#D6CFC1" },
      { name: "Olive", color: "#808000" },
    ],
    dimensions: [
      "2-piece: 80\"W x 40\"D x 30\"H",
      "3-piece: 120\"W x 40\"D x 30\"H",
      "L-shaped: 100\"W x 70\"D x 30\"H",
    ],
    projectsUsedIn: 17,
    designersUsing: 9,
    savedToMoodBoards: 21,
    featuredDesignerQuote: {
      quote: "This sofa transformed my client's living space with its adaptability and eco-conscious design.",
      designerName: "Sarah Chen",
      designerProfileImage: "https://randomuser.me/api/portraits/women/44.jpg"
    },
    seenInDesigns: [
      { id: 'inspire-post-1', image: 'https://source.unsplash.com/random/400x300?living-room-design,modern', designer: 'Alice Smith' },
      { id: 'inspire-post-2', image: 'https://source.unsplash.com/random/400x300?minimalist-interior,sofa-usage', designer: 'Bob Johnson' },
      { id: 'inspire-post-3', image: 'https://source.unsplash.com/random/400x300?contemporary-home,furniture', designer: 'Charlie Brown' },
    ],
    pairedProducts: [
      { id: 'product-lamp', name: 'Minimalist Floor Lamp', image: 'https://source.unsplash.com/random/300x200?floor-lamp', link: '#' },
      { id: 'product-rug', name: 'Handwoven Area Rug', image: 'https://source.unsplash.com/random/300x200?area-rug', link: '#' },
      { id: 'product-table', name: 'Geometric Coffee Table', image: 'https://source.unsplash.com/random/300x200?coffee-table', link: '#' },
    ],
    vendor: { name: "EcoFurnish", link: "/vendor" }
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800">
      {/* Back Button */}
      <div className="p-4 bg-white shadow-sm">
        <Link href="/inspire" className="flex items-center text-blue-600 hover:underline">
          <FaArrowLeft className="mr-2" /> Back to Inspire
        </Link>
      </div>

      {/* Hero Section */}
      <section className="relative w-full h-96 md:h-[600px] overflow-hidden group">
        {product.images.map((img, index) => (
          <Image
            key={index}
            src={img}
            alt={`${product.name} image ${index + 1}`}
            fill
            sizes="100vw"
            priority={index === 0} // Load first image with high priority
            className="object-cover transition-transform duration-500 ease-in-out transform group-hover:scale-105"
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-70"></div>
        <div className="absolute bottom-8 left-8 text-white z-10">
          <h1 className="text-5xl font-bold mb-2">{product.name}</h1>
          <div className="flex space-x-4 mt-4">
            <button className="bg-amber-500 text-black px-6 py-3 rounded-full font-semibold hover:bg-amber-600 transition">
              <FaBookmark className="inline-block mr-2" /> Add to Mood Board
            </button>
            <button className="bg-gray-700 text-white px-6 py-3 rounded-full font-semibold hover:bg-gray-600 transition">
              <FaInfoCircle className="inline-block mr-2" /> Request Info
            </button>
            <button className="bg-blue-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-blue-700 transition">
              <Link href="/project/modern-living-room" className="flex items-center">
                <FaCube className="inline-block mr-2" /> See in Projects
              </Link>
            </button>
          </div>
        </div>
      </section>

      <main className="container mx-auto p-8 grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Product Details Column */}
        <div className="lg:col-span-2 space-y-10">
          {/* Configurations & Downloads */}
          <section className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4">Configurations & Downloads</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Swatches */}
              <div>
                <label htmlFor="swatch" className="block text-lg font-medium text-gray-700 mb-2">Swatches</label>
                <div className="flex flex-wrap gap-3">
                  {product.swatches.map((swatch) => (
                    <button
                      key={swatch.name}
                      className={`w-12 h-12 rounded-full border-2 ${selectedSwatch === swatch.name ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      style={{ backgroundColor: swatch.color }}
                      onClick={() => setSelectedSwatch(swatch.name)}
                      title={swatch.name}
                    ></button>
                  ))}
                </div>
                <p className="mt-2 text-sm text-gray-500">Selected: {selectedSwatch}</p>
              </div>

              {/* Dimensions */}
              <div>
                <label htmlFor="dimensions" className="block text-lg font-medium text-gray-700 mb-2">Dimensions</label>
                <select
                  id="dimensions"
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  value={selectedDimension}
                  onChange={(e) => setSelectedDimension(e.target.value)}
                >
                  {product.dimensions.map((dim) => (
                    <option key={dim} value={dim}>{dim}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Download Buttons */}
            <div className="mt-8 border-t pt-6">
              <h3 className="text-xl font-semibold mb-3">Downloads</h3>
              <div className="flex flex-wrap gap-4">
                <button className="flex items-center bg-gray-200 text-gray-700 px-5 py-2 rounded-full font-medium hover:bg-gray-300 transition">
                  <FaDownload className="mr-2" /> 3D Files (.GLB)
                </button>
                <button className="flex items-center bg-gray-200 text-gray-700 px-5 py-2 rounded-full font-medium hover:bg-gray-300 transition">
                  <FaDownload className="mr-2" /> DWG
                </button>
                <button className="flex items-center bg-gray-200 text-gray-700 px-5 py-2 rounded-full font-medium hover:bg-gray-300 transition">
                  <FaFilePdf className="mr-2" /> PDF Specs
                </button>
              </div>
            </div>
          </section>

          {/* Used in Projects Section */}
          <section className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4">Used in Projects</h2>
            <div className="bg-blue-100 border border-blue-200 text-blue-800 p-4 rounded-lg text-center mb-6">
              <p className="text-xl font-bold">This product has been used in {product.projectsUsedIn} projects</p>
              <p className="text-md">by {product.designersUsing} designers.</p>
            </div>
            <Link href="/project/modern-living-room" className="block bg-amber-500 text-black px-6 py-3 rounded-full font-semibold text-center hover:bg-amber-600 transition">
              View the "Modern Living Room" Project
            </Link>
          </section>

          {/* Product Info */}
          <section className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4">Product Information</h2>
            <p className="text-gray-700 leading-relaxed mb-6">{product.marketingCopy}</p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              {product.specs.map((spec, index) => (
                <li key={index}>{spec}</li>
              ))}
            </ul>
          </section>

          {/* Social Proof Section */}
          <section className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4">Seen in These Designs</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {product.seenInDesigns.map((design) => (
                <div key={design.id} className="relative rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition">
                  <Image src={design.image} alt="Design example" width={400} height={300} className="w-full h-40 object-cover" />
                  <div className="p-3 bg-gray-50">
                    <p className="text-sm font-medium">Designed by {design.designer}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-center space-x-4">
              {/* Thumbnails for top designers */} 
              <h3 className="text-xl font-semibold mt-6 mb-4">Top Designers Using This Product:</h3>
              <div className="flex -space-x-2 overflow-hidden mb-4">
                <Image src="https://randomuser.me/api/portraits/men/60.jpg" alt="Designer 1" width={40} height={40} className="inline-block h-10 w-10 rounded-full ring-2 ring-white" />
                <Image src="https://randomuser.me/api/portraits/women/61.jpg" alt="Designer 2" width={40} height={40} className="inline-block h-10 w-10 rounded-full ring-2 ring-white" />
                <Image src="https://randomuser.me/api/portraits/men/62.jpg" alt="Designer 3" width={40} height={40} className="inline-block h-10 w-10 rounded-full ring-2 ring-white" />
              </div>
            </div>
          </section>

          {/* Ecosystem Integration - Complete the Look */}
          <section className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4">Complete the Look</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {product.pairedProducts.map((p) => (
                <Link href={p.link} key={p.id} className="block border rounded-lg overflow-hidden hover:shadow-lg transition">
                  <Image src={p.image} alt={p.name} width={300} height={200} className="w-full h-32 object-cover" />
                  <div className="p-3">
                    <h3 className="font-semibold text-base">{p.name}</h3>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link href={product.vendor.link} className="bg-green-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-green-700 transition flex items-center">
                <FaUserPlus className="mr-2" /> Follow {product.vendor.name}
              </Link>
              <button className="bg-purple-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-purple-700 transition flex items-center">
                <FaComments className="mr-2" /> Request Designer Consultation
              </button>
            </div>
          </section>
        </div>

        {/* Sidebar / Smart Features Column */}
        <aside className="space-y-8">
          {/* "Saved to Mood Boards" Badge */}
          <div className="bg-white p-6 rounded-lg shadow-md text-center">
            <p className="text-4xl font-bold text-green-600">{product.savedToMoodBoards}</p>
            <p className="text-lg text-gray-600 mt-2">Saved to Mood Boards</p>
          </div>

          {/* Featured Designer Quote */}
          <div className="bg-blue-50 p-6 rounded-lg shadow-md border-l-4 border-blue-500">
            <p className="italic text-lg text-gray-700 mb-4">"{product.featuredDesignerQuote.quote}"</p>
            <div className="flex items-center">
              <Image
                src={product.featuredDesignerQuote.designerProfileImage}
                alt={product.featuredDesignerQuote.designerName}
                width={40}
                height={40}
                className="rounded-full mr-3"
              />
              <p className="font-semibold text-blue-700">- {product.featuredDesignerQuote.designerName}</p>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}