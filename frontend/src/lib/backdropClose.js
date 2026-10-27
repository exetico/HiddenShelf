/**
 * Click handlers for a dialog's backdrop: close on a click on the backdrop
 * itself, but not when the press started inside the dialog. Selecting text
 * in a field and letting go outside the dialog fires a click on the
 * backdrop, and that shouldn't throw away what you were typing.
 *
 *   <div v-on="backdrop" ...>   with   const backdrop = backdropClose(close)
 */
export function backdropClose(close) {
  let pressedInside = false;
  return {
    mousedown(event) {
      pressedInside = event.target !== event.currentTarget;
    },
    click(event) {
      const fromInside = pressedInside;
      pressedInside = false;
      if (event.target === event.currentTarget && !fromInside) close();
    },
  };
}
