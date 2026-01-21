/**
 * Text Clustering & Image Association Module
 * Groups related text blocks and associates with nearby images
 */

import type { TextBlock, ImageRegion } from './extractText'
import { parseTextCluster, ParsedSpecification } from './patterns'

export interface TextCluster {
  blocks: TextBlock[]
  bounds: { x: number; y: number; width: number; height: number }
  page: number
  combinedText: string
}

export interface ItemAssociation {
  textCluster: TextCluster | null
  image: ImageRegion | null
  page: number
  specification: ParsedSpecification
}

export interface ClusteringOptions {
  maxVerticalGap: number    // default: 30px
  maxHorizontalGap: number  // default: 100px
}

const DEFAULT_CLUSTERING_OPTIONS: ClusteringOptions = {
  maxVerticalGap: 30,
  maxHorizontalGap: 100
}

/**
 * Calculates the distance between two bounding boxes
 */
function calculateBoxDistance(
  box1: { x: number; y: number; width: number; height: number },
  box2: { x: number; y: number; width: number; height: number }
): { vertical: number; horizontal: number } {
  // Calculate vertical distance
  const box1Bottom = box1.y + box1.height
  const box2Bottom = box2.y + box2.height

  let vertical = 0
  if (box1.y > box2Bottom) {
    vertical = box1.y - box2Bottom
  } else if (box2.y > box1Bottom) {
    vertical = box2.y - box1Bottom
  }

  // Calculate horizontal distance
  const box1Right = box1.x + box1.width
  const box2Right = box2.x + box2.width

  let horizontal = 0
  if (box1.x > box2Right) {
    horizontal = box1.x - box2Right
  } else if (box2.x > box1Right) {
    horizontal = box2.x - box1Right
  }

  return { vertical, horizontal }
}

/**
 * Merges two bounding boxes into one that contains both
 */
function mergeBounds(
  box1: { x: number; y: number; width: number; height: number },
  box2: { x: number; y: number; width: number; height: number }
): { x: number; y: number; width: number; height: number } {
  const x = Math.min(box1.x, box2.x)
  const y = Math.min(box1.y, box2.y)
  const right = Math.max(box1.x + box1.width, box2.x + box2.width)
  const bottom = Math.max(box1.y + box1.height, box2.y + box2.height)

  return {
    x,
    y,
    width: right - x,
    height: bottom - y
  }
}

/**
 * Clusters text blocks that are within proximity thresholds
 */
export function clusterTextBlocks(
  blocks: TextBlock[],
  options: Partial<ClusteringOptions> = {}
): TextCluster[] {
  const opts = { ...DEFAULT_CLUSTERING_OPTIONS, ...options }
  const clusters: TextCluster[] = []

  if (blocks.length === 0) return clusters

  // Sort blocks by page, then y, then x
  const sortedBlocks = [...blocks].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page
    if (Math.abs(a.bounds.y - b.bounds.y) > opts.maxVerticalGap) {
      return a.bounds.y - b.bounds.y
    }
    return a.bounds.x - b.bounds.x
  })

  // Track which blocks have been assigned to clusters
  const assigned = new Set<number>()

  for (let i = 0; i < sortedBlocks.length; i++) {
    if (assigned.has(i)) continue

    const block = sortedBlocks[i]
    const clusterBlocks: TextBlock[] = [block]
    let clusterBounds = { ...block.bounds }

    assigned.add(i)

    // Find all blocks that should be in this cluster
    let changed = true
    while (changed) {
      changed = false

      for (let j = 0; j < sortedBlocks.length; j++) {
        if (assigned.has(j)) continue

        const candidate = sortedBlocks[j]

        // Must be on the same page
        if (candidate.page !== block.page) continue

        // Check distance from cluster bounds
        const distance = calculateBoxDistance(clusterBounds, candidate.bounds)

        if (distance.vertical <= opts.maxVerticalGap &&
            distance.horizontal <= opts.maxHorizontalGap) {
          clusterBlocks.push(candidate)
          clusterBounds = mergeBounds(clusterBounds, candidate.bounds)
          assigned.add(j)
          changed = true
        }
      }
    }

    // Sort blocks within cluster by position (top to bottom, left to right)
    clusterBlocks.sort((a, b) => {
      if (Math.abs(a.bounds.y - b.bounds.y) > 5) {
        return a.bounds.y - b.bounds.y
      }
      return a.bounds.x - b.bounds.x
    })

    clusters.push({
      blocks: clusterBlocks,
      bounds: clusterBounds,
      page: block.page,
      combinedText: clusterBlocks.map(b => b.content).join(' ')
    })
  }

  return clusters
}

export interface AssociationOptions {
  maxDistance: number       // default: 200px
  preferredDirection: 'above' | 'left' | 'any'  // default: 'any'
}

const DEFAULT_ASSOCIATION_OPTIONS: AssociationOptions = {
  maxDistance: 200,
  preferredDirection: 'any'
}

/**
 * Calculates the center point of a bounding box
 */
function getCenter(bounds: { x: number; y: number; width: number; height: number }): { x: number; y: number } {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2
  }
}

/**
 * Calculates the Euclidean distance between two centers
 */
function centerDistance(
  bounds1: { x: number; y: number; width: number; height: number },
  bounds2: { x: number; y: number; width: number; height: number }
): number {
  const c1 = getCenter(bounds1)
  const c2 = getCenter(bounds2)
  return Math.sqrt(Math.pow(c1.x - c2.x, 2) + Math.pow(c1.y - c2.y, 2))
}

/**
 * Associates text clusters with nearby images
 */
export function associateClustersWithImages(
  clusters: TextCluster[],
  images: ImageRegion[],
  options: Partial<AssociationOptions> = {}
): ItemAssociation[] {
  const opts = { ...DEFAULT_ASSOCIATION_OPTIONS, ...options }
  const associations: ItemAssociation[] = []
  const assignedImages = new Set<number>()

  // Process each cluster
  for (const cluster of clusters) {
    let bestImage: ImageRegion | null = null
    let bestDistance = opts.maxDistance

    // Find the nearest unassigned image on the same page
    for (let i = 0; i < images.length; i++) {
      if (assignedImages.has(i)) continue

      const image = images[i]
      if (image.page !== cluster.page) continue

      const distance = centerDistance(cluster.bounds, image.bounds)

      // Apply direction preference
      if (opts.preferredDirection !== 'any') {
        const clusterCenter = getCenter(cluster.bounds)
        const imageCenter = getCenter(image.bounds)

        if (opts.preferredDirection === 'above' && clusterCenter.y < imageCenter.y) {
          continue // Cluster should be below the image (text above = cluster.y > image.y)
        }
        if (opts.preferredDirection === 'left' && clusterCenter.x < imageCenter.x) {
          continue // Cluster should be to the right of image
        }
      }

      if (distance < bestDistance) {
        bestDistance = distance
        bestImage = image
      }
    }

    if (bestImage) {
      const imageIndex = images.indexOf(bestImage)
      assignedImages.add(imageIndex)
    }

    associations.push({
      textCluster: cluster,
      image: bestImage,
      page: cluster.page,
      specification: parseTextCluster(cluster.blocks.map(b => b.content))
    })
  }

  // Handle orphaned images (images without associated text)
  for (let i = 0; i < images.length; i++) {
    if (assignedImages.has(i)) continue

    const image = images[i]
    associations.push({
      textCluster: null,
      image,
      page: image.page,
      specification: {
        brand: null,
        productName: null,
        price: null,
        currency: 'USD',
        dimensions: null,
        material: null,
        finish: null,
        sku: null,
        quantity: null,
        productUrl: null,
        rawText: []
      }
    })
  }

  return associations
}

/**
 * Groups items by page for easier processing
 */
export function groupByPage<T extends { page: number }>(items: T[]): Map<number, T[]> {
  const pageMap = new Map<number, T[]>()

  for (const item of items) {
    const pageItems = pageMap.get(item.page) || []
    pageItems.push(item)
    pageMap.set(item.page, pageItems)
  }

  return pageMap
}

/**
 * Filters clusters to only those likely containing product specifications
 */
export function filterProductClusters(clusters: TextCluster[]): TextCluster[] {
  return clusters.filter(cluster => {
    const text = cluster.combinedText

    // Must have some minimum content
    if (text.length < 10) return false

    // Look for indicators of product specifications
    const hasPrice = /\$[\d,]+/.test(text)
    const hasDimensions = /\d+["']\s*[WwLlDdHh]/.test(text) || /\d+\s*[×xX]\s*\d+/.test(text)
    const hasBrand = /[A-Z]{2,}/.test(text) // At least 2 consecutive uppercase letters
    const hasSKU = /(?:SKU|Item|Model|Style|Part)/i.test(text)

    // Return true if at least one product indicator is present
    return hasPrice || hasDimensions || (hasBrand && text.length > 20) || hasSKU
  })
}
