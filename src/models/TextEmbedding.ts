import { VectorEmbedding } from '@@models/VectorEmbedding'

export interface TextEmbedding extends VectorEmbedding{
  text: string
}
