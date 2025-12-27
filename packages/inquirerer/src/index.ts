/**
 * inquirerer - Backwards compatibility package
 * 
 * This package has been renamed to 'genomic'.
 * Please migrate to 'genomic' for the latest features and updates.
 * 
 * @see https://www.npmjs.com/package/genomic
 */

// Re-export everything from genomic
export * from 'genomic';

// Re-export with old names for backwards compatibility
export { Prompter as Inquirerer, PrompterOptions as InquirererOptions } from 'genomic';
