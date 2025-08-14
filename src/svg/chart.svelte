<script lang="ts">
	import Group from './group.svelte';

	export let dimensions = {
		width: 100,
		height: 100,
		margins: 10,
	};
</script>

<svg class="Chart" width={dimensions.width} height={dimensions.height}>
	<Group left={dimensions.margins} top={dimensions.margins}>
		<slot />
	</Group>
</svg>
