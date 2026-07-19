(function() {
	//#region ../../widgetva-kit/src/integrations/officialPages/observableD3Surface.js
	function normalizeRoot(root) {
		if (!root || typeof root !== "object") throw new Error("A browser-like root object is required.");
		return root;
	}
	function readDocument(root) {
		if (root?.document) return root.document;
		if (typeof root?.querySelectorAll === "function") return root;
		return null;
	}
	function asArray(value) {
		return Array.isArray(value) ? value : [];
	}
	function clone(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function readNumber$1(value) {
		const numeric = Number(value);
		return Number.isFinite(numeric) ? numeric : null;
	}
	function readElements(doc, selector) {
		if (!doc?.querySelectorAll) return [];
		return [...doc.querySelectorAll(selector)];
	}
	function readBoundingBoxLike(node) {
		try {
			if (typeof node?.getBoundingClientRect === "function") {
				const rect = node.getBoundingClientRect();
				return {
					left: readNumber$1(rect?.left) || 0,
					top: readNumber$1(rect?.top) || 0,
					width: readNumber$1(rect?.width) || 0,
					height: readNumber$1(rect?.height) || 0
				};
			}
		} catch {}
		return {
			left: 0,
			top: 0,
			width: 0,
			height: 0
		};
	}
	function unionRects(rects = []) {
		const normalized = rects.filter((rect) => rect && rect.width > 0 && rect.height > 0);
		if (normalized.length === 0) return null;
		const left = Math.min(...normalized.map((rect) => rect.left));
		const top = Math.min(...normalized.map((rect) => rect.top));
		const right = Math.max(...normalized.map((rect) => rect.left + rect.width));
		const bottom = Math.max(...normalized.map((rect) => rect.top + rect.height));
		return {
			left,
			top,
			width: Math.max(right - left, 0),
			height: Math.max(bottom - top, 0)
		};
	}
	function computeArea(node) {
		const rect = readBoundingBoxLike(node);
		return rect.width * rect.height;
	}
	function pickLargestNode(nodes = []) {
		return asArray(nodes).reduce((best, node) => {
			if (!best) return node;
			return computeArea(node) > computeArea(best) ? node : best;
		}, null);
	}
	function summarizeSvgNode(svg) {
		if (!svg?.querySelectorAll) return {
			tagName: "svg",
			circleCount: 0,
			rectCount: 0,
			pathCount: 0,
			lineCount: 0,
			textCount: 0
		};
		return {
			tagName: "svg",
			circleCount: svg.querySelectorAll("circle").length,
			rectCount: svg.querySelectorAll("rect").length,
			pathCount: svg.querySelectorAll("path").length,
			lineCount: svg.querySelectorAll("line").length,
			textCount: svg.querySelectorAll("text").length
		};
	}
	function findPrimaryObservableD3Surface(root = globalThis.window) {
		const doc = readDocument(normalizeRoot(root));
		const svgs = readElements(doc, "svg");
		const canvases = readElements(doc, "canvas");
		const primarySvg = pickLargestNode(svgs);
		const primaryCanvas = pickLargestNode(canvases);
		if (!primarySvg && !primaryCanvas) return null;
		if (!primaryCanvas) return primarySvg;
		if (!primarySvg) return primaryCanvas;
		return computeArea(primarySvg) >= computeArea(primaryCanvas) ? primarySvg : primaryCanvas;
	}
	function summarizeObservableD3Surface(surface) {
		if (!surface || typeof surface !== "object") return null;
		const tagName = typeof surface.tagName === "string" ? surface.tagName.toLowerCase() : null;
		const rect = readBoundingBoxLike(surface);
		if (tagName === "svg") return {
			...summarizeSvgNode(surface),
			width: rect.width,
			height: rect.height,
			area: rect.width * rect.height
		};
		if (tagName === "canvas") return {
			tagName: "canvas",
			width: rect.width,
			height: rect.height,
			area: rect.width * rect.height
		};
		return {
			tagName,
			width: rect.width,
			height: rect.height,
			area: rect.width * rect.height
		};
	}
	function readCircleValue(circle, name) {
		const attrValue = circle?.getAttribute?.(name);
		if (attrValue != null && attrValue !== "") {
			const numeric = readNumber$1(attrValue);
			if (numeric != null) return numeric;
		}
		const animatedValue = circle?.[name]?.baseVal?.value;
		if (animatedValue != null) {
			const numeric = readNumber$1(animatedValue);
			if (numeric != null) return numeric;
		}
		return null;
	}
	function readCircleCenter(circle) {
		const cx = readCircleValue(circle, "cx");
		const cy = readCircleValue(circle, "cy");
		if (cx != null && cy != null) return {
			cx,
			cy
		};
		const rect = readBoundingBoxLike(circle);
		if (rect.width > 0 && rect.height > 0) return {
			cx: rect.left + rect.width / 2,
			cy: rect.top + rect.height / 2
		};
		return null;
	}
	function isPrimitiveSemanticValue(value) {
		return value == null || [
			"string",
			"number",
			"boolean"
		].includes(typeof value);
	}
	function extractPrimitiveSemanticFields(value) {
		if (!value || typeof value !== "object" || Array.isArray(value)) return {};
		return Object.fromEntries(Object.entries(value).filter(([key, entryValue]) => {
			if (typeof key !== "string" || key.length === 0) return false;
			if (key.startsWith("__")) return false;
			return isPrimitiveSemanticValue(entryValue);
		}));
	}
	function isGeometryLikeFieldName(fieldName = "") {
		return [
			"x",
			"y",
			"z",
			"cx",
			"cy",
			"r",
			"index",
			"i"
		].includes(String(fieldName).trim());
	}
	function scoreSemanticFieldSet(fields = {}) {
		return Object.entries(fields).reduce((score, [fieldName, value]) => {
			if (isGeometryLikeFieldName(fieldName)) return score;
			if (typeof value === "number" && Number.isFinite(value)) return score + 3;
			if (typeof value === "string" && value.length > 0) return score + 2;
			if (typeof value === "boolean") return score + 1;
			return score;
		}, 0);
	}
	function readSemanticDatumFields(value) {
		if (!value || typeof value !== "object" || Array.isArray(value)) return {};
		const topLevelFields = extractPrimitiveSemanticFields(value);
		const bestNestedFields = [
			"data",
			"datum",
			"row",
			"source",
			"item",
			"value"
		].map((key) => extractPrimitiveSemanticFields(value?.[key])).filter((fields) => Object.keys(fields).length > 0).sort((left, right) => {
			const scoreDelta = scoreSemanticFieldSet(right) - scoreSemanticFieldSet(left);
			if (scoreDelta !== 0) return scoreDelta;
			return Object.keys(right).length - Object.keys(left).length;
		})[0] || {};
		return scoreSemanticFieldSet(bestNestedFields) > scoreSemanticFieldSet(topLevelFields) || scoreSemanticFieldSet(bestNestedFields) === scoreSemanticFieldSet(topLevelFields) && Object.keys(bestNestedFields).length > Object.keys(topLevelFields).length ? {
			...topLevelFields,
			...bestNestedFields
		} : topLevelFields;
	}
	function extractScatterDatumFields(mark) {
		const datum = mark?.__data__;
		return readSemanticDatumFields(datum);
	}
	function hasSemanticScatterFields(fields = {}) {
		return Object.keys(fields).some((fieldName) => fieldName !== "id" && !fieldName.startsWith("__") && !isGeometryLikeFieldName(fieldName));
	}
	function isPointLikePath(path) {
		const rect = readBoundingBoxLike(path);
		if (rect.width <= 0 || rect.height <= 0) return false;
		if (rect.width > 24 || rect.height > 24) return false;
		if (rect.width * rect.height > 576) return false;
		return true;
	}
	function isLineLikePath(path) {
		if (!path) return false;
		if (isPointLikePath(path)) return false;
		if (typeof path.closest === "function" && path.closest("[data-widgetva-line-selection-overlay=\"true\"], [data-widgetva-line-ma-overlay=\"true\"], [data-widgetva-line-trend-overlay=\"true\"], [data-widgetva-line-drilldown-overlay=\"true\"]")) return false;
		const d = typeof path.getAttribute === "function" ? path.getAttribute("d") : "";
		if (typeof d === "string" && /z\s*$/i.test(d.trim())) return false;
		const fill = typeof path.getAttribute === "function" ? path.getAttribute("fill") : null;
		if (typeof fill === "string" && fill.trim() && !["none", "transparent"].includes(fill.trim().toLowerCase())) return false;
		const rect = readBoundingBoxLike(path);
		if (rect.width <= 0 || rect.height <= 0) return false;
		return rect.width >= 20 || rect.height >= 20;
	}
	function readPathCenter(path) {
		if (!isPointLikePath(path)) return null;
		const rect = readBoundingBoxLike(path);
		return {
			cx: rect.left + rect.width / 2,
			cy: rect.top + rect.height / 2
		};
	}
	function findObservableD3PointMarks(root = globalThis.window) {
		const surface = findPrimaryObservableD3Surface(root);
		if (!surface?.querySelectorAll) return [];
		const circles = [...surface.querySelectorAll("circle")];
		const paths = [...surface.querySelectorAll("path")].filter((path) => isPointLikePath(path));
		if (circles.length > 0) return circles;
		return paths;
	}
	function findObservableD3LinePaths(root = globalThis.window) {
		const surface = findPrimaryObservableD3Surface(root);
		if (!surface?.querySelectorAll) return [];
		return [...surface.querySelectorAll("path")].filter((path) => isLineLikePath(path));
	}
	function isBarLikeRect(rect) {
		if (!rect) return false;
		if (rect.width <= 0 || rect.height <= 0) return false;
		if (rect.width < 2 && rect.height < 2) return false;
		if (rect.width > 2e3 || rect.height > 2e3) return false;
		return true;
	}
	function findObservableD3BarMarks(root = globalThis.window) {
		const surface = findPrimaryObservableD3Surface(root);
		if (!surface?.querySelectorAll) return [];
		return [...surface.querySelectorAll("rect")].filter((rect) => isBarLikeRect(readBoundingBoxLike(rect)));
	}
	function readAncestorChain(node, stopNode) {
		const chain = [];
		let current = node;
		while (current) {
			chain.push(current);
			if (current === stopNode) break;
			current = current.parentNode || null;
		}
		return chain;
	}
	function findObservableD3MarkContainer(root = globalThis.window) {
		const surface = findPrimaryObservableD3Surface(root);
		const marks = findObservableD3PointMarks(root);
		if (!surface || marks.length === 0) return null;
		const firstChain = readAncestorChain(marks[0], surface);
		if (firstChain.length === 0) return null;
		let deepestCommon = surface;
		for (const candidate of firstChain) if (marks.every((mark) => readAncestorChain(mark, surface).includes(candidate))) {
			deepestCommon = candidate;
			break;
		}
		return deepestCommon === surface ? null : deepestCommon;
	}
	function readLocalRectWithinSurface(surfaceRect, rect) {
		if (!surfaceRect || !rect) return null;
		return {
			left: rect.left - surfaceRect.left,
			top: rect.top - surfaceRect.top,
			width: rect.width,
			height: rect.height
		};
	}
	function findObservableD3PlotRegion(root = globalThis.window) {
		const surface = findPrimaryObservableD3Surface(root);
		if (!surface) return null;
		const surfaceRect = readBoundingBoxLike(surface);
		const marks = findObservableD3PointMarks(root);
		const markContainer = findObservableD3MarkContainer(root);
		if (markContainer) {
			const containerRect = readBoundingBoxLike(markContainer);
			return {
				source: "mark-container",
				targetTag: typeof markContainer.tagName === "string" ? markContainer.tagName.toLowerCase() : null,
				markCount: marks.length,
				screenRect: containerRect,
				localRect: readLocalRectWithinSurface(surfaceRect, containerRect),
				surfaceRect
			};
		}
		if (marks.length > 0) {
			const marksUnionRect = unionRects(marks.map((mark) => readBoundingBoxLike(mark)));
			if (marksUnionRect) return {
				source: "mark-bounds",
				targetTag: "marks-union",
				markCount: marks.length,
				screenRect: marksUnionRect,
				localRect: readLocalRectWithinSurface(surfaceRect, marksUnionRect),
				surfaceRect
			};
		}
		return {
			source: "surface",
			targetTag: typeof surface.tagName === "string" ? surface.tagName.toLowerCase() : null,
			markCount: marks.length,
			screenRect: surfaceRect,
			localRect: {
				left: 0,
				top: 0,
				width: surfaceRect.width,
				height: surfaceRect.height
			},
			surfaceRect
		};
	}
	function normalizeAxisTitleText(text = "") {
		return String(text).replace(/[←↑→↓]/g, "").replace(/\s+/g, " ").trim();
	}
	function readScatterAxisTitle(labels = [], plotRegion = null, axis = "x") {
		const plotLeft = plotRegion?.screenRect?.left || 0;
		const plotTop = plotRegion?.screenRect?.top || 0;
		const plotWidth = plotRegion?.screenRect?.width || 0;
		const plotHeight = plotRegion?.screenRect?.height || 0;
		const plotRight = plotLeft + plotWidth;
		const plotBottom = plotTop + plotHeight;
		return normalizeAxisTitleText(labels.filter((label) => !isNumericOrDateLikeText(label.text)).map((label) => {
			const centerX = label.rect.left + label.rect.width / 2;
			const centerY = label.rect.top + label.rect.height / 2;
			if (axis === "x") {
				if (centerX < plotLeft || centerX > plotRight) return null;
				if (centerY < plotBottom) return null;
				return {
					label,
					penalty: Math.abs(centerX - (plotLeft + plotWidth / 2))
				};
			}
			if (centerY < plotTop || centerY > plotBottom) return null;
			if (centerX > plotLeft) return null;
			return {
				label,
				penalty: Math.abs(centerY - (plotTop + plotHeight / 2))
			};
		}).filter(Boolean).sort((left, right) => left.penalty - right.penalty)[0]?.label?.text || "");
	}
	function readScatterAxisTickEntries(labels = [], plotRegion = null, axis = "x") {
		const plotLeft = plotRegion?.screenRect?.left || 0;
		const plotTop = plotRegion?.screenRect?.top || 0;
		const plotWidth = plotRegion?.screenRect?.width || 0;
		const plotHeight = plotRegion?.screenRect?.height || 0;
		const plotRight = plotLeft + plotWidth;
		const plotBottom = plotTop + plotHeight;
		const axisTolerance = 18;
		return labels.filter((label) => isNumericOrDateLikeText(label.text)).map((label) => {
			const value = readNumber$1(label.text.replace(/,/g, ""));
			if (value == null) return null;
			const centerX = label.rect.left + label.rect.width / 2;
			const centerY = label.rect.top + label.rect.height / 2;
			if (axis === "x") {
				if (centerX < plotLeft || centerX > plotRight) return null;
				if (centerY < plotBottom - 10) return null;
				return {
					value,
					position: centerX
				};
			}
			if (centerY < plotTop - axisTolerance || centerY > plotBottom + axisTolerance) return null;
			if (centerX > plotLeft + 8) return null;
			return {
				value,
				position: centerY
			};
		}).filter(Boolean);
	}
	function inferLinearAxisProjection(ticks = []) {
		const sorted = (Array.isArray(ticks) ? ticks : []).filter((tick) => Number.isFinite(tick?.value) && Number.isFinite(tick?.position)).sort((left, right) => left.position - right.position);
		if (sorted.length < 2) return null;
		const first = sorted[0];
		const last = sorted[sorted.length - 1];
		if (first.position === last.position) return null;
		const slope = (last.value - first.value) / (last.position - first.position);
		const intercept = first.value - slope * first.position;
		return {
			slope,
			intercept,
			project(position) {
				return slope * position + intercept;
			}
		};
	}
	function inferScatterSemanticFallback({ root, rows, semanticHints = {} }) {
		const normalizedRows = Array.isArray(rows) ? rows : [];
		if (normalizedRows.length === 0) return normalizedRows;
		if (normalizedRows.some((row) => hasSemanticScatterFields(row))) return normalizedRows;
		const surface = findPrimaryObservableD3Surface(root);
		const plotRegion = findObservableD3PlotRegion(root);
		const labels = readTextNodes(surface);
		const xTicks = readScatterAxisTickEntries(labels, plotRegion, "x");
		const yTicks = readScatterAxisTickEntries(labels, plotRegion, "y");
		const xProjection = inferLinearAxisProjection(xTicks);
		const yProjection = inferLinearAxisProjection(yTicks);
		const xField = semanticHints?.xField || readScatterAxisTitle(labels, plotRegion, "x") || null;
		const yField = semanticHints?.yField || readScatterAxisTitle(labels, plotRegion, "y") || null;
		if (!xProjection || !yProjection || !xField || !yField) return normalizedRows;
		return normalizedRows.map((row) => ({
			...row,
			[xField]: xProjection.project(row.__screenX),
			[yField]: yProjection.project(row.__screenY)
		}));
	}
	function readObservableD3ScatterRows(root = globalThis.window, options = {}) {
		return inferScatterSemanticFallback({
			root,
			rows: findObservableD3PointMarks(root).map((mark, index) => {
				const center = (typeof mark?.tagName === "string" ? mark.tagName.toLowerCase() : "") === "circle" ? readCircleCenter(mark) : readPathCenter(mark);
				if (!center) return null;
				return {
					id: `pt_${index + 1}`,
					__screenX: center.cx,
					__screenY: center.cy,
					...extractScatterDatumFields(mark)
				};
			}).filter(Boolean),
			semanticHints: options?.semanticHints || {}
		});
	}
	function normalizeRefToken$1(value, fallback = "field") {
		return String(value || fallback).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
	}
	function makeObservableD3ScatterMatrixCellRef({ xField = null, yField = null, index = 0 } = {}) {
		return `wl://observable-d3/scatter-matrix/cell/${normalizeRefToken$1(xField, `x-${index + 1}`)}-${normalizeRefToken$1(yField, `y-${index + 1}`)}`;
	}
	function normalizeMatrixFields(fields = []) {
		return (Array.isArray(fields) ? fields : []).map((field) => typeof field === "string" ? field.trim() : "").filter((field, index, values) => field.length > 0 && values.indexOf(field) === index);
	}
	function readMatrixFieldsFromLabels(surface) {
		return readTextNodes(surface).map((label) => normalizeAxisTitleText(label.text)).filter((text) => text.length > 0 && text.length <= 40 && !isNumericOrDateLikeText(text) && !/^d3$/i.test(text) && !/^chart$/i.test(text)).filter((text, index, values) => values.indexOf(text) === index);
	}
	function findMatrixBandIndex(value, bands = []) {
		if (!Number.isFinite(value) || bands.length === 0) return -1;
		let bestIndex = 0;
		let bestDistance = Math.abs(value - bands[0]);
		bands.forEach((band, index) => {
			const distance = Math.abs(value - band);
			if (distance < bestDistance) {
				bestDistance = distance;
				bestIndex = index;
			}
		});
		return bestIndex;
	}
	function readMatrixGridBindings(groups = [], semanticHints = {}, surface = null) {
		const matrixFields = normalizeMatrixFields(semanticHints?.matrixFields);
		const labelFields = matrixFields.length >= 2 ? matrixFields : readMatrixFieldsFromLabels(surface);
		const fields = labelFields.length >= 2 ? labelFields : matrixFields;
		if (fields.length < 2 || groups.length === 0) return /* @__PURE__ */ new Map();
		const rects = groups.map((group) => readBoundingBoxLike(group.container));
		const columns = Array.from(new Set(rects.map((rect) => Math.round(rect.left)))).sort((left, right) => left - right);
		const rows = Array.from(new Set(rects.map((rect) => Math.round(rect.top)))).sort((left, right) => left - right);
		const bindings = /* @__PURE__ */ new Map();
		groups.forEach((group, index) => {
			const rect = rects[index];
			const columnIndex = findMatrixBandIndex(Math.round(rect.left), columns);
			const rowIndex = findMatrixBandIndex(Math.round(rect.top), rows);
			if (columnIndex < 0 || rowIndex < 0) return;
			const fullGrid = fields.length === columns.length && fields.length === rows.length;
			const lowerTriangle = fields.length === columns.length + 1 && fields.length === rows.length + 1;
			const xField = fields[columnIndex] || null;
			const yField = lowerTriangle ? fields[rowIndex + 1] || null : fullGrid ? fields[rowIndex] || null : fields[rowIndex] || null;
			if (xField && yField) bindings.set(group, {
				xField,
				yField
			});
		});
		return bindings;
	}
	function readDefaultMatrixFieldDomain(fieldName = null) {
		const field = String(fieldName || "").toLowerCase();
		if (field.includes("mpg") || field.includes("economy") || field.includes("fuel")) return [10, 50];
		if (field.includes("horsepower") || field.includes("power") || field.includes("hp")) return [40, 250];
		if (field.includes("weight")) return [1500, 5500];
		if (field.includes("displacement") || field.includes("engine") || field.includes("cc")) return [50, 500];
		if (field.includes("cylinder")) return [3, 8];
		if (field.includes("0-60") || field.includes("acceleration")) return [8, 25];
		if (field === "year" || field.endsWith(" year")) return [1970, 1983];
		return null;
	}
	function projectScreenValueToDomain(position, bounds = null, axis = "x", domain = null) {
		if (!Number.isFinite(position) || !bounds || !Array.isArray(domain) || domain.length < 2) return null;
		const span = axis === "x" ? bounds.width : bounds.height;
		const origin = axis === "x" ? bounds.left : bounds.top;
		if (!Number.isFinite(span) || span <= 0 || !Number.isFinite(origin)) return null;
		const ratio = Math.max(0, Math.min(1, (position - origin) / span));
		if (axis === "y") return domain[1] - ratio * (domain[1] - domain[0]);
		return domain[0] + ratio * (domain[1] - domain[0]);
	}
	function enrichMatrixRowsWithProjectedFields(rows = [], { xField = null, yField = null, bounds = null } = {}) {
		const xDomain = readDefaultMatrixFieldDomain(xField);
		const yDomain = readDefaultMatrixFieldDomain(yField);
		if (!xField || !yField || !xDomain || !yDomain) return rows;
		return rows.map((row) => {
			const next = { ...row };
			if (!Number.isFinite(next[xField])) {
				const xValue = projectScreenValueToDomain(next.__screenX, bounds, "x", xDomain);
				if (xValue != null) next[xField] = xValue;
			}
			if (!Number.isFinite(next[yField])) {
				const yValue = projectScreenValueToDomain(next.__screenY, bounds, "y", yDomain);
				if (yValue != null) next[yField] = yValue;
			}
			return next;
		});
	}
	function findScatterMatrixCellContainer(mark, surface) {
		const chain = readAncestorChain(mark, surface).filter((node) => node && node !== mark && node !== surface);
		for (const candidate of chain) {
			const rect = readBoundingBoxLike(candidate);
			if (rect.width >= 24 && rect.height >= 24) return candidate;
		}
		return null;
	}
	function readScatterRowFromMark(mark, index) {
		const center = (typeof mark?.tagName === "string" ? mark.tagName.toLowerCase() : "") === "circle" ? readCircleCenter(mark) : readPathCenter(mark);
		if (!center) return null;
		return {
			id: `pt_${index + 1}`,
			__screenX: center.cx,
			__screenY: center.cy,
			...extractScatterDatumFields(mark)
		};
	}
	function readObservableD3ScatterMatrixGroups(root = globalThis.window, options = {}) {
		const surface = findPrimaryObservableD3Surface(root);
		if (!surface) return [];
		const marks = findObservableD3PointMarks(root);
		const groups = [];
		const groupsByContainer = /* @__PURE__ */ new Map();
		marks.forEach((mark, markIndex) => {
			const container = findScatterMatrixCellContainer(mark, surface);
			if (!container) return;
			const row = readScatterRowFromMark(mark, markIndex);
			if (!row) return;
			if (!groupsByContainer.has(container)) {
				const group = {
					container,
					marks: [],
					rows: []
				};
				groupsByContainer.set(container, group);
				groups.push(group);
			}
			const group = groupsByContainer.get(container);
			group.marks.push(mark);
			group.rows.push(row);
		});
		const minCells = Number.isFinite(options?.minCells) ? Math.max(1, Number(options.minCells)) : 2;
		const minRowsPerCell = Number.isFinite(options?.minRowsPerCell) ? Math.max(1, Number(options.minRowsPerCell)) : 2;
		const gridBindings = readMatrixGridBindings(groups, options?.semanticHints || {}, surface);
		const cells = groups.filter((group) => group.rows.length >= minRowsPerCell).map((group, index) => {
			const inferredRows = inferScatterSemanticFallback({
				root,
				rows: group.rows,
				semanticHints: options?.semanticHints || {}
			});
			const bindings = inferObservableD3ScatterFieldBindings(inferredRows);
			const gridBinding = gridBindings.get(group) || null;
			const xField = bindings?.xField || gridBinding?.xField || null;
			const yField = bindings?.yField || gridBinding?.yField || null;
			const bounds = readBoundingBoxLike(group.container);
			const rows = enrichMatrixRowsWithProjectedFields(inferredRows, {
				xField,
				yField,
				bounds
			});
			return {
				ref: makeObservableD3ScatterMatrixCellRef({
					xField,
					yField,
					index
				}),
				xField,
				yField,
				bounds,
				rowCount: rows.length,
				container: group.container,
				marks: rows.map((row, rowIndex) => ({
					row,
					mark: group.marks?.[rowIndex] || null
				})),
				rows
			};
		});
		return cells.length >= minCells ? cells : [];
	}
	function readObservableD3ScatterMatrix(root = globalThis.window, options = {}) {
		const cells = readObservableD3ScatterMatrixGroups(root, options);
		const rowKeys = /* @__PURE__ */ new Set();
		const rows = [];
		for (const cell of cells) for (const row of Array.isArray(cell?.rows) ? cell.rows : []) {
			const semanticEntries = Object.entries(row || {}).filter(([key]) => key !== "id" && !key.startsWith("__screen")).sort(([left], [right]) => left.localeCompare(right));
			const key = semanticEntries.length > 0 ? JSON.stringify(semanticEntries) : JSON.stringify(Object.entries(row || {}).sort(([left], [right]) => left.localeCompare(right)));
			if (rowKeys.has(key)) continue;
			rowKeys.add(key);
			rows.push(clone(row));
		}
		return {
			kind: "scatterMatrix",
			cells: cells.map(({ container: _container, marks: _marks, ...cell }) => cell),
			rows,
			rowCount: cells.length > 0 ? Math.max(...cells.map((cell) => cell.rowCount), 0) : rows.length
		};
	}
	function isFiniteNumber(value) {
		return typeof value === "number" && Number.isFinite(value);
	}
	function collectScatterNumericFieldValues(rows = [], fieldName = "") {
		return (Array.isArray(rows) ? rows : []).map((row) => row?.[fieldName]).filter(isFiniteNumber);
	}
	function computePearsonCorrelation(left = [], right = []) {
		if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length || left.length < 2) return null;
		const count = left.length;
		const leftMean = left.reduce((sum, value) => sum + value, 0) / count;
		const rightMean = right.reduce((sum, value) => sum + value, 0) / count;
		let numerator = 0;
		let leftVariance = 0;
		let rightVariance = 0;
		for (let index = 0; index < count; index += 1) {
			const leftDelta = left[index] - leftMean;
			const rightDelta = right[index] - rightMean;
			numerator += leftDelta * rightDelta;
			leftVariance += leftDelta * leftDelta;
			rightVariance += rightDelta * rightDelta;
		}
		if (leftVariance === 0 || rightVariance === 0) return null;
		return numerator / Math.sqrt(leftVariance * rightVariance);
	}
	function rankScatterFieldCorrelation(rows = [], screenField = "__screenX") {
		const normalizedRows = Array.isArray(rows) ? rows : [];
		if (normalizedRows.length < 2) return [];
		return Object.keys(normalizedRows[0] || {}).filter((fieldName) => fieldName !== "id" && !fieldName.startsWith("__")).filter((fieldName) => collectScatterNumericFieldValues(normalizedRows, fieldName).length >= 2).map((fieldName) => {
			const pairs = normalizedRows.map((row) => {
				const semanticValue = row?.[fieldName];
				const screenValue = row?.[screenField];
				return isFiniteNumber(semanticValue) && isFiniteNumber(screenValue) ? [semanticValue, screenValue] : null;
			}).filter(Boolean);
			if (pairs.length < 2) return null;
			const correlation = computePearsonCorrelation(pairs.map(([semanticValue]) => semanticValue), pairs.map(([, screenValue]) => screenValue));
			if (correlation == null) return null;
			return {
				field: fieldName,
				score: Math.abs(correlation),
				correlation
			};
		}).filter(Boolean).sort((left, right) => right.score - left.score);
	}
	function inferObservableD3ScatterFieldBindings(rows = []) {
		const xCandidates = rankScatterFieldCorrelation(rows, "__screenX");
		const yCandidates = rankScatterFieldCorrelation(rows, "__screenY");
		const xField = xCandidates[0]?.field || null;
		let yField = yCandidates[0]?.field || null;
		if (xField && yField === xField) yField = yCandidates.find((candidate) => candidate.field !== xField)?.field || yField;
		return {
			xField,
			yField
		};
	}
	function readTextNodes(surface) {
		if (!surface?.querySelectorAll) return [];
		return [...surface.querySelectorAll("text")].map((node) => {
			const text = typeof node?.textContent === "string" ? node.textContent.trim() : "";
			if (!text) return null;
			return {
				node,
				text,
				rect: readBoundingBoxLike(node)
			};
		}).filter(Boolean);
	}
	function isNumericOrDateLikeText(text) {
		if (typeof text !== "string" || text.length === 0) return false;
		return /^-?\d+([.,]\d+)?$/.test(text) || /^\d{4}([/-]\d{1,2}([/-]\d{1,2})?)?$/.test(text) || /^[A-Z][a-z]{2,8}\s+\d{4}$/.test(text);
	}
	function inferBarOrientation(barRects = []) {
		if (!Array.isArray(barRects) || barRects.length === 0) return "vertical";
		const avgWidth = barRects.reduce((sum, rect) => sum + rect.width, 0) / barRects.length;
		return barRects.reduce((sum, rect) => sum + rect.height, 0) / barRects.length >= avgWidth ? "vertical" : "horizontal";
	}
	function pickBarCategoryLabel({ rect, labels, orientation, plotRegion }) {
		if (!Array.isArray(labels) || labels.length === 0) return null;
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;
		const plotBottom = plotRegion?.screenRect?.top + plotRegion?.screenRect?.height;
		const plotLeft = plotRegion?.screenRect?.left;
		const scored = labels.map((label) => {
			const labelCenterX = label.rect.left + label.rect.width / 2;
			const labelCenterY = label.rect.top + label.rect.height / 2;
			let penalty = 0;
			if (orientation === "vertical") {
				penalty += Math.abs(labelCenterX - centerX);
				if (Number.isFinite(plotBottom) && labelCenterY < plotBottom - 8) penalty += 2e3;
			} else {
				penalty += Math.abs(labelCenterY - centerY);
				if (Number.isFinite(plotLeft) && labelCenterX > plotLeft + 8) penalty += 2e3;
			}
			return {
				label,
				penalty
			};
		});
		scored.sort((left, right) => left.penalty - right.penalty);
		return scored[0]?.label?.text || null;
	}
	function readObservableD3BarRows(root = globalThis.window) {
		const surface = findPrimaryObservableD3Surface(root);
		const marks = findObservableD3BarMarks(root);
		const plotRegion = findObservableD3PlotRegion(root);
		const labels = readTextNodes(surface);
		const orientation = inferBarOrientation(marks.map((mark) => readBoundingBoxLike(mark)));
		return marks.map((mark, index) => {
			const rect = readBoundingBoxLike(mark);
			const category = pickBarCategoryLabel({
				rect,
				labels,
				orientation,
				plotRegion
			}) || `Category ${index + 1}`;
			return {
				id: `bar_${index + 1}`,
				category,
				__screenX: rect.left + rect.width / 2,
				__screenY: rect.top + rect.height / 2,
				__barLeft: rect.left,
				__barTop: rect.top,
				__barWidth: rect.width,
				__barHeight: rect.height
			};
		}).filter(Boolean);
	}
	function readObservableD3LineSeriesLabels(root = globalThis.window) {
		const surface = findPrimaryObservableD3Surface(root);
		const plotRegion = findObservableD3PlotRegion(root);
		const labels = readTextNodes(surface);
		const plotRight = plotRegion?.screenRect?.left + plotRegion?.screenRect?.width;
		const plotTop = plotRegion?.screenRect?.top || 0;
		const plotBottom = plotTop + (plotRegion?.screenRect?.height || 0);
		return labels.filter((label) => {
			if (isNumericOrDateLikeText(label.text)) return false;
			const centerY = label.rect.top + label.rect.height / 2;
			return centerY >= plotTop && centerY <= plotBottom && label.rect.left >= plotRight - 40;
		}).map((label) => label.text);
	}
	function readObservableD3LineXAxisLabels(root = globalThis.window) {
		const surface = findPrimaryObservableD3Surface(root);
		const plotRegion = findObservableD3PlotRegion(root);
		const labels = readTextNodes(surface);
		const plotLeft = plotRegion?.screenRect?.left || 0;
		const plotRight = plotLeft + (plotRegion?.screenRect?.width || 0);
		const plotBottom = plotRegion?.screenRect?.top + (plotRegion?.screenRect?.height || 0);
		return labels.filter((label) => {
			const centerX = label.rect.left + label.rect.width / 2;
			const centerY = label.rect.top + label.rect.height / 2;
			if (centerX < plotLeft || centerX > plotRight) return false;
			if (centerY < plotBottom - 8) return false;
			return isNumericOrDateLikeText(label.text);
		}).map((label) => label.text);
	}
	function readObservableD3LineSeriesValue(path, pathIndex = 0) {
		const datum = path?.__data__;
		if (!datum || typeof datum !== "object") return `Series ${pathIndex + 1}`;
		const directCandidates = [
			datum.key,
			datum.series,
			datum.Series,
			datum.symbol,
			datum.Symbol,
			datum.name,
			datum.id
		];
		for (const candidate of directCandidates) {
			if (candidate == null) continue;
			const text = String(candidate).trim();
			if (text) return text;
		}
		const firstPoint = (Array.isArray(datum) ? datum : Array.isArray(datum?.values) ? datum.values : Array.isArray(datum?.data) ? datum.data : [])[0];
		const nestedCandidates = [
			firstPoint?.series,
			firstPoint?.Series,
			firstPoint?.symbol,
			firstPoint?.Symbol,
			firstPoint?.name,
			firstPoint?.id
		];
		for (const candidate of nestedCandidates) {
			if (candidate == null) continue;
			const text = String(candidate).trim();
			if (text) return text;
		}
		return `Series ${pathIndex + 1}`;
	}
	function isDateLikeLineValue(value) {
		if (value == null || value === "") return false;
		if (value instanceof Date && Number.isFinite(value.getTime())) return true;
		if (typeof value === "number") return false;
		const parsed = Date.parse(String(value));
		return Number.isFinite(parsed);
	}
	function inferObservableD3LineBindings(rows = []) {
		const normalizedRows = Array.isArray(rows) ? rows : [];
		const fieldNames = [...new Set(normalizedRows.flatMap((row) => Object.keys(row || {})))].filter((fieldName) => typeof fieldName === "string" && fieldName !== "id" && fieldName !== "series" && fieldName !== "xValue" && !fieldName.startsWith("__"));
		const summarizeField = (fieldName) => {
			const values = normalizedRows.map((row) => row?.[fieldName]).filter((value) => value != null && value !== "");
			const numericValues = values.map((value) => typeof value === "number" ? value : Number(value)).filter((value) => Number.isFinite(value));
			const distinctValues = new Set(values.map((value) => String(value)));
			const lowerName = fieldName.toLowerCase();
			const dateLikeCount = values.filter((value) => isDateLikeLineValue(value)).length;
			return {
				fieldName,
				values,
				numericValues,
				distinctCount: distinctValues.size,
				allNumeric: values.length > 0 && numericValues.length === values.length,
				dateLikeCount,
				isTemporalName: /(date|time|year|month|day|week|quarter)/.test(lowerName),
				isSeriesLikeName: /(series|group|symbol|category|name|label)/.test(lowerName),
				isValueLikeName: /(value|count|amount|price|rate|total|close|open|high|low|volume|index)/.test(lowerName)
			};
		};
		const fieldStats = fieldNames.map(summarizeField);
		const xField = fieldStats.map((stats) => ({
			...stats,
			score: (stats.dateLikeCount > 0 ? 8 : 0) + (stats.isTemporalName ? 6 : 0) + (stats.distinctCount > 1 ? 2 : 0) + (!stats.isSeriesLikeName ? 1 : 0)
		})).sort((left, right) => right.score - left.score)[0]?.fieldName || null;
		const yField = fieldStats.filter((stats) => stats.fieldName !== xField).filter((stats) => stats.numericValues.length > 0).map((stats) => ({
			...stats,
			score: (stats.allNumeric ? 8 : 0) + (stats.isValueLikeName ? 5 : 0) + (stats.distinctCount > 1 ? 2 : 0)
		})).sort((left, right) => right.score - left.score)[0]?.fieldName || null;
		const xStats = fieldStats.find((stats) => stats.fieldName === xField) || null;
		return {
			xField,
			yField,
			xType: xStats?.dateLikeCount > 0 || xStats?.isTemporalName ? "temporal" : xStats?.allNumeric ? "quantitative" : "nominal"
		};
	}
	function readObservableD3LineRows(root = globalThis.window) {
		const semanticRows = findObservableD3LinePaths(root).flatMap((path, pathIndex) => {
			const datum = path?.__data__;
			const points = Array.isArray(datum) ? datum : Array.isArray(datum?.values) ? datum.values : Array.isArray(datum?.data) ? datum.data : [];
			if (points.length === 0) return [];
			const series = readObservableD3LineSeriesValue(path, pathIndex);
			return points.map((point, pointIndex) => {
				const fields = readSemanticDatumFields(point);
				return {
					id: `line_${pathIndex + 1}_${pointIndex + 1}`,
					series,
					__seriesIndex: pathIndex + 1,
					...fields
				};
			});
		});
		if (semanticRows.length > 0) {
			const bindings = inferObservableD3LineBindings(semanticRows);
			return semanticRows.map((row) => ({
				...row,
				xValue: bindings.xField && row?.[bindings.xField] != null ? String(row[bindings.xField]) : row?.xValue != null ? String(row.xValue) : null
			}));
		}
		const series = readObservableD3LineSeriesLabels(root);
		const xValues = readObservableD3LineXAxisLabels(root);
		const seriesValues = series.length > 0 ? series : ["Series 1"];
		const domainValues = xValues.length > 0 ? xValues : ["Point 1"];
		return seriesValues.flatMap((seriesName, seriesIndex) => domainValues.map((xValue, pointIndex) => ({
			id: `line_${seriesIndex + 1}_${pointIndex + 1}`,
			series: seriesName,
			xValue,
			__seriesIndex: seriesIndex + 1
		})));
	}
	function summarizeObservableD3ScatterRows(rows = []) {
		const normalizedRows = Array.isArray(rows) ? rows : [];
		if (normalizedRows.length === 0) return {
			count: 0,
			xMin: null,
			xMax: null,
			yMin: null,
			yMax: null,
			sample: []
		};
		const xs = normalizedRows.map((row) => row.__screenX).filter(Number.isFinite);
		const ys = normalizedRows.map((row) => row.__screenY).filter(Number.isFinite);
		const fieldBindings = inferObservableD3ScatterFieldBindings(normalizedRows);
		return {
			count: normalizedRows.length,
			xMin: xs.length ? Math.min(...xs) : null,
			xMax: xs.length ? Math.max(...xs) : null,
			yMin: ys.length ? Math.min(...ys) : null,
			yMax: ys.length ? Math.max(...ys) : null,
			semanticFields: Object.keys(normalizedRows[0] || {}).filter((fieldName) => fieldName !== "id" && !fieldName.startsWith("__")),
			fieldBindings,
			sample: normalizedRows.slice(0, 5)
		};
	}
	function inferObservableD3WidgetKindFromSurface(summary = {}, notebook = null) {
		const slug = notebook?.slug || "";
		if (summary?.tagName === "canvas") return "custom";
		if (summary?.rectCount >= 8 && summary.rectCount > (summary.circleCount || 0)) return "bar";
		if (summary?.circleCount >= 8 && summary.circleCount >= (summary.rectCount || 0)) return "scatter";
		if ((summary?.pathCount || 0) >= 2 && (summary?.circleCount || 0) < 8 && (summary?.rectCount || 0) < 8) return "line";
		if (slug.includes("scatter")) return "scatter";
		if (slug.includes("bar")) return "bar";
		if (slug.includes("line") || slug.includes("index-chart")) return "line";
		return "custom";
	}
	function describeObservableD3Surface(root = globalThis.window, { notebook = null } = {}) {
		const normalizedRoot = normalizeRoot(root);
		const summary = summarizeObservableD3Surface(findPrimaryObservableD3Surface(normalizedRoot));
		const plotRegion = findObservableD3PlotRegion(normalizedRoot);
		return {
			surfaceTag: summary?.tagName || null,
			summary,
			plotRegion,
			inferredKind: inferObservableD3WidgetKindFromSurface(summary || {}, notebook)
		};
	}
	//#endregion
	//#region extension/src/content/observableD3NativeCapture.js
	function isNativeD3Api$1(candidate) {
		return Boolean(candidate && typeof candidate === "object" && (typeof candidate.readCaptureSnapshot === "function" || typeof candidate.applyBrushRegion === "function" || typeof candidate.clearBrush === "function"));
	}
	function readObservableD3NativeApi(root = globalThis.window) {
		const api = root?.__widgetVAObservableD3Native || null;
		return isNativeD3Api$1(api) ? api : null;
	}
	function readObservableD3NativeCaptureSnapshot(root = globalThis.window) {
		const api = readObservableD3NativeApi(root);
		if (!api || typeof api.readCaptureSnapshot !== "function") return { brushBindings: [] };
		const snapshot = api.readCaptureSnapshot();
		return snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot : { brushBindings: [] };
	}
	function applyObservableD3NativeBrushRegion(root = globalThis.window, command = null) {
		const api = readObservableD3NativeApi(root);
		if (!api || typeof api.applyBrushRegion !== "function") throw new Error("Observable D3 page does not expose a native brush-region executor.");
		return api.applyBrushRegion(command);
	}
	function clearObservableD3NativeBrush(root = globalThis.window, command = null) {
		const api = readObservableD3NativeApi(root);
		if (!api || typeof api.clearBrush !== "function") throw new Error("Observable D3 page does not expose a native brush clear executor.");
		return api.clearBrush(command);
	}
	//#endregion
	//#region extension/src/content/observableD3EarlyCapture.js
	function readNonEmptyString(value) {
		return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
	}
	function normalizeRefToken(value, fallback = "field") {
		return String(value || fallback).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
	}
	function makeScatterCellRef({ xField = null, yField = null, index = 0 } = {}) {
		return `wl://observable-d3/scatter-matrix/cell/${normalizeRefToken(xField, `x-${index + 1}`)}-${normalizeRefToken(yField, `y-${index + 1}`)}`;
	}
	function isPlainObject(value) {
		return Boolean(value && typeof value === "object" && !Array.isArray(value));
	}
	function isD3BrushBehavior(value) {
		return Boolean(typeof value === "function" && typeof value.move === "function");
	}
	function isNativeD3Api(candidate) {
		return Boolean(candidate && typeof candidate === "object" && (typeof candidate.readCaptureSnapshot === "function" || typeof candidate.applyBrushRegion === "function" || typeof candidate.clearBrush === "function"));
	}
	function readSelectionNodes(selection) {
		if (!selection || typeof selection !== "object") return [];
		if (Array.isArray(selection._groups)) return selection._groups.flat().filter(Boolean);
		if (typeof selection.nodes === "function") try {
			return selection.nodes().filter(Boolean);
		} catch {}
		return [];
	}
	function readScaleDomain(scale) {
		if (typeof scale?.domain !== "function") return null;
		try {
			const domain = scale.domain();
			return Array.isArray(domain) ? domain.slice(0, 2) : null;
		} catch {
			return null;
		}
	}
	function readScaleFromContext(context = {}, axis = "x", datum = null) {
		const value = context?.[axis];
		if (typeof value === "function") return value;
		if (Array.isArray(value) && Array.isArray(datum)) {
			const index = axis === "x" ? datum[0] : datum[1];
			return typeof value[index] === "function" ? value[index] : null;
		}
		return null;
	}
	function readFieldFromContext(context = {}, axis = "x", datum = null) {
		const explicit = axis === "x" ? context?.xField || context?.fields?.x : context?.yField || context?.fields?.y;
		if (readNonEmptyString(explicit)) return explicit;
		if (Array.isArray(context?.columns) && Array.isArray(datum)) {
			const index = axis === "x" ? datum[0] : datum[1];
			return readNonEmptyString(context.columns[index]);
		}
		return null;
	}
	function readBrushContext(args = []) {
		return args.slice(1).find((arg) => isPlainObject(arg) && (arg.xField || arg.yField || arg.fields || arg.columns || arg.x || arg.y || arg.targetRef || arg.bindingId)) || {};
	}
	function projectExtent(scale, domain = []) {
		if (typeof scale !== "function" || !Array.isArray(domain) || domain.length < 2) return null;
		const pixels = domain.slice(0, 2).map((value) => Number(scale(value)));
		if (!pixels.every(Number.isFinite)) return null;
		return [Math.min(...pixels), Math.max(...pixels)];
	}
	function createCaptureState(root) {
		return {
			root,
			nextBindingIndex: 1,
			patchedD3Objects: /* @__PURE__ */ new WeakSet(),
			bindings: /* @__PURE__ */ new Map(),
			bindingIdByNode: /* @__PURE__ */ new WeakMap()
		};
	}
	function createBindingSnapshot(binding) {
		return {
			bindingId: binding.bindingId,
			targetRef: binding.targetRef,
			kind: "scatter",
			interaction: "brush",
			fields: {
				x: binding.xField,
				y: binding.yField
			},
			domain: {
				x: readScaleDomain(binding.xScale),
				y: readScaleDomain(binding.yScale)
			}
		};
	}
	function registerBrushBinding(state, { d3, brush, node, context = {}, index = 0 } = {}) {
		if (!state || !d3 || !brush || !node) return null;
		const datum = Array.isArray(node.__data__) ? node.__data__ : null;
		const xField = readFieldFromContext(context, "x", datum);
		const yField = readFieldFromContext(context, "y", datum);
		const xScale = readScaleFromContext(context, "x", datum);
		const yScale = readScaleFromContext(context, "y", datum);
		if (!xField || !yField || typeof xScale !== "function" || typeof yScale !== "function") return null;
		const existingId = state.bindingIdByNode.get(node);
		const bindingId = readNonEmptyString(context.bindingId) || existingId || `observable_d3_brush_${state.nextBindingIndex++}`;
		const binding = {
			bindingId,
			targetRef: readNonEmptyString(context.targetRef) || makeScatterCellRef({
				xField,
				yField,
				index
			}),
			d3,
			brush,
			node,
			xField,
			yField,
			xScale,
			yScale
		};
		state.bindingIdByNode.set(node, bindingId);
		state.bindings.set(bindingId, binding);
		return binding;
	}
	function applyBrushBinding(binding, { xDomain = null, yDomain = null } = {}) {
		const xPixels = projectExtent(binding?.xScale, xDomain);
		const yPixels = projectExtent(binding?.yScale, yDomain);
		if (!xPixels || !yPixels) throw new Error("Observable D3 native brush requires xDomain and yDomain values that can be projected by the captured scales.");
		const pixelSelection = [[xPixels[0], yPixels[0]], [xPixels[1], yPixels[1]]];
		binding.d3.select(binding.node).call(binding.brush.move, pixelSelection);
		return {
			ok: true,
			bindingId: binding.bindingId,
			targetRef: binding.targetRef,
			pixelSelection
		};
	}
	function clearBrushBinding(binding) {
		binding.d3.select(binding.node).call(binding.brush.move, null);
		return {
			ok: true,
			bindingId: binding.bindingId,
			targetRef: binding.targetRef,
			cleared: true
		};
	}
	function patchD3SelectionCall(state, d3) {
		if (!d3 || typeof d3 !== "object" || state.patchedD3Objects.has(d3)) return false;
		const selectionPrototype = d3.selection?.prototype;
		if (!selectionPrototype || typeof selectionPrototype.call !== "function") return false;
		const originalCall = selectionPrototype.call;
		const widgetvaState = state;
		selectionPrototype.call = function widgetvaCapturedD3SelectionCall() {
			const args = Array.prototype.slice.call(arguments);
			const callback = args[0];
			if (isD3BrushBehavior(callback)) {
				const context = readBrushContext(args);
				readSelectionNodes(this).forEach((node, index) => {
					registerBrushBinding(widgetvaState, {
						d3,
						brush: callback,
						node,
						context,
						index
					});
				});
			}
			return originalCall.apply(this, args);
		};
		selectionPrototype.call.__widgetvaOriginalCall = originalCall;
		state.patchedD3Objects.add(d3);
		return true;
	}
	function installD3PropertyCapture(root, state) {
		let currentValue = root.d3;
		patchD3SelectionCall(state, currentValue);
		try {
			Object.defineProperty(root, "d3", {
				configurable: true,
				enumerable: true,
				get() {
					return currentValue;
				},
				set(nextValue) {
					currentValue = nextValue;
					patchD3SelectionCall(state, currentValue);
				}
			});
		} catch {
			patchD3SelectionCall(state, root.d3);
		}
	}
	function installObservableD3EarlyCapture(root = globalThis.window) {
		if (!root || typeof root !== "object") throw new Error("installObservableD3EarlyCapture requires a browser-like root object.");
		if (isNativeD3Api(root.__widgetVAObservableD3Native)) return root.__widgetVAObservableD3Native;
		const state = createCaptureState(root);
		installD3PropertyCapture(root, state);
		const api = {
			isInstalled: true,
			readCaptureSnapshot() {
				return { brushBindings: [...state.bindings.values()].map(createBindingSnapshot) };
			},
			applyBrushRegion(command = {}) {
				const binding = state.bindings.get(command?.bindingId);
				if (!binding) throw new Error(`Observable D3 native brush binding not found: ${command?.bindingId || "unknown"}.`);
				return applyBrushBinding(binding, command);
			},
			clearBrush(command = {}) {
				const binding = state.bindings.get(command?.bindingId);
				if (!binding) throw new Error(`Observable D3 native brush binding not found: ${command?.bindingId || "unknown"}.`);
				return clearBrushBinding(binding);
			},
			patchD3(d3) {
				return patchD3SelectionCall(state, d3);
			}
		};
		root.__widgetVAObservableD3Native = api;
		return api;
	}
	//#endregion
	//#region extension/src/content/observableD3WorkerContentScript.js
	var REQUEST_TYPE = "widgetva:observable-d3-worker-request";
	var RESPONSE_TYPE = "widgetva:observable-d3-worker-response";
	var SOURCE_TOP = "widgetva-observable-d3-top";
	var SOURCE_WORKER = "widgetva-observable-d3-worker";
	var WIDGETVA_SURFACE_PROBE_ATTR = "data-widgetva-surface-probe";
	var WIDGETVA_VIEWBOX_CACHE_ATTR = "data-widgetva-original-viewbox";
	var WIDGETVA_LINE_SLICE_ATTR = "data-widgetva-line-slice-overlay";
	var WIDGETVA_LINE_SELECTION_ATTR = "data-widgetva-line-selection-overlay";
	var WIDGETVA_LINE_TREND_ATTR = "data-widgetva-line-trend-overlay";
	var WIDGETVA_LINE_MA_ATTR = "data-widgetva-line-ma-overlay";
	var WIDGETVA_LINE_DRILLDOWN_ATTR = "data-widgetva-line-drilldown-overlay";
	var WIDGETVA_LINE_RESAMPLE_ATTR = "data-widgetva-line-resample-overlay";
	var WIDGETVA_SCATTER_REGRESSION_ATTR = "data-widgetva-scatter-regression-overlay";
	var WIDGETVA_ZOOM_OVERLAY_ATTR = "data-widgetva-zoom-overlay";
	var originalMarkState = /* @__PURE__ */ new WeakMap();
	var originalSurfaceState = /* @__PURE__ */ new WeakMap();
	var currentViewport = null;
	var currentLineViewport = null;
	var lastBarSelection = null;
	var currentBarFilter = null;
	var currentBarHighlight = null;
	var lastLineOverlayResult = null;
	var lastLineViewportResult = null;
	var lastLineAnnotationResult = null;
	var lineScreenOverlayLifecycle = null;
	var currentLineSeriesSelection = null;
	var currentLineXSelection = null;
	var currentLineFocus = null;
	var currentLineBold = null;
	var currentLineFilter = null;
	var currentLineResample = null;
	installObservableD3EarlyCapture(window);
	function readSurfaceAndMarks() {
		return {
			surface: findPrimaryObservableD3Surface(window),
			marks: findObservableD3PointMarks(window)
		};
	}
	function readSurfaceAndBarMarks() {
		return {
			surface: findPrimaryObservableD3Surface(window),
			marks: findObservableD3BarMarks(window)
		};
	}
	function readSurfaceAndLinePaths() {
		return {
			surface: findPrimaryObservableD3Surface(window),
			paths: findObservableD3LinePaths(window)
		};
	}
	function readNumber(value) {
		const numeric = Number(value);
		return Number.isFinite(numeric) ? numeric : null;
	}
	function readRectLike(node) {
		try {
			if (typeof node?.getBoundingClientRect === "function") {
				const rect = node.getBoundingClientRect();
				return {
					left: readNumber(rect?.left) || 0,
					top: readNumber(rect?.top) || 0,
					width: readNumber(rect?.width) || 0,
					height: readNumber(rect?.height) || 0
				};
			}
		} catch {}
		return {
			left: 0,
			top: 0,
			width: 0,
			height: 0
		};
	}
	function markUsesSvgLocalCoordinates(mark) {
		if (typeof mark?.tagName !== "string" || mark.tagName.toLowerCase() !== "circle") return false;
		const attrCx = readNumber(mark.getAttribute?.("cx"));
		const attrCy = readNumber(mark.getAttribute?.("cy"));
		if (attrCx != null && attrCy != null) return true;
		const baseCx = readNumber(mark.cx?.baseVal?.value);
		const baseCy = readNumber(mark.cy?.baseVal?.value);
		return baseCx != null && baseCy != null;
	}
	function inferScatterCoordinateSpace(marks = []) {
		return marks.some((mark) => markUsesSvgLocalCoordinates(mark)) ? "svg-local" : "viewport";
	}
	function viewportPointToSvg(surface, x, y) {
		if (surface && typeof surface.createSVGPoint === "function" && typeof surface.getScreenCTM === "function") try {
			const inverse = surface.getScreenCTM()?.inverse?.();
			if (inverse) {
				const point = surface.createSVGPoint();
				point.x = x;
				point.y = y;
				const transformed = point.matrixTransform(inverse);
				return {
					x: transformed.x,
					y: transformed.y
				};
			}
		} catch {}
		const rect = readRectLike(surface);
		return {
			x: x - rect.left,
			y: y - rect.top
		};
	}
	function removeZoomOverlay(surface) {
		surface?.querySelector?.(`[${WIDGETVA_ZOOM_OVERLAY_ATTR}="true"]`)?.remove?.();
	}
	function removeLineSliceOverlay(surface) {
		surface?.ownerDocument?.querySelector?.(`[${WIDGETVA_LINE_SLICE_ATTR}="true"]`)?.remove?.();
	}
	function removeLineSelectionOverlay(surface) {
		const doc = surface?.ownerDocument || window.document;
		if (lineScreenOverlayLifecycle) {
			try {
				lineScreenOverlayLifecycle.observer?.disconnect?.();
			} catch {}
			lineScreenOverlayLifecycle.listeners?.forEach(({ target, type, handler, options }) => {
				try {
					target?.removeEventListener?.(type, handler, options);
				} catch {}
			});
			lineScreenOverlayLifecycle = null;
		}
		doc?.querySelectorAll?.(`[${WIDGETVA_LINE_SELECTION_ATTR}="true"]`)?.forEach((node) => node.remove?.());
	}
	function removeLineTrendOverlay(surface) {
		surface?.querySelector?.(`[${WIDGETVA_LINE_TREND_ATTR}="true"]`)?.remove?.();
	}
	function removeLineMovingAverageOverlay(surface) {
		surface?.querySelector?.(`[${WIDGETVA_LINE_MA_ATTR}="true"]`)?.remove?.();
	}
	function removeLineDrilldownOverlay(surface) {
		surface?.ownerDocument?.querySelector?.(`[${WIDGETVA_LINE_DRILLDOWN_ATTR}="true"]`)?.remove?.();
	}
	function removeLineResampleOverlay(surface) {
		surface?.ownerDocument?.querySelector?.(`[${WIDGETVA_LINE_RESAMPLE_ATTR}="true"]`)?.remove?.();
	}
	function removeScatterRegressionOverlay(surface) {
		surface?.querySelector?.(`[${WIDGETVA_SCATTER_REGRESSION_ATTR}="true"]`)?.remove?.();
	}
	function readSvgBox(surface) {
		const viewBox = surface?.getAttribute?.("viewBox");
		if (typeof viewBox === "string" && viewBox.trim().length > 0) {
			const [x, y, width, height] = viewBox.trim().split(/[\s,]+/).map(readNumber);
			if ([
				x,
				y,
				width,
				height
			].every((value) => value != null) && width > 0 && height > 0) return {
				x,
				y,
				width,
				height
			};
		}
		const attrWidth = readNumber(surface?.getAttribute?.("width"));
		const attrHeight = readNumber(surface?.getAttribute?.("height"));
		if (attrWidth != null && attrHeight != null && attrWidth > 0 && attrHeight > 0) return {
			x: 0,
			y: 0,
			width: attrWidth,
			height: attrHeight
		};
		const rect = readRectLike(surface);
		return {
			x: 0,
			y: 0,
			width: rect.width,
			height: rect.height
		};
	}
	function rememberSurfaceState(surface) {
		if (!surface || originalSurfaceState.has(surface)) return;
		originalSurfaceState.set(surface, {
			viewBox: surface.getAttribute?.("viewBox") ?? null,
			preserveAspectRatio: surface.getAttribute?.("preserveAspectRatio") ?? null
		});
	}
	function restoreSurfaceState(surface) {
		if (!surface) return;
		const original = originalSurfaceState.get(surface) || {};
		if (original.viewBox == null) surface.removeAttribute?.("viewBox");
		else surface.setAttribute?.("viewBox", original.viewBox);
		if (original.preserveAspectRatio == null) surface.removeAttribute?.("preserveAspectRatio");
		else surface.setAttribute?.("preserveAspectRatio", original.preserveAspectRatio);
		removeZoomOverlay(surface);
	}
	function renderSurfaceProbe(surface, plotRegion = null) {
		const targetRect = plotRegion?.screenRect || readRectLike(surface);
		if (!targetRect || targetRect.width <= 0 || targetRect.height <= 0) return {
			ok: false,
			reason: "Unable to resolve a visible Observable D3 plot region."
		};
		const doc = surface?.ownerDocument || window.document;
		const existing = doc?.querySelector?.(`[${WIDGETVA_SURFACE_PROBE_ATTR}="true"]`);
		if (existing) existing.remove?.();
		const host = doc?.body || doc?.documentElement;
		const overlay = doc?.createElement?.("div");
		const label = doc?.createElement?.("div");
		if (!host || !overlay || !label) return {
			ok: false,
			reason: "Unable to create probe overlay nodes."
		};
		overlay.setAttribute(WIDGETVA_SURFACE_PROBE_ATTR, "true");
		overlay.style.position = "fixed";
		overlay.style.left = `${targetRect.left}px`;
		overlay.style.top = `${targetRect.top}px`;
		overlay.style.width = `${targetRect.width}px`;
		overlay.style.height = `${targetRect.height}px`;
		overlay.style.border = "6px dashed #ef4444";
		overlay.style.boxSizing = "border-box";
		overlay.style.pointerEvents = "none";
		overlay.style.zIndex = "2147483647";
		label.style.position = "absolute";
		label.style.left = "12px";
		label.style.top = "12px";
		label.style.padding = "8px 16px";
		label.style.borderRadius = "6px";
		label.style.background = "#ef4444";
		label.style.color = "#ffffff";
		label.style.fontSize = "20px";
		label.style.fontWeight = "700";
		label.style.lineHeight = "1";
		label.textContent = "WidgetVA Probe";
		overlay.appendChild(label);
		host.appendChild(overlay);
		return {
			ok: true,
			surfaceRect: readRectLike(surface),
			plotRegion
		};
	}
	function clearMarkFeedback(mark) {
		if (!originalMarkState.has(mark)) return;
		const original = originalMarkState.get(mark) || {};
		if (original.opacity == null) mark.removeAttribute?.("opacity");
		else mark.setAttribute?.("opacity", original.opacity);
		if (original.stroke == null) mark.removeAttribute?.("stroke");
		else mark.setAttribute?.("stroke", original.stroke);
		if (original.strokeWidth == null) mark.removeAttribute?.("stroke-width");
		else mark.setAttribute?.("stroke-width", original.strokeWidth);
		if (original.fill == null) mark.removeAttribute?.("fill");
		else mark.setAttribute?.("fill", original.fill);
		if (original.fillOpacity == null) mark.removeAttribute?.("fill-opacity");
		else mark.setAttribute?.("fill-opacity", original.fillOpacity);
		if (original.radius == null) mark.removeAttribute?.("r");
		else mark.setAttribute?.("r", original.radius);
		mark.style.opacity = original.styleOpacity || "";
		mark.style.stroke = original.styleStroke || "";
		mark.style.strokeWidth = original.styleStrokeWidth || "";
		mark.style.fillOpacity = original.styleFillOpacity || "";
		mark.style.fill = original.styleFill || "";
		mark.style.filter = original.styleFilter || "";
	}
	function applyMarkFeedback(mark, selected) {
		if (!originalMarkState.has(mark)) originalMarkState.set(mark, {
			opacity: mark.getAttribute?.("opacity") ?? null,
			stroke: mark.getAttribute?.("stroke") ?? null,
			strokeWidth: mark.getAttribute?.("stroke-width") ?? null,
			fill: mark.getAttribute?.("fill") ?? null,
			fillOpacity: mark.getAttribute?.("fill-opacity") ?? null,
			radius: mark.getAttribute?.("r") ?? null,
			styleOpacity: mark.style.opacity || "",
			styleStroke: mark.style.stroke || "",
			styleStrokeWidth: mark.style.strokeWidth || "",
			styleFillOpacity: mark.style.fillOpacity || "",
			styleFill: mark.style.fill || "",
			styleFilter: mark.style.filter || ""
		});
		mark.setAttribute?.("opacity", selected ? "1" : "0.04");
		mark.setAttribute?.("fill-opacity", selected ? "1" : "0.18");
		mark.setAttribute?.("fill", selected ? "#dc2626" : "#94a3b8");
		mark.setAttribute?.("stroke", selected ? "#111827" : "#cbd5e1");
		mark.setAttribute?.("stroke-width", selected ? "2.5" : "0.5");
		if (typeof mark.tagName === "string" && mark.tagName.toLowerCase() === "circle") {
			const original = originalMarkState.get(mark);
			const baseRadius = Number(original?.radius);
			if (Number.isFinite(baseRadius) && baseRadius > 0) mark.setAttribute?.("r", selected ? String(baseRadius + 2) : String(Math.max(baseRadius - .5, 1)));
		}
		mark.style.opacity = selected ? "1" : "0.04";
		mark.style.fillOpacity = selected ? "1" : "0.18";
		mark.style.fill = selected ? "#dc2626" : "#94a3b8";
		mark.style.stroke = selected ? "#111827" : "#cbd5e1";
		mark.style.strokeWidth = selected ? "2.5px" : "0.5px";
		mark.style.filter = selected ? "drop-shadow(0 0 8px rgba(220, 38, 38, 0.75))" : "";
	}
	function applyBarHighlightFeedback(mark, highlighted) {
		if (!originalMarkState.has(mark)) originalMarkState.set(mark, {
			opacity: mark.getAttribute?.("opacity") ?? null,
			stroke: mark.getAttribute?.("stroke") ?? null,
			strokeWidth: mark.getAttribute?.("stroke-width") ?? null,
			fill: mark.getAttribute?.("fill") ?? null,
			fillOpacity: mark.getAttribute?.("fill-opacity") ?? null,
			radius: mark.getAttribute?.("r") ?? null,
			styleOpacity: mark.style.opacity || "",
			styleStroke: mark.style.stroke || "",
			styleStrokeWidth: mark.style.strokeWidth || "",
			styleFillOpacity: mark.style.fillOpacity || "",
			styleFill: mark.style.fill || "",
			styleFilter: mark.style.filter || ""
		});
		mark.setAttribute?.("opacity", highlighted ? "1" : "0.22");
		mark.setAttribute?.("fill-opacity", highlighted ? "0.96" : "0.3");
		mark.setAttribute?.("fill", highlighted ? "#f97316" : "#94a3b8");
		mark.setAttribute?.("stroke", highlighted ? "#7c2d12" : "#cbd5e1");
		mark.setAttribute?.("stroke-width", highlighted ? "2" : "0.5");
		mark.style.opacity = highlighted ? "1" : "0.22";
		mark.style.fillOpacity = highlighted ? "0.96" : "0.3";
		mark.style.fill = highlighted ? "#f97316" : "#94a3b8";
		mark.style.stroke = highlighted ? "#7c2d12" : "#cbd5e1";
		mark.style.strokeWidth = highlighted ? "2px" : "0.5px";
		mark.style.filter = highlighted ? "drop-shadow(0 0 8px rgba(249, 115, 22, 0.55))" : "";
	}
	function applyLinePathBoldFeedback(path, bolded, { boldWidth = 4, baseWidth = 1 } = {}) {
		if (!originalMarkState.has(path)) originalMarkState.set(path, {
			opacity: path.getAttribute?.("opacity") ?? null,
			stroke: path.getAttribute?.("stroke") ?? null,
			strokeWidth: path.getAttribute?.("stroke-width") ?? null,
			fill: path.getAttribute?.("fill") ?? null,
			fillOpacity: path.getAttribute?.("fill-opacity") ?? null,
			radius: path.getAttribute?.("r") ?? null,
			styleOpacity: path.style.opacity || "",
			styleStroke: path.style.stroke || "",
			styleStrokeWidth: path.style.strokeWidth || "",
			styleFillOpacity: path.style.fillOpacity || "",
			styleFill: path.style.fill || "",
			styleFilter: path.style.filter || ""
		});
		path.setAttribute?.("fill", "none");
		path.style.fill = "none";
		path.setAttribute?.("opacity", "1");
		path.style.opacity = "1";
		path.setAttribute?.("stroke-width", String(bolded ? boldWidth : baseWidth));
		path.style.strokeWidth = `${bolded ? boldWidth : baseWidth}px`;
		path.style.filter = bolded ? "drop-shadow(0 0 6px rgba(37, 99, 235, 0.35))" : "";
	}
	function applyLinePathFocusFeedback(path, focused, dimOpacity = .08) {
		if (!originalMarkState.has(path)) originalMarkState.set(path, {
			opacity: path.getAttribute?.("opacity") ?? null,
			stroke: path.getAttribute?.("stroke") ?? null,
			strokeWidth: path.getAttribute?.("stroke-width") ?? null,
			fill: path.getAttribute?.("fill") ?? null,
			fillOpacity: path.getAttribute?.("fill-opacity") ?? null,
			radius: path.getAttribute?.("r") ?? null,
			styleOpacity: path.style.opacity || "",
			styleStroke: path.style.stroke || "",
			styleStrokeWidth: path.style.strokeWidth || "",
			styleFillOpacity: path.style.fillOpacity || "",
			styleFill: path.style.fill || "",
			styleFilter: path.style.filter || ""
		});
		path.setAttribute?.("fill", "none");
		path.style.fill = "none";
		if (focused) {
			path.setAttribute?.("opacity", "1");
			path.setAttribute?.("stroke-width", "3");
			path.style.opacity = "1";
			path.style.strokeWidth = "3px";
			path.style.filter = "drop-shadow(0 0 6px rgba(220, 38, 38, 0.45))";
			return;
		}
		path.setAttribute?.("opacity", String(dimOpacity));
		path.setAttribute?.("stroke-width", "1");
		path.style.opacity = String(dimOpacity);
		path.style.strokeWidth = "1px";
		path.style.filter = "";
	}
	function applyLinePathSelectionFeedback(path, selected) {
		if (!originalMarkState.has(path)) originalMarkState.set(path, {
			opacity: path.getAttribute?.("opacity") ?? null,
			stroke: path.getAttribute?.("stroke") ?? null,
			strokeWidth: path.getAttribute?.("stroke-width") ?? null,
			fill: path.getAttribute?.("fill") ?? null,
			fillOpacity: path.getAttribute?.("fill-opacity") ?? null,
			radius: path.getAttribute?.("r") ?? null,
			styleOpacity: path.style.opacity || "",
			styleStroke: path.style.stroke || "",
			styleStrokeWidth: path.style.strokeWidth || "",
			styleFillOpacity: path.style.fillOpacity || "",
			styleFill: path.style.fill || "",
			styleFilter: path.style.filter || ""
		});
		path.setAttribute?.("fill", "none");
		path.removeAttribute?.("fill-opacity");
		path.setAttribute?.("opacity", selected ? "1" : "0.12");
		path.setAttribute?.("stroke", selected ? "#dc2626" : "#cbd5e1");
		path.setAttribute?.("stroke-width", selected ? "3" : "1");
		path.style.fill = "none";
		path.style.fillOpacity = "";
		path.style.opacity = selected ? "1" : "0.12";
		path.style.stroke = selected ? "#dc2626" : "#cbd5e1";
		path.style.strokeWidth = selected ? "3px" : "1px";
		path.style.filter = selected ? "drop-shadow(0 0 6px rgba(220, 38, 38, 0.45))" : "";
	}
	function computeLinearRegression(points = []) {
		const safePoints = points.filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y));
		if (safePoints.length < 2) return null;
		const count = safePoints.length;
		const sumX = safePoints.reduce((sum, point) => sum + point.x, 0);
		const sumY = safePoints.reduce((sum, point) => sum + point.y, 0);
		const sumXY = safePoints.reduce((sum, point) => sum + point.x * point.y, 0);
		const denominator = count * safePoints.reduce((sum, point) => sum + point.x * point.x, 0) - sumX * sumX;
		if (denominator === 0) return null;
		const slope = (count * sumXY - sumX * sumY) / denominator;
		return {
			slope,
			intercept: (sumY - slope * sumX) / count
		};
	}
	function createSvgLineNode(surface) {
		return surface?.ownerDocument?.createElementNS?.("http://www.w3.org/2000/svg", "line") || null;
	}
	function createSvgGroupNode(surface) {
		return surface?.ownerDocument?.createElementNS?.("http://www.w3.org/2000/svg", "g") || null;
	}
	function sampleLinePathScreenPoints(path, sampleCount = 96) {
		if (!path || typeof path.getTotalLength !== "function" || typeof path.getPointAtLength !== "function") return [];
		let matrix = null;
		try {
			matrix = typeof path.getScreenCTM === "function" ? path.getScreenCTM() : null;
		} catch {}
		if (!matrix) return [];
		let totalLength = 0;
		try {
			totalLength = path.getTotalLength();
		} catch {
			return [];
		}
		if (!Number.isFinite(totalLength) || totalLength <= 0) return [];
		const ownerSvg = path.ownerSVGElement;
		const createPoint = ownerSvg && typeof ownerSvg.createSVGPoint === "function" ? () => ownerSvg.createSVGPoint() : null;
		if (!createPoint) return [];
		const steps = Math.max(2, sampleCount);
		const points = [];
		for (let index = 0; index < steps; index += 1) {
			const distance = totalLength * index / (steps - 1);
			let localPoint = null;
			try {
				localPoint = path.getPointAtLength(distance);
			} catch {
				continue;
			}
			const svgPoint = createPoint();
			svgPoint.x = localPoint.x;
			svgPoint.y = localPoint.y;
			const screenPoint = svgPoint.matrixTransform(matrix);
			points.push({
				x: screenPoint.x,
				y: screenPoint.y
			});
		}
		return points;
	}
	function sampleLinePathLocalPoints(path, sampleCount = 180) {
		if (!path || typeof path.getTotalLength !== "function" || typeof path.getPointAtLength !== "function") return [];
		let totalLength = 0;
		try {
			totalLength = path.getTotalLength();
		} catch {
			return [];
		}
		if (!Number.isFinite(totalLength) || totalLength <= 0) return [];
		const steps = Math.max(8, sampleCount);
		const points = [];
		for (let index = 0; index < steps; index += 1) {
			const distance = totalLength * index / (steps - 1);
			try {
				const point = path.getPointAtLength(distance);
				const x = readNumber(point?.x);
				const y = readNumber(point?.y);
				if (x != null && y != null) points.push({
					x,
					y
				});
			} catch {}
		}
		return points;
	}
	function smoothLinePathPoints(points = [], windowSize = 9) {
		const safePoints = Array.isArray(points) ? points.filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y)) : [];
		if (safePoints.length < 3) return safePoints;
		const width = Math.max(3, Math.min(safePoints.length, Math.round(windowSize)));
		const radius = Math.floor(width / 2);
		return safePoints.map((point, index) => {
			const from = Math.max(0, index - radius);
			const to = Math.min(safePoints.length - 1, index + radius);
			const slice = safePoints.slice(from, to + 1);
			const y = slice.reduce((sum, item) => sum + item.y, 0) / slice.length;
			return {
				x: point.x,
				y
			};
		});
	}
	function updateLineScreenOverlay(lifecycle) {
		if (!lifecycle?.overlay || !Array.isArray(lifecycle.entries)) return;
		const doc = lifecycle.doc || window.document;
		const width = window.innerWidth || doc.documentElement?.clientWidth || 1200;
		const height = window.innerHeight || doc.documentElement?.clientHeight || 800;
		lifecycle.overlay.setAttribute("width", String(width));
		lifecycle.overlay.setAttribute("height", String(height));
		lifecycle.overlay.setAttribute("viewBox", `0 0 ${width} ${height}`);
		if (lifecycle.veil) {
			const rect = findObservableD3PlotRegion(window)?.screenRect || readRectLike(lifecycle.surface);
			lifecycle.veil.setAttribute("x", String(rect.left));
			lifecycle.veil.setAttribute("y", String(rect.top));
			lifecycle.veil.setAttribute("width", String(rect.width));
			lifecycle.veil.setAttribute("height", String(rect.height));
		}
		let overlayCount = 0;
		lifecycle.entries.forEach(({ path, polyline }) => {
			if (!path?.isConnected || !polyline) {
				if (polyline) polyline.style.display = "none";
				return;
			}
			const points = sampleLinePathScreenPoints(path);
			if (points.length < 2) {
				polyline.style.display = "none";
				return;
			}
			polyline.style.display = "";
			polyline.setAttribute("points", points.map((point) => `${point.x},${point.y}`).join(" "));
			overlayCount += 1;
		});
		lifecycle.overlayCount = overlayCount;
		if (lastLineOverlayResult && lifecycle === lineScreenOverlayLifecycle) lastLineOverlayResult = {
			...lastLineOverlayResult,
			applied: overlayCount > 0,
			overlayCount,
			dynamic: true
		};
	}
	function scheduleLineScreenOverlayUpdate(lifecycle = lineScreenOverlayLifecycle) {
		if (!lifecycle || lifecycle.rafId != null) return;
		lifecycle.rafId = window.requestAnimationFrame?.(() => {
			lifecycle.rafId = null;
			updateLineScreenOverlay(lifecycle);
		});
	}
	function renderLineScreenPathOverlay(surface, entries = [], { attrName = WIDGETVA_LINE_SELECTION_ATTR, stroke = "#dc2626", strokeWidth = "4", opacity = "0.98", dimOriginal = false } = {}) {
		const doc = surface?.ownerDocument || window.document;
		removeLineSelectionOverlay(surface);
		const host = doc?.body || doc?.documentElement;
		const normalizedEntries = Array.isArray(entries) ? entries.filter((entry) => entry?.path) : [];
		if (!host || normalizedEntries.length === 0) return {
			applied: false,
			overlayCount: 0
		};
		const overlay = doc.createElementNS?.("http://www.w3.org/2000/svg", "svg");
		if (!overlay) return {
			applied: false,
			overlayCount: 0
		};
		overlay.setAttribute(attrName, "true");
		overlay.setAttribute("width", String(window.innerWidth || doc.documentElement?.clientWidth || 1200));
		overlay.setAttribute("height", String(window.innerHeight || doc.documentElement?.clientHeight || 800));
		overlay.setAttribute("viewBox", `0 0 ${window.innerWidth || doc.documentElement?.clientWidth || 1200} ${window.innerHeight || doc.documentElement?.clientHeight || 800}`);
		overlay.style.position = "fixed";
		overlay.style.left = "0";
		overlay.style.top = "0";
		overlay.style.width = "100vw";
		overlay.style.height = "100vh";
		overlay.style.pointerEvents = "none";
		overlay.style.zIndex = "2147483646";
		overlay.style.overflow = "visible";
		let veil = null;
		if (dimOriginal) {
			const rect = findObservableD3PlotRegion(window)?.screenRect || readRectLike(surface);
			veil = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
			veil.setAttribute("x", String(rect.left));
			veil.setAttribute("y", String(rect.top));
			veil.setAttribute("width", String(rect.width));
			veil.setAttribute("height", String(rect.height));
			veil.setAttribute("fill", "rgba(255, 255, 255, 0.45)");
			overlay.appendChild(veil);
		}
		const overlayEntries = [];
		normalizedEntries.forEach(({ path, series }) => {
			const polyline = doc.createElementNS("http://www.w3.org/2000/svg", "polyline");
			polyline.setAttribute("fill", "none");
			polyline.setAttribute("stroke", stroke);
			polyline.setAttribute("stroke-width", strokeWidth);
			polyline.setAttribute("stroke-linejoin", "round");
			polyline.setAttribute("stroke-linecap", "round");
			polyline.setAttribute("opacity", opacity);
			polyline.setAttribute("vector-effect", "non-scaling-stroke");
			polyline.style.filter = "drop-shadow(0 0 5px rgba(220, 38, 38, 0.65))";
			overlay.appendChild(polyline);
			overlayEntries.push({
				path,
				series,
				polyline
			});
		});
		host.appendChild(overlay);
		const lifecycle = {
			attrName,
			doc,
			surface,
			overlay,
			veil,
			entries: overlayEntries,
			overlayCount: 0,
			rafId: null,
			listeners: [],
			observer: null
		};
		const schedule = () => scheduleLineScreenOverlayUpdate(lifecycle);
		const listenerOptions = { passive: true };
		[
			{
				target: window,
				type: "mousemove"
			},
			{
				target: window,
				type: "scroll"
			},
			{
				target: window,
				type: "resize"
			},
			{
				target: doc,
				type: "mousemove"
			},
			{
				target: doc,
				type: "scroll"
			}
		].forEach(({ target, type }) => {
			target?.addEventListener?.(type, schedule, listenerOptions);
			lifecycle.listeners.push({
				target,
				type,
				handler: schedule,
				options: listenerOptions
			});
		});
		if (typeof MutationObserver === "function" && surface) {
			lifecycle.observer = new MutationObserver(schedule);
			try {
				lifecycle.observer.observe(surface, {
					attributes: true,
					subtree: true,
					attributeFilter: [
						"d",
						"transform",
						"style",
						"display",
						"opacity"
					]
				});
			} catch {}
		}
		lineScreenOverlayLifecycle = lifecycle;
		updateLineScreenOverlay(lifecycle);
		if (lifecycle.overlayCount === 0) {
			removeLineSelectionOverlay(surface);
			return {
				applied: false,
				overlayCount: 0,
				dynamic: true
			};
		}
		return {
			applied: true,
			overlayCount: lifecycle.overlayCount,
			dynamic: true
		};
	}
	function renderScatterRegressionOverlay(surface, points = []) {
		removeScatterRegressionOverlay(surface);
		if (!surface || typeof surface?.tagName !== "string" || surface.tagName.toLowerCase() !== "svg") return { applied: false };
		const regression = computeLinearRegression(points);
		if (!regression) return { applied: false };
		const xs = points.map((point) => point.x);
		const xMin = Math.min(...xs);
		const xMax = Math.max(...xs);
		const yMin = regression.slope * xMin + regression.intercept;
		const yMax = regression.slope * xMax + regression.intercept;
		const line = createSvgLineNode(surface);
		if (!line) return { applied: false };
		line.setAttribute(WIDGETVA_SCATTER_REGRESSION_ATTR, "true");
		line.setAttribute("x1", String(xMin));
		line.setAttribute("y1", String(yMin));
		line.setAttribute("x2", String(xMax));
		line.setAttribute("y2", String(yMax));
		line.setAttribute("stroke", "#dc2626");
		line.setAttribute("stroke-width", "2.5");
		line.setAttribute("stroke-dasharray", "8 5");
		line.setAttribute("pointer-events", "none");
		surface.appendChild(line);
		return {
			applied: true,
			line: {
				x1: xMin,
				y1: yMin,
				x2: xMax,
				y2: yMax
			}
		};
	}
	function renderLineTrendOverlay(surface, trend = null) {
		removeLineTrendOverlay(surface);
		if (!surface || typeof surface?.tagName !== "string" || surface.tagName.toLowerCase() !== "svg" || !trend) return { applied: false };
		const localRect = findObservableD3PlotRegion(window)?.localRect;
		if (!localRect) return { applied: false };
		const line = createSvgLineNode(surface);
		if (!line) return { applied: false };
		const trendType = typeof trend?.trendType === "string" ? trend.trendType.toLowerCase() : "regression";
		const rising = trendType !== "decreasing";
		const x1 = localRect.left;
		const x2 = localRect.left + localRect.width;
		const y1 = rising ? localRect.top + localRect.height : localRect.top;
		const y2 = rising ? localRect.top : localRect.top + localRect.height;
		line.setAttribute(WIDGETVA_LINE_TREND_ATTR, "true");
		line.setAttribute("x1", String(x1));
		line.setAttribute("y1", String(y1));
		line.setAttribute("x2", String(x2));
		line.setAttribute("y2", String(y2));
		line.setAttribute("stroke", "#dc2626");
		line.setAttribute("stroke-width", "2.5");
		line.setAttribute("stroke-dasharray", "8 5");
		line.setAttribute("pointer-events", "none");
		surface.appendChild(line);
		return {
			applied: true,
			trendType
		};
	}
	function renderLineMovingAverageOverlay(surface, paths = [], movingAverage = null) {
		removeLineMovingAverageOverlay(surface);
		if (!surface || typeof surface?.tagName !== "string" || surface.tagName.toLowerCase() !== "svg" || paths.length === 0) return { applied: false };
		const overlayGroup = createSvgGroupNode(surface);
		if (!overlayGroup) return { applied: false };
		overlayGroup.setAttribute(WIDGETVA_LINE_MA_ATTR, "true");
		overlayGroup.setAttribute("pointer-events", "none");
		const requestedWindow = Number(movingAverage?.windowSize);
		const effectiveWindow = Number.isFinite(requestedWindow) && requestedWindow > 0 ? Math.max(7, Math.round(requestedWindow) * 7) : 21;
		let overlayCount = 0;
		paths.forEach((path) => {
			const points = smoothLinePathPoints(sampleLinePathLocalPoints(path), effectiveWindow);
			if (points.length < 2) return;
			const polyline = surface.ownerDocument?.createElementNS?.("http://www.w3.org/2000/svg", "polyline");
			if (!polyline) return;
			polyline.setAttribute("points", points.map((point) => `${point.x},${point.y}`).join(" "));
			polyline.setAttribute("stroke", "#f59e0b");
			polyline.setAttribute("stroke-width", "3.25");
			polyline.setAttribute("opacity", "0.78");
			polyline.setAttribute("fill", "none");
			polyline.setAttribute("stroke-dasharray", "10 5");
			polyline.setAttribute("stroke-linejoin", "round");
			polyline.setAttribute("stroke-linecap", "round");
			polyline.setAttribute("vector-effect", "non-scaling-stroke");
			polyline.style.stroke = "#f59e0b";
			polyline.style.strokeWidth = "3.25px";
			polyline.style.opacity = "0.78";
			polyline.style.filter = "drop-shadow(0 0 4px rgba(245, 158, 11, 0.42))";
			overlayGroup.appendChild(polyline);
			overlayCount += 1;
		});
		if (overlayCount === 0) return {
			applied: false,
			overlayCount: 0
		};
		surface.appendChild(overlayGroup);
		return {
			applied: true,
			overlayCount,
			smoothingWindow: effectiveWindow
		};
	}
	function inferDrilldownValues(drilldown = null, axisLabels = []) {
		if (!drilldown || !Array.isArray(axisLabels) || axisLabels.length === 0) return [];
		const level = typeof drilldown.level === "string" ? drilldown.level.toLowerCase() : "";
		const value = Number.isFinite(drilldown.value) ? Number(drilldown.value) : null;
		const yearValue = Number.isFinite(drilldown?.parent?.year) ? Number(drilldown.parent.year) : null;
		if (level === "year" && value != null) return axisLabels.filter((label) => String(label).includes(String(value)));
		if (level === "month" && value != null) {
			const monthToken = String(value).padStart(2, "0");
			return axisLabels.filter((label) => {
				const text = String(label);
				return (yearValue == null || text.includes(String(yearValue))) && (text.includes(`-${monthToken}`) || text.includes(`/${monthToken}`));
			});
		}
		return [];
	}
	function renderLineDrilldownOverlay(surface, drilldown = null) {
		removeLineDrilldownOverlay(surface);
		if (!surface || !drilldown) return { applied: false };
		const inferredValues = inferDrilldownValues(drilldown, readObservableD3LineXAxisLabels(window));
		const fallbackValues = Number.isFinite(drilldown.value) ? [String(drilldown.value)] : [];
		const values = inferredValues.length > 0 ? inferredValues : fallbackValues;
		const sliceResult = values.length > 0 ? renderLineSliceOverlay(surface, values) : null;
		const targetRect = findObservableD3PlotRegion(window)?.screenRect || readRectLike(surface);
		const doc = surface.ownerDocument || window.document;
		const host = doc?.body || doc?.documentElement;
		const overlay = doc?.createElement?.("div");
		if (!host || !overlay) return { applied: false };
		overlay.setAttribute(WIDGETVA_LINE_DRILLDOWN_ATTR, "true");
		overlay.style.position = "fixed";
		overlay.style.left = `${targetRect.left + 12}px`;
		overlay.style.top = `${targetRect.top + 12}px`;
		overlay.style.padding = "8px 12px";
		overlay.style.borderRadius = "999px";
		overlay.style.background = "rgba(17, 24, 39, 0.92)";
		overlay.style.color = "#ffffff";
		overlay.style.fontSize = "12px";
		overlay.style.fontWeight = "600";
		overlay.style.letterSpacing = "0.02em";
		overlay.style.pointerEvents = "none";
		overlay.style.zIndex = "2147483646";
		overlay.textContent = `WidgetVA drilldown: ${typeof drilldown.level === "string" ? drilldown.level : "drilldown"}${Number.isFinite(drilldown.value) ? ` ${drilldown.value}` : ""}`;
		host.appendChild(overlay);
		return {
			applied: true,
			highlightedValues: values,
			slice: sliceResult
		};
	}
	function renderLineResampleOverlay(surface, resample = null) {
		removeLineResampleOverlay(surface);
		if (!surface || !resample) return { applied: false };
		const targetRect = findObservableD3PlotRegion(window)?.screenRect || readRectLike(surface);
		const doc = surface.ownerDocument || window.document;
		const host = doc?.body || doc?.documentElement;
		const overlay = doc?.createElement?.("div");
		if (!host || !overlay) return { applied: false };
		const rows = readObservableD3LineRows(window);
		const bucketSummary = /* @__PURE__ */ new Map();
		const xField = typeof resample.xField === "string" ? resample.xField : null;
		if (xField) rows.forEach((row) => {
			const rawValue = row?.[xField];
			if (rawValue == null) return;
			const parsed = Date.parse(String(rawValue));
			if (!Number.isFinite(parsed)) return;
			const date = new Date(parsed);
			let bucketKey = null;
			switch (resample.granularity) {
				case "year":
					bucketKey = `${date.getUTCFullYear()}`;
					break;
				case "quarter":
					bucketKey = `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
					break;
				case "month":
					bucketKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
					break;
				case "week": {
					const weekStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
					const day = weekStart.getUTCDay() || 7;
					weekStart.setUTCDate(weekStart.getUTCDate() - day + 1);
					bucketKey = weekStart.toISOString().slice(0, 10);
					break;
				}
				default:
					bucketKey = date.toISOString().slice(0, 10);
					break;
			}
			bucketSummary.set(bucketKey, (bucketSummary.get(bucketKey) || 0) + 1);
		});
		overlay.setAttribute(WIDGETVA_LINE_RESAMPLE_ATTR, "true");
		overlay.style.position = "fixed";
		overlay.style.right = `${Math.max(window.innerWidth - (targetRect.left + targetRect.width) + 12, 12)}px`;
		overlay.style.top = `${targetRect.top + 12}px`;
		overlay.style.padding = "10px 14px";
		overlay.style.borderRadius = "12px";
		overlay.style.background = "rgba(15, 23, 42, 0.94)";
		overlay.style.color = "#ffffff";
		overlay.style.fontSize = "12px";
		overlay.style.fontWeight = "600";
		overlay.style.lineHeight = "1.4";
		overlay.style.pointerEvents = "none";
		overlay.style.zIndex = "2147483646";
		overlay.style.boxShadow = "0 8px 22px rgba(15, 23, 42, 0.28)";
		overlay.textContent = [
			`WidgetVA resample: ${resample.granularity}/${resample.agg}`,
			bucketSummary.size > 0 ? `${bucketSummary.size} buckets` : null,
			Number.isFinite(rows.length) ? `${rows.length} rows` : null
		].filter(Boolean).join(" · ");
		host.appendChild(overlay);
		return {
			applied: true,
			granularity: resample.granularity,
			agg: resample.agg,
			bucketCount: bucketSummary.size,
			rowCount: rows.length
		};
	}
	function runKMeans(points, clusterCount) {
		const normalized = points.filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y));
		const safeClusterCount = Math.max(1, Math.min(clusterCount, normalized.length));
		if (normalized.length === 0) return {
			labels: [],
			centers: []
		};
		let centers = normalized.slice(0, safeClusterCount).map((point) => ({
			x: point.x,
			y: point.y
		}));
		let labels = normalized.map(() => 0);
		for (let iteration = 0; iteration < 12; iteration += 1) {
			labels = normalized.map((point) => {
				let bestIndex = 0;
				let bestDistance = Number.POSITIVE_INFINITY;
				centers.forEach((center, index) => {
					const dx = point.x - center.x;
					const dy = point.y - center.y;
					const distance = dx * dx + dy * dy;
					if (distance < bestDistance) {
						bestDistance = distance;
						bestIndex = index;
					}
				});
				return bestIndex;
			});
			centers = centers.map((center, clusterIndex) => {
				const clusterPoints = normalized.filter((_, pointIndex) => labels[pointIndex] === clusterIndex);
				if (clusterPoints.length === 0) return center;
				const sum = clusterPoints.reduce((acc, point) => ({
					x: acc.x + point.x,
					y: acc.y + point.y
				}), {
					x: 0,
					y: 0
				});
				return {
					x: sum.x / clusterPoints.length,
					y: sum.y / clusterPoints.length
				};
			});
		}
		return {
			labels,
			centers
		};
	}
	function applyBarSelection(selection = null) {
		const values = Array.isArray(selection?.values) ? selection.values : Array.isArray(selection?.categories) ? selection.categories : [];
		lastBarSelection = values.length > 0 ? {
			field: typeof selection?.field === "string" ? selection.field : "category",
			values: values.map((value) => String(value))
		} : null;
		return renderBarState();
	}
	function renderBarState() {
		const { marks } = readSurfaceAndBarMarks();
		const rows = readObservableD3BarRows(window);
		const selectedSet = new Set(lastBarSelection?.values || []);
		const visibleSet = new Set(currentBarFilter?.categories || []);
		const highlightedSet = new Set(currentBarHighlight?.categories || []);
		const hasFilter = !!currentBarFilter;
		const hasSelection = !!lastBarSelection;
		const hasHighlight = !!currentBarHighlight;
		let selectedCount = 0;
		let visibleCount = 0;
		let highlightedCount = 0;
		marks.forEach((mark, index) => {
			const row = rows[index] || null;
			const visible = !hasFilter || !!row && visibleSet.has(String(row.category));
			mark.style.display = visible ? "" : "none";
			if (!visible) return;
			visibleCount += 1;
			if (!hasSelection && !hasHighlight) {
				clearMarkFeedback(mark);
				return;
			}
			const selected = !!row && selectedSet.has(String(row.category));
			const highlighted = !!row && highlightedSet.has(String(row.category));
			if (selected) selectedCount += 1;
			if (highlighted) highlightedCount += 1;
			if (hasSelection) {
				applyMarkFeedback(mark, selected);
				return;
			}
			applyBarHighlightFeedback(mark, highlighted);
		});
		return {
			selectedCount,
			visibleCount,
			highlightedCount,
			totalCount: rows.length
		};
	}
	function applyBarFilter(filter = null) {
		currentBarFilter = filter && typeof filter === "object" ? {
			field: typeof filter.field === "string" ? filter.field : "category",
			categories: Array.isArray(filter.categories) ? filter.categories.map((value) => String(value)) : []
		} : null;
		return renderBarState();
	}
	function applyBarHighlight(highlight = null) {
		currentBarHighlight = highlight && typeof highlight === "object" ? {
			field: typeof highlight.field === "string" ? highlight.field : "category",
			categories: Array.isArray(highlight.categories) ? highlight.categories.map((value) => String(value)) : [],
			...Number.isFinite(highlight.n) ? { n: Number(highlight.n) } : {},
			...typeof highlight.order === "string" ? { order: highlight.order } : {}
		} : null;
		return renderBarState();
	}
	function applyBarSort(sort = null) {
		const { surface, marks } = readSurfaceAndBarMarks();
		const rows = readObservableD3BarRows(window);
		const values = Array.isArray(sort?.values) ? sort.values : [];
		if (!surface || !Array.isArray(values) || values.length === 0) return {
			applied: false,
			order: []
		};
		const rank = new Map(values.map((value, index) => [String(value), index]));
		const markRows = marks.map((mark, index) => ({
			mark,
			row: rows[index] || null
		})).filter((entry) => entry.row);
		markRows.sort((left, right) => {
			const leftRank = rank.get(String(left.row.category));
			const rightRank = rank.get(String(right.row.category));
			if (leftRank == null && rightRank == null) return 0;
			if (leftRank == null) return 1;
			if (rightRank == null) return -1;
			return leftRank - rightRank;
		});
		markRows.forEach(({ mark }) => {
			mark.parentNode?.appendChild?.(mark);
		});
		return {
			applied: true,
			order: values
		};
	}
	function readLineTextNodes(surface) {
		return [...surface?.querySelectorAll?.("text") || []].map((node) => {
			const text = typeof node?.textContent === "string" ? node.textContent.trim() : "";
			if (!text) return null;
			return {
				node,
				text,
				rect: readRectLike(node)
			};
		}).filter(Boolean);
	}
	function readLineSeriesLabelEntries(surface) {
		const labels = new Set(readObservableD3LineSeriesLabels(window));
		return readLineTextNodes(surface).filter((entry) => labels.has(entry.text));
	}
	function readLineXAxisLabelEntries(surface) {
		const labels = new Set(readObservableD3LineXAxisLabels(window));
		return readLineTextNodes(surface).filter((entry) => labels.has(entry.text));
	}
	function readYearLikeValue(value) {
		if (value == null) return null;
		const text = String(value).trim();
		if (!text) return null;
		const directYear = Number(text);
		if (Number.isFinite(directYear) && directYear >= 1900 && directYear <= 2100) return directYear;
		const parsed = Date.parse(text);
		if (!Number.isFinite(parsed)) return null;
		return new Date(parsed).getFullYear();
	}
	function inferLineSliceXFromValue({ value, surface, plotRegion, xLabels = [] }) {
		const requestedYear = readYearLikeValue(value);
		if (!Number.isFinite(requestedYear)) return null;
		const plotRect = plotRegion?.screenRect || readRectLike(surface);
		if (!Number.isFinite(plotRect.left) || !Number.isFinite(plotRect.width) || plotRect.width <= 0) return null;
		const years = xLabels.map((entry) => readYearLikeValue(entry.text)).filter((year) => Number.isFinite(year));
		const minYear = years.length > 0 ? Math.min(...years) : 2013;
		const maxYear = years.length > 0 ? Math.max(...years) : 2018;
		if (maxYear <= minYear) return null;
		const fraction = (Math.max(minYear, Math.min(maxYear, requestedYear)) - minYear) / (maxYear - minYear);
		return plotRect.left + plotRect.width * fraction;
	}
	function inferLineViewportBoundsFromYears({ xDomain, surface, plotRegion, xLabels = [] }) {
		if (!Array.isArray(xDomain) || xDomain.length < 2) return null;
		const startYear = readYearLikeValue(xDomain[0]);
		const endYear = readYearLikeValue(xDomain[1]);
		if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return null;
		const years = xLabels.map((entry) => readYearLikeValue(entry.text)).filter((year) => Number.isFinite(year));
		const minYear = years.length > 0 ? Math.min(...years) : 2013;
		const maxYear = years.length > 0 ? Math.max(...years) : 2018;
		if (maxYear <= minYear) return null;
		const plotRect = plotRegion?.screenRect || readRectLike(surface);
		if (!Number.isFinite(plotRect.left) || !Number.isFinite(plotRect.width) || plotRect.width <= 0) return null;
		const lowYear = Math.max(minYear, Math.min(maxYear, Math.min(startYear, endYear)));
		const highYear = Math.max(minYear, Math.min(maxYear, Math.max(startYear, endYear)));
		const lowFraction = (lowYear - minYear) / (maxYear - minYear);
		const highFraction = (highYear - minYear) / (maxYear - minYear);
		return {
			leftPx: plotRect.left + plotRect.width * lowFraction,
			rightPx: plotRect.left + plotRect.width * highFraction,
			minYear,
			maxYear,
			lowYear,
			highYear
		};
	}
	function parseComparableAxisValue(value) {
		if (value == null) return null;
		if (typeof value === "number" && Number.isFinite(value)) return value;
		const text = String(value).trim();
		if (!text) return null;
		const asNumber = Number(text);
		if (Number.isFinite(asNumber)) return asNumber;
		const asDate = Date.parse(text);
		if (Number.isFinite(asDate)) return asDate;
		return text;
	}
	function compareComparableAxisValue(left, right) {
		if (typeof left === "number" && typeof right === "number") return left - right;
		return String(left).localeCompare(String(right));
	}
	function readLinePathSeriesFromDatum(path) {
		const datum = path?.__data__;
		if (!datum || typeof datum !== "object") return null;
		const candidates = [
			datum.key,
			datum.series,
			datum.Series,
			datum.symbol,
			datum.Symbol,
			datum.name,
			datum.id
		];
		for (const candidate of candidates) {
			if (candidate == null) continue;
			const value = String(candidate).trim();
			if (value) return value;
		}
		if (Array.isArray(datum) && datum.length > 0) {
			const first = datum[0];
			const nested = first && typeof first === "object" ? first.series || first.Series || first.symbol || first.Symbol || first.name : null;
			if (nested != null && String(nested).trim()) return String(nested).trim();
		}
		return null;
	}
	function normalizeSvgColor(value) {
		return typeof value === "string" ? value.trim().toLowerCase() : "";
	}
	function readLinePathStroke(path) {
		return normalizeSvgColor(path?.getAttribute?.("stroke") || path?.style?.stroke || "");
	}
	function normalizeLineSeriesValue(value) {
		const token = String(value ?? "").trim();
		if (!token) return "";
		const upper = token.toUpperCase();
		return new Map([
			["A", "AAPL"],
			["APPLE", "AAPL"],
			["AAPL", "AAPL"],
			["AMAZON", "AMZN"],
			["AMZN", "AMZN"],
			["GOOGLE", "GOOG"],
			["GOOG", "GOOG"],
			["MICROSOFT", "MSFT"],
			["MSFT", "MSFT"],
			["IBM", "IBM"]
		]).get(upper) || upper;
	}
	function lineSeriesMatches(series, selectedSet) {
		if (series == null || !selectedSet || selectedSet.size === 0) return false;
		return selectedSet.has(normalizeLineSeriesValue(series));
	}
	function readIndexChartSeriesFromStroke(path) {
		const stroke = readLinePathStroke(path);
		return new Map([
			["#2ca02c", "AMZN"],
			["#d62728", "GOOG"],
			["#9467bd", "IBM"],
			["#8c564b", "MSFT"],
			["#ff7f0e", "AAPL"]
		]).get(stroke) || null;
	}
	function readLinePathEndpoint(path) {
		if (!path || typeof path.getTotalLength !== "function" || typeof path.getPointAtLength !== "function") {
			const rect = readRectLike(path);
			return {
				x: rect.left + rect.width,
				y: rect.top + rect.height / 2
			};
		}
		try {
			const point = path.getPointAtLength(path.getTotalLength());
			return {
				x: Number(point?.x) || 0,
				y: Number(point?.y) || 0
			};
		} catch {
			const rect = readRectLike(path);
			return {
				x: rect.left + rect.width,
				y: rect.top + rect.height / 2
			};
		}
	}
	function fallbackLineEntriesByKnownIndexSeries(paths, selectedSet) {
		const requested = [...selectedSet].map((value) => normalizeLineSeriesValue(value));
		const rankBySeries = new Map([
			["AMZN", 0],
			["MSFT", 1],
			["GOOG", 2],
			["AAPL", 3],
			["IBM", Number.POSITIVE_INFINITY]
		]);
		if (!requested.some((series) => rankBySeries.has(series))) return [];
		const rankedPaths = paths.map((path) => ({
			path,
			endpoint: readLinePathEndpoint(path)
		})).sort((left, right) => left.endpoint.y - right.endpoint.y);
		return requested.map((series) => {
			const rank = rankBySeries.get(series);
			if (rank == null) return null;
			const entry = rankedPaths[rank === Number.POSITIVE_INFINITY ? rankedPaths.length - 1 : rank];
			return entry ? {
				path: entry.path,
				series
			} : null;
		}).filter(Boolean);
	}
	function mapLinePathsToSeries(surface, paths) {
		const strokeMappings = paths.map((path) => ({
			path,
			series: readIndexChartSeriesFromStroke(path)
		}));
		if (strokeMappings.some((entry) => entry.series != null)) return strokeMappings;
		const seriesLabels = readLineSeriesLabelEntries(surface);
		const datumMappings = paths.map((path) => ({
			path,
			series: readLinePathSeriesFromDatum(path)
		}));
		if (datumMappings.some((entry) => entry.series != null)) return datumMappings;
		if (seriesLabels.length === 0) return paths.map((path) => ({
			path,
			series: null
		}));
		return paths.map((path) => {
			const rect = readRectLike(path);
			const centerY = rect.top + rect.height / 2;
			return {
				path,
				series: seriesLabels.map((entry) => ({
					text: entry.text,
					distance: Math.abs(entry.rect.top + entry.rect.height / 2 - centerY)
				})).sort((left, right) => left.distance - right.distance)[0]?.text || null
			};
		});
	}
	function renderLineSliceOverlay(surface, values = []) {
		removeLineSliceOverlay(surface);
		const requested = new Set(Array.isArray(values) ? values : []);
		if (!surface || requested.size === 0) return {
			applied: false,
			overlayCount: 0
		};
		const plotRegion = findObservableD3PlotRegion(window);
		const allXLabels = readLineXAxisLabelEntries(surface);
		const matchedXLabels = allXLabels.filter((entry) => requested.has(entry.text));
		const inferredXs = matchedXLabels.length > 0 ? [] : [...requested].map((value) => inferLineSliceXFromValue({
			value,
			surface,
			plotRegion,
			xLabels: allXLabels
		})).filter((x) => Number.isFinite(x));
		if (matchedXLabels.length === 0 && inferredXs.length === 0) return {
			applied: false,
			overlayCount: 0,
			requestedValues: [...requested].map((value) => String(value))
		};
		const doc = surface.ownerDocument || window.document;
		const host = doc?.body || doc?.documentElement;
		const overlay = doc?.createElement?.("div");
		if (!host || !overlay) return {
			applied: false,
			overlayCount: 0
		};
		overlay.setAttribute(WIDGETVA_LINE_SLICE_ATTR, "true");
		overlay.style.position = "fixed";
		overlay.style.left = "0";
		overlay.style.top = "0";
		overlay.style.width = "100vw";
		overlay.style.height = "100vh";
		overlay.style.pointerEvents = "none";
		overlay.style.zIndex = "2147483646";
		const sliceXs = [...matchedXLabels.map((entry) => entry.rect.left + entry.rect.width / 2), ...inferredXs].filter((x, index, xs) => xs.findIndex((other) => Math.abs(other - x) < 2) === index);
		sliceXs.forEach((centerX) => {
			const bar = doc.createElement("div");
			bar.style.position = "absolute";
			bar.style.left = `${centerX - 2}px`;
			bar.style.top = `${plotRegion?.screenRect?.top || readRectLike(surface).top}px`;
			bar.style.width = "6px";
			bar.style.height = `${plotRegion?.screenRect?.height || 160}px`;
			bar.style.background = "rgba(220, 38, 38, 0.9)";
			bar.style.borderLeft = "1px solid rgba(127, 29, 29, 0.85)";
			bar.style.borderRight = "1px solid rgba(127, 29, 29, 0.85)";
			bar.style.boxShadow = "0 0 12px rgba(220, 38, 38, 0.7)";
			overlay.appendChild(bar);
		});
		host.appendChild(overlay);
		return {
			applied: sliceXs.length > 0,
			overlayCount: sliceXs.length,
			requestedValues: [...requested].map((value) => String(value)),
			matchedLabels: matchedXLabels.map((entry) => entry.text),
			inferredXs
		};
	}
	function applyLineSelection(selection = null) {
		const { surface, paths } = readSurfaceAndLinePaths();
		const rows = readObservableD3LineRows(window);
		const field = typeof selection?.field === "string" ? selection.field : null;
		const values = Array.isArray(selection?.values) ? selection.values : [];
		currentLineSeriesSelection = field === "series" ? {
			field,
			values: values.map((value) => String(value))
		} : null;
		currentLineXSelection = field === "xValue" ? {
			field,
			values: values.map((value) => String(value))
		} : null;
		renderLinePathState(surface, paths);
		const matchedValues = new Set(values.map((value) => String(value).trim()).filter(Boolean));
		return {
			selectedCount: rows.filter((row) => field && matchedValues.has(String(row?.[field]).trim())).length,
			totalCount: rows.length,
			overlay: lastLineOverlayResult
		};
	}
	function applyLineFocus(focus = null) {
		const { surface, paths } = readSurfaceAndLinePaths();
		const mappings = mapLinePathsToSeries(surface, paths);
		const lines = Array.isArray(focus?.lines) ? focus.lines : [];
		currentLineFocus = focus && lines.length > 0 ? {
			lines: lines.map((line) => String(line)),
			lineField: focus?.lineField || "series",
			dimOpacity: Number.isFinite(focus?.dimOpacity) ? Number(focus.dimOpacity) : .08
		} : null;
		renderLinePathState(surface, paths);
		return {
			focusedCount: Array.isArray(currentLineFocus?.lines) ? currentLineFocus.lines.length : 0,
			totalCount: mappings.length,
			overlay: lastLineOverlayResult
		};
	}
	function resolveLineEntriesBySeriesValues(surface, paths, mappings, values = []) {
		const valueSet = new Set((Array.isArray(values) ? values : []).map((value) => normalizeLineSeriesValue(value)).filter(Boolean));
		if (valueSet.size === 0) return [];
		let entries = mappings.filter(({ series }) => lineSeriesMatches(series, valueSet));
		if (entries.length === 0) entries = fallbackLineEntriesByKnownIndexSeries(paths, valueSet);
		return entries;
	}
	function renderLinePathState(surface, paths) {
		const safePaths = Array.isArray(paths) ? paths : [];
		const mappings = mapLinePathsToSeries(surface, safePaths);
		removeLineSelectionOverlay(surface);
		removeLineSliceOverlay(surface);
		safePaths.forEach((path) => {
			clearMarkFeedback(path);
			path.style.display = "";
		});
		const filterEntries = resolveLineEntriesBySeriesValues(surface, safePaths, mappings, currentLineFilter?.linesToRemove || []);
		const hiddenPaths = new Set(filterEntries.map((entry) => entry.path));
		const focusEntries = resolveLineEntriesBySeriesValues(surface, safePaths, mappings, currentLineFocus?.lines || []);
		const focusPaths = new Set(focusEntries.map((entry) => entry.path));
		const boldEntries = resolveLineEntriesBySeriesValues(surface, safePaths, mappings, currentLineBold?.lineNames || []);
		const boldPaths = new Set(boldEntries.map((entry) => entry.path));
		const selectedEntries = resolveLineEntriesBySeriesValues(surface, safePaths, mappings, currentLineSeriesSelection?.values || []);
		const selectedPaths = new Set(selectedEntries.map((entry) => entry.path));
		mappings.forEach(({ path }) => {
			if (hiddenPaths.has(path)) {
				path.style.display = "none";
				return;
			}
			if (focusPaths.size > 0) {
				applyLinePathFocusFeedback(path, focusPaths.has(path), currentLineFocus?.dimOpacity || .08);
				return;
			}
			if (selectedPaths.size > 0) {
				applyLinePathSelectionFeedback(path, selectedPaths.has(path));
				return;
			}
			if (boldPaths.size > 0) applyLinePathBoldFeedback(path, boldPaths.has(path), {
				boldWidth: currentLineBold?.boldWidth ?? 4,
				baseWidth: currentLineBold?.baseWidth ?? 1
			});
		});
		if (focusEntries.length > 0) {
			lastLineOverlayResult = {
				...renderLineScreenPathOverlay(surface, focusEntries, {
					attrName: WIDGETVA_LINE_SELECTION_ATTR,
					stroke: "#dc2626",
					strokeWidth: "4",
					opacity: "0.96",
					dimOriginal: true
				}),
				field: currentLineFocus?.lineField || "series",
				requestedValues: (currentLineFocus?.lines || []).map((line) => String(line)),
				matchedSeries: focusEntries.map((entry) => entry.series).filter((series) => series != null)
			};
			return;
		}
		if (selectedEntries.length > 0) {
			lastLineOverlayResult = {
				...renderLineScreenPathOverlay(surface, selectedEntries, {
					attrName: WIDGETVA_LINE_SELECTION_ATTR,
					stroke: "#dc2626",
					strokeWidth: "4",
					opacity: "0.96",
					dimOriginal: true
				}),
				field: currentLineSeriesSelection?.field || "series",
				requestedValues: (currentLineSeriesSelection?.values || []).map((value) => String(value)),
				matchedSeries: selectedEntries.map((entry) => entry.series).filter((series) => series != null)
			};
			return;
		}
		if (currentLineXSelection && Array.isArray(currentLineXSelection.values)) {
			lastLineOverlayResult = {
				...renderLineSliceOverlay(surface, currentLineXSelection.values) || {},
				field: currentLineXSelection.field,
				requestedValues: currentLineXSelection.values.map((value) => String(value)),
				kind: "slice"
			};
			return;
		}
		if (boldPaths.size > 0) {
			lastLineOverlayResult = {
				applied: true,
				overlayCount: boldPaths.size,
				field: currentLineBold?.lineField || "series",
				requestedValues: (currentLineBold?.lineNames || []).map((value) => String(value)),
				kind: "bold"
			};
			return;
		}
		if (hiddenPaths.size > 0) {
			lastLineOverlayResult = {
				applied: true,
				overlayCount: hiddenPaths.size,
				field: currentLineFilter?.lineField || "series",
				requestedValues: (currentLineFilter?.linesToRemove || []).map((value) => String(value)),
				kind: "filter"
			};
			return;
		}
		lastLineOverlayResult = {
			applied: false,
			overlayCount: 0,
			reason: "no-line-path-state"
		};
	}
	function applyLineTrend(trend = null) {
		const { surface } = readSurfaceAndLinePaths();
		lastLineAnnotationResult = {
			kind: "trend",
			...renderLineTrendOverlay(surface, trend)
		};
		return lastLineAnnotationResult;
	}
	function applyLineBold(bold = null) {
		const { surface, paths } = readSurfaceAndLinePaths();
		const lineNames = Array.isArray(bold?.lineNames) ? bold.lineNames : [];
		currentLineBold = bold && lineNames.length > 0 ? {
			lineNames: lineNames.map((line) => String(line)),
			lineField: bold?.lineField || "series",
			boldWidth: Number.isFinite(bold?.boldWidth) ? Number(bold.boldWidth) : 4,
			baseWidth: Number.isFinite(bold?.baseWidth) ? Number(bold.baseWidth) : 1
		} : null;
		renderLinePathState(surface, paths);
		return {
			applied: !!currentLineBold,
			overlay: lastLineOverlayResult
		};
	}
	function applyLineFilter(filter = null) {
		const { surface, paths } = readSurfaceAndLinePaths();
		const linesToRemove = Array.isArray(filter?.linesToRemove) ? filter.linesToRemove : [];
		currentLineFilter = filter && linesToRemove.length > 0 ? {
			lineField: filter?.lineField || "series",
			linesToRemove: linesToRemove.map((line) => String(line))
		} : null;
		renderLinePathState(surface, paths);
		return {
			applied: !!currentLineFilter,
			overlay: lastLineOverlayResult
		};
	}
	function applyLineMovingAverage(movingAverage = null) {
		const { surface, paths } = readSurfaceAndLinePaths();
		if (!movingAverage) {
			removeLineMovingAverageOverlay(surface);
			lastLineAnnotationResult = {
				kind: "movingAverage",
				applied: false,
				reset: true
			};
			return lastLineAnnotationResult;
		}
		lastLineAnnotationResult = {
			kind: "movingAverage",
			windowSize: movingAverage?.windowSize,
			...renderLineMovingAverageOverlay(surface, paths, movingAverage)
		};
		return lastLineAnnotationResult;
	}
	function applyLineDrilldown(drilldown = null) {
		const { surface } = readSurfaceAndLinePaths();
		if (!drilldown) {
			removeLineDrilldownOverlay(surface);
			removeLineSliceOverlay(surface);
			lastLineAnnotationResult = {
				kind: "drilldown",
				applied: false,
				reset: true
			};
			return lastLineAnnotationResult;
		}
		lastLineAnnotationResult = {
			kind: "drilldown",
			...renderLineDrilldownOverlay(surface, drilldown)
		};
		return lastLineAnnotationResult;
	}
	function applyLineResample(resample = null) {
		const { surface } = readSurfaceAndLinePaths();
		currentLineResample = resample && typeof resample === "object" ? {
			...typeof resample.granularity === "string" ? { granularity: resample.granularity } : {},
			...typeof resample.agg === "string" ? { agg: resample.agg } : {},
			...typeof resample.xField === "string" ? { xField: resample.xField } : {},
			...typeof resample.yField === "string" ? { yField: resample.yField } : {}
		} : null;
		if (!currentLineResample) {
			removeLineResampleOverlay(surface);
			return {
				applied: true,
				reset: true,
				resample: null
			};
		}
		return {
			resample: currentLineResample,
			...renderLineResampleOverlay(surface, currentLineResample)
		};
	}
	function applyScatterClusters(cluster = null) {
		const { marks } = readSurfaceAndMarks();
		const rows = readObservableD3ScatterRows(window);
		if (!cluster) {
			marks.forEach((mark) => clearMarkFeedback(mark));
			return {
				applied: false,
				clusterCount: 0
			};
		}
		const nClusters = Number.isFinite(cluster?.nClusters) ? Number(cluster.nClusters) : 3;
		const palette = [
			"#dc2626",
			"#2563eb",
			"#16a34a",
			"#f59e0b",
			"#7c3aed",
			"#0891b2"
		];
		const { labels } = runKMeans(rows.map((row) => ({
			x: row.__screenX,
			y: row.__screenY
		})), nClusters);
		marks.forEach((mark, index) => {
			if (!originalMarkState.has(mark)) originalMarkState.set(mark, {
				opacity: mark.getAttribute?.("opacity") ?? null,
				stroke: mark.getAttribute?.("stroke") ?? null,
				strokeWidth: mark.getAttribute?.("stroke-width") ?? null,
				fill: mark.getAttribute?.("fill") ?? null,
				fillOpacity: mark.getAttribute?.("fill-opacity") ?? null,
				radius: mark.getAttribute?.("r") ?? null,
				styleOpacity: mark.style.opacity || "",
				styleStroke: mark.style.stroke || "",
				styleStrokeWidth: mark.style.strokeWidth || "",
				styleFillOpacity: mark.style.fillOpacity || "",
				styleFill: mark.style.fill || "",
				styleFilter: mark.style.filter || ""
			});
			const color = palette[(labels[index] ?? 0) % palette.length];
			mark.setAttribute?.("opacity", "1");
			mark.setAttribute?.("fill-opacity", "0.95");
			mark.setAttribute?.("fill", color);
			mark.setAttribute?.("stroke", "#111827");
			mark.setAttribute?.("stroke-width", "1.8");
			if (typeof mark?.tagName === "string" && mark.tagName.toLowerCase() === "circle") {
				const currentRadius = readNumber(mark.getAttribute?.("r")) || readNumber(mark.r?.baseVal?.value) || 3;
				mark.setAttribute?.("r", String(Math.max(currentRadius, 4.5)));
			}
			mark.style.opacity = "1";
			mark.style.fillOpacity = "0.95";
			mark.style.fill = color;
			mark.style.stroke = "#111827";
			mark.style.strokeWidth = "1.8px";
			mark.style.filter = "drop-shadow(0 0 4px rgba(15, 23, 42, 0.24))";
		});
		return {
			applied: true,
			clusterCount: nClusters
		};
	}
	function applyScatterRegression(regression = null) {
		const { surface } = readSurfaceAndMarks();
		if (!regression) {
			removeScatterRegressionOverlay(surface);
			return { applied: false };
		}
		return renderScatterRegressionOverlay(surface, readObservableD3ScatterRows(window).map((row) => ({
			x: row.__screenX,
			y: row.__screenY
		})));
	}
	function normalizeViewport(viewport) {
		if (!viewport || typeof viewport !== "object" || Array.isArray(viewport)) return null;
		const xDomain = Array.isArray(viewport.xDomain) && viewport.xDomain.length >= 2 ? viewport.xDomain.slice(0, 2).map(readNumber) : null;
		const yDomain = Array.isArray(viewport.yDomain) && viewport.yDomain.length >= 2 ? viewport.yDomain.slice(0, 2).map(readNumber) : null;
		return {
			...xDomain?.every((value) => value != null) ? { xDomain } : {},
			...yDomain?.every((value) => value != null) ? { yDomain } : {}
		};
	}
	function renderZoomOverlay(surface, box) {
		const doc = surface?.ownerDocument || window.document;
		const group = surface?.querySelector?.(`[${WIDGETVA_ZOOM_OVERLAY_ATTR}="true"]`) || doc?.createElementNS?.("http://www.w3.org/2000/svg", "g");
		const border = group?.querySelector?.("rect") || doc?.createElementNS?.("http://www.w3.org/2000/svg", "rect");
		if (!group || !border) return;
		group.setAttribute(WIDGETVA_ZOOM_OVERLAY_ATTR, "true");
		group.setAttribute("pointer-events", "none");
		border.setAttribute("x", String(box.x));
		border.setAttribute("y", String(box.y));
		border.setAttribute("width", String(box.width));
		border.setAttribute("height", String(box.height));
		border.setAttribute("fill", "none");
		border.setAttribute("stroke", "#2563eb");
		border.setAttribute("stroke-width", "2");
		border.setAttribute("stroke-dasharray", "7 5");
		border.setAttribute("vector-effect", "non-scaling-stroke");
		if (!border.parentNode) group.appendChild(border);
		if (!group.parentNode) surface.appendChild(group);
	}
	function applyScatterViewport(viewport = null) {
		const { surface, marks } = readSurfaceAndMarks();
		if (!surface || typeof surface?.tagName !== "string" || surface.tagName.toLowerCase() !== "svg") return {
			applied: false,
			reason: "Scatter viewport currently supports svg surfaces only."
		};
		const normalized = normalizeViewport(viewport);
		if (!normalized || !normalized.xDomain && !normalized.yDomain) {
			restoreSurfaceState(surface);
			currentViewport = null;
			return {
				applied: true,
				reset: true
			};
		}
		rememberSurfaceState(surface);
		const originalBox = readSvgBox(surface);
		const coordinateSpace = inferScatterCoordinateSpace(marks);
		const xDomain = normalized.xDomain || [originalBox.x, originalBox.x + originalBox.width];
		const yDomain = normalized.yDomain || [originalBox.y, originalBox.y + originalBox.height];
		const firstCorner = coordinateSpace === "svg-local" ? {
			x: xDomain[0],
			y: yDomain[0]
		} : viewportPointToSvg(surface, xDomain[0], yDomain[0]);
		const secondCorner = coordinateSpace === "svg-local" ? {
			x: xDomain[1],
			y: yDomain[1]
		} : viewportPointToSvg(surface, xDomain[1], yDomain[1]);
		const rawX = Math.min(firstCorner.x, secondCorner.x);
		const rawY = Math.min(firstCorner.y, secondCorner.y);
		const rawWidth = Math.abs(secondCorner.x - firstCorner.x);
		const rawHeight = Math.abs(secondCorner.y - firstCorner.y);
		const padX = Math.max(rawWidth * .08, 8);
		const padY = Math.max(rawHeight * .08, 8);
		const nextBox = {
			x: rawX - padX,
			y: rawY - padY,
			width: Math.max(rawWidth + padX * 2, 1),
			height: Math.max(rawHeight + padY * 2, 1)
		};
		surface.setAttribute("viewBox", `${nextBox.x} ${nextBox.y} ${nextBox.width} ${nextBox.height}`);
		surface.setAttribute("preserveAspectRatio", "xMidYMid meet");
		renderZoomOverlay(surface, nextBox);
		currentViewport = normalized;
		return {
			applied: true,
			viewport: normalized,
			viewBox: nextBox,
			coordinateSpace
		};
	}
	function applyLineViewport(viewport = null) {
		const { surface } = readSurfaceAndLinePaths();
		if (!surface || typeof surface?.tagName !== "string" || surface.tagName.toLowerCase() !== "svg") {
			currentLineViewport = viewport && typeof viewport === "object" ? viewport : null;
			lastLineViewportResult = {
				viewport: currentLineViewport,
				applied: false,
				reason: "Observable D3 line viewport zoom currently requires an SVG surface."
			};
			return lastLineViewportResult;
		}
		const xDomain = Array.isArray(viewport?.xDomain) ? viewport.xDomain : null;
		if (!xDomain) {
			const originalViewBox = surface.getAttribute(WIDGETVA_VIEWBOX_CACHE_ATTR);
			if (originalViewBox != null && originalViewBox !== "") surface.setAttribute("viewBox", originalViewBox);
			else surface.removeAttribute("viewBox");
			currentLineViewport = null;
			lastLineViewportResult = {
				viewport: null,
				applied: true,
				reset: true
			};
			return lastLineViewportResult;
		}
		const parsedStart = parseComparableAxisValue(xDomain[0]);
		const parsedEnd = parseComparableAxisValue(xDomain[1]);
		if (parsedStart == null || parsedEnd == null) {
			currentLineViewport = { xDomain: [...xDomain] };
			lastLineViewportResult = {
				viewport: currentLineViewport,
				applied: false,
				reason: "Line x-domain values could not be parsed."
			};
			return lastLineViewportResult;
		}
		const low = compareComparableAxisValue(parsedStart, parsedEnd) <= 0 ? parsedStart : parsedEnd;
		const high = compareComparableAxisValue(parsedStart, parsedEnd) <= 0 ? parsedEnd : parsedStart;
		const plotRegion = findObservableD3PlotRegion(window);
		const xLabelEntries = readLineXAxisLabelEntries(surface);
		const labelEntries = xLabelEntries.map((entry) => ({
			...entry,
			comparable: parseComparableAxisValue(entry.text)
		})).filter((entry) => entry.comparable != null).filter((entry) => compareComparableAxisValue(entry.comparable, low) >= 0 && compareComparableAxisValue(entry.comparable, high) <= 0);
		if (!surface.hasAttribute(WIDGETVA_VIEWBOX_CACHE_ATTR)) {
			const initialViewBox = surface.getAttribute("viewBox");
			surface.setAttribute(WIDGETVA_VIEWBOX_CACHE_ATTR, initialViewBox == null ? "" : initialViewBox);
		}
		const inferredBounds = labelEntries.length === 0 ? inferLineViewportBoundsFromYears({
			xDomain,
			surface,
			plotRegion,
			xLabels: xLabelEntries
		}) : null;
		if (labelEntries.length === 0 && !inferredBounds) {
			currentLineViewport = { xDomain: [...xDomain] };
			lastLineViewportResult = {
				viewport: currentLineViewport,
				applied: false,
				reason: "No visible x-axis labels matched the requested line x-domain.",
				matchedLabels: [],
				availableLabels: xLabelEntries.map((entry) => entry.text)
			};
			return lastLineViewportResult;
		}
		const surfaceRect = readRectLike(surface);
		const plotLocal = plotRegion?.localRect || {
			left: 0,
			top: 0,
			width: surfaceRect.width,
			height: surfaceRect.height
		};
		const centers = labelEntries.map((entry) => entry.rect.left + entry.rect.width / 2);
		const leftPx = inferredBounds ? inferredBounds.leftPx : Math.min(...centers);
		const rightPx = inferredBounds ? inferredBounds.rightPx : Math.max(...centers);
		const left = Math.max(leftPx - surfaceRect.left - 24, plotLocal.left);
		const right = Math.min(rightPx - surfaceRect.left + 24, plotLocal.left + plotLocal.width);
		const width = Math.max(right - left, 1);
		const top = plotLocal.top;
		const height = Math.max(plotLocal.height, 1);
		surface.setAttribute("viewBox", `${left} ${top} ${width} ${height}`);
		surface.setAttribute("preserveAspectRatio", "none");
		currentLineViewport = { xDomain: [...xDomain] };
		lastLineViewportResult = {
			viewport: currentLineViewport,
			applied: true,
			matchedLabels: labelEntries.map((entry) => entry.text),
			availableLabels: xLabelEntries.map((entry) => entry.text),
			inferredBounds,
			viewBox: [
				left,
				top,
				width,
				height
			],
			surfaceRect,
			plotLocal
		};
		return lastLineViewportResult;
	}
	function readDebugSnapshot() {
		const { surface, marks } = readSurfaceAndMarks();
		const lineSurfaceAndPaths = readSurfaceAndLinePaths();
		const rows = readObservableD3ScatterRows(window);
		return {
			route: "worker",
			surface: describeObservableD3Surface(window),
			plotRegion: findObservableD3PlotRegion(window),
			surfaceRect: readRectLike(surface),
			markCount: marks.length,
			rowSummary: summarizeObservableD3ScatterRows(rows),
			viewport: currentViewport,
			barSelection: lastBarSelection,
			barRows: readObservableD3BarRows(window),
			lineOverlay: lastLineOverlayResult,
			lineViewport: currentLineViewport,
			lineViewportResult: lastLineViewportResult,
			lineAnnotation: lastLineAnnotationResult,
			lineSurfaceRect: readRectLike(lineSurfaceAndPaths.surface),
			lineSurfaceViewBox: lineSurfaceAndPaths.surface?.getAttribute?.("viewBox") || null,
			lineSurfaceOriginalViewBox: lineSurfaceAndPaths.surface?.getAttribute?.(WIDGETVA_VIEWBOX_CACHE_ATTR) || null,
			lineRows: readObservableD3LineRows(window),
			scatterMatrix: readObservableD3ScatterMatrix(window),
			linePathSeries: mapLinePathsToSeries(lineSurfaceAndPaths.surface, lineSurfaceAndPaths.paths).map(({ path, series }) => ({
				series,
				endpoint: readLinePathEndpoint(path),
				stroke: path?.getAttribute?.("stroke") || path?.style?.stroke || null
			}))
		};
	}
	function renderDebugProbe() {
		const { surface } = readSurfaceAndMarks();
		return renderSurfaceProbe(surface, findObservableD3PlotRegion(window));
	}
	function buildOkResult(id, result) {
		return {
			source: SOURCE_WORKER,
			type: RESPONSE_TYPE,
			id,
			ok: true,
			result
		};
	}
	function buildErrorResult(id, error) {
		return {
			source: SOURCE_WORKER,
			type: RESPONSE_TYPE,
			id,
			ok: false,
			error: {
				name: error?.name || "Error",
				message: error?.message || String(error)
			}
		};
	}
	window.addEventListener("message", (event) => {
		const message = event?.data;
		if (!message || message.source !== SOURCE_TOP || message.type !== REQUEST_TYPE || typeof message.id !== "string") return;
		event.stopImmediatePropagation?.();
		event.stopPropagation?.();
		try {
			let result = null;
			if (message.method === "describeSurface") result = describeObservableD3Surface(window, { notebook: message.params?.notebook || null });
			else if (message.method === "readScatterRows") result = { rows: readObservableD3ScatterRows(window, { semanticHints: message.params?.semanticHints || null }) };
			else if (message.method === "readScatterMatrix") result = readObservableD3ScatterMatrix(window, { semanticHints: message.params?.semanticHints || null });
			else if (message.method === "readNativeCapture") result = readObservableD3NativeCaptureSnapshot(window);
			else if (message.method === "readBarRows") result = { rows: readObservableD3BarRows(window) };
			else if (message.method === "readLineRows") result = { rows: readObservableD3LineRows(window) };
			else if (message.method === "applyNativeBrushRegion") result = applyObservableD3NativeBrushRegion(window, message.params || null);
			else if (message.method === "clearNativeBrush") result = clearObservableD3NativeBrush(window, message.params || null);
			else if (message.method === "applyBarSelection") result = applyBarSelection(message.params?.selection || null);
			else if (message.method === "applyBarFilter") result = applyBarFilter(message.params?.filter || null);
			else if (message.method === "applyBarSort") result = applyBarSort(message.params?.sort || null);
			else if (message.method === "applyBarHighlight") result = applyBarHighlight(message.params?.highlight || null);
			else if (message.method === "applyLineSelection") result = applyLineSelection(message.params?.selection || null);
			else if (message.method === "applyLineFocus") result = applyLineFocus(message.params?.focus || null);
			else if (message.method === "applyLineBold") result = applyLineBold(message.params?.bold || null);
			else if (message.method === "applyLineFilter") result = applyLineFilter(message.params?.filter || null);
			else if (message.method === "applyLineTrend") result = applyLineTrend(message.params?.trend || null);
			else if (message.method === "applyLineMovingAverage") result = applyLineMovingAverage(message.params?.movingAverage || null);
			else if (message.method === "applyLineDrilldown") result = applyLineDrilldown(message.params?.drilldown || null);
			else if (message.method === "applyLineResample") result = applyLineResample(message.params?.resample || null);
			else if (message.method === "applyLineViewport") result = applyLineViewport(message.params?.viewport || null);
			else if (message.method === "applyScatterClusters") result = applyScatterClusters(message.params?.cluster || null);
			else if (message.method === "applyScatterRegression") result = applyScatterRegression(message.params?.regression || null);
			else if (message.method === "applyScatterViewport") result = applyScatterViewport(message.params?.viewport || null);
			else if (message.method === "readDebugSnapshot") result = readDebugSnapshot();
			else if (message.method === "renderDebugProbe") result = renderDebugProbe();
			else throw new Error(`Unsupported Observable D3 worker method: ${message.method || "missing"}.`);
			event.source?.postMessage(buildOkResult(message.id, result), "*");
		} catch (error) {
			event.source?.postMessage(buildErrorResult(message.id, error), "*");
		}
	}, true);
	//#endregion
})();
