import { onMounted, onBeforeUnmount } from 'vue';

export function onUpdate(callback: (delta: number) => void): void {
	let animationFrameLast: number | undefined;
	let animationFrameId: number | undefined;

	function onUpdate() {
		const now = performance.now();
		const delta = now - (animationFrameLast ?? now);
		animationFrameLast = now;

		callback(delta);
		animationFrameId = requestAnimationFrame(onUpdate);
	}

	onMounted(() => {
		onUpdate();
	});

	onBeforeUnmount(() => {
		if (animationFrameId !== undefined) {
			cancelAnimationFrame(animationFrameId);
		}
	});
}
