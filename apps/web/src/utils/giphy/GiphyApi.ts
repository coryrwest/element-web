/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import type { GiphyResponse } from "./GiphyTypes";

export class GiphyError extends Error {
    public constructor(
        public readonly code: string,
        public readonly message: string,
        public readonly status: number,
    ) {
        super(`GIPHY API Error ${code}: ${message}`);
    }
}

export class GiphyApi {
    private readonly apiKey: string;
    private readonly baseUrl = "https://api.giphy.com/v1/gifs";

    public constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    public async searchGifs(query: string, offset = 0, limit = 25): Promise<GiphyResponse> {
        if (!this.apiKey) {
            throw new GiphyError("NO_API_KEY", "GIPHY API key not configured", 401);
        }

        const url = new URL(`${this.baseUrl}/search`);
        url.searchParams.set("api_key", this.apiKey);
        url.searchParams.set("q", query);
        url.searchParams.set("limit", limit.toString());
        url.searchParams.set("offset", offset.toString());
        url.searchParams.set("rating", "pg-13"); // Safe content by default

        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 10000); // 10 second timeout

        try {
            const response = await fetch(url.toString(), {
                method: "GET",
                signal: abortController.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                logger.error(`GIPHY API error: ${response.status} - ${errorText}`);
                throw new GiphyError("API_ERROR", `HTTP ${response.status}`, response.status);
            }

            const contentType = response.headers.get("Content-Type");
            if (!contentType?.includes("application/json")) {
                throw new GiphyError("INVALID_RESPONSE", "Unexpected content type", response.status);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            clearTimeout(timeoutId);
            if (abortController.signal.aborted) {
                throw new GiphyError("TIMEOUT", "Request timeout", 408);
            }
            throw error;
        }
    }
}