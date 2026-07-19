//#region ../../widgetva-kit/src/widgets/families/bar/interactionProfile.js
function getBarHumanInteractionConfig() {
	return {
		mode: "categoryClick",
		actionName: "bar.selectCategory",
		supportsDirectManipulation: true
	};
}
//#endregion
//#region ../../widgetva-kit/src/widgets/families/bar/playbook.js
var barPlaybook = {
	analysisToAction: [
		{
			goal: "Identify the most or least important categories",
			workflow: "If the goal is to find the highest, lowest, most popular, or least popular categories, first make rank order legible, then read the leading or trailing categories instead of scanning the full chart.",
			candidateActions: [
				"bar.sortBars",
				"bar.highlightTopN",
				"bar.selectCategory"
			],
			candidatePerceptions: ["perception.findExtremes", "perception.compareGroups"]
		},
		{
			goal: "Explain category imbalance or overall distribution shape",
			workflow: "If the goal is to explain whether the distribution is concentrated, long-tailed, or relatively even, first isolate the categories driving that pattern and then compare their contribution against the rest of the chart.",
			candidateActions: [
				"bar.highlightTopN",
				"bar.filterCategories",
				"bar.filterSubcategories"
			],
			candidatePerceptions: ["perception.compareGroups", "perception.findExtremes"]
		},
		{
			goal: "Compare a small subset of categories",
			workflow: "If the goal is to compare a few categories, isolate those categories first and compare their magnitudes and gaps directly rather than interpreting the full chart.",
			candidateActions: [
				"bar.selectCategory",
				"bar.filterCategories",
				"bar.clickCategory"
			],
			candidatePerceptions: ["perception.compareGroups"]
		},
		{
			goal: "Compare grouped subsets more clearly",
			workflow: "If the goal is to compare how one variable differs across grouped subsets, reorder the bars to make cross-group contrast easier to scan before drawing conclusions.",
			candidateActions: [
				"bar.sortBars",
				"bar.filterCategories",
				"bar.toggleStackMode",
				"bar.expandStack"
			],
			candidatePerceptions: ["perception.compareGroups", "perception.findExtremes"]
		}
	],
	workflows: [
		{
			name: "filter_then_rank",
			analysisIntent: "Constrained ranking",
			scenarioExamples: ["After excluding irrelevant platforms, which Xbox product ranks first by average RPG score?", "Among selected countries, which region has the second-highest average employment?"],
			description: "Use when the task asks for the top, bottom, first, second, or ranked category after excluding or keeping a subset.",
			steps: [
				{ action: "bar.filterCategories" },
				{ action: "bar.sortBars" },
				{ perception: "perception.findExtremes" }
			]
		},
		{
			name: "filter_subcategories_then_rank",
			analysisIntent: "Segment-level ranking",
			scenarioExamples: ["For 2025 equipment only, which company ranks second by average power consumption?", "Among students with a specific parental education level, which group has the highest average math score?"],
			description: "Use when the comparison depends on one subcategory slice before ranking the remaining bars.",
			steps: [
				{ action: "bar.filterSubcategories" },
				{ action: "bar.sortBars" },
				{ perception: "perception.findExtremes" }
			]
		},
		{
			name: "filter_then_compare_stack",
			analysisIntent: "Composition comparison after filtering",
			scenarioExamples: ["After keeping West and South, which region contributes more total sales and how does the mix differ?", "Within one vehicle model series, which fuel type dominates after narrowing the comparison set?"],
			description: "Use when the task asks how filtered categories differ by stacked composition or subgroup contribution.",
			steps: [
				{ action: "bar.filterCategories" },
				{ action: "bar.toggleStackMode" },
				{ perception: "perception.compareGroups" }
			]
		},
		{
			name: "filter_subcategories_then_compare_stack",
			analysisIntent: "Grouped segment comparison",
			scenarioExamples: ["For selected chest-pain and heart-disease combinations, which group has higher average cholesterol?", "Across workout experience levels, which workout type shows the largest reduction in body fat percentage?"],
			description: "Use when the task asks for grouped subset comparison after keeping or removing specific subcategories.",
			steps: [
				{ action: "bar.filterSubcategories" },
				{ action: "bar.toggleStackMode" },
				{ perception: "perception.compareGroups" }
			]
		},
		{
			name: "rank_then_highlight_top_n",
			analysisIntent: "Top performer analysis",
			scenarioExamples: ["Which companies have the strongest and weakest LinkedIn presence, and what pattern separates them?", "Which anime titles are top performers by popularity compared with the rest of the distribution?"],
			description: "Use when the task asks to identify or discuss top performers after ranking all visible categories.",
			steps: [
				{ action: "bar.sortBars" },
				{ action: "bar.highlightTopN" },
				{ perception: "perception.findExtremes" }
			]
		}
	],
	multiTurnStrategy: [
		"First reveal the overall ranking or distribution shape of the bar chart.",
		"If the query only concerns part of the chart, isolate the relevant categories before comparing them.",
		"After the subset is stable, compare magnitudes, gaps, or relative positions within that subset.",
		"If the subset needs context, compare it back against the full chart.",
		"Stop when the category-level evidence is sufficient to answer the query directly."
	]
};
//#endregion
//#region ../../widgetva-kit/src/widgets/families/bar/actionDescriptors.js
var DESCRIPTORS$4 = [
	{
		"name": "bar.clickCategory",
		"description": "Click one or more categorical groups represented by bars and preserve the chart context, matching the page’s existing in-place category emphasis when available.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"field": { "type": "string" },
				"values": {
					"type": "array",
					"items": { "type": "string" }
				},
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["field", "values"]
		},
		"examples": [{
			"userGoal": "Click the sun bar so linked views react the same way as the existing Vega bar click.",
			"params": {
				"field": "weather",
				"values": ["sun"]
			}
		}]
	},
	{
		"name": "bar.selectCategory",
		"description": "Select one or more categorical groups represented by bars while preserving the surrounding chart context.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"field": { "type": "string" },
				"values": {
					"type": "array",
					"items": { "type": "string" }
				},
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["field", "values"]
		},
		"examples": [{
			"userGoal": "Select a subset of categories from the summary bar chart.",
			"params": {
				"field": "Origin",
				"values": ["Japan", "USA"]
			}
		}]
	},
	{
		"name": "bar.sortBars",
		"description": "Sort bar groups by the requested order and optional field.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"channel": { "type": "string" },
				"order": {
					"type": "string",
					"enum": ["ascending", "descending"]
				},
				"field": { "type": "string" },
				"aggregate": { "type": "string" },
				"bySubcategory": { "anyOf": [{ "type": "string" }, { "type": "number" }] },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["channel", "order"]
		},
		"examples": [{
			"userGoal": "Sort the bar chart descending by the aggregated measure.",
			"params": {
				"channel": "x",
				"order": "descending"
			}
		}, {
			"userGoal": "Sort grouped or stacked categories using one specific subcategory as the ranking signal.",
			"params": {
				"channel": "x",
				"order": "descending",
				"bySubcategory": "Type1"
			}
		}]
	},
	{
		"name": "bar.highlightTopN",
		"description": "Visually emphasize the top-N categories by measure while dimming the remaining bars.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"n": { "type": "number" },
				"order": {
					"type": "string",
					"enum": ["ascending", "descending"]
				},
				"categoryField": { "type": "string" },
				"measureField": { "type": "string" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["n"]
		},
		"examples": [{
			"userGoal": "Highlight only the top 5 categories by value before comparing them.",
			"params": {
				"n": 5,
				"order": "descending",
				"categoryField": "category",
				"measureField": "value"
			}
		}]
	},
	{
		"name": "bar.filterCategories",
		"description": "Filter the bar chart to a requested set of categories while leaving the other encodings intact.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"categories": {
					"type": "array",
					"items": { "anyOf": [{ "type": "string" }, { "type": "number" }] }
				},
				"field": { "type": "string" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["categories"]
		},
		"examples": [{
			"userGoal": "Keep only a few categories before comparing them in detail.",
			"params": {
				"categories": ["A", "C"],
				"field": "category"
			}
		}]
	},
	{
		"name": "bar.addBars",
		"description": "Expand the managed visible-category set of a bar chart by adding one or more category bars back into the visibility filter.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"values": {
					"type": "array",
					"items": { "anyOf": [{ "type": "string" }, { "type": "number" }] }
				},
				"field": { "type": "string" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["values"]
		},
		"examples": [{
			"userGoal": "Add previously hidden categories back into the current bar comparison without resetting the rest of the view.",
			"params": {
				"values": ["East", "West"],
				"field": "category"
			}
		}]
	},
	{
		"name": "bar.removeBars",
		"description": "Shrink the managed visible-category set of a bar chart by removing one or more category bars from the visibility filter.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"values": {
					"type": "array",
					"items": { "anyOf": [{ "type": "string" }, { "type": "number" }] }
				},
				"field": { "type": "string" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["values"]
		},
		"examples": [{
			"userGoal": "Temporarily remove several categories from the current bar comparison without resetting the rest of the view.",
			"params": {
				"values": ["East", "West"],
				"field": "category"
			}
		}]
	},
	{
		"name": "bar.addBarItems",
		"description": "Expand the managed visible item set of a grouped or stacked bar chart by adding one or more (category, subcategory) pairs back into the visibility filter.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"items": {
					"type": "array",
					"items": {
						"type": "object",
						"properties": {
							"x": { "anyOf": [{ "type": "string" }, { "type": "number" }] },
							"sub": { "anyOf": [{ "type": "string" }, { "type": "number" }] }
						},
						"required": ["x", "sub"]
					}
				},
				"xField": { "type": "string" },
				"subField": { "type": "string" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["items"]
		},
		"examples": [{
			"userGoal": "Bring a few grouped or stacked members back into the current comparison without resetting the whole chart.",
			"params": {
				"items": [{
					"x": "A",
					"sub": "Type2"
				}],
				"xField": "category",
				"subField": "type"
			}
		}]
	},
	{
		"name": "bar.removeBarItems",
		"description": "Shrink the managed visible item set of a grouped or stacked bar chart by removing one or more (category, subcategory) pairs from the visibility filter.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"items": {
					"type": "array",
					"items": {
						"type": "object",
						"properties": {
							"x": { "anyOf": [{ "type": "string" }, { "type": "number" }] },
							"sub": { "anyOf": [{ "type": "string" }, { "type": "number" }] }
						},
						"required": ["x", "sub"]
					}
				},
				"xField": { "type": "string" },
				"subField": { "type": "string" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["items"]
		},
		"examples": [{
			"userGoal": "Temporarily remove a few grouped or stacked members from the current comparison without resetting the whole chart.",
			"params": {
				"items": [{
					"x": "A",
					"sub": "Type2"
				}],
				"xField": "category",
				"subField": "type"
			}
		}]
	},
	{
		"name": "bar.filterSubcategories",
		"description": "Exclude one or more grouped or stacked subcategories from the current bar chart while preserving the remaining categories.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"subcategoriesToRemove": {
					"type": "array",
					"items": { "anyOf": [{ "type": "string" }, { "type": "number" }] }
				},
				"subField": { "type": "string" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["subcategoriesToRemove"]
		},
		"examples": [{
			"userGoal": "Remove several grouped or stacked subcategories before comparing the remaining composition.",
			"params": {
				"subcategoriesToRemove": ["Type2"],
				"subField": "type"
			}
		}]
	},
	{
		"name": "bar.expandStack",
		"description": "Filter to one category from a stacked bar chart and expand its stacked segments into parallel bars for easier comparison.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"category": { "anyOf": [{ "type": "string" }, { "type": "number" }] },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["category"]
		},
		"examples": [{
			"userGoal": "Expand one stacked category to compare its internal composition without stacked baselines.",
			"params": { "category": "East China" }
		}]
	},
	{
		"name": "bar.toggleStackMode",
		"description": "Switch a grouped/stacked bar chart between grouped and stacked display modes.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"mode": {
					"type": "string",
					"enum": ["grouped", "stacked"]
				},
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["mode"]
		},
		"examples": [{
			"userGoal": "Switch the current stacked bar chart into grouped mode for easier cross-category comparison.",
			"params": { "mode": "grouped" }
		}]
	}
];
function clone$11(value) {
	return value == null ? value : JSON.parse(JSON.stringify(value));
}
function rootEncoding$2(spec) {
	return spec?.layer?.[0]?.encoding || spec?.encoding || {};
}
function barCapabilities(spec) {
	const encoding = rootEncoding$2(spec);
	const xField = encoding?.x?.field || null;
	const yField = encoding?.y?.field || null;
	const xType = encoding?.x?.type || null;
	const yType = encoding?.y?.type || null;
	const xIsCategory = (xType === "nominal" || xType === "ordinal") && !encoding?.x?.bin;
	const yIsCategory = (yType === "nominal" || yType === "ordinal") && !encoding?.y?.bin;
	const categoryField = xIsCategory && xField ? xField : yIsCategory && yField ? yField : null;
	const subcategoryField = encoding?.xOffset?.field || encoding?.color?.field || null;
	const colorField = encoding?.color?.field || null;
	return {
		hasCategoryField: Boolean(categoryField),
		hasSubcategoryField: Boolean(categoryField && subcategoryField),
		hasColorField: Boolean(colorField)
	};
}
function filterDescriptorsBySpec$4(descriptors, widgetSpec) {
	if (!widgetSpec) return descriptors;
	const { hasCategoryField, hasSubcategoryField, hasColorField } = barCapabilities(widgetSpec);
	return descriptors.filter((descriptor) => {
		if (!descriptor?.name) return true;
		if ([
			"bar.clickCategory",
			"bar.selectCategory",
			"bar.sortBars",
			"bar.highlightTopN",
			"bar.filterCategories",
			"bar.addBars",
			"bar.removeBars"
		].includes(descriptor.name)) return hasCategoryField;
		if ([
			"bar.addBarItems",
			"bar.removeBarItems",
			"bar.filterSubcategories"
		].includes(descriptor.name)) return hasSubcategoryField;
		if (descriptor.name === "bar.expandStack" || descriptor.name === "bar.toggleStackMode") return hasCategoryField && hasColorField;
		return true;
	});
}
function buildBarActionDescriptors({ widgetSpec = null } = {}) {
	return filterDescriptorsBySpec$4(DESCRIPTORS$4, widgetSpec).map(clone$11);
}
//#endregion
//#region ../../widgetva-kit/src/schemas/query-scope.schema.js
var QUERY_SCOPE_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		dataRef: { type: "string" },
		selectionRef: { type: "string" },
		focusRef: { type: "string" },
		viewportRef: { type: "string" }
	}
};
var RUNTIME_ACTOR_SCHEMA = {
	type: "string",
	enum: [
		"agent",
		"human",
		"system"
	]
};
//#endregion
//#region ../../widgetva-kit/src/schemas/data-handles.schema.js
var DATA_QUERY_TARGET_SCHEMA = {
	type: "object",
	additionalProperties: false,
	required: ["widgetRef"],
	properties: { widgetRef: { type: "string" } }
};
var DATA_QUERY_KINDS = [
	"schema",
	"sampleRows",
	"filter",
	"aggregate",
	"groupBy",
	"sql",
	"summary",
	"computeCorrelation",
	"findExtremes",
	"findOutliers",
	"compareGroups"
];
var DATA_QUERY_PREDICATE_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		field: {
			type: "string",
			minLength: 1
		},
		op: {
			type: "string",
			minLength: 1
		},
		value: {}
	},
	required: [
		"field",
		"op",
		"value"
	]
};
var DATA_QUERY_MEASURE_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		op: { type: "string" },
		field: { type: "string" },
		as: { type: "string" }
	},
	required: ["op"]
};
var DATA_QUERY_SQL_SPEC_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		sql: {
			type: "string",
			minLength: 1
		},
		text: {
			type: "string",
			minLength: 1
		}
	},
	oneOf: [{ required: ["sql"] }, { required: ["text"] }]
};
var DATA_QUERY_SUMMARY_SPEC_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		fields: {
			type: "array",
			items: { type: "string" }
		},
		metrics: {
			type: "array",
			items: { type: "string" }
		},
		groupBy: {
			type: "array",
			items: { type: "string" }
		},
		measures: {
			type: "array",
			items: DATA_QUERY_MEASURE_SCHEMA
		},
		sortBy: {
			type: "object",
			properties: {
				field: { type: "string" },
				order: {
					type: "string",
					enum: ["ascending", "descending"]
				}
			}
		},
		limit: {
			type: "integer",
			minimum: 1,
			maximum: 500
		}
	}
};
var DATA_QUERY_CORRELATION_SPEC_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		xField: {
			type: "string",
			minLength: 1
		},
		yField: {
			type: "string",
			minLength: 1
		}
	},
	required: ["xField", "yField"]
};
var DATA_QUERY_EXTREMES_SPEC_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		field: {
			type: "string",
			minLength: 1
		},
		direction: {
			type: "string",
			enum: [
				"min",
				"max",
				"both"
			]
		},
		limit: {
			type: "integer",
			minimum: 1,
			maximum: 200
		}
	},
	required: ["field"]
};
var DATA_QUERY_OUTLIERS_SPEC_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		field: {
			type: "string",
			minLength: 1
		},
		method: {
			type: "string",
			enum: ["iqr", "zscore"]
		},
		limit: {
			type: "integer",
			minimum: 1,
			maximum: 200
		}
	},
	required: ["field"]
};
var DATA_QUERY_COMPARE_GROUPS_SPEC_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		groupField: {
			type: "string",
			minLength: 1
		},
		valueField: {
			type: "string",
			minLength: 1
		},
		groups: {
			type: "array",
			minItems: 2,
			items: {}
		},
		leftGroup: {},
		rightGroup: {}
	},
	required: ["groupField", "valueField"]
};
var DATA_QUERY_AGGREGATE_SPEC_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		groupBy: {
			type: "array",
			items: { type: "string" }
		},
		measures: {
			type: "array",
			items: DATA_QUERY_MEASURE_SCHEMA
		},
		metrics: {
			type: "array",
			items: DATA_QUERY_MEASURE_SCHEMA
		}
	}
};
var DATA_QUERY_CALL_QUERY_SCHEMA = {
	type: "object",
	additionalProperties: false,
	required: ["kind"],
	properties: {
		kind: {
			type: "string",
			enum: DATA_QUERY_KINDS
		},
		spec: { type: "object" }
	}
};
var DATA_RECORD_SCHEMA = { type: "object" };
var DATA_SUMMARY_ROW_SCHEMA = { type: "object" };
var DATA_GROUP_COMPARISON_SCHEMA = { type: ["object", "null"] };
var DATA_SCHEMA_RESULT_SCHEMA = {
	type: "object",
	properties: { fields: {
		type: "array",
		items: {
			type: "object",
			required: ["name", "type"],
			properties: {
				name: { type: "string" },
				type: { type: "string" },
				nullable: { type: "boolean" },
				description: { type: "string" }
			}
		}
	} }
};
var DATA_ROWS_RESULT_SCHEMA = {
	type: "array",
	items: DATA_RECORD_SCHEMA
};
var DATA_SUMMARY_TABLE_SCHEMA = {
	type: "object",
	properties: { rows: {
		type: "array",
		items: DATA_SUMMARY_ROW_SCHEMA
	} }
};
var DATA_QUERY_RESULT_SCHEMAS = {
	schema: DATA_SCHEMA_RESULT_SCHEMA,
	sampleRows: DATA_ROWS_RESULT_SCHEMA,
	filter: {
		type: "object",
		properties: {
			rows: DATA_ROWS_RESULT_SCHEMA,
			rowCount: { type: "integer" },
			predicates: {
				type: "array",
				items: DATA_QUERY_PREDICATE_SCHEMA
			}
		}
	},
	aggregate: DATA_SUMMARY_TABLE_SCHEMA,
	groupBy: DATA_SUMMARY_TABLE_SCHEMA,
	sql: DATA_ROWS_RESULT_SCHEMA,
	summary: DATA_SUMMARY_TABLE_SCHEMA,
	computeCorrelation: {
		type: "object",
		properties: {
			xField: { type: "string" },
			yField: { type: "string" },
			correlation: { type: ["number", "null"] },
			sampleSize: { type: "integer" }
		}
	},
	findExtremes: DATA_SUMMARY_TABLE_SCHEMA,
	findOutliers: DATA_SUMMARY_TABLE_SCHEMA,
	compareGroups: {
		type: "object",
		properties: {
			groupField: { type: ["string", "null"] },
			valueField: { type: ["string", "null"] },
			groups: {
				type: "array",
				items: DATA_SUMMARY_ROW_SCHEMA
			},
			comparison: DATA_GROUP_COMPARISON_SCHEMA
		}
	}
};
var DATA_QUERY_SCHEMAS = {
	schema: {
		type: "object",
		additionalProperties: false,
		properties: { queryScope: QUERY_SCOPE_SCHEMA }
	},
	sampleRows: {
		type: "object",
		additionalProperties: false,
		properties: {
			limit: {
				type: "integer",
				minimum: 1,
				maximum: 500
			},
			queryScope: QUERY_SCOPE_SCHEMA
		}
	},
	filter: {
		type: "object",
		additionalProperties: false,
		properties: {
			predicates: {
				type: "array",
				minItems: 1,
				items: DATA_QUERY_PREDICATE_SCHEMA
			},
			queryScope: QUERY_SCOPE_SCHEMA
		},
		required: ["predicates"]
	},
	aggregate: {
		...DATA_QUERY_AGGREGATE_SPEC_SCHEMA,
		properties: {
			...DATA_QUERY_AGGREGATE_SPEC_SCHEMA.properties,
			queryScope: QUERY_SCOPE_SCHEMA
		}
	},
	groupBy: {
		...DATA_QUERY_AGGREGATE_SPEC_SCHEMA,
		properties: {
			...DATA_QUERY_AGGREGATE_SPEC_SCHEMA.properties,
			queryScope: QUERY_SCOPE_SCHEMA
		}
	},
	sql: {
		...DATA_QUERY_SQL_SPEC_SCHEMA,
		properties: {
			...DATA_QUERY_SQL_SPEC_SCHEMA.properties,
			queryScope: QUERY_SCOPE_SCHEMA
		}
	},
	summary: {
		...DATA_QUERY_SUMMARY_SPEC_SCHEMA,
		properties: {
			...DATA_QUERY_SUMMARY_SPEC_SCHEMA.properties,
			queryScope: QUERY_SCOPE_SCHEMA
		}
	},
	computeCorrelation: {
		...DATA_QUERY_CORRELATION_SPEC_SCHEMA,
		properties: {
			...DATA_QUERY_CORRELATION_SPEC_SCHEMA.properties,
			queryScope: QUERY_SCOPE_SCHEMA
		}
	},
	findExtremes: {
		...DATA_QUERY_EXTREMES_SPEC_SCHEMA,
		properties: {
			...DATA_QUERY_EXTREMES_SPEC_SCHEMA.properties,
			queryScope: QUERY_SCOPE_SCHEMA
		}
	},
	findOutliers: {
		...DATA_QUERY_OUTLIERS_SPEC_SCHEMA,
		properties: {
			...DATA_QUERY_OUTLIERS_SPEC_SCHEMA.properties,
			queryScope: QUERY_SCOPE_SCHEMA
		}
	},
	compareGroups: {
		...DATA_QUERY_COMPARE_GROUPS_SPEC_SCHEMA,
		properties: {
			...DATA_QUERY_COMPARE_GROUPS_SPEC_SCHEMA.properties,
			queryScope: QUERY_SCOPE_SCHEMA
		}
	}
};
({ ...DATA_SCHEMA_RESULT_SCHEMA });
var DATA_QUERY_CALL_SCHEMA = {
	type: "object",
	additionalProperties: false,
	required: ["query"],
	properties: {
		callId: { type: "string" },
		actor: RUNTIME_ACTOR_SCHEMA,
		target: DATA_QUERY_TARGET_SCHEMA,
		dataRef: { type: "string" },
		query: DATA_QUERY_CALL_QUERY_SCHEMA
	}
};
//#endregion
//#region ../../widgetva-kit/src/schemas/perception.schema.js
var PERCEPTION_TARGET_SCHEMA = {
	type: "object",
	additionalProperties: false,
	required: ["widgetRef"],
	properties: { widgetRef: { type: "string" } }
};
var ENCODING_TYPES = [
	"quantitative",
	"nominal",
	"ordinal",
	"temporal",
	"geo"
];
var TRANSFORM_KINDS = [
	"filter",
	"sort",
	"aggregate",
	"derive",
	"sample",
	"syncDomain",
	"highlight"
];
var SELECTION_KINDS = [
	"interval",
	"point",
	"category",
	"cell"
];
var SELECTION_PREDICATE_OPERATIONS = [
	"equals",
	"in",
	"between"
];
var FIELD_ENCODING_SCHEMA = {
	type: "object",
	required: ["field", "type"],
	properties: {
		field: { type: "string" },
		type: {
			type: "string",
			enum: ENCODING_TYPES
		},
		aggregate: { type: ["string", "null"] },
		bin: { type: ["boolean", "null"] },
		scale: { anyOf: [{
			type: "object",
			properties: {
				domain: {},
				range: {},
				clamp: { type: "boolean" },
				nice: { type: "boolean" },
				zero: { type: "boolean" },
				type: { type: "string" }
			}
		}, { type: "null" }] }
	}
};
var PERCEPTION_SELECTION_DOMAIN_AXIS_SCHEMA = {
	type: "array",
	minItems: 2,
	maxItems: 2,
	items: { anyOf: [
		{ type: "number" },
		{ type: "string" },
		{ type: "null" }
	] }
};
var PERCEPTION_INSPECT_VIEW_CONFIG_RESULT_SCHEMA = {
	type: "object",
	properties: {
		ref: { type: ["string", "null"] },
		kind: { type: ["string", "null"] },
		encodings: {
			type: "object",
			additionalProperties: FIELD_ENCODING_SCHEMA
		},
		transforms: {
			type: "array",
			items: {
				type: "object",
				required: ["kind", "spec"],
				properties: {
					kind: {
						type: "string",
						enum: TRANSFORM_KINDS
					},
					source: { type: ["string", "null"] },
					sourceWidgetId: { type: ["string", "null"] },
					sourceSelectionRef: { type: ["string", "null"] },
					linkId: { type: ["string", "null"] },
					spec: { type: "object" }
				}
			}
		},
		view: {
			type: "object",
			properties: {
				xDomain: { anyOf: [
					PERCEPTION_SELECTION_DOMAIN_AXIS_SCHEMA,
					{
						type: "array",
						items: { anyOf: [
							{ type: "number" },
							{ type: "string" },
							{ type: "null" }
						] }
					},
					{ type: "null" }
				] },
				yDomain: { anyOf: [
					PERCEPTION_SELECTION_DOMAIN_AXIS_SCHEMA,
					{
						type: "array",
						items: { anyOf: [
							{ type: "number" },
							{ type: "string" },
							{ type: "null" }
						] }
					},
					{ type: "null" }
				] },
				zoom: { anyOf: [{
					type: "object",
					properties: {
						level: { type: "number" },
						center: {
							type: "array",
							minItems: 2,
							maxItems: 2,
							items: { type: "number" }
						}
					}
				}, { type: "null" }] },
				sort: { anyOf: [{
					type: "object",
					properties: {
						field: { type: "string" },
						order: {
							type: "string",
							enum: ["ascending", "descending"]
						}
					}
				}, { type: "null" }] }
			}
		},
		selections: {
			type: "object",
			additionalProperties: {
				type: "object",
				required: ["kind"],
				properties: {
					selectionRef: { type: ["string", "null"] },
					selectionId: { type: ["string", "null"] },
					kind: {
						type: "string",
						enum: SELECTION_KINDS
					},
					sourceWidgetRef: { type: ["string", "null"] },
					sourceWidgetId: { type: ["string", "null"] },
					scope: { type: "string" },
					selectionDataRef: { type: ["string", "null"] },
					fields: {
						type: "array",
						items: { type: "string" }
					},
					value: { type: "object" },
					domain: { anyOf: [{
						type: "object",
						properties: {
							xDomain: PERCEPTION_SELECTION_DOMAIN_AXIS_SCHEMA,
							yDomain: PERCEPTION_SELECTION_DOMAIN_AXIS_SCHEMA
						}
					}, { type: "null" }] },
					predicates: {
						type: "array",
						items: {
							type: "object",
							required: ["field", "op"],
							properties: {
								field: { type: "string" },
								op: {
									type: "string",
									enum: SELECTION_PREDICATE_OPERATIONS
								},
								value: {}
							}
						}
					},
					summary: { type: "string" },
					keyField: { type: "string" },
					keys: {
						type: "array",
						items: { type: ["string", "number"] }
					},
					field: { type: "string" },
					values: {
						type: "array",
						items: { type: ["string", "number"] }
					}
				}
			}
		},
		feedback: { anyOf: [{
			type: "object",
			properties: {
				hoveredItem: { type: ["object", "null"] },
				highlightedKeys: {
					type: "array",
					items: { type: ["string", "number"] }
				},
				tooltip: { type: ["object", "null"] },
				inboundLinkIds: {
					type: "array",
					items: { type: "string" }
				},
				highlightLinkIds: {
					type: "array",
					items: { type: "string" }
				},
				linkedSourceRefs: {
					type: "array",
					items: { type: "string" }
				},
				sharedSelectionSourceWidgetId: { type: ["string", "null"] }
			}
		}, { type: "null" }] }
	}
};
var PERCEPTION_INSPECT_VISIBLE_ROWS_RESULT_SCHEMA = {
	type: "object",
	properties: {
		ref: { type: ["string", "null"] },
		dataRef: { type: ["string", "null"] },
		visibleCount: { type: "integer" },
		rows: DATA_QUERY_RESULT_SCHEMAS.sampleRows
	}
};
var PERCEPTION_SUMMARY_GROUPS_SCHEMA = {
	type: "array",
	items: DATA_QUERY_RESULT_SCHEMAS.summary.properties.rows.items
};
var PERCEPTION_SUMMARIZE_SELECTION_RESULT_SCHEMA = {
	type: "object",
	properties: {
		hasSelection: { type: "boolean" },
		selectionCount: { type: "integer" },
		selectionRefs: {
			type: "array",
			items: { type: "string" }
		},
		dataRef: { type: ["string", "null"] },
		selectedCount: { type: "integer" },
		summary: { type: "string" },
		selectionSummaries: {
			type: "array",
			items: { type: "string" }
		},
		groups: PERCEPTION_SUMMARY_GROUPS_SCHEMA,
		aggregates: PERCEPTION_SUMMARY_GROUPS_SCHEMA,
		predicates: {
			type: "array",
			items: { type: "object" }
		},
		selectionPredicates: {
			type: "array",
			items: {
				type: "array",
				items: { type: "object" }
			}
		}
	}
};
var PERCEPTION_SUMMARIZE_VISIBLE_RESULT_SCHEMA = {
	type: "object",
	properties: {
		dataRef: { type: ["string", "null"] },
		rowCount: { type: "integer" },
		groups: PERCEPTION_SUMMARY_GROUPS_SCHEMA,
		aggregates: PERCEPTION_SUMMARY_GROUPS_SCHEMA,
		summary: { type: ["string", "null"] }
	}
};
var PERCEPTION_VERIFY_ACTION_EFFECT_PARAMS_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		actionName: { type: "string" },
		stateId: { type: "string" },
		refs: {
			type: "array",
			items: { type: "string" }
		}
	}
};
var PERCEPTION_RETURN_SCHEMAS = {
	"perception.inspectViewConfig": PERCEPTION_INSPECT_VIEW_CONFIG_RESULT_SCHEMA,
	"perception.inspectVisibleRows": PERCEPTION_INSPECT_VISIBLE_ROWS_RESULT_SCHEMA,
	"perception.summarizeSelection": PERCEPTION_SUMMARIZE_SELECTION_RESULT_SCHEMA,
	"perception.summarizeVisible": PERCEPTION_SUMMARIZE_VISIBLE_RESULT_SCHEMA,
	"perception.verifyActionEffect": {
		type: "object",
		properties: {
			verified: { type: "boolean" },
			matchedStateId: { type: ["string", "null"] },
			matchedActionName: { type: ["string", "null"] },
			affectedRefs: {
				type: "array",
				items: { type: "string" }
			},
			missingRefs: {
				type: "array",
				items: { type: "string" }
			},
			expectedPostconditions: {
				type: "array",
				items: {
					type: "object",
					properties: {
						description: { type: "string" },
						checkHint: { type: "string" },
						failureMessage: { type: "string" }
					}
				}
			},
			verificationHints: {
				type: "array",
				items: { type: "string" }
			},
			traceEvidence: { anyOf: [{ type: "null" }, { type: "object" }] },
			statePatch: { type: ["object", "null"] },
			finalSnapshot: { anyOf: [{ type: "null" }, { type: "object" }] },
			linkPropagation: {
				type: "array",
				items: {
					type: "object",
					properties: {
						ok: { type: "boolean" },
						sourceRef: { type: ["string", "null"] },
						linkCount: { type: "integer" },
						passedCount: { type: "integer" },
						consistencyScore: { type: "number" },
						results: {
							type: "array",
							items: { type: "object" }
						}
					}
				}
			},
			semanticVerification: { anyOf: [{ type: "null" }, {
				type: "object",
				properties: {
					ok: { type: "boolean" },
					kind: { type: "string" },
					summary: { type: "string" },
					expected: {
						type: "object",
						additionalProperties: true
					},
					actual: { anyOf: [{ type: "null" }, {
						type: "object",
						additionalProperties: true
					}] }
				}
			}] }
		}
	},
	"perception.computeCorrelation": {
		type: "object",
		properties: {
			dataRef: { type: ["string", "null"] },
			xField: { type: "string" },
			yField: { type: "string" },
			correlation: { type: ["number", "null"] },
			sampleSize: { type: "integer" }
		}
	},
	"perception.findExtremes": {
		type: "object",
		properties: {
			dataRef: { type: ["string", "null"] },
			field: { type: ["string", "null"] },
			direction: { type: "string" },
			rows: DATA_QUERY_RESULT_SCHEMAS.sampleRows
		}
	},
	"perception.findOutliers": {
		type: "object",
		properties: {
			dataRef: { type: ["string", "null"] },
			field: { type: ["string", "null"] },
			method: { type: "string" },
			rows: DATA_QUERY_RESULT_SCHEMAS.sampleRows
		}
	},
	"perception.compareGroups": {
		type: "object",
		properties: {
			dataRef: { type: ["string", "null"] },
			groupField: { type: ["string", "null"] },
			valueField: { type: ["string", "null"] },
			groups: DATA_QUERY_RESULT_SCHEMAS.compareGroups.properties.groups,
			comparison: DATA_QUERY_RESULT_SCHEMAS.compareGroups.properties.comparison
		}
	}
};
function readPerceptionParamsSchema(queryName) {
	if (queryName === "perception.verifyActionEffect") return PERCEPTION_VERIFY_ACTION_EFFECT_PARAMS_SCHEMA;
}
function readPerceptionReturnsSchema(queryName) {
	return queryName ? PERCEPTION_RETURN_SCHEMAS[queryName] : void 0;
}
var PERCEPTION_QUERY_CALL_SCHEMA = {
	type: "object",
	additionalProperties: false,
	required: ["name"],
	properties: {
		callId: { type: "string" },
		name: { type: "string" },
		actor: RUNTIME_ACTOR_SCHEMA,
		target: PERCEPTION_TARGET_SCHEMA,
		queryScope: QUERY_SCOPE_SCHEMA,
		params: { type: "object" }
	}
};
//#endregion
//#region ../../widgetva-kit/src/contracts/perception-contracts.js
function cloneValue$1(value) {
	return value == null ? value : JSON.parse(JSON.stringify(value));
}
function withPerceptionQueryScope(paramsSchema) {
	if (!paramsSchema || typeof paramsSchema !== "object" || Array.isArray(paramsSchema)) return {
		type: "object",
		properties: { queryScope: QUERY_SCOPE_SCHEMA }
	};
	return {
		...cloneValue$1(paramsSchema),
		properties: {
			...cloneValue$1(paramsSchema.properties) || {},
			queryScope: QUERY_SCOPE_SCHEMA
		}
	};
}
function makePerceptionDescriptor(descriptor) {
	const returnsSchema = descriptor?.returnsSchema || readPerceptionReturnsSchema(descriptor?.name);
	const paramsSchema = withPerceptionQueryScope(descriptor?.paramsSchema || readPerceptionParamsSchema(descriptor?.name));
	return {
		...descriptor,
		targetRef: descriptor?.targetRef ?? null,
		paramsSchema: paramsSchema || withPerceptionQueryScope({
			type: "object",
			properties: {}
		}),
		returnsSchema: returnsSchema || void 0,
		sideEffectFree: descriptor?.sideEffectFree !== false,
		evidenceKinds: Array.isArray(descriptor?.evidenceKinds) ? descriptor.evidenceKinds : [],
		verificationTargets: Array.isArray(descriptor?.verificationTargets) ? descriptor.verificationTargets : [],
		examples: Array.isArray(descriptor?.examples) ? descriptor.examples : []
	};
}
//#endregion
//#region ../../widgetva-kit/src/widgets/families/shared/dataPerception.js
function runDataPerceptionQuery({ ctx, dataQueryExecutor, targetWidget, kind, spec }) {
	const { dataRef } = ctx.resolveRowsForWidget(targetWidget, spec || {});
	const queryResult = dataQueryExecutor.run({
		dataRef,
		query: {
			kind,
			spec: spec || {}
		}
	});
	return {
		dataRef,
		ok: queryResult?.ok === true,
		result: queryResult?.result || null,
		error: queryResult?.error || null
	};
}
function buildPerceptionDataResult({ dataQueryResult, fallbackDataRef = null }) {
	return {
		dataRef: dataQueryResult?.dataRef || fallbackDataRef || null,
		...dataQueryResult?.result || {}
	};
}
//#endregion
//#region ../../widgetva-kit/src/widgets/families/shared/perceptionScope.js
function buildScopedPerceptionParamsSchema(extraProperties = {}) {
	return {
		type: "object",
		properties: { ...extraProperties || {} }
	};
}
function buildQueryScopeExample({ userGoal, params = {}, dataRef = "wl://demo/workspace/main/data/current_view", selectionRef = null } = {}) {
	return {
		userGoal,
		params: {
			...params || {},
			queryScope: {
				dataRef,
				...selectionRef ? { selectionRef } : {}
			}
		}
	};
}
function appendQueryScopeGuidance(description) {
	const base = typeof description === "string" ? description.trim() : "";
	const guidance = "Use target.widgetRef for widget targeting and queryScope for data/selection targeting.";
	if (!base) return guidance;
	return `${base} ${guidance}`;
}
//#endregion
//#region ../../widgetva-kit/src/widgets/families/bar/perception.js
function buildBarPerceptionDescriptors({ dataRef }) {
	return [makePerceptionDescriptor({
		name: "perception.compareGroups",
		title: "Compare groups",
		description: appendQueryScopeGuidance("Compare summary statistics for specified groups in the visible bar data."),
		category: "compute",
		targetRef: dataRef,
		paramsSchema: buildScopedPerceptionParamsSchema({
			groupField: { type: "string" },
			valueField: { type: "string" },
			groups: {
				type: "array",
				items: { type: "string" }
			}
		}),
		sideEffectFree: true,
		evidenceKinds: ["groupComparison", "aggregateEvidence"],
		examples: [{
			userGoal: "Compare a few selected groups in the summary bars.",
			params: {
				groupField: "Origin",
				valueField: "count",
				groups: ["Japan", "USA"]
			}
		}, buildQueryScopeExample({
			userGoal: "Compare grouped bar summaries inside one filtered selection.",
			params: {
				groupField: "Origin",
				valueField: "count",
				groups: ["Japan", "USA"]
			},
			widgetRef: "wl://demo/workspace/main/widget/bar_a",
			dataRef: "wl://demo/workspace/main/data/current_selection",
			selectionRef: "wl://demo/workspace/main/widget/bar_a/selection/current"
		})]
	}), makePerceptionDescriptor({
		name: "perception.findExtremes",
		title: "Find extremes",
		description: appendQueryScopeGuidance("Return top-k or bottom-k visible rows by a numeric field."),
		category: "compute",
		targetRef: dataRef,
		paramsSchema: buildScopedPerceptionParamsSchema({
			field: { type: "string" },
			direction: { type: "string" },
			limit: { type: "number" }
		}),
		sideEffectFree: true,
		evidenceKinds: ["rankEvidence", "aggregateEvidence"],
		examples: [{
			userGoal: "Find the highest or lowest categories in the current summary view.",
			params: {
				field: "count",
				direction: "max",
				limit: 5
			}
		}, buildQueryScopeExample({
			userGoal: "Find the highest bars inside one filtered bar subset.",
			params: {
				field: "count",
				direction: "max",
				limit: 5
			},
			widgetRef: "wl://demo/workspace/main/widget/bar_a",
			dataRef: "wl://demo/workspace/main/data/current_selection",
			selectionRef: "wl://demo/workspace/main/widget/bar_a/selection/current"
		})]
	})];
}
function registerBarPerceptionQueries(perceptionRegistry) {
	if (!perceptionRegistry.has("perception.compareGroups", { supportedWidgetKinds: ["bar"] })) perceptionRegistry.register({
		name: "perception.compareGroups",
		supportedWidgetKinds: ["bar"]
	}, async (call, ctx) => {
		const targetWidget = ctx.requireTargetWidget({ kind: "bar" });
		const params = ctx.readCallParams();
		const comparison = runDataPerceptionQuery({
			ctx,
			dataQueryExecutor: perceptionRegistry.dataQueryExecutor,
			targetWidget,
			kind: "compareGroups",
			spec: params
		});
		ctx.recordQuery({ affectedRefs: [targetWidget.ref] });
		return { result: buildPerceptionDataResult({
			dataQueryResult: comparison,
			fallbackDataRef: ctx.resolveRowsForWidget(targetWidget, params).dataRef
		}) };
	}, { supportedWidgetKinds: ["bar"] });
	if (!perceptionRegistry.has("perception.findExtremes", { supportedWidgetKinds: ["bar"] })) perceptionRegistry.register({
		name: "perception.findExtremes",
		supportedWidgetKinds: ["bar"]
	}, async (call, ctx) => {
		const targetWidget = ctx.requireTargetWidget({ kind: "bar" });
		const params = ctx.readCallParams();
		const extremes = runDataPerceptionQuery({
			ctx,
			dataQueryExecutor: perceptionRegistry.dataQueryExecutor,
			targetWidget,
			kind: "findExtremes",
			spec: params
		});
		ctx.recordQuery({ affectedRefs: [targetWidget.ref] });
		return { result: buildPerceptionDataResult({
			dataQueryResult: extremes,
			fallbackDataRef: ctx.resolveRowsForWidget(targetWidget, params).dataRef
		}) };
	}, { supportedWidgetKinds: ["bar"] });
}
//#endregion
//#region ../../widgetva-kit/src/widgets/families/bar/index.js
function clone$10(value) {
	return value == null ? value : JSON.parse(JSON.stringify(value));
}
var BAR_LOCAL_SELECTION_CONTRACT = Object.freeze({
	localSelectionFamily: "category",
	selectionKinds: ["category"],
	sourceActionNames: ["bar.clickCategory", "bar.selectCategory"],
	cardinality: "singleActiveSelection",
	selectionValueShape: "categoricalValues",
	observationFields: [
		"state.selections",
		"coordination.localSelectionRefs",
		"coordination.widgetSelectionRef",
		"selection.activeSelectionRef",
		"selection.activeSelectionKind",
		"selection.activeSelectionSummary"
	],
	perceptionExpectations: ["selection-scoped perception queries should accept queryScope.selectionRef when a bar selection is active", "selection summaries should describe selected categorical groups rather than raw pixel regions"]
});
var BAR_VERIFICATION_CONTRACT = Object.freeze({
	preferredReadMethod: "readVerificationState",
	preferredObservationFields: [
		"verification.checks.selectionApplied",
		"verification.checks.filterApplied",
		"verification.checks.sortApplied",
		"verification.checks.reencodeApplied",
		"verification.checks.addRemoveApplied",
		"verification.checks.highlightApplied",
		"verification.encodings.channels",
		"verification.view.addRemove",
		"verification.view.reencode",
		"verification.view.sort",
		"verification.view.highlight",
		"verification.transforms.kinds"
	],
	supportedEffectTypes: [
		"selection",
		"filter",
		"sort",
		"reencode",
		"addRemove",
		"highlight",
		"encoding",
		"linkedPropagation"
	],
	effectChecks: {
		selection: [
			"checks.selectionApplied",
			"selections.count",
			"selections.activeSummary"
		],
		filter: [
			"checks.filterApplied",
			"data.rowCount",
			"data.visibleCount",
			"transforms.kinds"
		],
		sort: ["checks.sortApplied", "view.sort"],
		reencode: [
			"checks.reencodeApplied",
			"view.reencode",
			"encodings.channels"
		],
		addRemove: [
			"checks.addRemoveApplied",
			"view.addRemove",
			"data.visibleCount"
		],
		highlight: [
			"checks.highlightApplied",
			"view.highlight",
			"feedback.highlightKeyCount",
			"feedback.sharedSelectionSourceWidgetId"
		],
		encoding: [
			"checks.encodingReadable",
			"encodings.channels",
			"encodings.fieldsByChannel"
		],
		linkedPropagation: [
			"checks.linkedPropagationApplied",
			"feedback.linkedSourceRefCount",
			"feedback.sharedSelectionSourceWidgetId"
		]
	}
});
function describeBarLocalSelectionContract() {
	return clone$10(BAR_LOCAL_SELECTION_CONTRACT);
}
function describeBarVerificationContract() {
	return clone$10(BAR_VERIFICATION_CONTRACT);
}
function describeBarWidgetContract() {
	return {
		kind: "bar",
		actionNames: [
			"bar.clickCategory",
			"bar.selectCategory",
			"bar.sortBars",
			"bar.highlightTopN",
			"bar.filterCategories",
			"bar.addBars",
			"bar.removeBars",
			"bar.addBarItems",
			"bar.removeBarItems",
			"bar.filterSubcategories",
			"bar.expandStack",
			"bar.toggleStackMode"
		],
		perceptionNames: ["perception.compareGroups", "perception.findExtremes"],
		localSelection: describeBarLocalSelectionContract(),
		verification: describeBarVerificationContract()
	};
}
var barFamily = Object.freeze({
	kind: "bar",
	describeContract: describeBarWidgetContract,
	actions: Object.freeze({ buildDescriptors: buildBarActionDescriptors }),
	perception: Object.freeze({
		buildDescriptors: buildBarPerceptionDescriptors,
		register: registerBarPerceptionQueries
	}),
	interactionProfile: Object.freeze({ getConfig: getBarHumanInteractionConfig }),
	playbook: barPlaybook
});
//#endregion
//#region ../../widgetva-kit/src/widgets/families/heatmap/interactionProfile.js
function getHeatmapHumanInteractionConfig() {
	return {
		mode: "cellClick",
		actionName: "heatmap.filterCells",
		supportsDirectManipulation: true
	};
}
//#endregion
//#region ../../widgetva-kit/src/widgets/families/heatmap/playbook.js
var heatmapPlaybook = {
	analysisToAction: [
		{
			goal: "Find hotspots or coldspots",
			workflow: "If the goal is to identify hotspots, coldspots, or strong concentration, first locate the most intense and weakest regions, then interpret them in row and column context.",
			candidateActions: [
				"heatmap.highlightRegion",
				"heatmap.highlightRegionByValue",
				"heatmap.selectSubmatrix",
				"heatmap.selectCell"
			],
			candidatePerceptions: ["perception.findExtremes", "perception.findOutliers"]
		},
		{
			goal: "Understand interaction between two dimensions",
			workflow: "If the goal is to understand the x-y relationship, look for blocks, bands, or gradients rather than isolated cells, then inspect the most informative local structure.",
			candidateActions: [
				"heatmap.selectSubmatrix",
				"heatmap.drilldownAxis",
				"heatmap.transpose"
			],
			candidatePerceptions: ["perception.findExtremes", "perception.findOutliers"]
		},
		{
			goal: "Explain an anomalous local region",
			workflow: "If the goal is to explain an anomalous cell or local block, compare the selected region against its neighborhood to determine whether the pattern is isolated or structural.",
			candidateActions: [
				"heatmap.selectSubmatrix",
				"heatmap.selectCell",
				"heatmap.highlightRegion"
			],
			candidatePerceptions: ["perception.findOutliers", "perception.findExtremes"]
		},
		{
			goal: "Focus attention on local rows, columns, or a submatrix",
			workflow: "If the goal is to inspect local structure more clearly, highlight or isolate the relevant rows, columns, or submatrix before interpreting the pattern.",
			candidateActions: [
				"heatmap.selectSubmatrix",
				"heatmap.highlightRegion",
				"heatmap.filterCellsByRegion"
			],
			candidatePerceptions: ["perception.findExtremes"]
		},
		{
			goal: "Make the x-y relationship visually easier to read",
			workflow: "If the current encoding hides the relationship, switch to a more contrastive color scheme or add a complementary encoding that makes relative magnitude easier to compare.",
			candidateActions: [
				"heatmap.adjustColorScale",
				"heatmap.addMarginalBars",
				"heatmap.transpose",
				"heatmap.clusterRowsCols"
			],
			candidatePerceptions: ["perception.findExtremes"]
		}
	],
	workflows: [
		{
			name: "filter_region_then_find_extremes",
			analysisIntent: "Local hotspot or coldspot lookup",
			scenarioExamples: ["Within haircare products, which customer demographic has the highest mean price?", "For a selected city-month range, which cell has the most extreme temperature?"],
			description: "Use when the task asks for the hottest, coldest, highest, or lowest cell inside a local heatmap region.",
			steps: [{ action: "heatmap.filterCellsByRegion" }, { perception: "perception.findExtremes" }]
		},
		{
			name: "filter_region_then_summarize",
			analysisIntent: "Local block summary",
			scenarioExamples: ["What is the difference in mean anxiety levels between composers who are instrumentalists and those who are not?", "How does one month band compare with another across the selected product categories?"],
			description: "Use when the task asks for a comparison or summary after keeping a row, column, or submatrix region.",
			steps: [{ action: "heatmap.filterCellsByRegion" }, { perception: "perception.findExtremes" }]
		},
		{
			name: "adjust_color_then_add_marginals",
			analysisIntent: "Row-column contribution reading",
			scenarioExamples: ["Which rows and columns drive the strongest hotspot pattern after the color scale is made readable?", "Do marginal totals confirm that the apparent hotspot is a row effect or a column effect?"],
			description: "Use when the global heatmap structure is hard to read and row or column totals would clarify hotspots.",
			steps: [
				{ action: "heatmap.adjustColorScale" },
				{ action: "heatmap.addMarginalBars" },
				{ perception: "perception.findExtremes" }
			]
		},
		{
			name: "cluster_then_highlight_region",
			analysisIntent: "Clustered block interpretation",
			scenarioExamples: ["Which months form a coherent seasonal block after clustering rows and columns?", "Which disease-risk features cluster together, and which region should be highlighted for explanation?"],
			description: "Use when the task asks about block structure after row or column clustering.",
			steps: [
				{ action: "heatmap.clusterRowsCols" },
				{ action: "heatmap.highlightRegion" },
				{ perception: "perception.findOutliers" }
			]
		},
		{
			name: "adjust_color_then_cluster_then_filter_region",
			analysisIntent: "Noisy matrix simplification",
			scenarioExamples: ["After improving contrast, which clustered crime-pattern block explains the strongest district-month anomaly?", "Which clustered health-measure block remains extreme after the heatmap is recolored?"],
			description: "Use when the heatmap needs stronger contrast before clustering and selecting the resulting local block.",
			steps: [
				{ action: "heatmap.adjustColorScale" },
				{ action: "heatmap.clusterRowsCols" },
				{ action: "heatmap.filterCellsByRegion" },
				{ perception: "perception.findExtremes" }
			]
		},
		{
			name: "change_view_then_filter_region",
			analysisIntent: "Reoriented matrix comparison",
			scenarioExamples: ["After transposing the heatmap, which month has the lowest mean price for Cortado?", "When rows and columns are swapped, which category block becomes the clearest target for comparison?"],
			description: "Use when the current heatmap orientation or encoding hides the region needed for the question.",
			steps: [
				{ action: "heatmap.transpose" },
				{ action: "heatmap.filterCellsByRegion" },
				{ perception: "perception.findExtremes" }
			]
		}
	],
	multiTurnStrategy: [
		"First decide whether the query is about global structure or a local region of the matrix.",
		"If local structure matters, isolate the relevant rows, columns, or submatrix before interpreting it.",
		"If the current encoding is too weak to support the query, improve readability before drawing conclusions.",
		"Then compare the local structure against its surrounding context.",
		"Stop when the selected region and its contrast with the rest of the matrix are clear enough to answer directly."
	]
};
//#endregion
//#region ../../widgetva-kit/src/widgets/families/heatmap/actionDescriptors.js
var DESCRIPTORS$3 = [
	{
		"name": "heatmap.filterCells",
		"description": "Filter the workspace through a heatmap cell identified by its x/y category pair.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"xField": { "type": "string" },
				"yField": { "type": "string" },
				"xValue": { "anyOf": [{ "type": "string" }, { "type": "number" }] },
				"yValue": { "anyOf": [{ "type": "string" }, { "type": "number" }] },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": [
				"xField",
				"yField",
				"xValue",
				"yValue"
			]
		},
		"examples": [{
			"userGoal": "Select one heatmap cell and inspect linked detail views.",
			"params": {
				"xField": "Origin",
				"yField": "Cylinders",
				"xValue": "Japan",
				"yValue": "4"
			}
		}]
	},
	{
		"name": "heatmap.selectCell",
		"description": "Select a single heatmap cell through the canonical heatmap cell contract.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"xField": { "type": "string" },
				"yField": { "type": "string" },
				"xValue": { "anyOf": [{ "type": "string" }, { "type": "number" }] },
				"yValue": { "anyOf": [{ "type": "string" }, { "type": "number" }] },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": [
				"xField",
				"yField",
				"xValue",
				"yValue"
			]
		},
		"examples": [{
			"userGoal": "Select one heatmap cell and inspect linked detail views.",
			"params": {
				"xField": "Origin",
				"yField": "Cylinders",
				"xValue": "Japan",
				"yValue": "4"
			}
		}]
	},
	{
		"name": "heatmap.selectSubmatrix",
		"description": "Select a heatmap submatrix defined by one or more x-axis and/or y-axis coordinates without mutating the view spec.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"xValues": {
					"type": "array",
					"items": { "anyOf": [{ "type": "string" }, { "type": "number" }] }
				},
				"yValues": {
					"type": "array",
					"items": { "anyOf": [{ "type": "string" }, { "type": "number" }] }
				},
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			}
		},
		"examples": [{
			"userGoal": "Select a rectangular region of the heatmap before inspecting linked views.",
			"params": {
				"xValues": ["Q1", "Q2"],
				"yValues": ["A", "B"]
			}
		}]
	},
	{
		"name": "heatmap.drilldownAxis",
		"description": "Drill a temporal heatmap x-axis from year to month or from month to date by narrowing the visible period and refining the x-axis timeUnit.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"level": { "type": "string" },
				"value": { "anyOf": [{ "type": "number" }, { "type": "string" }] },
				"parent": { "type": "object" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["level", "value"]
		},
		"examples": [{
			"userGoal": "Drill a yearly heatmap into monthly detail for one year.",
			"params": {
				"level": "year",
				"value": 2024
			}
		}]
	},
	{
		"name": "heatmap.resetDrilldown",
		"description": "Restore the original temporal x-axis encoding and remove drill-down filters from the heatmap.",
		"paramsSchema": {
			"type": "object",
			"properties": { "queryScope": {
				"type": "object",
				"additionalProperties": false,
				"properties": {
					"dataRef": { "type": "string" },
					"selectionRef": { "type": "string" },
					"focusRef": { "type": "string" },
					"viewportRef": { "type": "string" }
				}
			} }
		},
		"examples": [{
			"userGoal": "Return a drilled heatmap back to its original yearly overview.",
			"params": {}
		}]
	},
	{
		"name": "heatmap.addMarginalBars",
		"description": "Compose a heatmap with optional top and right marginal bar charts that aggregate the heatmap value field along each axis.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"op": { "type": "string" },
				"showTop": { "type": "boolean" },
				"showRight": { "type": "boolean" },
				"barSize": { "type": "number" },
				"barColor": { "type": "string" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			}
		},
		"examples": [{
			"userGoal": "Add row and column marginal summaries before comparing the overall heatmap structure.",
			"params": {
				"op": "mean",
				"showTop": true,
				"showRight": true,
				"barSize": 70,
				"barColor": "#666666"
			}
		}]
	},
	{
		"name": "heatmap.highlightRegion",
		"description": "Highlight one or more heatmap rows, columns, or their intersection without filtering away the rest of the matrix.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"xValues": {
					"type": "array",
					"items": { "anyOf": [{ "type": "string" }, { "type": "number" }] }
				},
				"yValues": {
					"type": "array",
					"items": { "anyOf": [{ "type": "string" }, { "type": "number" }] }
				},
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			}
		},
		"examples": [{
			"userGoal": "Highlight one row/column region before comparing extreme cells.",
			"params": {
				"xValues": ["Q1"],
				"yValues": ["A"]
			}
		}]
	},
	{
		"name": "heatmap.adjustColorScale",
		"description": "Update the heatmap color scheme and optional numeric domain without changing the underlying data.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"scheme": { "type": "string" },
				"domain": {
					"type": "array",
					"minItems": 2,
					"maxItems": 2,
					"items": { "anyOf": [{ "type": "number" }, { "type": "string" }] }
				},
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			}
		},
		"examples": [{
			"userGoal": "Switch to a new color scheme and tighten the value range for comparison.",
			"params": {
				"scheme": "blues",
				"domain": [0, 25]
			}
		}]
	},
	{
		"name": "heatmap.thresholdMask",
		"description": "Visually dim heatmap cells whose color values fall outside the requested inclusive threshold range.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"minValue": { "anyOf": [{ "type": "number" }, { "type": "string" }] },
				"maxValue": { "anyOf": [{ "type": "number" }, { "type": "string" }] },
				"outsideOpacity": { "type": "number" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["minValue", "maxValue"]
		},
		"examples": [{
			"userGoal": "Dim low-signal cells while keeping the full matrix visible.",
			"params": {
				"minValue": 10,
				"maxValue": 25,
				"outsideOpacity": .1
			}
		}]
	},
	{
		"name": "heatmap.filterCellsByRegion",
		"description": "Exclude one or more heatmap rows, columns, or their intersection by writing a region filter into the heatmap spec.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"xValue": { "anyOf": [{ "type": "string" }, { "type": "number" }] },
				"yValue": { "anyOf": [{ "type": "string" }, { "type": "number" }] },
				"xValues": {
					"type": "array",
					"items": { "anyOf": [{ "type": "string" }, { "type": "number" }] }
				},
				"yValues": {
					"type": "array",
					"items": { "anyOf": [{ "type": "string" }, { "type": "number" }] }
				},
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			}
		},
		"examples": [{
			"userGoal": "Remove one heatmap row-column intersection before inspecting the remaining structure.",
			"params": {
				"xValues": ["Q1"],
				"yValues": ["A"]
			}
		}]
	},
	{
		"name": "heatmap.highlightRegionByValue",
		"description": "Visually emphasize cells whose displayed values fall inside a requested range, while dimming the rest without filtering data away.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"minValue": { "anyOf": [{ "type": "number" }, { "type": "string" }] },
				"maxValue": { "anyOf": [{ "type": "number" }, { "type": "string" }] },
				"outsideOpacity": { "type": "number" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			}
		},
		"examples": [{
			"userGoal": "Highlight only mid-range or high-value cells before comparing hotspots.",
			"params": {
				"minValue": 10,
				"maxValue": 25,
				"outsideOpacity": .12
			}
		}]
	},
	{
		"name": "heatmap.clusterRowsCols",
		"description": "Reorder heatmap rows and/or columns by aggregated cell values so high-value bands are grouped toward the front.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"clusterRows": { "type": "boolean" },
				"clusterCols": { "type": "boolean" },
				"method": { "type": "string" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			}
		},
		"examples": [{
			"userGoal": "Bring the hottest rows and columns toward the front of the matrix.",
			"params": {
				"clusterRows": true,
				"clusterCols": true,
				"method": "sum"
			}
		}]
	},
	{
		"name": "heatmap.transpose",
		"description": "Swap the heatmap x and y encodings to quickly inspect the matrix from the opposite orientation.",
		"paramsSchema": {
			"type": "object",
			"properties": { "queryScope": {
				"type": "object",
				"additionalProperties": false,
				"properties": {
					"dataRef": { "type": "string" },
					"selectionRef": { "type": "string" },
					"focusRef": { "type": "string" },
					"viewportRef": { "type": "string" }
				}
			} }
		},
		"examples": [{
			"userGoal": "Flip rows and columns to compare the matrix from the opposite orientation.",
			"params": {}
		}]
	}
];
function clone$9(value) {
	return value == null ? value : JSON.parse(JSON.stringify(value));
}
function rootEncoding$1(spec) {
	return spec?.layer?.[0]?.encoding || spec?.encoding || {};
}
function heatmapCapabilities(spec) {
	const encoding = rootEncoding$1(spec);
	const hasXAxis = typeof encoding?.x?.field === "string" && encoding.x.field.length > 0;
	const hasYAxis = typeof encoding?.y?.field === "string" && encoding.y.field.length > 0;
	return {
		hasAxes: hasXAxis && hasYAxis,
		hasColorField: typeof encoding?.color?.field === "string" && encoding.color.field.length > 0,
		hasTemporalXAxis: encoding?.x?.type === "temporal" || typeof encoding?.x?.timeUnit === "string"
	};
}
function filterDescriptorsBySpec$3(descriptors, widgetSpec) {
	if (!widgetSpec) return descriptors;
	const { hasAxes, hasColorField, hasTemporalXAxis } = heatmapCapabilities(widgetSpec);
	return descriptors.filter((descriptor) => {
		if (!descriptor?.name) return true;
		if ([
			"heatmap.filterCells",
			"heatmap.selectCell",
			"heatmap.selectSubmatrix",
			"heatmap.highlightRegion",
			"heatmap.filterCellsByRegion",
			"heatmap.transpose"
		].includes(descriptor.name)) return hasAxes;
		if ([
			"heatmap.addMarginalBars",
			"heatmap.adjustColorScale",
			"heatmap.thresholdMask",
			"heatmap.highlightRegionByValue",
			"heatmap.clusterRowsCols"
		].includes(descriptor.name)) return hasAxes && hasColorField;
		if (descriptor.name === "heatmap.drilldownAxis" || descriptor.name === "heatmap.resetDrilldown") return hasAxes && hasTemporalXAxis;
		return true;
	});
}
function buildHeatmapActionDescriptors({ widgetSpec = null } = {}) {
	return filterDescriptorsBySpec$3(DESCRIPTORS$3, widgetSpec).map(clone$9);
}
//#endregion
//#region ../../widgetva-kit/src/widgets/families/heatmap/perception.js
function buildHeatmapPerceptionDescriptors({ dataRef }) {
	return [makePerceptionDescriptor({
		name: "perception.findExtremes",
		title: "Find extremes",
		description: appendQueryScopeGuidance("Return highest or lowest valued cells in the visible heatmap data."),
		category: "compute",
		targetRef: dataRef,
		paramsSchema: buildScopedPerceptionParamsSchema({
			field: { type: "string" },
			direction: { type: "string" },
			limit: { type: "number" }
		}),
		sideEffectFree: true,
		evidenceKinds: ["matrixEvidence", "rankEvidence"],
		examples: [{
			userGoal: "Find the highest or lowest cells in the matrix view.",
			params: {
				field: "value",
				direction: "max",
				limit: 5
			}
		}, buildQueryScopeExample({
			userGoal: "Find extreme cells inside one selected heatmap region.",
			params: {
				field: "value",
				direction: "max",
				limit: 5
			},
			widgetRef: "wl://demo/workspace/main/widget/heatmap_a",
			dataRef: "wl://demo/workspace/main/data/current_selection",
			selectionRef: "wl://demo/workspace/main/widget/heatmap_a/selection/region"
		})]
	}), makePerceptionDescriptor({
		name: "perception.findOutliers",
		title: "Find outliers",
		description: appendQueryScopeGuidance("Return likely outlier cells in the visible heatmap data."),
		category: "compute",
		targetRef: dataRef,
		paramsSchema: buildScopedPerceptionParamsSchema({
			field: { type: "string" },
			zThreshold: { type: "number" },
			limit: { type: "number" }
		}),
		sideEffectFree: true,
		evidenceKinds: ["outlierEvidence", "matrixEvidence"],
		examples: [{
			userGoal: "Identify suspicious cells in the current heatmap view.",
			params: {
				field: "value",
				zThreshold: 2.5,
				limit: 10
			}
		}, buildQueryScopeExample({
			userGoal: "Identify outlier cells inside one selected heatmap region.",
			params: {
				field: "value",
				zThreshold: 2.5,
				limit: 10
			},
			widgetRef: "wl://demo/workspace/main/widget/heatmap_a",
			dataRef: "wl://demo/workspace/main/data/current_selection",
			selectionRef: "wl://demo/workspace/main/widget/heatmap_a/selection/region"
		})]
	})];
}
function registerHeatmapPerceptionQueries(perceptionRegistry) {
	if (!perceptionRegistry.has("perception.findExtremes", { supportedWidgetKinds: ["heatmap"] })) perceptionRegistry.register({
		name: "perception.findExtremes",
		supportedWidgetKinds: ["heatmap"]
	}, async (call, ctx) => {
		const targetWidget = ctx.requireTargetWidget({ kind: "heatmap" });
		const params = ctx.readCallParams();
		const extremes = runDataPerceptionQuery({
			ctx,
			dataQueryExecutor: perceptionRegistry.dataQueryExecutor,
			targetWidget,
			kind: "findExtremes",
			spec: params
		});
		ctx.recordQuery({ affectedRefs: [targetWidget.ref] });
		return { result: buildPerceptionDataResult({
			dataQueryResult: extremes,
			fallbackDataRef: ctx.resolveRowsForWidget(targetWidget, params).dataRef
		}) };
	}, { supportedWidgetKinds: ["heatmap"] });
	if (!perceptionRegistry.has("perception.findOutliers", { supportedWidgetKinds: ["heatmap"] })) perceptionRegistry.register({
		name: "perception.findOutliers",
		supportedWidgetKinds: ["heatmap"]
	}, async (call, ctx) => {
		const targetWidget = ctx.requireTargetWidget({ kind: "heatmap" });
		const params = ctx.readCallParams();
		const outliers = runDataPerceptionQuery({
			ctx,
			dataQueryExecutor: perceptionRegistry.dataQueryExecutor,
			targetWidget,
			kind: "findOutliers",
			spec: params
		});
		ctx.recordQuery({ affectedRefs: [targetWidget.ref] });
		return { result: buildPerceptionDataResult({
			dataQueryResult: outliers,
			fallbackDataRef: ctx.resolveRowsForWidget(targetWidget, params).dataRef
		}) };
	}, { supportedWidgetKinds: ["heatmap"] });
}
//#endregion
//#region ../../widgetva-kit/src/widgets/families/heatmap/index.js
function clone$8(value) {
	return value == null ? value : JSON.parse(JSON.stringify(value));
}
var HEATMAP_LOCAL_SELECTION_CONTRACT = Object.freeze({
	localSelectionFamily: "cell",
	selectionKinds: ["cell", "region"],
	sourceActionNames: ["heatmap.selectCell", "heatmap.selectSubmatrix"],
	cardinality: "singleActiveSelection",
	selectionValueShape: "cellOrRegionCoordinates",
	observationFields: [
		"state.selections",
		"coordination.localSelectionRefs",
		"coordination.widgetSelectionRef",
		"selection.activeSelectionRef",
		"selection.activeSelectionKind",
		"selection.activeSelectionSummary",
		"selection.activeSelectionFields"
	],
	perceptionExpectations: ["selection-scoped perception queries should resolve either one cell or a selected submatrix subset", "selection summaries should distinguish cell selections from broader row/column region selections"]
});
var HEATMAP_VERIFICATION_CONTRACT = Object.freeze({
	preferredReadMethod: "readVerificationState",
	preferredObservationFields: [
		"verification.checks.selectionApplied",
		"verification.checks.filterApplied",
		"verification.checks.aggregateApplied",
		"verification.checks.drillDownApplied",
		"verification.checks.reencodeApplied",
		"verification.checks.navigateApplied",
		"verification.checks.highlightApplied",
		"verification.encodings.channels",
		"verification.view.aggregate",
		"verification.view.drillDown",
		"verification.view.reencode",
		"verification.view.navigate",
		"verification.view.highlight",
		"verification.selections.activeKinds"
	],
	supportedEffectTypes: [
		"selection",
		"filter",
		"aggregate",
		"drillDown",
		"reencode",
		"navigate",
		"highlight",
		"encoding",
		"linkedPropagation"
	],
	effectChecks: {
		selection: [
			"checks.selectionApplied",
			"selections.count",
			"selections.activeKinds",
			"selections.activeSummary"
		],
		filter: [
			"checks.filterApplied",
			"data.rowCount",
			"data.visibleCount",
			"transforms.kinds"
		],
		aggregate: [
			"checks.aggregateApplied",
			"view.aggregate",
			"view.sort"
		],
		drillDown: [
			"checks.drillDownApplied",
			"view.drillDown",
			"transforms.kinds"
		],
		reencode: [
			"checks.reencodeApplied",
			"view.reencode",
			"encodings.channels"
		],
		navigate: ["checks.navigateApplied", "view.navigate"],
		highlight: [
			"checks.highlightApplied",
			"view.highlight",
			"feedback.highlightKeyCount",
			"feedback.sharedSelectionSourceWidgetId"
		],
		encoding: [
			"checks.encodingReadable",
			"encodings.channels",
			"encodings.fieldsByChannel"
		],
		linkedPropagation: [
			"checks.linkedPropagationApplied",
			"feedback.linkedSourceRefCount",
			"feedback.sharedSelectionSourceWidgetId"
		]
	}
});
function describeHeatmapLocalSelectionContract() {
	return clone$8(HEATMAP_LOCAL_SELECTION_CONTRACT);
}
function describeHeatmapVerificationContract() {
	return clone$8(HEATMAP_VERIFICATION_CONTRACT);
}
function describeHeatmapWidgetContract() {
	return {
		kind: "heatmap",
		actionNames: [
			"heatmap.filterCells",
			"heatmap.selectCell",
			"heatmap.selectSubmatrix",
			"heatmap.drilldownAxis",
			"heatmap.resetDrilldown",
			"heatmap.addMarginalBars",
			"heatmap.highlightRegion",
			"heatmap.adjustColorScale",
			"heatmap.thresholdMask",
			"heatmap.filterCellsByRegion",
			"heatmap.highlightRegionByValue",
			"heatmap.clusterRowsCols",
			"heatmap.transpose"
		],
		perceptionNames: ["perception.findExtremes", "perception.findOutliers"],
		localSelection: describeHeatmapLocalSelectionContract(),
		verification: describeHeatmapVerificationContract()
	};
}
var heatmapFamily = Object.freeze({
	kind: "heatmap",
	describeContract: describeHeatmapWidgetContract,
	actions: Object.freeze({ buildDescriptors: buildHeatmapActionDescriptors }),
	perception: Object.freeze({
		buildDescriptors: buildHeatmapPerceptionDescriptors,
		register: registerHeatmapPerceptionQueries
	}),
	interactionProfile: Object.freeze({ getConfig: getHeatmapHumanInteractionConfig }),
	playbook: heatmapPlaybook
});
//#endregion
//#region ../../widgetva-kit/src/widgets/families/line/interactionProfile.js
function getLineHumanInteractionConfig() {
	return {
		mode: "categoryClick",
		actionName: "line.selectSeries",
		categoryFieldChannel: "color",
		supportsDirectManipulation: true
	};
}
//#endregion
//#region ../../widgetva-kit/src/widgets/families/line/playbook.js
var linePlaybook = {
	analysisToAction: [
		{
			goal: "Understand overall trend shape",
			workflow: "If the goal is to understand trend shape, first identify major phases such as rise, decline, plateau, or volatility, then zoom into the phase most relevant to the query.",
			candidateActions: ["line.zoomXRegion", "line.selectXValue"],
			candidatePerceptions: [
				"perception.findExtremes",
				"perception.compareGroups",
				"perception.detectAnomalies"
			]
		},
		{
			goal: "Explain a local peak, dip, or abrupt change",
			workflow: "If the goal is to explain a peak, dip, or structural break, first locate the turning region, then narrow to that interval and inspect it at higher resolution.",
			candidateActions: [
				"line.zoomXRegion",
				"line.selectXValue",
				"line.highlightTrend"
			],
			candidatePerceptions: ["perception.findExtremes", "perception.detectAnomalies"]
		},
		{
			goal: "Compare temporal patterns at different granularities",
			workflow: "If the goal is to compare annual, quarterly, monthly, or weekly behavior, resample the series to the relevant temporal grain and compare how the pattern changes across scales.",
			candidateActions: ["line.resampleXAxis", "line.resetResampleXAxis"],
			candidatePerceptions: ["perception.compareGroups", "perception.findExtremes"]
		},
		{
			goal: "Focus on only a subset of lines in a multi-line chart",
			workflow: "If the chart contains multiple lines but the query concerns only a subset, suppress irrelevant series and analyze the selected lines more clearly.",
			candidateActions: [
				"line.filterLines",
				"line.boldLines",
				"line.focusLines",
				"line.selectSeries"
			],
			candidatePerceptions: ["perception.compareGroups", "perception.detectAnomalies"]
		},
		{
			goal: "Compare different time windows",
			workflow: "If the goal is to compare periods, define meaningful intervals first and compare their level, slope, and variability rather than relying only on endpoints.",
			candidateActions: [
				"line.zoomXRegion",
				"line.selectXValue",
				"line.drillDownXAxis"
			],
			candidatePerceptions: ["perception.compareGroups", "perception.findExtremes"]
		}
	],
	workflows: [
		{
			name: "zoom_then_filter_series",
			analysisIntent: "Time-windowed entity comparison",
			scenarioExamples: ["During the selected period, which product category had the highest revenue?", "In the recent downturn window, which country contributed the most to the observed change?"],
			description: "Use when the comparison is limited to a time interval and only a subset of series matters.",
			steps: [
				{ action: "line.zoomXRegion" },
				{ action: "line.filterLines" },
				{ perception: "perception.compareGroups" }
			]
		},
		{
			name: "filter_series_then_zoom",
			analysisIntent: "Focused series inspection",
			scenarioExamples: ["For New Zealand among the selected countries, which year has the highest contribution value?", "For two chosen stock tickers, how do their prices behave during the crash period?"],
			description: "Use when the target series are known first and the question asks about their behavior in a time window.",
			steps: [
				{ action: "line.filterLines" },
				{ action: "line.zoomXRegion" },
				{ perception: "perception.compareGroups" }
			]
		},
		{
			name: "compare_time_granularities",
			analysisIntent: "Temporal granularity comparison",
			scenarioExamples: ["Do monthly, quarterly, and annual visitor trends tell the same story?", "Does stock volatility remain visible after resampling daily prices to monthly averages?"],
			description: "Use when the task asks how monthly, quarterly, annual, or other resampled trends differ.",
			steps: [
				{ action: "line.resampleXAxis" },
				{ action: "line.resampleXAxis" },
				{ perception: "perception.compareGroups" }
			]
		},
		{
			name: "zoom_then_smooth",
			analysisIntent: "Smoothed local trend reading",
			scenarioExamples: ["In the latter half of the time series, what is the lowest point of the smoothed visitor trend?", "During the unstable usage period, does the moving average show a real decline or just noise?"],
			description: "Use when a local peak, dip, or noisy interval needs a smoothed reading.",
			steps: [
				{ action: "line.zoomXRegion" },
				{ action: "line.showMovingAverage" },
				{ perception: "perception.findExtremes" }
			]
		},
		{
			name: "smooth_then_highlight_trend",
			analysisIntent: "Noise-reduced trend direction",
			scenarioExamples: ["After smoothing electricity access over time, does the trend mainly increase or plateau?", "Once short-term volatility is reduced, which segment shows a sustained decline?"],
			description: "Use when the task asks for trend direction after reducing short-term noise.",
			steps: [
				{ action: "line.showMovingAverage" },
				{ action: "line.highlightTrend" },
				{ perception: "perception.compareGroups" }
			]
		},
		{
			name: "detect_anomalies_then_resample",
			analysisIntent: "Anomaly stability across time scales",
			scenarioExamples: ["Are unusual stock-price movements still visible after comparing daily and monthly views?", "Do visitor spikes remain meaningful when the series is aggregated from months to years?"],
			description: "Use when unusual events should be checked against a coarser or finer time grain.",
			steps: [
				{ perception: "perception.detectAnomalies" },
				{ action: "line.resampleXAxis" },
				{ perception: "perception.compareGroups" }
			]
		},
		{
			name: "zoom_then_detect_anomalies",
			analysisIntent: "Interval-specific anomaly search",
			scenarioExamples: ["Within the high AI-usage window, are there unusual jumps in bug count?", "During the selected sales campaign period, which weeks are anomalous?"],
			description: "Use when anomaly detection should be restricted to one relevant interval.",
			steps: [{ action: "line.zoomXRegion" }, { perception: "perception.detectAnomalies" }]
		}
	],
	multiTurnStrategy: [
		"First decide whether the query is about the global trend or a local interval.",
		"If the query is global, summarize the major phases before narrowing further.",
		"If the query is local, zoom or resample before reading the relevant interval in detail.",
		"If multiple lines are present, reduce clutter before comparing the specific series that matter.",
		"Stop when the selected interval or series subset is specific enough to support a direct answer."
	]
};
//#endregion
//#region ../../widgetva-kit/src/widgets/families/line/actionDescriptors.js
var DESCRIPTORS$2 = [
	{
		"name": "line.selectSeries",
		"description": "Select one or more categorical series represented in the line chart.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"field": { "type": "string" },
				"values": {
					"type": "array",
					"items": { "anyOf": [{ "type": "string" }, { "type": "number" }] }
				},
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["field", "values"]
		},
		"examples": [{
			"userGoal": "Focus one or more line series before comparing trends.",
			"params": {
				"field": "Origin",
				"values": ["Japan"]
			}
		}]
	},
	{
		"name": "line.selectXValue",
		"description": "Select all visible line rows that share one x-axis value, such as one year or one named category bucket.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"value": { "anyOf": [{ "type": "string" }, { "type": "number" }] },
				"field": { "type": "string" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["value"]
		},
		"examples": [{
			"userGoal": "Select one model year across the line view before checking linked distributions and details.",
			"params": {
				"field": "year",
				"value": 1971
			}
		}]
	},
	{
		"name": "line.zoomXRegion",
		"description": "Zoom the temporal x-axis of the line chart to a specific start/end range without discarding data.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"start": { "type": "string" },
				"end": { "type": "string" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["start", "end"]
		},
		"examples": [{
			"userGoal": "Zoom into a particular date range to inspect the detailed trend.",
			"params": {
				"start": "2024-01-01",
				"end": "2024-02-01"
			}
		}]
	},
	{
		"name": "line.focusLines",
		"description": "Emphasize one or more line series while dimming the remaining lines.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"lines": {
					"type": "array",
					"items": { "type": "string" }
				},
				"lineField": { "type": "string" },
				"dimOpacity": { "type": "number" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["lines"]
		},
		"examples": [{
			"userGoal": "Focus a subset of line series before comparing their trends.",
			"params": {
				"lines": ["A"],
				"lineField": "series",
				"dimOpacity": .08
			}
		}]
	},
	{
		"name": "line.highlightTrend",
		"description": "Add or refresh a regression trend line layer over the existing line chart.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"trendType": { "type": "string" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			}
		},
		"examples": [{
			"userGoal": "Add a regression overlay before describing the overall trend direction.",
			"params": { "trendType": "increasing" }
		}]
	},
	{
		"name": "line.showMovingAverage",
		"description": "Add or replace a moving-average overlay line computed from the current temporal/value encodings, optionally grouped by line series.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"windowSize": { "type": "number" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			}
		},
		"examples": [{
			"userGoal": "Smooth a noisy line chart with a 3-period trailing moving average.",
			"params": { "windowSize": 3 }
		}]
	},
	{
		"name": "line.drillDownXAxis",
		"description": "Drill a temporal line chart from a coarser time aggregation into a more detailed x-axis view.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"level": { "type": "string" },
				"value": { "type": "number" },
				"parent": { "type": "object" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["level", "value"]
		},
		"examples": [{
			"userGoal": "Drill a yearly trend into monthly detail for a specific year.",
			"params": {
				"level": "year",
				"value": 2024
			}
		}]
	},
	{
		"name": "line.resetDrilldownXAxis",
		"description": "Restore the original line chart encoding, transforms, and title after a temporal drill-down.",
		"paramsSchema": {
			"type": "object",
			"properties": { "queryScope": {
				"type": "object",
				"additionalProperties": false,
				"properties": {
					"dataRef": { "type": "string" },
					"selectionRef": { "type": "string" },
					"focusRef": { "type": "string" },
					"viewportRef": { "type": "string" }
				}
			} }
		},
		"examples": [{
			"userGoal": "Return from a drilled monthly view back to the original yearly chart.",
			"params": {}
		}]
	},
	{
		"name": "line.resampleXAxis",
		"description": "Change the temporal aggregation granularity of a line chart and apply an aggregate to the value axis.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"granularity": { "type": "string" },
				"agg": { "type": "string" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["granularity"]
		},
		"examples": [{
			"userGoal": "Switch a dense daily series into monthly mean values before comparing long-term trends.",
			"params": {
				"granularity": "month",
				"agg": "mean"
			}
		}]
	},
	{
		"name": "line.resetResampleXAxis",
		"description": "Restore the original temporal encoding after a line x-axis resampling operation.",
		"paramsSchema": {
			"type": "object",
			"properties": { "queryScope": {
				"type": "object",
				"additionalProperties": false,
				"properties": {
					"dataRef": { "type": "string" },
					"selectionRef": { "type": "string" },
					"focusRef": { "type": "string" },
					"viewportRef": { "type": "string" }
				}
			} }
		},
		"examples": [{
			"userGoal": "Return a resampled monthly line chart back to its original daily granularity.",
			"params": {}
		}]
	},
	{
		"name": "line.boldLines",
		"description": "Increase the stroke width of one or more line series while keeping the remaining lines thin.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"lineNames": {
					"type": "array",
					"items": { "type": "string" }
				},
				"lineField": { "type": "string" },
				"boldWidth": { "type": "number" },
				"baseWidth": { "type": "number" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["lineNames"]
		},
		"examples": [{
			"userGoal": "Make one or more line series stand out before comparing the trends.",
			"params": {
				"lineNames": ["A"],
				"lineField": "series",
				"boldWidth": 4,
				"baseWidth": 1
			}
		}]
	},
	{
		"name": "line.filterLines",
		"description": "Exclude one or more line series from the current chart by writing a series filter into the line spec.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"linesToRemove": {
					"type": "array",
					"items": { "type": "string" }
				},
				"lineField": { "type": "string" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["linesToRemove"]
		},
		"examples": [{
			"userGoal": "Remove noisy or irrelevant series before comparing the remaining trends.",
			"params": {
				"linesToRemove": ["B"],
				"lineField": "series"
			}
		}]
	}
];
function clone$7(value) {
	return value == null ? value : JSON.parse(JSON.stringify(value));
}
function rootEncoding(spec) {
	return spec?.layer?.[0]?.encoding || spec?.encoding || {};
}
function inferRawTimeField(spec, encoding, transforms) {
	const timeUnitTransform = (Array.isArray(transforms) ? transforms : []).find((transform) => transform && typeof transform === "object" && transform.timeUnit);
	if (timeUnitTransform?.field) return timeUnitTransform.field;
	const xField = encoding?.x?.field;
	return typeof xField === "string" && xField.length > 0 ? xField : null;
}
function inferRawValueField(spec, encoding, transforms) {
	const aggregateTransform = (Array.isArray(transforms) ? transforms : []).find((transform) => transform && typeof transform === "object" && Array.isArray(transform.aggregate) && transform.aggregate.length > 0);
	if (aggregateTransform?.aggregate?.[0]?.field) return aggregateTransform.aggregate[0].field;
	const yField = encoding?.y?.field;
	return typeof yField === "string" && yField.length > 0 ? yField.replace(/^total_/, "").replace(/^sum_/, "") : null;
}
function lineCapabilities(spec) {
	const encoding = rootEncoding(spec);
	const transforms = Array.isArray(spec?.transform) ? spec.transform : [];
	const xField = typeof encoding?.x?.field === "string" && encoding.x.field.length > 0 ? encoding.x.field : null;
	const yField = typeof encoding?.y?.field === "string" && encoding.y.field.length > 0 ? encoding.y.field : null;
	const groupingField = typeof encoding?.color?.field === "string" && encoding.color.field.length > 0 ? encoding.color.field : typeof encoding?.detail?.field === "string" && encoding.detail.field.length > 0 ? encoding.detail.field : null;
	const hasTemporalAxis = encoding?.x?.type === "temporal" || encoding?.y?.type === "temporal" || typeof encoding?.x?.timeUnit === "string" || typeof encoding?.y?.timeUnit === "string";
	return {
		hasXField: Boolean(xField),
		hasXYFields: Boolean(xField && yField),
		hasGroupingField: Boolean(groupingField),
		hasTemporalAxis,
		hasDrilldownFields: Boolean(inferRawTimeField(spec, encoding, transforms) && inferRawValueField(spec, encoding, transforms))
	};
}
function filterDescriptorsBySpec$2(descriptors, widgetSpec) {
	if (!widgetSpec) return descriptors;
	const { hasXField, hasXYFields, hasGroupingField, hasTemporalAxis, hasDrilldownFields } = lineCapabilities(widgetSpec);
	return descriptors.filter((descriptor) => {
		if (!descriptor?.name) return true;
		if (descriptor.name === "line.selectXValue" || descriptor.name === "line.zoomXRegion") return hasXField;
		if (descriptor.name === "line.focusLines" || descriptor.name === "line.boldLines" || descriptor.name === "line.filterLines") return hasGroupingField;
		if (descriptor.name === "line.highlightTrend" || descriptor.name === "line.showMovingAverage") return hasXYFields;
		if (descriptor.name === "line.drillDownXAxis" || descriptor.name === "line.resetDrilldownXAxis") return hasTemporalAxis && hasDrilldownFields;
		if (descriptor.name === "line.resampleXAxis" || descriptor.name === "line.resetResampleXAxis") return hasTemporalAxis;
		return true;
	});
}
function buildLineActionDescriptors({ widgetSpec = null } = {}) {
	return filterDescriptorsBySpec$2(DESCRIPTORS$2, widgetSpec).map(clone$7);
}
//#endregion
//#region ../../widgetva-kit/src/widgets/families/line/perception.js
function inferFieldFromSpec(rawSpec, channel) {
	if (rawSpec?.encoding?.[channel]?.field) return rawSpec.encoding[channel].field;
	if (Array.isArray(rawSpec?.layer) && rawSpec.layer.length > 0) {
		for (const layer of rawSpec.layer) if (layer?.encoding?.[channel]?.field) return layer.encoding[channel].field;
	}
	return null;
}
function buildLineAnomalyResult({ rows, rawSpec, threshold = 2, yField = null, xField = null }) {
	const resolvedYField = yField || inferFieldFromSpec(rawSpec, "y");
	const resolvedXField = xField || inferFieldFromSpec(rawSpec, "x");
	if (!resolvedYField) throw new Error("perception.detectAnomalies requires a yField or a line spec with an encoded y field.");
	const numericValues = rows.map((row) => Number(row?.[resolvedYField])).filter((value) => Number.isFinite(value));
	if (numericValues.length < 3) throw new Error("perception.detectAnomalies requires at least 3 numeric values.");
	const mean = numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
	const variance = numericValues.reduce((sum, value) => {
		const delta = value - mean;
		return sum + delta * delta;
	}, 0) / numericValues.length;
	const std = Math.sqrt(variance);
	const anomalies = rows.filter((row) => {
		const value = Number(row?.[resolvedYField]);
		return Number.isFinite(value) && Math.abs(value - mean) > threshold * std;
	}).map((row) => ({
		...resolvedXField && row?.[resolvedXField] != null ? { [resolvedXField]: row[resolvedXField] } : {},
		[resolvedYField]: row?.[resolvedYField]
	}));
	return {
		operation: "detect_anomalies",
		anomaly_count: anomalies.length,
		anomalies: anomalies.slice(0, 10),
		stats: {
			mean: Math.round(mean * 100) / 100,
			std: Math.round(std * 100) / 100,
			threshold,
			sample_size: numericValues.length,
			yField: resolvedYField,
			xField: resolvedXField
		},
		message: `Detected ${anomalies.length} anomalies (threshold=${threshold} std)`
	};
}
function buildLinePerceptionDescriptors({ dataRef }) {
	return [
		makePerceptionDescriptor({
			name: "perception.detectAnomalies",
			title: "Detect anomalies",
			description: appendQueryScopeGuidance("Detect likely anomalous points in the visible line data using a standard-deviation threshold on the y metric."),
			category: "compute",
			targetRef: dataRef,
			paramsSchema: buildScopedPerceptionParamsSchema({
				threshold: { type: "number" },
				yField: { type: "string" },
				xField: { type: "string" }
			}),
			sideEffectFree: true,
			evidenceKinds: ["outlierEvidence", "trendEvidence"],
			examples: [{
				userGoal: "Identify likely anomalous line points without changing the chart encoding.",
				params: { threshold: 2 }
			}, buildQueryScopeExample({
				userGoal: "Detect anomalies inside one selected line subset.",
				params: { threshold: 2 },
				widgetRef: "wl://demo/workspace/main/widget/line_a",
				dataRef: "wl://demo/workspace/main/data/current_selection",
				selectionRef: "wl://demo/workspace/main/widget/line_a/selection/current"
			})]
		}),
		makePerceptionDescriptor({
			name: "perception.findExtremes",
			title: "Find extremes",
			description: appendQueryScopeGuidance("Return top-k or bottom-k visible rows by a numeric field in the line view."),
			category: "compute",
			targetRef: dataRef,
			paramsSchema: buildScopedPerceptionParamsSchema({
				field: { type: "string" },
				direction: { type: "string" },
				limit: { type: "number" }
			}),
			sideEffectFree: true,
			evidenceKinds: ["trendEvidence", "rankEvidence"],
			examples: [{
				userGoal: "Find extrema in the visible line series data.",
				params: {
					field: "Miles_per_Gallon",
					direction: "max",
					limit: 5
				}
			}, buildQueryScopeExample({
				userGoal: "Find extremes inside one selected line subset.",
				params: {
					field: "Miles_per_Gallon",
					direction: "max",
					limit: 5
				},
				widgetRef: "wl://demo/workspace/main/widget/line_a",
				dataRef: "wl://demo/workspace/main/data/current_selection",
				selectionRef: "wl://demo/workspace/main/widget/line_a/selection/current"
			})]
		}),
		makePerceptionDescriptor({
			name: "perception.compareGroups",
			title: "Compare groups",
			description: appendQueryScopeGuidance("Compare grouped trend values in the visible line data."),
			category: "compute",
			targetRef: dataRef,
			paramsSchema: buildScopedPerceptionParamsSchema({
				groupField: { type: "string" },
				valueField: { type: "string" },
				groups: {
					type: "array",
					items: { type: "string" }
				}
			}),
			sideEffectFree: true,
			evidenceKinds: ["groupComparison", "trendEvidence"],
			examples: [{
				userGoal: "Compare the trends or magnitudes of a few line groups.",
				params: {
					groupField: "Origin",
					valueField: "Miles_per_Gallon",
					groups: ["Japan", "USA"]
				}
			}, buildQueryScopeExample({
				userGoal: "Compare grouped line values inside one selected subset.",
				params: {
					groupField: "Origin",
					valueField: "Miles_per_Gallon",
					groups: ["Japan", "USA"]
				},
				widgetRef: "wl://demo/workspace/main/widget/line_a",
				dataRef: "wl://demo/workspace/main/data/current_selection",
				selectionRef: "wl://demo/workspace/main/widget/line_a/selection/current"
			})]
		})
	];
}
function registerLinePerceptionQueries(perceptionRegistry) {
	if (!perceptionRegistry.has("perception.detectAnomalies", { supportedWidgetKinds: ["line"] })) perceptionRegistry.register({
		name: "perception.detectAnomalies",
		supportedWidgetKinds: ["line"]
	}, async (call, ctx) => {
		const targetWidget = ctx.requireTargetWidget({ kind: "line" });
		const params = ctx.readCallParams();
		const { rows } = ctx.resolveRowsForWidget(targetWidget, params);
		const result = buildLineAnomalyResult({
			rows,
			rawSpec: targetWidget?.rawSpec || targetWidget?.spec || null,
			threshold: Number.isFinite(params?.threshold) ? Number(params.threshold) : 2,
			yField: params?.yField || null,
			xField: params?.xField || null
		});
		ctx.recordQuery({ affectedRefs: [targetWidget.ref] });
		return { result };
	}, { supportedWidgetKinds: ["line"] });
	if (!perceptionRegistry.has("perception.findExtremes", { supportedWidgetKinds: ["line"] })) perceptionRegistry.register({
		name: "perception.findExtremes",
		supportedWidgetKinds: ["line"]
	}, async (call, ctx) => {
		const targetWidget = ctx.requireTargetWidget({ kind: "line" });
		const params = ctx.readCallParams();
		const extremes = runDataPerceptionQuery({
			ctx,
			dataQueryExecutor: perceptionRegistry.dataQueryExecutor,
			targetWidget,
			kind: "findExtremes",
			spec: params
		});
		ctx.recordQuery({ affectedRefs: [targetWidget.ref] });
		return { result: buildPerceptionDataResult({
			dataQueryResult: extremes,
			fallbackDataRef: ctx.resolveRowsForWidget(targetWidget, params).dataRef
		}) };
	}, { supportedWidgetKinds: ["line"] });
	if (!perceptionRegistry.has("perception.compareGroups", { supportedWidgetKinds: ["line"] })) perceptionRegistry.register({
		name: "perception.compareGroups",
		supportedWidgetKinds: ["line"]
	}, async (call, ctx) => {
		const targetWidget = ctx.requireTargetWidget({ kind: "line" });
		const params = ctx.readCallParams();
		const comparison = runDataPerceptionQuery({
			ctx,
			dataQueryExecutor: perceptionRegistry.dataQueryExecutor,
			targetWidget,
			kind: "compareGroups",
			spec: params
		});
		ctx.recordQuery({ affectedRefs: [targetWidget.ref] });
		return { result: buildPerceptionDataResult({
			dataQueryResult: comparison,
			fallbackDataRef: ctx.resolveRowsForWidget(targetWidget, params).dataRef
		}) };
	}, { supportedWidgetKinds: ["line"] });
}
//#endregion
//#region ../../widgetva-kit/src/widgets/families/line/index.js
function clone$6(value) {
	return value == null ? value : JSON.parse(JSON.stringify(value));
}
var LINE_LOCAL_SELECTION_CONTRACT = Object.freeze({
	localSelectionFamily: "category",
	selectionKinds: ["category", "point"],
	sourceActionNames: ["line.selectSeries", "line.selectXValue"],
	cardinality: "singleActiveSelection",
	selectionValueShape: "categoricalValues",
	observationFields: [
		"state.selections",
		"coordination.localSelectionRefs",
		"coordination.widgetSelectionRef",
		"selection.activeSelectionRef",
		"selection.activeSelectionKind",
		"selection.activeSelectionSummary"
	],
	perceptionExpectations: ["selection-scoped perception queries should resolve the currently selected line series subset", "selection summaries should preserve the selected series identity for downstream comparison and anomaly checks"]
});
var LINE_VERIFICATION_CONTRACT = Object.freeze({
	preferredReadMethod: "readVerificationState",
	preferredObservationFields: [
		"verification.checks.selectionApplied",
		"verification.checks.filterApplied",
		"verification.checks.aggregateApplied",
		"verification.checks.drillDownApplied",
		"verification.checks.focusApplied",
		"verification.checks.navigateApplied",
		"verification.checks.zoomApplied",
		"verification.checks.highlightApplied",
		"verification.encodings.channels",
		"verification.view.aggregate",
		"verification.view.drillDown",
		"verification.view.focusKeys",
		"verification.view.reencode",
		"verification.view.navigate",
		"verification.view.highlight",
		"verification.transforms.kinds"
	],
	supportedEffectTypes: [
		"selection",
		"filter",
		"aggregate",
		"drillDown",
		"focus",
		"reencode",
		"navigate",
		"zoom",
		"highlight",
		"encoding",
		"linkedPropagation"
	],
	effectChecks: {
		selection: [
			"checks.selectionApplied",
			"selections.count",
			"selections.activeSummary"
		],
		filter: [
			"checks.filterApplied",
			"data.rowCount",
			"data.visibleCount",
			"transforms.kinds"
		],
		aggregate: [
			"checks.aggregateApplied",
			"view.aggregate",
			"encodings.aggregateChannels"
		],
		drillDown: [
			"checks.drillDownApplied",
			"view.drillDown",
			"transforms.kinds"
		],
		focus: ["checks.focusApplied", "view.focusKeys"],
		reencode: [
			"checks.reencodeApplied",
			"view.reencode",
			"encodings.channels"
		],
		navigate: ["checks.navigateApplied", "view.navigate"],
		zoom: [
			"checks.zoomApplied",
			"view.xDomain",
			"view.zoom"
		],
		highlight: [
			"checks.highlightApplied",
			"view.highlight",
			"feedback.highlightKeyCount",
			"feedback.sharedSelectionSourceWidgetId"
		],
		encoding: [
			"checks.encodingReadable",
			"encodings.channels",
			"encodings.fieldsByChannel"
		],
		linkedPropagation: [
			"checks.linkedPropagationApplied",
			"feedback.linkedSourceRefCount",
			"feedback.sharedSelectionSourceWidgetId"
		]
	}
});
function describeLineLocalSelectionContract() {
	return clone$6(LINE_LOCAL_SELECTION_CONTRACT);
}
function describeLineVerificationContract() {
	return clone$6(LINE_VERIFICATION_CONTRACT);
}
function describeLineWidgetContract() {
	return {
		kind: "line",
		actionNames: [
			"line.selectSeries",
			"line.selectXValue",
			"line.zoomXRegion",
			"line.focusLines",
			"line.highlightTrend",
			"line.showMovingAverage",
			"line.drillDownXAxis",
			"line.resetDrilldownXAxis",
			"line.resampleXAxis",
			"line.resetResampleXAxis",
			"line.boldLines",
			"line.filterLines"
		],
		perceptionNames: [
			"perception.detectAnomalies",
			"perception.findExtremes",
			"perception.compareGroups"
		],
		localSelection: describeLineLocalSelectionContract(),
		verification: describeLineVerificationContract()
	};
}
var lineFamily = Object.freeze({
	kind: "line",
	describeContract: describeLineWidgetContract,
	actions: Object.freeze({ buildDescriptors: buildLineActionDescriptors }),
	perception: Object.freeze({
		buildDescriptors: buildLinePerceptionDescriptors,
		register: registerLinePerceptionQueries
	}),
	interactionProfile: Object.freeze({ getConfig: getLineHumanInteractionConfig }),
	playbook: linePlaybook
});
//#endregion
//#region ../../widgetva-kit/src/widgets/families/parallelCoordinates/interactionProfile.js
function getParallelCoordinatesHumanInteractionConfig() {
	return {
		mode: "multiBrush",
		actionName: "parallelCoordinates.brushAxes",
		supportsDirectManipulation: true
	};
}
//#endregion
//#region ../../widgetva-kit/src/widgets/families/parallelCoordinates/playbook.js
var parallelCoordinatesPlaybook = {
	analysisToAction: [
		{
			goal: "Identify a coherent subgroup",
			workflow: "If the goal is to identify a subgroup with a shared multi-dimensional profile, first find a subset through axis brushing or category filtering, then inspect it across dimensions.",
			candidateActions: [
				"parallelCoordinates.brushAxes",
				"parallelCoordinates.filterDimension",
				"parallelCoordinates.filterByCategory",
				"parallelCoordinates.selectRecord"
			],
			candidatePerceptions: ["perception.findOutliers"]
		},
		{
			goal: "Detect anomalous profiles",
			workflow: "If the goal is to find unusual records, isolate lines that diverge sharply from the dominant bundles and compare them against the main population.",
			candidateActions: [
				"parallelCoordinates.selectRecord",
				"parallelCoordinates.brushAxes",
				"parallelCoordinates.filterDimension"
			],
			candidatePerceptions: ["perception.findOutliers"]
		},
		{
			goal: "Analyze behavior by category",
			workflow: "If the goal is to analyze a category-defined subgroup, filter or highlight the relevant categories first, then inspect how their paths move across axes.",
			candidateActions: ["parallelCoordinates.filterByCategory", "parallelCoordinates.highlightCategory"],
			candidatePerceptions: ["perception.findOutliers"]
		},
		{
			goal: "Inspect the relationship between specific axes",
			workflow: "If the goal is to inspect the relationship between two dimensions, bring those axes next to each other and reduce clutter from unrelated axes before interpreting crossings or separation.",
			candidateActions: [
				"parallelCoordinates.reorderDimensions",
				"parallelCoordinates.hideDimensions",
				"parallelCoordinates.resetHiddenDimensions"
			],
			candidatePerceptions: ["perception.findOutliers"]
		},
		{
			goal: "Define a subgroup through multi-axis constraints",
			workflow: "If the goal is to understand a subgroup defined by several constraints, constrain one or more decisive axes first, then inspect how the surviving subset behaves on the remaining dimensions.",
			candidateActions: ["parallelCoordinates.brushAxes", "parallelCoordinates.filterDimension"],
			candidatePerceptions: ["perception.findOutliers"]
		}
	],
	workflows: [
		{
			name: "filter_category_then_reorder_dimensions",
			analysisIntent: "Subgroup profile across reordered dimensions",
			scenarioExamples: ["For one penguin species, how does beak depth relate to flipper length after placing those axes together?", "For the northwest insurance region, does BMI show a clear relationship with charges after reordering dimensions?"],
			description: "Use when the task asks how a category-defined subgroup relates across a few key dimensions.",
			steps: [
				{ action: "parallelCoordinates.filterByCategory" },
				{ action: "parallelCoordinates.reorderDimensions" },
				{ perception: "perception.findOutliers" }
			]
		},
		{
			name: "filter_category_then_filter_category",
			analysisIntent: "Multi-constraint cohort profiling",
			scenarioExamples: ["How do Series A and Series C startup periods exhibit similar funding patterns after filtering each group?", "After narrowing to two retail channels, how do discount and final price patterns compare?"],
			description: "Use when several categorical constraints define the subgroup before reading the path pattern.",
			steps: [
				{ action: "parallelCoordinates.filterByCategory" },
				{ action: "parallelCoordinates.filterByCategory" },
				{ perception: "perception.findOutliers" }
			]
		},
		{
			name: "hide_dimensions_then_filter_category",
			analysisIntent: "Low-clutter subgroup comparison",
			scenarioExamples: ["After keeping only weight and calories axes, which workout type burns more calories at similar weights?", "After hiding unrelated axes, how do selected game genres distribute during platform development?"],
			description: "Use when only a few axes are relevant and the subgroup should be isolated after reducing visual clutter.",
			steps: [
				{ action: "parallelCoordinates.hideDimensions" },
				{ action: "parallelCoordinates.filterByCategory" },
				{ perception: "perception.findOutliers" }
			]
		},
		{
			name: "filter_category_then_hide_dimensions",
			analysisIntent: "Known subgroup profile simplification",
			scenarioExamples: ["For chocolate-free candies, is there a clear relationship between sugar percent and win percent after irrelevant axes are hidden?", "For high-importance products, do discount and prior-purchase patterns remain visible after simplifying the axes?"],
			description: "Use when the subgroup is known first and then irrelevant axes should be removed to read its profile.",
			steps: [
				{ action: "parallelCoordinates.filterByCategory" },
				{ action: "parallelCoordinates.hideDimensions" },
				{ perception: "perception.findOutliers" }
			]
		},
		{
			name: "highlight_category_then_reorder_dimensions",
			analysisIntent: "Highlighted category trajectory comparison",
			scenarioExamples: ["After highlighting the AI-usage category, how does study hour impact appear across adjacent score dimensions?", "For highlighted candy categories, does sugar percent align with win percent after reordering axes?"],
			description: "Use when the task needs comparison of highlighted category paths after putting key axes next to each other.",
			steps: [
				{ action: "parallelCoordinates.highlightCategory" },
				{ action: "parallelCoordinates.reorderDimensions" },
				{ perception: "perception.findOutliers" }
			]
		},
		{
			name: "hide_dimensions_then_reorder_dimensions",
			analysisIntent: "Focused dimension relationship reading",
			scenarioExamples: ["How does AI tool usage relate to code complexity compared with bug count after hiding unrelated dimensions?", "Do selected health measures move together once only the relevant axes are visible and adjacent?"],
			description: "Use when the task asks for relationship reading between specific axes and the full chart is too cluttered.",
			steps: [
				{ action: "parallelCoordinates.hideDimensions" },
				{ action: "parallelCoordinates.reorderDimensions" },
				{ perception: "perception.findOutliers" }
			]
		}
	],
	multiTurnStrategy: [
		"First decide whether the query is about subgroup discovery, anomaly detection, category comparison, or dimension-relationship reading.",
		"If category matters, separate the relevant category before interpreting path structure.",
		"If the relationship between dimensions matters, reorder axes before reading crossings or aligned trends.",
		"If clutter is too high, collapse or suppress irrelevant dimensions before continuing.",
		"Stop when the selected subgroup or adjacent-axis relationship is clear enough to answer the query directly."
	]
};
//#endregion
//#region ../../widgetva-kit/src/widgets/families/parallelCoordinates/actionDescriptors.js
var DESCRIPTORS$1 = [
	{
		"name": "parallelCoordinates.brushAxes",
		"description": "Select rows whose values fall inside one or more axis-aligned numeric ranges.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"rules": {
					"type": "array",
					"minItems": 1,
					"items": {
						"type": "object",
						"properties": {
							"field": { "type": "string" },
							"range": {
								"type": "array",
								"items": { "type": "number" },
								"minItems": 2,
								"maxItems": 2
							}
						},
						"required": ["field", "range"]
					}
				},
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["rules"]
		},
		"examples": [{
			"userGoal": "Restrict analysis to a multivariate value corridor.",
			"params": { "rules": [{
				"field": "Horsepower",
				"range": [80, 160]
			}, {
				"field": "Weight_in_lbs",
				"range": [1800, 3200]
			}] }
		}]
	},
	{
		"name": "parallelCoordinates.selectRecord",
		"description": "Select one visible record by id so linked views can focus or compare that record without needing a brush gesture.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"recordId": { "anyOf": [{ "type": "string" }, { "type": "number" }] },
				"field": { "type": "string" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["recordId"]
		},
		"examples": [{
			"userGoal": "Select one car record in the parallel view before checking the same car across other linked views.",
			"params": {
				"field": "id",
				"recordId": "toyota-corona-mark-ii"
			}
		}]
	},
	{
		"name": "parallelCoordinates.reorderDimensions",
		"description": "Reorder the visible dimension axes of a parallel coordinates view by rewriting the fold order and matching x-axis domain metadata.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"dimensionOrder": {
					"type": "array",
					"minItems": 1,
					"items": { "type": "string" }
				},
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["dimensionOrder"]
		},
		"examples": [{
			"userGoal": "Move the most important dimensions to the front before comparing multivariate trends.",
			"params": { "dimensionOrder": [
				"Weight",
				"Horsepower",
				"Miles_per_Gallon"
			] }
		}]
	},
	{
		"name": "parallelCoordinates.filterDimension",
		"description": "Filter rows by a numeric range on one named dimension, inserting the predicate before the fold stage when the view is defined in wide format.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"dimension": { "type": "string" },
				"range": {
					"type": "array",
					"minItems": 2,
					"maxItems": 2,
					"items": { "type": "number" }
				},
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["dimension", "range"]
		},
		"examples": [{
			"userGoal": "Keep only rows whose horsepower falls inside a specific corridor before comparing the remaining multivariate trajectories.",
			"params": {
				"dimension": "Horsepower",
				"range": [80, 160]
			}
		}]
	},
	{
		"name": "parallelCoordinates.filterByCategory",
		"description": "Exclude rows whose category field matches one or more requested values, inserting the predicate before the fold stage when the view is defined in wide format.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"field": { "type": "string" },
				"values": { "oneOf": [{ "type": "string" }, {
					"type": "array",
					"minItems": 1,
					"items": { "type": "string" }
				}] },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["field", "values"]
		},
		"examples": [{
			"userGoal": "Exclude one or more categories before comparing the remaining multivariate trajectories.",
			"params": {
				"field": "Origin",
				"values": ["USA", "Japan"]
			}
		}]
	},
	{
		"name": "parallelCoordinates.highlightCategory",
		"description": "Visually emphasize one or more category values by keeping matching trajectories fully opaque and dimming the rest.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"field": { "type": "string" },
				"values": { "oneOf": [{ "type": "string" }, {
					"type": "array",
					"minItems": 1,
					"items": { "type": "string" }
				}] },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["field", "values"]
		},
		"examples": [{
			"userGoal": "Highlight a few categories before comparing their multivariate trajectories against the background population.",
			"params": {
				"field": "Origin",
				"values": ["USA", "Japan"]
			}
		}]
	},
	{
		"name": "parallelCoordinates.hideDimensions",
		"description": "Temporarily hide one or more dimensions from a parallel coordinates view while preserving the original full dimension order for later restoration.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"dimensions": {
					"type": "array",
					"minItems": 1,
					"items": { "type": "string" }
				},
				"mode": {
					"type": "string",
					"enum": ["hide", "show"]
				},
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["dimensions"]
		},
		"examples": [{
			"userGoal": "Temporarily hide weight from a crowded parallel-coordinates view.",
			"params": { "dimensions": ["Weight"] }
		}, {
			"userGoal": "Restore one previously hidden dimension without resetting the full view.",
			"params": {
				"dimensions": ["Weight"],
				"mode": "show"
			}
		}]
	},
	{
		"name": "parallelCoordinates.resetHiddenDimensions",
		"description": "Restore the full original dimension order after one or more dimensions have been hidden from a parallel coordinates view.",
		"paramsSchema": {
			"type": "object",
			"properties": { "queryScope": {
				"type": "object",
				"additionalProperties": false,
				"properties": {
					"dataRef": { "type": "string" },
					"selectionRef": { "type": "string" },
					"focusRef": { "type": "string" },
					"viewportRef": { "type": "string" }
				}
			} }
		},
		"examples": [{
			"userGoal": "Restore every temporarily hidden dimension after a focused inspection pass.",
			"params": {}
		}]
	}
];
function clone$5(value) {
	return value == null ? value : JSON.parse(JSON.stringify(value));
}
function parallelCoordinatesCapabilities(spec) {
	const foldTransform = (Array.isArray(spec?.transform) ? spec.transform : []).find((transform) => transform && typeof transform === "object" && Array.isArray(transform.fold));
	const hiddenState = spec?._pc_hidden_state && typeof spec._pc_hidden_state === "object" ? spec._pc_hidden_state : null;
	const allDimensions = Array.isArray(hiddenState?.all_dimensions) && hiddenState.all_dimensions.length > 0 ? hiddenState.all_dimensions : Array.isArray(foldTransform?.fold) ? foldTransform.fold : [];
	return {
		hasDimensionList: Array.isArray(allDimensions) && allDimensions.length > 0,
		hasHiddenDimensionsState: Array.isArray(hiddenState?.all_dimensions) && hiddenState.all_dimensions.length > 0 && Array.isArray(hiddenState?.hidden) && hiddenState.hidden.length > 0
	};
}
function filterDescriptorsBySpec$1(descriptors, widgetSpec) {
	if (!widgetSpec) return descriptors;
	const { hasDimensionList, hasHiddenDimensionsState } = parallelCoordinatesCapabilities(widgetSpec);
	return descriptors.filter((descriptor) => {
		if (!descriptor?.name) return true;
		if (descriptor.name === "parallelCoordinates.reorderDimensions" || descriptor.name === "parallelCoordinates.hideDimensions") return hasDimensionList;
		if (descriptor.name === "parallelCoordinates.resetHiddenDimensions") return hasHiddenDimensionsState;
		return true;
	});
}
function buildParallelCoordinatesActionDescriptors({ widgetSpec = null } = {}) {
	return filterDescriptorsBySpec$1(DESCRIPTORS$1, widgetSpec).map(clone$5);
}
//#endregion
//#region ../../widgetva-kit/src/widgets/families/parallelCoordinates/perception.js
function buildParallelCoordinatesPerceptionDescriptors({ dataRef }) {
	return [makePerceptionDescriptor({
		name: "perception.findOutliers",
		title: "Find outliers",
		description: appendQueryScopeGuidance("Return likely outlier rows in the visible parallel coordinates data."),
		category: "compute",
		targetRef: dataRef,
		paramsSchema: buildScopedPerceptionParamsSchema({
			field: { type: "string" },
			zThreshold: { type: "number" },
			limit: { type: "number" }
		}),
		sideEffectFree: true,
		evidenceKinds: ["outlierEvidence", "multivariateEvidence"],
		examples: [{
			userGoal: "Find multivariate outliers in the visible parallel coordinates subset.",
			params: {
				field: "Horsepower",
				zThreshold: 2.5,
				limit: 10
			}
		}, buildQueryScopeExample({
			userGoal: "Find multivariate outliers inside one brushed parallel-coordinates subset.",
			params: {
				field: "Horsepower",
				zThreshold: 2.5,
				limit: 10
			},
			widgetRef: "wl://demo/workspace/main/widget/parallel_a",
			dataRef: "wl://demo/workspace/main/data/current_selection",
			selectionRef: "wl://demo/workspace/main/widget/parallel_a/selection/brush"
		})]
	})];
}
function registerParallelCoordinatesPerceptionQueries(perceptionRegistry) {
	if (!perceptionRegistry.has("perception.findOutliers", { supportedWidgetKinds: ["parallelCoordinates"] })) perceptionRegistry.register({
		name: "perception.findOutliers",
		supportedWidgetKinds: ["parallelCoordinates"]
	}, async (call, ctx) => {
		const targetWidget = ctx.requireTargetWidget({ kind: "parallelCoordinates" });
		const params = ctx.readCallParams();
		const outliers = runDataPerceptionQuery({
			ctx,
			dataQueryExecutor: perceptionRegistry.dataQueryExecutor,
			targetWidget,
			kind: "findOutliers",
			spec: params
		});
		ctx.recordQuery({ affectedRefs: [targetWidget.ref] });
		return { result: buildPerceptionDataResult({
			dataQueryResult: outliers,
			fallbackDataRef: ctx.resolveRowsForWidget(targetWidget, params).dataRef
		}) };
	}, { supportedWidgetKinds: ["parallelCoordinates"] });
}
//#endregion
//#region ../../widgetva-kit/src/widgets/families/parallelCoordinates/index.js
function clone$4(value) {
	return value == null ? value : JSON.parse(JSON.stringify(value));
}
var PARALLEL_COORDINATES_LOCAL_SELECTION_CONTRACT = Object.freeze({
	localSelectionFamily: "interval",
	selectionKinds: ["interval", "record"],
	sourceActionNames: ["parallelCoordinates.brushAxes", "parallelCoordinates.selectRecord"],
	cardinality: "singleActiveSelection",
	selectionValueShape: "multivariateAxisIntervalsOrRecordId",
	observationFields: [
		"state.selections",
		"coordination.localSelectionRefs",
		"coordination.widgetSelectionRef",
		"selection.activeSelectionRef",
		"selection.activeSelectionKind",
		"selection.activeSelectionSummary",
		"selection.activeSelectionFields"
	],
	perceptionExpectations: [
		"selection-scoped perception queries should resolve rows that satisfy all brushed axis rules",
		"selection summaries should expose the brushed dimension list and interval predicates",
		"record-level selections should preserve the selected record identifier for downstream focus and comparison"
	]
});
var PARALLEL_COORDINATES_VERIFICATION_CONTRACT = Object.freeze({
	preferredReadMethod: "readVerificationState",
	preferredObservationFields: [
		"verification.checks.selectionApplied",
		"verification.checks.filterApplied",
		"verification.checks.highlightApplied",
		"verification.checks.reencodeApplied",
		"verification.checks.focusApplied",
		"verification.selections.activeKinds",
		"verification.view.highlight",
		"verification.view.reencode",
		"verification.transforms.kinds"
	],
	supportedEffectTypes: [
		"selection",
		"filter",
		"highlight",
		"focus",
		"reencode",
		"encoding",
		"linkedPropagation"
	],
	effectChecks: {
		selection: [
			"checks.selectionApplied",
			"selections.count",
			"selections.activeKinds",
			"selections.activeSummary"
		],
		filter: [
			"checks.filterApplied",
			"data.rowCount",
			"data.visibleCount",
			"transforms.kinds"
		],
		highlight: [
			"checks.highlightApplied",
			"view.highlight",
			"feedback.highlightKeyCount",
			"feedback.sharedSelectionSourceWidgetId"
		],
		focus: ["checks.focusApplied", "view.focusKeys"],
		reencode: [
			"checks.reencodeApplied",
			"view.reencode",
			"encodings.channels"
		],
		encoding: [
			"checks.encodingReadable",
			"encodings.channels",
			"encodings.fieldsByChannel"
		],
		linkedPropagation: [
			"checks.linkedPropagationApplied",
			"feedback.linkedSourceRefCount",
			"feedback.sharedSelectionSourceWidgetId"
		]
	}
});
function describeParallelCoordinatesLocalSelectionContract() {
	return clone$4(PARALLEL_COORDINATES_LOCAL_SELECTION_CONTRACT);
}
function describeParallelCoordinatesVerificationContract() {
	return clone$4(PARALLEL_COORDINATES_VERIFICATION_CONTRACT);
}
function describeParallelCoordinatesWidgetContract() {
	return {
		kind: "parallelCoordinates",
		actionNames: [
			"parallelCoordinates.brushAxes",
			"parallelCoordinates.selectRecord",
			"parallelCoordinates.reorderDimensions",
			"parallelCoordinates.filterDimension",
			"parallelCoordinates.filterByCategory",
			"parallelCoordinates.highlightCategory",
			"parallelCoordinates.hideDimensions",
			"parallelCoordinates.resetHiddenDimensions"
		],
		perceptionNames: ["perception.findOutliers"],
		localSelection: describeParallelCoordinatesLocalSelectionContract(),
		verification: describeParallelCoordinatesVerificationContract()
	};
}
var parallelCoordinatesFamily = Object.freeze({
	kind: "parallelCoordinates",
	describeContract: describeParallelCoordinatesWidgetContract,
	actions: Object.freeze({ buildDescriptors: buildParallelCoordinatesActionDescriptors }),
	perception: Object.freeze({
		buildDescriptors: buildParallelCoordinatesPerceptionDescriptors,
		register: registerParallelCoordinatesPerceptionQueries
	}),
	interactionProfile: Object.freeze({ getConfig: getParallelCoordinatesHumanInteractionConfig }),
	playbook: parallelCoordinatesPlaybook
});
//#endregion
//#region ../../widgetva-kit/src/widgets/families/sankey/interactionProfile.js
function getSankeyHumanInteractionConfig() {
	return {
		mode: "categoryClick",
		actionName: "sankey.focusFlow",
		categoryFieldChannel: "color",
		supportsDirectManipulation: true
	};
}
//#endregion
//#region ../../widgetva-kit/src/widgets/families/sankey/playbook.js
var sankeyPlaybook = {
	analysisToAction: [
		{
			goal: "Understand the main flow structure",
			workflow: "If the goal is to understand the major structure of the flow graph, first identify dominant paths and bottleneck nodes, then focus on the branches carrying the most informative volume.",
			candidateActions: [
				"sankey.focusFlow",
				"sankey.highlightPath",
				"sankey.traceNode"
			],
			candidatePerceptions: [
				"perception.findBottleneck",
				"perception.findExtremes",
				"perception.compareGroups"
			]
		},
		{
			goal: "Explain where one source ends up",
			workflow: "If the goal is to trace one source downstream, isolate that source first and follow how its flow splits across later stages.",
			candidateActions: [
				"sankey.selectAggregateNode",
				"sankey.focusFlow",
				"sankey.traceNode"
			],
			candidatePerceptions: ["perception.compareGroups", "perception.findExtremes"]
		},
		{
			goal: "Compare two branches or destinations",
			workflow: "If the goal is to compare two flow branches, compare their path width, intermediates, and concentration patterns rather than relying only on endpoints.",
			candidateActions: [
				"sankey.highlightPath",
				"sankey.filterFlow",
				"sankey.reorderNodesInLayer"
			],
			candidatePerceptions: ["perception.compareGroups", "perception.findExtremes"]
		},
		{
			goal: "Inspect one node and its surrounding flows",
			workflow: "If the goal is to understand one node, focus that node and trace all incoming and outgoing flows attached to it before comparing which directions dominate.",
			candidateActions: [
				"sankey.selectAggregateNode",
				"sankey.traceNode",
				"sankey.focusFlow"
			],
			candidatePerceptions: [
				"perception.getNodeOptions",
				"perception.findExtremes",
				"perception.compareGroups"
			]
		},
		{
			goal: "Analyze conversion or drop-off",
			workflow: "If the goal is to understand conversion efficiency or loss, trace the relevant path and quantify how much flow survives across stages.",
			candidateActions: [
				"sankey.highlightPath",
				"sankey.filterFlow",
				"sankey.focusFlow"
			],
			candidatePerceptions: ["perception.calculateConversionRate", "perception.findBottleneck"]
		},
		{
			goal: "Reduce clutter or reveal hidden structure",
			workflow: "If the layout is too cluttered or too coarse for the query, simplify or expand the node structure first, then re-read the main branches after the structure becomes more interpretable.",
			candidateActions: [
				"sankey.collapseNodes",
				"sankey.expandNode",
				"sankey.autoCollapseByRank",
				"sankey.filterFlow"
			],
			candidatePerceptions: ["perception.findBottleneck", "perception.findExtremes"]
		}
	],
	workflows: [
		{
			name: "highlight_path_then_calculate_conversion",
			analysisIntent: "Path conversion analysis",
			scenarioExamples: ["What is the conversion rate from medication to cured and discharged?", "Along the paid ads to purchase path, where does the funnel lose the most users?"],
			description: "Use when the task asks for conversion, survival, or drop-off along a specific flow path.",
			steps: [{ action: "sankey.highlightPath" }, { perception: "perception.calculateConversionRate" }]
		},
		{
			name: "filter_flow_then_trace_node",
			analysisIntent: "High-volume path tracing",
			scenarioExamples: ["After removing small flows, what is the largest downstream outcome for Engineering students?", "Which destinations dominate once low-volume supply-chain flows are filtered out?"],
			description: "Use when weak flows should be removed before tracing one node downstream or upstream.",
			steps: [
				{ action: "sankey.filterFlow" },
				{ action: "sankey.traceNode" },
				{ perception: "perception.compareGroups" }
			]
		},
		{
			name: "calculate_conversion_then_highlight_path",
			analysisIntent: "Metric-guided path explanation",
			scenarioExamples: ["Which treatment path deserves inspection after comparing conversion rates across discharge outcomes?", "After calculating conversion for each funnel node, which path should be highlighted to explain performance?"],
			description: "Use when the conversion metric identifies which path should be visually inspected.",
			steps: [{ perception: "perception.calculateConversionRate" }, { action: "sankey.highlightPath" }]
		},
		{
			name: "highlight_path_then_find_extremes",
			analysisIntent: "Extreme flow lookup in path context",
			scenarioExamples: ["After highlighting the AAA loan path, how many loans transition from AAA Y2 to AAA Y3?", "Inside the selected funding path, which link carries the largest amount?"],
			description: "Use when the task asks for counts, largest links, or smallest links inside a selected path context.",
			steps: [{ action: "sankey.highlightPath" }, { perception: "perception.findExtremes" }]
		},
		{
			name: "collapse_nodes_then_calculate_conversion",
			analysisIntent: "Aggregated conversion analysis",
			scenarioExamples: ["After collapsing non-recycled product nodes, what is the conversion rate for recycled products?", "When low-level campaign channels are grouped, what percentage of users still purchase?"],
			description: "Use when node-level noise should be aggregated before reading conversion or loss.",
			steps: [{ action: "sankey.collapseNodes" }, { perception: "perception.calculateConversionRate" }]
		},
		{
			name: "highlight_path_then_collapse_nodes",
			analysisIntent: "Simplified path explanation",
			scenarioExamples: ["After tracing renewables, collapse non-renewable nodes to explain the main energy-flow contrast.", "Highlight the operating-fund path, then group surrounding expense nodes to clarify where money flows."],
			description: "Use when a key path is known but surrounding non-key nodes need aggregation to reveal structure.",
			steps: [
				{ action: "sankey.highlightPath" },
				{ action: "sankey.collapseNodes" },
				{ perception: "perception.compareGroups" }
			]
		}
	],
	multiTurnStrategy: [
		"First decide whether the query is about path tracing, node analysis, branch comparison, or conversion analysis.",
		"If the graph is too cluttered, simplify or expand structure before interpreting it.",
		"Then isolate the branch, node, or source-to-target path that matters to the query.",
		"After the target flow structure is stable, trace it stage by stage and read loss, concentration, or branching behavior.",
		"Stop when the selected path or node-level flow evidence is specific enough to support a direct answer."
	]
};
//#endregion
//#region ../../widgetva-kit/src/widgets/families/sankey/actionDescriptors.js
var DESCRIPTORS = [
	{
		"name": "sankey.focusFlow",
		"description": "Focus one or more flow categories or nodes in the current Sankey view.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"field": { "type": "string" },
				"values": {
					"type": "array",
					"items": {},
					"minItems": 1
				},
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["field", "values"]
		},
		"examples": [{
			"userGoal": "Focus a subset of flows before investigating bottlenecks.",
			"params": {
				"field": "source",
				"values": ["A"]
			}
		}]
	},
	{
		"name": "sankey.selectAggregateNode",
		"description": "Select one collapsed aggregate node by aggregate name so downstream context can focus that temporary group even when it does not map to row-level predicates.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"aggregateName": { "type": "string" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["aggregateName"]
		},
		"examples": [{
			"userGoal": "Hold one collapsed aggregate group as the current focus before deciding whether to re-expand it.",
			"params": { "aggregateName": "collapsed:1:other" }
		}]
	},
	{
		"name": "sankey.filterFlow",
		"description": "Keep only links at or above a minimum flow value, preferably by updating the Sankey threshold signal when one exists.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"minValue": { "type": "number" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["minValue"]
		},
		"examples": [{
			"userGoal": "Hide tiny flows so the main pathways stand out more clearly.",
			"params": { "minValue": 20 }
		}]
	},
	{
		"name": "sankey.collapseNodes",
		"description": "Collapse multiple nodes into one aggregate node by rewriting the raw link list and node configuration in the current Sankey view.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"nodes": {
					"type": "array",
					"minItems": 1,
					"items": { "type": "string" }
				},
				"aggregateName": { "type": "string" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["nodes"]
		},
		"examples": [{
			"userGoal": "Merge several low-signal source nodes into one aggregate before comparing downstream flow structure.",
			"params": {
				"nodes": ["A", "B"],
				"aggregateName": "Other Sources"
			}
		}]
	},
	{
		"name": "sankey.expandNode",
		"description": "Restore the original nodes and links for one previously collapsed aggregate node using the saved Sankey structural state.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"aggregateName": { "type": "string" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["aggregateName"]
		},
		"examples": [{
			"userGoal": "Re-expand one aggregate group after an earlier structural simplification pass.",
			"params": { "aggregateName": "Other Sources" }
		}]
	},
	{
		"name": "sankey.highlightPath",
		"description": "Visually emphasize a multi-step path by increasing opacity for edges and nodes on the path and dimming unrelated structure.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"path": { "oneOf": [{ "type": "string" }, {
					"type": "array",
					"minItems": 2,
					"items": { "type": "string" }
				}] },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["path"]
		},
		"examples": [{
			"userGoal": "Trace one conversion route through the Sankey graph while dimming everything else.",
			"params": { "path": [
				"A",
				"B",
				"C"
			] }
		}]
	},
	{
		"name": "sankey.traceNode",
		"description": "Highlight all edges directly connected to one node and visually emphasize that node while dimming unrelated structure.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"nodeName": { "type": "string" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["nodeName"]
		},
		"examples": [{
			"userGoal": "Trace all direct inflows and outflows for one node before deciding whether to collapse or reorder the layer.",
			"params": { "nodeName": "Checkout" }
		}]
	},
	{
		"name": "sankey.colorFlows",
		"description": "Recolor all edges directly connected to one or more nodes while leaving the unrelated edge color encoding as a fallback.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"nodes": {
					"type": "array",
					"minItems": 1,
					"items": { "type": "string" }
				},
				"color": { "type": "string" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["nodes"]
		},
		"examples": [{
			"userGoal": "Color all flows touching one or more nodes before presenting a focused Sankey story.",
			"params": {
				"nodes": ["Checkout"],
				"color": "#e74c3c"
			}
		}]
	},
	{
		"name": "sankey.reorderNodesInLayer",
		"description": "Rewrite node order values for one Sankey depth layer using an explicit top-to-bottom node order.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"depth": { "type": "number" },
				"order": {
					"type": "array",
					"minItems": 1,
					"items": { "type": "string" }
				},
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["depth", "order"]
		},
		"examples": [{
			"userGoal": "Reorder one Sankey layer to make important nodes appear first from top to bottom.",
			"params": {
				"depth": 0,
				"order": [
					"C",
					"A",
					"B"
				]
			}
		}]
	},
	{
		"name": "sankey.autoCollapseByRank",
		"description": "Keep only the top-N nodes per Sankey layer by flow volume and collapse the remainder into layer-specific aggregate nodes.",
		"paramsSchema": {
			"type": "object",
			"properties": {
				"topN": { "type": "number" },
				"queryScope": {
					"type": "object",
					"additionalProperties": false,
					"properties": {
						"dataRef": { "type": "string" },
						"selectionRef": { "type": "string" },
						"focusRef": { "type": "string" },
						"viewportRef": { "type": "string" }
					}
				}
			},
			"required": ["topN"]
		},
		"examples": [{
			"userGoal": "Simplify a large Sankey by keeping only the most important nodes in each layer.",
			"params": { "topN": 2 }
		}]
	}
];
function clone$3(value) {
	return value == null ? value : JSON.parse(JSON.stringify(value));
}
function findNamedDataSource$1(spec, name) {
	const data = Array.isArray(spec?.data) ? spec.data : [];
	const index = data.findIndex((entry) => entry && typeof entry === "object" && entry.name === name);
	return {
		index,
		values: index >= 0 && Array.isArray(data[index]?.values) ? data[index].values : null
	};
}
function findNamedMark(spec, name) {
	const marks = Array.isArray(spec?.marks) ? spec.marks : [];
	for (const mark of marks) {
		if (mark?.name === name) return mark;
		if (mark?.type === "group" && Array.isArray(mark.marks)) {
			const nested = mark.marks.find((entry) => entry?.name === name);
			if (nested) return nested;
		}
	}
	return null;
}
function sankeyCapabilities(spec) {
	const rawLinksSource = findNamedDataSource$1(spec, "rawLinks");
	const linksSource = findNamedDataSource$1(spec, "links");
	const nodesSource = findNamedDataSource$1(spec, "nodes");
	const nodeConfigSource = findNamedDataSource$1(spec, "nodeConfig");
	const collapsedGroups = spec?._sankey_state?.collapsed_groups;
	return {
		hasVegaShape: Array.isArray(spec?.data) || Array.isArray(spec?.marks),
		hasRawLinks: rawLinksSource.index >= 0 && Array.isArray(rawLinksSource.values),
		hasLinks: linksSource.index >= 0 && Array.isArray(linksSource.values),
		hasNodes: nodesSource.index >= 0 && Array.isArray(nodesSource.values),
		hasNodeConfig: nodeConfigSource.index >= 0 && Array.isArray(nodeConfigSource.values),
		hasCollapsedGroups: collapsedGroups != null && typeof collapsedGroups === "object" && !Array.isArray(collapsedGroups) && Object.keys(collapsedGroups).length > 0,
		hasEdgeMark: Boolean(findNamedMark(spec, "edgeMark"))
	};
}
function filterDescriptorsBySpec(descriptors, widgetSpec) {
	if (!widgetSpec) return descriptors;
	const { hasVegaShape, hasRawLinks, hasLinks, hasNodes, hasNodeConfig, hasCollapsedGroups, hasEdgeMark } = sankeyCapabilities(widgetSpec);
	if (!hasVegaShape) return descriptors;
	return descriptors.filter((descriptor) => {
		if (!descriptor?.name) return true;
		if (descriptor.name === "sankey.expandNode") return hasCollapsedGroups;
		if (descriptor.name === "sankey.colorFlows") return hasEdgeMark || hasLinks || hasRawLinks;
		if (descriptor.name === "sankey.reorderNodesInLayer" || descriptor.name === "sankey.autoCollapseByRank") return (hasRawLinks || hasLinks) && (hasNodeConfig || hasNodes);
		if (descriptor.name === "sankey.filterFlow" || descriptor.name === "sankey.collapseNodes" || descriptor.name === "sankey.traceNode") return hasRawLinks || hasLinks;
		return true;
	});
}
function buildSankeyActionDescriptors({ widgetSpec = null } = {}) {
	return filterDescriptorsBySpec(DESCRIPTORS, widgetSpec).map(clone$3);
}
//#endregion
//#region ../../widgetva-kit/src/widgets/families/sankey/perception.js
function buildNodeFlows(links) {
	const flows = /* @__PURE__ */ new Map();
	const ensure = (name) => {
		if (!flows.has(name)) flows.set(name, {
			inflow: 0,
			outflow: 0,
			total: 0
		});
		return flows.get(name);
	};
	for (const link of Array.isArray(links) ? links : []) {
		if (!link || typeof link !== "object") continue;
		const source = link.source;
		const target = link.target;
		const value = Number(link.value || 0);
		const sourceEntry = ensure(source);
		const targetEntry = ensure(target);
		sourceEntry.outflow += value;
		targetEntry.inflow += value;
	}
	for (const entry of flows.values()) entry.total = Math.max(entry.inflow, entry.outflow);
	return flows;
}
function findNamedDataSource(spec, name) {
	const entry = (Array.isArray(spec?.data) ? spec.data : []).find((item) => item && typeof item === "object" && item.name === name) || null;
	return Array.isArray(entry?.values) ? entry.values : null;
}
function buildSankeyNodeOptions(rawSpec) {
	const nodeConfig = findNamedDataSource(rawSpec, "nodeConfig");
	const rawLinks = findNamedDataSource(rawSpec, "rawLinks");
	const depthLabelsData = findNamedDataSource(rawSpec, "depthLabelsData") || [];
	if (!nodeConfig || !rawLinks) throw new Error("perception.getNodeOptions requires rawLinks and nodeConfig data sources.");
	const nodeFlows = buildNodeFlows(rawLinks);
	const depthLabelMap = /* @__PURE__ */ new Map();
	for (const entry of depthLabelsData) {
		if (!entry || typeof entry !== "object") continue;
		depthLabelMap.set(String(entry.depth), entry.label || `Layer ${entry.depth}`);
	}
	const nodesByDepth = {};
	const allNodes = [];
	for (const node of [...nodeConfig].sort((left, right) => {
		const leftDepth = Number(left?.depth ?? 0);
		const rightDepth = Number(right?.depth ?? 0);
		if (leftDepth !== rightDepth) return leftDepth - rightDepth;
		return Number(left?.order ?? 0) - Number(right?.order ?? 0);
	})) {
		const name = node?.name;
		if (typeof name !== "string" || name.length === 0) continue;
		const depthKey = String(Number(node?.depth ?? 0));
		const flow = nodeFlows.get(name) || { total: 0 };
		allNodes.push(name);
		if (!nodesByDepth[depthKey]) nodesByDepth[depthKey] = {
			label: depthLabelMap.get(depthKey) || `Layer ${depthKey}`,
			nodes: []
		};
		const entry = {
			name,
			order: Number(node?.order ?? 0),
			total: Math.round(Number(flow.total || 0) * 100) / 100
		};
		if (node?._is_aggregate) entry.is_aggregate = true;
		if (Array.isArray(node?._collapsed_nodes) && node._collapsed_nodes.length > 0) entry.collapsed_nodes = [...node._collapsed_nodes];
		nodesByDepth[depthKey].nodes.push(entry);
	}
	const adjacency = Object.fromEntries(allNodes.map((name) => [name, {
		upstream: [],
		downstream: []
	}]));
	const edges = [];
	const values = [];
	for (const link of rawLinks) {
		if (!link || typeof link !== "object") continue;
		const source = link.source;
		const target = link.target;
		const value = Number(link.value || 0);
		edges.push({
			source,
			target,
			value
		});
		values.push(value);
		if (adjacency[source] && !adjacency[source].downstream.includes(target)) adjacency[source].downstream.push(target);
		if (adjacency[target] && !adjacency[target].upstream.includes(source)) adjacency[target].upstream.push(source);
	}
	return {
		all_nodes: allNodes,
		nodes_by_depth: nodesByDepth,
		depth_count: Object.keys(nodesByDepth).length,
		depth_labels: Object.fromEntries(depthLabelMap.entries()),
		edges,
		adjacency,
		collapsed_groups: rawSpec?._sankey_state?.collapsed_groups || {},
		value_range: values.length > 0 ? {
			min: Math.round(Math.min(...values) * 100) / 100,
			max: Math.round(Math.max(...values) * 100) / 100
		} : {
			min: 0,
			max: 0
		}
	};
}
function buildSankeyConversionRate(rawSpec, nodeName = null) {
	const rawLinks = findNamedDataSource(rawSpec, "rawLinks");
	if (!rawLinks) throw new Error("perception.calculateConversionRate requires a rawLinks data source.");
	const nodeFlows = buildNodeFlows(rawLinks);
	const nodeOptions = buildSankeyNodeOptions(rawSpec);
	const conversions = [];
	for (const name of [...nodeFlows.keys()].sort()) {
		const info = nodeFlows.get(name) || {
			inflow: 0,
			outflow: 0
		};
		const inflow = Number(info.inflow || 0);
		const outflow = Number(info.outflow || 0);
		let type = "intermediate";
		let rate = inflow > 0 ? Math.round(outflow / inflow * 1e4) / 1e4 : 0;
		if (inflow === 0 && outflow > 0) {
			type = "source";
			rate = "source";
		} else if (outflow === 0 && inflow > 0) {
			type = "sink";
			rate = 0;
		}
		const conversion = {
			node: name,
			inflow: Math.round(inflow * 100) / 100,
			outflow: Math.round(outflow * 100) / 100,
			rate,
			type
		};
		if (type === "intermediate" && inflow > 0) {
			const loss = inflow - outflow;
			conversion.loss = Math.round(loss * 100) / 100;
			conversion.loss_rate = Math.round(loss / inflow * 1e4) / 1e4;
		}
		conversions.push(conversion);
	}
	if (typeof nodeName === "string" && nodeName.length > 0) {
		const target = conversions.find((entry) => entry.node === nodeName);
		if (!target) throw new Error(`perception.calculateConversionRate cannot find node "${nodeName}".`);
		const upstream = rawLinks.filter((link) => link?.target === nodeName).map((link) => ({
			from: link.source,
			value: Number(link.value || 0)
		}));
		const downstream = rawLinks.filter((link) => link?.source === nodeName).map((link) => ({
			to: link.target,
			value: Number(link.value || 0)
		}));
		return {
			operation: "calculate_conversion_rate",
			message: `Conversion analysis for ${nodeName}`,
			node: nodeName,
			conversion: target,
			upstream,
			downstream,
			ui_hints: nodeOptions
		};
	}
	const sources = conversions.filter((entry) => entry.type === "source");
	const sinks = conversions.filter((entry) => entry.type === "sink");
	const intermediates = conversions.filter((entry) => entry.type === "intermediate");
	const highLossNodes = [...intermediates].filter((entry) => Number(entry.loss_rate || 0) > 0).sort((left, right) => Number(right.loss_rate || 0) - Number(left.loss_rate || 0)).slice(0, 5);
	return {
		operation: "calculate_conversion_rate",
		message: `Calculated conversion rates for ${conversions.length} nodes`,
		summary: {
			total_nodes: conversions.length,
			source_nodes: sources.length,
			sink_nodes: sinks.length,
			intermediate_nodes: intermediates.length
		},
		conversions,
		high_loss_nodes: highLossNodes,
		ui_hints: nodeOptions
	};
}
function buildSankeyBottlenecks(rawSpec, topN = 3) {
	const rawLinks = findNamedDataSource(rawSpec, "rawLinks");
	if (!rawLinks) throw new Error("perception.findBottleneck requires a rawLinks data source.");
	const nodeFlows = buildNodeFlows(rawLinks);
	const nodeOptions = buildSankeyNodeOptions(rawSpec);
	const bottlenecks = [];
	for (const [name, info] of nodeFlows.entries()) {
		const inflow = Number(info.inflow || 0);
		const outflow = Number(info.outflow || 0);
		if (!(inflow > 0 && outflow > 0 && inflow > outflow)) continue;
		const loss = inflow - outflow;
		bottlenecks.push({
			node: name,
			inflow: Math.round(inflow * 100) / 100,
			outflow: Math.round(outflow * 100) / 100,
			loss: Math.round(loss * 100) / 100,
			loss_rate: Math.round(loss / inflow * 1e4) / 1e4
		});
	}
	bottlenecks.sort((left, right) => {
		if (right.loss_rate !== left.loss_rate) return right.loss_rate - left.loss_rate;
		if (right.loss !== left.loss) return right.loss - left.loss;
		return String(left.node).localeCompare(String(right.node));
	});
	const limit = Number.isFinite(topN) && topN > 0 ? Math.floor(topN) : 3;
	const top = bottlenecks.slice(0, limit);
	return {
		operation: "find_bottleneck",
		message: top.length > 0 ? `Found top ${top.length} bottleneck nodes with highest loss rates` : "No bottlenecks found (no intermediate nodes with loss)",
		bottlenecks: top,
		total_bottleneck_nodes: bottlenecks.length,
		ui_hints: nodeOptions
	};
}
function buildSankeyPerceptionDescriptors({ dataRef }) {
	return [
		makePerceptionDescriptor({
			name: "perception.getNodeOptions",
			title: "Get Sankey node options",
			description: appendQueryScopeGuidance("Return structured Sankey node, layer, adjacency, and collapsed-group metadata for UI controls and agent-side exploration."),
			category: "inspect",
			targetRef: dataRef,
			paramsSchema: buildScopedPerceptionParamsSchema({ includeEdges: { type: "boolean" } }),
			sideEffectFree: true,
			evidenceKinds: ["topologyEvidence", "uiMetadata"],
			examples: [{
				userGoal: "Inspect all current Sankey node and layer options before choosing a path, collapse target, or filter threshold.",
				params: {}
			}, buildQueryScopeExample({
				userGoal: "Inspect Sankey node options for one focused flow view.",
				params: {},
				widgetRef: "wl://demo/workspace/main/widget/sankey_a",
				dataRef: "wl://demo/workspace/main/data/current_view"
			})]
		}),
		makePerceptionDescriptor({
			name: "perception.calculateConversionRate",
			title: "Calculate Sankey conversion rate",
			description: appendQueryScopeGuidance("Compute inflow, outflow, conversion rate, and loss information for all Sankey nodes or one target node."),
			category: "compute",
			targetRef: dataRef,
			paramsSchema: buildScopedPerceptionParamsSchema({ nodeName: { type: "string" } }),
			sideEffectFree: true,
			evidenceKinds: [
				"flowEvidence",
				"conversionEvidence",
				"topologyEvidence"
			],
			examples: [{
				userGoal: "Inspect conversion and loss rates across the whole Sankey, or drill into one node.",
				params: {}
			}, buildQueryScopeExample({
				userGoal: "Inspect conversion rates inside one focused Sankey view.",
				params: {},
				widgetRef: "wl://demo/workspace/main/widget/sankey_a",
				dataRef: "wl://demo/workspace/main/data/current_view"
			})]
		}),
		makePerceptionDescriptor({
			name: "perception.findBottleneck",
			title: "Find Sankey bottlenecks",
			description: appendQueryScopeGuidance("Identify the intermediate Sankey nodes with the highest loss rates by comparing inflow and outflow."),
			category: "compute",
			targetRef: dataRef,
			paramsSchema: buildScopedPerceptionParamsSchema({ topN: { type: "number" } }),
			sideEffectFree: true,
			evidenceKinds: [
				"flowEvidence",
				"conversionEvidence",
				"rankEvidence"
			],
			examples: [{
				userGoal: "Find the worst flow drop-off points in the current Sankey.",
				params: { topN: 3 }
			}, buildQueryScopeExample({
				userGoal: "Find bottlenecks inside one focused Sankey view.",
				params: { topN: 3 },
				widgetRef: "wl://demo/workspace/main/widget/sankey_a",
				dataRef: "wl://demo/workspace/main/data/current_view"
			})]
		}),
		makePerceptionDescriptor({
			name: "perception.findExtremes",
			title: "Find extremes",
			description: appendQueryScopeGuidance("Return the highest- or lowest-valued flows in the visible Sankey data."),
			category: "compute",
			targetRef: dataRef,
			paramsSchema: buildScopedPerceptionParamsSchema({
				field: { type: "string" },
				direction: { type: "string" },
				limit: { type: "number" }
			}),
			sideEffectFree: true,
			evidenceKinds: ["flowEvidence", "rankEvidence"],
			examples: [{
				userGoal: "Find the largest or smallest visible flows.",
				params: {
					field: "value",
					direction: "max",
					limit: 5
				}
			}, buildQueryScopeExample({
				userGoal: "Find extreme flows inside one focused Sankey selection.",
				params: {
					field: "value",
					direction: "max",
					limit: 5
				},
				widgetRef: "wl://demo/workspace/main/widget/sankey_a",
				dataRef: "wl://demo/workspace/main/data/current_selection",
				selectionRef: "wl://demo/workspace/main/widget/sankey_a/selection/current"
			})]
		}),
		makePerceptionDescriptor({
			name: "perception.compareGroups",
			title: "Compare flow groups",
			description: appendQueryScopeGuidance("Compare grouped flow magnitudes in the visible Sankey data."),
			category: "compute",
			targetRef: dataRef,
			paramsSchema: buildScopedPerceptionParamsSchema({
				groupField: { type: "string" },
				valueField: { type: "string" },
				groups: {
					type: "array",
					items: { type: "string" }
				}
			}),
			sideEffectFree: true,
			evidenceKinds: ["groupComparison", "flowEvidence"],
			examples: [{
				userGoal: "Compare grouped flow magnitudes across categories.",
				params: {
					groupField: "source",
					valueField: "value",
					groups: ["A", "B"]
				}
			}, buildQueryScopeExample({
				userGoal: "Compare grouped flows inside one focused Sankey selection.",
				params: {
					groupField: "source",
					valueField: "value",
					groups: ["A", "B"]
				},
				widgetRef: "wl://demo/workspace/main/widget/sankey_a",
				dataRef: "wl://demo/workspace/main/data/current_selection",
				selectionRef: "wl://demo/workspace/main/widget/sankey_a/selection/current"
			})]
		})
	];
}
function registerSankeyPerceptionQueries(perceptionRegistry) {
	if (!perceptionRegistry.has("perception.getNodeOptions", { supportedWidgetKinds: ["sankey"] })) perceptionRegistry.register({
		name: "perception.getNodeOptions",
		supportedWidgetKinds: ["sankey"]
	}, async (call, ctx) => {
		const targetWidget = ctx.requireTargetWidget({ kind: "sankey" });
		const options = buildSankeyNodeOptions(targetWidget?.rawSpec || targetWidget?.spec || null);
		ctx.recordQuery({ affectedRefs: [targetWidget.ref] });
		return { result: {
			operation: "get_node_options",
			message: `Extracted ${options.all_nodes.length} nodes across ${options.depth_count} layers`,
			...options
		} };
	}, { supportedWidgetKinds: ["sankey"] });
	if (!perceptionRegistry.has("perception.calculateConversionRate", { supportedWidgetKinds: ["sankey"] })) perceptionRegistry.register({
		name: "perception.calculateConversionRate",
		supportedWidgetKinds: ["sankey"]
	}, async (call, ctx) => {
		const targetWidget = ctx.requireTargetWidget({ kind: "sankey" });
		const result = buildSankeyConversionRate(targetWidget?.rawSpec || targetWidget?.spec || null, call?.params?.nodeName || null);
		ctx.recordQuery({ affectedRefs: [targetWidget.ref] });
		return { result };
	}, { supportedWidgetKinds: ["sankey"] });
	if (!perceptionRegistry.has("perception.findBottleneck", { supportedWidgetKinds: ["sankey"] })) perceptionRegistry.register({
		name: "perception.findBottleneck",
		supportedWidgetKinds: ["sankey"]
	}, async (call, ctx) => {
		const targetWidget = ctx.requireTargetWidget({ kind: "sankey" });
		const result = buildSankeyBottlenecks(targetWidget?.rawSpec || targetWidget?.spec || null, call?.params?.topN);
		ctx.recordQuery({ affectedRefs: [targetWidget.ref] });
		return { result };
	}, { supportedWidgetKinds: ["sankey"] });
	if (!perceptionRegistry.has("perception.findExtremes", { supportedWidgetKinds: ["sankey"] })) perceptionRegistry.register({
		name: "perception.findExtremes",
		supportedWidgetKinds: ["sankey"]
	}, async (call, ctx) => {
		const targetWidget = ctx.requireTargetWidget({ kind: "sankey" });
		const params = ctx.readCallParams();
		const extremes = runDataPerceptionQuery({
			ctx,
			dataQueryExecutor: perceptionRegistry.dataQueryExecutor,
			targetWidget,
			kind: "findExtremes",
			spec: params
		});
		ctx.recordQuery({ affectedRefs: [targetWidget.ref] });
		return { result: buildPerceptionDataResult({
			dataQueryResult: extremes,
			fallbackDataRef: ctx.resolveRowsForWidget(targetWidget, params).dataRef
		}) };
	}, { supportedWidgetKinds: ["sankey"] });
	if (!perceptionRegistry.has("perception.compareGroups", { supportedWidgetKinds: ["sankey"] })) perceptionRegistry.register({
		name: "perception.compareGroups",
		supportedWidgetKinds: ["sankey"]
	}, async (call, ctx) => {
		const targetWidget = ctx.requireTargetWidget({ kind: "sankey" });
		const params = ctx.readCallParams();
		const comparison = runDataPerceptionQuery({
			ctx,
			dataQueryExecutor: perceptionRegistry.dataQueryExecutor,
			targetWidget,
			kind: "compareGroups",
			spec: params
		});
		ctx.recordQuery({ affectedRefs: [targetWidget.ref] });
		return { result: buildPerceptionDataResult({
			dataQueryResult: comparison,
			fallbackDataRef: ctx.resolveRowsForWidget(targetWidget, params).dataRef
		}) };
	}, { supportedWidgetKinds: ["sankey"] });
}
//#endregion
//#region ../../widgetva-kit/src/widgets/families/sankey/index.js
function clone$2(value) {
	return value == null ? value : JSON.parse(JSON.stringify(value));
}
var SANKEY_LOCAL_SELECTION_CONTRACT = Object.freeze({
	localSelectionFamily: "category",
	selectionKinds: ["category", "aggregate"],
	sourceActionNames: ["sankey.focusFlow", "sankey.selectAggregateNode"],
	cardinality: "singleActiveSelection",
	selectionValueShape: "nodeOrFlowCategoriesOrAggregateName",
	observationFields: [
		"state.selections",
		"coordination.localSelectionRefs",
		"coordination.widgetSelectionRef",
		"selection.activeSelectionRef",
		"selection.activeSelectionKind",
		"selection.activeSelectionSummary"
	],
	perceptionExpectations: [
		"selection-scoped perception queries should resolve rows or flows matching the selected node/link categories",
		"selection summaries should preserve whether the active focus refers to flow or node categories",
		"aggregate selections should preserve aggregateName even when they do not map to row-level predicates"
	]
});
var SANKEY_VERIFICATION_CONTRACT = Object.freeze({
	preferredReadMethod: "readVerificationState",
	preferredObservationFields: [
		"verification.checks.selectionApplied",
		"verification.checks.filterApplied",
		"verification.checks.aggregateApplied",
		"verification.checks.reencodeApplied",
		"verification.checks.navigateApplied",
		"verification.checks.highlightApplied",
		"verification.checks.focusApplied",
		"verification.view.aggregate",
		"verification.view.reencode",
		"verification.view.navigate",
		"verification.view.highlight",
		"verification.transforms.kinds"
	],
	supportedEffectTypes: [
		"selection",
		"filter",
		"aggregate",
		"reencode",
		"navigate",
		"highlight",
		"focus",
		"encoding",
		"linkedPropagation"
	],
	effectChecks: {
		selection: [
			"checks.selectionApplied",
			"selections.count",
			"selections.activeKinds",
			"selections.activeSummary"
		],
		filter: [
			"checks.filterApplied",
			"data.rowCount",
			"data.visibleCount",
			"transforms.kinds"
		],
		aggregate: ["checks.aggregateApplied", "view.aggregate"],
		reencode: [
			"checks.reencodeApplied",
			"view.reencode",
			"encodings.channels"
		],
		navigate: ["checks.navigateApplied", "view.navigate"],
		highlight: [
			"checks.highlightApplied",
			"view.highlight",
			"feedback.highlightKeyCount",
			"feedback.sharedSelectionSourceWidgetId"
		],
		focus: ["checks.focusApplied", "view.focusKeys"],
		encoding: [
			"checks.encodingReadable",
			"encodings.channels",
			"encodings.fieldsByChannel"
		],
		linkedPropagation: [
			"checks.linkedPropagationApplied",
			"feedback.linkedSourceRefCount",
			"feedback.sharedSelectionSourceWidgetId"
		]
	}
});
function describeSankeyLocalSelectionContract() {
	return clone$2(SANKEY_LOCAL_SELECTION_CONTRACT);
}
function describeSankeyVerificationContract() {
	return clone$2(SANKEY_VERIFICATION_CONTRACT);
}
function describeSankeyWidgetContract() {
	return {
		kind: "sankey",
		actionNames: [
			"sankey.focusFlow",
			"sankey.selectAggregateNode",
			"sankey.filterFlow",
			"sankey.collapseNodes",
			"sankey.expandNode",
			"sankey.highlightPath",
			"sankey.traceNode",
			"sankey.colorFlows",
			"sankey.reorderNodesInLayer",
			"sankey.autoCollapseByRank"
		],
		perceptionNames: [
			"perception.getNodeOptions",
			"perception.calculateConversionRate",
			"perception.findBottleneck",
			"perception.findExtremes",
			"perception.compareGroups"
		],
		localSelection: describeSankeyLocalSelectionContract(),
		verification: describeSankeyVerificationContract()
	};
}
var sankeyFamily = Object.freeze({
	kind: "sankey",
	describeContract: describeSankeyWidgetContract,
	actions: Object.freeze({ buildDescriptors: buildSankeyActionDescriptors }),
	perception: Object.freeze({
		buildDescriptors: buildSankeyPerceptionDescriptors,
		register: registerSankeyPerceptionQueries
	}),
	interactionProfile: Object.freeze({ getConfig: getSankeyHumanInteractionConfig }),
	playbook: sankeyPlaybook
});
//#endregion
//#region ../../widgetva-kit/src/widgets/families/scatter/interactionProfile.js
function getScatterHumanInteractionConfig() {
	return {
		mode: "brush2d",
		actionName: "scatter.brushRegion",
		supportsDirectManipulation: true
	};
}
//#endregion
//#region ../../widgetva-kit/src/widgets/families/scatter/playbook.js
var scatterPlaybook = {
	analysisToAction: [
		{
			goal: "Judge the relationship between two variables",
			workflow: "If the goal is to understand how x and y relate, first assess direction, spread, and rough linearity visually, then use correlation or regression only if the visible pattern supports it.",
			candidateActions: ["scatter.showRegression"],
			candidatePerceptions: ["perception.computeCorrelation", "perception.findExtremes"]
		},
		{
			goal: "Investigate a local cluster or neighborhood",
			workflow: "If the goal is to understand a local cluster, region, or neighborhood, first brush or zoom into that area, then analyze local spread, density, or structure.",
			candidateActions: [
				"scatter.brushRegion",
				"scatter.zoomDomain",
				"scatter.identifyClusters",
				"scatter.showRegression"
			],
			candidatePerceptions: [
				"perception.computeCorrelation",
				"perception.findOutliers",
				"perception.findExtremes"
			]
		},
		{
			goal: "Find outliers or rare cases",
			workflow: "If the goal is to detect outliers or unusual regions, isolate sparse or boundary points first, then compare them against the main cloud.",
			candidateActions: ["scatter.brushRegion", "scatter.zoomDomain"],
			candidatePerceptions: ["perception.findOutliers", "perception.findExtremes"]
		},
		{
			goal: "Explain how a selected region affects another linked view",
			workflow: "If the goal is to interpret another view through the scatterplot, first define a meaningful region in the scatterplot, then inspect how the linked view changes for that subset.",
			candidateActions: ["scatter.brushRegion", "scatter.zoomDomain"],
			candidatePerceptions: ["perception.computeCorrelation"]
		}
	],
	workflows: [
		{
			name: "filter_then_compute_correlation",
			analysisIntent: "Subgroup relationship measurement",
			scenarioExamples: ["Among non-US cars, is horsepower negatively correlated with miles per gallon?", "For one customer segment, does marketing spend still track visitor count?"],
			description: "Use when the relationship should be measured only within one category-defined subset.",
			steps: [{ action: "scatter.filterCategorical" }, { perception: "perception.computeCorrelation" }]
		},
		{
			name: "zoom_then_compute_local_correlation",
			analysisIntent: "Local relationship measurement",
			scenarioExamples: ["Inside the dense museum-visitor region, what is the Pearson correlation between the two visitor series?", "Within a high-score student region, how strongly do math and reading scores move together?"],
			description: "Use when the answer depends on correlation inside a dense or bounded local region.",
			steps: [{ action: "scatter.zoomDomain" }, { perception: "perception.computeCorrelation" }]
		},
		{
			name: "correlation_then_cluster",
			analysisIntent: "Relationship versus cluster structure",
			scenarioExamples: ["Do the visible car clusters correspond to origin labels after checking the horsepower-mileage relationship?", "Do gym members separate into clusters after measuring the relation between session duration and calories?"],
			description: "Use when the task asks whether a numeric relationship also separates into visible groups.",
			steps: [{ perception: "perception.computeCorrelation" }, { action: "scatter.identifyClusters" }]
		},
		{
			name: "regression_then_correlation",
			analysisIntent: "Regression-backed relationship explanation",
			scenarioExamples: ["How strong is the relationship between price percent and win percent after showing a linear trend?", "Does distance from home meaningfully predict tenure after fitting the visible relationship?"],
			description: "Use when the task asks for relationship strength after adding a visible trend model.",
			steps: [{ action: "scatter.showRegression" }, { perception: "perception.computeCorrelation" }]
		},
		{
			name: "filter_then_zoom_then_inspect_extremes",
			analysisIntent: "Extreme case lookup in a local subgroup",
			scenarioExamples: ["Among coffee drinks in the low-sugar low-calorie region, what is the minimum calories value?", "After keeping a workout type and zooming to a target duration range, which point has the highest calories burned?"],
			description: "Use when the target row or extreme value must be found inside a filtered local region.",
			steps: [
				{ action: "scatter.filterCategorical" },
				{ action: "scatter.zoomDomain" },
				{ perception: "perception.findExtremes" }
			]
		},
		{
			name: "filter_then_brush_region",
			analysisIntent: "Cohort definition for follow-up comparison",
			scenarioExamples: ["After removing European cars, compare Japanese and American cars inside the brushed horsepower window.", "Filter to a target customer group, then brush the high-spend high-visitor region for linked-view analysis."],
			description: "Use when a category-filtered scatter subset should define a local selection for closer comparison or linked views.",
			steps: [{ action: "scatter.filterCategorical" }, { action: "scatter.brushRegion" }]
		}
	],
	multiTurnStrategy: [
		"First inspect the overall scatter pattern to decide whether the query is about the global relationship or a local region.",
		"If the query is local, isolate a meaningful region through brushing or zooming.",
		"After the region is stable, run the most relevant local analysis such as correlation, regression, clustering, or outlier reading.",
		"If the local finding may be misleading without context, compare it back against the global scatter pattern.",
		"Stop when the selected region is specific enough to support a direct answer to the query."
	]
};
//#endregion
//#region ../../widgetva-kit/src/contracts/action-contracts.js
function cloneValue(value) {
	return value == null ? value : JSON.parse(JSON.stringify(value));
}
function withActionQueryScope(paramsSchema) {
	if (!paramsSchema || typeof paramsSchema !== "object" || Array.isArray(paramsSchema)) return {
		type: "object",
		properties: { queryScope: QUERY_SCOPE_SCHEMA }
	};
	return {
		...cloneValue(paramsSchema),
		properties: {
			...cloneValue(paramsSchema.properties) || {},
			queryScope: QUERY_SCOPE_SCHEMA
		}
	};
}
function makeActionDescriptor(descriptor) {
	const paramsSchema = withActionQueryScope(descriptor?.paramsSchema);
	return {
		scope: "local",
		supportedWidgetKinds: null,
		affectedRefs: [],
		affectedStatePaths: [],
		effects: [],
		reversible: false,
		preconditions: [],
		postconditions: [],
		examples: [],
		...descriptor,
		paramsSchema
	};
}
function makeSelectionEffect(ref, description) {
	return {
		kind: "updatesSelection",
		ref,
		description
	};
}
function makeFilterEffect(ref, description) {
	return {
		kind: "filtersWidget",
		ref,
		description
	};
}
function makeDomainEffect(ref, description) {
	return {
		kind: "updatesViewDomain",
		ref,
		description
	};
}
function makeHighlightEffect(ref, description) {
	return {
		kind: "highlightsItems",
		ref,
		description
	};
}
//#endregion
//#region ../../widgetva-kit/src/widgets/families/scatter/actionDescriptors.js
function makeScatterActionDescriptor(descriptor) {
	return makeActionDescriptor(descriptor);
}
function readMarkType(mark) {
	return typeof mark === "string" ? mark : mark?.type || null;
}
function isScatterFamilyMark(mark) {
	const markType = readMarkType(mark);
	return markType === "point" || markType === "circle" || markType === "square";
}
function collectNestedScatterSpecs(spec) {
	if (!spec || typeof spec !== "object" || Array.isArray(spec)) return [];
	const nested = [];
	for (const key of [
		"layer",
		"vconcat",
		"hconcat",
		"concat"
	]) if (Array.isArray(spec?.[key])) nested.push(...spec[key].filter((entry) => entry && typeof entry === "object"));
	if (spec?.spec && typeof spec.spec === "object" && !Array.isArray(spec.spec)) nested.push(spec.spec);
	return nested;
}
function findRepresentativeScatterSpec(spec) {
	if (!spec || typeof spec !== "object" || Array.isArray(spec)) return null;
	if (isScatterFamilyMark(spec?.mark) && spec?.encoding && typeof spec.encoding === "object") return spec;
	if (Array.isArray(spec?.layer)) {
		const layeredMatch = spec.layer.find((entry) => entry && typeof entry === "object" && isScatterFamilyMark(entry?.mark) && entry?.encoding && typeof entry.encoding === "object");
		if (layeredMatch) return layeredMatch;
	}
	for (const child of collectNestedScatterSpecs(spec)) {
		const match = findRepresentativeScatterSpec(child);
		if (match) return match;
	}
	return null;
}
function resolveScatterRootEncoding(spec) {
	if (!spec || typeof spec !== "object" || Array.isArray(spec)) return {};
	if (spec.layer?.[0]?.encoding && typeof spec.layer[0].encoding === "object" && !Array.isArray(spec.layer[0].encoding)) return spec.layer[0].encoding;
	if (spec.encoding && typeof spec.encoding === "object" && !Array.isArray(spec.encoding)) return spec.encoding;
	return {};
}
function buildScatterActionDescriptors({ widgetSpec = null } = {}) {
	const descriptors = [
		makeScatterActionDescriptor({
			name: "scatter.brushRegion",
			title: "Brush region",
			category: "selection",
			description: "Select points inside a data-space rectangle on the scatterplot.",
			effects: [makeSelectionEffect(null, "Updates the active scatter selection.")],
			paramsSchema: {
				type: "object",
				properties: {
					xField: { type: "string" },
					yField: { type: "string" },
					xRange: {
						type: "array",
						items: { type: "number" },
						minItems: 2,
						maxItems: 2
					},
					yRange: {
						type: "array",
						items: { type: "number" },
						minItems: 2,
						maxItems: 2
					}
				},
				required: [
					"xField",
					"yField",
					"xRange",
					"yRange"
				]
			},
			examples: [{
				userGoal: "Brush a region of interest in the scatterplot.",
				params: {
					xField: "Horsepower",
					yField: "Miles_per_Gallon",
					xRange: [80, 160],
					yRange: [20, 35]
				}
			}]
		}),
		makeScatterActionDescriptor({
			name: "scatter.selectRegion",
			title: "Select region",
			category: "selection",
			description: "Select points inside a data-space rectangle on the scatterplot and keep the region as the active interval selection.",
			effects: [makeSelectionEffect(null, "Keeps the brushed region as the active scatter selection.")],
			paramsSchema: {
				type: "object",
				properties: {
					xField: { type: "string" },
					yField: { type: "string" },
					xRange: {
						type: "array",
						items: { type: "number" },
						minItems: 2,
						maxItems: 2
					},
					yRange: {
						type: "array",
						items: { type: "number" },
						minItems: 2,
						maxItems: 2
					}
				},
				required: [
					"xField",
					"yField",
					"xRange",
					"yRange"
				]
			},
			examples: [{
				userGoal: "Select a dense rectangle in the scatterplot for downstream inspection.",
				params: {
					xField: "Horsepower",
					yField: "Miles_per_Gallon",
					xRange: [80, 160],
					yRange: [20, 35]
				}
			}]
		}),
		makeScatterActionDescriptor({
			name: "scatter.zoomDomain",
			title: "Zoom domain",
			category: "viewTransform",
			description: "Zoom the scatterplot to a specific x and/or y domain. Use null for an open lower or upper bound when only one side of the domain is known.",
			effects: [makeDomainEffect(null, "Updates the scatterplot view domain.")],
			paramsSchema: {
				type: "object",
				properties: {
					xDomain: {
						type: "array",
						minItems: 2,
						maxItems: 2,
						items: { anyOf: [
							{ type: "number" },
							{ type: "string" },
							{ type: "null" }
						] }
					},
					yDomain: {
						type: "array",
						minItems: 2,
						maxItems: 2,
						items: { anyOf: [
							{ type: "number" },
							{ type: "string" },
							{ type: "null" }
						] }
					}
				}
			},
			examples: [{
				userGoal: "Zoom into the high-risk cluster region of the scatterplot.",
				params: {
					xDomain: [80, 160],
					yDomain: [20, 35]
				}
			}, {
				userGoal: "Zoom to all points with marketing spend above 3000 while leaving the upper x bound open.",
				params: { xDomain: [3e3, null] }
			}]
		}),
		makeScatterActionDescriptor({
			name: "scatter.filterCategorical",
			title: "Filter categories",
			category: "dataTransform",
			description: "Remove one or more categories from the current scatterplot by inserting a categorical exclusion transform.",
			effects: [makeFilterEffect(null, "Filters categories from the scatterplot data view.")],
			paramsSchema: {
				type: "object",
				properties: {
					categoriesToRemove: {
						type: "array",
						items: { anyOf: [{ type: "string" }, { type: "number" }] }
					},
					field: { type: "string" }
				},
				required: ["categoriesToRemove"]
			},
			examples: [{
				userGoal: "Exclude one origin category from the scatterplot.",
				params: {
					field: "Origin",
					categoriesToRemove: ["USA"]
				}
			}]
		}),
		makeScatterActionDescriptor({
			name: "scatter.identifyClusters",
			title: "Identify clusters",
			category: "visualMapping",
			description: "Cluster visible scatter points in the frontend and recolor the scatterplot by the derived cluster labels.",
			effects: [makeHighlightEffect(null, "Highlights or recolors visible clusters in the scatterplot.")],
			paramsSchema: {
				type: "object",
				properties: {
					nClusters: { type: "number" },
					method: { type: "string" }
				}
			},
			examples: [{
				userGoal: "Color the visible scatter points by their inferred clusters.",
				params: {
					nClusters: 3,
					method: "kmeans"
				}
			}]
		}),
		makeScatterActionDescriptor({
			name: "scatter.showRegression",
			title: "Show regression",
			category: "visualMapping",
			description: "Add or replace a regression-line overlay on the current scatterplot using the active x/y encodings.",
			effects: [makeHighlightEffect(null, "Adds or replaces a regression overlay on the scatterplot.")],
			paramsSchema: {
				type: "object",
				properties: { method: { type: "string" } }
			},
			examples: [{
				userGoal: "Overlay a regression line on the scatterplot to inspect the overall trend.",
				params: { method: "linear" }
			}]
		})
	];
	if (!widgetSpec) return descriptors;
	const rootEncoding = resolveScatterRootEncoding(findRepresentativeScatterSpec(widgetSpec));
	const xType = rootEncoding?.x?.type || null;
	const yType = rootEncoding?.y?.type || null;
	const hasQuantitativeXY = xType === "quantitative" && yType === "quantitative";
	return descriptors.filter((descriptor) => {
		if (!descriptor?.name) return true;
		if (descriptor.name === "scatter.brushRegion" || descriptor.name === "scatter.selectRegion" || descriptor.name === "scatter.identifyClusters" || descriptor.name === "scatter.showRegression") return hasQuantitativeXY;
		return true;
	});
}
//#endregion
//#region ../../widgetva-kit/src/widgets/families/scatter/perception.js
function buildScatterPerceptionDescriptors({ dataRef }) {
	return [
		makePerceptionDescriptor({
			name: "perception.computeCorrelation",
			title: "Compute correlation",
			description: appendQueryScopeGuidance("Compute a correlation coefficient over the visible rows of the target scatter widget."),
			category: "compute",
			targetRef: dataRef,
			paramsSchema: buildScopedPerceptionParamsSchema({
				xField: { type: "string" },
				yField: { type: "string" }
			}),
			sideEffectFree: true,
			evidenceKinds: ["statisticalEvidence", "correlationEvidence"],
			examples: [{
				userGoal: "Estimate the relationship between two numeric fields in the scatterplot.",
				params: {
					xField: "Horsepower",
					yField: "Miles_per_Gallon"
				}
			}, buildQueryScopeExample({
				userGoal: "Estimate the correlation inside one brushed scatter subset.",
				params: {
					xField: "Horsepower",
					yField: "Miles_per_Gallon"
				},
				widgetRef: "wl://demo/workspace/main/widget/scatter_a",
				dataRef: "wl://demo/workspace/main/data/current_selection",
				selectionRef: "wl://demo/workspace/main/widget/scatter_a/selection/brush"
			})]
		}),
		makePerceptionDescriptor({
			name: "perception.findOutliers",
			title: "Find outliers",
			description: appendQueryScopeGuidance("Return likely outlier rows in the visible scatter data by numeric fields."),
			category: "compute",
			targetRef: dataRef,
			paramsSchema: buildScopedPerceptionParamsSchema({
				field: { type: "string" },
				xField: { type: "string" },
				yField: { type: "string" },
				zThreshold: { type: "number" },
				limit: { type: "number" }
			}),
			sideEffectFree: true,
			evidenceKinds: ["outlierEvidence", "rowEvidence"],
			examples: [{
				userGoal: "Identify candidate outliers in the visible scatter subset.",
				params: {
					xField: "Horsepower",
					yField: "Miles_per_Gallon",
					limit: 5
				}
			}, buildQueryScopeExample({
				userGoal: "Identify outliers inside one brushed scatter subset.",
				params: {
					xField: "Horsepower",
					yField: "Miles_per_Gallon",
					limit: 5
				},
				widgetRef: "wl://demo/workspace/main/widget/scatter_a",
				dataRef: "wl://demo/workspace/main/data/current_selection",
				selectionRef: "wl://demo/workspace/main/widget/scatter_a/selection/brush"
			})]
		}),
		makePerceptionDescriptor({
			name: "perception.findExtremes",
			title: "Find extremes",
			description: appendQueryScopeGuidance("Return top-k or bottom-k visible rows by a numeric field."),
			category: "compute",
			targetRef: dataRef,
			paramsSchema: buildScopedPerceptionParamsSchema({
				field: { type: "string" },
				direction: { type: "string" },
				limit: { type: "number" }
			}),
			sideEffectFree: true,
			evidenceKinds: ["rankEvidence", "rowEvidence"],
			examples: [{
				userGoal: "Retrieve the highest or lowest visible rows by a metric.",
				params: {
					field: "Horsepower",
					direction: "max",
					limit: 5
				}
			}, buildQueryScopeExample({
				userGoal: "Retrieve extremes inside one brushed scatter subset.",
				params: {
					field: "Horsepower",
					direction: "max",
					limit: 5
				},
				widgetRef: "wl://demo/workspace/main/widget/scatter_a",
				dataRef: "wl://demo/workspace/main/data/current_selection",
				selectionRef: "wl://demo/workspace/main/widget/scatter_a/selection/brush"
			})]
		})
	];
}
function registerScatterPerceptionQueries(perceptionRegistry) {
	if (!perceptionRegistry.has("perception.computeCorrelation", { supportedWidgetKinds: ["scatter"] })) perceptionRegistry.register({
		name: "perception.computeCorrelation",
		supportedWidgetKinds: ["scatter"]
	}, async (call, ctx) => {
		const targetWidget = ctx.requireTargetWidget({ kind: "scatter" });
		const params = ctx.readCallParams();
		const correlation = runDataPerceptionQuery({
			ctx,
			dataQueryExecutor: perceptionRegistry.dataQueryExecutor,
			targetWidget,
			kind: "computeCorrelation",
			spec: params
		});
		ctx.recordQuery({ affectedRefs: [targetWidget.ref] });
		return { result: buildPerceptionDataResult({
			dataQueryResult: correlation,
			fallbackDataRef: ctx.resolveRowsForWidget(targetWidget, params).dataRef
		}) };
	}, { supportedWidgetKinds: ["scatter"] });
	if (!perceptionRegistry.has("perception.findOutliers", { supportedWidgetKinds: ["scatter"] })) perceptionRegistry.register({
		name: "perception.findOutliers",
		supportedWidgetKinds: ["scatter"]
	}, async (call, ctx) => {
		const targetWidget = ctx.requireTargetWidget({ kind: "scatter" });
		const params = ctx.readCallParams();
		const outliers = runDataPerceptionQuery({
			ctx,
			dataQueryExecutor: perceptionRegistry.dataQueryExecutor,
			targetWidget,
			kind: "findOutliers",
			spec: params
		});
		ctx.recordQuery({ affectedRefs: [targetWidget.ref] });
		return { result: buildPerceptionDataResult({
			dataQueryResult: outliers,
			fallbackDataRef: ctx.resolveRowsForWidget(targetWidget, params).dataRef
		}) };
	}, { supportedWidgetKinds: ["scatter"] });
	if (!perceptionRegistry.has("perception.findExtremes", { supportedWidgetKinds: ["scatter"] })) perceptionRegistry.register({
		name: "perception.findExtremes",
		supportedWidgetKinds: ["scatter"]
	}, async (call, ctx) => {
		const targetWidget = ctx.requireTargetWidget({ kind: "scatter" });
		const params = ctx.readCallParams();
		const extremes = runDataPerceptionQuery({
			ctx,
			dataQueryExecutor: perceptionRegistry.dataQueryExecutor,
			targetWidget,
			kind: "findExtremes",
			spec: params
		});
		ctx.recordQuery({ affectedRefs: [targetWidget.ref] });
		return { result: buildPerceptionDataResult({
			dataQueryResult: extremes,
			fallbackDataRef: ctx.resolveRowsForWidget(targetWidget, params).dataRef
		}) };
	}, { supportedWidgetKinds: ["scatter"] });
}
//#endregion
//#region ../../widgetva-kit/src/widgets/families/scatter/index.js
function clone$1(value) {
	return value == null ? value : JSON.parse(JSON.stringify(value));
}
var SCATTER_LOCAL_SELECTION_CONTRACT = Object.freeze({
	localSelectionFamily: "interval",
	selectionKinds: ["interval"],
	sourceActionNames: ["scatter.brushRegion", "scatter.selectRegion"],
	cardinality: "singleActiveSelection",
	selectionValueShape: "xAndYIntervals",
	observationFields: [
		"state.selections",
		"coordination.localSelectionRefs",
		"coordination.widgetSelectionRef",
		"selection.activeSelectionRef",
		"selection.activeSelectionKind",
		"selection.activeSelectionSummary",
		"selection.activeSelectionFields"
	],
	perceptionExpectations: ["selection-scoped perception queries should resolve rows inside the brushed x/y interval", "selection summaries should expose interval predicates rather than only selected row ids"]
});
var SCATTER_VERIFICATION_CONTRACT = Object.freeze({
	preferredReadMethod: "readVerificationState",
	preferredObservationFields: [
		"verification.checks.selectionApplied",
		"verification.checks.filterApplied",
		"verification.checks.reencodeApplied",
		"verification.checks.zoomApplied",
		"verification.encodings.channels",
		"verification.view.reencode",
		"verification.selections.activeKinds"
	],
	supportedEffectTypes: [
		"selection",
		"filter",
		"zoom",
		"highlight",
		"reencode",
		"encoding",
		"linkedPropagation"
	],
	effectChecks: {
		selection: [
			"checks.selectionApplied",
			"selections.count",
			"selections.activeKinds",
			"selections.activeSummary"
		],
		filter: [
			"checks.filterApplied",
			"data.rowCount",
			"data.visibleCount",
			"transforms.kinds"
		],
		zoom: [
			"checks.zoomApplied",
			"view.xDomain",
			"view.yDomain",
			"view.zoom"
		],
		reencode: [
			"checks.reencodeApplied",
			"view.reencode",
			"encodings.channels"
		],
		highlight: [
			"checks.highlightApplied",
			"feedback.highlightKeyCount",
			"feedback.sharedSelectionSourceWidgetId"
		],
		encoding: [
			"checks.encodingReadable",
			"encodings.channels",
			"encodings.fieldsByChannel"
		],
		linkedPropagation: [
			"checks.linkedPropagationApplied",
			"feedback.linkedSourceRefCount",
			"feedback.sharedSelectionSourceWidgetId"
		]
	}
});
function describeScatterLocalSelectionContract() {
	return clone$1(SCATTER_LOCAL_SELECTION_CONTRACT);
}
function describeScatterVerificationContract() {
	return clone$1(SCATTER_VERIFICATION_CONTRACT);
}
function describeScatterWidgetContract() {
	return {
		kind: "scatter",
		actionNames: [
			"scatter.brushRegion",
			"scatter.selectRegion",
			"scatter.zoomDomain",
			"scatter.filterCategorical",
			"scatter.identifyClusters",
			"scatter.showRegression"
		],
		perceptionNames: [
			"perception.computeCorrelation",
			"perception.findOutliers",
			"perception.findExtremes"
		],
		localSelection: describeScatterLocalSelectionContract(),
		verification: describeScatterVerificationContract()
	};
}
var scatterFamily = Object.freeze({
	kind: "scatter",
	describeContract: describeScatterWidgetContract,
	actions: Object.freeze({ buildDescriptors: buildScatterActionDescriptors }),
	perception: Object.freeze({
		buildDescriptors: buildScatterPerceptionDescriptors,
		register: registerScatterPerceptionQueries
	}),
	interactionProfile: Object.freeze({ getConfig: getScatterHumanInteractionConfig }),
	playbook: scatterPlaybook
});
Object.freeze({
	kind: "custom",
	actions: Object.freeze({}),
	perception: Object.freeze({}),
	interactionProfile: Object.freeze({})
});
Object.freeze([
	barFamily,
	heatmapFamily,
	lineFamily,
	parallelCoordinatesFamily,
	sankeyFamily,
	scatterFamily
]);
Object.freeze({
	actions: Object.freeze([]),
	perceptions: Object.freeze([
		Object.freeze({
			name: "perception.inspectViewConfig",
			description: "Read the current widget encodings, transforms, domains, selections, and feedback state.",
			paramsSchema: Object.freeze({
				type: "object",
				properties: Object.freeze({})
			})
		}),
		Object.freeze({
			name: "perception.inspectVisibleRows",
			description: "Read a bounded sample of rows currently visible in the target widget.",
			paramsSchema: Object.freeze({
				type: "object",
				properties: Object.freeze({ limit: Object.freeze({ type: "number" }) })
			})
		}),
		Object.freeze({
			name: "perception.summarizeVisible",
			description: "Read a grouped or aggregate summary over rows currently visible in the target widget.",
			paramsSchema: Object.freeze({
				type: "object",
				properties: Object.freeze({
					groupBy: Object.freeze({
						type: "array",
						items: Object.freeze({ type: "string" })
					}),
					fields: Object.freeze({
						type: "array",
						items: Object.freeze({ type: "string" })
					}),
					metrics: Object.freeze({
						type: "array",
						items: Object.freeze({ type: "string" })
					}),
					limit: Object.freeze({ type: "integer" })
				})
			})
		})
	])
});
//#endregion
//#region ../../widgetva-kit/src/core/agent/planning/naturalLanguagePlanner.js
var DEFAULT_OPENROUTER_AGENT_MODEL = "deepseek/deepseek-v4-flash";
var ACTION_CALL_SCHEMA = {
	type: "object",
	additionalProperties: false,
	required: ["name", "params"],
	properties: {
		callId: { type: "string" },
		name: { type: "string" },
		actor: RUNTIME_ACTOR_SCHEMA,
		reason: { type: "string" },
		target: {
			type: "object",
			additionalProperties: false,
			required: ["widgetRef"],
			properties: { widgetRef: { type: "string" } }
		},
		queryScope: QUERY_SCOPE_SCHEMA,
		params: { type: "object" }
	}
};
var REF_SCHEMA = {
	type: "string",
	pattern: "^wl:\\/\\/[^/]+\\/workspace\\/[^/]+\\/.+$"
};
//#endregion
//#region ../../widgetva-kit/src/transports/pagePortProtocol.js
var PAGE_PORT_ERROR_CODES = {
	pagePort: [{
		code: "METHOD_NOT_INSTALLED",
		description: "The requested page-port method is unavailable on the current page runtime."
	}],
	action: [
		{
			code: "UNKNOWN_OPERATION",
			description: "The requested WidgetVA action name is not registered in the current runtime."
		},
		{
			code: "UNSUPPORTED_TARGET",
			description: "The requested action exists but is not declared for the target widget or ref."
		},
		{
			code: "INVALID_PARAMS",
			description: "The action call failed params-schema validation before execution."
		},
		{
			code: "PRECONDITION_FAILED",
			description: "The action is declared, but the current runtime state does not satisfy its documented preconditions."
		},
		{
			code: "RUNTIME_ERROR",
			description: "The action handler threw during execution."
		}
	],
	perception: [
		{
			code: "UNKNOWN_QUERY",
			description: "The requested perception query name is not registered in the current runtime."
		},
		{
			code: "INVALID_PARAMS",
			description: "The perception query failed params-schema validation before execution."
		},
		{
			code: "RUNTIME_ERROR",
			description: "The perception handler threw during execution."
		}
	],
	dataQuery: [
		{
			code: "UNSUPPORTED_TARGET",
			description: "The requested data-query target ref does not resolve to a materialized widget or data handle."
		},
		{
			code: "UNKNOWN_DATA_REF",
			description: "The requested data ref is not materialized in the current runtime store."
		},
		{
			code: "UNKNOWN_QUERY_KIND",
			description: "The requested data query kind is unsupported by WidgetVA."
		},
		{
			code: "UNSUPPORTED_QUERY_KIND",
			description: "The requested data query kind is valid globally but not exposed by the current data handle."
		},
		{
			code: "INVALID_QUERY_SPEC",
			description: "The data query spec failed schema validation before execution."
		}
	]
};
function makePagePortProtocolMethodDescriptor(descriptor) {
	return {
		stability: "stable",
		aliases: [],
		inputSchema: {
			type: "object",
			additionalProperties: true,
			properties: {}
		},
		returns: {
			kind: "result",
			description: ""
		},
		errors: [],
		...descriptor
	};
}
var BOOLEAN_SCHEMA = { type: "boolean" };
var STRING_SCHEMA = { type: "string" };
var REF_ARRAY_SCHEMA = {
	type: "array",
	items: { type: "string" }
};
var STATE_READ_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		refs: REF_ARRAY_SCHEMA,
		deltaSince: STRING_SCHEMA
	}
};
var TRACE_READ_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		limit: {
			type: "integer",
			minimum: 1,
			maximum: 1e3
		},
		sinceStateId: STRING_SCHEMA,
		actors: {
			type: "array",
			items: RUNTIME_ACTOR_SCHEMA
		}
	}
};
makePagePortProtocolMethodDescriptor({
	description: "Describe the installed WidgetVA page port, including stable methods, aliases, schemas, and error semantics.",
	returns: {
		kind: "pagePortDescription",
		description: "A stable description of the external WidgetVA page API."
	}
}), makePagePortProtocolMethodDescriptor({
	aliases: ["workspace_describe"],
	description: "Describe the current workspace, widgets, data handles, links, and externally callable action/perception surfaces.",
	inputSchema: {
		type: "object",
		additionalProperties: false,
		properties: {
			includeSchemas: BOOLEAN_SCHEMA,
			includeExamples: BOOLEAN_SCHEMA
		}
	},
	returns: {
		kind: "workspaceDescription",
		description: "A workspace-level description for external callers."
	}
}), makePagePortProtocolMethodDescriptor({
	aliases: ["ref_parse"],
	description: "Parse a WidgetVA ref string into structured ref parts.",
	inputSchema: {
		type: "object",
		additionalProperties: false,
		properties: { ref: REF_SCHEMA },
		required: ["ref"]
	},
	returns: {
		kind: "refParts",
		description: "Structured app/workspace/kind/id components parsed from a WidgetVA ref."
	}
}), makePagePortProtocolMethodDescriptor({
	aliases: ["state_read"],
	description: "Read the current workspace state or a delta restricted to selected refs.",
	inputSchema: STATE_READ_SCHEMA,
	returns: {
		kind: "workspaceState",
		description: "The current workspace state snapshot, optionally scoped by refs and/or delta base."
	}
}), makePagePortProtocolMethodDescriptor({
	aliases: ["view_read"],
	description: "Read the current workspace view/state projection.",
	inputSchema: STATE_READ_SCHEMA,
	returns: {
		kind: "workspaceState",
		description: "The current workspace state snapshot, optionally scoped by refs and/or delta base."
	}
}), makePagePortProtocolMethodDescriptor({
	aliases: ["read_snapshot"],
	description: "Read a historical workspace snapshot by stateId, optionally scoped to refs and enriched with metadata.",
	inputSchema: {
		type: "object",
		additionalProperties: false,
		properties: {
			stateId: STRING_SCHEMA,
			refs: REF_ARRAY_SCHEMA,
			includeMeta: BOOLEAN_SCHEMA
		},
		required: ["stateId"]
	},
	returns: {
		kind: "workspaceSnapshot",
		description: "A historical workspace snapshot."
	}
}), makePagePortProtocolMethodDescriptor({
	aliases: ["state_history_read"],
	description: "List recent runtime state snapshots in reverse chronological order.",
	inputSchema: {
		type: "object",
		additionalProperties: false,
		properties: {
			limit: {
				type: "integer",
				minimum: 1,
				maximum: 500
			},
			sinceStateId: STRING_SCHEMA,
			actors: {
				type: "array",
				items: RUNTIME_ACTOR_SCHEMA
			}
		}
	},
	returns: {
		kind: "stateSnapshotMeta[]",
		description: "Recent state-history entries with branch/transition metadata."
	}
}), makePagePortProtocolMethodDescriptor({
	aliases: ["branch_list"],
	description: "List known runtime branches and their lineage metadata.",
	returns: {
		kind: "branchSummary[]",
		description: "Branch records maintained by the runtime trace store."
	}
}), makePagePortProtocolMethodDescriptor({
	aliases: ["action_run"],
	description: "Execute a WidgetVA action against a target ref or widget.",
	inputSchema: ACTION_CALL_SCHEMA,
	returns: {
		kind: "actionResult",
		description: "An action execution envelope with state, trace, and verification hints."
	},
	errors: PAGE_PORT_ERROR_CODES.action
}), makePagePortProtocolMethodDescriptor({
	aliases: ["verified_action_run"],
	description: "Execute an action and immediately return runtime verification evidence.",
	inputSchema: {
		type: "object",
		additionalProperties: false,
		properties: {
			call: ACTION_CALL_SCHEMA,
			options: {
				type: "object",
				additionalProperties: false,
				properties: {
					verify: BOOLEAN_SCHEMA,
					includeDeltaSince: BOOLEAN_SCHEMA,
					includeFinalSnapshotRefs: BOOLEAN_SCHEMA
				}
			}
		},
		required: ["call"]
	},
	returns: {
		kind: "verifiedActionResult",
		description: "An action execution envelope augmented with post-action verification evidence."
	},
	errors: PAGE_PORT_ERROR_CODES.action
}), makePagePortProtocolMethodDescriptor({
	aliases: ["jump_to_state"],
	description: "Jump the runtime back to a historical state and replay it into the live workspace.",
	inputSchema: {
		type: "object",
		additionalProperties: false,
		properties: {
			callId: STRING_SCHEMA,
			actor: RUNTIME_ACTOR_SCHEMA,
			stateId: STRING_SCHEMA
		},
		required: ["stateId"]
	},
	returns: {
		kind: "actionResult",
		description: "A workspace.jumpToState action result."
	},
	errors: PAGE_PORT_ERROR_CODES.action
}), makePagePortProtocolMethodDescriptor({
	aliases: ["branch_from_state"],
	description: "Create and switch to a new runtime branch seeded from a historical state.",
	inputSchema: {
		type: "object",
		additionalProperties: false,
		properties: {
			callId: STRING_SCHEMA,
			actor: RUNTIME_ACTOR_SCHEMA,
			stateId: STRING_SCHEMA,
			branchLabel: STRING_SCHEMA
		},
		required: ["stateId"]
	},
	returns: {
		kind: "actionResult",
		description: "A workspace.branchFromState action result."
	},
	errors: PAGE_PORT_ERROR_CODES.action
}), makePagePortProtocolMethodDescriptor({
	aliases: ["perception_query"],
	description: "Execute a WidgetVA perception query against the current view or a target widget/data ref.",
	inputSchema: PERCEPTION_QUERY_CALL_SCHEMA,
	returns: {
		kind: "perceptionResult",
		description: "A perception query envelope carrying structured evidence."
	},
	errors: PAGE_PORT_ERROR_CODES.perception
}), makePagePortProtocolMethodDescriptor({
	aliases: ["data_query_run"],
	description: "Execute a WidgetVA data query against a materialized data handle.",
	inputSchema: DATA_QUERY_CALL_SCHEMA,
	returns: {
		kind: "dataQueryResult",
		description: "A data-query envelope with rows, aggregates, or diagnostics depending on query kind."
	},
	errors: PAGE_PORT_ERROR_CODES.dataQuery
}), makePagePortProtocolMethodDescriptor({
	aliases: ["data_query"],
	description: "Execute a WidgetVA data query against a materialized data handle.",
	inputSchema: DATA_QUERY_CALL_SCHEMA,
	returns: {
		kind: "dataQueryResult",
		description: "A data-query envelope with rows, aggregates, or diagnostics depending on query kind."
	},
	errors: PAGE_PORT_ERROR_CODES.dataQuery
}), makePagePortProtocolMethodDescriptor({
	aliases: ["trace_read"],
	description: "Read the unified human+agent interaction trace from the runtime store.",
	inputSchema: TRACE_READ_SCHEMA,
	returns: {
		kind: "interactionTraceRecord[]",
		description: "Recent runtime interaction trace records."
	}
}), makePagePortProtocolMethodDescriptor({
	aliases: ["interaction_trace_read"],
	description: "Read the unified human+agent interaction trace from the runtime store.",
	inputSchema: TRACE_READ_SCHEMA,
	returns: {
		kind: "interactionTraceRecord[]",
		description: "Recent runtime interaction trace records."
	}
}), makePagePortProtocolMethodDescriptor({
	aliases: ["workspace_replay"],
	description: "Replay a historical state into the live workspace.",
	inputSchema: {
		type: "object",
		additionalProperties: false,
		properties: {
			callId: STRING_SCHEMA,
			actor: RUNTIME_ACTOR_SCHEMA,
			stateId: STRING_SCHEMA
		},
		required: ["stateId"]
	},
	returns: {
		kind: "actionResult",
		description: "A workspace.jumpToState action result."
	},
	errors: PAGE_PORT_ERROR_CODES.action
}), makePagePortProtocolMethodDescriptor({
	aliases: ["trace_graph_read"],
	description: "Read the runtime trace graph with branch and transition relationships.",
	inputSchema: TRACE_READ_SCHEMA,
	returns: {
		kind: "traceGraph",
		description: "A graph-friendly projection of runtime states and transitions."
	}
}), makePagePortProtocolMethodDescriptor({
	aliases: ["agent_response_read"],
	description: "Read the latest recorded final response for the current or specified workspace.",
	inputSchema: {
		type: "object",
		additionalProperties: false,
		properties: { workspaceId: STRING_SCHEMA }
	},
	returns: {
		kind: "agentResponseRecord",
		description: "Latest recorded final response, if available."
	}
}), makePagePortProtocolMethodDescriptor({
	aliases: ["agent_response_list"],
	description: "List recent recorded final responses for the current or specified workspace.",
	inputSchema: {
		type: "object",
		additionalProperties: false,
		properties: {
			limit: {
				type: "integer",
				minimum: 1,
				maximum: 1e3
			},
			workspaceId: STRING_SCHEMA
		}
	},
	returns: {
		kind: "agentResponseRecord[]",
		description: "Recent recorded final responses for the current or specified workspace."
	}
}), makePagePortProtocolMethodDescriptor({
	aliases: ["link_propagation_evaluate"],
	description: "Evaluate current propagation consistency for outgoing links from a source ref.",
	inputSchema: {
		type: "object",
		additionalProperties: false,
		properties: { sourceRef: STRING_SCHEMA },
		required: ["sourceRef"]
	},
	returns: {
		kind: "linkPropagationEvaluation",
		description: "Per-link consistency checks for runtime propagation semantics."
	}
}), makePagePortProtocolMethodDescriptor({
	aliases: ["agent_response_record"],
	description: "Record a final response for the current workspace for later history and inspection workflows.",
	inputSchema: {
		type: "object",
		additionalProperties: false,
		required: ["content"],
		properties: {
			responseId: STRING_SCHEMA,
			runId: STRING_SCHEMA,
			sessionId: STRING_SCHEMA,
			actor: RUNTIME_ACTOR_SCHEMA,
			mode: STRING_SCHEMA,
			query: STRING_SCHEMA,
			content: STRING_SCHEMA,
			evidenceRefs: REF_ARRAY_SCHEMA
		}
	},
	returns: {
		kind: "agentResponseRecord",
		description: "The recorded final-response record with runtime lineage metadata."
	}
});
//#endregion
//#region ../../widgetva-kit/src/contracts/data-contracts.js
function makeDataQueryDescriptor(descriptor) {
	return {
		inputSchema: {
			type: "object",
			additionalProperties: false,
			properties: {}
		},
		resultSchema: descriptor?.resultSchema || (descriptor?.name ? DATA_QUERY_RESULT_SCHEMAS[descriptor.name] : void 0),
		examples: [],
		...descriptor
	};
}
//#endregion
//#region ../../widgetva-kit/src/core/data/dataQueryDescriptorTemplates.js
var DATA_QUERY_DESCRIPTOR_TEMPLATES = {
	schema: {
		title: "Inspect data schema",
		description: "Read the exposed field schema for the materialized data view.",
		resultKind: "schema",
		examples: [
			{ spec: {} },
			{ spec: { queryScope: { dataRef: "wl://demo/workspace/main/data/current_view" } } },
			{ spec: { queryScope: {
				dataRef: "wl://demo/workspace/main/data/current_selection",
				selectionRef: "wl://demo/workspace/main/widget/scatter/selection/brush"
			} } }
		]
	},
	sampleRows: {
		title: "Sample visible rows",
		description: "Read a bounded sample of rows from the shared current view or another materialized data view, optionally scoped to an active selection.",
		resultKind: "rowSample",
		examples: [
			{ spec: { limit: 10 } },
			{ spec: {
				queryScope: { dataRef: "wl://demo/workspace/main/data/current_view" },
				limit: 10
			} },
			{ spec: {
				queryScope: {
					dataRef: "wl://demo/workspace/main/data/current_selection",
					selectionRef: "wl://demo/workspace/main/widget/scatter/selection/brush"
				},
				limit: 10
			} }
		]
	},
	filter: {
		title: "Filter current data view",
		description: "Run a predicate filter over the shared current view or another materialized data view, optionally after scoping to an active selection, without mutating workspace state.",
		resultKind: "filteredRows",
		examples: [
			{ spec: { predicates: [{
				field: "Region",
				op: "in",
				value: ["North", "West"]
			}] } },
			{ spec: {
				queryScope: { dataRef: "wl://demo/workspace/main/data/current_view" },
				predicates: [{
					field: "Region",
					op: "in",
					value: ["North", "West"]
				}]
			} },
			{ spec: {
				queryScope: {
					dataRef: "wl://demo/workspace/main/data/current_selection",
					selectionRef: "wl://demo/workspace/main/widget/scatter/selection/brush"
				},
				predicates: [{
					field: "Region",
					op: "in",
					value: ["North", "West"]
				}]
			} }
		]
	},
	aggregate: {
		title: "Aggregate current data view",
		description: "Aggregate the shared current view or another materialized data view, optionally scoped to an active selection, using group-by keys and measures.",
		resultKind: "aggregateTable",
		examples: [
			{ spec: {
				groupBy: ["Region"],
				measures: [{
					op: "count",
					as: "recordCount"
				}]
			} },
			{ spec: {
				queryScope: { dataRef: "wl://demo/workspace/main/data/current_view" },
				groupBy: ["Region"],
				measures: [{
					op: "count",
					as: "recordCount"
				}]
			} },
			{ spec: {
				queryScope: {
					dataRef: "wl://demo/workspace/main/data/current_selection",
					selectionRef: "wl://demo/workspace/main/widget/scatter/selection/brush"
				},
				groupBy: ["Region"],
				measures: [{
					op: "count",
					as: "recordCount"
				}]
			} }
		]
	},
	groupBy: {
		title: "Group current data view",
		description: "Group rows and compute summary measures over the shared current view or another materialized data view, optionally scoped to an active selection.",
		resultKind: "groupedTable",
		examples: [
			{ spec: {
				groupBy: ["Region"],
				measures: [{
					op: "count",
					as: "recordCount"
				}]
			} },
			{ spec: {
				queryScope: { dataRef: "wl://demo/workspace/main/data/current_view" },
				groupBy: ["Region"],
				measures: [{
					op: "count",
					as: "recordCount"
				}]
			} },
			{ spec: {
				queryScope: {
					dataRef: "wl://demo/workspace/main/data/current_selection",
					selectionRef: "wl://demo/workspace/main/widget/scatter/selection/brush"
				},
				groupBy: ["Region"],
				measures: [{
					op: "count",
					as: "recordCount"
				}]
			} }
		]
	},
	sql: {
		title: "Execute data-view SQL",
		description: "Run a SQL-like query supported by the underlying data engine over the current view or a scoped active selection.",
		resultKind: "queryTable",
		examples: [
			{ spec: { sql: "select Region, count(*) as recordCount from data group by Region" } },
			{ spec: {
				queryScope: { dataRef: "wl://demo/workspace/main/data/current_view" },
				sql: "select Region, count(*) as recordCount from data group by Region"
			} },
			{ spec: {
				queryScope: {
					dataRef: "wl://demo/workspace/main/data/current_selection",
					selectionRef: "wl://demo/workspace/main/widget/scatter/selection/brush"
				},
				sql: "select Region, count(*) as recordCount from data group by Region"
			} }
		]
	},
	summary: {
		title: "Summarize current data view",
		description: "Compute a compact summary over the shared current view, another materialized data view, or a scoped active selection.",
		resultKind: "summaryTable",
		examples: [
			{ spec: {
				fields: ["LatencyMs"],
				metrics: [
					"min",
					"max",
					"mean"
				]
			} },
			{ spec: {
				queryScope: { dataRef: "wl://demo/workspace/main/data/current_view" },
				fields: ["LatencyMs"],
				metrics: ["mean"]
			} },
			{ spec: {
				queryScope: {
					dataRef: "wl://demo/workspace/main/data/current_selection",
					selectionRef: "wl://demo/workspace/main/widget/scatter/selection/brush"
				},
				fields: ["LatencyMs"],
				metrics: ["mean"]
			} }
		]
	},
	computeCorrelation: {
		title: "Compute correlation",
		description: "Compute correlation statistics between two quantitative fields over the shared current view, another materialized data view, or a scoped active selection.",
		resultKind: "correlationStats",
		examples: [
			{ spec: {
				xField: "LatencyMs",
				yField: "ErrorRate"
			} },
			{ spec: {
				queryScope: { dataRef: "wl://demo/workspace/main/data/current_view" },
				xField: "LatencyMs",
				yField: "ErrorRate"
			} },
			{ spec: {
				queryScope: {
					dataRef: "wl://demo/workspace/main/data/current_selection",
					selectionRef: "wl://demo/workspace/main/widget/scatter/selection/brush"
				},
				xField: "LatencyMs",
				yField: "ErrorRate"
			} }
		]
	},
	findExtremes: {
		title: "Find extremes",
		description: "Find records with the minimum, maximum, or both extremes for a field over the shared current view, another materialized data view, or a scoped active selection.",
		resultKind: "extremeRows",
		examples: [
			{ spec: {
				field: "Traffic",
				direction: "max",
				limit: 5
			} },
			{ spec: {
				queryScope: { dataRef: "wl://demo/workspace/main/data/current_view" },
				field: "Traffic",
				direction: "max",
				limit: 5
			} },
			{ spec: {
				queryScope: {
					dataRef: "wl://demo/workspace/main/data/current_selection",
					selectionRef: "wl://demo/workspace/main/widget/scatter/selection/brush"
				},
				field: "Traffic",
				direction: "max",
				limit: 5
			} }
		]
	},
	findOutliers: {
		title: "Find outliers",
		description: "Find records that are statistically outlying for a field over the shared current view, another materialized data view, or a scoped active selection.",
		resultKind: "outlierRows",
		examples: [
			{ spec: {
				field: "ErrorRate",
				method: "iqr",
				limit: 10
			} },
			{ spec: {
				queryScope: { dataRef: "wl://demo/workspace/main/data/current_view" },
				field: "ErrorRate",
				method: "iqr",
				limit: 10
			} },
			{ spec: {
				queryScope: {
					dataRef: "wl://demo/workspace/main/data/current_selection",
					selectionRef: "wl://demo/workspace/main/widget/scatter/selection/brush"
				},
				field: "ErrorRate",
				method: "iqr",
				limit: 10
			} }
		]
	},
	compareGroups: {
		title: "Compare groups",
		description: "Compare two groups over a quantitative value field in the shared current view, another materialized data view, or a scoped active selection.",
		resultKind: "groupComparison",
		examples: [
			{ spec: {
				groupField: "Region",
				valueField: "LatencyMs",
				groups: ["North", "South"]
			} },
			{ spec: {
				queryScope: { dataRef: "wl://demo/workspace/main/data/current_view" },
				groupField: "Region",
				valueField: "LatencyMs",
				groups: ["North", "South"]
			} },
			{ spec: {
				queryScope: {
					dataRef: "wl://demo/workspace/main/data/current_selection",
					selectionRef: "wl://demo/workspace/main/widget/scatter/selection/brush"
				},
				groupField: "Region",
				valueField: "LatencyMs",
				groups: ["North", "South"]
			} }
		]
	}
};
//#endregion
//#region ../../widgetva-kit/src/core/data/DataQueryEngine.js
function makeDataQueryEngineEngineSummary(summary = {}) {
	return {
		kind: summary?.kind ?? null,
		className: summary?.className ?? null
	};
}
function makeDataQueryEngineCounts(counts = {}) {
	return {
		supportedQueryKindCount: 0,
		supportedQueryDescriptorCount: 0,
		...counts
	};
}
function makeDataQueryEngineCapabilities(capabilities = {}) {
	return {
		localExecution: false,
		remoteExecution: false,
		sqlSupport: false,
		fallbackEngine: false,
		...capabilities
	};
}
function makeDataQueryEngineSummary(summary = {}) {
	return {
		engine: makeDataQueryEngineEngineSummary(summary?.engine),
		counts: makeDataQueryEngineCounts(summary?.counts),
		supportedQueryKinds: Array.isArray(summary?.supportedQueryKinds) ? [...summary.supportedQueryKinds] : [],
		supportedQueryDescriptors: Array.isArray(summary?.supportedQueryDescriptors) ? [...summary.supportedQueryDescriptors] : [],
		capabilities: makeDataQueryEngineCapabilities(summary?.capabilities)
	};
}
function buildSupportedQueryDescriptors(kinds = []) {
	return kinds.map((kind) => makeDataQueryDescriptor({
		name: kind,
		...DATA_QUERY_DESCRIPTOR_TEMPLATES[kind],
		inputSchema: DATA_QUERY_SCHEMAS[kind] || {
			type: "object",
			additionalProperties: true,
			properties: {}
		}
	}));
}
function buildSummaryMeasures({ fields = [], metrics = [] } = {}) {
	const normalizedFields = Array.isArray(fields) ? fields.filter((field) => typeof field === "string" && field.length > 0) : [];
	const normalizedMetrics = Array.isArray(metrics) ? metrics.filter((metric) => typeof metric === "string" && metric.length > 0) : [];
	const measures = [];
	for (const metric of normalizedMetrics) {
		if (metric === "count") {
			measures.push({
				op: "count",
				as: "count"
			});
			continue;
		}
		for (const field of normalizedFields) measures.push({
			op: metric,
			field,
			as: `${field}_${metric}`
		});
	}
	return measures;
}
function normalizeAggregateSpec(spec = {}) {
	const groupBy = Array.isArray(spec.groupBy) ? spec.groupBy : [];
	const measures = Array.isArray(spec.measures) ? spec.measures : Array.isArray(spec.metrics) ? spec.metrics : [];
	return {
		...spec,
		groupBy,
		measures
	};
}
function normalizeSummarySpec(spec = {}) {
	const measures = Array.isArray(spec.measures) && spec.measures.length > 0 ? spec.measures : buildSummaryMeasures({
		fields: spec.fields,
		metrics: spec.metrics
	});
	return {
		...spec,
		measures
	};
}
function normalizeExtremesSpec(spec = {}) {
	const direction = typeof spec.direction === "string" ? spec.direction : null;
	return {
		...spec,
		order: direction === "min" ? "ascending" : "descending"
	};
}
function normalizeCompareGroupsSpec(spec = {}) {
	if (Array.isArray(spec.groups) && spec.groups.length >= 2) return spec;
	return {
		...spec,
		groups: [spec.leftGroup, spec.rightGroup].filter((value) => value != null)
	};
}
var DataQueryEngine = class {
	resolveQuerySource(source) {
		if (typeof source !== "string" || source.length === 0) return source;
		const resolver = typeof this.resolveSource === "function" ? this.resolveSource.bind(this) : typeof this.options?.resolveSource === "function" ? this.options.resolveSource.bind(this.options) : null;
		if (typeof resolver !== "function") return source;
		const resolvedSource = resolver(source);
		return resolvedSource == null ? source : resolvedSource;
	}
	query(source, query = {}) {
		const resolvedSource = this.resolveQuerySource(source);
		const kind = query?.kind || null;
		const spec = query?.spec || {};
		if (kind === "schema") return this.getSchema(resolvedSource);
		if (kind === "filter") return this.filter(resolvedSource, Array.isArray(spec?.predicates) ? spec.predicates : []);
		if (kind === "sampleRows") return this.sampleRows(resolvedSource, spec?.limit || 20);
		if (kind === "aggregate" || kind === "groupBy") return this.aggregate(resolvedSource, normalizeAggregateSpec(spec));
		if (kind === "summary") return this.summarize(resolvedSource, normalizeSummarySpec(spec));
		if (kind === "sql") return this.executeSql(resolvedSource, spec);
		if (kind === "computeCorrelation") return this.computeCorrelation(resolvedSource, spec);
		if (kind === "findExtremes") return this.findExtremes(resolvedSource, normalizeExtremesSpec(spec));
		if (kind === "findOutliers") return this.findOutliers(resolvedSource, spec);
		if (kind === "compareGroups") return this.compareGroups(resolvedSource, normalizeCompareGroupsSpec(spec));
		throw new Error(`Unsupported data query kind: ${kind || "missing"}.`);
	}
	describeEngine() {
		const supportedQueryKinds = typeof this.listSupportedQueryKinds === "function" ? this.listSupportedQueryKinds() : [];
		const supportedQueryDescriptors = buildSupportedQueryDescriptors(supportedQueryKinds);
		return makeDataQueryEngineSummary({
			engine: makeDataQueryEngineEngineSummary({
				kind: this.kind || null,
				className: this.constructor?.name || null
			}),
			counts: makeDataQueryEngineCounts({
				supportedQueryKindCount: supportedQueryKinds.length,
				supportedQueryDescriptorCount: supportedQueryDescriptors.length
			}),
			supportedQueryKinds,
			supportedQueryDescriptors,
			capabilities: makeDataQueryEngineCapabilities({
				localExecution: true,
				remoteExecution: false,
				sqlSupport: supportedQueryKinds.includes("sql"),
				fallbackEngine: false
			})
		});
	}
	listSupportedQueryKinds() {
		return [
			"schema",
			"sampleRows",
			"filter",
			"aggregate",
			"groupBy",
			"summary"
		];
	}
	getSchema() {
		throw new Error("DataQueryEngine.getSchema() must be implemented by subclasses.");
	}
	filter() {
		throw new Error("DataQueryEngine.filter() must be implemented by subclasses.");
	}
	sampleRows() {
		throw new Error("DataQueryEngine.sampleRows() must be implemented by subclasses.");
	}
	executeSql() {
		throw new Error("DataQueryEngine.executeSql() must be implemented by subclasses.");
	}
	aggregate() {
		throw new Error("DataQueryEngine.aggregate() must be implemented by subclasses.");
	}
	summarize() {
		throw new Error("DataQueryEngine.summarize() must be implemented by subclasses.");
	}
	computeCorrelation() {
		throw new Error("DataQueryEngine.computeCorrelation() must be implemented by subclasses.");
	}
	findExtremes() {
		throw new Error("DataQueryEngine.findExtremes() must be implemented by subclasses.");
	}
	findOutliers() {
		throw new Error("DataQueryEngine.findOutliers() must be implemented by subclasses.");
	}
	compareGroups() {
		throw new Error("DataQueryEngine.compareGroups() must be implemented by subclasses.");
	}
};
//#endregion
//#region ../../widgetva-kit/src/core/data/JsArrayDataQueryEngine.js
function inferFieldType(value) {
	if (typeof value === "number") return "quantitative";
	if (typeof value === "boolean") return "boolean";
	if (typeof value === "string") return "nominal";
	return "nominal";
}
function applyPredicate(row, predicate) {
	const value = row?.[predicate.field];
	if (predicate.op === "between" && Array.isArray(predicate.value)) return value >= predicate.value[0] && value <= predicate.value[1];
	if (predicate.op === "gte" || predicate.op === "greaterThanOrEqual") return value >= predicate.value;
	if (predicate.op === "lte" || predicate.op === "lessThanOrEqual") return value <= predicate.value;
	if (predicate.op === "gt" || predicate.op === "greaterThan") return value > predicate.value;
	if (predicate.op === "lt" || predicate.op === "lessThan") return value < predicate.value;
	if (predicate.op === "equals" || predicate.op === "eq") return value === predicate.value;
	if (predicate.op === "in" && Array.isArray(predicate.value)) return predicate.value.includes(value);
	if (predicate.op === "notIn" && Array.isArray(predicate.value)) return !predicate.value.includes(value);
	return true;
}
function filterRows(rows, predicates = []) {
	if (!Array.isArray(predicates) || predicates.length === 0) return rows;
	return rows.filter((row) => predicates.every((predicate) => applyPredicate(row, predicate)));
}
function numericValuesForMeasure(rows, field) {
	if (!field) return [];
	return rows.map((row) => row?.[field]).filter((value) => typeof value === "number");
}
function median(values) {
	const sorted = [...values].sort((a, b) => a - b);
	if (sorted.length === 0) return null;
	const middle = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 1) return sorted[middle];
	return (sorted[middle - 1] + sorted[middle]) / 2;
}
function computeMeasureValue(rows, measure) {
	if (!measure?.op || !measure?.as) return void 0;
	if (measure.op === "count") return rows.length;
	const values = numericValuesForMeasure(rows, measure.field);
	if (measure.op === "sum") return values.reduce((sum, value) => sum + value, 0);
	if (measure.op === "mean") return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
	if (measure.op === "min") return values.length > 0 ? Math.min(...values) : null;
	if (measure.op === "max") return values.length > 0 ? Math.max(...values) : null;
	if (measure.op === "median") return values.length > 0 ? median(values) : null;
}
function aggregateRows(rows, spec = {}) {
	const groupBy = Array.isArray(spec.groupBy) ? spec.groupBy.filter(Boolean) : [];
	const measures = Array.isArray(spec.measures) ? spec.measures : [];
	if (measures.length === 0) return {
		rows,
		rowCount: rows.length
	};
	if (groupBy.length === 0) {
		const summaryRow = {};
		measures.forEach((measure) => {
			if (!measure?.as) return;
			summaryRow[measure.as] = computeMeasureValue(rows, measure);
		});
		return {
			rows: [summaryRow],
			rowCount: 1
		};
	}
	const buckets = /* @__PURE__ */ new Map();
	for (const row of rows) {
		const key = JSON.stringify(groupBy.map((field) => row?.[field]));
		if (!buckets.has(key)) {
			const seed = { __widgetva_rows: [] };
			groupBy.forEach((field) => {
				seed[field] = row?.[field] ?? null;
			});
			buckets.set(key, seed);
		}
		buckets.get(key).__widgetva_rows.push(row);
	}
	let result = Array.from(buckets.values()).map((bucket) => {
		const nextBucket = { ...bucket };
		const bucketRows = Array.isArray(bucket.__widgetva_rows) ? bucket.__widgetva_rows : [];
		measures.forEach((measure) => {
			if (!measure?.as) return;
			nextBucket[measure.as] = computeMeasureValue(bucketRows, measure);
		});
		delete nextBucket.__widgetva_rows;
		return nextBucket;
	});
	if (spec.sortBy?.field) {
		const dir = spec.sortBy.order === "ascending" ? 1 : -1;
		const field = spec.sortBy.field;
		result = result.sort((a, b) => {
			const left = a?.[field];
			const right = b?.[field];
			if (left === right) return 0;
			return left > right ? dir : -dir;
		});
	}
	if (Number.isFinite(spec.limit) && spec.limit > 0) result = result.slice(0, spec.limit);
	return {
		rows: result,
		rowCount: result.length
	};
}
var JsArrayDataQueryEngine = class extends DataQueryEngine {
	constructor(options = {}) {
		super();
		this.options = options;
		this.kind = options.kind || "js_array";
	}
	listSupportedQueryKinds() {
		return [
			"schema",
			"sampleRows",
			"filter",
			"aggregate",
			"groupBy",
			"summary",
			"computeCorrelation",
			"findExtremes",
			"findOutliers",
			"compareGroups"
		];
	}
	getSchema(rows) {
		const resolvedRows = this.resolveQuerySource(rows);
		const sample = Array.isArray(resolvedRows) && resolvedRows.length > 0 ? resolvedRows[0] : {};
		return { fields: Object.keys(sample || {}).map((name) => ({
			name,
			type: inferFieldType(sample[name])
		})) };
	}
	filter(rows, predicates = []) {
		return filterRows(Array.isArray(rows) ? rows : [], predicates);
	}
	sampleRows(rows, limit = 20) {
		return (Array.isArray(rows) ? rows : []).slice(0, Math.max(0, limit));
	}
	executeSql() {
		return {
			ok: false,
			error: {
				code: "SQL_QUERY_UNSUPPORTED",
				message: "SQL queries are not supported by the in-memory JS array query engine."
			}
		};
	}
	aggregate(rows, spec = {}) {
		return aggregateRows(Array.isArray(rows) ? rows : [], spec);
	}
	summarize(rows, options = {}) {
		const safeRows = Array.isArray(rows) ? rows : [];
		const groupBy = Array.isArray(options.groupBy) ? options.groupBy.filter(Boolean) : [];
		const measures = Array.isArray(options.measures) ? options.measures : [{
			op: "count",
			as: "count"
		}];
		return this.aggregate(safeRows, {
			groupBy,
			measures,
			sortBy: options.sortBy,
			limit: options.limit
		});
	}
	computeCorrelation(rows, { xField, yField } = {}) {
		const safeRows = Array.isArray(rows) ? rows : [];
		if (!xField || !yField) return {
			ok: false,
			reason: "xField and yField are required."
		};
		const pairs = safeRows.map((row) => [row?.[xField], row?.[yField]]).filter(([x, y]) => typeof x === "number" && typeof y === "number");
		if (pairs.length < 2) return {
			ok: false,
			reason: "Not enough numeric rows to compute correlation."
		};
		const n = pairs.length;
		const sumX = pairs.reduce((acc, [x]) => acc + x, 0);
		const sumY = pairs.reduce((acc, [, y]) => acc + y, 0);
		const meanX = sumX / n;
		const meanY = sumY / n;
		let num = 0;
		let denX = 0;
		let denY = 0;
		for (const [x, y] of pairs) {
			const dx = x - meanX;
			const dy = y - meanY;
			num += dx * dy;
			denX += dx * dx;
			denY += dy * dy;
		}
		const denominator = Math.sqrt(denX * denY);
		return {
			ok: denominator > 0,
			coefficient: denominator > 0 ? num / denominator : null,
			sampleSize: n,
			fields: [xField, yField]
		};
	}
	findExtremes(rows, { field, order = "descending", limit = 5 } = {}) {
		const safeRows = Array.isArray(rows) ? rows : [];
		if (!field) return { rows: [] };
		return { rows: safeRows.filter((row) => typeof row?.[field] === "number").sort((a, b) => {
			const diff = (a?.[field] || 0) - (b?.[field] || 0);
			return order === "ascending" ? diff : -diff;
		}).slice(0, Math.max(0, limit)) };
	}
	findOutliers(rows, { field, xField, yField, zThreshold = 2, limit = 10 } = {}) {
		const safeRows = Array.isArray(rows) ? rows : [];
		const fields = [
			field,
			xField,
			yField
		].filter(Boolean);
		if (fields.length === 0) return {
			rows: [],
			summary: { reason: "No numeric field specified." }
		};
		const scored = [];
		for (const currentField of fields) {
			const numericValues = safeRows.map((row) => row?.[currentField]).filter((value) => typeof value === "number");
			if (numericValues.length < 2) continue;
			const mean = numericValues.reduce((acc, value) => acc + value, 0) / numericValues.length;
			const variance = numericValues.reduce((acc, value) => acc + (value - mean) ** 2, 0) / numericValues.length;
			const std = Math.sqrt(variance);
			if (!std) continue;
			for (const row of safeRows) {
				const value = row?.[currentField];
				if (typeof value !== "number") continue;
				const zScore = Math.abs((value - mean) / std);
				if (zScore >= zThreshold) scored.push({
					row,
					field: currentField,
					value,
					zScore
				});
			}
		}
		const deduped = [];
		const seen = /* @__PURE__ */ new Set();
		for (const item of scored.sort((a, b) => b.zScore - a.zScore)) {
			const key = JSON.stringify(item.row);
			if (seen.has(key)) continue;
			seen.add(key);
			deduped.push(item);
			if (deduped.length >= Math.max(0, limit)) break;
		}
		return {
			rows: deduped.map((item) => ({
				...item.row,
				__widgetva_outlier_field: item.field,
				__widgetva_outlier_score: item.zScore
			})),
			summary: {
				inspectedFields: fields,
				zThreshold,
				count: deduped.length
			}
		};
	}
	compareGroups(rows, { groupField, valueField, groups = [] } = {}) {
		const safeRows = Array.isArray(rows) ? rows : [];
		if (!groupField || !valueField || groups.length < 2) return {
			ok: false,
			reason: "groupField, valueField, and at least two groups are required."
		};
		return {
			ok: true,
			groups: groups.map((group) => {
				const numericValues = safeRows.filter((row) => row?.[groupField] === group).map((row) => row?.[valueField]).filter((value) => typeof value === "number");
				const count = numericValues.length;
				const sum = numericValues.reduce((acc, value) => acc + value, 0);
				return {
					group,
					count,
					mean: count > 0 ? sum / count : null,
					min: count > 0 ? Math.min(...numericValues) : null,
					max: count > 0 ? Math.max(...numericValues) : null
				};
			})
		};
	}
};
//#endregion
//#region ../../widgetva-kit/src/core/data/DuckDbDataQueryEngine.js
var DuckDbDataQueryEngine = class extends DataQueryEngine {
	constructor(options = {}) {
		super();
		this.options = options;
		this.kind = options.kind || "duckdb";
		this.execute = options.request || options.execute || null;
		this.fallbackEngine = new JsArrayDataQueryEngine(options);
	}
	unsupported() {
		return {
			ok: false,
			error: {
				code: "DUCKDB_ENGINE_UNAVAILABLE",
				message: "DuckDB-backed data queries are not configured in this frontend runtime build."
			}
		};
	}
	listSupportedQueryKinds() {
		return [
			"schema",
			"sampleRows",
			"filter",
			"aggregate",
			"groupBy",
			"sql",
			"summary",
			"computeCorrelation",
			"findExtremes",
			"findOutliers",
			"compareGroups"
		];
	}
	getSchema() {
		return this.fallbackEngine.getSchema(...arguments);
	}
	filter() {
		return this.fallbackEngine.filter(...arguments);
	}
	sampleRows() {
		return this.fallbackEngine.sampleRows(...arguments);
	}
	executeSql() {
		if (typeof this.execute === "function") return this.execute({
			kind: "sql",
			rows: arguments[0],
			spec: arguments[1] || {}
		});
		return this.unsupported();
	}
	aggregate() {
		if (typeof this.execute === "function") return this.execute({
			kind: "aggregate",
			rows: arguments[0],
			spec: arguments[1] || {}
		});
		return this.fallbackEngine.aggregate(...arguments);
	}
	summarize() {
		if (typeof this.execute === "function") return this.execute({
			kind: "summary",
			rows: arguments[0],
			spec: arguments[1] || {}
		});
		return this.fallbackEngine.summarize(...arguments);
	}
	computeCorrelation() {
		if (typeof this.execute === "function") return this.execute({
			kind: "computeCorrelation",
			rows: arguments[0],
			spec: arguments[1] || {}
		});
		return this.fallbackEngine.computeCorrelation(...arguments);
	}
	findExtremes() {
		if (typeof this.execute === "function") return this.execute({
			kind: "findExtremes",
			rows: arguments[0],
			spec: arguments[1] || {}
		});
		return this.fallbackEngine.findExtremes(...arguments);
	}
	findOutliers() {
		if (typeof this.execute === "function") return this.execute({
			kind: "findOutliers",
			rows: arguments[0],
			spec: arguments[1] || {}
		});
		return this.fallbackEngine.findOutliers(...arguments);
	}
	compareGroups() {
		if (typeof this.execute === "function") return this.execute({
			kind: "compareGroups",
			rows: arguments[0],
			spec: arguments[1] || {}
		});
		return this.fallbackEngine.compareGroups(...arguments);
	}
	describeEngine() {
		const summary = super.describeEngine();
		return {
			...summary,
			capabilities: {
				...summary.capabilities,
				localExecution: true,
				remoteExecution: false,
				sqlSupport: typeof this.execute === "function",
				fallbackEngine: true
			}
		};
	}
};
//#endregion
//#region ../../widgetva-kit/src/core/data/RemoteDataQueryEngine.js
var RemoteDataQueryEngine = class extends DataQueryEngine {
	constructor(options = {}) {
		super();
		const { request, execute } = options;
		this.request = request || execute || null;
		this.kind = "remote";
		this.fallbackEngine = new JsArrayDataQueryEngine(options);
	}
	unsupported() {
		return {
			ok: false,
			error: {
				code: "REMOTE_ENGINE_UNAVAILABLE",
				message: "Remote data query execution is not configured in this frontend runtime build."
			}
		};
	}
	listSupportedQueryKinds() {
		return [
			"schema",
			"sampleRows",
			"filter",
			"aggregate",
			"groupBy",
			"sql",
			"summary",
			"computeCorrelation",
			"findExtremes",
			"findOutliers",
			"compareGroups"
		];
	}
	getSchema() {
		return this.fallbackEngine.getSchema(...arguments);
	}
	filter() {
		return this.fallbackEngine.filter(...arguments);
	}
	sampleRows() {
		return this.fallbackEngine.sampleRows(...arguments);
	}
	executeSql() {
		if (typeof this.request === "function") return this.request({
			kind: "sql",
			rows: arguments[0],
			spec: arguments[1] || {}
		});
		return this.unsupported();
	}
	aggregate() {
		if (typeof this.request === "function") return this.request({
			kind: "aggregate",
			rows: arguments[0],
			spec: arguments[1] || {}
		});
		return this.fallbackEngine.aggregate(...arguments);
	}
	summarize() {
		if (typeof this.request === "function") return this.request({
			kind: "summary",
			rows: arguments[0],
			spec: arguments[1] || {}
		});
		return this.fallbackEngine.summarize(...arguments);
	}
	computeCorrelation() {
		if (typeof this.request === "function") return this.request({
			kind: "computeCorrelation",
			rows: arguments[0],
			spec: arguments[1] || {}
		});
		return this.fallbackEngine.computeCorrelation(...arguments);
	}
	findExtremes() {
		if (typeof this.request === "function") return this.request({
			kind: "findExtremes",
			rows: arguments[0],
			spec: arguments[1] || {}
		});
		return this.fallbackEngine.findExtremes(...arguments);
	}
	findOutliers() {
		if (typeof this.request === "function") return this.request({
			kind: "findOutliers",
			rows: arguments[0],
			spec: arguments[1] || {}
		});
		return this.fallbackEngine.findOutliers(...arguments);
	}
	compareGroups() {
		if (typeof this.request === "function") return this.request({
			kind: "compareGroups",
			rows: arguments[0],
			spec: arguments[1] || {}
		});
		return this.fallbackEngine.compareGroups(...arguments);
	}
	describeEngine() {
		const summary = super.describeEngine();
		return {
			...summary,
			capabilities: {
				...summary.capabilities,
				localExecution: typeof this.request !== "function",
				remoteExecution: typeof this.request === "function",
				sqlSupport: typeof this.request === "function",
				fallbackEngine: true
			}
		};
	}
};
//#endregion
//#region ../../widgetva-kit/src/core/data/index.js
function createDataQueryEngine({ kind = "js_array", ...options } = {}) {
	if (kind === "duckdb") return new DuckDbDataQueryEngine({
		kind,
		...options
	});
	if (kind === "remote") return new RemoteDataQueryEngine({
		kind,
		...options
	});
	return new JsArrayDataQueryEngine({
		kind,
		...options
	});
}
createDataQueryEngine({ kind: "js_array" }).listSupportedQueryKinds();
createDataQueryEngine({ kind: "js_array" });
Object.freeze([
	"scatter",
	"bar",
	"line",
	"heatmap"
]);
Object.freeze({
	scatter: [
		"perception.computeCorrelation",
		"perception.findOutliers",
		"perception.findExtremes"
	],
	bar: ["perception.compareGroups", "perception.findExtremes"],
	line: [
		"perception.detectAnomalies",
		"perception.findExtremes",
		"perception.compareGroups"
	],
	heatmap: ["perception.findExtremes", "perception.findOutliers"]
});
Object.freeze({
	scatter: ["scatter.identifyClusters", "scatter.showRegression"],
	bar: [
		"bar.toggleStackMode",
		"bar.sortBars",
		"bar.expandStack",
		"bar.highlightTopN",
		"bar.filterSubcategories",
		"bar.addBars",
		"bar.removeBars",
		"bar.addBarItems",
		"bar.removeBarItems"
	],
	line: [
		"line.highlightTrend",
		"line.showMovingAverage",
		"line.boldLines",
		"line.filterLines",
		"line.drillDownXAxis",
		"line.resetDrilldownXAxis",
		"line.resampleXAxis",
		"line.resetResampleXAxis"
	],
	heatmap: [
		"heatmap.adjustColorScale",
		"heatmap.transpose",
		"heatmap.highlightRegionByValue",
		"heatmap.drilldownAxis",
		"heatmap.resetDrilldown",
		"heatmap.addMarginalBars",
		"heatmap.thresholdMask",
		"heatmap.clusterRowsCols"
	]
});
[
	...buildBarActionDescriptors(),
	...buildHeatmapActionDescriptors(),
	...buildLineActionDescriptors(),
	...buildScatterActionDescriptors(),
	makeActionDescriptor({
		name: "widget.clearSelection",
		title: "Clear selection",
		description: "Clear the active page-backed selection state and rematerialize the official page view.",
		primitive: "reset",
		category: "selection",
		paramsSchema: {
			type: "object",
			properties: {}
		},
		effects: [makeSelectionEffect(null, "Clears the current page-backed selection.")]
	}),
	makeActionDescriptor({
		name: "widget.resetView",
		title: "Reset view",
		description: "Reset the official page view by clearing page-backed selection and domain parameters.",
		primitive: "reset",
		category: "viewTransform",
		paramsSchema: {
			type: "object",
			properties: {}
		},
		effects: [makeSelectionEffect(null, "Clears the current page-backed selections."), makeDomainEffect(null, "Clears page-backed domain selections.")]
	}),
	makeActionDescriptor({
		name: "widget.filterByValues",
		title: "Filter by values",
		description: "Filter the official page view to rows matching one or more categorical values when the underlying Vega-Lite spec exposes a point selection parameter.",
		primitive: "filter",
		category: "dataTransform",
		paramsSchema: {
			type: "object",
			required: ["field", "values"],
			properties: {
				field: { type: "string" },
				values: {
					type: "array",
					items: {},
					minItems: 1
				}
			}
		},
		effects: [makeSelectionEffect(null, "Updates the page-backed point selection used for filtering.")]
	})
];
//#endregion
//#region ../../widgetva-kit/src/index.js
var DEFAULT_WIDGETVA_AGENT_MODEL = DEFAULT_OPENROUTER_AGENT_MODEL;
//#endregion
//#region extension/src/background/openRouterAgentService.js
var WIDGETVA_AGENT_CONFIG_KEY = "widgetvaOfficialPageAgentConfig";
function clone(value) {
	return value == null ? value : JSON.parse(JSON.stringify(value));
}
function trimString(value) {
	return typeof value === "string" ? value.trim() : "";
}
function normalizeStoredAgentConfig(config = {}) {
	const apiKey = trimString(config?.apiKey);
	const model = trimString(config?.model) || DEFAULT_WIDGETVA_AGENT_MODEL;
	const siteUrl = trimString(config?.siteUrl);
	const appName = trimString(config?.appName) || "WidgetVA Official Page Integration";
	return {
		...apiKey ? { apiKey } : {},
		model,
		...siteUrl ? { siteUrl } : {},
		...appName ? { appName } : {}
	};
}
async function readStoredAgentConfig(storage) {
	return normalizeStoredAgentConfig((await storage.get("widgetvaOfficialPageAgentConfig"))?.["widgetvaOfficialPageAgentConfig"] || {});
}
async function writeStoredAgentConfig(storage, config = {}) {
	const next = normalizeStoredAgentConfig(config);
	await storage.set({ [WIDGETVA_AGENT_CONFIG_KEY]: next });
	return {
		apiKeyConfigured: Boolean(next.apiKey),
		model: next.model,
		siteUrl: next.siteUrl || null,
		appName: next.appName || null
	};
}
function buildOpenRouterChatRequest({ config = {}, payload = {} } = {}) {
	const apiKey = trimString(config?.apiKey);
	if (!apiKey) throw new Error("WidgetVA agent is not configured with an OpenRouter API key.");
	const messages = Array.isArray(payload?.messages) ? clone(payload.messages) : [];
	const messageSizes = messages.map((message, index) => ({
		index,
		role: trimString(message?.role) || "unknown",
		chars: typeof message?.content === "string" ? message.content.length : JSON.stringify(message?.content ?? "").length
	}));
	const totalMessageChars = messageSizes.reduce((total, entry) => total + entry.chars, 0);
	if (totalMessageChars > 25e4) {
		const summary = messageSizes.map((entry) => `${entry.index}:${entry.role}:${entry.chars}`).join(", ");
		throw new Error(`WidgetVA refused to send an oversized OpenRouter prompt (${totalMessageChars} chars; messages ${summary}). This usually means raw page text, code, rows, or full history leaked into the agent prompt.`);
	}
	return {
		url: "https://openrouter.ai/api/v1/chat/completions",
		init: {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
				...config?.siteUrl ? { "HTTP-Referer": config.siteUrl } : {},
				...config?.appName ? { "X-Title": config.appName } : {}
			},
			body: JSON.stringify({
				model: trimString(payload?.model) || config.model || DEFAULT_WIDGETVA_AGENT_MODEL,
				temperature: Number.isFinite(payload?.temperature) ? Number(payload.temperature) : .2,
				messages
			})
		}
	};
}
async function executeOpenRouterChat({ storage, fetchImpl, payload = {} } = {}) {
	const config = await readStoredAgentConfig(storage);
	const request = buildOpenRouterChatRequest({
		config,
		payload
	});
	const response = await fetchImpl(request.url, request.init);
	const json = await response.json();
	if (!response.ok) {
		const message = json?.error?.message || json?.message || "OpenRouter request failed.";
		throw new Error(message);
	}
	return {
		model: trimString(payload?.model) || config.model || DEFAULT_WIDGETVA_AGENT_MODEL,
		raw: json,
		content: json?.choices?.[0]?.message?.content || ""
	};
}
function createOpenRouterAgentService({ storage, fetchImpl } = {}) {
	if (!storage || typeof storage.get !== "function" || typeof storage.set !== "function") throw new Error("createOpenRouterAgentService requires a storage facade with get/set.");
	if (typeof fetchImpl !== "function") throw new Error("createOpenRouterAgentService requires fetchImpl().");
	return {
		async configure(params = {}) {
			return writeStoredAgentConfig(storage, params);
		},
		async readConfig() {
			const config = await readStoredAgentConfig(storage);
			return {
				apiKeyConfigured: Boolean(config.apiKey),
				model: config.model || DEFAULT_WIDGETVA_AGENT_MODEL,
				siteUrl: config.siteUrl || null,
				appName: config.appName || null
			};
		},
		async chat(params = {}) {
			return executeOpenRouterChat({
				storage,
				fetchImpl,
				payload: params
			});
		}
	};
}
//#endregion
//#region extension/src/background/serviceWorker.js
var agentService = createOpenRouterAgentService({
	storage: chrome.storage.local,
	fetchImpl: globalThis.fetch.bind(globalThis)
});
function summarizeError(error) {
	return {
		name: error?.name || "Error",
		message: error?.message || String(error || "Unknown WidgetVA agent bridge error.")
	};
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (!message || message.type !== "widgetva:official-page-agent-runtime") return false;
	const method = message.method;
	if (method !== "configure" && method !== "readConfig" && method !== "chat") {
		sendResponse({
			ok: false,
			error: {
				name: "Error",
				message: `Unsupported WidgetVA agent runtime method: ${String(method)}.`
			}
		});
		return false;
	}
	Promise.resolve().then(async () => {
		if (method === "configure") return agentService.configure(message.params || {});
		if (method === "readConfig") return agentService.readConfig();
		return agentService.chat(message.params || {});
	}).then((result) => {
		sendResponse({
			ok: true,
			result
		});
	}).catch((error) => {
		sendResponse({
			ok: false,
			error: summarizeError(error)
		});
	});
	return true;
});
//#endregion
