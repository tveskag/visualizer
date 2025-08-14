<script lang="ts">
	export let cx: number;
	export let cy: number;
	export let r: number = 1;
	export let fill: string = 'black';
	export let stroke: string = 'transparent';
	export let clas: string = '';
</script>

<circle
	{cx}
	{cy}
	{r}
	{fill}
	{stroke}
	class={`pointer ${clas}`}
/>

<style lang="scss">
	.pointer {
		cursor: pointer;
	}
	/*
	circle {
		transition: all 0.3s ease-out;
	}
	*/
</style>
