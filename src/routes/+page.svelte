<script lang="ts">

  import {
    BehaviorSubject,
    map,
    combineLatestWith,
    withLatestFrom,
    first,
    mergeMap,
  } from 'rxjs';

	import Path from '../svg/path.svelte';

	import type {
	  Vertex,
	  AdjacencyMatrix,
	  Action,
	  Dimensions,
	  Bases,
	} from '../types/graph';

	import {
	  drawEdges,
	  squareLattice,
	  scaleVertices,
	  circleGraph,
	  removeEdges,
	  edgesFromMat,
	  lcMat,
	  generateSquare,
	  aListFromRow,
	} from '../types/util';
	import type { EventHandler, MouseEventHandler } from 'svelte/elements';

	const x = 17
	const y = 5
	let dimensions: Dimensions = {
	  width: x*80,
	  height: y*80,
	  margins: 20,
	}
	let radius = 10
	let loadElement: HTMLInputElement

	//const aList: AdjacencyList = [[1,3], [0,2,4], [1,5], [0,4,6], [1,3,5,7], [2,4,8], [3,7], [4,6,8], [5,7]]
	const aMat = generateSquare(x,y)
	const lat = squareLattice(x,y)
	const initVerts = scaleVertices(lat, dimensions)

	//console.log('\n',...aMat.map(row => [row.toString().replaceAll('0','-'), '\n']).flat())
	//console.log(...lat.map(({cx, cy}) => [`cx: ${cx}, cy: ${cy}`, '\n']).flat())
	//console.log(initVerts)

	const identity: Action = (mat, verts, _) => [mat, verts]

	const replay = new Array<[AdjacencyMatrix, Vertex[]]>()
	const adjacency = new BehaviorSubject<AdjacencyMatrix>(aMat)
	const vertices = new BehaviorSubject<Vertex[]>(initVerts)
	const vertex = new BehaviorSubject<Vertex>(initVerts[0])

  const edges = adjacency.pipe(
    map(edgesFromMat),
    combineLatestWith(vertices),
    map(([es,vs]) => drawEdges(es, vs)),
  )
  const arrange = (arrangement: Vertex[]) => {
    vertices.next(scaleVertices(arrangement, dimensions))
  }

	const undo = () => {
	  const state = replay.pop()
	  if (state) {
  	  const [mat, verts] = state
	    vertices.next(verts)
	    adjacency.next(mat)
	  }
	}

	const localComplement: Action = (mat, vertices, {n: vertex}) =>
	  [
	    lcMat(mat, vertex),
	    neighborByproducts('Z')(mat, byproduct('X')(vertices, vertex), vertex),
	  ]

	const projection = (basis: Bases, byproduct: Bases): Bases => {
	  const bases: Set<Bases> = new Set(['X','Y','Z'])
  	const remaining = bases.symmetricDifference(new Set([basis, byproduct]))
  	return remaining.size === 1 ? remaining.values().next().value ?? basis : basis
	}

	const propagate = ({basis, byproducts}: Vertex): Bases => {
	  return byproducts.reduce((acc, byproduct) => projection(acc, byproduct), basis)
	}

	const firstIndex = (mat: AdjacencyMatrix, vertex: number): number => mat[vertex].findIndex(n => n === 1)

	const closestLow = (mat: AdjacencyMatrix, vertex: number): number =>
	  aListFromRow(mat[vertex]).filter(e => e > vertex).at(0) ?? firstIndex(mat,vertex)

	const closestHigh = (mat: AdjacencyMatrix, vertex: number): number =>
	  aListFromRow(mat[vertex]).filter(e => e < vertex).at(-1) ?? firstIndex(mat,vertex)

	const selectedFirst = (mat: AdjacencyMatrix, vertices: Vertex[], vertex: number): number =>
	  vertices.reduce<number | null>((acc, v, i) => v.selected && mat[vertex][i] ? i : acc, null) ?? closestHigh(mat, vertex)

	const measure: Action = (mat, vertices, vertex) => {
	  const basis = propagate(vertices[vertex.n])
	  const select = {
	    'X': measureX(selectedFirst),
	    'Y': measureY,
	    'Z': measureZ,
	    'P': identity,
	  }
	  return select[basis](mat, vertices, vertex)
	}

	const byproduct = (byproduct: Bases) => (vertices: Vertex[], vertex: number) => {
	  const vert = vertices[vertex]
	  const byproducts = [...vert.byproducts, byproduct]
    return vertices.toSpliced(vertex, 1, {...vert, byproducts})
  }

	const neighborByproducts = (bp: Bases) => (mat: AdjacencyMatrix, vertices: Vertex[], vertex: number) =>
	  mat[vertex].reduce((acc, adj, neighbor) => adj ? byproduct(bp)(acc, neighbor) : acc, vertices)

	const measureX = (strategy: (mat: AdjacencyMatrix, vertices: Vertex[], vertex: number) => number): Action => (mat, vertices, {n: vertex}) => {
	  const neighbor = strategy(mat, vertices, vertex) 
    if (mat[vertex][neighbor]) {
      const afterIndex = neighbor > vertex ? neighbor - 1 : neighbor 
  	  return [
  	    lcMat(removeEdges(lcMat(lcMat(mat, neighbor), vertex), vertex), afterIndex),
  	    byproduct('Y')(vertices, neighbor).toSpliced(vertex, 1),
  	  ]
	  }
	  return [mat, vertices]
	}
	const measureY: Action = (mat, vertices, {n: vertex}) =>
	  [
	    removeEdges(lcMat(mat, vertex), vertex),
	    neighborByproducts('Z')(mat, vertices, vertex).toSpliced(vertex, 1),
	  ]

	const measureZ: Action = (mat, vertices, {n: vertex}) =>
	  [
	    removeEdges(mat, vertex),
	    vertices.toSpliced(vertex, 1),
	  ]

	const changeVertex: Action = (mat, vertices, vertex) => {
	  const vert = vertices[vertex.n]
	  const verts = vertices.toSpliced(vertex.n, 1, {...vert, ...vertex, n: vert.n})
	  return [mat, verts]
  }

	const changeBasis = (basis: Bases): Action => (mat, vertices, vertex) =>
	  changeVertex(mat, vertices, {...vertex, basis}) 

	const setIO = (io: boolean): Action => (mat, vertices, vertex) =>
	  io ? changeVertex(mat, vertices, {...vertex, input: !vertex.input}) : changeVertex(mat, vertices, {...vertex, output: !vertex.output})

	const update = ([mat, verts]: ReturnType<Action>) => {
	  adjacency.next(mat)
	  vertices.next(verts)
	  replay.push([mat, verts])
	}

	const action = (act: Action) => {
    vertices.pipe(
      first(),
      mergeMap(verts => verts.filter(v => v.selected)),
      withLatestFrom(adjacency, vertices),
  	  map(([vertex, mat, verts]) => {
  	    const i = verts.findIndex(v => v.n === vertex.n)
  	    const vert = {...vertex, n:i}
    	  return act(mat, verts, vert)
  	  })
    ).subscribe(update)
	}

  const blob = vertices.pipe(
    withLatestFrom(adjacency),
    map(([verts, mat]) => ({vertices: verts, adjacency: mat})),
    //tap(data => console.log(data)),
    map(data => new Blob([JSON.stringify(data)], { type: 'application/json' })),
    map(b => URL.createObjectURL(b)) 
  )

	const load = (files: FileList | null) => {
    const reader = new FileReader() 
    reader.onload = (e) => {
      const {vertices: verts, adjacency: mat}: {vertices: Vertex[], adjacency: AdjacencyMatrix} = JSON.parse(e.target?.result as string || '')
      //console.log(verts.length)
      //console.log(mat[0].length)
      adjacency.next(mat)
      vertices.next(verts)
    }
    if (files) {
      reader.readAsText(files[0]);
    }
	}

	vertex.pipe(
	  withLatestFrom(vertices),
	  map(([{n, selected}, verts]) => changeVertex([], verts, {n, selected: !selected}))
	).subscribe(([, verts]) => {
	  vertices.next(verts)
	})

	const selectCondition = (condition: Parameters<Array<Vertex>["filter"]>[0]) => {
	  vertices.pipe(
	    first(),
	    mergeMap(vs => vs.filter(condition).map((v, i) => ({...v, n: i}))),
    ).subscribe((vert) => {
      vertex.next(vert)
    })
	}

	const selectAll = () => selectCondition(v => !v.selected)
	const selectHalf = () => selectCondition((_, i) => i%2)
	const selectBasis = (basis: Bases) => selectCondition(v => propagate(v) === basis)

	/*
	const moveCursor: MouseEventHandler<SVGElement> = ({offsetX, offsetY, clientX, clientY, buttons, currentTarget}) =>
	  buttons === 1 ?
  	  (console.log(clientX), action.next(moveVertex({
  	    cx: offsetX, //clientX - currentTarget.getBoundingClientRect().x,
  	    cy: offsetY, //clientY - currentTarget.getBoundingClientRect().y,
  	  }))) : null
  */

	//const setColor = (basis: number) => `hsl(${100*basis/Math.PI + 250},80%,40%)`
	const setColor = (vertex: Vertex) => ({
	  'X': `hsl(250,80%,40%)`,
	  'Y': `hsl(110,80%,40%)`,
	  'Z': `hsl(0,80%,80%)`,
	  'P': `hsl(350,80%,40%)`,
  }[propagate(vertex)])

	const moveVertex = ({cx, cy}: {cx: number, cy: number}): Action => (mat, vertices, vertex) => {
	  return changeVertex(mat, vertices, {...vertex, cx, cy}) 
	}

  let move = false
  const mover: MouseEventHandler<SVGElement> = ({clientX, clientY, currentTarget}) => {
    if (move) {
      const {x,y} = currentTarget.getBoundingClientRect()
      console.log(x)
      action(moveVertex({cx: clientX - x - dimensions.margins, cy: clientY - y - dimensions.margins}))
    }
  }

  const selector = (vert: Vertex) => vertex.next(vert)
  const actor = (vert: Vertex) => {
    vertices.pipe(
      first(),
      withLatestFrom(adjacency),
  	  map(([mat, verts]) => currentAction(verts, mat, vert))
    ).subscribe(update)
  }

  const setXNeighbor: Action = (mat, verts, {n}) => {
    const neighbor = verts[n]
    currentAction = (m, vs, v) => {
      currentAction = measureAct
      return measureX(() => v.n)(m, vs, neighbor)
    }
    return identity(mat, verts.toSpliced(n, 1, {...neighbor, selected: true}), neighbor)
  }

	const measureAct: Action = (mat, vertices, vertex) => {
	  const basis = propagate(vertices[vertex.n])
	  const select = {
	    'X': setXNeighbor,
	    'Y': measureY,
	    'Z': measureZ,
	    'P': identity,
	  }
	  return select[basis](mat, vertices, vertex)
	}
  let actnow = false
  let currentAction: Action = measureAct

	const complementEdge: Action = (mat, vertices, {n: vertex}) => {
	  const m: Action = (mat, vertices, {n: neighbor}) => {
	    var next = mat
	    next[vertex][neighbor] = next[vertex][neighbor] ? 0 : 1
	    next[neighbor][vertex] = next[neighbor][vertex] ? 0 : 1
  	  currentAction = complementEdge
  	  return [next, vertices]
	  }
	  currentAction = m
	  return [mat, vertices]
	}


</script>

<div class="container">

  <!--button type="button" onclick={_ => arrange(circleGraph(x*y, 1))}>
    circle
  </button>
  <button type="button" onclick={_ => arrange(squareLattice(x,y))}>
    lattice
  </button>-->
  <button type="button" onclick={_ => move = !move} aria-pressed={move ? 'true' : 'false'}>
    move
  </button>

  <span>|</span>
  <button type="button" onclick={_ => !actnow ? action(localComplement) : currentAction = localComplement}>LC</button>
  <button type="button" onclick={_ => currentAction = complementEdge}>
    connect/disconnect
  </button>
  <!--<button type="button" onclick={_ => !actnow ? action(removeEdge) : currentAction = removeEdge}>remove edges</button>-->
  <button type="button" onclick={_ => !actnow ? action(measure) : currentAction = measureAct}>measure</button>
  <span>|</span>

  <button type="button" onclick={_ => !actnow ? action(changeBasis('X')) : currentAction = changeBasis('X')}>X</button>
  <button type="button" onclick={_ => !actnow ? action(changeBasis('Y')) : currentAction = changeBasis('Y')}>Y</button>
  <button type="button" onclick={_ => !actnow ? action(changeBasis('Z')) : currentAction = changeBasis('Z')}>Z</button>
  <button type="button" onclick={_ => !actnow ? action(changeBasis('P')) : currentAction = changeBasis('P')}>P</button>
  <span>|</span>
  <button type="button" onclick={_ => !actnow ? action(setIO(1)) : currentAction = setIO(1)}>Set input</button>
  <button type="button" onclick={_ => !actnow ? action(setIO(0)) : currentAction = setIO(0)}>Set output</button>

  <span>|</span>
  <button type="button" onclick={_ => undo()}>
    undo
  </button>
  <button type="button" onclick={_ => selectAll()}>
    select all
  </button>
  <button type="button" onclick={_ => actnow = !actnow}>
    action
  </button>
  
  <a type="button" download="pattern.json" href={$blob}><button>save</button></a>
  <input type="file"
    bind:this={loadElement}
    onchange={_ => load(loadElement.files)}
  />
</div>

<svg class="Chart" width={dimensions.width} height={dimensions.height}
	onmouseup={mover}
	onfocus={(e) =>	e}
	role="none"
>
	<g transform={`translate(${dimensions.margins}, ${dimensions.margins})`}>

  {#each $edges as {d}}
    <Path {d}></Path>
  {/each}
  {#each $vertices as vert, i}
    <g
      onclick={_ => actnow ? actor({...vert, n:i}) : selector({...vert, n:i})}
    	class={move && !vert.selected ? 'move' : 'pointer'}
  		role="none"
    >
      <!--<text y={cy + 5} x={cx - 5} fill="red">{basis}</text>-->
      {#if vert.input}
        <rect
          x={vert.cx-(radius+3)}
          y={vert.cy-(radius+3)}
          width={2*radius+6}
          height={2*radius+6}
          stroke="black"
          stroke-width="2"
          fill-opacity="0"
        />
      {/if}
      <circle
      	cx={vert.cx}
      	cy={vert.cy}
        r={radius}
      	fill={setColor(vert)}
      	stroke={vert.selected ? "red" : "transparent"}
      	stroke-width="4"
      	role="none"
      />
      {#if vert.output}
      <circle
      	cx={vert.cx}
      	cy={vert.cy}
        r={radius-3}
      	fill="white"
      	stroke={"transparent"}
      	role="none"
      />
      {/if}

      <!--<Circle {cy} {cx}
        r={radius}
    		fill={setColor(basis)}
      ></Circle>-->
    </g>
  {/each}
</svg>

<style lang="scss">
	.animate {
		transition: all 0.3s ease-out;
	}
	.pointer {
		cursor: pointer;
	}
	.move {
	  cursor: move;
	}
</style>

<!--
-->
