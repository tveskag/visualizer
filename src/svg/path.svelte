<script lang="ts">
	import { draw } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	/*
	in:draw={{
		duration: 10000,
		easing: quintOut
	}}
	*/

	export let d = '';
	export let fill = 'transparent';
	export let stroke = 'black';
	export let width = '2';
	export let linecap: any = 'round';
	export let linejoin: any = 'round';
</script>

<path
	class={`path`}
	{d}
	{fill}
	{stroke}
	stroke-width={width}
	stroke-linecap={linecap}
	stroke-linejoin={linejoin}
/>

<style lang="scss">
	.path {
		opacity: 1;
	}
</style>
