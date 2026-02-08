/// <<reference path="./decryptor/reflektone_decrypt.d.ts" />

(function (scope) {
    //#region Rating & rank calculation
    const RATING_COEFFICIENTS = new Map([
        [100.5, 22.4],
        [100.4999, 22.2],
        [100, 21.6],
        [99.9999, 21.4],
        [99.5, 21.1],
        [99, 20.8],
        [98.9999, 20.6],
        [98, 20.3],
        [97, 20],
        [96.9999, 17.6],
        [94, 16.8],
        [90, 15.2],
        [80, 13.6],
        [79.9999, 12.8],
        [75, 12],
        [70, 11.2],
        [60, 9.6],
        [50, 8],
        [40, 6.4],
        [30, 4.8],
        [20, 3.2],
        [10, 1.6],
        [0, 0],
    ]);

    /**
     * Calculate maimai DX Splash+ (and newer) rate for a score.
     *
     * @param {number} score - The score to calculate the rate for.
     * @param {number} internalChartLevel - The internal decimal level of the chart the score was achieved on.
     */
    function calculateRating(score, internalChartLevel) {
        // Scores above 100.5% are capped at 100.5% by the algorithm.
        score = Math.min(score, 100.5);

        for (const [scoreBoundary, coefficient] of RATING_COEFFICIENTS) {
            if (score >= scoreBoundary) {
                return Math.floor(internalChartLevel * coefficient * (score / 100));
            }
        }

        // should be impossible as score cannot be negative and the lowest boundary is >= 0.
        /* istanbul ignore next */
        throw new Error(`Unresolvable score of ${score}.`);
    }

    const RANK_BORDERS = new Map([
        [100.5, "SSS+"],
        [100, "SSS"],
        [99.5, "SS+"],
        [99, "SS"],
        [98, "S+"],
        [97, "S"],
        [94, "AAA"],
        [90, "AA"],
        [80, "A"],
        [75, "BBB"],
        [70, "BB"],
        [60, "B"],
        [50, "C"],
    ]);

    function calculateRank(score) {
        for (const [scoreBoundary, rank] of RANK_BORDERS) {
            if (score >= scoreBoundary) {
                return rank;
            }
        }
        return "D";
    }
    //#endregion

    //#region Magic
    const DIFFICULTIES = ["BASIC", "ADVANCED", "EXPERT", "MASTER", "Re:MASTER"];

    const DX_REGEX = /\bdx\s*:\s*([0-9]+)/;
    const LV_REGEX = /\blv\s*:\s*(\[.+?\])/;
    const VERSION_REGEX = /\bv\s*:\s*(-?[0-9]+)/;
    const SONGNAME_REGEX = /\bn\s*:\s*["'`](.+?)["'`]\s*[,\}]/;
    const SONGNICKNAME_REGEX = /\bnn\s*:\s*["'`](.+?)["'`]\s*[,\}]/;
    const ICO_REGEX = /\bico\s*:\s*["`]([0-9a-z]+)["`]/;


    const magicSauce = {
        universeplus:
            "https://gist.githubusercontent.com/myjian/ee569d74f422d4e255065d8b02ea294a/raw/932fb03a38121210080d6f537913a084247e531c/maidx_in_lv_universeplus.js",
        festival:
            "https://gist.githubusercontent.com/myjian/0855c8947b547d7b9b888158512dde69/raw/1eeb074d39367748af40fb1a9dd4a16b42f99b6b/maidx_in_lv_festival.js",
        festivalplus:
            "https://gist.githubusercontent.com/myjian/ad2685872fd7f5cd7a47ecb340514e6b/raw/9961748d3c481ef495cfe3d080392ab86295ce9c/maidx_in_lv_festivalplus.js",
        buddies:
            "https://admirable0531.github.io/buddiesMagic/buddiesMagic.js",
        buddiesplus:
            "https://admirable0531.github.io/buddiesMagic/buddiesPlusMagic.js",
        prism:
            "https://myjian.github.io/Taiwan-independence/external/magic-prism.json",
        prismplus:
            "https://myjian.github.io/Taiwan-independence/external/magic-prism-plus.json",
        circle:
            "https://myjian.github.io/Taiwan-independence/external/magic.json"
    };

    function normalizeSongName(name) {
        if (name === 'D✪N’T  ST✪P  R✪CKIN’') {
            return 'D✪N’T ST✪P R✪CKIN’';
        }
        return name.replace(/" \+ '/g, '').replace(/' \+ "/g, '');
    }

    function parseLine(line) {
        const dxMatch = line.match(DX_REGEX);
        const lvMatch = line.match(LV_REGEX);
        const debutVerMatch = line.match(VERSION_REGEX);
        const songNameMatch = line.match(SONGNAME_REGEX);
        const nicknameMatch = line.match(SONGNICKNAME_REGEX);
        const icoMatch = line.match(ICO_REGEX);
        if (dxMatch && lvMatch && debutVerMatch && songNameMatch) {
            let lvList = JSON.parse(lvMatch[1]);
            if (lvList.length > DIFFICULTIES.length) {
                const newReMasterLv = lvList.pop();
                lvList[DIFFICULTIES.length - 1] = newReMasterLv;
            }
            const props = {
                dx: parseInt(dxMatch[1]),
                lv: lvList,
                v: Math.abs(parseInt(debutVerMatch[1])),
                n: normalizeSongName(songNameMatch[1]),
            };
            if (nicknameMatch) {
                props.nn = nicknameMatch[1];
            }
            if (icoMatch) {
                props.ico = icoMatch[1];
            }
            return props;
        }
    }

    /**
     * @param {keyof typeof magicSauce} version
     * @returns {Promise<SgimeraChart[]>}
     */
    async function fetchMagic(version) {
        const url = magicSauce[version] || magicSauce["universeplus"];
        const res = await fetch(url);
        if (res.ok) {
            if (url.endsWith(".json")) {
                const data = await res.json();
                return data.map(item => ({
                    dx: item.dx,
                    lv: item.lv,
                    v: item.debut,
                    n: normalizeSongName(item.name || item.title || ""),
                    nn: item.nickname || null,
                    ico: item.icon || null
                }));
            } else {
                const text = await res.text();
                return text
                    .split("\n")
                    .map(parseLine)
                    .filter((props) => props);
            }
        }
        return [];
    }

    /**
     *
     * @param {keyof typeof magicSauce} version
     * @returns {Promise<SgimeraChart[]>}
     */
    async function loadMagic(version) {
        const cachedMagicString = localStorage.getItem(`inlv${version}_1`);
        const cachedMagic = JSON.parse(cachedMagicString ?? "{}");
        if (cachedMagicString && new Date(cachedMagic.expiration) > new Date()) {
            return cachedMagic.data;
        }

        const magic = await fetchMagic(version);
        if (magic.length) {
            window.localStorage.setItem(
                `inlv${version}_1`,
                JSON.stringify(
                    {
                        expiration: new Date(Date.now() + 1000 * 60 * 60 * 24),
                        data: magic,
                    }
                ));
        }
        return magic;
    }
    //#endregion

    //#region Utilities
    /**
     * @param {string} title
     * @returns {string}
     */
    function normalizeTitle(title) {
        return (
            title
                .toLowerCase()
                // ideographic space is used in some titles
                // eslint-disable-next-line no-irregular-whitespace
                .replace(/　/gu, " ")
                // so is nbsp I think?
                // eslint-disable-next-line no-irregular-whitespace
                .replace(/ /gu, " ")
                .replace(/：/gu, ":")
                .replace(/（/gu, "(")
                .replace(/）/gu, ")")
                .replace(/！/gu, "!")
                .replace(/？/gu, "?")
                .replace(/`/gu, "'")
                .replace(/’/gu, "'")
                .replace(/”/gu, '"')
                .replace(/“/gu, '"')
                .replace(/～/gu, "~")
                .replace(/－/gu, "-")
                .replace(/＠/gu, "@")
                .replace(/＃/gu, "#")
                .replace(/\s*\[st\]/gui, "")
                .replace(/\s*\[dx\]/gui, "")
        );
    }
    //#endregion
    const ChartType = {
        UNKNOWN: -1,
        STANDARD_ONLY: 0,
        DX_ONLY: 1,
        STANDARD_BOTH: 2,
        DX_BOTH: 3,
    };
    /**
     * @param {-1 | 0 | 1 | 2 | 3} chartType
     * @returns {string}
     */
    scope.displayedChartType = function (chartType) {
        if (chartType === ChartType.STANDARD_BOTH) {
            return " [ST]";
        } else if (chartType === ChartType.DX_BOTH) {
            return " [DX]";
        } else {
            return "";
        }
    };

    /**
     * @type {File | null}
     */
    let lastFile = null;
    /**
     *
     * @param {"jp" | "intl"} region
     * @param {keyof typeof magicSauce} version
     * @param {File} file
     * @param {Record<string, Any>} $data
     */
    scope.analyzeRating = async function (region, version, file, $data) {
        if (lastFile !== file) {
            $data.best50 = [];
            $data.tsvRows = [];
            $data.totalRating = 0;
            $data.status = "";
        }
        lastFile = file;

        let encryptedContent = "";

        // Read file as ArrayBuffer first to allow multiple attempts
        let fileBuffer;
        try {
            fileBuffer = await file.arrayBuffer();
        } catch (e) {
            $data.status = `Failed to read file: ${e.message}`;
            return;
        }

        const compressionCalgos = ["deflate-raw", "deflate", "gzip"];
        let decompressed = false;

        for (const algo of compressionCalgos) {
            try {
                const ds = new DecompressionStream(algo);
                // Create a new stream from the buffer for each attempt
                const stream = new Response(fileBuffer).body.pipeThrough(ds);
                encryptedContent = await new Response(stream).text();
                decompressed = true;
                break; // Success
            } catch (e) {
                // Continue to next algorithm
                console.log(`Decompression with ${algo} failed:`, e);
            }
        }

        if (!decompressed) {
            // Fallback: Treat as plain UTF-8 text (legacy format or uncompressed)
            encryptedContent = new TextDecoder().decode(fileBuffer);
        }

        let content = "";

        if (decompressed) {
            content = encryptedContent;
        } else {
            try {
                switch (file.name) {
                    case "chart-meta.fufu":
                        content = wasm_bindgen.export_legacy_meta(encryptedContent);
                        break;
                    case "level-index.nya":
                        content = wasm_bindgen.export_dev_meta(encryptedContent);
                        break;
                    default:
                        content = wasm_bindgen.export_current_meta(encryptedContent);
                        break;
                }
            } catch (e) {
                $data.status = `Failed to decrypt file. Are you on iOS?<br />
      Detailed error: <code>${e.message}</code>`;
                return;
            }
        }

        if (content.length === 0) {
            $data.status = "No charts found.";
            return;
        }

        const magicCharts = await loadMagic(version);

        $data.status = "Processing scores...";


        // For CSV export
        const annotatedRows = [];
        let rawScores = [];

        // Detect if content is JSON
        const isJson = content.trim().startsWith("{");

        if (isJson) {
            try {
                const data = JSON.parse(content);
                const metadata = data.level_metadata || {};

                Object.values(metadata).forEach((entry) => {
                    const songTitle = entry.title;
                    if (!entry.difficulties) return;

                    entry.difficulties.forEach((diff) => {
                        const stats = diff.stats || {};

                        // Map difficulty alias
                        let difficulty = diff.alias ? diff.alias : diff.difficulty;
                        if (difficulty) {
                            if (difficulty.toLowerCase() === "re:master") {
                                difficulty = "Re:MASTER";
                            } else if (difficulty === "宴") {
                                // Keep as is
                            } else {
                                difficulty = difficulty.toUpperCase();
                            }
                        }

                        // Determine Chart Type from JSON
                        // Assuming diff.difficulty or diff.key or similar contains type info
                        // Inspecting typical JSON structure: "difficulty": "master", "level": "14", "type": "dx" ??
                        // Actually, let's look at the structure from previous knowledge or infer.
                        // RC3 cache usually has `difficulty`: `dx_master` or `std_master` as keys in `difficulties` object if it was a map, but here it's an array.
                        // Let's try to find a type field.
                        // If not explicit, maybe we can't...
                        // Wait, the user has `cache.json` open. 
                        // I will add a log to see the structure if I can.
                        // But I can't interactively debug.

                        // Map chart type from title
                        let chartType = ChartType.UNKNOWN;
                        if (/(?:\s|^)\[ST\]$/i.test(songTitle) || songTitle.includes("[ST]")) {
                            chartType = ChartType.STANDARD_BOTH;
                        } else if (/(?:\s|^)\[DX\]$/i.test(songTitle) || songTitle.includes("[DX]")) {
                            chartType = ChartType.DX_BOTH;
                        } else if (diff.type === "dx") {
                            chartType = ChartType.DX_BOTH;
                        } else if (diff.type === "std") {
                            chartType = ChartType.STANDARD_BOTH;
                        } else {
                            // Fallback or inference from ID
                            // e.g. "dx_master"
                            if (diff.difficulty && diff.difficulty.includes("dx")) {
                                chartType = ChartType.DX_BOTH;
                            } else if (diff.difficulty && diff.difficulty.includes("std")) {
                                chartType = ChartType.STANDARD_BOTH;
                            }
                        }

                        // Map Level
                        let rawLevel = diff.value;
                        let level = 0;
                        if (rawLevel) {
                            let levelNum = parseFloat(rawLevel.replace("+", ""));
                            if (["buddiesplus", "prism", "prismplus", "circle"].includes(version)) {
                                level = rawLevel.includes("+") ? levelNum + 0.6 : levelNum;
                            } else {
                                level = rawLevel.includes("+") ? levelNum + 0.7 : levelNum;
                            }
                        }

                        // Determine AP status
                        // comboStatus: 0=None, 1=FC, 2=FC+, 3=AP, 4=AP+
                        const isAP = stats.comboStatus >= 3;

                        rawScores.push({
                            category: "",
                            title: songTitle,
                            difficulty: difficulty,
                            level: level,
                            isEstimatedLevel: true,
                            achievement: stats.achievementRate || 0,
                            dxScore: stats.dxScore || 0,
                            rank: calculateRank(stats.achievementRate || 0),
                            chartType: chartType,
                            v: 0, // Will be populated from magicCharts
                            isAP: isAP
                        });
                    });
                });
            } catch (e) {
                console.error("JSON Parse error", e);
                $data.status = "Failed to parse JSON cache.";
                return;
            }
        } else {
            // Legacy TSV parsing
            content
                .trim()
                .split("\n")
                .forEach((line) => {
                    const cells = line.split("\t");
                    if (cells.length < 5) return;

                    let levelPlus;
                    if (["buddiesplus", "prism", "prismplus", "circle"].includes(version)) {
                        levelPlus = cells[6].replace("+", ".6");
                    } else {
                        levelPlus = cells[6].replace("+", ".7");
                    }

                    rawScores.push({
                        plusinfo: null,
                        category: cells[0],
                        title: cells[1],
                        difficulty: cells[5],
                        level: Number(levelPlus),
                        isEstimatedLevel: true,
                        achievement: Number(cells[17].replace("%", "")),
                        rank: calculateRank(Number(cells[17].replace("%", ""))),
                        chartType:
                            cells[4] === "DX"
                                ? ChartType.DX_BOTH
                                : cells[4] === "STANDARD"
                                    ? ChartType.STANDARD_BOTH
                                    : ChartType.UNKNOWN,
                        isAP: ["AP", "AP+"].includes(cells[7])
                    });
                });
        }

        /**
         * @type {Chart[]}
         */
        const allCharts = rawScores.map((score) => {
            const cells = [];

            // Exit early if chart is UTAGE
            if (score.difficulty === "宴" || (score.difficulty && score.difficulty.includes("宴"))) {
                score.level = 0;
                score.isEstimatedLevel = false;
                score.rating = 0;

                // Push placeholder row
                annotatedRows.push([score.category, score.title, "", "", "UNKNOWN", score.difficulty, score.level, "", "", "", "", "", "", "", "", "", "", score.achievement, score.rank, score.rating]);
                return score;
            }

            const title = normalizeTitle(score.title);

            let charts = magicCharts.filter(
                (chart) =>
                    (normalizeTitle(chart.n) === title ||
                        (chart.nn && normalizeTitle(chart.nn) === title)) &&
                    (score.chartType === ChartType.UNKNOWN ||
                        // If score is known as STANDARD_BOTH, we need a chart that is STANDARD (dx=0).
                        (score.chartType === ChartType.STANDARD_BOTH && chart.dx === 0) ||
                        // If score is known as DX_BOTH, we need a chart that is DX (dx=1).
                        (score.chartType === ChartType.DX_BOTH && chart.dx === 1) ||
                        score.chartType === chart.dx)
            );
            if (charts.length > 1 && score.chartType === ChartType.UNKNOWN) {
                // Filter charts by level if possible to resolve ambiguity
                // e.g. Destr0yer (DX) is 14, Standard is 13.
                // score.level is obtained from JSON value string (parsed).
                const scoreDiffIndex = DIFFICULTIES.indexOf(score.difficulty);
                if (scoreDiffIndex !== -1 && score.level > 0) {
                    const validCharts = charts.filter(c => {
                        const chartLv = scoreDiffIndex < 4 ? c.lv[scoreDiffIndex] : c.lv[c.lv.length - 1];
                        return Math.abs(chartLv - score.level) < 0.5; // Relaxed match to separate 14 vs 14+ (0.6 diff)
                    });
                    if (validCharts.length > 0) {
                        charts = validCharts;
                    }
                }

                charts = charts.map((chart) => {
                    // Bumping the chart type to their *_BOTH variants
                    // CLONE the chart to avoid mutating the global magicCharts cache!
                    const newType = chart.dx + 2;
                    return {
                        ...chart,
                        dx: newType
                    };
                });
                charts.sort((a, b) => b.v - a.v); // Prefer newer version if still ambiguous
            }
            const chart = charts[0];

            // Exit early if chart is unknown
            // Exit early if chart is unknown
            if (!chart) {
                // Return null to filter out unknown charts
                return null;
            }

            const difficultyIndex = DIFFICULTIES.indexOf(score.difficulty);
            if (difficultyIndex < 4) { // 4 is Re:MASTER
                score.level = chart.lv[difficultyIndex];
            } else {
                score.level = chart.lv[chart.lv.length - 1];
            }

            if (score.level < 0) {
                score.level = -score.level;
                score.isEstimatedLevel = true;
            } else {
                score.isEstimatedLevel = false;
            }

            if (score.chartType === ChartType.UNKNOWN) {
                score.chartType = chart.dx;
            }

            // Remove existing suffixes from title since index.html handles display
            score.title = score.title.replace(/\s*\[(st|dx)\]$/i, "").trim();

            // Append suffix for display (handled in index.html)
            /*
             * No need to append suffix here as it's handled in index.html via displayedChartType()
             */

            score.rating = calculateRating(
                score.achievement,
                score.level
            );

            // Apply AP Bonus for CiRCLE
            if (version === "circle" && score.isAP) {
                score.rating += 1;
            }


            // Populate extra info
            score.v = chart.v;
            score.category = chart.cat || chart.category || "";

            // Determine Type String for CSV
            let typeStr = "UNKNOWN";
            if (score.chartType === ChartType.STANDARD_BOTH || score.chartType === ChartType.STANDARD_ONLY) {
                typeStr = "STANDARD";
            } else if (score.chartType === ChartType.DX_BOTH || score.chartType === ChartType.DX_ONLY) {
                typeStr = "DX";
            }

            annotatedRows.push([
                score.category || (chart.v ? "v" + chart.v : "-"),
                score.title,
                "-", "-",
                typeStr,
                score.difficulty,
                score.level,
                "-", "-", "-", "-", "-", "-", "-", "-", "-",
                score.achievement,
                score.rank,
                score.rating
            ]);

            return score;
        }).filter(score => score !== null);



        $data.status = "Sorting scores...";
        allCharts.sort(
            (a, b) =>
                b.rating - a.rating ||
                b.level - a.level ||
                b.achievement - a.achievement
        );

        $data.tsvRows = annotatedRows;
        $data.best50 = allCharts.slice(0, 50);
        //$data.totalRating = $data.best50.reduce(
        ////  (acc, chart) => acc + chart.rating,
        0
        //);
        $data.status = "";
        // Split the charts into "New Chart" and "Old Chart"
        const uniqueVs = [...new Set(magicCharts.map(c => c.v || 0))].sort((a, b) => b - a);
        const maxV = uniqueVs[0] || 0;
        const prevV = uniqueVs[1] || -1;

        let newCharts, oldCharts;

        if (version === "circle") {
            // CiRCLE: New = Current (maxV) + Previous (prevV)
            newCharts = allCharts.filter(chart =>
                chart.category === "23. BUDDiES PLUS" ||
                chart.v === maxV ||
                chart.v === prevV
            ).slice(0, 15);

            oldCharts = allCharts.filter(chart =>
                !newCharts.includes(chart) &&
                chart.category !== "00. Fanmade"
            ).slice(0, 35);
        } else {
            // Standard behavior: New = Current Only
            newCharts = allCharts.filter(chart =>
                chart.category === "23. BUDDiES PLUS" ||
                chart.v === maxV
            ).slice(0, 15);

            oldCharts = allCharts.filter(chart =>
                !newCharts.includes(chart) &&
                chart.category !== "00. Fanmade"
            ).slice(0, 35);
        }

        const newChartsTotalRating = newCharts.reduce((acc, chart) => acc + chart.rating, 0);
        const oldChartsTotalRating = oldCharts.reduce((acc, chart) => acc + chart.rating, 0);

        $data.newCharts = newCharts;
        $data.oldCharts = oldCharts;
        $data.newRating = newChartsTotalRating;
        $data.oldRating = oldChartsTotalRating;
        $data.totalRating = newChartsTotalRating + oldChartsTotalRating;
    };

    scope.exportToTsv = function (rows) {
        const header = ["category", "title", "artist", "charter", "type", "difficulty", "level", "clear", "maxcombo", "tries", "cleared_plays", "complete_plays", "total_notes", "critical", "perfect", "great", "good", "achievement", "rank", "rating"];
        const tsvRows = rows.map((row) => row.join("\t"));
        const tsv = [header.join("\t"), ...tsvRows].join("\n");

        const blob = new Blob([tsv], { type: "text/tab-separated-values" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "scores.tsv";
        a.click();
    };
})(globalThis);
