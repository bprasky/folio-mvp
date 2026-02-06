import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';

export default function UnrealDocsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-elevated)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <FaArrowLeft className="w-4 h-4" />
          Back to Projects
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Unreal Engine Integration Documentation</CardTitle>
            <CardDescription>
              How to consume Folio's 3D asset export JSON in Unreal Engine
            </CardDescription>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <div className="space-y-6">
              <section>
                <h2 className="text-2xl font-semibold mb-4">Overview</h2>
                <p className="text-gray-700">
                  Folio exports a structured JSON manifest containing all 3D-ready assets
                  for a project. This document describes how to consume this data in Unreal Engine.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">Export JSON Structure</h2>
                <pre className="bg-[var(--bg-elevated)] p-4 rounded-lg overflow-x-auto text-sm">
{`{
  "projectId": "string",
  "projectTitle": "string",
  "rooms": [
    {
      "id": "string",
      "name": "string",
      "type": "string"
    }
  ],
  "assets": [
    {
      "id": "string",
      "glbUrl": "string",
      "source": {
        "projectImageId": "string",
        "productId": "string"
      },
      "placementHint": {
        "room": "string",
        "surfaceType": "string"
      },
      "meta": {}
    }
  ],
  "exportedAt": "ISO8601 timestamp"
}`}
                </pre>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">Integration Steps</h2>
                <ol className="list-decimal list-inside space-y-3 text-gray-700">
                  <li>
                    <strong>Download the JSON:</strong> Use the "Download Unreal Export JSON" button
                    in the Unreal Export Panel to get the latest manifest.
                  </li>
                  <li>
                    <strong>Import GLB files:</strong> Download GLB files from the provided URLs
                    and import them into Unreal Engine as Static Mesh assets.
                  </li>
                  <li>
                    <strong>Parse the JSON:</strong> Use Unreal's JSON parsing utilities to read
                    the manifest and extract asset metadata.
                  </li>
                  <li>
                    <strong>Place assets:</strong> Use the placement hints to intelligently place
                    assets in your scene (e.g., countertops on surfaces, tiles on floors).
                  </li>
                  <li>
                    <strong>Apply materials:</strong> Use the metadata to apply appropriate materials
                    and textures to imported meshes.
                  </li>
                </ol>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">Asset URLs</h2>
                <p className="text-gray-700">
                  All GLB URLs in the export are publicly accessible. You can download them directly
                  or stream them into Unreal at runtime. Ensure your Unreal project has network
                  access configured if streaming.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">Placement Hints</h2>
                <p className="text-gray-700 mb-3">
                  The <code className="bg-[var(--bg-elevated)] px-1 rounded">placementHint</code> field provides
                  contextual information about where assets should be placed:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700">
                  <li><code>room</code>: Room name (e.g., "Kitchen", "Bathroom")</li>
                  <li><code>surfaceType</code>: Type of surface (e.g., "countertop", "floor", "wall")</li>
                </ul>
                <p className="text-gray-700 mt-3">
                  Use these hints to automatically place assets in your Unreal scene or to filter
                  assets by room/surface type.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">Metadata</h2>
                <p className="text-gray-700">
                  The <code className="bg-[var(--bg-elevated)] px-1 rounded">meta</code> field contains
                  additional asset-specific information such as dimensions, scale factors, and
                  material properties. This data can be used to configure materials, lighting,
                  and physics properties in Unreal.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">Example Blueprint Usage</h2>
                <p className="text-gray-700 mb-3">
                  In Unreal Blueprints, you can:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700">
                  <li>Use "Parse JSON" node to read the export manifest</li>
                  <li>Loop through the "assets" array</li>
                  <li>Use "HTTP Request" node to download GLB files</li>
                  <li>Import GLB files using Unreal's GLTF/GLB import plugin</li>
                  <li>Place meshes in the scene based on placement hints</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">Support</h2>
                <p className="text-gray-700">
                  For questions or issues with the Unreal integration, contact the Folio development team.
                </p>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}




