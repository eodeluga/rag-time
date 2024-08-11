import { CreateEmbedding } from '@@models/CreateEmbedding'

export interface TextEmbedding extends CreateEmbedding{
  text: string
}
