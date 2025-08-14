import type {AdjacencyMatrix, AdjacencyList, Vertex, Edge, Dimensions} from './graph'

// list must be well-formed
export const aMatFromList =
  (list: AdjacencyList): AdjacencyMatrix =>
  list.map(
    entry => list.map(
      (_, i) => entry.includes(i) ? 1 : 0
    )
  )

// mat must be well-formed
export const aListFromRow = 
  <i extends number>(row: AdjacencyMatrix[i]): AdjacencyList[i] =>
  row.reduce<number[]>(
    (acc, cur, i) => cur ? acc.concat(i) : acc
  , [])

export const aListFromMat = (mat: AdjacencyMatrix): AdjacencyList => mat.map(aListFromRow)

export const scaleVertices =
  (vertices: Vertex[], {width, height, margins}: Dimensions) => {
    const xs = vertices.map(({cx}) => cx)
    const ys = vertices.map(({cy}) => cy)
    const [minX, maxX] = [Math.min(...xs), Math.max(...xs)]
    const [minY, maxY] = [Math.min(...ys), Math.max(...ys)]
    const scale = (param: number) => (param-2*margins)
    return vertices.map(({cx, cy, ...rest}) => ({
      ...rest,
      cx: (cx/(maxX-minX)-minX)*scale(width),
      cy: (cy/(maxY-minY)-minY)*scale(height)
    }))
  }

export const edgesFromList =
  (alist: AdjacencyList) =>
    alist.reduce<Edge[]>((edges, connect, i) =>
      edges.concat(connect.map(target =>
        ({start: i, end: target, d: ''})
      )), [])

export const edgesFromMat =
  (alist: AdjacencyMatrix) =>
    alist.reduce<Edge[]>((edges, connect, i) =>
      edges.concat(
        connect.reduce<Edge[]>(
          (acc, cur, j) => cur ? [...acc, {start: i, end: j, d: ''}] : acc
        , [])
      ), [])

export const drawEdges =
  (edges: Edge[], vertices: Vertex[]) => {
    return edges.map(edge => {
      const {cx: startx, cy: starty} = vertices[edge.start]
      const {cx: endx, cy: endy} = vertices[edge.end]
      const d = `M ${startx} ${starty} L ${endx} ${endy}`
      return {...edge, d}
    })
  }

// needs symmetric aList
export const lcList =
  (list: AdjacencyList, vertex: number) => {
	  const neighbors = list[vertex]
	  for (let n of neighbors) {
	    const intersect = list[n].filter(e => neighbors.includes(e))
	    const remain = list[n].filter(e => !neighbors.includes(e))
	    list[n] = remain.concat(neighbors.filter(e => e !== n && !intersect.includes(e)))
	  }
	  return list
}

export const lcMat =
  (mat: AdjacencyMatrix, vertex: number) => {
    const neighbors = mat[vertex]
    return mat.map((connect,i) => neighbors[i] ? connect.map((m,j) => neighbors[j] && i !== j ? Number(!m) : m) : connect)
}

export const removeEdges = (mat: AdjacencyMatrix, vertex: number) => {
  return mat.toSpliced(vertex, 1).map(connect => connect.toSpliced(vertex, 1))
}

export const lcByproducts = (mat: AdjacencyMatrix, verts: Vertex[], vertex: number) => // TODO fix
  verts.map((vert, i) => mat[vertex][i] ?
    {...vert, basis: vert.basis} :
    (i === vertex ?
      {...vert, basis: vert.basis} :
      vert
    )
  )


const unDirect = (mat: AdjacencyMatrix): AdjacencyMatrix => mat.map((row, i) => row.map((_, j) => mat[i][j] || mat[j][i]))

const generateAdjacency = (condition: (i: number, j: number, x: number, y:number) => boolean | number) =>
  (x: number, y: number): AdjacencyMatrix => {
    const list = new Array(x*y).fill(0);
    return unDirect(list.map((_, i) => list.map((_, j) => condition(i,j,x,y) && (i !== j) ? 1 : 0)))
  }

export const generateCircle = generateAdjacency((i, j, x, y) => i === j+x)

export const generateSquare = generateAdjacency((i, j, x, y) =>
 (i%x && i === j+1)
 || (i === j+x)
)
export const generateHex = generateAdjacency((i, j, x, y) =>
 (i%x && i === j+1)
 || (i === j+x && (j+((x+1)%2 && Math.floor(i/x)%2))%2)
)

export const generateHeavyhex = generateAdjacency((i, j, x, y) =>
 (i%x && i === j+1 && Math.floor(i/x+1)%2)
 || (i === j+x && (j+((x+1)%2 && Math.floor(i/x)%2))%2)
)

export const generateTriangular = generateAdjacency((i, j, x, y) =>
 (i%x && i === j+1)
 || (i === j+x)
 || (i === j+x-1 && ((i+1)%x))
)

const generateLattice = (mapping: (x: number, y: number, i: number) => ({cx: number, cy: number})) =>
  (dx: number, dy: number): Vertex[] => {
    const empty = new Array(dx*dy).fill(0);
    return empty.map((_, i) => ({
      n: i,
      basis: 'X',
      byproducts: [],
      selected: false,
      ...mapping(dx, dy, i),
    }))
}

export const squareLattice = generateLattice((x, y, i) => ({
  cx: (i%x)/(x-1),
  cy: Math.floor(i/x)/(y-1),//Math.floor(i/y)/(y-1) + Math.floor(i%x)/(y-1), 
}))

export const hexLattice = generateLattice((x, y, i) => ({
  cx: (i%x)/(x-1),// + (i%2)/((y+1)*(x+1)),
  cy: Math.floor(i/x)/(y-1) + (i%2)/(y*2),
}))

export const triangularLattice = generateLattice((x, y, i) => ({
  cx: (i%x)/(x-1) + (i)/((y+1)*(x+1)),
  cy: Math.floor(i/x)/(y-1),//Math.floor(i/y)/(y-1) + Math.floor(i%x)/(y-1), 
}))

export const circleGraph = generateLattice((x, y, i) => ({
  cx: 0.5 + 0.5*Math.cos(i*2*Math.PI/(x*y)),
  cy: 0.5 + 0.5*Math.sin(i*2*Math.PI/(x*y)), 
}))
