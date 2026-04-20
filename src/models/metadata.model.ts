/**
 * Flat, serialisable key–value metadata attached to ingested content.
 *
 * Values are restricted to primitive types to ensure compatibility with
 * vector store payload constraints and JSON serialisation.
 *
 * @example
 * const metadata: Metadata = { source: 'report-2024.pdf', page: 3, verified: true }
 */
export type Metadata = Record<string, boolean | number | string>
