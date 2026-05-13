/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export interface GiphyResponse {
    data: Gif[];
    pagination: GiphyPagination;
    meta: GiphyMeta;
}

export interface Gif {
    id: string;
    title: string;
    images: {
        fixed_height: GifImage;
        downsized: GifImage;
    };
    rating: string;
}

export interface GifImage {
    url: string;
    width: string;
    height: string;
    size: string;
}

export interface GiphyPagination {
    count: number;
    offset: number;
    total_count: number;
}

export interface GiphyMeta {
    status: number;
    msg: string;
    response_id: string;
}