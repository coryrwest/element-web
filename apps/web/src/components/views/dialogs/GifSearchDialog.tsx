/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEvent, createRef, type JSX, type ReactElement } from "react";
import "./styles/GifSearchDialog.css";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";
import ErrorDialog from "./ErrorDialog";
import Spinner from "../elements/Spinner";
import Field from "../elements/Field";
import SettingsStore from "../../../settings/SettingsStore";
import { GiphyApi, GiphyError } from "../../../utils/giphy/GiphyApi";
import { getCachedGifs, setCachedGifs } from "../../../utils/giphy/GiphyCache";
import type { Gif } from "../../../utils/giphy/GiphyTypes";
import ContextMenu, { ChevronFace } from "../../structures/ContextMenu";
import GenericElementContextMenu from "../context_menus/GenericElementContextMenu";

// This should be below the dialog level (4000), but above the rest of the UI (1000-2000).
// We sit in a context menu, so this should be given to the context menu.
const GIFSEARCHDIALOG_Z_INDEX = 3500;

interface IProps {
    onFinished: (gif: Gif | null) => void;
    roomId: string;
    isOpen: boolean;
    menuPosition?: any;
}

interface IState {
    searchQuery: string;
    isLoading: boolean;
    results: Gif[];
    error: string | null;
    selectedGif: Gif | null;
    hasMore: boolean;
    offset: number;
}

export default class GifSearchDialog extends React.PureComponent<IProps, IState> {
    private searchInputRef = createRef<HTMLInputElement>();
    private resultsContainerRef = createRef<HTMLDivElement>();
    private searchDebounce: ReturnType<typeof setTimeout> | null = null;
    private searchAbortController: AbortController | null = null;
    private prevIsOpen = false;

    private popoverWidth = 400;
    private popoverHeight = 500;

    public constructor(props: IProps) {
        super(props);

        this.state = {
            searchQuery: "",
            isLoading: false,
            results: [],
            error: null,
            selectedGif: null,
            hasMore: false,
            offset: 0,
        };
    }

    public componentDidMount(): void {
        // Focus search input after dialog is mounted if it's open
        if (this.props.isOpen) {
            setTimeout(() => {
                this.searchInputRef.current?.focus();
            }, 100);
        }
    }

    public componentDidUpdate(): void {
        // Clear state when dialog closes
        if (this.prevIsOpen && !this.props.isOpen) {
            this.setState({
                searchQuery: "",
                isLoading: false,
                results: [],
                error: null,
                selectedGif: null,
                hasMore: false,
                offset: 0,
            });
        }

        // Focus search input when dialog opens
        if (this.props.isOpen && this.searchInputRef.current) {
            setTimeout(() => {
                this.searchInputRef.current?.focus();
            }, 100);
        }

        this.prevIsOpen = this.props.isOpen;
    }

    public componentWillUnmount(): void {
        // Clean up debounce and abort controller
        if (this.searchDebounce) {
            clearTimeout(this.searchDebounce);
        }
        if (this.searchAbortController) {
            this.searchAbortController.abort();
        }
    }

    private onSearchChange = (ev: ChangeEvent<HTMLInputElement>): void => {
        const query = ev.target.value;
        this.setState({ searchQuery: query });

        // Cancel previous search
        if (this.searchAbortController) {
            this.searchAbortController.abort();
            this.searchAbortController = null;
        }

        // Clear debounce
        if (this.searchDebounce) {
            clearTimeout(this.searchDebounce);
        }

        // Debounce search to avoid excessive API calls
        if (!query.trim()) {
            this.setState({ results: [], hasMore: false, error: null });
            return;
        }

        this.searchDebounce = setTimeout(() => {
            this.searchGifs(query);
        }, 300);
    };

    private searchGifs = async (query: string, offset = 0): Promise<void> => {
        // Check for cached results
        const cached = getCachedGifs(query, offset);
        if (cached && offset === 0) {
            this.setState({
                results: cached.data,
                hasMore: cached.pagination.offset + cached.pagination.count < cached.pagination.total_count,
                offset: cached.pagination.offset + cached.pagination.count,
            });
            return;
        }

        const apiKey = SettingsStore.getValue("giphyApiKey");
        if (!apiKey) {
            this.setState({
                error: _t("gif_search|api_key_missing"),
                isLoading: false,
            });
            return;
        }

        this.searchAbortController = new AbortController();
        this.setState({ isLoading: true, error: null });

        try {
            const api = new GiphyApi(apiKey);
            const response = await api.searchGifs(query, offset);

            // Cache the results
            setCachedGifs(query, offset, response);

            this.setState({
                results: offset === 0 ? response.data : [...this.state.results, ...response.data],
                hasMore:
                    response.pagination.offset + response.pagination.count < response.pagination.total_count,
                offset: response.pagination.offset + response.pagination.count,
            });
        } catch (error) {
            logger.error("Failed to search GIFs:", error);

            let errorMessage = _t("gif_search|error");
            if (error instanceof GiphyError) {
                if (error.code === "NO_API_KEY") {
                    errorMessage = _t("gif_search|api_key_missing");
                } else if (error.code === "TIMEOUT") {
                    errorMessage = _t("gif_search|timeout");
                } else if (error.status === 401 || error.status === 403) {
                    errorMessage = _t("gif_search|invalid_api_key");
                }
            }

            this.setState({ error: errorMessage });
        } finally {
            this.setState({ isLoading: false });
        }
    };

    private onGifClick = (gif: Gif): void => {
        this.props.onFinished(gif);
    };

    private onLoadMore = (): void => {
        this.searchGifs(this.state.searchQuery, this.state.offset);
    };

    private onKeyDown = (ev: React.KeyboardEvent): void => {
        // Handle keyboard navigation
        if (ev.key === "Escape") {
            ev.stopPropagation();
            this.props.onFinished(null);
        }
    };

    private onScroll = (): void => {
        const container = this.resultsContainerRef.current;
        if (!container || this.state.isLoading || !this.state.hasMore) return;

        const { scrollTop, scrollHeight, clientHeight } = container;
        const scrollThreshold = 100; // Load more when within 100px of bottom
        const isNearBottom = scrollHeight - scrollTop - clientHeight < scrollThreshold;

        if (isNearBottom) {
            this.onLoadMore();
        }
    };

    /**
     * The GIF search dialog was hidden
     */
    private onFinished = (): void => {
        if (this.props.isOpen) {
            this.props.onFinished(null);
        }
    };

    public render(): React.ReactNode {
        if (!this.props.isOpen) return null;

        const hasApiKey = !!SettingsStore.getValue("giphyApiKey");

        if (!hasApiKey) return null;

        return (
            <ContextMenu
                chevronFace={ChevronFace.Bottom}
                menuWidth={this.popoverWidth}
                menuHeight={this.popoverHeight}
                onFinished={this.onFinished}
                menuPaddingTop={0}
                menuPaddingLeft={0}
                menuPaddingRight={0}
                zIndex={GIFSEARCHDIALOG_Z_INDEX}
                mountAsChild={true}
                {...this.props.menuPosition}
            >
                <GenericElementContextMenu
                    element={
                        <div className="mx_GifSearchDialog_content" onKeyDown={this.onKeyDown}>
                            <Field
                                id="gif-search-input"
                                inputRef={this.searchInputRef}
                                type="text"
                                placeholder={_t("gif_search|placeholder")}
                                value={this.state.searchQuery}
                                onChange={this.onSearchChange}
                                autoFocus
                            />

                            {this.state.error && (
                                <div className="mx_GifSearchDialog_error">{this.state.error}</div>
                            )}

                            {this.state.isLoading && <Spinner />}

                            {!this.state.isLoading && this.state.results.length === 0 && this.state.searchQuery && (
                                <div className="mx_GifSearchDialog_noResults">{_t("gif_search|no_results")}</div>
                            )}

                            {this.state.results.length > 0 && (
                                <div
                                    className="mx_GifSearchDialog_results"
                                    ref={this.resultsContainerRef}
                                    onScroll={this.onScroll}
                                >
                                    {this.state.results.map((gif) => (
                                        <div
                                            key={gif.id}
                                            className="mx_GifSearchDialog_item"
                                            onClick={() => this.onGifClick(gif)}
                                            title={gif.title}
                                        >
                                            <img
                                                src={gif.images.fixed_height.url}
                                                alt={gif.title}
                                                loading="lazy"
                                            />
                                        </div>
                                    ))}
                                    {this.state.isLoading && <Spinner />}
                                </div>
                            )}
                        </div>
                    }
                    onResize={this.onFinished}
                />
            </ContextMenu>
        );
    }
}