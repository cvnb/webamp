import * as Selectors from "../selectors";

import * as Utils from "../utils";
import {
  UPDATE_WINDOW_POSITIONS,
  TOGGLE_DOUBLESIZE_MODE,
  WINDOW_SIZE_CHANGED,
  TOGGLE_WINDOW,
  CLOSE_WINDOW,
  TOGGLE_WINDOW_SHADE_MODE,
  SET_WINDOW_VISIBILITY,
  BROWSER_WINDOW_SIZE_CHANGED,
  RESET_WINDOW_SIZES,
  TOGGLE_LLAMA_MODE,
  SET_FOCUSED_WINDOW
} from "../actionTypes";

import { getPositionDiff, SizeDiff } from "../resizeUtils";
import { applyDiff } from "../snapUtils";
import {
  Action,
  Dispatchable,
  WindowId,
  WindowPositions,
  Dispatch
} from "../types";

// Dispatch an action and, if needed rearrange the windows to preserve
// the existing edge relationship.
//
// Works by checking the edges before the action is dispatched. Then,
// after disatching, calculating what position change would be required
// to restore those relationships.
function withWindowGraphIntegrity(action: Action): Dispatchable {
  return (dispatch, getState) => {
    const state = getState();
    const graph = Selectors.getWindowGraph(state);
    const originalSizes = Selectors.getWindowSizes(state);

    dispatch(action);

    const newSizes = Selectors.getWindowSizes(getState());
    const sizeDiff: SizeDiff = {};
    for (const window of Object.keys(newSizes)) {
      const original = originalSizes[window];
      const current = newSizes[window];
      sizeDiff[window] = {
        height: current.height - original.height,
        width: current.width - original.width
      };
    }

    const positionDiff = getPositionDiff(graph, sizeDiff);
    const windowPositions = Selectors.getWindowPositions(state);

    const newPositions = Utils.objectMap(windowPositions, (position, key) =>
      applyDiff(position, positionDiff[key])
    );

    dispatch(updateWindowPositions(newPositions));
  };
}

export function toggleDoubleSizeMode(): Dispatchable {
  return withWindowGraphIntegrity({ type: TOGGLE_DOUBLESIZE_MODE });
}

export function toggleLlamaMode(): Dispatchable {
  return { type: TOGGLE_LLAMA_MODE };
}

export function toggleEqualizerShadeMode(): Dispatchable {
  return withWindowGraphIntegrity({
    type: TOGGLE_WINDOW_SHADE_MODE,
    windowId: "equalizer"
  });
}

export function toggleMainWindowShadeMode(): Dispatchable {
  return withWindowGraphIntegrity({
    type: TOGGLE_WINDOW_SHADE_MODE,
    windowId: "main"
  });
}

export function togglePlaylistShadeMode(): Dispatchable {
  return withWindowGraphIntegrity({
    type: TOGGLE_WINDOW_SHADE_MODE,
    windowId: "playlist"
  });
}

export function closeWindow(windowId: WindowId): Dispatchable {
  return { type: CLOSE_WINDOW, windowId };
}

export function hideWindow(windowId: WindowId): Dispatchable {
  return { type: SET_WINDOW_VISIBILITY, windowId, hidden: true };
}

export function showWindow(windowId: WindowId): Dispatchable {
  return { type: SET_WINDOW_VISIBILITY, windowId, hidden: false };
}

export function setFocusedWindow(window: WindowId): Dispatchable {
  return { type: SET_FOCUSED_WINDOW, window };
}

export function setWindowSize(
  windowId: WindowId,
  size: [number, number]
): Dispatchable {
  return { type: WINDOW_SIZE_CHANGED, windowId, size };
}

export function toggleWindow(windowId: WindowId): Dispatchable {
  return { type: TOGGLE_WINDOW, windowId };
}

export function updateWindowPositions(
  positions: WindowPositions,
  absolute?: boolean
): Dispatchable {
  return { type: UPDATE_WINDOW_POSITIONS, positions, absolute };
}

export function centerWindowsInContainer(container: HTMLElement): Dispatchable {
  return (dispatch, getState) => {
    if (!Selectors.getPositionsAreRelative(getState())) {
      return;
    }
    const { left, top } = container.getBoundingClientRect();
    const { scrollWidth: width, scrollHeight: height } = container;
    dispatch(centerWindows({ left, top, width, height }));
  };
}

export function centerWindowsInView(): Dispatchable {
  return centerWindows({
    left: window.scrollX,
    top: window.scrollY,
    width: window.innerWidth,
    height: window.innerHeight
  });
}

export function centerWindows(box: {
  left: number;
  top: number;
  width: number;
  height: number;
}): Dispatchable {
  return (dispatch, getState) => {
    const state = getState();
    const windowsInfo = Selectors.getWindowsInfo(state);
    const getOpen = Selectors.getWindowOpen(state);
    const { top, left, width, height } = box;

    const offsetLeft = left + window.scrollX;
    const offsetTop = top + window.scrollY;

    // A layout has been suplied. We will compute the bounding box and
    // center the given layout.
    const bounding = Utils.calculateBoundingBox(
      windowsInfo.filter(w => getOpen(w.key))
    );

    const boxHeight = bounding.bottom - bounding.top;
    const boxWidth = bounding.right - bounding.left;

    const move = {
      x: Math.ceil(offsetLeft - bounding.left + (width - boxWidth) / 2),
      y: Math.ceil(offsetTop - bounding.top + (height - boxHeight) / 2)
    };

    const newPositions = windowsInfo.reduce(
      (pos, w) => ({
        ...pos,
        [w.key]: { x: move.x + w.x, y: move.y + w.y }
      }),
      {}
    );

    dispatch(updateWindowPositions(newPositions, true));
  };
}

export function browserWindowSizeChanged(size: {
  height: number;
  width: number;
}) {
  return (dispatch: Dispatch) => {
    dispatch({ type: BROWSER_WINDOW_SIZE_CHANGED, ...size });
    dispatch(ensureWindowsAreOnScreen());
  };
}

export function resetWindowSizes(): Dispatchable {
  return { type: RESET_WINDOW_SIZES };
}

export function stackWindows(): Dispatchable {
  return (dispatch, getState) => {
    dispatch(
      updateWindowPositions(Selectors.getStackedLayoutPositions(getState()))
    );
  };
}

export function ensureWindowsAreOnScreen(): Dispatchable {
  return (dispatch, getState) => {
    const state = getState();

    const windowsInfo = Selectors.getWindowsInfo(state);
    const getOpen = Selectors.getWindowOpen(state);
    const { height, width } = Utils.getWindowSize();
    const bounding = Utils.calculateBoundingBox(
      windowsInfo.filter(w => getOpen(w.key))
    );
    const positions = Selectors.getWindowPositions(state);

    // Are we good?
    if (
      bounding.left >= 0 &&
      bounding.top >= 0 &&
      bounding.right <= width &&
      bounding.bottom <= height
    ) {
      // My work here is done.
      return;
    }

    const boundingHeight = bounding.bottom - bounding.top;
    const boundingWidth = bounding.right - bounding.left;

    // Could we simply shift all the windows by a constant offset?
    if (boundingWidth <= width && boundingHeight <= height) {
      let moveY = 0;
      let moveX = 0;
      if (bounding.top <= 0) {
        moveY = bounding.top;
      } else if (bounding.bottom > height) {
        moveY = bounding.bottom - height;
      }

      if (bounding.left <= 0) {
        moveX = bounding.left;
      } else if (bounding.right > width) {
        moveX = bounding.right - width;
      }

      const newPositions = Utils.objectMap(positions, position => ({
        x: position.x - moveX,
        y: position.y - moveY
      }));

      dispatch(updateWindowPositions(newPositions));
      return;
    }

    // TODO: Try moving the individual groups to try to fit them in

    // I give up. Just reset everything.
    dispatch(resetWindowSizes());
    dispatch(stackWindows());
    dispatch(centerWindowsInView());
  };
}
