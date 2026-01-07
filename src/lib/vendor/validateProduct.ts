import { ProductDraft, ValidationResult, ValidationError } from '@/types/vendor-product';

export function validateProduct(product: Partial<ProductDraft>): ValidationResult {
  const errors: ValidationError[] = [];

  // Name validation
  if (!product.name || product.name.trim().length < 3) {
    errors.push({
      field: 'name',
      message: 'Product name must be at least 3 characters',
    });
  }

  // Vendor ID validation
  if (!product.vendorId) {
    errors.push({
      field: 'vendorId',
      message: 'Vendor ID is required',
    });
  }

  // Hero media validation
  if (!product.heroMedia) {
    errors.push({
      field: 'heroMedia',
      message: 'Hero media (video or image) is required',
    });
  }

  // Description validation
  if (!product.description || product.description.trim().length < 40) {
    errors.push({
      field: 'description',
      message: 'Description must be at least 40 characters',
    });
  }

  // Specifications validation (at least one required)
  const hasSpecs = 
    product.dimensions ||
    (product.materials && product.materials.length > 0) ||
    product.finish;

  if (!hasSpecs) {
    errors.push({
      field: 'specs',
      message: 'At least one specification (dimensions, materials, or finish) is required',
    });
  }

  // Alt text validation for hero
  if (product.heroMedia && product.heroMedia.type === 'image' && !product.heroMedia.alt) {
    errors.push({
      field: 'heroMedia.alt',
      message: 'Alt text is required for hero image',
    });
  }

  // Gallery alt text validation
  if (product.gallery) {
    product.gallery.forEach((item, index) => {
      if (item.type === 'image' && !item.alt) {
        errors.push({
          field: `gallery[${index}].alt`,
          message: `Alt text is required for gallery image ${index + 1}`,
        });
      }
    });
  }

  // File type validation
  if (product.files?.specSheets) {
    product.files.specSheets.forEach((file, index) => {
      if (!file.url.toLowerCase().endsWith('.pdf')) {
        errors.push({
          field: `files.specSheets[${index}]`,
          message: 'Spec sheets must be PDF files',
        });
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function getFieldError(errors: ValidationError[], field: string): string | undefined {
  return errors.find(e => e.field === field)?.message;
}




