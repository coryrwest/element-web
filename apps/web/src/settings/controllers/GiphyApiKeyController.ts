/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import SettingController from "./SettingController";
import { SettingLevel } from "../SettingLevel";

export default class GiphyApiKeyController extends SettingController {
    public async beforeChange(
        level: SettingLevel,
        roomId: string | null,
        newValue: string,
    ): Promise<boolean> {
        if (!newValue || newValue.trim() === "") {
            return true; // Allow clearing the key
        }

        // Basic format validation - GIPHY API keys are typically 32+ characters
        if (newValue.length < 10) {
            logger.warn("GIPHY API key too short");
            return false;
        }

        return true;
    }
}