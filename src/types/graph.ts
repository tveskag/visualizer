export type Edge = {
  start: number;
  end: number;
  d: string;
}

export type Bases = 'X' | 'Y' | 'Z' | 'P'

export type Vertex = {
  n: number;
  cx: number;
  cy: number;
  basis: Bases;
  byproducts: Bases[];
  selected: boolean;
  input: boolean;
  output: boolean;
}

export type Dimensions = {
  width: number,
  height: number,
  margins: number,
}

export type Action = (mat: AdjacencyMatrix, vertices: Vertex[], vertex: Partial<Vertex> & {n: number}) => [AdjacencyMatrix, Vertex[]]

export type AdjacencyList = number[][]

export type AdjacencyMatrix = number[][]
