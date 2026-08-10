import { beforeEach, vi } from 'vitest';
import { config } from '@vue/test-utils';

import MapEngine from '../src/runtime/components/MapEngine.vue';
import MapLayer from '../src/runtime/components/MapLayer.vue';
import MapPoint from '../src/runtime/components/MapPoint.vue';
import MapViewport from '../src/runtime/components/MapViewport.vue';
import BaseIconButton from '../playground/components/Base/BaseIconButton.vue';
import BasePill from '../playground/components/Base/BasePill.vue';
import MapContentOverlay from '../playground/components/MapContentOverlay.vue';

import {
	installFrameMock,
	installMatchMediaMock,
	installResizeObserverMock,
	resetFrames,
	resetMatchMedia,
	resetResizeObservers,
} from './mocks';

// Mirrors Nuxt's global component registration (module.ts addComponentsDir
// for the runtime, playground/components for the app) — templates reference
// these without imports.
// VTU stubs <Transition> by default, which silently skips the JS enter/leave
// hooks MapLayer's fades depend on — use the real component.
config.global.stubs = { transition: false, 'transition-group': false };

config.global.components = {
	MapContentOverlay,
	MapEngine,
	MapLayer,
	MapPoint,
	MapViewport,
	BaseIconButton,
	BasePill,
};

// jsdom is missing PointerEvent and the pointer-capture/scroll APIs the
// gesture handlers call. The events only need constructable shells with
// assignable fields; capture/scroll are behavior-free stubs.
if (typeof window.PointerEvent === 'undefined') {
	class PointerEvent extends MouseEvent {
		pointerId: number;

		constructor(type: string, init: PointerEventInit = {}) {
			super(type, init);
			this.pointerId = init.pointerId ?? 0;
		}
	}

	vi.stubGlobal('PointerEvent', PointerEvent);
}

Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollBy ??= () => {};

// (Re)installed before every test rather than once per file — spec files may
// call vi.restoreAllMocks/vi.unstubAllGlobals in their own afterEach, which
// would otherwise strip these for the rest of the file.
beforeEach(() => {
	installFrameMock();
	installResizeObserverMock();
	installMatchMediaMock();

	resetFrames();
	resetResizeObservers();
	resetMatchMedia();
	window.history.replaceState(null, '', '/');
});
