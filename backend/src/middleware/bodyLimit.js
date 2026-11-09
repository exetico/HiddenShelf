/**
 * Cap the size of API request bodies, so a huge upload can't tie up
 * memory. Answers 413 with a JSON error the app shows as is.
 */

import { bodyLimit } from "hono/body-limit";
import { MAX_BODY_BYTES, errorResponse } from "../lib/helpers.js";

export function limitBodySize(maxSize = MAX_BODY_BYTES) {
  return bodyLimit({
    maxSize,
    onError: (c) =>
      errorResponse(
        c,
        `That's too much to save at once (the limit is ${Math.round(maxSize / 1024)} KB)`,
        413,
      ),
  });
}
