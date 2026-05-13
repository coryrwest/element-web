/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { LruCache } from "../../utils/LruCache";
import type { GiphyResponse } from "./GiphyTypes";

const giphyCache = new LruCache<string, GiphyResponse>(50);

export function getCachedGifs(query: string, offset: number): GiphyResponse | undefined {
    const cacheKey = `search:${query}:${offset}`;
    return giphyCache.get(cacheKey);
}

export function setCachedGifs(query: string, offset: number, response: GiphyResponse): void {
    const cacheKey = `search:${query}:${offset}`;
    giphyCache.set(cacheKey, response);
}

export function clearGiphyCache(): void {
    giphyCache.clear();
}