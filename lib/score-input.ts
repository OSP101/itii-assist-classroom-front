export const SCORE_MAX_DECIMALS = 2;
export const SCORE_INPUT_PATTERN = "^\\d*(\\.\\d{0,2})?$";

export function roundScoreValue(value: number): number {
    return Math.round(value * 100) / 100;
}

export function formatScoreValue(value: number): string {
    if (!Number.isFinite(value)) {
        return "";
    }

    return roundScoreValue(value)
        .toFixed(SCORE_MAX_DECIMALS)
        .replace(/\.?0+$/, "");
}

export function parseScoreInput(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed || trimmed === ".") {
        return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? roundScoreValue(parsed) : null;
}

export function sanitizeScoreInput(value: string, maxScore?: number): string {
    const normalized = value.replace(/,/g, ".");
    let result = "";
    let seenDot = false;
    let decimals = 0;

    for (const char of normalized) {
        if (char >= "0" && char <= "9") {
            if (seenDot) {
                if (decimals >= SCORE_MAX_DECIMALS) {
                    continue;
                }
                decimals += 1;
            }
            result += char;
            continue;
        }

        if (char === "." && !seenDot) {
            result = result || "0";
            result += ".";
            seenDot = true;
        }
    }

    if (typeof maxScore === "number") {
        const parsed = parseScoreInput(result);
        if (parsed !== null && parsed > maxScore) {
            return formatScoreValue(maxScore);
        }
    }

    return result;
}

export function isScoreInputValid(value: string, maxScore: number): boolean {
    const parsed = parseScoreInput(value);
    return parsed !== null && parsed >= 0 && parsed <= maxScore;
}
