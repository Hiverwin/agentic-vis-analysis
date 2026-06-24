(function() {
	//#region ../../widgetva-kit/src/adapters/humanInteractionBindings.js
	function buildActionCall({ name, actionTargetRef, params }) {
		return {
			callId: `human_${Date.now()}`,
			name,
			actor: "human",
			targetRef: actionTargetRef || void 0,
			params: {
				targetRef: actionTargetRef || void 0,
				...params
			}
		};
	}
	function resolveCategoryField$1({ enc, interactionConfig }) {
		const preferredChannel = interactionConfig?.categoryFieldChannel;
		if (preferredChannel && enc?.[preferredChannel]?.field) return enc[preferredChannel].field;
		if (interactionConfig?.categoryField && typeof interactionConfig.categoryField === "string") return interactionConfig.categoryField;
		return enc.color?.field || enc.shape?.field || enc.detail?.field || enc.key?.field || enc.x?.field || enc.y?.field;
	}
	function resolveCellFields$1({ enc, interactionConfig }) {
		return {
			xField: interactionConfig?.xField || enc.x?.field || null,
			yField: interactionConfig?.yField || enc.y?.field || null
		};
	}
	function normalizeMultiBrushRules(rawRules) {
		if (!Array.isArray(rawRules)) return [];
		return rawRules.filter((rule) => typeof rule?.field === "string" && Array.isArray(rule?.range) && rule.range.length === 2).map((rule) => ({
			field: rule.field,
			range: [Math.min(...rule.range), Math.max(...rule.range)]
		}));
	}
	function buildFallbackSelection({ selectionSourceWidgetId, selectionType, domain, predicates, count, summary, fields, value, keyField, keys, field, values }) {
		return {
			selection_id: `sel_${Date.now()}`,
			source_widget_id: selectionSourceWidgetId || void 0,
			selection_type: selectionType,
			...domain ? { domain } : {},
			...Array.isArray(fields) ? { fields } : {},
			...value && typeof value === "object" && !Array.isArray(value) ? { value } : {},
			...typeof keyField === "string" ? { keyField } : {},
			...Array.isArray(keys) ? { keys } : {},
			...typeof field === "string" ? { field } : {},
			...Array.isArray(values) ? { values } : {},
			predicates,
			count,
			summary
		};
	}
	function bindWidgetHumanInteractions({ view, spec, interactionConfig, selectionSourceWidgetId, actionTargetRef, onActionCall, onSelectionChange }) {
		const data = Array.isArray(spec?.data?.values) ? spec.data.values : [];
		const enc = spec?.encoding || {};
		const cleanups = [];
		if (!interactionConfig || interactionConfig.mode === "none") return () => {};
		function emitBrushSelection() {
			try {
				const xField = enc.x?.field ?? "x";
				const yField = enc.y?.field ?? "y";
				let xMin;
				let xMax;
				let yMin;
				let yMax;
				const brush = view.signal("brush");
				if (brush && (Array.isArray(brush) || brush.x && brush.y)) {
					const xr = Array.isArray(brush) ? brush : brush.x;
					const yr = Array.isArray(brush) ? brush : brush.y;
					if (xr && yr && xr.length >= 2 && yr.length >= 2) {
						xMin = Math.min(xr[0], xr[1]);
						xMax = Math.max(xr[0], xr[1]);
						yMin = Math.min(yr[0], yr[1]);
						yMax = Math.max(yr[0], yr[1]);
					}
				}
				if (xMin == null) {
					const x1 = view.signal("brush_x_1");
					const x2 = view.signal("brush_x_2");
					const y1 = view.signal("brush_y_1");
					const y2 = view.signal("brush_y_2");
					if (x1 != null && x2 != null && y1 != null && y2 != null) {
						xMin = Math.min(x1, x2);
						xMax = Math.max(x1, x2);
						yMin = Math.min(y1, y2);
						yMax = Math.max(y1, y2);
					}
				}
				if (xMin == null) {
					const tupleStore = view.data?.("brush_store");
					const tuple = Array.isArray(tupleStore) && tupleStore.length > 0 ? tupleStore[0] : null;
					const fields = tuple?.fields;
					const values = tuple?.values;
					if (Array.isArray(fields) && Array.isArray(values) && fields.length >= 2 && values.length >= 2) {
						const xVal = values[0];
						const yVal = values[1];
						if (Array.isArray(xVal) && xVal.length >= 2 && Array.isArray(yVal) && yVal.length >= 2) {
							xMin = Math.min(xVal[0], xVal[1]);
							xMax = Math.max(xVal[0], xVal[1]);
							yMin = Math.min(yVal[0], yVal[1]);
							yMax = Math.max(yVal[0], yVal[1]);
						}
					}
				}
				if (xMin == null || xMax == null || yMin == null || yMax == null) {
					onSelectionChange?.(null);
					return;
				}
				const filtered = data.filter((row) => {
					const x = row?.[xField];
					const y = row?.[yField];
					return x != null && y != null && x >= xMin && x <= xMax && y >= yMin && y <= yMax;
				});
				if (onActionCall) {
					onActionCall(buildActionCall({
						name: interactionConfig.actionName || "scatter.brushRegion",
						actionTargetRef,
						params: {
							xField,
							yField,
							xRange: [xMin, xMax],
							yRange: [yMin, yMax]
						}
					}));
					return;
				}
				onSelectionChange?.(buildFallbackSelection({
					selectionSourceWidgetId,
					selectionType: "interval",
					fields: [xField, yField],
					value: {
						[xField]: [xMin, xMax],
						[yField]: [yMin, yMax]
					},
					domain: {
						xDomain: [xMin, xMax],
						yDomain: [yMin, yMax]
					},
					predicates: [{
						field: xField,
						op: "between",
						value: [xMin, xMax]
					}, {
						field: yField,
						op: "between",
						value: [yMin, yMax]
					}],
					count: filtered.length,
					summary: `${xField} ${xMin.toFixed(1)}–${xMax.toFixed(1)}, ${yField} ${yMin.toFixed(1)}–${yMax.toFixed(1)}`
				}));
			} catch {
				onSelectionChange?.(null);
			}
		}
		function emitCategorySelection(_event, item) {
			try {
				const categoryField = resolveCategoryField$1({
					enc,
					interactionConfig
				});
				const categoryValue = categoryField ? item?.datum?.[categoryField] : void 0;
				if (!categoryField || categoryValue == null) return;
				const matched = data.filter((row) => row?.[categoryField] === categoryValue);
				if (onActionCall) {
					onActionCall(buildActionCall({
						name: interactionConfig.actionName || "bar.selectCategory",
						actionTargetRef,
						params: {
							field: categoryField,
							values: [categoryValue]
						}
					}));
					return;
				}
				onSelectionChange?.(buildFallbackSelection({
					selectionSourceWidgetId,
					selectionType: "category",
					field: categoryField,
					values: [categoryValue],
					predicates: [{
						field: categoryField,
						op: "in",
						value: [categoryValue]
					}],
					count: matched.length,
					summary: `${categoryField}: ${String(categoryValue)}`
				}));
			} catch {
				onSelectionChange?.(null);
			}
		}
		function emitCellSelection(_event, item) {
			try {
				const { xField, yField } = resolveCellFields$1({
					enc,
					interactionConfig
				});
				const xValue = xField ? item?.datum?.[xField] : void 0;
				const yValue = yField ? item?.datum?.[yField] : void 0;
				if (!xField || !yField || xValue == null || yValue == null) return;
				const matched = data.filter((row) => row?.[xField] === xValue && row?.[yField] === yValue);
				if (onActionCall) {
					onActionCall(buildActionCall({
						name: interactionConfig.actionName || "heatmap.selectCell",
						actionTargetRef,
						params: {
							xField,
							yField,
							xValue,
							yValue
						}
					}));
					return;
				}
				onSelectionChange?.(buildFallbackSelection({
					selectionSourceWidgetId,
					selectionType: "cell",
					fields: [xField, yField],
					value: {
						[xField]: xValue,
						[yField]: yValue
					},
					predicates: [{
						field: xField,
						op: "equals",
						value: xValue
					}, {
						field: yField,
						op: "equals",
						value: yValue
					}],
					count: matched.length,
					summary: `${xField}: ${String(xValue)}; ${yField}: ${String(yValue)}`
				}));
			} catch {
				onSelectionChange?.(null);
			}
		}
		function emitMultiBrushSelection(...args) {
			try {
				const rules = normalizeMultiBrushRules(args.find((value) => Array.isArray(value)) || interactionConfig?.rules);
				if (rules.length === 0) return;
				const matched = data.filter((row) => rules.every((rule) => {
					const value = row?.[rule.field];
					return typeof value === "number" && value >= rule.range[0] && value <= rule.range[1];
				}));
				if (onActionCall) {
					onActionCall(buildActionCall({
						name: interactionConfig.actionName || "parallelCoordinates.brushAxes",
						actionTargetRef,
						params: { rules }
					}));
					return;
				}
				onSelectionChange?.(buildFallbackSelection({
					selectionSourceWidgetId,
					selectionType: "interval",
					predicates: rules.map((rule) => ({
						field: rule.field,
						op: "between",
						value: rule.range
					})),
					count: matched.length,
					summary: rules.map((rule) => `${rule.field} ${rule.range[0]}–${rule.range[1]}`).join("; ")
				}));
			} catch {
				onSelectionChange?.(null);
			}
		}
		if (interactionConfig.mode === "brush2d") {
			try {
				view.addSignalListener("brush", emitBrushSelection);
				cleanups.push(() => view.removeSignalListener?.("brush", emitBrushSelection));
			} catch {}
			for (const signalName of [
				"brush_x_1",
				"brush_x_2",
				"brush_y_1",
				"brush_y_2"
			]) try {
				view.addSignalListener(signalName, emitBrushSelection);
				cleanups.push(() => view.removeSignalListener?.(signalName, emitBrushSelection));
			} catch {}
			try {
				view.addEventListener("mouseup", emitBrushSelection);
				cleanups.push(() => view.removeEventListener?.("mouseup", emitBrushSelection));
			} catch {}
		}
		if (interactionConfig.mode === "categoryClick") try {
			view.addEventListener("click", emitCategorySelection);
			cleanups.push(() => view.removeEventListener?.("click", emitCategorySelection));
		} catch {}
		if (interactionConfig.mode === "cellClick") try {
			view.addEventListener("click", emitCellSelection);
			cleanups.push(() => view.removeEventListener?.("click", emitCellSelection));
		} catch {}
		if (interactionConfig.mode === "multiBrush") for (const signalName of ["widgetva_multiBrush", "multiBrush"]) try {
			view.addSignalListener(signalName, emitMultiBrushSelection);
			cleanups.push(() => view.removeSignalListener?.(signalName, emitMultiBrushSelection));
		} catch {}
		return () => {
			cleanups.forEach((cleanup) => {
				try {
					cleanup();
				} catch {}
			});
		};
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgetAdapterContract.js
	function defaultHumanInteraction() {
		return {
			mode: "none",
			actionName: null,
			supportsDirectManipulation: false
		};
	}
	function assertFunction(name, value) {
		if (value == null) return;
		if (typeof value !== "function") throw new Error(`Widget adapter contract field ${name} must be a function when provided.`);
	}
	function assertRequiredFunction(name, value) {
		if (typeof value !== "function") throw new Error(`Widget adapter instance requires ${name}() to be provided.`);
	}
	function assertObject(name, value) {
		if (value == null) return;
		if (typeof value !== "object" || Array.isArray(value)) throw new Error(`Widget adapter contract field ${name} must be an object when provided.`);
	}
	function defaultProviderCapabilities() {
		return {
			supportedWidgetKinds: [],
			renderStrategy: "custom",
			stateApplyStrategy: "custom",
			interactionBindingStrategy: "custom",
			supportsRendererMount: false,
			supportsRendererUpdate: false,
			supportsRendererDispose: false,
			supportsSignalPatching: false,
			supportsOptionMerging: false,
			supportsImperativeRender: false,
			supportsPointSelection: false,
			supportsIntervalSelection: false,
			supportsZoomPan: false,
			supportsFocusReadback: false,
			supportsSelectionReadback: false,
			supportsViewportReadback: false,
			supportsHighlightProjection: false,
			supportsInteractionEvents: false
		};
	}
	function looksLikeWidgetState(value) {
		return value != null && typeof value === "object" && !Array.isArray(value) && (typeof value.widgetId === "string" || typeof value.ref === "string" || typeof value.kind === "string" || value.view != null || value.selections != null || value.data != null || value.feedback != null);
	}
	function normalizeApplyStateArgs(args) {
		if (args != null && typeof args === "object" && !Array.isArray(args) && Object.prototype.hasOwnProperty.call(args, "state")) return args;
		if (looksLikeWidgetState(args)) return { state: args };
		return args;
	}
	function createWidgetAdapterInstance({ definition, widgetRef, dataRef, getDescription, getState, humanInteraction, bindHumanInteractions, applyState, mount, update, dispose, readSelection, readViewport, metadata }) {
		assertRequiredFunction("getDescription", getDescription);
		assertRequiredFunction("getState", getState);
		const resolvedHumanInteraction = humanInteraction || definition.getHumanInteractionConfig?.() || defaultHumanInteraction();
		const resolvedBindHumanInteractions = bindHumanInteractions || definition.bindHumanInteractions || (() => {});
		const resolvedApplyState = applyState || definition.applyState || (() => {});
		const resolvedMount = mount || definition.mount || (() => null);
		const resolvedUpdate = update || definition.update || (() => null);
		const resolvedDispose = dispose || definition.dispose || (() => {});
		const resolvedReadSelection = readSelection || definition.readSelection || (() => null);
		const resolvedReadViewport = readViewport || definition.readViewport || (() => null);
		return {
			kind: definition.kind,
			provider: definition.provider || "custom",
			providerCapabilities: {
				...defaultProviderCapabilities(),
				...definition.providerCapabilities || {}
			},
			widgetRef,
			dataRef,
			metadata: metadata || {},
			getDescription,
			getState,
			buildActionDescriptors(args) {
				return definition.buildActionDescriptors?.(args) || [];
			},
			buildPerceptionDescriptors(args) {
				return definition.buildPerceptionDescriptors?.(args) || [];
			},
			registerActions(router) {
				definition.registerActions?.(router);
			},
			registerPerceptionQueries(registry) {
				definition.registerPerceptionQueries?.(registry);
			},
			bindHumanInteractions: resolvedBindHumanInteractions,
			applyState(args) {
				return resolvedApplyState(normalizeApplyStateArgs(args));
			},
			mount(args = {}) {
				return resolvedMount(args);
			},
			update(args = {}) {
				return resolvedUpdate(args);
			},
			dispose(args = {}) {
				return resolvedDispose(args);
			},
			readSelection(args = {}) {
				return resolvedReadSelection(args);
			},
			readViewport(args = {}) {
				return resolvedReadViewport(args);
			},
			describeCapabilities() {
				return {
					provider: definition.provider || "custom",
					providerCapabilities: {
						...defaultProviderCapabilities(),
						...definition.providerCapabilities || {}
					}
				};
			},
			getHumanInteractionConfig() {
				return resolvedHumanInteraction;
			}
		};
	}
	function createWidgetAdapterDefinition(definition) {
		if (!definition?.kind || typeof definition.kind !== "string") throw new Error("Widget adapter definition requires a string kind.");
		assertFunction("buildActionDescriptors", definition?.buildActionDescriptors);
		assertFunction("buildPerceptionDescriptors", definition?.buildPerceptionDescriptors);
		assertFunction("getHumanInteractionConfig", definition?.getHumanInteractionConfig);
		assertFunction("registerActions", definition?.registerActions);
		assertFunction("registerPerceptionQueries", definition?.registerPerceptionQueries);
		assertFunction("bindHumanInteractions", definition?.bindHumanInteractions);
		assertFunction("applyState", definition?.applyState);
		assertFunction("mount", definition?.mount);
		assertFunction("update", definition?.update);
		assertFunction("dispose", definition?.dispose);
		assertFunction("readSelection", definition?.readSelection);
		assertFunction("readViewport", definition?.readViewport);
		assertObject("providerCapabilities", definition?.providerCapabilities);
		return {
			provider: "custom",
			providerCapabilities: defaultProviderCapabilities(),
			buildActionDescriptors: () => [],
			buildPerceptionDescriptors: () => [],
			getHumanInteractionConfig: defaultHumanInteraction,
			registerActions: () => {},
			registerPerceptionQueries: () => {},
			bindHumanInteractions: () => () => {},
			applyState: () => {},
			mount: () => null,
			update: () => null,
			dispose: () => {},
			readSelection: () => null,
			readViewport: () => null,
			createInstance(args) {
				return createWidgetAdapterInstance({
					definition,
					humanInteraction: definition.getHumanInteractionConfig?.(),
					bindHumanInteractions: definition.bindHumanInteractions,
					applyState: definition.applyState,
					mount: definition.mount,
					update: definition.update,
					dispose: definition.dispose,
					readSelection: definition.readSelection,
					readViewport: definition.readViewport,
					...args
				});
			},
			...definition
		};
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/actors.js
	function cloneValue$32(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	var RUNTIME_ACTORS = [
		"agent",
		"human",
		"system"
	];
	function describeRuntimeActorSchema() {
		return cloneValue$32({
			type: "string",
			enum: RUNTIME_ACTORS
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/queryScope.js
	function cloneValue$31(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function describeQueryScopeSchema() {
		return cloneValue$31({
			type: "object",
			additionalProperties: false,
			properties: {
				widgetRef: { type: "string" },
				dataRef: { type: "string" },
				selectionRef: { type: "string" },
				focusRef: { type: "string" },
				viewportRef: { type: "string" }
			}
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/actions.js
	var ACTION_PRIMITIVES = [
		"filter",
		"sort",
		"aggregate",
		"reencode",
		"zoom",
		"select",
		"highlight",
		"navigate",
		"compare",
		"annotate",
		"reset",
		"undo",
		"redo"
	];
	var ACTION_CATEGORIES = [
		"dataTransform",
		"visualMapping",
		"viewTransform",
		"selection",
		"annotation",
		"navigation",
		"coordination"
	];
	var ACTION_EFFECT_KINDS = [
		"updatesSelection",
		"filtersWidget",
		"updatesViewDomain",
		"changesEncoding",
		"highlightsItems"
	];
	function cloneValue$30(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function withOptionalQueryScope$1(paramsSchema) {
		if (!paramsSchema || typeof paramsSchema !== "object" || Array.isArray(paramsSchema)) return {
			type: "object",
			properties: { queryScope: describeQueryScopeSchema() }
		};
		return {
			...cloneValue$30(paramsSchema),
			properties: {
				...cloneValue$30(paramsSchema.properties) || {},
				queryScope: describeQueryScopeSchema()
			}
		};
	}
	function describeActionPrimitiveSchema() {
		return cloneValue$30({
			type: "string",
			enum: ACTION_PRIMITIVES
		});
	}
	function describeActionCategorySchema() {
		return cloneValue$30({
			type: "string",
			enum: ACTION_CATEGORIES
		});
	}
	function makeActionDescriptor(descriptor) {
		const paramsSchema = withOptionalQueryScope$1(descriptor?.paramsSchema);
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
	function describeActionEffectSchema() {
		return cloneValue$30({
			type: "object",
			properties: {
				kind: {
					type: "string",
					enum: ACTION_EFFECT_KINDS
				},
				ref: { type: ["string", "null"] },
				description: { type: "string" }
			}
		});
	}
	function describeActionConditionSchema() {
		return cloneValue$30({
			type: "object",
			properties: {
				description: { type: "string" },
				checkHint: { type: "string" },
				failureMessage: { type: "string" }
			}
		});
	}
	function describeActionExampleSchema() {
		return cloneValue$30({
			type: "object",
			properties: {
				userGoal: { type: "string" },
				params: { type: "object" }
			}
		});
	}
	function describeActionDescriptorSchema() {
		return cloneValue$30({
			type: "object",
			required: [
				"name",
				"title",
				"description",
				"primitive",
				"category"
			],
			properties: {
				name: { type: "string" },
				title: { type: "string" },
				description: { type: "string" },
				primitive: describeActionPrimitiveSchema(),
				category: describeActionCategorySchema(),
				scope: { type: "string" },
				supportedWidgetKinds: { anyOf: [{ type: "null" }, {
					type: "array",
					items: { type: "string" }
				}] },
				targetRef: { type: ["string", "null"] },
				affectedRefs: {
					type: "array",
					items: { type: "string" }
				},
				affectedStatePaths: {
					type: "array",
					items: { type: "string" }
				},
				paramsSchema: { type: "object" },
				reversible: { type: "boolean" },
				preconditions: {
					type: "array",
					items: describeActionConditionSchema()
				},
				postconditions: {
					type: "array",
					items: describeActionConditionSchema()
				},
				effects: {
					type: "array",
					items: describeActionEffectSchema()
				},
				examples: {
					type: "array",
					items: describeActionExampleSchema()
				}
			}
		});
	}
	function describeActionCallSchema() {
		return cloneValue$30({
			type: "object",
			additionalProperties: false,
			required: ["name", "params"],
			properties: {
				callId: { type: "string" },
				name: { type: "string" },
				actor: describeRuntimeActorSchema(),
				reason: { type: "string" },
				queryScope: describeQueryScopeSchema(),
				params: { type: "object" }
			}
		});
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
	function makeHighlightEffect(ref, description) {
		return {
			kind: "highlightsItems",
			ref,
			description
		};
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/dataHandles.js
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
	function cloneValue$29(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function describeDataQueryPredicateSchema() {
		return cloneValue$29({
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
		});
	}
	function withOptionalScopedDataTarget(schema) {
		const nextSchema = cloneValue$29(schema);
		const nextProperties = nextSchema.properties || {};
		return {
			...nextSchema,
			properties: {
				...nextProperties,
				queryScope: describeQueryScopeSchema()
			}
		};
	}
	function describeDataQueryMeasureSchema() {
		return cloneValue$29({
			type: "object",
			additionalProperties: false,
			properties: {
				op: { type: "string" },
				field: { type: "string" },
				as: { type: "string" }
			},
			required: ["op"]
		});
	}
	function describeDataQuerySqlSpecSchema() {
		return cloneValue$29({
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
		});
	}
	function describeDataQuerySummarySpecSchema() {
		return cloneValue$29({
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
					items: describeDataQueryMeasureSchema()
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
		});
	}
	function describeDataQueryCorrelationSpecSchema() {
		return cloneValue$29({
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
		});
	}
	function describeDataQueryExtremesSpecSchema() {
		return cloneValue$29({
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
		});
	}
	function describeDataQueryOutliersSpecSchema() {
		return cloneValue$29({
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
		});
	}
	function describeDataQueryCompareGroupsSpecSchema() {
		return cloneValue$29({
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
		});
	}
	function describeDataQueryAggregateSpecSchema() {
		return cloneValue$29({
			type: "object",
			additionalProperties: false,
			properties: {
				groupBy: {
					type: "array",
					items: { type: "string" }
				},
				measures: {
					type: "array",
					items: describeDataQueryMeasureSchema()
				},
				metrics: {
					type: "array",
					items: describeDataQueryMeasureSchema()
				}
			}
		});
	}
	function describeDataQueryCallQuerySchema() {
		return cloneValue$29({
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
		});
	}
	function describeDataRecordSchema() {
		return cloneValue$29({ type: "object" });
	}
	function describeDataSummaryRowSchema() {
		return cloneValue$29({ type: "object" });
	}
	function describeDataGroupComparisonSchema() {
		return cloneValue$29({ type: ["object", "null"] });
	}
	function describeDataSchemaResultSchema() {
		return cloneValue$29({
			type: "object",
			properties: { fields: {
				type: "array",
				items: describeDataFieldSchema()
			} }
		});
	}
	function describeDataRowsResultSchema() {
		return cloneValue$29({
			type: "array",
			items: describeDataRecordSchema()
		});
	}
	function describeDataSummaryTableSchema() {
		return cloneValue$29({
			type: "object",
			properties: { rows: {
				type: "array",
				items: describeDataSummaryRowSchema()
			} }
		});
	}
	function describeDataGroupComparisonResultSchema() {
		return cloneValue$29({
			type: "object",
			properties: {
				groupField: { type: ["string", "null"] },
				valueField: { type: ["string", "null"] },
				groups: {
					type: "array",
					items: describeDataSummaryRowSchema()
				},
				comparison: describeDataGroupComparisonSchema()
			}
		});
	}
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
	var DATA_QUERY_RESULT_SCHEMAS = {
		schema: describeDataSchemaResultSchema(),
		sampleRows: describeDataRowsResultSchema(),
		filter: {
			type: "object",
			properties: {
				rows: describeDataRowsResultSchema(),
				rowCount: { type: "integer" },
				predicates: {
					type: "array",
					items: describeDataQueryPredicateSchema()
				}
			}
		},
		aggregate: describeDataSummaryTableSchema(),
		groupBy: describeDataSummaryTableSchema(),
		sql: describeDataRowsResultSchema(),
		summary: describeDataSummaryTableSchema(),
		computeCorrelation: {
			type: "object",
			properties: {
				xField: { type: "string" },
				yField: { type: "string" },
				correlation: { type: ["number", "null"] },
				sampleSize: { type: "integer" }
			}
		},
		findExtremes: describeDataSummaryTableSchema(),
		findOutliers: describeDataSummaryTableSchema(),
		compareGroups: describeDataGroupComparisonResultSchema()
	};
	var DATA_QUERY_SCHEMAS = {
		schema: withOptionalScopedDataTarget({
			type: "object",
			additionalProperties: false,
			properties: {}
		}),
		sampleRows: withOptionalScopedDataTarget({
			type: "object",
			additionalProperties: false,
			properties: { limit: {
				type: "integer",
				minimum: 1,
				maximum: 500
			} }
		}),
		filter: withOptionalScopedDataTarget({
			type: "object",
			additionalProperties: false,
			properties: { predicates: {
				type: "array",
				minItems: 1,
				items: describeDataQueryPredicateSchema()
			} },
			required: ["predicates"]
		}),
		aggregate: withOptionalScopedDataTarget(describeDataQueryAggregateSpecSchema()),
		groupBy: withOptionalScopedDataTarget(describeDataQueryAggregateSpecSchema()),
		sql: withOptionalScopedDataTarget(describeDataQuerySqlSpecSchema()),
		summary: withOptionalScopedDataTarget(describeDataQuerySummarySpecSchema()),
		computeCorrelation: withOptionalScopedDataTarget(describeDataQueryCorrelationSpecSchema()),
		findExtremes: withOptionalScopedDataTarget(describeDataQueryExtremesSpecSchema()),
		findOutliers: withOptionalScopedDataTarget(describeDataQueryOutliersSpecSchema()),
		compareGroups: withOptionalScopedDataTarget(describeDataQueryCompareGroupsSpecSchema())
	};
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
	function describeDataFieldSchema() {
		return cloneValue$29({
			type: "object",
			required: ["name", "type"],
			properties: {
				name: { type: "string" },
				type: { type: "string" },
				nullable: { type: "boolean" },
				description: { type: "string" }
			}
		});
	}
	function describeDataQueryDescriptorSchema() {
		return cloneValue$29({
			type: "object",
			required: [
				"name",
				"title",
				"description",
				"resultKind"
			],
			properties: {
				name: {
					type: "string",
					enum: DATA_QUERY_KINDS
				},
				title: { type: "string" },
				description: { type: "string" },
				resultKind: { type: "string" },
				inputSchema: { type: "object" },
				resultSchema: { type: [
					"object",
					"array",
					"null"
				] },
				examples: {
					type: "array",
					items: {
						type: "object",
						properties: { spec: { type: "object" } }
					}
				}
			}
		});
	}
	function describeDataHandleSchema() {
		return cloneValue$29({
			type: "object",
			required: [
				"ref",
				"title",
				"sourceKind",
				"supportedQueries"
			],
			properties: {
				ref: { type: "string" },
				title: { type: "string" },
				description: { type: "string" },
				sourceKind: { type: "string" },
				kind: { type: "string" },
				scope: { type: "string" },
				widgetRef: { type: "string" },
				sourceSelectionRef: { type: "string" },
				schema: { ...describeDataSchemaResultSchema() },
				stats: {
					type: "object",
					properties: {
						rowCount: { type: "integer" },
						visibleCount: { type: "integer" },
						selectedCount: { type: "integer" }
					}
				},
				supportedQueries: {
					type: "array",
					items: {
						type: "string",
						enum: DATA_QUERY_KINDS
					}
				},
				supportedQueryDescriptors: {
					type: "array",
					items: describeDataQueryDescriptorSchema()
				}
			}
		});
	}
	function describeDataQueryCallSchema() {
		return cloneValue$29({
			type: "object",
			additionalProperties: false,
			required: ["query"],
			properties: {
				callId: { type: "string" },
				actor: describeRuntimeActorSchema(),
				dataRef: { type: "string" },
				query: describeDataQueryCallQuerySchema()
			}
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/refs.js
	var REF_KINDS = [
		"widget",
		"selection",
		"data",
		"link",
		"action"
	];
	var REF_PATTERN = "^wl:\\/\\/[^/]+\\/workspace\\/[^/]+\\/.+$";
	function cloneValue$28(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function describeRefSchema() {
		return cloneValue$28({
			type: "string",
			pattern: REF_PATTERN
		});
	}
	function describeRefPartsSchema() {
		return cloneValue$28({
			type: "object",
			required: [
				"appId",
				"workspaceId",
				"kind",
				"path",
				"localId",
				"segments"
			],
			properties: {
				appId: { type: "string" },
				workspaceId: { type: "string" },
				kind: {
					type: "string",
					enum: REF_KINDS
				},
				path: { type: "string" },
				localId: { type: ["string", "null"] },
				segments: {
					type: "array",
					items: { type: "string" }
				},
				widgetId: { type: ["string", "null"] },
				selectionId: { type: ["string", "null"] },
				dataId: { type: ["string", "null"] },
				linkId: { type: ["string", "null"] },
				actionId: { type: ["string", "null"] }
			}
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/interactionTrace.js
	function cloneValue$27(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	var INTERACTION_TRACE_EVENT_KINDS = [
		"action",
		"perceptionQuery",
		"dataQuery",
		"systemTransition"
	];
	var INTERACTION_TRACE_EVENT_FAMILIES = [
		"action",
		"query",
		"systemTransition"
	];
	var INTERACTION_TRACE_QUERY_SURFACES = ["perception", "data"];
	function describeInteractionTraceActorSchema() {
		return describeRuntimeActorSchema();
	}
	function describeInteractionTraceEventKindSchema() {
		return cloneValue$27({
			type: "string",
			enum: INTERACTION_TRACE_EVENT_KINDS
		});
	}
	function describeInteractionTraceEventFamilySchema() {
		return cloneValue$27({
			type: "string",
			enum: INTERACTION_TRACE_EVENT_FAMILIES
		});
	}
	function describeInteractionTraceQuerySurfaceSchema() {
		return cloneValue$27({
			type: "string",
			enum: INTERACTION_TRACE_QUERY_SURFACES
		});
	}
	function describeInteractionTraceNotesSchema() {
		return cloneValue$27({
			type: "object",
			properties: {
				outcome: {
					type: "string",
					enum: ["success", "failure"]
				},
				errorCode: { type: "string" },
				errorMessage: { type: "string" },
				details: {},
				recoveryHints: {
					type: "array",
					items: { type: "string" }
				},
				rationale: { type: "string" },
				verification: { type: "string" },
				userVisibleSummary: { type: "string" }
			}
		});
	}
	function describeInteractionTraceActionSchema() {
		return cloneValue$27({ anyOf: [{
			type: "object",
			required: ["name"],
			properties: {
				name: { type: "string" },
				targetRef: describeRefSchema(),
				params: { type: "object" },
				actor: describeRuntimeActorSchema(),
				callId: { type: "string" }
			}
		}, describeActionCallSchema()] });
	}
	function describeInteractionTraceQuerySchema() {
		return cloneValue$27({ anyOf: [describeDataQueryCallSchema(), {
			type: "object",
			required: ["name"],
			properties: {
				name: { type: "string" },
				targetRef: describeRefSchema(),
				params: { type: "object" },
				actor: describeRuntimeActorSchema(),
				callId: { type: "string" }
			}
		}] });
	}
	function describeInteractionTraceRecordSchema() {
		return cloneValue$27({
			type: "object",
			required: [
				"actor",
				"eventFamily",
				"eventKind",
				"affectedRefs",
				"stateId",
				"timestamp"
			],
			properties: {
				stateId: { type: "string" },
				parentStateId: { type: ["string", "null"] },
				branchId: { type: ["string", "null"] },
				actor: describeInteractionTraceActorSchema(),
				eventFamily: describeInteractionTraceEventFamilySchema(),
				eventKind: describeInteractionTraceEventKindSchema(),
				querySurface: { anyOf: [{ type: "null" }, describeInteractionTraceQuerySurfaceSchema()] },
				primitive: { type: ["string", "null"] },
				action: { anyOf: [{ type: "null" }, describeInteractionTraceActionSchema()] },
				query: { anyOf: [{ type: "null" }, describeInteractionTraceQuerySchema()] },
				affectedRefs: {
					type: "array",
					items: describeRefSchema()
				},
				statePatch: { type: "object" },
				timestamp: { type: "string" },
				notes: describeInteractionTraceNotesSchema()
			}
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/state.js
	function cloneValue$26(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	var SELECTION_KINDS = [
		"interval",
		"point",
		"category",
		"cell"
	];
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
	var SELECTION_PREDICATE_OPERATIONS = [
		"equals",
		"in",
		"between"
	];
	function describeFieldEncodingSchema() {
		return cloneValue$26({
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
				scale: { anyOf: [describeFieldScaleSchema(), { type: "null" }] }
			}
		});
	}
	function describeFieldScaleSchema() {
		return cloneValue$26({
			type: "object",
			properties: {
				domain: {},
				range: {},
				clamp: { type: "boolean" },
				nice: { type: "boolean" },
				zero: { type: "boolean" },
				type: { type: "string" }
			}
		});
	}
	function describeSelectionDomainAxisSchema() {
		return cloneValue$26({
			type: "array",
			minItems: 2,
			maxItems: 2,
			items: { anyOf: [
				{ type: "number" },
				{ type: "string" },
				{ type: "null" }
			] }
		});
	}
	function describeViewportStateSchema() {
		return cloneValue$26({
			type: "object",
			properties: {
				sourceWidgetRef: { type: ["string", "null"] },
				xDomain: { anyOf: [describeSelectionDomainAxisSchema(), { type: "null" }] },
				yDomain: { anyOf: [describeSelectionDomainAxisSchema(), { type: "null" }] },
				zoom: { anyOf: [{
					type: "object",
					properties: {
						level: { type: "number" },
						center: {
							type: "array",
							items: { type: "number" }
						}
					}
				}, { type: "null" }] }
			}
		});
	}
	function describeFocusStateSchema() {
		return cloneValue$26({
			type: "object",
			properties: {
				widgetRef: { type: ["string", "null"] },
				widgetId: { type: ["string", "null"] },
				source: { type: "string" }
			}
		});
	}
	function describeHighlightStateSchema() {
		return cloneValue$26({
			type: "object",
			properties: {
				entries: {
					type: "array",
					items: {
						type: "object",
						properties: {
							widgetRef: { type: ["string", "null"] },
							widgetId: { type: ["string", "null"] },
							highlightedKeys: {
								type: "array",
								items: {}
							},
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
							}
						}
					}
				},
				activeWidgetRefs: {
					type: "array",
					items: { type: "string" }
				}
			}
		});
	}
	function describeSelectionDomainSchema() {
		return cloneValue$26({
			type: "object",
			properties: {
				xDomain: describeSelectionDomainAxisSchema(),
				yDomain: describeSelectionDomainAxisSchema()
			}
		});
	}
	function describeSelectionPredicateSchema() {
		return cloneValue$26({
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
		});
	}
	function describeSelectionValueSchema() {
		return cloneValue$26({ type: "object" });
	}
	function describeTransformStateSchema() {
		return cloneValue$26({
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
		});
	}
	function describeViewZoomSchema() {
		return cloneValue$26({
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
		});
	}
	function describeViewSortSchema() {
		return cloneValue$26({
			type: "object",
			properties: {
				field: { type: "string" },
				order: {
					type: "string",
					enum: ["ascending", "descending"]
				}
			}
		});
	}
	function describeViewTransformStateSchema() {
		return cloneValue$26({
			type: "object",
			properties: {
				xDomain: { anyOf: [
					describeSelectionDomainAxisSchema(),
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
					describeSelectionDomainAxisSchema(),
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
				zoom: { anyOf: [describeViewZoomSchema(), { type: "null" }] },
				sort: { anyOf: [describeViewSortSchema(), { type: "null" }] }
			}
		});
	}
	function describeSelectionStateSchema() {
		return cloneValue$26({
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
				value: describeSelectionValueSchema(),
				domain: { anyOf: [describeSelectionDomainSchema(), { type: "null" }] },
				predicates: {
					type: "array",
					items: describeSelectionPredicateSchema()
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
		});
	}
	function describeInteractionTooltipSchema() {
		return cloneValue$26({ type: ["object", "null"] });
	}
	function describeInteractionHoveredItemSchema() {
		return cloneValue$26({ type: ["object", "null"] });
	}
	function describeInteractionFeedbackStateSchema() {
		return cloneValue$26({
			type: "object",
			properties: {
				hoveredItem: describeInteractionHoveredItemSchema(),
				highlightedKeys: {
					type: "array",
					items: { type: ["string", "number"] }
				},
				tooltip: describeInteractionTooltipSchema(),
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
		});
	}
	function describeWidgetHumanInteractionStateSchema() {
		return cloneValue$26({
			type: "object",
			properties: {
				mode: { type: "string" },
				actionName: { type: ["string", "null"] },
				supportsDirectManipulation: { type: "boolean" }
			}
		});
	}
	function describeWidgetDataStateSchema() {
		return cloneValue$26({
			type: "object",
			properties: {
				sourceDataRef: { type: ["string", "null"] },
				currentDataRef: { type: ["string", "null"] },
				rowCount: { type: "number" },
				visibleCount: { type: "number" },
				selectedCount: { type: "number" }
			}
		});
	}
	function describeWorkspaceAnnotationSchema() {
		return cloneValue$26({
			type: "object",
			required: [
				"annotationId",
				"kind",
				"text",
				"actor",
				"createdAt"
			],
			properties: {
				annotationId: { type: "string" },
				targetRef: { type: ["string", "null"] },
				kind: { type: "string" },
				text: { type: "string" },
				actor: describeRuntimeActorSchema(),
				createdAt: { type: "string" }
			}
		});
	}
	function describeWidgetEncodingsStateSchema() {
		return cloneValue$26({
			type: "object",
			additionalProperties: describeFieldEncodingSchema()
		});
	}
	function describeWidgetSelectionsStateSchema() {
		return cloneValue$26({
			type: "object",
			additionalProperties: describeSelectionStateSchema()
		});
	}
	function describeWidgetStateSchema() {
		return cloneValue$26({
			type: "object",
			required: [
				"version",
				"updatedAt",
				"data",
				"encodings",
				"transforms",
				"view",
				"selections"
			],
			properties: {
				ref: { type: "string" },
				widgetId: { type: "string" },
				kind: { type: "string" },
				role: { type: "string" },
				version: { type: "integer" },
				updatedAt: { type: "string" },
				data: describeWidgetDataStateSchema(),
				encodings: describeWidgetEncodingsStateSchema(),
				transforms: {
					type: "array",
					items: describeTransformStateSchema()
				},
				view: describeViewTransformStateSchema(),
				selections: describeWidgetSelectionsStateSchema(),
				feedback: describeInteractionFeedbackStateSchema(),
				humanInteraction: { anyOf: [describeWidgetHumanInteractionStateSchema(), { type: "null" }] },
				rawSpec: { type: ["object", "null"] }
			}
		});
	}
	function describeWorkspaceTaskContextSchema() {
		return cloneValue$26({
			type: "object",
			properties: {
				taskId: { type: "string" },
				userQuery: { type: "string" },
				taskMode: { type: "string" },
				runMode: { type: "string" },
				coordinationScope: { type: "string" },
				expectedAnswerType: { type: "string" },
				interactionHorizon: { type: "string" },
				evidenceType: { type: "string" },
				complexityBudget: { type: "string" },
				targetWidgetRefs: {
					type: "array",
					items: describeRefSchema()
				}
			}
		});
	}
	function describeWorkspaceReplayContextSchema() {
		return cloneValue$26({
			type: "object",
			properties: {
				baselineSpec: { type: ["object", "null"] },
				currentSpec: { type: ["object", "null"] },
				workspaceSpec: { type: ["object", "null"] },
				planningRequest: { type: ["object", "null"] },
				userIntent: { type: ["string", "null"] },
				runMode: { type: ["string", "null"] }
			}
		});
	}
	function describeWorkspaceDeltaSchema() {
		return cloneValue$26({
			type: "object",
			properties: {
				baseStateId: { type: "string" },
				changedRefs: {
					type: "array",
					items: { type: "string" }
				},
				removedRefs: {
					type: "array",
					items: { type: "string" }
				}
			}
		});
	}
	function describeWorkspaceSharedStateSchema() {
		return cloneValue$26({
			type: "object",
			properties: {
				selections: {
					type: "object",
					properties: {
						registry: {
							type: "object",
							additionalProperties: describeSelectionStateSchema()
						},
						views: {
							type: "object",
							properties: {
								primary: { anyOf: [describeSelectionStateSchema(), { type: "null" }] },
								byWidget: {
									type: "object",
									additionalProperties: describeSelectionStateSchema()
								}
							}
						}
					}
				},
				globalFilters: {
					type: "object",
					additionalProperties: {
						type: "array",
						items: describeSelectionPredicateSchema()
					}
				},
				viewport: { anyOf: [describeViewportStateSchema(), { type: "null" }] },
				focus: { anyOf: [describeFocusStateSchema(), { type: "null" }] },
				highlight: { anyOf: [describeHighlightStateSchema(), { type: "null" }] },
				focusedWidget: { anyOf: [describeRefSchema(), { type: "null" }] },
				annotations: {
					type: "array",
					items: describeWorkspaceAnnotationSchema()
				},
				links: {
					type: "object",
					properties: {
						definitions: {
							type: "array",
							items: { type: "object" }
						},
						topology: { type: "object" }
					}
				}
			}
		});
	}
	function describeWorkspaceStateSchema() {
		return cloneValue$26({
			type: "object",
			required: [
				"stateId",
				"createdAt",
				"widgets",
				"shared"
			],
			properties: {
				stateId: { type: "string" },
				createdAt: { type: "string" },
				widgets: {
					type: "object",
					additionalProperties: describeWidgetStateSchema()
				},
				shared: describeWorkspaceSharedStateSchema(),
				taskContext: { anyOf: [describeWorkspaceTaskContextSchema(), { type: "null" }] },
				replayContext: { anyOf: [describeWorkspaceReplayContextSchema(), { type: "null" }] },
				delta: { anyOf: [describeWorkspaceDeltaSchema(), { type: "null" }] }
			}
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/results.js
	function cloneValue$25(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	var RESULT_ERROR_CODES = [
		"UNKNOWN_OPERATION",
		"UNSUPPORTED_TARGET",
		"INVALID_PARAMS",
		"PRECONDITION_FAILED",
		"RUNTIME_ERROR",
		"UNKNOWN_QUERY",
		"UNKNOWN_DATA_REF",
		"UNKNOWN_QUERY_KIND",
		"UNSUPPORTED_QUERY_KIND",
		"INVALID_QUERY_SPEC"
	];
	function describeResultErrorSchema() {
		return cloneValue$25({
			type: "object",
			required: ["code", "message"],
			properties: {
				code: {
					type: "string",
					enum: RESULT_ERROR_CODES
				},
				message: { type: "string" },
				details: {}
			}
		});
	}
	function describeActionResultSchema() {
		return cloneValue$25({
			type: "object",
			required: [
				"ok",
				"callId",
				"actionName"
			],
			properties: {
				ok: { type: "boolean" },
				callId: { type: "string" },
				actionName: { type: "string" },
				updatedRefs: {
					type: "array",
					items: { type: "string" }
				},
				stateId: { type: ["string", "null"] },
				statePatch: { type: "object" },
				result: {},
				expectedPostconditions: {
					type: "array",
					items: describeActionConditionSchema()
				},
				verificationHints: {
					type: "array",
					items: { type: "string" }
				},
				recoveryHints: {
					type: "array",
					items: { type: "string" }
				},
				error: describeResultErrorSchema()
			}
		});
	}
	function describePerceptionResultSchema() {
		return cloneValue$25({
			type: "object",
			required: [
				"ok",
				"callId",
				"queryName"
			],
			properties: {
				ok: { type: "boolean" },
				callId: { type: "string" },
				queryName: { type: "string" },
				result: {},
				recoveryHints: {
					type: "array",
					items: { type: "string" }
				},
				error: describeResultErrorSchema()
			}
		});
	}
	function describeActionVerificationResultSchema() {
		return cloneValue$25({
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
					items: describeActionConditionSchema()
				},
				verificationHints: {
					type: "array",
					items: { type: "string" }
				},
				traceEvidence: { anyOf: [describeInteractionTraceRecordSchema(), { type: "null" }] },
				statePatch: { type: ["object", "null"] },
				finalSnapshot: { anyOf: [describeWorkspaceSnapshotSchema(), { type: "null" }] },
				linkPropagation: {
					type: "array",
					items: describeLinkPropagationEvaluationSchema()
				}
			}
		});
	}
	function describeDataQueryResultSchema() {
		return cloneValue$25({
			type: "object",
			required: ["ok", "dataRef"],
			properties: {
				ok: { type: "boolean" },
				dataRef: { type: ["string", "null"] },
				result: {},
				recoveryHints: {
					type: "array",
					items: { type: "string" }
				},
				error: describeResultErrorSchema()
			}
		});
	}
	function describeStateSnapshotMetaSchema() {
		return cloneValue$25({
			type: "object",
			required: ["stateId"],
			properties: {
				stateId: { type: "string" },
				createdAt: { type: ["string", "null"] },
				baseStateId: { type: ["string", "null"] },
				branchId: { type: ["string", "null"] },
				transitionType: { type: "string" },
				branchLabel: { type: ["string", "null"] },
				actor: describeRuntimeActorSchema(),
				changedRefs: {
					type: "array",
					items: { type: "string" }
				},
				removedRefs: {
					type: "array",
					items: { type: "string" }
				}
			}
		});
	}
	function describeWorkspaceSnapshotMetaSchema() {
		return cloneValue$25({
			type: "object",
			properties: {
				stateId: { type: ["string", "null"] },
				parentStateId: { type: ["string", "null"] },
				branchId: { type: ["string", "null"] },
				transitionType: { type: ["string", "null"] },
				branchLabel: { type: ["string", "null"] }
			}
		});
	}
	function describeWorkspaceSnapshotSchema() {
		return cloneValue$25({
			type: "object",
			required: [
				"stateId",
				"createdAt",
				"widgets",
				"shared"
			],
			properties: {
				stateId: { type: "string" },
				createdAt: { type: "string" },
				widgets: { type: "object" },
				shared: { type: "object" },
				taskContext: { type: ["object", "null"] },
				delta: { type: ["object", "null"] },
				replayContext: { anyOf: [describeWorkspaceReplayContextSchema(), { type: "null" }] },
				__meta: { anyOf: [describeWorkspaceSnapshotMetaSchema(), { type: "null" }] }
			}
		});
	}
	function describeBranchSummarySchema() {
		return cloneValue$25({
			type: "object",
			required: [
				"branchId",
				"label",
				"createdAt"
			],
			properties: {
				branchId: { type: "string" },
				label: { type: "string" },
				originStateId: { type: ["string", "null"] },
				parentBranchId: { type: ["string", "null"] },
				createdAt: { type: "string" }
			}
		});
	}
	function describeTraceGraphNodeSchema() {
		return cloneValue$25({
			type: "object",
			required: ["id", "stateId"],
			properties: {
				id: { type: "string" },
				stateId: { type: "string" },
				parentStateId: { type: ["string", "null"] },
				branchId: { type: ["string", "null"] },
				branchLabel: { type: ["string", "null"] },
				timestamp: { type: ["string", "null"] },
				actor: describeRuntimeActorSchema(),
				eventFamily: describeInteractionTraceEventFamilySchema(),
				querySurface: { anyOf: [{ type: "null" }, describeInteractionTraceQuerySurfaceSchema()] },
				actionName: { type: ["string", "null"] },
				queryName: { type: ["string", "null"] },
				responseId: { type: ["string", "null"] },
				responseActor: { anyOf: [describeRuntimeActorSchema(), { type: "null" }] },
				responsePreview: { type: ["string", "null"] },
				label: { type: "string" },
				transitionType: { type: "string" },
				current: { type: "boolean" }
			}
		});
	}
	function describeTraceGraphEdgeSchema() {
		return cloneValue$25({
			type: "object",
			required: [
				"id",
				"from_id",
				"to_id"
			],
			properties: {
				id: { type: "string" },
				from_id: { type: "string" },
				to_id: { type: "string" },
				edge_type: { type: "string" },
				branchId: { type: ["string", "null"] },
				label: { type: "string" },
				timestamp: { type: ["string", "null"] }
			}
		});
	}
	function describeTraceGraphSchema() {
		return cloneValue$25({
			type: "object",
			required: [
				"current_state_id",
				"current_branch_id",
				"branches",
				"nodes",
				"edges"
			],
			properties: {
				current_state_id: { type: ["string", "null"] },
				current_branch_id: { type: ["string", "null"] },
				sinceStateId: { type: ["string", "null"] },
				actors: {
					type: "array",
					items: describeRuntimeActorSchema()
				},
				branches: {
					type: "array",
					items: describeBranchSummarySchema()
				},
				nodes: {
					type: "array",
					items: describeTraceGraphNodeSchema()
				},
				edges: {
					type: "array",
					items: describeTraceGraphEdgeSchema()
				}
			}
		});
	}
	function describeLinkPropagationCheckSchema() {
		return cloneValue$25({
			type: "object",
			required: ["name", "passed"],
			properties: {
				name: { type: "string" },
				passed: { type: "boolean" },
				actual: {},
				expected: {}
			}
		});
	}
	function describeLinkPropagationResultSchema() {
		return cloneValue$25({
			type: "object",
			required: [
				"linkRef",
				"primitive",
				"passed",
				"checks"
			],
			properties: {
				linkRef: { type: "string" },
				primitive: { type: "string" },
				targetRef: { type: ["string", "null"] },
				activationPolicy: { type: "string" },
				effectConstraint: { type: ["string", "null"] },
				responseSpec: { type: ["object", "null"] },
				reason: { type: ["string", "null"] },
				passed: { type: "boolean" },
				checks: {
					type: "array",
					items: describeLinkPropagationCheckSchema()
				}
			}
		});
	}
	function describeLinkPropagationEvaluationSchema() {
		return cloneValue$25({
			type: "object",
			required: [
				"ok",
				"sourceRef",
				"linkCount",
				"passedCount",
				"consistencyScore",
				"results"
			],
			properties: {
				ok: { type: "boolean" },
				sourceRef: { type: ["string", "null"] },
				activeSelection: { anyOf: [describeSelectionStateSchema(), { type: "null" }] },
				linkCount: { type: "integer" },
				passedCount: { type: "integer" },
				consistencyScore: { type: "number" },
				results: {
					type: "array",
					items: describeLinkPropagationResultSchema()
				}
			}
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/perception.js
	var PERCEPTION_CATEGORIES = [
		"inspect",
		"summarize",
		"compute",
		"verify",
		"explain"
	];
	function cloneValue$24(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function withOptionalQueryScope(paramsSchema) {
		if (!paramsSchema || typeof paramsSchema !== "object" || Array.isArray(paramsSchema)) return {
			type: "object",
			properties: { queryScope: describeQueryScopeSchema() }
		};
		return {
			...cloneValue$24(paramsSchema),
			properties: {
				...cloneValue$24(paramsSchema.properties) || {},
				queryScope: describeQueryScopeSchema()
			}
		};
	}
	function describePerceptionCategorySchema() {
		return cloneValue$24({
			type: "string",
			enum: PERCEPTION_CATEGORIES
		});
	}
	function describePerceptionInspectViewConfigResultSchema() {
		return cloneValue$24({
			type: "object",
			properties: {
				ref: { type: ["string", "null"] },
				kind: { type: ["string", "null"] },
				encodings: {
					type: "object",
					additionalProperties: describeFieldEncodingSchema()
				},
				transforms: {
					type: "array",
					items: describeTransformStateSchema()
				},
				view: describeViewTransformStateSchema(),
				selections: {
					type: "object",
					additionalProperties: describeSelectionStateSchema()
				},
				feedback: { anyOf: [describeInteractionFeedbackStateSchema(), { type: "null" }] }
			}
		});
	}
	function describePerceptionInspectVisibleRowsResultSchema() {
		return cloneValue$24({
			type: "object",
			properties: {
				ref: { type: ["string", "null"] },
				dataRef: { type: ["string", "null"] },
				visibleCount: { type: "integer" },
				rows: describeDataRowsResultSchema()
			}
		});
	}
	function describePerceptionSummaryGroupsSchema() {
		return cloneValue$24({
			type: "array",
			items: describeDataSummaryTableSchema().properties.rows.items
		});
	}
	function describePerceptionSummarizeSelectionResultSchema() {
		return cloneValue$24({
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
				groups: describePerceptionSummaryGroupsSchema(),
				aggregates: describePerceptionSummaryGroupsSchema(),
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
		});
	}
	function describePerceptionSummarizeVisibleResultSchema() {
		return cloneValue$24({
			type: "object",
			properties: {
				dataRef: { type: ["string", "null"] },
				rowCount: { type: "integer" },
				groups: describePerceptionSummaryGroupsSchema(),
				aggregates: describePerceptionSummaryGroupsSchema(),
				summary: { type: ["string", "null"] }
			}
		});
	}
	function describePerceptionVerifyActionEffectParamsSchema() {
		return cloneValue$24({
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
		});
	}
	function describePerceptionVerifyActionEffectResultSchema() {
		return describeActionVerificationResultSchema();
	}
	var PERCEPTION_RETURN_SCHEMAS = {
		"perception.inspectViewConfig": describePerceptionInspectViewConfigResultSchema(),
		"perception.inspectVisibleRows": describePerceptionInspectVisibleRowsResultSchema(),
		"perception.summarizeSelection": describePerceptionSummarizeSelectionResultSchema(),
		"perception.summarizeVisible": describePerceptionSummarizeVisibleResultSchema(),
		"perception.verifyActionEffect": describePerceptionVerifyActionEffectResultSchema(),
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
				rows: describeDataRowsResultSchema()
			}
		},
		"perception.findOutliers": {
			type: "object",
			properties: {
				dataRef: { type: ["string", "null"] },
				field: { type: ["string", "null"] },
				method: { type: "string" },
				rows: describeDataRowsResultSchema()
			}
		},
		"perception.compareGroups": {
			type: "object",
			properties: {
				dataRef: { type: ["string", "null"] },
				groupField: { type: ["string", "null"] },
				valueField: { type: ["string", "null"] },
				groups: describeDataGroupComparisonResultSchema().properties.groups,
				comparison: describeDataGroupComparisonResultSchema().properties.comparison
			}
		}
	};
	function makePerceptionDescriptor(descriptor) {
		const returnsSchema = descriptor?.returnsSchema || (descriptor?.name ? PERCEPTION_RETURN_SCHEMAS[descriptor.name] : void 0);
		const paramsSchema = withOptionalQueryScope(descriptor?.paramsSchema || (descriptor?.name === "perception.verifyActionEffect" ? describePerceptionVerifyActionEffectParamsSchema() : void 0));
		return {
			...descriptor,
			targetRef: descriptor?.targetRef ?? null,
			paramsSchema: paramsSchema || withOptionalQueryScope({
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
	function describePerceptionExampleSchema() {
		return cloneValue$24({
			type: "object",
			properties: {
				userGoal: { type: "string" },
				params: { type: "object" }
			}
		});
	}
	function describePerceptionDescriptorSchema() {
		return cloneValue$24({
			type: "object",
			required: [
				"name",
				"title",
				"description",
				"category"
			],
			properties: {
				name: { type: "string" },
				title: { type: "string" },
				description: { type: "string" },
				category: describePerceptionCategorySchema(),
				targetRef: { type: ["string", "null"] },
				paramsSchema: { type: "object" },
				returnsSchema: { type: ["object", "null"] },
				sideEffectFree: { type: "boolean" },
				evidenceKinds: {
					type: "array",
					items: { type: "string" }
				},
				verificationTargets: {
					type: "array",
					items: { type: "string" }
				},
				examples: {
					type: "array",
					items: describePerceptionExampleSchema()
				}
			}
		});
	}
	function describePerceptionQueryCallSchema() {
		return cloneValue$24({
			type: "object",
			additionalProperties: false,
			required: ["name"],
			properties: {
				callId: { type: "string" },
				name: { type: "string" },
				actor: describeRuntimeActorSchema(),
				queryScope: describeQueryScopeSchema(),
				params: { type: "object" }
			}
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/widgetLinks.js
	function cloneValue$23(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	var WIDGET_LINK_KINDS = [
		"filter",
		"highlight",
		"syncDomain",
		"sharesSelection",
		"drillDown",
		"reencode",
		"aggregate",
		"structure",
		"contains",
		"usesData",
		"filters",
		"highlights",
		"syncsDomain",
		"comparesWith",
		"derivesFrom"
	];
	var WIDGET_LINK_EFFECTS = [
		"applyFilter",
		"applyHighlight",
		"focusTarget",
		"syncDomain",
		"shareSelection",
		"transformView",
		"transformDataView",
		"transformStructure",
		"updateData",
		"compare"
	];
	var WIDGET_LINK_ACTIVATION_POLICIES = ["automatic", "manual"];
	var WIDGET_LINK_EFFECT_CONSTRAINTS = ["highlightOnly", "focusOnly"];
	var WIDGET_LINK_ADVANCED_RESPONSE_KINDS = [
		"drillDown",
		"reencode",
		"aggregate",
		"expand",
		"collapse"
	];
	function describeWidgetLinkKindSchema() {
		return cloneValue$23({
			type: "string",
			enum: WIDGET_LINK_KINDS
		});
	}
	function describeWidgetLinkEffectSchema() {
		return cloneValue$23({
			type: ["string", "null"],
			enum: [...WIDGET_LINK_EFFECTS, null]
		});
	}
	function describeWidgetLinkActivationPolicySchema() {
		return cloneValue$23({
			type: "string",
			enum: WIDGET_LINK_ACTIVATION_POLICIES
		});
	}
	function describeWidgetLinkEffectConstraintSchema() {
		return cloneValue$23({
			type: ["string", "null"],
			enum: [...WIDGET_LINK_EFFECT_CONSTRAINTS, null]
		});
	}
	function describeWidgetLinkAdvancedResponseSchema() {
		return cloneValue$23({
			type: "object",
			properties: {
				kind: {
					type: "string",
					enum: WIDGET_LINK_ADVANCED_RESPONSE_KINDS
				},
				params: { type: "object" },
				verificationHints: { type: "object" }
			}
		});
	}
	function describeWidgetLinkSchema() {
		return cloneValue$23({
			type: "object",
			required: ["ref"],
			properties: {
				ref: describeRefSchema(),
				kind: describeWidgetLinkKindSchema(),
				from: { anyOf: [describeRefSchema(), { type: "null" }] },
				to: { anyOf: [describeRefSchema(), { type: "null" }] },
				sourceWidgetId: { type: "string" },
				targetWidgetId: { type: "string" },
				sourceRef: { anyOf: [describeRefSchema(), { type: "null" }] },
				targetRef: { anyOf: [describeRefSchema(), { type: "null" }] },
				sourceDataRef: { anyOf: [describeRefSchema(), { type: "null" }] },
				targetDataRef: { anyOf: [describeRefSchema(), { type: "null" }] },
				primitive: { type: ["string", "null"] },
				effect: describeWidgetLinkEffectSchema(),
				description: { type: "string" },
				fieldMapping: {
					type: "array",
					items: {
						type: "object",
						properties: {
							sourceField: { type: "string" },
							targetField: { type: "string" }
						}
					}
				},
				activationPolicy: describeWidgetLinkActivationPolicySchema(),
				effectConstraint: describeWidgetLinkEffectConstraintSchema(),
				responseSpec: { anyOf: [describeWidgetLinkAdvancedResponseSchema(), { type: "null" }] }
			}
		});
	}
	function describeWorkspaceTopologySummarySchema() {
		return cloneValue$23({
			type: "object",
			required: [
				"topology",
				"topologyLabel",
				"widgetCount",
				"edgeCount",
				"linkDensity",
				"sourceWidgetCount",
				"targetWidgetCount",
				"maxOutDegree",
				"maxInDegree",
				"rationale"
			],
			properties: {
				topology: { type: "string" },
				topologyLabel: { type: "string" },
				widgetCount: { type: "integer" },
				edgeCount: { type: "integer" },
				linkDensity: { type: "number" },
				sourceWidgetCount: { type: "integer" },
				targetWidgetCount: { type: "integer" },
				maxOutDegree: { type: "integer" },
				maxInDegree: { type: "integer" },
				rationale: {
					type: "array",
					items: { type: "string" }
				}
			}
		});
	}
	function describeLinkEngineSummarySchema() {
		return cloneValue$23({
			type: "object",
			required: [
				"primitiveCount",
				"primitives",
				"linkCount",
				"coordinationLinkCount",
				"structuralLinkCount",
				"automaticLinkCount",
				"manualLinkCount",
				"topology",
				"capabilities"
			],
			properties: {
				primitiveCount: { type: "integer" },
				primitives: {
					type: "array",
					items: {
						type: "object",
						required: ["name"],
						properties: {
							name: { type: "string" },
							appliedStatePaths: {
								type: "array",
								items: { type: "string" }
							}
						}
					}
				},
				linkCount: { type: "integer" },
				coordinationLinkCount: { type: "integer" },
				structuralLinkCount: { type: "integer" },
				automaticLinkCount: { type: "integer" },
				manualLinkCount: { type: "integer" },
				topology: describeWorkspaceTopologySummarySchema(),
				capabilities: {
					type: "object",
					properties: {
						propagationExecution: { type: "boolean" },
						propagationPlan: { type: "boolean" },
						effectCollection: { type: "boolean" },
						consistencyEvaluation: { type: "boolean" }
					}
				}
			}
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/planning.js
	function cloneValue$22(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	var WORKSPACE_PLANNING_TOPOLOGIES = [
		"T1",
		"T2",
		"T3",
		"T4",
		"T5",
		"T6"
	];
	var WORKSPACE_PLANNING_BUDGETS = [
		"minimal",
		"standard",
		"extended"
	];
	var WORKSPACE_PLANNING_RUN_MODES = [
		"goal_oriented",
		"open_ended",
		"autonomous"
	];
	var WORKSPACE_PLANNING_TASK_FAMILIES = [
		"lookup",
		"filter",
		"compare",
		"rank",
		"distribution",
		"correlation",
		"outlier",
		"cluster",
		"trend",
		"flow",
		"multiViewCoordination",
		"drillDown"
	];
	var WORKSPACE_PLANNING_ANSWER_TYPES = [
		"exact",
		"bounded",
		"exploratory"
	];
	var WORKSPACE_PLANNING_INTERACTION_HORIZONS = ["single_step", "multi_step"];
	var WORKSPACE_PLANNING_COORDINATION_SCOPES = [
		"single_widget",
		"multi_widget",
		"workspace"
	];
	var WORKSPACE_PLANNING_EVIDENCE_TYPES = [
		"initial_view",
		"interaction_revealed",
		"cross_widget"
	];
	var WORKSPACE_PLAN_SOURCES = [
		"planner",
		"runtime_default",
		"workspace_spec"
	];
	var WORKSPACE_PLAN_MODES = [
		"topology_driven",
		"minimal_default",
		"explicit_spec"
	];
	function describeWorkspacePlanningTaskSchema() {
		return cloneValue$22({
			type: "object",
			properties: {
				taskId: { type: "string" },
				userQuery: { type: "string" },
				taskMode: { type: "string" },
				taskFamily: {
					type: "string",
					enum: WORKSPACE_PLANNING_TASK_FAMILIES
				},
				answerType: {
					type: "string",
					enum: WORKSPACE_PLANNING_ANSWER_TYPES
				},
				expectedAnswerType: {
					type: "string",
					enum: WORKSPACE_PLANNING_ANSWER_TYPES
				},
				interactionHorizon: {
					type: "string",
					enum: WORKSPACE_PLANNING_INTERACTION_HORIZONS
				},
				coordinationScope: {
					type: "string",
					enum: WORKSPACE_PLANNING_COORDINATION_SCOPES
				},
				evidenceType: {
					type: "string",
					enum: WORKSPACE_PLANNING_EVIDENCE_TYPES
				},
				targetWidgetRefs: {
					type: "array",
					items: { type: "string" }
				}
			}
		});
	}
	function describeWorkspaceWidgetPlanSourceSchema() {
		return cloneValue$22({
			type: "object",
			required: ["kind"],
			properties: {
				kind: { type: "string" },
				spec: { type: "object" },
				title: { type: "string" }
			}
		});
	}
	function describeWorkspaceWidgetPlanMetricSchema() {
		return cloneValue$22({
			type: "object",
			properties: {
				field: { type: "string" },
				op: { type: "string" },
				as: { type: "string" }
			}
		});
	}
	function describeWorkspaceWidgetPlanSortSchema() {
		return cloneValue$22({
			type: "object",
			properties: {
				field: { type: "string" },
				order: { type: "string" }
			}
		});
	}
	function describeWorkspaceWidgetPlanTransformSchema() {
		return cloneValue$22({
			type: "object",
			properties: {
				kind: { type: "string" },
				groupBy: {
					type: "array",
					items: { type: "string" }
				},
				metrics: {
					type: "array",
					items: describeWorkspaceWidgetPlanMetricSchema()
				},
				sortBy: { anyOf: [describeWorkspaceWidgetPlanSortSchema(), { type: "null" }] }
			}
		});
	}
	function describeWorkspaceWidgetDataBindingSchema() {
		return cloneValue$22({
			type: "object",
			properties: {
				sourceWidgetId: { type: "string" },
				transforms: {
					type: "array",
					items: describeWorkspaceWidgetPlanTransformSchema()
				}
			}
		});
	}
	function describeWorkspaceLinkFieldMappingSchema() {
		return cloneValue$22({
			type: "object",
			properties: {
				sourceField: { type: "string" },
				targetField: { type: "string" }
			}
		});
	}
	function describeWorkspaceWidgetPlanSchema() {
		return cloneValue$22({
			type: "object",
			required: [
				"widgetId",
				"role",
				"source"
			],
			properties: {
				widgetId: { type: "string" },
				role: { type: "string" },
				kind: { type: "string" },
				title: { type: "string" },
				description: { type: "string" },
				source: describeWorkspaceWidgetPlanSourceSchema(),
				dataBinding: describeWorkspaceWidgetDataBindingSchema(),
				analyticRoles: {
					type: "array",
					items: { type: "string" }
				}
			}
		});
	}
	function describeWorkspaceLinkPlanSchema() {
		return cloneValue$22({
			type: "object",
			properties: {
				linkId: { type: "string" },
				sourceWidgetId: { type: "string" },
				targetWidgetId: { type: "string" },
				kind: { type: ["string", "null"] },
				primitive: { type: ["string", "null"] },
				effect: { type: ["string", "null"] },
				activationPolicy: { type: "string" },
				effectConstraint: { type: ["string", "null"] },
				responseSpec: {
					type: "object",
					properties: {
						kind: { type: "string" },
						params: { type: "object" },
						verificationHints: { type: "object" }
					}
				},
				description: { type: "string" },
				fieldMapping: {
					type: "array",
					items: describeWorkspaceLinkFieldMappingSchema()
				}
			}
		});
	}
	function describeWorkspacePlanningRequestSchema() {
		return cloneValue$22({
			type: "object",
			properties: {
				task: { anyOf: [{ type: "null" }, describeWorkspacePlanningTaskSchema()] },
				datasetSchema: { anyOf: [{ type: "null" }, {
					type: "object",
					properties: { fields: {
						type: "array",
						items: {
							type: "object",
							properties: {
								name: { type: "string" },
								type: { type: "string" },
								nullable: { type: "boolean" },
								description: { type: "string" }
							}
						}
					} }
				}] },
				userIntent: { type: ["string", "null"] },
				runMode: {
					type: "string",
					enum: WORKSPACE_PLANNING_RUN_MODES
				},
				complexityBudget: {
					type: "string",
					enum: WORKSPACE_PLANNING_BUDGETS
				},
				preferredTopology: {
					type: ["string", "null"],
					enum: [...WORKSPACE_PLANNING_TOPOLOGIES, null]
				}
			}
		});
	}
	function describeWorkspacePlanningResultSchema() {
		return cloneValue$22({
			type: "object",
			required: [
				"topology",
				"widgets",
				"links",
				"rationale",
				"source",
				"planningMode",
				"title"
			],
			properties: {
				topology: {
					type: "string",
					enum: WORKSPACE_PLANNING_TOPOLOGIES
				},
				widgets: {
					type: "array",
					items: describeWorkspaceWidgetPlanSchema()
				},
				links: {
					type: "array",
					items: describeWorkspaceLinkPlanSchema()
				},
				rationale: {
					type: "array",
					items: { type: "string" }
				},
				source: {
					type: "string",
					enum: WORKSPACE_PLAN_SOURCES
				},
				planningMode: {
					type: "string",
					enum: WORKSPACE_PLAN_MODES
				},
				primaryWidgetId: { type: ["string", "null"] },
				title: { type: "string" }
			}
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/widgetAdapters.js
	function cloneValue$21(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	var WIDGET_ADAPTER_PROVIDERS = [
		"vega-lite",
		"echarts",
		"d3",
		"custom"
	];
	function describeWidgetAdapterProviderCapabilitiesSchema() {
		return cloneValue$21({
			type: "object",
			properties: {
				supportedWidgetKinds: {
					type: "array",
					items: { type: "string" }
				},
				renderStrategy: { type: "string" },
				stateApplyStrategy: { type: "string" },
				interactionBindingStrategy: { type: "string" },
				supportsRendererMount: { type: "boolean" },
				supportsRendererUpdate: { type: "boolean" },
				supportsRendererDispose: { type: "boolean" },
				supportsSignalPatching: { type: "boolean" },
				supportsOptionMerging: { type: "boolean" },
				supportsImperativeRender: { type: "boolean" },
				supportsPointSelection: { type: "boolean" },
				supportsIntervalSelection: { type: "boolean" },
				supportsZoomPan: { type: "boolean" },
				supportsFocusReadback: { type: "boolean" },
				supportsSelectionReadback: { type: "boolean" },
				supportsViewportReadback: { type: "boolean" },
				supportsHighlightProjection: { type: "boolean" },
				supportsInteractionEvents: { type: "boolean" }
			}
		});
	}
	function describeWidgetAdapterHumanInteractionSchema() {
		return cloneValue$21({
			type: "object",
			properties: {
				mode: { type: "string" },
				actionName: { type: ["string", "null"] },
				supportsDirectManipulation: { type: "boolean" }
			}
		});
	}
	function describeWidgetAdapterCapabilitiesSchema() {
		return cloneValue$21({
			type: "object",
			properties: {
				canDescribe: { type: "boolean" },
				canReadState: { type: "boolean" },
				canApplyState: { type: "boolean" },
				canMount: { type: "boolean" },
				canUpdate: { type: "boolean" },
				canDisposeRenderer: { type: "boolean" },
				canBindHumanInteractions: { type: "boolean" },
				canReadSelection: { type: "boolean" },
				canReadViewport: { type: "boolean" },
				canRegisterActions: { type: "boolean" },
				canRegisterPerceptionQueries: { type: "boolean" }
			}
		});
	}
	function describeWidgetAdapterSummarySchema() {
		return cloneValue$21({
			type: "object",
			required: [
				"widgetRef",
				"provider",
				"capabilities",
				"humanInteraction"
			],
			properties: {
				widgetRef: describeRefSchema(),
				dataRef: { anyOf: [describeRefSchema(), { type: "null" }] },
				kind: { type: ["string", "null"] },
				title: { type: "string" },
				description: { type: "string" },
				analyticRoles: {
					type: "array",
					items: { type: "string" }
				},
				primaryDataRef: { anyOf: [describeRefSchema(), { type: "null" }] },
				provider: {
					type: "string",
					enum: WIDGET_ADAPTER_PROVIDERS
				},
				providerCapabilities: describeWidgetAdapterProviderCapabilitiesSchema(),
				role: { type: ["string", "null"] },
				sourceKind: { type: ["string", "null"] },
				supportsSpecMutation: { type: "boolean" },
				metadata: { type: "object" },
				usageNotes: {
					type: "array",
					items: { type: "string" }
				},
				actionNames: {
					type: "array",
					items: { type: "string" }
				},
				perceptionQueryNames: {
					type: "array",
					items: { type: "string" }
				},
				humanInteraction: describeWidgetAdapterHumanInteractionSchema(),
				capabilities: describeWidgetAdapterCapabilitiesSchema()
			}
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/workspaceSpec.js
	function cloneValue$20(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	var WORKSPACE_TOPOLOGIES = [
		"T1",
		"T2",
		"T3",
		"T4",
		"T5",
		"T6"
	];
	[...WIDGET_LINK_KINDS];
	function describeWorkspaceSpecSummarySchema() {
		return cloneValue$20({
			type: "object",
			properties: {
				topology: {
					type: ["string", "null"],
					enum: [...WORKSPACE_TOPOLOGIES, null]
				},
				widgetCount: { type: "integer" },
				linkCount: { type: "integer" }
			}
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/description.js
	function cloneValue$19(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	var WIDGET_KINDS = [
		"bar",
		"line",
		"scatter",
		"heatmap",
		"parallelCoordinates",
		"sankey",
		"map",
		"table",
		"custom"
	];
	var WIDGET_ANALYTIC_ROLES = [
		"lookup",
		"compare",
		"rank",
		"correlate",
		"cluster",
		"outlier",
		"trend",
		"distribution",
		"flow",
		"geoPattern"
	];
	var WORKSPACE_CAPABILITIES = [
		"singleWidgetAnalysis",
		"multiWidgetCoordination",
		"sharedSelection",
		"crossFilter",
		"domainSync",
		"traceReplay"
	];
	var WORKSPACE_TRANSPORT_TOOL_NAMES = [
		"workspace_describe",
		"view_read",
		"action_run",
		"perception_query",
		"interaction_trace_read"
	];
	var WORKSPACE_OPTIONAL_TRANSPORT_TOOL_NAMES = [
		"data_query",
		"workspace_plan",
		"agent_loop_describe",
		"trace_graph_read",
		"read_snapshot",
		"state_history_read",
		"branch_list",
		"verified_action_run",
		"jump_to_state",
		"branch_from_state",
		"response_recorder_describe",
		"agent_response_read",
		"agent_response_list",
		"agent_response_record"
	];
	var WIDGET_HUMAN_INTERACTION_MODES = [
		"none",
		"brush2d",
		"multiBrush",
		"categoryClick",
		"cellClick",
		"rowClick",
		"directManipulation"
	];
	function describeWidgetKindSchema() {
		return cloneValue$19({
			type: "string",
			enum: WIDGET_KINDS
		});
	}
	function describeWidgetAnalyticRoleSchema() {
		return cloneValue$19({
			type: "string",
			enum: WIDGET_ANALYTIC_ROLES
		});
	}
	function describeWorkspaceCapabilitySchema() {
		return cloneValue$19({
			type: "string",
			enum: WORKSPACE_CAPABILITIES
		});
	}
	function describeWorkspaceTransportToolNameSchema() {
		return cloneValue$19({
			type: "string",
			enum: WORKSPACE_TRANSPORT_TOOL_NAMES
		});
	}
	function describeWorkspaceOptionalTransportToolNameSchema() {
		return cloneValue$19({
			type: "string",
			enum: WORKSPACE_OPTIONAL_TRANSPORT_TOOL_NAMES
		});
	}
	function describeWidgetHumanInteractionModeSchema() {
		return cloneValue$19({
			type: "string",
			enum: WIDGET_HUMAN_INTERACTION_MODES
		});
	}
	function describeWidgetDescriptionSchema() {
		return cloneValue$19({
			type: "object",
			required: [
				"title",
				"actionNames",
				"perceptionQueryNames",
				"humanInteraction"
			],
			properties: {
				ref: describeRefSchema(),
				kind: describeWidgetKindSchema(),
				title: { type: "string" },
				description: { type: "string" },
				analyticRoles: {
					type: "array",
					items: describeWidgetAnalyticRoleSchema()
				},
				widgetId: { type: ["string", "null"] },
				role: { type: "string" },
				sourceKind: { type: ["string", "null"] },
				supportsSpecMutation: { type: "boolean" },
				primaryDataRef: { anyOf: [describeRefSchema(), { type: "null" }] },
				actionNames: {
					type: "array",
					items: { type: "string" }
				},
				perceptionQueryNames: {
					type: "array",
					items: { type: "string" }
				},
				usageNotes: {
					type: "array",
					items: { type: "string" }
				},
				humanInteraction: {
					type: "object",
					properties: {
						mode: describeWidgetHumanInteractionModeSchema(),
						actionName: { type: ["string", "null"] },
						supportsDirectManipulation: { type: "boolean" }
					}
				}
			}
		});
	}
	function describeWorkspaceTransportHintsSchema() {
		return cloneValue$19({
			type: ["object", "null"],
			properties: {
				recommendedTools: {
					type: "array",
					items: describeWorkspaceTransportToolNameSchema()
				},
				optionalTools: {
					type: "array",
					items: describeWorkspaceOptionalTransportToolNameSchema()
				},
				note: { type: "string" }
			}
		});
	}
	function describeWorkspaceDescriptionPlanningSchema() {
		return cloneValue$19({
			type: ["object", "null"],
			properties: {
				supportedTopologies: {
					type: "array",
					items: {
						type: "string",
						enum: WORKSPACE_PLANNING_TOPOLOGIES
					}
				},
				supportedRunModes: {
					type: "array",
					items: {
						type: "string",
						enum: WORKSPACE_PLANNING_RUN_MODES
					}
				},
				supportedComplexityBudgets: {
					type: "array",
					items: {
						type: "string",
						enum: WORKSPACE_PLANNING_BUDGETS
					}
				},
				supportedPlanSources: {
					type: "array",
					items: {
						type: "string",
						enum: WORKSPACE_PLAN_SOURCES
					}
				},
				supportedPlanningModes: {
					type: "array",
					items: {
						type: "string",
						enum: WORKSPACE_PLAN_MODES
					}
				},
				requestedWorkspaceSpec: { anyOf: [describeWorkspaceSpecSummarySchema(), { type: "null" }] },
				planningRequest: { anyOf: [describeWorkspacePlanningRequestSchema(), { type: "null" }] },
				workspaceSpecStatus: { type: ["string", "null"] },
				workspaceSpecIssues: {
					type: "array",
					items: { type: "string" }
				},
				materializedFromSpec: { type: "boolean" },
				materializedFromPlanner: { type: "boolean" },
				planner: { anyOf: [describeWorkspacePlanningResultSchema(), { type: "null" }] }
			}
		});
	}
	function describeWorkspaceDescriptionSchema() {
		return cloneValue$19({
			type: "object",
			required: [
				"appId",
				"workspaceId",
				"generatedAt",
				"widgets",
				"dataHandles",
				"links",
				"actions",
				"perceptionQueries"
			],
			properties: {
				appId: { type: "string" },
				workspaceId: { type: "string" },
				generatedAt: { type: "string" },
				workspaceCapabilities: {
					type: "array",
					items: describeWorkspaceCapabilitySchema()
				},
				transportHints: describeWorkspaceTransportHintsSchema(),
				runtimeTopology: { anyOf: [describeWorkspaceTopologySummarySchema(), { type: "null" }] },
				taskContext: { anyOf: [describeWorkspaceTaskContextSchema(), { type: "null" }] },
				widgets: {
					type: "array",
					items: describeWidgetDescriptionSchema()
				},
				widgetAdapters: {
					type: "array",
					items: describeWidgetAdapterSummarySchema()
				},
				dataHandles: {
					type: "array",
					items: describeDataHandleSchema()
				},
				links: {
					type: "array",
					items: describeWidgetLinkSchema()
				},
				actions: {
					type: "array",
					items: describeActionDescriptorSchema()
				},
				perceptionQueries: {
					type: "array",
					items: describePerceptionDescriptorSchema()
				},
				planning: describeWorkspaceDescriptionPlanningSchema(),
				__schemas: { type: "object" }
			}
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/agentLoop.js
	function cloneValue$18(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function describeAgentLoopHintsSchema() {
		const optionalNameSchema = { type: ["string", "null"] };
		return cloneValue$18({
			type: "object",
			properties: {
				recommendedOrder: {
					type: "array",
					items: { type: "string" }
				},
				workspaceDescribeName: { type: "string" },
				workspacePlanName: optionalNameSchema,
				stateReadName: { type: "string" },
				viewReadName: { type: "string" },
				actionRunName: { type: "string" },
				perceptionQueryName: { type: "string" },
				verifyQueryName: { type: "string" },
				dataQueryRunName: optionalNameSchema,
				dataQueryName: optionalNameSchema,
				traceReadName: optionalNameSchema,
				interactionTraceName: optionalNameSchema,
				traceGraphName: optionalNameSchema,
				snapshotName: optionalNameSchema,
				stateHistoryName: optionalNameSchema,
				branchListName: optionalNameSchema,
				finalSnapshotName: optionalNameSchema,
				verifiedActionName: { type: "string" },
				replayName: optionalNameSchema,
				jumpToStateName: optionalNameSchema,
				branchFromStateName: optionalNameSchema,
				responseRecorderName: optionalNameSchema,
				responseReadName: optionalNameSchema,
				responseListName: optionalNameSchema,
				responseRecordName: optionalNameSchema,
				latestCoordinationResultReadName: optionalNameSchema,
				verificationSurfaces: {
					type: "array",
					items: { type: "string" }
				},
				planningSurfaces: {
					type: "array",
					items: { type: "string" }
				},
				historySurfaces: {
					type: "array",
					items: { type: "string" }
				},
				replaySurfaces: {
					type: "array",
					items: { type: "string" }
				},
				answerSurfaces: {
					type: "array",
					items: { type: "string" }
				},
				humanInteractionHints: {
					type: "array",
					items: {
						type: "object",
						properties: {
							widgetRef: { type: "string" },
							mode: { type: "string" },
							actionName: { type: ["string", "null"] },
							supportsDirectManipulation: { type: "boolean" },
							focused: { type: "boolean" }
						}
					}
				},
				sharedDataViews: {
					type: "array",
					items: {
						type: "object",
						properties: {
							ref: { type: "string" },
							scope: { type: "string" },
							title: { type: "string" }
						}
					}
				},
				focusedDataViews: {
					type: "array",
					items: {
						type: "object",
						properties: {
							ref: { type: "string" },
							scope: { type: "string" },
							title: { type: "string" }
						}
					}
				},
				preferredEvidenceRefs: {
					type: "object",
					properties: {
						currentViewRef: { type: ["string", "null"] },
						currentSelectionRef: { type: ["string", "null"] }
					}
				},
				workspaceTopology: { anyOf: [describeWorkspaceTopologySummarySchema(), { type: "null" }] }
			}
		});
	}
	function describeVerifiedActionEvidenceSchema() {
		return cloneValue$18({
			type: "object",
			properties: {
				verificationHints: {
					type: "array",
					items: { type: "string" }
				},
				traceEvidence: { anyOf: [{ type: "null" }, describeInteractionTraceRecordSchema()] },
				finalSnapshot: { anyOf: [{ type: "null" }, describeWorkspaceSnapshotSchema()] },
				linkPropagation: {
					type: "array",
					items: describeLinkPropagationEvaluationSchema()
				},
				latestCoordinationResult: { anyOf: [{ type: "null" }, {
					type: "object",
					additionalProperties: true
				}] }
			}
		});
	}
	function describeAgentLoopContextSchema() {
		return cloneValue$18({
			type: "object",
			required: [
				"workspace",
				"view",
				"loopHints"
			],
			properties: {
				workspace: describeWorkspaceDescriptionSchema(),
				view: describeWorkspaceStateSchema(),
				latestCoordinationResult: { anyOf: [{ type: "null" }, {
					type: "object",
					additionalProperties: true
				}] },
				loopHints: describeAgentLoopHintsSchema()
			}
		});
	}
	function describeVerifiedActionResultSchema() {
		return cloneValue$18({
			type: "object",
			required: [
				"ok",
				"beforeStateId",
				"actionResult",
				"afterView",
				"verification"
			],
			properties: {
				ok: { type: "boolean" },
				beforeStateId: { type: ["string", "null"] },
				actionResult: { anyOf: [{ type: "null" }, describeActionResultSchema()] },
				afterView: { anyOf: [{ type: "null" }, describeWorkspaceStateSchema()] },
				verification: { anyOf: [{ type: "null" }, describePerceptionResultSchema()] },
				verificationHints: describeVerifiedActionEvidenceSchema().properties.verificationHints,
				traceEvidence: describeVerifiedActionEvidenceSchema().properties.traceEvidence,
				finalSnapshot: describeVerifiedActionEvidenceSchema().properties.finalSnapshot,
				linkPropagation: describeVerifiedActionEvidenceSchema().properties.linkPropagation,
				latestCoordinationResult: describeVerifiedActionEvidenceSchema().properties.latestCoordinationResult
			}
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/VegaLiteWidgetAdapter.js
	function createVegaLiteWidgetAdapter(definition = {}) {
		return createWidgetAdapterDefinition({
			provider: "vega-lite",
			providerCapabilities: {
				supportedWidgetKinds: definition.kind ? [definition.kind] : [],
				renderStrategy: "vegaEmbed",
				stateApplyStrategy: "signalPatch",
				interactionBindingStrategy: "vegaViewListeners",
				supportsRendererMount: true,
				supportsRendererUpdate: true,
				supportsRendererDispose: true,
				supportsSignalPatching: true,
				supportsOptionMerging: false,
				supportsImperativeRender: false,
				supportsPointSelection: true,
				supportsIntervalSelection: true,
				supportsZoomPan: true,
				supportsSelectionReadback: true,
				supportsViewportReadback: true,
				supportsHighlightProjection: true,
				supportsInteractionEvents: true
			},
			mount({ view = null, surface = null } = {}) {
				return {
					view,
					surface
				};
			},
			update({ view = null, surface = null } = {}) {
				return {
					view,
					surface
				};
			},
			dispose({ view = null } = {}) {
				return view?.finalize?.();
			},
			bindHumanInteractions({ view, spec, interactionConfig, selectionSourceWidgetId, actionTargetRef, onActionCall, onSelectionChange }) {
				return bindWidgetHumanInteractions({
					view,
					spec,
					interactionConfig,
					selectionSourceWidgetId,
					actionTargetRef,
					onActionCall,
					onSelectionChange
				});
			},
			async applyState({ view }) {
				try {
					await view.runAsync?.();
				} catch {}
			},
			readSelection() {
				return null;
			},
			readViewport() {
				return null;
			},
			...definition
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgets/shared/selectionResult.js
	function buildSelectionActionResult({ ctx, nextState, selectedCount, verificationHints }) {
		const targetRef = ctx.readQueryScope?.()?.widgetRef || null;
		const sourceWidgetRef = ctx.resolveTargetWidget({ targetRef })?.ref || null;
		const selectionRef = ctx.resolveSelectionRef(nextState, { targetRef });
		const rawPropagation = selectionRef ? ctx.propagate(selectionRef, {
			returnDetails: true,
			state: nextState
		}) : null;
		const propagation = Array.isArray(rawPropagation) ? {
			refs: rawPropagation,
			links: [],
			effects: [],
			nextState: ctx.readCurrentState()
		} : rawPropagation || ctx.collectPropagation(selectionRef, { state: nextState });
		const finalState = propagation.nextState || ctx.readCurrentState() || nextState;
		return {
			nextState: finalState,
			updatedRefs: ctx.collectUpdatedRefs(finalState, [
				...sourceWidgetRef ? [sourceWidgetRef] : [],
				...selectionRef ? [selectionRef] : [],
				...Array.isArray(propagation.refs) ? propagation.refs : []
			]),
			result: {
				selectedCount,
				propagated: propagation.links,
				propagationEffects: propagation.effects
			},
			verificationHints
		};
	}
	//#endregion
	//#region ../../widgetva-kit/src/widgets/bar/actions.js
	function replaceFilterTransformForField(transforms, field, nextTransform) {
		const nextTransforms = (Array.isArray(transforms) ? transforms : []).filter((transform) => transform?.filter?.field !== field);
		return nextTransform ? [...nextTransforms, nextTransform] : nextTransforms;
	}
	function replaceTaggedTransform$2(transforms, tag, nextTransform) {
		const nextTransforms = (Array.isArray(transforms) ? transforms : []).filter((transform) => transform?._widgetvaTag !== tag);
		return nextTransform ? [...nextTransforms, nextTransform] : nextTransforms;
	}
	function detectSubcategoryField(spec, explicitField) {
		if (typeof explicitField === "string" && explicitField.trim().length > 0) return explicitField;
		const encoding = spec?.encoding || {};
		return encoding?.xOffset?.field || encoding?.color?.field || null;
	}
	function detectCategoryField(spec, explicitField) {
		if (typeof explicitField === "string" && explicitField.trim().length > 0) return explicitField;
		const encoding = spec?.encoding || {};
		const xField = encoding?.x?.field || null;
		const yField = encoding?.y?.field || null;
		const xType = encoding?.x?.type || null;
		const yType = encoding?.y?.type || null;
		if ((xType === "nominal" || xType === "ordinal") && xField) return xField;
		if ((yType === "nominal" || yType === "ordinal") && yField) return yField;
		return xField || yField || null;
	}
	function detectBarChannels(spec, requestedChannel) {
		const encoding = spec?.encoding || {};
		const xType = encoding?.x?.type || null;
		const yType = encoding?.y?.type || null;
		const normalizedRequested = requestedChannel === "x" || requestedChannel === "y" ? requestedChannel : null;
		if (normalizedRequested) return {
			categoryChannel: normalizedRequested,
			valueChannel: normalizedRequested === "x" ? "y" : "x"
		};
		if ((yType === "nominal" || yType === "ordinal") && xType === "quantitative") return {
			categoryChannel: "y",
			valueChannel: "x"
		};
		return {
			categoryChannel: "x",
			valueChannel: "y"
		};
	}
	function aggregateBarValues(rows, { categoryField, valueField, aggregate, colorField, bySubcategory }) {
		const scores = /* @__PURE__ */ new Map();
		const normalizedAggregate = typeof aggregate === "string" && aggregate.trim().length > 0 ? aggregate.toLowerCase() : "mean";
		const groupedValues = /* @__PURE__ */ new Map();
		const pushValue = (key, value) => {
			if (!groupedValues.has(key)) groupedValues.set(key, []);
			groupedValues.get(key).push(value);
		};
		for (const row of rows) {
			if (!row || typeof row !== "object") continue;
			const category = row[categoryField];
			const value = row[valueField];
			if (category == null || typeof value !== "number" || Number.isNaN(value)) continue;
			if (bySubcategory != null) {
				if (!colorField || row[colorField] !== bySubcategory) continue;
				pushValue(category, value);
				continue;
			}
			if (colorField) {
				pushValue(JSON.stringify([category, row[colorField]]), value);
				continue;
			}
			pushValue(category, value);
		}
		const applyAggregate = (values) => {
			if (!Array.isArray(values) || values.length === 0) return 0;
			if (normalizedAggregate === "sum") return values.reduce((sum, value) => sum + value, 0);
			if (normalizedAggregate === "count") return values.length;
			if (normalizedAggregate === "median") {
				const sorted = [...values].sort((left, right) => left - right);
				const mid = Math.floor(sorted.length / 2);
				return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
			}
			if (normalizedAggregate === "min") return Math.min(...values);
			if (normalizedAggregate === "max") return Math.max(...values);
			return values.reduce((sum, value) => sum + value, 0) / values.length;
		};
		if (bySubcategory != null || !colorField) {
			for (const [key, values] of groupedValues.entries()) scores.set(key, applyAggregate(values));
			return scores;
		}
		const groupedByCategory = /* @__PURE__ */ new Map();
		for (const [compositeKey, values] of groupedValues.entries()) {
			const [category] = JSON.parse(compositeKey);
			groupedByCategory.set(category, (groupedByCategory.get(category) || 0) + applyAggregate(values));
		}
		return groupedByCategory;
	}
	function hasInlineObjectRows$1(spec) {
		return Array.isArray(spec?.data?.values) && spec.data.values.some((row) => row && typeof row === "object");
	}
	function isUrlBackedDataSpec$1(spec) {
		return typeof spec?.data?.url === "string" && spec.data.url.trim().length > 0;
	}
	function resolveBarRowsForAction(spec, ctx, widgetRef) {
		if (hasInlineObjectRows$1(spec)) return spec.data.values.filter((row) => row && typeof row === "object");
		if (isUrlBackedDataSpec$1(spec)) {
			const { rows } = ctx.readRowsForWidget(widgetRef);
			return Array.isArray(rows) ? rows.filter((row) => row && typeof row === "object") : [];
		}
		return [];
	}
	function buildBarActionDescriptors({ widgetRef, selectionRef, scope = "local", affectedRefs = [widgetRef] }) {
		const supportedWidgetKinds = ["bar"];
		return [
			makeActionDescriptor({
				name: "bar.selectCategory",
				title: "Select bar categories",
				description: "Select one or more categorical groups represented by bars.",
				primitive: "select",
				category: "selection",
				scope,
				supportedWidgetKinds,
				targetRef: selectionRef || widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "selections" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						field: { type: "string" },
						values: {
							type: "array",
							items: { type: "string" }
						}
					},
					required: ["field", "values"]
				},
				postconditions: [{ description: "The active selection should contain the selected categorical values." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid bar widget in the current workspace.",
					failureMessage: "bar.selectCategory requires a valid bar target widget."
				}],
				effects: [makeSelectionEffect(selectionRef || widgetRef, "Creates or updates a categorical selection on the bar chart."), ...affectedRefs.filter((ref) => ref !== widgetRef).map((ref) => makeHighlightEffect(ref, "Linked widgets may highlight or filter the selected categories."))],
				examples: [{
					userGoal: "Select a subset of categories from the summary bar chart.",
					params: {
						field: "Origin",
						values: ["Japan", "USA"]
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "bar.sortBars",
				title: "Sort bars",
				description: "Sort bar groups by the requested order and optional field.",
				primitive: "sort",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "encodings" : "transforms"),
				paramsSchema: {
					type: "object",
					properties: {
						channel: { type: "string" },
						order: {
							type: "string",
							enum: ["ascending", "descending"]
						},
						field: { type: "string" },
						aggregate: { type: "string" },
						bySubcategory: { anyOf: [{ type: "string" }, { type: "number" }] }
					},
					required: ["channel", "order"]
				},
				postconditions: [{ description: "The bar chart encoding should include the requested sort rule." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid bar widget in the current workspace.",
					failureMessage: "bar.sortBars requires a valid bar target widget."
				}],
				examples: [{
					userGoal: "Sort the bar chart descending by the aggregated measure.",
					params: {
						channel: "x",
						order: "descending"
					}
				}, {
					userGoal: "Sort grouped or stacked categories using one specific subcategory as the ranking signal.",
					params: {
						channel: "x",
						order: "descending",
						bySubcategory: "Type1"
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "bar.highlightTopN",
				title: "Highlight top N bars",
				description: "Visually emphasize the top-N categories by measure while dimming the remaining bars.",
				primitive: "highlight",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						n: { type: "number" },
						order: {
							type: "string",
							enum: ["ascending", "descending"]
						},
						categoryField: { type: "string" },
						measureField: { type: "string" }
					},
					required: ["n"]
				},
				postconditions: [{ description: "The bar chart should visually emphasize the top-N categories by the requested measure." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid bar widget in the current workspace.",
					failureMessage: "bar.highlightTopN requires a valid bar target widget."
				}],
				examples: [{
					userGoal: "Highlight only the top 5 categories by value before comparing them.",
					params: {
						n: 5,
						order: "descending",
						categoryField: "category",
						measureField: "value"
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "bar.filterCategories",
				title: "Filter bar categories",
				description: "Filter the bar chart to a requested set of categories while leaving the other encodings intact.",
				primitive: "filter",
				category: "dataTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "transforms" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						categories: {
							type: "array",
							items: { anyOf: [{ type: "string" }, { type: "number" }] }
						},
						field: { type: "string" }
					},
					required: ["categories"]
				},
				postconditions: [{ description: "The bar chart should retain only the requested categories through a categorical filter transform." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid bar widget in the current workspace.",
					failureMessage: "bar.filterCategories requires a valid bar target widget."
				}],
				effects: affectedRefs.map((ref) => makeHighlightEffect(ref, ref === widgetRef ? "The bar chart data is filtered down to the requested categories." : "Linked widgets may update to reflect the reduced category set.")),
				examples: [{
					userGoal: "Keep only a few categories before comparing them in detail.",
					params: {
						categories: ["A", "C"],
						field: "category"
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "bar.addBars",
				title: "Add bars back into view",
				description: "Expand the managed visible-category set of a bar chart by adding one or more category bars back into the visibility filter.",
				primitive: "addRemove",
				category: "dataTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "transforms" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						values: {
							type: "array",
							items: { anyOf: [{ type: "string" }, { type: "number" }] }
						},
						field: { type: "string" }
					},
					required: ["values"]
				},
				postconditions: [{ description: "The bar chart visibility filter should expand to include the requested categories, and the stored bar visibility state should reflect the new visible set." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid bar widget in the current workspace.",
					failureMessage: "bar.addBars requires a valid bar target widget."
				}],
				effects: affectedRefs.map((ref) => makeHighlightEffect(ref, ref === widgetRef ? "The managed bar visibility filter expands to include the requested categories." : "Linked widgets may update to reflect the expanded category set.")),
				examples: [{
					userGoal: "Add previously hidden categories back into the current bar comparison without resetting the rest of the view.",
					params: {
						values: ["East", "West"],
						field: "category"
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "bar.removeBars",
				title: "Remove bars from view",
				description: "Shrink the managed visible-category set of a bar chart by removing one or more category bars from the visibility filter.",
				primitive: "addRemove",
				category: "dataTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "transforms" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						values: {
							type: "array",
							items: { anyOf: [{ type: "string" }, { type: "number" }] }
						},
						field: { type: "string" }
					},
					required: ["values"]
				},
				postconditions: [{ description: "The bar chart visibility filter should exclude the requested categories, and the stored bar visibility state should reflect the reduced visible set." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid bar widget in the current workspace.",
					failureMessage: "bar.removeBars requires a valid bar target widget."
				}],
				effects: affectedRefs.map((ref) => makeHighlightEffect(ref, ref === widgetRef ? "The managed bar visibility filter contracts to exclude the requested categories." : "Linked widgets may update to reflect the reduced category set.")),
				examples: [{
					userGoal: "Temporarily remove several categories from the current bar comparison without resetting the rest of the view.",
					params: {
						values: ["East", "West"],
						field: "category"
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "bar.addBarItems",
				title: "Add grouped or stacked bar items back into view",
				description: "Expand the managed visible item set of a grouped or stacked bar chart by adding one or more (category, subcategory) pairs back into the visibility filter.",
				primitive: "addRemove",
				category: "dataTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "transforms" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						items: {
							type: "array",
							items: {
								type: "object",
								properties: {
									x: { anyOf: [{ type: "string" }, { type: "number" }] },
									sub: { anyOf: [{ type: "string" }, { type: "number" }] }
								},
								required: ["x", "sub"]
							}
						},
						xField: { type: "string" },
						subField: { type: "string" }
					},
					required: ["items"]
				},
				postconditions: [{ description: "The bar chart visibility filter should expand to include the requested (category, subcategory) items, and the stored visibility state should reflect the updated visible item set." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid bar widget in the current workspace.",
					failureMessage: "bar.addBarItems requires a valid bar target widget."
				}],
				effects: affectedRefs.map((ref) => makeHighlightEffect(ref, ref === widgetRef ? "The managed bar-item visibility filter expands to include the requested grouped or stacked members." : "Linked widgets may update to reflect the expanded item set.")),
				examples: [{
					userGoal: "Bring a few grouped or stacked members back into the current comparison without resetting the whole chart.",
					params: {
						items: [{
							x: "A",
							sub: "Type2"
						}],
						xField: "category",
						subField: "type"
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "bar.removeBarItems",
				title: "Remove grouped or stacked bar items from view",
				description: "Shrink the managed visible item set of a grouped or stacked bar chart by removing one or more (category, subcategory) pairs from the visibility filter.",
				primitive: "addRemove",
				category: "dataTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "transforms" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						items: {
							type: "array",
							items: {
								type: "object",
								properties: {
									x: { anyOf: [{ type: "string" }, { type: "number" }] },
									sub: { anyOf: [{ type: "string" }, { type: "number" }] }
								},
								required: ["x", "sub"]
							}
						},
						xField: { type: "string" },
						subField: { type: "string" }
					},
					required: ["items"]
				},
				postconditions: [{ description: "The bar chart visibility filter should exclude the requested (category, subcategory) items, and the stored visibility state should reflect the reduced visible item set." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid bar widget in the current workspace.",
					failureMessage: "bar.removeBarItems requires a valid bar target widget."
				}],
				effects: affectedRefs.map((ref) => makeHighlightEffect(ref, ref === widgetRef ? "The managed bar-item visibility filter contracts to exclude the requested grouped or stacked members." : "Linked widgets may update to reflect the reduced item set.")),
				examples: [{
					userGoal: "Temporarily remove a few grouped or stacked members from the current comparison without resetting the whole chart.",
					params: {
						items: [{
							x: "A",
							sub: "Type2"
						}],
						xField: "category",
						subField: "type"
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "bar.filterSubcategories",
				title: "Filter bar subcategories",
				description: "Exclude one or more grouped or stacked subcategories from the current bar chart while preserving the remaining categories.",
				primitive: "filter",
				category: "dataTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "transforms" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						subcategoriesToRemove: {
							type: "array",
							items: { anyOf: [{ type: "string" }, { type: "number" }] }
						},
						subField: { type: "string" }
					},
					required: ["subcategoriesToRemove"]
				},
				postconditions: [{ description: "The bar chart transform list should exclude the requested subcategories, and the color domain should drop them when explicitly enumerated." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid bar widget in the current workspace.",
					failureMessage: "bar.filterSubcategories requires a valid bar target widget."
				}],
				effects: affectedRefs.map((ref) => makeHighlightEffect(ref, ref === widgetRef ? "The requested grouped or stacked subcategories are excluded from the current bar chart." : "Linked widgets may update to reflect the removed subcategories.")),
				examples: [{
					userGoal: "Remove several grouped or stacked subcategories before comparing the remaining composition.",
					params: {
						subcategoriesToRemove: ["Type2"],
						subField: "type"
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "bar.expandStack",
				title: "Expand a stacked bar into parallel bars",
				description: "Filter to one category from a stacked bar chart and expand its stacked segments into parallel bars for easier comparison.",
				primitive: "reencode",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: { category: { anyOf: [{ type: "string" }, { type: "number" }] } },
					required: ["category"]
				},
				postconditions: [{ description: "The bar chart should filter to the requested category, move the stacked grouping field onto the x-axis, and remove y-axis stacking." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid bar widget in the current workspace.",
					failureMessage: "bar.expandStack requires a valid bar target widget."
				}],
				effects: affectedRefs.map((ref) => makeHighlightEffect(ref, ref === widgetRef ? "The stacked category is expanded into side-by-side bars for direct comparison." : "Linked widgets may update to reflect the expanded stacked-bar focus view.")),
				examples: [{
					userGoal: "Expand one stacked category to compare its internal composition without stacked baselines.",
					params: { category: "East China" }
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "bar.toggleStackMode",
				title: "Toggle grouped or stacked mode",
				description: "Switch a grouped/stacked bar chart between grouped and stacked display modes.",
				primitive: "reencode",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: { mode: {
						type: "string",
						enum: ["grouped", "stacked"]
					} },
					required: ["mode"]
				},
				postconditions: [{ description: "Grouped mode should add xOffset and remove y-axis stacking; stacked mode should remove xOffset and restore y-axis stacking." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid bar widget in the current workspace.",
					failureMessage: "bar.toggleStackMode requires a valid bar target widget."
				}],
				effects: affectedRefs.map((ref) => makeHighlightEffect(ref, ref === widgetRef ? "The bar chart display mode switches between grouped and stacked layouts." : "Linked widgets may update to reflect the new stacked/grouped comparison view.")),
				examples: [{
					userGoal: "Switch the current stacked bar chart into grouped mode for easier cross-category comparison.",
					params: { mode: "grouped" }
				}],
				reversible: true
			})
		];
	}
	function registerBarActions(actionExecutor) {
		if (!actionExecutor.has("bar.selectCategory")) actionExecutor.register({ name: "bar.selectCategory" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "bar"
			});
			const field = typeof params.field === "string" ? params.field : null;
			const values = Array.isArray(params.values) ? params.values.filter((value) => typeof value === "string") : [];
			if (!targetWidget || !field || values.length === 0) throw new Error("bar.selectCategory requires a bar target, field, and one or more values.");
			const { rows: visibleRows } = ctx.readRowsForWidget(targetWidget.ref);
			const matchedCount = visibleRows.filter((row) => values.includes(row?.[field])).length;
			return buildSelectionActionResult({
				ctx,
				nextState: ctx.commitSelection({
					selection_id: `sel_${Date.now()}`,
					source_widget_id: targetWidget.widgetId || void 0,
					selection_type: "category",
					field,
					values,
					predicates: [{
						field,
						op: "in",
						value: values
					}],
					count: matchedCount,
					summary: `${field}: ${values.join(", ")}`
				}),
				selectedCount: matchedCount,
				verificationHints: ["Read the updated bar selection state.", "Read the linked widget feedback or visible rows to confirm highlight propagation."]
			});
		});
		if (!actionExecutor.has("bar.sortBars")) actionExecutor.register({ name: "bar.sortBars" }, async (call, ctx) => {
			const params = call?.params || {};
			const channel = typeof params.channel === "string" ? params.channel : null;
			const order = params.order === "ascending" || params.order === "descending" ? params.order : null;
			const field = typeof params.field === "string" ? params.field : null;
			const aggregate = typeof params.aggregate === "string" ? params.aggregate : null;
			const bySubcategory = params.bySubcategory;
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "bar",
				message: "bar.sortBars requires a valid bar target widget."
			});
			const targetWidgetId = targetWidget?.widgetId || null;
			if (!channel || !order || !targetWidgetId) throw new Error("bar.sortBars requires a bar target, channel, and order.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for bar sort updates.");
					const { categoryChannel, valueChannel } = detectBarChannels(spec, channel);
					const currentCategoryChannel = spec.encoding?.[categoryChannel];
					const currentValueChannel = spec.encoding?.[valueChannel];
					if (!currentCategoryChannel || typeof currentCategoryChannel !== "object") throw new Error(`The active spec does not define encoding channel "${categoryChannel}".`);
					if (!currentValueChannel || typeof currentValueChannel !== "object") throw new Error(`The active spec does not define encoding channel "${valueChannel}".`);
					const categoryField = currentCategoryChannel.field;
					const measureField = field && field !== categoryField ? field : currentValueChannel.field;
					if (!categoryField || !measureField) throw new Error("bar.sortBars requires both categorical and quantitative fields on the active bar spec.");
					const rows = resolveBarRowsForAction(spec, ctx, targetWidget.ref);
					if (rows.length === 0) throw new Error("bar.sortBars requires bar rows from inline values or the current runtime data view.");
					const colorField = spec?.encoding?.color?.field || null;
					const sortScores = aggregateBarValues(rows, {
						categoryField,
						valueField: measureField,
						aggregate: aggregate || currentValueChannel.aggregate || "mean",
						colorField,
						bySubcategory
					});
					const sortedCategories = [...new Set(rows.map((row) => row[categoryField]).filter((value) => value != null))].sort((left, right) => {
						const leftScore = sortScores.get(left) ?? 0;
						const rightScore = sortScores.get(right) ?? 0;
						if (leftScore === rightScore) return String(left).localeCompare(String(right));
						return order === "ascending" ? leftScore - rightScore : rightScore - leftScore;
					});
					const nextEncoding = {
						...spec.encoding || {},
						[categoryChannel]: {
							...currentCategoryChannel,
							sort: sortedCategories
						}
					};
					return {
						...spec,
						encoding: nextEncoding
					};
				}),
				result: {
					widgetId: targetWidgetId,
					channel,
					order,
					...field ? { field } : {},
					...aggregate ? { aggregate } : {},
					...bySubcategory != null ? { bySubcategory } : {}
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the bar chart encoding now uses an explicit sorted category array.", "Read the target widget state to confirm the requested category ranking propagated to the view."]
			};
		});
		if (!actionExecutor.has("bar.highlightTopN")) actionExecutor.register({ name: "bar.highlightTopN" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "bar",
				message: "bar.highlightTopN requires a valid bar target widget."
			});
			const n = Number.isFinite(params.n) ? Math.max(1, Math.floor(params.n)) : null;
			const order = params.order === "ascending" || params.order === "descending" ? params.order : "descending";
			if (!targetWidget || !n) throw new Error("bar.highlightTopN requires a bar target and a positive integer n.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for bar highlight updates.");
					const categoryField = typeof params.categoryField === "string" ? params.categoryField : spec?.encoding?.x?.field || spec?.encoding?.y?.field || null;
					const measureField = typeof params.measureField === "string" ? params.measureField : spec?.encoding?.y?.field || spec?.encoding?.x?.field || null;
					const rows = resolveBarRowsForAction(spec, ctx, targetWidget.ref);
					if (!categoryField || !measureField || rows.length === 0) throw new Error("bar.highlightTopN requires category/measure fields and bar rows from inline values or the current runtime data view.");
					const totals = /* @__PURE__ */ new Map();
					for (const row of rows) {
						const category = row?.[categoryField];
						const value = row?.[measureField];
						if (category == null || typeof value !== "number") continue;
						totals.set(category, (totals.get(category) || 0) + value);
					}
					const sortedCategories = [...totals.entries()].sort((a, b) => order === "ascending" ? a[1] - b[1] : b[1] - a[1]).slice(0, n).map(([category]) => category);
					if (sortedCategories.length === 0) throw new Error("bar.highlightTopN could not derive any categories from the current bar data.");
					const testExpr = sortedCategories.map((category) => `datum['${categoryField}'] == ${typeof category === "string" ? `'${category}'` : String(category)}`).join(" || ");
					return {
						...spec,
						encoding: {
							...spec.encoding || {},
							opacity: {
								condition: {
									test: testExpr,
									value: 1
								},
								value: .2
							}
						}
					};
				}),
				result: {
					widgetId: targetWidget.widgetId,
					n,
					order,
					...typeof params.categoryField === "string" ? { categoryField: params.categoryField } : {},
					...typeof params.measureField === "string" ? { measureField: params.measureField } : {}
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the bar chart opacity condition now highlights the top-N categories.", "Read the target widget view state to confirm the requested top categories are emphasized."]
			};
		});
		if (!actionExecutor.has("bar.filterCategories")) actionExecutor.register({ name: "bar.filterCategories" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "bar",
				message: "bar.filterCategories requires a valid bar target widget."
			});
			const categories = Array.isArray(params.categories) ? params.categories.filter((value) => value != null) : [];
			if (!targetWidget || categories.length === 0) throw new Error("bar.filterCategories requires a bar target and one or more categories.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for bar category filtering.");
					const field = typeof params.field === "string" ? params.field : spec?.encoding?.x?.field || spec?.encoding?.y?.field || null;
					if (!field) throw new Error("bar.filterCategories requires a categorical field on the active bar spec.");
					return {
						...spec,
						transform: replaceFilterTransformForField(spec.transform, field, { filter: {
							field,
							oneOf: categories
						} })
					};
				}),
				result: {
					widgetId: targetWidget.widgetId,
					field: typeof params.field === "string" ? params.field : void 0,
					categories
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the bar chart transform now filters to the requested categories.", "Read the target widget rows to confirm only the requested categories remain visible."]
			};
		});
		if (!actionExecutor.has("bar.addBars")) actionExecutor.register({ name: "bar.addBars" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "bar",
				message: "bar.addBars requires a valid bar target widget."
			});
			const values = Array.isArray(params.values) ? params.values.filter((value) => value != null) : [];
			if (!targetWidget || values.length === 0) throw new Error("bar.addBars requires a bar target and one or more category values.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for expanding bar visibility.");
					const field = detectCategoryField(spec, params.field);
					if (!field) throw new Error("bar.addBars requires a categorical field on the active bar spec.");
					const rows = resolveBarRowsForAction(spec, ctx, targetWidget.ref);
					const existingCategories = new Set(rows.map((row) => row[field]).filter((value) => value != null));
					const visibilityState = spec?._bar_visibility_state;
					const visible = visibilityState?.mode === "x" && visibilityState?.x_field === field && Array.isArray(visibilityState.visible_x) ? new Set(visibilityState.visible_x) : new Set(existingCategories);
					const missingValues = [];
					for (const value of values) if (existingCategories.has(value)) visible.add(value);
					else missingValues.push(value);
					const nextVisible = [...visible].sort((left, right) => String(left).localeCompare(String(right)));
					const nextSpec = {
						...spec,
						transform: replaceTaggedTransform$2(spec.transform, "bar.addBars", {
							filter: {
								field,
								oneOf: nextVisible
							},
							_widgetvaTag: "bar.addBars"
						}),
						_bar_visibility_state: {
							mode: "x",
							x_field: field,
							visible_x: nextVisible,
							last_operation: "add"
						}
					};
					if (missingValues.length > 0) nextSpec._bar_visibility_state = {
						...nextSpec._bar_visibility_state,
						missing_values: missingValues
					};
					return nextSpec;
				}),
				result: {
					widgetId: targetWidget.widgetId,
					values,
					...typeof params.field === "string" ? { field: params.field } : {}
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the managed bar visibility filter now includes the requested categories.", "Read the target widget view state to confirm the visible category set expanded without resetting unrelated bar encodings."]
			};
		});
		if (!actionExecutor.has("bar.removeBars")) actionExecutor.register({ name: "bar.removeBars" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "bar",
				message: "bar.removeBars requires a valid bar target widget."
			});
			const values = Array.isArray(params.values) ? params.values.filter((value) => value != null) : [];
			if (!targetWidget || values.length === 0) throw new Error("bar.removeBars requires a bar target and one or more category values.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for shrinking bar visibility.");
					const field = detectCategoryField(spec, params.field);
					if (!field) throw new Error("bar.removeBars requires a categorical field on the active bar spec.");
					const rows = resolveBarRowsForAction(spec, ctx, targetWidget.ref);
					const existingCategories = new Set(rows.map((row) => row[field]).filter((value) => value != null));
					const visibilityState = spec?._bar_visibility_state;
					const visible = visibilityState?.mode === "x" && visibilityState?.x_field === field && Array.isArray(visibilityState.visible_x) ? new Set(visibilityState.visible_x) : new Set(existingCategories);
					for (const value of values) visible.delete(value);
					const nextVisible = [...visible].sort((left, right) => String(left).localeCompare(String(right)));
					return {
						...spec,
						transform: replaceTaggedTransform$2(spec.transform, "bar.addBars", {
							filter: {
								field,
								oneOf: nextVisible
							},
							_widgetvaTag: "bar.addBars"
						}),
						_bar_visibility_state: {
							mode: "x",
							x_field: field,
							visible_x: nextVisible,
							last_operation: "remove"
						}
					};
				}),
				result: {
					widgetId: targetWidget.widgetId,
					values,
					...typeof params.field === "string" ? { field: params.field } : {}
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the managed bar visibility filter now excludes the requested categories.", "Read the target widget view state to confirm the visible category set shrank without resetting unrelated bar encodings."]
			};
		});
		if (!actionExecutor.has("bar.addBarItems")) actionExecutor.register({ name: "bar.addBarItems" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "bar",
				message: "bar.addBarItems requires a valid bar target widget."
			});
			const items = Array.isArray(params.items) ? params.items.filter((item) => item && typeof item === "object" && item.x != null && item.sub != null) : [];
			if (!targetWidget || items.length === 0) throw new Error("bar.addBarItems requires a bar target and one or more { x, sub } items.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for expanding bar-item visibility.");
					const xField = detectCategoryField(spec, params.xField);
					const subField = detectSubcategoryField(spec, params.subField);
					if (!xField) throw new Error("bar.addBarItems requires a categorical x field on the active bar spec.");
					if (!subField) throw new Error("bar.addBarItems requires a grouped or stacked subcategory field on the active bar spec.");
					const rows = resolveBarRowsForAction(spec, ctx, targetWidget.ref);
					const existingPairs = new Set(rows.map((row) => row[xField] != null && row[subField] != null ? JSON.stringify([row[xField], row[subField]]) : null).filter(Boolean));
					const visibilityState = spec?._bar_visibility_state;
					const visiblePairs = visibilityState?.mode === "item" && visibilityState?.x_field === xField && visibilityState?.sub_field === subField && Array.isArray(visibilityState.visible_items) ? new Set(visibilityState.visible_items.map((pair) => JSON.stringify(pair))) : new Set(existingPairs);
					const missingItems = [];
					for (const item of items) {
						const pairKey = JSON.stringify([item.x, item.sub]);
						if (existingPairs.has(pairKey)) visiblePairs.add(pairKey);
						else missingItems.push({
							x: item.x,
							sub: item.sub
						});
					}
					const nextVisiblePairs = [...visiblePairs].map((pairKey) => JSON.parse(pairKey)).sort((left, right) => {
						const xCompare = String(left[0]).localeCompare(String(right[0]));
						if (xCompare !== 0) return xCompare;
						return String(left[1]).localeCompare(String(right[1]));
					});
					const filterExpr = nextVisiblePairs.length > 0 ? nextVisiblePairs.map(([xValue, subValue]) => `(datum['${xField}'] == ${JSON.stringify(xValue)} && datum['${subField}'] == ${JSON.stringify(subValue)})`).join(" || ") : "false";
					const nextSpec = {
						...spec,
						transform: replaceTaggedTransform$2(spec.transform, "bar.addBarItems", {
							filter: filterExpr,
							_widgetvaTag: "bar.addBarItems"
						}),
						_bar_visibility_state: {
							mode: "item",
							x_field: xField,
							sub_field: subField,
							visible_items: nextVisiblePairs,
							last_operation: "add"
						}
					};
					if (missingItems.length > 0) nextSpec._bar_visibility_state = {
						...nextSpec._bar_visibility_state,
						missing_items: missingItems
					};
					return nextSpec;
				}),
				result: {
					widgetId: targetWidget.widgetId,
					items,
					...typeof params.xField === "string" ? { xField: params.xField } : {},
					...typeof params.subField === "string" ? { subField: params.subField } : {}
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the managed bar-item visibility filter now includes the requested grouped or stacked members.", "Read the target widget view state to confirm the visible item set expanded without resetting unrelated bar encodings."]
			};
		});
		if (!actionExecutor.has("bar.removeBarItems")) actionExecutor.register({ name: "bar.removeBarItems" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "bar",
				message: "bar.removeBarItems requires a valid bar target widget."
			});
			const items = Array.isArray(params.items) ? params.items.filter((item) => item && typeof item === "object" && item.x != null && item.sub != null) : [];
			if (!targetWidget || items.length === 0) throw new Error("bar.removeBarItems requires a bar target and one or more { x, sub } items.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for shrinking bar-item visibility.");
					const xField = detectCategoryField(spec, params.xField);
					const subField = detectSubcategoryField(spec, params.subField);
					if (!xField) throw new Error("bar.removeBarItems requires a categorical x field on the active bar spec.");
					if (!subField) throw new Error("bar.removeBarItems requires a grouped or stacked subcategory field on the active bar spec.");
					const rows = resolveBarRowsForAction(spec, ctx, targetWidget.ref);
					const existingPairs = new Set(rows.map((row) => row[xField] != null && row[subField] != null ? JSON.stringify([row[xField], row[subField]]) : null).filter(Boolean));
					const visibilityState = spec?._bar_visibility_state;
					const visiblePairs = visibilityState?.mode === "item" && visibilityState?.x_field === xField && visibilityState?.sub_field === subField && Array.isArray(visibilityState.visible_items) ? new Set(visibilityState.visible_items.map((pair) => JSON.stringify(pair))) : new Set(existingPairs);
					for (const item of items) visiblePairs.delete(JSON.stringify([item.x, item.sub]));
					const nextVisiblePairs = [...visiblePairs].map((pairKey) => JSON.parse(pairKey)).sort((left, right) => {
						const xCompare = String(left[0]).localeCompare(String(right[0]));
						if (xCompare !== 0) return xCompare;
						return String(left[1]).localeCompare(String(right[1]));
					});
					const filterExpr = nextVisiblePairs.length > 0 ? nextVisiblePairs.map(([xValue, subValue]) => `(datum['${xField}'] == ${JSON.stringify(xValue)} && datum['${subField}'] == ${JSON.stringify(subValue)})`).join(" || ") : "false";
					return {
						...spec,
						transform: replaceTaggedTransform$2(spec.transform, "bar.addBarItems", {
							filter: filterExpr,
							_widgetvaTag: "bar.addBarItems"
						}),
						_bar_visibility_state: {
							mode: "item",
							x_field: xField,
							sub_field: subField,
							visible_items: nextVisiblePairs,
							last_operation: "remove"
						}
					};
				}),
				result: {
					widgetId: targetWidget.widgetId,
					items,
					...typeof params.xField === "string" ? { xField: params.xField } : {},
					...typeof params.subField === "string" ? { subField: params.subField } : {}
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the managed bar-item visibility filter now excludes the requested grouped or stacked members.", "Read the target widget view state to confirm the visible item set shrank without resetting unrelated bar encodings."]
			};
		});
		if (!actionExecutor.has("bar.filterSubcategories")) actionExecutor.register({ name: "bar.filterSubcategories" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "bar",
				message: "bar.filterSubcategories requires a valid bar target widget."
			});
			const subcategoriesToRemove = Array.isArray(params.subcategoriesToRemove) ? params.subcategoriesToRemove.filter((value) => value != null) : [];
			if (!targetWidget || subcategoriesToRemove.length === 0) throw new Error("bar.filterSubcategories requires a bar target and one or more subcategories to remove.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for bar subcategory filtering.");
					const subField = detectSubcategoryField(spec, params.subField);
					if (!subField) throw new Error("bar.filterSubcategories requires a subcategory field on the active bar spec.");
					const nextSpec = {
						...spec,
						transform: replaceTaggedTransform$2(spec.transform, "bar.filterSubcategories", {
							filter: {
								field: subField,
								notOneOf: [...subcategoriesToRemove]
							},
							_widgetvaTag: "bar.filterSubcategories"
						})
					};
					const colorScaleDomain = nextSpec?.encoding?.color?.scale?.domain;
					if (Array.isArray(colorScaleDomain)) nextSpec.encoding = {
						...nextSpec.encoding || {},
						color: {
							...nextSpec.encoding?.color || {},
							scale: {
								...nextSpec.encoding?.color?.scale || {},
								domain: colorScaleDomain.filter((value) => !subcategoriesToRemove.includes(value))
							}
						}
					};
					return nextSpec;
				}),
				result: {
					widgetId: targetWidget.widgetId,
					subcategoriesToRemove,
					...typeof params.subField === "string" ? { subField: params.subField } : {}
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the bar chart transform now excludes the requested subcategories.", "Read the target widget rows and color scale metadata to confirm the removed subcategories no longer appear."]
			};
		});
		if (!actionExecutor.has("bar.expandStack")) actionExecutor.register({ name: "bar.expandStack" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "bar",
				message: "bar.expandStack requires a valid bar target widget."
			});
			const category = params.category;
			if (!targetWidget || category == null) throw new Error("bar.expandStack requires a bar target and a category value.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for stacked-bar expansion.");
					const encoding = spec.encoding || {};
					const xField = encoding?.x?.field || null;
					const colorEncoding = encoding?.color || {};
					const colorField = colorEncoding?.field || null;
					if (!xField) throw new Error("bar.expandStack requires an x encoding field on the active bar spec.");
					if (!colorField) throw new Error("bar.expandStack requires a color encoding field on the active stacked bar spec.");
					const nextEncoding = {
						...encoding || {},
						x: {
							field: colorField,
							type: "nominal",
							title: colorEncoding?.title || colorField,
							axis: { labelAngle: -45 },
							...colorEncoding?.scale?.domain ? { sort: colorEncoding.scale.domain } : {}
						},
						y: { ...encoding?.y || {} }
					};
					delete nextEncoding.y.stack;
					return {
						...spec,
						transform: replaceTaggedTransform$2(spec.transform, "bar.expandStack", {
							filter: `datum['${xField}'] == ${JSON.stringify(category)}`,
							_widgetvaTag: "bar.expandStack"
						}),
						encoding: nextEncoding,
						_bar_expand_stack_state: {
							category,
							category_field: xField,
							group_field: colorField
						}
					};
				}),
				result: {
					widgetId: targetWidget.widgetId,
					category
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the chart is filtered to the requested category and the x-axis now uses the stacked grouping field.", "Read the target widget view state to confirm y-axis stacking was removed for parallel comparison."]
			};
		});
		if (!actionExecutor.has("bar.toggleStackMode")) actionExecutor.register({ name: "bar.toggleStackMode" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "bar",
				message: "bar.toggleStackMode requires a valid bar target widget."
			});
			const mode = params.mode === "grouped" || params.mode === "stacked" ? params.mode : null;
			if (!targetWidget || !mode) throw new Error("bar.toggleStackMode requires a bar target and mode of either \"grouped\" or \"stacked\".");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for bar stack-mode toggling.");
					const colorField = spec?.encoding?.color?.field || null;
					if (!colorField) throw new Error("bar.toggleStackMode requires a color encoding field on the active bar spec.");
					const nextEncoding = {
						...spec.encoding || {},
						y: { ...spec.encoding?.y || {} }
					};
					if (mode === "grouped") {
						nextEncoding.xOffset = { field: colorField };
						delete nextEncoding.y.stack;
					} else {
						delete nextEncoding.xOffset;
						nextEncoding.y.stack = "zero";
					}
					return {
						...spec,
						encoding: nextEncoding,
						_stack_mode: mode
					};
				}),
				result: {
					widgetId: targetWidget.widgetId,
					mode
				},
				verificationHints: ["Call perception.inspectViewConfig to verify grouped mode adds xOffset and stacked mode restores y-axis stacking.", "Read the target widget view state to confirm the stored stack-mode marker was updated."]
			};
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgets/shared/dataPerception.js
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
	//#region ../../widgetva-kit/src/adapters/widgets/shared/perceptionScope.js
	function buildScopedPerceptionParamsSchema(extraProperties = {}) {
		return {
			type: "object",
			properties: { ...extraProperties || {} }
		};
	}
	function buildQueryScopeExample({ userGoal, params = {}, widgetRef = "wl://demo/workspace/main/widget/current", dataRef = "wl://demo/workspace/main/data/current_view", selectionRef = null } = {}) {
		return {
			userGoal,
			params: {
				...params || {},
				queryScope: {
					widgetRef,
					dataRef,
					...selectionRef ? { selectionRef } : {}
				}
			}
		};
	}
	function appendQueryScopeGuidance(description) {
		const base = typeof description === "string" ? description.trim() : "";
		const guidance = "Use queryScope for widget/data/selection targeting.";
		if (!base) return guidance;
		return `${base} ${guidance}`;
	}
	//#endregion
	//#region ../../widgetva-kit/src/widgets/bar/perception.js
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
	//#region ../../widgetva-kit/src/adapters/widgets/bar/humanInteraction.js
	function getBarHumanInteractionConfig() {
		return {
			mode: "categoryClick",
			actionName: "bar.selectCategory",
			supportsDirectManipulation: true
		};
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgets/shared/applyVegaLiteState.js
	function setSignalSafely(view, name, value) {
		if (!view || typeof view.signal !== "function") return;
		try {
			view.signal(name, value);
		} catch {}
	}
	function normalizeSelections$2(state) {
		return Object.values(state?.selections || {}).filter(Boolean);
	}
	function resolveRepresentativeSelection$2(selections) {
		const normalizedSelections = Array.isArray(selections) ? selections.filter(Boolean) : [];
		if (normalizedSelections.length !== 1) return null;
		return normalizedSelections[0] || null;
	}
	function resolvePrimaryIntervalSelection$2(selections) {
		return (Array.isArray(selections) ? selections : []).find((selection) => selection?.kind === "interval") || null;
	}
	function selectionValuesFromPredicates(predicates) {
		if (!Array.isArray(predicates)) return [];
		return predicates.filter((predicate) => predicate?.op === "equals" || predicate?.op === "in").flatMap((predicate) => Array.isArray(predicate?.value) ? predicate.value : [predicate?.value]).filter((value) => value != null);
	}
	function setDomainSignals(view, state) {
		const xDomain = state?.view?.xDomain;
		const yDomain = state?.view?.yDomain;
		if (Array.isArray(xDomain)) {
			setSignalSafely(view, "xDomain", xDomain);
			setSignalSafely(view, "widgetva_xDomain", xDomain);
		}
		if (Array.isArray(yDomain)) {
			setSignalSafely(view, "yDomain", yDomain);
			setSignalSafely(view, "widgetva_yDomain", yDomain);
		}
	}
	function setIntervalSelectionSignals(view, selection) {
		const xDomain = selection?.domain?.xDomain;
		const yDomain = selection?.domain?.yDomain;
		if (!Array.isArray(xDomain) || !Array.isArray(yDomain)) {
			setSignalSafely(view, "brush", null);
			setSignalSafely(view, "brush_x_1", null);
			setSignalSafely(view, "brush_x_2", null);
			setSignalSafely(view, "brush_y_1", null);
			setSignalSafely(view, "brush_y_2", null);
			return;
		}
		setSignalSafely(view, "brush", {
			x: xDomain,
			y: yDomain
		});
		setSignalSafely(view, "brush_x_1", xDomain[0]);
		setSignalSafely(view, "brush_x_2", xDomain[1]);
		setSignalSafely(view, "brush_y_1", yDomain[0]);
		setSignalSafely(view, "brush_y_2", yDomain[1]);
	}
	function setSelectionSummarySignals(view, selection, selections = []) {
		const normalizedSelections = Array.isArray(selections) ? selections.filter(Boolean) : [];
		const predicates = selection ? Array.isArray(selection?.predicates) ? selection.predicates : [] : normalizedSelections.flatMap((entry) => Array.isArray(entry?.predicates) ? entry.predicates : []);
		const selectionSummaries = normalizedSelections.map((entry) => entry?.summary || "").filter(Boolean);
		const selectionPredicates = normalizedSelections.map((entry) => Array.isArray(entry?.predicates) ? entry.predicates : []);
		setSignalSafely(view, "widgetva_selectionKind", selection?.kind || null);
		setSignalSafely(view, "widgetva_selectionDomain", selection?.domain || null);
		setSignalSafely(view, "widgetva_selectedValues", selectionValuesFromPredicates(predicates));
		setSignalSafely(view, "widgetva_selectionCount", normalizedSelections.length);
		setSignalSafely(view, "widgetva_selections", normalizedSelections);
		setSignalSafely(view, "widgetva_selectionSummaries", selectionSummaries);
		setSignalSafely(view, "widgetva_selectionPredicateGroups", selectionPredicates);
	}
	function setWidgetVASignals(view, state, selection, selections) {
		const feedback = state?.feedback || {};
		setSignalSafely(view, "widgetva_selection", selection || null);
		setSelectionSummarySignals(view, selection, selections);
		const normalizedSelections = Array.isArray(selections) ? selections.filter(Boolean) : [];
		const aggregatedSummary = normalizedSelections.map((entry) => entry?.summary || "").filter(Boolean).join(" · ");
		const aggregatedPredicates = selection ? Array.isArray(selection?.predicates) ? selection.predicates : [] : normalizedSelections.flatMap((entry) => Array.isArray(entry?.predicates) ? entry.predicates : []);
		setSignalSafely(view, "widgetva_selectionSummary", selection?.summary || aggregatedSummary);
		setSignalSafely(view, "widgetva_selectionPredicates", aggregatedPredicates);
		setSignalSafely(view, "widgetva_selectedCount", state?.data?.selectedCount ?? 0);
		setSignalSafely(view, "widgetva_visibleCount", state?.data?.visibleCount ?? 0);
		setSignalSafely(view, "widgetva_highlightedKeys", Array.isArray(feedback?.highlightedKeys) ? feedback.highlightedKeys : []);
		setSignalSafely(view, "widgetva_inboundLinkIds", Array.isArray(feedback?.inboundLinkIds) ? feedback.inboundLinkIds : []);
		setSignalSafely(view, "widgetva_linkedSourceRefs", Array.isArray(feedback?.linkedSourceRefs) ? feedback.linkedSourceRefs : []);
	}
	async function applyVegaLiteRuntimeState({ view, state }) {
		if (!view || !state) return;
		const selections = normalizeSelections$2(state);
		const selection = resolveRepresentativeSelection$2(selections);
		const intervalSelection = resolvePrimaryIntervalSelection$2(selections);
		setDomainSignals(view, state);
		setIntervalSelectionSignals(view, intervalSelection);
		setWidgetVASignals(view, state, selection, selections);
		try {
			await view.runAsync?.();
		} catch {}
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgets/bar/state.js
	async function applyBarState(args) {
		return applyVegaLiteRuntimeState(args);
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgetFamilies/barWidgetAdapter.js
	var barWidgetAdapter = createVegaLiteWidgetAdapter({
		kind: "bar",
		bindHumanInteractions({ view, spec, interactionConfig, selectionSourceWidgetId, actionTargetRef, onActionCall, onSelectionChange }) {
			return bindWidgetHumanInteractions({
				view,
				spec,
				interactionConfig,
				selectionSourceWidgetId,
				actionTargetRef,
				onActionCall,
				onSelectionChange
			});
		},
		async applyState(args) {
			return applyBarState(args);
		},
		buildActionDescriptors({ widgetRef, selectionRef, scope = "local", affectedRefs = [widgetRef] }) {
			return buildBarActionDescriptors({
				widgetRef,
				selectionRef,
				scope,
				affectedRefs
			});
		},
		buildPerceptionDescriptors({ dataRef }) {
			return buildBarPerceptionDescriptors({ dataRef });
		},
		getHumanInteractionConfig() {
			return getBarHumanInteractionConfig();
		},
		registerActions(actionExecutor) {
			return registerBarActions(actionExecutor);
		},
		registerPerceptionQueries(perceptionRegistry) {
			return registerBarPerceptionQueries(perceptionRegistry);
		}
	});
	//#endregion
	//#region ../../widgetva-kit/src/adapters/providerFamilyBehavior.js
	function clone$2(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function uniqueValues(values) {
		return [...new Set((Array.isArray(values) ? values : []).filter((value) => value != null))];
	}
	function normalizeSelections$1(state) {
		return Object.values(state?.selections || {}).filter(Boolean);
	}
	function resolveRepresentativeSelection$1(selections) {
		const normalizedSelections = Array.isArray(selections) ? selections.filter(Boolean) : [];
		if (normalizedSelections.length === 1) return normalizedSelections[0] || null;
		const pointSelections = normalizedSelections.filter((selection) => selection?.kind === "point");
		if (pointSelections.length === 1) return pointSelections[0] || null;
		return normalizedSelections[0] || null;
	}
	function resolvePrimaryIntervalSelection$1(selections) {
		return (Array.isArray(selections) ? selections : []).find((selection) => selection?.kind === "interval") || null;
	}
	function buildHumanActionCall({ name, actionTargetRef, params }) {
		return {
			callId: `human_${Date.now()}`,
			name,
			actor: "human",
			targetRef: actionTargetRef || void 0,
			params: {
				targetRef: actionTargetRef || void 0,
				...params
			}
		};
	}
	function resolveCategoryField({ spec, interactionConfig, selection = null }) {
		if (typeof selection?.field === "string" && selection.field.length > 0) return selection.field;
		const enc = spec?.encoding || {};
		const preferredChannel = interactionConfig?.categoryFieldChannel;
		if (preferredChannel && enc?.[preferredChannel]?.field) return enc[preferredChannel].field;
		if (typeof interactionConfig?.categoryField === "string" && interactionConfig.categoryField.length > 0) return interactionConfig.categoryField;
		return enc.color?.field || enc.shape?.field || enc.detail?.field || enc.key?.field || enc.x?.field || enc.y?.field || null;
	}
	function resolveCellFields({ spec, interactionConfig, selection = null }) {
		return {
			xField: selection?.xField || interactionConfig?.xField || spec?.encoding?.x?.field || null,
			yField: selection?.yField || interactionConfig?.yField || spec?.encoding?.y?.field || null
		};
	}
	function resolveTableKeyField({ interactionConfig, selection = null, eventData = null }) {
		return selection?.keyField || interactionConfig?.keyField || (eventData && typeof eventData === "object" ? Object.keys(eventData)[0] || null : null) || null;
	}
	function writeSurfaceState(surface, state, selection) {
		if (!surface) return;
		surface.dataset.widgetvaSelectedCount = String(state?.data?.selectedCount ?? 0);
		surface.dataset.widgetvaVisibleCount = String(state?.data?.visibleCount ?? 0);
		surface.dataset.widgetvaSelectionSummary = selection?.summary || "";
	}
	function resolveFocusPayload(state) {
		const view = state?.view && typeof state.view === "object" && !Array.isArray(state.view) ? state.view : null;
		if (!view) return null;
		const focusPayload = {
			...view.focusedCarId != null ? { focusedCarId: view.focusedCarId } : {},
			...view.focusedSeries != null ? { focusedSeries: clone$2(view.focusedSeries) } : {},
			...view.focusedNode != null ? { focusedNode: view.focusedNode } : {},
			...view.focusedFlow != null ? { focusedFlow: clone$2(view.focusedFlow) } : {}
		};
		return Object.keys(focusPayload).length > 0 ? focusPayload : null;
	}
	function resolveHighlightStatePayload(state) {
		const highlight = state?.view?.highlight;
		if (!highlight || typeof highlight !== "object" || Array.isArray(highlight)) return null;
		return clone$2(highlight);
	}
	function resolveAggregateStatePayload(state) {
		const aggregate = state?.view?.aggregate;
		if (!aggregate || typeof aggregate !== "object" || Array.isArray(aggregate)) return null;
		return clone$2(aggregate);
	}
	function resolveAddRemoveStatePayload(state) {
		const addRemove = state?.view?.addRemove;
		if (!addRemove || typeof addRemove !== "object" || Array.isArray(addRemove)) return null;
		return clone$2(addRemove);
	}
	function resolveAnnotateStatePayload(state) {
		const annotate = state?.view?.annotate;
		if (!annotate || typeof annotate !== "object" || Array.isArray(annotate)) return null;
		return clone$2(annotate);
	}
	function resolveDrillDownStatePayload(state) {
		const drillDown = state?.view?.drillDown;
		if (!drillDown || typeof drillDown !== "object" || Array.isArray(drillDown)) return null;
		return clone$2(drillDown);
	}
	function resolveNavigateStatePayload(state) {
		const navigate = state?.view?.navigate;
		if (!navigate || typeof navigate !== "object" || Array.isArray(navigate)) return null;
		return clone$2(navigate);
	}
	function resolveReencodeStatePayload(state) {
		const reencode = state?.view?.reencode;
		if (!reencode || typeof reencode !== "object" || Array.isArray(reencode)) return null;
		return clone$2(reencode);
	}
	function resolveSortPayload(state) {
		const sort = state?.view?.sort;
		if (!sort || typeof sort !== "object" || Array.isArray(sort)) return null;
		const payload = {
			...typeof sort.channel === "string" ? { channel: sort.channel } : {},
			...typeof sort.field === "string" ? { field: sort.field } : {},
			...typeof sort.mode === "string" ? { mode: sort.mode } : {},
			...typeof sort.order === "string" ? { order: sort.order } : {},
			...typeof sort.aggregate === "string" ? { aggregate: sort.aggregate } : {},
			...Array.isArray(sort.values) ? { values: clone$2(sort.values) } : {}
		};
		return Object.keys(payload).length > 0 ? payload : null;
	}
	function applyD3HostState({ view, surface, state }) {
		if (!state) return;
		const selections = normalizeSelections$1(state);
		const selection = resolveRepresentativeSelection$1(selections);
		const intervalSelection = resolvePrimaryIntervalSelection$1(selections);
		const xDomain = state?.view?.xDomain || intervalSelection?.domain?.xDomain || null;
		const yDomain = state?.view?.yDomain || intervalSelection?.domain?.yDomain || null;
		const aggregateState = resolveAggregateStatePayload(state);
		const addRemoveState = resolveAddRemoveStatePayload(state);
		const annotateState = resolveAnnotateStatePayload(state);
		const drillDownState = resolveDrillDownStatePayload(state);
		const highlightState = resolveHighlightStatePayload(state);
		const focusPayload = resolveFocusPayload(state);
		const navigateState = resolveNavigateStatePayload(state);
		const reencodeState = resolveReencodeStatePayload(state);
		const sortPayload = resolveSortPayload(state);
		const highlightedKeys = Array.isArray(state?.feedback?.highlightedKeys) ? state.feedback.highlightedKeys : [];
		writeSurfaceState(surface, state, selection);
		if (typeof view?.setBrush === "function") view.setBrush(intervalSelection || null);
		if (typeof view?.setViewport === "function") view.setViewport({
			...Array.isArray(xDomain) ? { xDomain: clone$2(xDomain) } : {},
			...Array.isArray(yDomain) ? { yDomain: clone$2(yDomain) } : {}
		});
		else if ((Array.isArray(xDomain) || Array.isArray(yDomain)) && typeof view?.setDomain === "function") view.setDomain(Array.isArray(xDomain) ? xDomain : null, Array.isArray(yDomain) ? yDomain : null);
		if (typeof view?.setSelection === "function") view.setSelection(selection || null);
		if (typeof view?.setHighlights === "function") view.setHighlights([...highlightedKeys]);
		if (highlightState && typeof view?.setHighlightState === "function") view.setHighlightState(highlightState);
		if (aggregateState && typeof view?.setAggregateState === "function") view.setAggregateState(aggregateState);
		if (addRemoveState && typeof view?.setAddRemoveState === "function") view.setAddRemoveState(addRemoveState);
		if (annotateState && typeof view?.setAnnotateState === "function") view.setAnnotateState(annotateState);
		if (drillDownState && typeof view?.setDrillDownState === "function") view.setDrillDownState(drillDownState);
		if (focusPayload && typeof view?.setFocus === "function") view.setFocus(focusPayload);
		if (navigateState && typeof view?.setNavigateState === "function") view.setNavigateState(navigateState);
		if (reencodeState && typeof view?.setReencodeState === "function") view.setReencodeState(reencodeState);
		if (sortPayload && typeof view?.setSort === "function") view.setSort(sortPayload);
	}
	async function renderD3FamilyState({ view, surface, state }) {
		if (!state) return;
		if (typeof view?.renderFromState === "function") return view.renderFromState(clone$2(state), {
			view,
			surface
		});
	}
	function bindD3FamilyInteractions({ view, spec, interactionConfig, selectionSourceWidgetId, actionTargetRef, onActionCall, onSelectionChange }) {
		if (!view || !interactionConfig || interactionConfig.mode === "none") return () => {};
		if (interactionConfig.mode === "brush2d" && typeof view.onBrush === "function") {
			const cleanup = view.onBrush((selection) => {
				const normalizedSelection = selection || null;
				const [xField, yField] = Array.isArray(normalizedSelection?.fields) ? normalizedSelection.fields : [];
				const xRange = xField ? normalizedSelection?.value?.[xField] : null;
				const yRange = yField ? normalizedSelection?.value?.[yField] : null;
				if (typeof onActionCall === "function" && xField && yField && Array.isArray(xRange) && Array.isArray(yRange)) {
					onActionCall(buildHumanActionCall({
						name: interactionConfig.actionName || "scatter.brushRegion",
						actionTargetRef,
						params: {
							xField,
							yField,
							xRange,
							yRange
						}
					}));
					return;
				}
				if (typeof onSelectionChange === "function") onSelectionChange(normalizedSelection ? {
					...normalizedSelection,
					source_widget_id: selectionSourceWidgetId || void 0
				} : null);
			});
			return typeof cleanup === "function" ? cleanup : () => {};
		}
		if (interactionConfig.mode === "categoryClick" && typeof view.onCategoryClick === "function") {
			const cleanup = view.onCategoryClick((selection) => {
				const field = resolveCategoryField({
					spec,
					interactionConfig,
					selection
				});
				const values = uniqueValues(selection?.values || [selection?.value]).filter((value) => typeof value === "string" || typeof value === "number");
				if (!field || values.length === 0 || typeof onActionCall !== "function") return;
				onActionCall(buildHumanActionCall({
					name: interactionConfig.actionName || "widget.selectCategory",
					actionTargetRef,
					params: {
						field,
						values
					}
				}));
			});
			return typeof cleanup === "function" ? cleanup : () => {};
		}
		if (interactionConfig.mode === "cellClick" && typeof view.onCellClick === "function") {
			const cleanup = view.onCellClick((selection) => {
				const { xField, yField } = resolveCellFields({
					spec,
					interactionConfig,
					selection
				});
				const xValue = selection?.xValue;
				const yValue = selection?.yValue;
				if (!xField || !yField || xValue == null || yValue == null || typeof onActionCall !== "function") return;
				onActionCall(buildHumanActionCall({
					name: interactionConfig.actionName || "heatmap.filterCells",
					actionTargetRef,
					params: {
						xField,
						yField,
						xValue,
						yValue
					}
				}));
			});
			return typeof cleanup === "function" ? cleanup : () => {};
		}
		if (interactionConfig.mode === "multiBrush" && typeof view.onMultiBrush === "function") {
			const cleanup = view.onMultiBrush((rules) => {
				const normalizedRules = Array.isArray(rules) ? rules : [];
				if (normalizedRules.length === 0) return;
				if (typeof onActionCall === "function") {
					onActionCall(buildHumanActionCall({
						name: interactionConfig.actionName || "parallelCoordinates.brushAxes",
						actionTargetRef,
						params: { rules: clone$2(normalizedRules) }
					}));
					return;
				}
				if (typeof onSelectionChange === "function") onSelectionChange({
					selection_id: `sel_${Date.now()}`,
					source_widget_id: selectionSourceWidgetId || void 0,
					selection_type: "interval",
					predicates: normalizedRules.map((rule) => ({
						field: rule.field,
						op: "between",
						value: rule.range
					}))
				});
			});
			return typeof cleanup === "function" ? cleanup : () => {};
		}
		if (interactionConfig.mode === "rowClick" && typeof view.onRowClick === "function") {
			const cleanup = view.onRowClick((selection) => {
				const keyField = resolveTableKeyField({
					interactionConfig,
					selection
				});
				const keys = uniqueValues(selection?.keys || [selection?.key]);
				if (!keyField || keys.length === 0 || typeof onActionCall !== "function") return;
				onActionCall(buildHumanActionCall({
					name: interactionConfig.actionName || "table.focusRows",
					actionTargetRef,
					params: {
						keyField,
						keys
					}
				}));
			});
			return typeof cleanup === "function" ? cleanup : () => {};
		}
		return () => {};
	}
	function buildAxisPatch(domain, currentAxis) {
		if (!Array.isArray(domain)) return null;
		const nextAxis = {
			min: domain[0],
			max: domain[1]
		};
		if (Array.isArray(currentAxis)) return currentAxis.map(() => ({ ...nextAxis }));
		return nextAxis;
	}
	function buildDataZoomPatches(currentDataZoom, { xDomain, yDomain }) {
		const zoomItems = Array.isArray(currentDataZoom) ? currentDataZoom : currentDataZoom ? [currentDataZoom] : [];
		const patches = [];
		for (const zoomItem of zoomItems) {
			if (Array.isArray(xDomain) && zoomItem?.xAxisIndex != null) patches.push({
				xAxisIndex: zoomItem.xAxisIndex,
				startValue: xDomain[0],
				endValue: xDomain[1]
			});
			if (Array.isArray(yDomain) && zoomItem?.yAxisIndex != null) patches.push({
				yAxisIndex: zoomItem.yAxisIndex,
				startValue: yDomain[0],
				endValue: yDomain[1]
			});
		}
		return patches;
	}
	function readEChartsCurrentOption(view) {
		if (typeof view?.getOption !== "function") return null;
		try {
			return view.getOption() || null;
		} catch {
			return null;
		}
	}
	function buildEChartsFamilyOption({ state, view }) {
		if (!state) return null;
		const selections = normalizeSelections$1(state);
		const selection = resolveRepresentativeSelection$1(selections);
		const intervalSelection = resolvePrimaryIntervalSelection$1(selections);
		const xDomain = state?.view?.xDomain || intervalSelection?.domain?.xDomain || null;
		const yDomain = state?.view?.yDomain || intervalSelection?.domain?.yDomain || null;
		const currentOption = readEChartsCurrentOption(view);
		const option = { widgetva: {
			selection: clone$2(selection),
			selections: clone$2(selections),
			selectionSummary: selection?.summary || null,
			selectedCount: state?.data?.selectedCount ?? 0,
			visibleCount: state?.data?.visibleCount ?? 0,
			highlightedKeys: Array.isArray(state?.feedback?.highlightedKeys) ? [...state.feedback.highlightedKeys] : []
		} };
		const xAxisPatch = buildAxisPatch(xDomain, currentOption?.xAxis);
		if (xAxisPatch) option.xAxis = xAxisPatch;
		const yAxisPatch = buildAxisPatch(yDomain, currentOption?.yAxis);
		if (yAxisPatch) option.yAxis = yAxisPatch;
		const dataZoomPatches = buildDataZoomPatches(currentOption?.dataZoom, {
			xDomain,
			yDomain
		});
		if (dataZoomPatches.length > 0) option.dataZoom = dataZoomPatches;
		return option;
	}
	function bindEChartsFamilyInteractions({ view, spec, interactionConfig, actionTargetRef, onActionCall }) {
		if (!view || typeof view.on !== "function" || !interactionConfig || interactionConfig.mode === "none" || typeof onActionCall !== "function") return () => {};
		if (interactionConfig.mode === "brush2d") {
			const handler = (event) => {
				const selection = event?.widgetvaSelection || event?.selection || event?.batch?.[0]?.widgetvaSelection || null;
				const [xField, yField] = Array.isArray(selection?.fields) ? selection.fields : [];
				const xRange = xField ? selection?.value?.[xField] || selection?.xRange : null;
				const yRange = yField ? selection?.value?.[yField] || selection?.yRange : null;
				if (!xField || !yField || !Array.isArray(xRange) || !Array.isArray(yRange)) return;
				onActionCall(buildHumanActionCall({
					name: interactionConfig.actionName || "scatter.brushRegion",
					actionTargetRef,
					params: {
						xField,
						yField,
						xRange,
						yRange
					}
				}));
			};
			view.on("brushselected", handler);
			return () => view.off?.("brushselected", handler);
		}
		if (interactionConfig.mode === "categoryClick") {
			const handler = (event) => {
				const field = resolveCategoryField({
					spec,
					interactionConfig,
					selection: event?.widgetvaSelection || event
				});
				const rawValue = event?.widgetvaSelection?.values?.[0] ?? event?.widgetvaSelection?.value ?? event?.data?.[field] ?? event?.name;
				if (!field || rawValue == null) return;
				onActionCall(buildHumanActionCall({
					name: interactionConfig.actionName || "widget.selectCategory",
					actionTargetRef,
					params: {
						field,
						values: [rawValue]
					}
				}));
			};
			view.on("click", handler);
			return () => view.off?.("click", handler);
		}
		if (interactionConfig.mode === "cellClick") {
			const handler = (event) => {
				const selection = event?.widgetvaSelection || event;
				const { xField, yField } = resolveCellFields({
					spec,
					interactionConfig,
					selection
				});
				const xValue = selection?.xValue ?? event?.data?.[xField];
				const yValue = selection?.yValue ?? event?.data?.[yField];
				if (!xField || !yField || xValue == null || yValue == null) return;
				onActionCall(buildHumanActionCall({
					name: interactionConfig.actionName || "heatmap.filterCells",
					actionTargetRef,
					params: {
						xField,
						yField,
						xValue,
						yValue
					}
				}));
			};
			view.on("click", handler);
			return () => view.off?.("click", handler);
		}
		if (interactionConfig.mode === "multiBrush") {
			const handler = (event) => {
				const rules = clone$2(event?.widgetvaSelection?.rules || event?.rules || event?.selection?.rules || []);
				if (!Array.isArray(rules) || rules.length === 0) return;
				onActionCall(buildHumanActionCall({
					name: interactionConfig.actionName || "parallelCoordinates.brushAxes",
					actionTargetRef,
					params: { rules }
				}));
			};
			view.on("axisareaselected", handler);
			return () => view.off?.("axisareaselected", handler);
		}
		if (interactionConfig.mode === "rowClick") {
			const handler = (event) => {
				const eventData = event?.data && typeof event.data === "object" ? event.data : null;
				const selection = event?.widgetvaSelection || event;
				const keyField = resolveTableKeyField({
					interactionConfig,
					selection,
					eventData
				});
				const rawKey = selection?.keys?.[0] ?? selection?.key ?? (keyField ? eventData?.[keyField] : null);
				if (!keyField || rawKey == null) return;
				onActionCall(buildHumanActionCall({
					name: interactionConfig.actionName || "table.focusRows",
					actionTargetRef,
					params: {
						keyField,
						keys: [rawKey]
					}
				}));
			};
			view.on("click", handler);
			return () => view.off?.("click", handler);
		}
		return () => {};
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/D3WidgetAdapter.js
	function clone$1(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function readCachedState$1(view) {
		return view?.__widgetvaLastAppliedState && typeof view.__widgetvaLastAppliedState === "object" ? view.__widgetvaLastAppliedState : null;
	}
	function resolveCachedSelection(view) {
		const selections = Object.values(readCachedState$1(view)?.selections || {}).filter(Boolean);
		if (selections.length === 1) return clone$1(selections[0]);
		return clone$1(selections.find((selection) => selection?.kind === "interval") || selections[0] || null);
	}
	function normalizeViewportCandidate(value) {
		if (!value || typeof value !== "object" || Array.isArray(value)) return null;
		const viewport = {
			...Array.isArray(value.xDomain) ? { xDomain: clone$1(value.xDomain) } : {},
			...Array.isArray(value.yDomain) ? { yDomain: clone$1(value.yDomain) } : {},
			...value.zoom && typeof value.zoom === "object" ? { zoom: clone$1(value.zoom) } : {}
		};
		return Object.keys(viewport).length > 0 ? viewport : null;
	}
	function createD3WidgetAdapter(definition = {}) {
		return createWidgetAdapterDefinition({
			provider: "d3",
			providerCapabilities: {
				supportedWidgetKinds: definition.kind ? [definition.kind] : [],
				renderStrategy: "providerView",
				stateApplyStrategy: "imperativeRender",
				interactionBindingStrategy: "providerEvents",
				supportsRendererMount: true,
				supportsRendererUpdate: true,
				supportsRendererDispose: true,
				supportsSignalPatching: false,
				supportsOptionMerging: false,
				supportsImperativeRender: true,
				supportsPointSelection: true,
				supportsIntervalSelection: true,
				supportsZoomPan: true,
				supportsSelectionReadback: true,
				supportsViewportReadback: true,
				supportsHighlightProjection: true,
				supportsInteractionEvents: true
			},
			mount({ view = null, surface = null } = {}) {
				return {
					view,
					surface
				};
			},
			update({ view = null, surface = null } = {}) {
				return {
					view,
					surface
				};
			},
			dispose() {},
			bindHumanInteractions() {
				return () => {};
			},
			async applyState(args) {
				const { view, state, surface } = args || {};
				if (view && state && typeof state === "object" && !Array.isArray(state)) view.__widgetvaLastAppliedState = clone$1(state);
				applyD3HostState({
					view,
					surface,
					state
				});
				return definition.renderFromState?.(args);
			},
			readSelection({ view } = {}) {
				if (typeof view?.getSelection === "function") return clone$1(view.getSelection() || null);
				if (typeof view?.getBrush === "function") return clone$1(view.getBrush() || null);
				return resolveCachedSelection(view);
			},
			readViewport({ view } = {}) {
				if (typeof view?.getViewport === "function") return clone$1(view.getViewport() || null);
				if (typeof view?.getDomain === "function") return normalizeViewportCandidate(view.getDomain());
				return normalizeViewportCandidate(readCachedState$1(view)?.view);
			},
			...definition
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/CustomWidgetAdapter.js
	function createCustomWidgetAdapter(definition = {}) {
		return createWidgetAdapterDefinition({
			provider: "custom",
			providerCapabilities: {
				supportedWidgetKinds: definition.kind ? [definition.kind] : [],
				renderStrategy: "custom",
				stateApplyStrategy: "custom",
				interactionBindingStrategy: "custom",
				supportsRendererMount: true,
				supportsRendererUpdate: true,
				supportsRendererDispose: true,
				supportsSignalPatching: false,
				supportsOptionMerging: false,
				supportsImperativeRender: false
			},
			...definition
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgetFamilies/defaultWidgetAdapter.js
	var defaultWidgetAdapter = createCustomWidgetAdapter({ kind: "custom" });
	//#endregion
	//#region ../../widgetva-kit/src/adapters/EChartsWidgetAdapter.js
	function clone(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function readCachedState(view) {
		return view?.__widgetvaLastAppliedState && typeof view.__widgetvaLastAppliedState === "object" ? view.__widgetvaLastAppliedState : null;
	}
	function readCurrentOption(view) {
		if (typeof view?.getOption !== "function") return null;
		try {
			return view.getOption() || null;
		} catch {
			return null;
		}
	}
	function resolveRepresentativeSelection(selections = []) {
		const normalizedSelections = Array.isArray(selections) ? selections.filter(Boolean) : [];
		if (normalizedSelections.length === 1) return normalizedSelections[0] || null;
		const pointSelections = normalizedSelections.filter((selection) => selection?.kind === "point");
		if (pointSelections.length === 1) return pointSelections[0] || null;
		return normalizedSelections[0] || null;
	}
	function normalizeSelections(state) {
		return Object.values(state?.selections || {}).filter(Boolean);
	}
	function resolvePrimaryIntervalSelection(selections = []) {
		return (Array.isArray(selections) ? selections : []).find((selection) => selection?.kind === "interval") || null;
	}
	function resolveViewportFromState(state, intervalSelection) {
		const xDomain = state?.view?.xDomain || intervalSelection?.domain?.xDomain || null;
		const yDomain = state?.view?.yDomain || intervalSelection?.domain?.yDomain || null;
		const zoom = state?.view?.zoom && typeof state.view.zoom === "object" ? clone(state.view.zoom) : null;
		return normalizeViewport({
			...Array.isArray(xDomain) ? { xDomain } : {},
			...Array.isArray(yDomain) ? { yDomain } : {},
			...zoom ? { zoom } : {}
		});
	}
	function selectionValues(selection) {
		return (Array.isArray(selection?.values) ? selection.values : [selection?.value]).filter((value) => typeof value === "string" || typeof value === "number");
	}
	function readSeriesNames(option) {
		const seriesNames = Array.isArray(option?.series) ? option.series.map((series) => series?.name).filter((name) => typeof name === "string" && name.length > 0) : [];
		const legendNames = (Array.isArray(option?.legend) ? option.legend : option?.legend ? [option.legend] : []).flatMap((legend) => {
			return (Array.isArray(legend?.data) ? legend.data : []).map((entry) => typeof entry === "string" ? entry : entry?.name).filter((name) => typeof name === "string" && name.length > 0);
		});
		return [...new Set([...seriesNames, ...legendNames])];
	}
	function buildDataZoomActions(option, viewport) {
		const zoomItems = Array.isArray(option?.dataZoom) ? option.dataZoom : option?.dataZoom ? [option.dataZoom] : [];
		const actions = [];
		for (const [index, zoomItem] of zoomItems.entries()) {
			if (Array.isArray(viewport?.xDomain) && zoomItem?.xAxisIndex != null) actions.push({
				type: "dataZoom",
				dataZoomIndex: index,
				xAxisIndex: zoomItem.xAxisIndex,
				startValue: viewport.xDomain[0],
				endValue: viewport.xDomain[1]
			});
			if (Array.isArray(viewport?.yDomain) && zoomItem?.yAxisIndex != null) actions.push({
				type: "dataZoom",
				dataZoomIndex: index,
				yAxisIndex: zoomItem.yAxisIndex,
				startValue: viewport.yDomain[0],
				endValue: viewport.yDomain[1]
			});
		}
		return actions;
	}
	function resolveSeriesNamesFromSelection(selection, option) {
		if (!selection || selection.kind !== "point") return [];
		const knownSeriesNames = readSeriesNames(option);
		if (knownSeriesNames.length === 0) return [];
		const values = selectionValues(selection);
		if (values.length === 0) return [];
		const matchingValues = values.filter((value) => knownSeriesNames.includes(String(value)));
		if (matchingValues.length !== values.length) return [];
		const field = typeof selection?.field === "string" ? selection.field.toLowerCase() : "";
		if (field.includes("series") || field.length === 0) return matchingValues.map((value) => String(value));
		return matchingValues.length > 0 ? matchingValues.map((value) => String(value)) : [];
	}
	function resolveSeriesNamesFromHighlights(highlightedKeys, option) {
		const knownSeriesNames = readSeriesNames(option);
		if (knownSeriesNames.length === 0) return [];
		return [...new Set((Array.isArray(highlightedKeys) ? highlightedKeys : []).filter((key) => typeof key === "string" && knownSeriesNames.includes(key)))];
	}
	function readDataItemRefs(option) {
		const seriesList = Array.isArray(option?.series) ? option.series : [];
		const itemRefs = [];
		for (const [seriesIndex, series] of seriesList.entries()) {
			const dataItems = Array.isArray(series?.data) ? series.data : [];
			for (const [dataIndex, datum] of dataItems.entries()) {
				const name = typeof datum === "string" || typeof datum === "number" ? String(datum) : typeof datum?.name === "string" && datum.name.length > 0 ? datum.name : typeof datum?.id === "string" && datum.id.length > 0 ? datum.id : null;
				itemRefs.push({
					seriesIndex,
					dataIndex,
					name,
					datum: datum && typeof datum === "object" && !Array.isArray(datum) ? datum : null
				});
			}
		}
		return itemRefs;
	}
	function normalizeComparableValue(value) {
		return typeof value === "string" || typeof value === "number" ? String(value) : null;
	}
	function resolveDataItemRefsFromValues(values, option) {
		const normalizedValues = [...new Set((Array.isArray(values) ? values : []).map((value) => normalizeComparableValue(value)).filter(Boolean))];
		if (normalizedValues.length === 0) return [];
		const valueSet = new Set(normalizedValues);
		return readDataItemRefs(option).filter((itemRef) => valueSet.has(itemRef.name));
	}
	function normalizeFieldName(value) {
		return typeof value === "string" && value.length > 0 ? value.toLowerCase() : null;
	}
	function resolveDatumFieldValue(datum, field) {
		if (!datum || typeof datum !== "object" || Array.isArray(datum)) return null;
		const directValue = normalizeComparableValue(datum[field]);
		if (directValue != null) return directValue;
		const normalizedField = normalizeFieldName(field);
		if (!normalizedField) return null;
		const matchedEntry = Object.entries(datum).find(([candidateField]) => normalizeFieldName(candidateField) === normalizedField);
		return matchedEntry ? normalizeComparableValue(matchedEntry[1]) : null;
	}
	function resolveDataItemRefsFromSelection(selection, option) {
		const values = selectionValues(selection);
		if (values.length === 0) return [];
		const field = typeof selection?.field === "string" && selection.field.length > 0 ? selection.field : null;
		if (!field) return resolveDataItemRefsFromValues(values, option);
		const valueSet = new Set(values.map((value) => String(value)));
		const matchedRefs = readDataItemRefs(option).filter((itemRef) => {
			const datumValue = resolveDatumFieldValue(itemRef.datum, field);
			return datumValue != null && valueSet.has(datumValue);
		});
		if (matchedRefs.length > 0) return matchedRefs;
		return resolveDataItemRefsFromValues(values, option);
	}
	function parseHighlightKey(key) {
		if (typeof key !== "string" || key.length === 0) return null;
		const separatorIndex = key.indexOf(":");
		if (separatorIndex <= 0 || separatorIndex === key.length - 1) return null;
		return {
			field: key.slice(0, separatorIndex),
			value: key.slice(separatorIndex + 1)
		};
	}
	function resolveDataItemRefsFromHighlightKeys(highlightedKeys, option) {
		const itemRefs = readDataItemRefs(option);
		const directValueMatches = resolveDataItemRefsFromValues(highlightedKeys, option);
		const parsedPairs = (Array.isArray(highlightedKeys) ? highlightedKeys : []).map((key) => parseHighlightKey(key)).filter(Boolean);
		if (parsedPairs.length === 0) return directValueMatches;
		return mergeDataItemRefs(directValueMatches, itemRefs.filter((itemRef) => parsedPairs.some(({ field, value }) => resolveDatumFieldValue(itemRef.datum, field) === String(value))));
	}
	function mergeDataItemRefs(...groups) {
		const merged = /* @__PURE__ */ new Map();
		for (const group of groups) for (const itemRef of Array.isArray(group) ? group : []) {
			const key = `${itemRef.seriesIndex}:${itemRef.dataIndex}`;
			if (!merged.has(key)) merged.set(key, itemRef);
		}
		return [...merged.values()];
	}
	function dispatchEChartsNativeActions({ view, option, selection, highlightedKeys, viewport }) {
		if (typeof view?.dispatchAction !== "function") return;
		const selectedSeriesNames = resolveSeriesNamesFromSelection(selection, option);
		if (selectedSeriesNames.length > 0 && readSeriesNames(option).length > 0 && option?.legend) {
			const selectedSet = new Set(selectedSeriesNames);
			for (const name of readSeriesNames(option)) view.dispatchAction({
				type: selectedSet.has(name) ? "legendSelect" : "legendUnSelect",
				name
			});
		}
		const highlightedSeriesNames = resolveSeriesNamesFromHighlights(highlightedKeys, option);
		if (highlightedSeriesNames.length > 0) {
			for (const name of readSeriesNames(option)) view.dispatchAction({
				type: "downplay",
				seriesName: name
			});
			for (const name of highlightedSeriesNames) view.dispatchAction({
				type: "highlight",
				seriesName: name
			});
		}
		const activeItemRefs = mergeDataItemRefs(selectedSeriesNames.length === 0 ? resolveDataItemRefsFromSelection(selection, option) : [], resolveDataItemRefsFromHighlightKeys(highlightedKeys, option));
		if (activeItemRefs.length > 0) {
			for (const itemRef of readDataItemRefs(option)) view.dispatchAction({
				type: "downplay",
				seriesIndex: itemRef.seriesIndex,
				dataIndex: itemRef.dataIndex
			});
			for (const itemRef of activeItemRefs) view.dispatchAction({
				type: "highlight",
				seriesIndex: itemRef.seriesIndex,
				dataIndex: itemRef.dataIndex
			});
		}
		for (const action of buildDataZoomActions(option, viewport)) view.dispatchAction(action);
	}
	function readSelectionFromOption(option) {
		if (!option?.widgetva || typeof option.widgetva !== "object") return null;
		if (option.widgetva.selection && typeof option.widgetva.selection === "object") return clone(option.widgetva.selection);
		return clone(resolveRepresentativeSelection(Object.values(option.widgetva.selections || {}).filter(Boolean)));
	}
	function readSelectionFromCachedState(view) {
		return clone(resolveRepresentativeSelection(Object.values(readCachedState(view)?.selections || {}).filter(Boolean)));
	}
	function readAxisDomain(axis) {
		const axisObject = Array.isArray(axis) ? axis[0] : axis;
		if (!axisObject || typeof axisObject !== "object") return null;
		if (!Number.isFinite(axisObject.min) || !Number.isFinite(axisObject.max)) return null;
		return [axisObject.min, axisObject.max];
	}
	function readZoomDomain(dataZoom, axisKey) {
		const zoomItems = Array.isArray(dataZoom) ? dataZoom : dataZoom ? [dataZoom] : [];
		const axisIndexKey = axisKey === "x" ? "xAxisIndex" : "yAxisIndex";
		const candidate = zoomItems.find((zoomItem) => zoomItem?.[axisIndexKey] != null && Number.isFinite(zoomItem.startValue) && Number.isFinite(zoomItem.endValue)) || null;
		if (!candidate) return null;
		return [candidate.startValue, candidate.endValue];
	}
	function normalizeViewport(viewport) {
		if (!viewport || typeof viewport !== "object" || Array.isArray(viewport)) return null;
		const normalized = {
			...Array.isArray(viewport.xDomain) ? { xDomain: clone(viewport.xDomain) } : {},
			...Array.isArray(viewport.yDomain) ? { yDomain: clone(viewport.yDomain) } : {},
			...viewport.zoom && typeof viewport.zoom === "object" ? { zoom: clone(viewport.zoom) } : {}
		};
		return Object.keys(normalized).length > 0 ? normalized : null;
	}
	function createEChartsWidgetAdapter(definition = {}) {
		return createWidgetAdapterDefinition({
			provider: "echarts",
			providerCapabilities: {
				supportedWidgetKinds: definition.kind ? [definition.kind] : [],
				renderStrategy: "providerView",
				stateApplyStrategy: "optionMerge",
				interactionBindingStrategy: "providerEvents",
				supportsRendererMount: true,
				supportsRendererUpdate: true,
				supportsRendererDispose: true,
				supportsSignalPatching: false,
				supportsOptionMerging: true,
				supportsImperativeRender: false,
				supportsPointSelection: true,
				supportsIntervalSelection: true,
				supportsZoomPan: true,
				supportsSelectionReadback: true,
				supportsViewportReadback: true,
				supportsHighlightProjection: true,
				supportsInteractionEvents: true
			},
			mount({ view = null, surface = null } = {}) {
				return {
					view,
					surface
				};
			},
			update({ view = null, surface = null } = {}) {
				return {
					view,
					surface
				};
			},
			dispose({ view = null } = {}) {
				return view?.dispose?.();
			},
			bindHumanInteractions() {
				return () => {};
			},
			async applyState(args) {
				const { view, state } = args || {};
				if (!view) return;
				if (state && typeof state === "object" && !Array.isArray(state)) view.__widgetvaLastAppliedState = clone(state);
				const selections = normalizeSelections(state);
				const selection = resolveRepresentativeSelection(selections);
				const intervalSelection = resolvePrimaryIntervalSelection(selections);
				const aggregateState = resolveAggregateStatePayload(state);
				const addRemoveState = resolveAddRemoveStatePayload(state);
				const annotateState = resolveAnnotateStatePayload(state);
				const drillDownState = resolveDrillDownStatePayload(state);
				const highlightState = resolveHighlightStatePayload(state);
				const focusPayload = resolveFocusPayload(state);
				const navigateState = resolveNavigateStatePayload(state);
				const reencodeState = resolveReencodeStatePayload(state);
				const sortPayload = resolveSortPayload(state);
				const highlightedKeys = Array.isArray(state?.feedback?.highlightedKeys) ? [...state.feedback.highlightedKeys] : [];
				const viewport = resolveViewportFromState(state, intervalSelection);
				if (typeof view.setBrush === "function") view.setBrush(intervalSelection || null);
				if (typeof view.setSelection === "function") view.setSelection(selection || null);
				if (typeof view.setHighlights === "function") view.setHighlights(highlightedKeys);
				if (highlightState && typeof view.setHighlightState === "function") view.setHighlightState(highlightState);
				if (aggregateState && typeof view.setAggregateState === "function") view.setAggregateState(aggregateState);
				if (addRemoveState && typeof view.setAddRemoveState === "function") view.setAddRemoveState(addRemoveState);
				if (annotateState && typeof view.setAnnotateState === "function") view.setAnnotateState(annotateState);
				if (drillDownState && typeof view.setDrillDownState === "function") view.setDrillDownState(drillDownState);
				if (focusPayload && typeof view.setFocus === "function") view.setFocus(focusPayload);
				if (navigateState && typeof view.setNavigateState === "function") view.setNavigateState(navigateState);
				if (reencodeState && typeof view.setReencodeState === "function") view.setReencodeState(reencodeState);
				if (sortPayload && typeof view.setSort === "function") view.setSort(sortPayload);
				if (viewport && typeof view.setViewport === "function") view.setViewport(viewport);
				else if (viewport && typeof view.setDomain === "function") view.setDomain(Array.isArray(viewport.xDomain) ? viewport.xDomain : null, Array.isArray(viewport.yDomain) ? viewport.yDomain : null);
				if (typeof view.setOption !== "function") return;
				const nextOption = definition.buildOptionFromState?.(args) || null;
				if (nextOption) view.setOption(nextOption, {
					notMerge: false,
					lazyUpdate: true
				});
				dispatchEChartsNativeActions({
					view,
					option: readCurrentOption(view),
					selection,
					highlightedKeys,
					viewport
				});
			},
			readSelection({ view } = {}) {
				if (typeof view?.getSelection === "function") return clone(view.getSelection() || null);
				return readSelectionFromOption(readCurrentOption(view)) || readSelectionFromCachedState(view);
			},
			readViewport({ view } = {}) {
				if (typeof view?.getViewport === "function") return clone(view.getViewport() || null);
				const option = readCurrentOption(view);
				const xDomain = readZoomDomain(option?.dataZoom, "x") || readAxisDomain(option?.xAxis);
				const yDomain = readZoomDomain(option?.dataZoom, "y") || readAxisDomain(option?.yAxis);
				if (Array.isArray(xDomain) || Array.isArray(yDomain)) return {
					...Array.isArray(xDomain) ? { xDomain } : {},
					...Array.isArray(yDomain) ? { yDomain } : {}
				};
				return normalizeViewport(readCachedState(view)?.view);
			},
			...definition
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/widgets/heatmap/actions.js
	var MONTH_MAP = {
		Jan: 0,
		Feb: 1,
		Mar: 2,
		Apr: 3,
		May: 4,
		Jun: 5,
		Jul: 6,
		Aug: 7,
		Sep: 8,
		Oct: 9,
		Nov: 10,
		Dec: 11,
		January: 0,
		February: 1,
		March: 2,
		April: 3,
		June: 5,
		July: 6,
		August: 7,
		September: 8,
		October: 9,
		November: 10,
		December: 11
	};
	function datumRef(field) {
		return `datum['${String(field).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}']`;
	}
	function cloneValue$17(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function replaceTaggedTransform$1(transforms, tag, nextTransform) {
		const nextTransforms = (Array.isArray(transforms) ? transforms : []).filter((transform) => transform?._widgetvaTag !== tag);
		return nextTransform ? [...nextTransforms, nextTransform] : nextTransforms;
	}
	function normalizeTimeUnitValues(field, values, timeUnit) {
		const safeValues = Array.isArray(values) ? values.filter((value) => value != null) : [];
		if (!timeUnit) return {
			valueListExpr: safeValues.map((value) => JSON.stringify(value)).join(","),
			datumExpr: datumRef(field)
		};
		const normalizedTimeUnit = String(timeUnit).toLowerCase().trim();
		if (normalizedTimeUnit === "date") {
			const numericValues = safeValues.map((value) => Number.parseInt(value, 10)).filter((value) => Number.isFinite(value));
			return {
				valueListExpr: (numericValues.length > 0 ? numericValues : safeValues).map((value) => JSON.stringify(value)).join(","),
				datumExpr: `date(${datumRef(field)})`
			};
		}
		if (normalizedTimeUnit === "month") {
			const monthValues = safeValues.map((value) => {
				if (typeof value === "string" && Object.prototype.hasOwnProperty.call(MONTH_MAP, value)) return MONTH_MAP[value];
				const parsed = Number.parseInt(value, 10);
				return Number.isFinite(parsed) ? parsed - 1 : null;
			}).filter((value) => Number.isFinite(value));
			return {
				valueListExpr: (monthValues.length > 0 ? monthValues : safeValues).map((value) => JSON.stringify(value)).join(","),
				datumExpr: `month(${datumRef(field)})`
			};
		}
		if (normalizedTimeUnit === "year") {
			const numericValues = safeValues.map((value) => Number.parseInt(value, 10)).filter((value) => Number.isFinite(value));
			return {
				valueListExpr: (numericValues.length > 0 ? numericValues : safeValues).map((value) => JSON.stringify(value)).join(","),
				datumExpr: `year(${datumRef(field)})`
			};
		}
		return {
			valueListExpr: safeValues.map((value) => JSON.stringify(value)).join(","),
			datumExpr: `${normalizedTimeUnit}(${datumRef(field)})`
		};
	}
	function buildHeatmapActionDescriptors({ widgetRef, selectionRef, scope = "local", affectedRefs = [widgetRef] }) {
		const supportedWidgetKinds = ["heatmap"];
		const filterCellDescriptor = makeActionDescriptor({
			name: "heatmap.filterCells",
			title: "Filter heatmap cells",
			description: "Filter the workspace through a heatmap cell identified by its x/y category pair.",
			primitive: "filter",
			category: "dataTransform",
			scope,
			supportedWidgetKinds,
			targetRef: selectionRef || widgetRef,
			affectedRefs,
			affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "selections" : "transforms"),
			paramsSchema: {
				type: "object",
				properties: {
					xField: { type: "string" },
					yField: { type: "string" },
					xValue: { type: "string" },
					yValue: { type: "string" }
				},
				required: [
					"xField",
					"yField",
					"xValue",
					"yValue"
				]
			},
			postconditions: [{ description: "The active selection should contain the selected x/y cell pair and linked widgets should be filterable from it." }],
			preconditions: [{
				description: "The requested targetRef resolves to a valid heatmap widget in the current workspace.",
				failureMessage: "heatmap.filterCells requires a valid heatmap target widget."
			}],
			effects: [makeSelectionEffect(selectionRef || widgetRef, "Creates or updates a cell selection on the heatmap."), ...affectedRefs.filter((ref) => ref !== widgetRef).map((ref) => makeFilterEffect(ref, "Linked widgets may be filtered by the selected heatmap cell."))],
			examples: [{
				userGoal: "Select one heatmap cell and inspect linked detail views.",
				params: {
					xField: "Origin",
					yField: "Cylinders",
					xValue: "Japan",
					yValue: "4"
				}
			}],
			reversible: true
		});
		return [
			filterCellDescriptor,
			makeActionDescriptor({
				...cloneValue$17(filterCellDescriptor),
				name: "heatmap.selectCell",
				title: "Select heatmap cell",
				description: "Select a single heatmap cell through the canonical heatmap cell contract.",
				primitive: "select",
				category: "selection"
			}),
			makeActionDescriptor({
				name: "heatmap.selectSubmatrix",
				title: "Select heatmap submatrix",
				description: "Select a heatmap submatrix defined by one or more x-axis and/or y-axis coordinates without mutating the view spec.",
				primitive: "select",
				category: "selection",
				scope,
				supportedWidgetKinds,
				targetRef: selectionRef || widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "selections" : "transforms"),
				paramsSchema: {
					type: "object",
					properties: {
						xValues: {
							type: "array",
							items: { anyOf: [{ type: "string" }, { type: "number" }] }
						},
						yValues: {
							type: "array",
							items: { anyOf: [{ type: "string" }, { type: "number" }] }
						}
					}
				},
				postconditions: [{ description: "The active selection should contain the selected heatmap rows, columns, or their intersection region." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid heatmap widget in the current workspace.",
					failureMessage: "heatmap.selectSubmatrix requires a valid heatmap target widget."
				}],
				effects: [makeSelectionEffect(selectionRef || widgetRef, "Creates or updates a heatmap region selection over rows, columns, or an intersection."), ...affectedRefs.filter((ref) => ref !== widgetRef).map((ref) => makeFilterEffect(ref, "Linked widgets may be filtered by the selected heatmap submatrix."))],
				examples: [{
					userGoal: "Select a rectangular region of the heatmap before inspecting linked views.",
					params: {
						xValues: ["Q1", "Q2"],
						yValues: ["A", "B"]
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "heatmap.drilldownAxis",
				title: "Drill down heatmap time axis",
				description: "Drill a temporal heatmap x-axis from year to month or from month to date by narrowing the visible period and refining the x-axis timeUnit.",
				primitive: "drillDown",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "transforms" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						level: { type: "string" },
						value: { anyOf: [{ type: "number" }, { type: "string" }] },
						parent: { type: "object" }
					},
					required: ["level", "value"]
				},
				postconditions: [{ description: "The heatmap x-axis should move to a finer temporal granularity while the transform list narrows the visible period." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid heatmap widget in the current workspace.",
					failureMessage: "heatmap.drilldownAxis requires a valid heatmap target widget."
				}],
				examples: [{
					userGoal: "Drill a yearly heatmap into monthly detail for one year.",
					params: {
						level: "year",
						value: 2024
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "heatmap.resetDrilldown",
				title: "Reset heatmap drill-down",
				description: "Restore the original temporal x-axis encoding and remove drill-down filters from the heatmap.",
				primitive: "navigate",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "transforms" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {}
				},
				postconditions: [{ description: "The heatmap should revert to its original temporal x-axis encoding and remove tagged drill-down filters." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid heatmap widget in the current workspace.",
					failureMessage: "heatmap.resetDrilldown requires a valid heatmap target widget."
				}],
				examples: [{
					userGoal: "Return a drilled heatmap back to its original yearly overview.",
					params: {}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "heatmap.addMarginalBars",
				title: "Add heatmap marginal bars",
				description: "Compose a heatmap with optional top and right marginal bar charts that aggregate the heatmap value field along each axis.",
				primitive: "annotate",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						op: { type: "string" },
						showTop: { type: "boolean" },
						showRight: { type: "boolean" },
						barSize: { type: "number" },
						barColor: { type: "string" }
					}
				},
				postconditions: [{ description: "The heatmap should be composed with marginal bars that aggregate the color/value field along rows and/or columns." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid heatmap widget in the current workspace.",
					failureMessage: "heatmap.addMarginalBars requires a valid heatmap target widget."
				}],
				examples: [{
					userGoal: "Add row and column marginal summaries before comparing the overall heatmap structure.",
					params: {
						op: "mean",
						showTop: true,
						showRight: true,
						barSize: 70,
						barColor: "#666666"
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "heatmap.highlightRegion",
				title: "Highlight heatmap region",
				description: "Highlight one or more heatmap rows, columns, or their intersection without filtering away the rest of the matrix.",
				primitive: "highlight",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "transforms"),
				paramsSchema: {
					type: "object",
					properties: {
						xValues: {
							type: "array",
							items: { anyOf: [{ type: "string" }, { type: "number" }] }
						},
						yValues: {
							type: "array",
							items: { anyOf: [{ type: "string" }, { type: "number" }] }
						}
					}
				},
				postconditions: [{ description: "The heatmap should visually emphasize the requested rows, columns, or region while dimming the rest." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid heatmap widget in the current workspace.",
					failureMessage: "heatmap.highlightRegion requires a valid heatmap target widget."
				}],
				examples: [{
					userGoal: "Highlight one row/column region before comparing extreme cells.",
					params: {
						xValues: ["Q1"],
						yValues: ["A"]
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "heatmap.adjustColorScale",
				title: "Adjust heatmap color scale",
				description: "Update the heatmap color scheme and optional numeric domain without changing the underlying data.",
				primitive: "reencode",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "transforms"),
				paramsSchema: {
					type: "object",
					properties: {
						scheme: { type: "string" },
						domain: {
							type: "array",
							minItems: 2,
							maxItems: 2,
							items: { anyOf: [{ type: "number" }, { type: "string" }] }
						}
					}
				},
				postconditions: [{ description: "The heatmap color encoding should reflect the requested scheme and optional domain." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid heatmap widget in the current workspace.",
					failureMessage: "heatmap.adjustColorScale requires a valid heatmap target widget."
				}],
				examples: [{
					userGoal: "Switch to a new color scheme and tighten the value range for comparison.",
					params: {
						scheme: "blues",
						domain: [0, 25]
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "heatmap.thresholdMask",
				title: "Mask heatmap values outside a threshold range",
				description: "Visually dim heatmap cells whose color values fall outside the requested inclusive threshold range.",
				primitive: "highlight",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "transforms"),
				paramsSchema: {
					type: "object",
					properties: {
						minValue: { anyOf: [{ type: "number" }, { type: "string" }] },
						maxValue: { anyOf: [{ type: "number" }, { type: "string" }] },
						outsideOpacity: { type: "number" }
					},
					required: ["minValue", "maxValue"]
				},
				postconditions: [{ description: "The heatmap opacity encoding should preserve cells inside the threshold range and dim cells outside it." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid heatmap widget in the current workspace.",
					failureMessage: "heatmap.thresholdMask requires a valid heatmap target widget."
				}],
				examples: [{
					userGoal: "Dim low-signal cells while keeping the full matrix visible.",
					params: {
						minValue: 10,
						maxValue: 25,
						outsideOpacity: .1
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "heatmap.filterCellsByRegion",
				title: "Filter heatmap cells by region",
				description: "Exclude one or more heatmap rows, columns, or their intersection by writing a region filter into the heatmap spec.",
				primitive: "filter",
				category: "dataTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "transforms" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						xValue: { anyOf: [{ type: "string" }, { type: "number" }] },
						yValue: { anyOf: [{ type: "string" }, { type: "number" }] },
						xValues: {
							type: "array",
							items: { anyOf: [{ type: "string" }, { type: "number" }] }
						},
						yValues: {
							type: "array",
							items: { anyOf: [{ type: "string" }, { type: "number" }] }
						}
					}
				},
				postconditions: [{ description: "The heatmap transform list should exclude the requested rows, columns, or intersection region." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid heatmap widget in the current workspace.",
					failureMessage: "heatmap.filterCellsByRegion requires a valid heatmap target widget."
				}],
				effects: affectedRefs.map((ref) => makeFilterEffect(ref, ref === widgetRef ? "The heatmap excludes the requested rows, columns, or intersection region." : "Linked widgets may update to reflect the excluded heatmap region.")),
				examples: [{
					userGoal: "Remove one heatmap row-column intersection before inspecting the remaining structure.",
					params: {
						xValues: ["Q1"],
						yValues: ["A"]
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "heatmap.highlightRegionByValue",
				title: "Highlight heatmap cells by value range",
				description: "Visually emphasize cells whose displayed values fall inside a requested range, while dimming the rest without filtering data away.",
				primitive: "highlight",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "transforms"),
				paramsSchema: {
					type: "object",
					properties: {
						minValue: { anyOf: [{ type: "number" }, { type: "string" }] },
						maxValue: { anyOf: [{ type: "number" }, { type: "string" }] },
						outsideOpacity: { type: "number" }
					}
				},
				postconditions: [{ description: "The heatmap opacity encoding should emphasize values inside the requested range and dim values outside it." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid heatmap widget in the current workspace.",
					failureMessage: "heatmap.highlightRegionByValue requires a valid heatmap target widget."
				}],
				examples: [{
					userGoal: "Highlight only mid-range or high-value cells before comparing hotspots.",
					params: {
						minValue: 10,
						maxValue: 25,
						outsideOpacity: .12
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "heatmap.clusterRowsCols",
				title: "Reorder heatmap rows or columns by aggregated value",
				description: "Reorder heatmap rows and/or columns by aggregated cell values so high-value bands are grouped toward the front.",
				primitive: "aggregate",
				category: "compute",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						clusterRows: { type: "boolean" },
						clusterCols: { type: "boolean" },
						method: { type: "string" }
					}
				},
				postconditions: [{ description: "The heatmap x/y encodings should carry explicit aggregate sort metadata for the requested rows and/or columns." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid heatmap widget with a color field on the current spec.",
					failureMessage: "heatmap.clusterRowsCols requires a valid heatmap target widget with a color encoding field."
				}],
				examples: [{
					userGoal: "Bring the hottest rows and columns toward the front of the matrix.",
					params: {
						clusterRows: true,
						clusterCols: true,
						method: "sum"
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "heatmap.transpose",
				title: "Transpose heatmap axes",
				description: "Swap the heatmap x and y encodings to quickly inspect the matrix from the opposite orientation.",
				primitive: "reencode",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {}
				},
				postconditions: [{ description: "The heatmap x and y encodings should be swapped, and width/height should swap when both are defined." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid heatmap widget in the current workspace.",
					failureMessage: "heatmap.transpose requires a valid heatmap target widget."
				}],
				examples: [{
					userGoal: "Flip rows and columns to compare the matrix from the opposite orientation.",
					params: {}
				}],
				reversible: true
			})
		];
	}
	function registerHeatmapActions(actionExecutor) {
		const registerHeatmapCellAction = (name, invalidTargetMessage, invalidParamsMessage) => {
			if (actionExecutor.has(name)) return;
			actionExecutor.register({ name }, async (call, ctx) => {
				const params = call?.params || {};
				const targetWidget = ctx.requireTargetWidget({
					targetRef: call?.queryScope?.widgetRef || null,
					kind: "heatmap",
					message: invalidTargetMessage
				});
				const xField = typeof params.xField === "string" ? params.xField : null;
				const yField = typeof params.yField === "string" ? params.yField : null;
				const xValue = typeof params.xValue === "string" ? params.xValue : null;
				const yValue = typeof params.yValue === "string" ? params.yValue : null;
				if (!targetWidget || !xField || !yField || xValue == null || yValue == null) throw new Error(invalidParamsMessage);
				const { rows: visibleRows } = ctx.readRowsForWidget(targetWidget.ref);
				const matchedCount = visibleRows.filter((row) => row?.[xField] === xValue && row?.[yField] === yValue).length;
				if (name === "heatmap.filterCells") ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for heatmap cell filtering.");
					let nextTransforms = replaceTaggedTransform$1(spec.transform, "heatmap.filterCells.x", {
						filter: {
							field: xField,
							equal: xValue
						},
						_widgetvaTag: "heatmap.filterCells.x"
					});
					nextTransforms = replaceTaggedTransform$1(nextTransforms, "heatmap.filterCells.y", {
						filter: {
							field: yField,
							equal: yValue
						},
						_widgetvaTag: "heatmap.filterCells.y"
					});
					return {
						...spec,
						transform: nextTransforms
					};
				});
				return buildSelectionActionResult({
					ctx,
					nextState: ctx.commitSelection({
						selection_id: `sel_${Date.now()}`,
						source_widget_id: targetWidget.widgetId || void 0,
						selection_type: "cell",
						fields: [xField, yField],
						value: {
							[xField]: xValue,
							[yField]: yValue
						},
						predicates: [{
							field: xField,
							op: "equals",
							value: xValue
						}, {
							field: yField,
							op: "equals",
							value: yValue
						}],
						count: matchedCount,
						summary: `${xField}: ${xValue}; ${yField}: ${yValue}`
					}),
					selectedCount: matchedCount,
					verificationHints: [...name === "heatmap.filterCells" ? ["Call perception.inspectVisibleRows to verify only the requested heatmap cell remains visible.", "Call perception.inspectViewConfig to verify the active heatmap spec now includes x/y equality filters for the requested cell."] : ["Read the updated heatmap selection state.", "Read linked widgets to confirm cell-level filter propagation."]]
				});
			});
		};
		registerHeatmapCellAction("heatmap.filterCells", "heatmap.filterCells requires a valid heatmap target widget.", "heatmap.filterCells requires a heatmap target, xField, yField, xValue, and yValue.");
		registerHeatmapCellAction("heatmap.selectCell", "heatmap.selectCell requires a valid heatmap target widget.", "heatmap.selectCell requires a heatmap target, xField, yField, xValue, and yValue.");
		if (!actionExecutor.has("heatmap.selectSubmatrix")) actionExecutor.register({ name: "heatmap.selectSubmatrix" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "heatmap",
				message: "heatmap.selectSubmatrix requires a valid heatmap target widget."
			});
			const xValues = Array.isArray(params.xValues) ? params.xValues.filter((value) => value != null) : [];
			const yValues = Array.isArray(params.yValues) ? params.yValues.filter((value) => value != null) : [];
			if (!targetWidget || xValues.length === 0 && yValues.length === 0) throw new Error("heatmap.selectSubmatrix requires a heatmap target and at least one of xValues or yValues.");
			const spec = ctx.readCurrentSpec();
			const xField = spec?.encoding?.x?.field || null;
			const yField = spec?.encoding?.y?.field || null;
			if (!xField || !yField) throw new Error("heatmap.selectSubmatrix requires x and y encodings on the active heatmap spec.");
			const { rows: visibleRows } = ctx.readRowsForWidget(targetWidget.ref);
			const matchedCount = visibleRows.filter((row) => {
				const xMatch = xValues.length === 0 || xValues.includes(row?.[xField]);
				const yMatch = yValues.length === 0 || yValues.includes(row?.[yField]);
				return xMatch && yMatch;
			}).length;
			const predicates = [];
			if (xValues.length > 0) predicates.push({
				field: xField,
				op: "in",
				value: xValues
			});
			if (yValues.length > 0) predicates.push({
				field: yField,
				op: "in",
				value: yValues
			});
			return buildSelectionActionResult({
				ctx,
				nextState: ctx.commitSelection({
					selection_id: `sel_${Date.now()}`,
					source_widget_id: targetWidget.widgetId || void 0,
					selection_type: "cell",
					fields: [xField, yField],
					value: {
						...xValues.length > 0 ? { [xField]: xValues } : {},
						...yValues.length > 0 ? { [yField]: yValues } : {}
					},
					predicates,
					count: matchedCount,
					summary: `${xField}: ${xValues.length > 0 ? xValues.join(", ") : "all"}; ${yField}: ${yValues.length > 0 ? yValues.join(", ") : "all"}`
				}),
				selectedCount: matchedCount,
				verificationHints: ["Read the updated heatmap selection state.", "Read linked widgets to confirm submatrix-level filter propagation."]
			});
		});
		if (!actionExecutor.has("heatmap.drilldownAxis")) actionExecutor.register({ name: "heatmap.drilldownAxis" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "heatmap",
				message: "heatmap.drilldownAxis requires a valid heatmap target widget."
			});
			const level = typeof params.level === "string" ? params.level.toLowerCase().trim() : null;
			const value = params.value;
			const parent = params.parent && typeof params.parent === "object" && !Array.isArray(params.parent) ? params.parent : {};
			if (!targetWidget || !level || value == null || value === "") throw new Error("heatmap.drilldownAxis requires a heatmap target plus level and value.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for heatmap axis drill-down.");
					const xEncoding = spec?.encoding?.x;
					const timeField = xEncoding?.field || null;
					const xType = xEncoding?.type || null;
					if (!timeField) throw new Error("heatmap.drilldownAxis requires a temporal x field on the active heatmap spec.");
					if (xType && xType !== "temporal") throw new Error(`heatmap.drilldownAxis requires encoding.x.type=temporal, received ${xType}.`);
					const heatmapState = spec._heatmap_state && typeof spec._heatmap_state === "object" ? { ...spec._heatmap_state } : {};
					if (!heatmapState.original_x_encoding) heatmapState.original_x_encoding = cloneValue$17(xEncoding);
					const nextTransforms = Array.isArray(spec.transform) ? spec.transform.filter((transform) => transform?._widgetvaTag !== "heatmap.drilldownAxis") : [];
					const mergedParent = {
						...heatmapState.parent && typeof heatmapState.parent === "object" ? heatmapState.parent : {},
						...parent
					};
					let nextTimeUnit = null;
					const filters = [];
					let nextParent;
					if (level === "year") {
						const yearValue = Number.parseInt(value, 10);
						if (!Number.isFinite(yearValue)) throw new Error(`heatmap.drilldownAxis requires an integer year value; received ${value}.`);
						nextParent = { year: yearValue };
						nextTimeUnit = "month";
						filters.push(`year(${datumRef(timeField)}) == ${yearValue}`);
					} else if (level === "month") {
						const yearValue = Number.parseInt(mergedParent.year, 10);
						const monthValue = Number.parseInt(value, 10);
						if (!Number.isFinite(yearValue)) throw new Error("heatmap.drilldownAxis month drill-down requires parent.year.");
						if (!Number.isFinite(monthValue)) throw new Error(`heatmap.drilldownAxis requires an integer month value; received ${value}.`);
						nextParent = {
							year: yearValue,
							month: monthValue
						};
						nextTimeUnit = "date";
						filters.push(`year(${datumRef(timeField)}) == ${yearValue}`);
						filters.push(`month(${datumRef(timeField)}) == ${monthValue - 1}`);
					} else if (level === "date") {
						const yearValue = Number.parseInt(mergedParent.year, 10);
						const monthValue = Number.parseInt(mergedParent.month, 10);
						const dateValue = Number.parseInt(value, 10);
						if (!Number.isFinite(yearValue) || !Number.isFinite(monthValue)) throw new Error("heatmap.drilldownAxis date drill-down requires parent.year and parent.month.");
						if (!Number.isFinite(dateValue)) throw new Error(`heatmap.drilldownAxis requires an integer date value; received ${value}.`);
						nextParent = {
							year: yearValue,
							month: monthValue,
							date: dateValue
						};
						nextTimeUnit = "date";
						filters.push(`year(${datumRef(timeField)}) == ${yearValue}`);
						filters.push(`month(${datumRef(timeField)}) == ${monthValue - 1}`);
						filters.push(`date(${datumRef(timeField)}) == ${dateValue}`);
					} else throw new Error(`heatmap.drilldownAxis does not support level "${level}".`);
					heatmapState.parent = nextParent;
					return {
						...spec,
						encoding: {
							...spec.encoding || {},
							x: {
								...spec.encoding?.x || {},
								field: timeField,
								type: "temporal",
								...nextTimeUnit ? { timeUnit: nextTimeUnit } : {}
							}
						},
						transform: [...nextTransforms, {
							filter: filters.join(" && "),
							_widgetvaTag: "heatmap.drilldownAxis"
						}],
						_heatmap_state: heatmapState
					};
				}),
				result: {
					widgetId: targetWidget.widgetId,
					level,
					value,
					parent
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the heatmap x-axis timeUnit now reflects the finer drill-down level.", "Read the target widget view state to confirm the tagged drill-down filter now narrows the visible period."]
			};
		});
		if (!actionExecutor.has("heatmap.resetDrilldown")) actionExecutor.register({ name: "heatmap.resetDrilldown" }, async (call, ctx) => {
			call?.params;
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "heatmap",
				message: "heatmap.resetDrilldown requires a valid heatmap target widget."
			});
			if (!targetWidget) throw new Error("heatmap.resetDrilldown requires a valid heatmap target widget.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for heatmap drill-down reset.");
					const heatmapState = spec._heatmap_state;
					const nextSpec = { ...spec };
					if (Array.isArray(nextSpec.transform)) nextSpec.transform = nextSpec.transform.filter((transform) => transform?._widgetvaTag !== "heatmap.drilldownAxis");
					const originalXEncoding = heatmapState && typeof heatmapState === "object" ? heatmapState.original_x_encoding : null;
					if (originalXEncoding && typeof originalXEncoding === "object") nextSpec.encoding = {
						...nextSpec.encoding || {},
						x: cloneValue$17(originalXEncoding)
					};
					delete nextSpec._heatmap_state;
					nextSpec._navigation_state = {
						mode: "reset",
						sourceAction: "heatmap.resetDrilldown"
					};
					return nextSpec;
				}),
				result: {
					widgetId: targetWidget.widgetId,
					reset: true
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the original heatmap x-axis encoding was restored.", "Read the target widget view state to confirm the drill-down filter and state marker were removed."]
			};
		});
		if (!actionExecutor.has("heatmap.addMarginalBars")) actionExecutor.register({ name: "heatmap.addMarginalBars" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "heatmap",
				message: "heatmap.addMarginalBars requires a valid heatmap target widget."
			});
			const op = typeof params.op === "string" ? params.op.toLowerCase().trim() : "mean";
			const showTop = params.showTop !== false;
			const showRight = params.showRight !== false;
			const barSize = Number.isFinite(params.barSize) ? Number(params.barSize) : 70;
			const barColor = typeof params.barColor === "string" && params.barColor.length > 0 ? params.barColor : "#666666";
			const allowedAgg = new Set([
				"mean",
				"sum",
				"median",
				"max",
				"min",
				"count"
			]);
			if (!targetWidget) throw new Error("heatmap.addMarginalBars requires a valid heatmap target widget.");
			if (!showTop && !showRight) throw new Error("heatmap.addMarginalBars requires at least one of showTop/showRight to be true.");
			if (!allowedAgg.has(op)) throw new Error(`heatmap.addMarginalBars does not support op "${params.op}".`);
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for heatmap marginal bars.");
					const encoding = spec.encoding || {};
					const xEncoding = encoding.x || {};
					const yEncoding = encoding.y || {};
					const colorEncoding = encoding.color || {};
					const xField = xEncoding.field;
					const yField = yEncoding.field;
					const valueField = colorEncoding.field;
					if (!xField || !yField || !valueField) throw new Error("heatmap.addMarginalBars requires encoding.x.field, encoding.y.field, and encoding.color.field on the active heatmap spec.");
					const main = cloneValue$17(spec);
					const title = main.title;
					delete main.title;
					const defaultWidth = Number.isFinite(main.width) ? main.width : 400;
					const defaultHeight = Number.isFinite(main.height) ? main.height : 300;
					main.width = defaultWidth;
					main.height = defaultHeight;
					const baseData = cloneValue$17(main.data);
					const baseTransform = cloneValue$17(main.transform);
					const baseConfig = cloneValue$17(main.config);
					const baseBlock = () => ({
						...baseData !== void 0 ? { data: cloneValue$17(baseData) } : {},
						...baseTransform !== void 0 ? { transform: cloneValue$17(baseTransform) } : {},
						...baseConfig !== void 0 ? { config: cloneValue$17(baseConfig) } : {}
					});
					const topSpec = showTop ? {
						...baseBlock(),
						mark: {
							type: "bar",
							color: barColor
						},
						encoding: {
							x: cloneValue$17(xEncoding),
							y: {
								aggregate: op,
								field: valueField,
								type: "quantitative",
								title: null
							},
							tooltip: [{
								field: xField,
								...xEncoding.timeUnit ? { timeUnit: xEncoding.timeUnit } : {},
								type: xEncoding.type || "nominal",
								title: xEncoding.title || xField
							}, {
								aggregate: op,
								field: valueField,
								type: "quantitative",
								title: `${op}(${valueField})`
							}]
						},
						height: barSize,
						width: defaultWidth
					} : null;
					if (topSpec) {
						topSpec.encoding.x.axis = {
							labels: false,
							ticks: false,
							title: null,
							domain: false
						};
						topSpec.encoding.y.axis = {
							grid: false,
							ticks: false,
							title: null
						};
					}
					const rightSpec = showRight ? {
						...baseBlock(),
						mark: {
							type: "bar",
							color: barColor
						},
						encoding: {
							y: cloneValue$17(yEncoding),
							x: {
								aggregate: op,
								field: valueField,
								type: "quantitative",
								title: null
							},
							tooltip: [{
								field: yField,
								...yEncoding.timeUnit ? { timeUnit: yEncoding.timeUnit } : {},
								type: yEncoding.type || "nominal",
								title: yEncoding.title || yField
							}, {
								aggregate: op,
								field: valueField,
								type: "quantitative",
								title: `${op}(${valueField})`
							}]
						},
						width: barSize,
						height: defaultHeight
					} : null;
					if (rightSpec) {
						rightSpec.encoding.y.axis = {
							labels: false,
							ticks: false,
							title: null,
							domain: false
						};
						rightSpec.encoding.x.axis = {
							grid: false,
							ticks: false,
							title: null
						};
					}
					const row = {
						hconcat: [main, ...rightSpec ? [rightSpec] : []],
						resolve: { scale: { y: "shared" } }
					};
					return {
						$schema: spec.$schema || "https://vega.github.io/schema/vega-lite/v5.json",
						...title !== void 0 ? { title } : {},
						vconcat: [...topSpec ? [topSpec] : [], row],
						resolve: { scale: { x: "shared" } },
						_marginal_bars_state: {
							enabled: true,
							op,
							show_top: showTop,
							show_right: showRight,
							value_field: valueField,
							x_field: xField,
							y_field: yField
						}
					};
				}),
				result: {
					widgetId: targetWidget.widgetId,
					op,
					showTop,
					showRight
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the heatmap was composed with top and/or right marginal bar charts.", "Read the target widget view state to confirm the marginal bars aggregate the original heatmap value field."]
			};
		});
		if (!actionExecutor.has("heatmap.highlightRegion")) actionExecutor.register({ name: "heatmap.highlightRegion" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "heatmap",
				message: "heatmap.highlightRegion requires a valid heatmap target widget."
			});
			const xValues = Array.isArray(params.xValues) ? params.xValues.filter((value) => value != null) : [];
			const yValues = Array.isArray(params.yValues) ? params.yValues.filter((value) => value != null) : [];
			if (!targetWidget || xValues.length === 0 && yValues.length === 0) throw new Error("heatmap.highlightRegion requires a heatmap target and at least one of xValues or yValues.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for heatmap region highlighting.");
					const xField = spec?.encoding?.x?.field;
					const yField = spec?.encoding?.y?.field;
					if (!xField || !yField) throw new Error("heatmap.highlightRegion requires x and y encodings on the active heatmap spec.");
					const tests = [];
					if (xValues.length > 0) tests.push(`indexof(${JSON.stringify(xValues)}, datum["${xField}"]) >= 0`);
					if (yValues.length > 0) tests.push(`indexof(${JSON.stringify(yValues)}, datum["${yField}"]) >= 0`);
					return {
						...spec,
						encoding: {
							...spec.encoding || {},
							opacity: {
								condition: {
									test: tests.join(" && "),
									value: 1
								},
								value: .15
							}
						}
					};
				}),
				result: {
					widgetId: targetWidget.widgetId,
					xValues,
					yValues
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the heatmap opacity condition was updated.", "Read the target widget view state to confirm the requested region is emphasized."]
			};
		});
		if (!actionExecutor.has("heatmap.adjustColorScale")) actionExecutor.register({ name: "heatmap.adjustColorScale" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "heatmap",
				message: "heatmap.adjustColorScale requires a valid heatmap target widget."
			});
			const scheme = typeof params.scheme === "string" ? params.scheme.trim() : "";
			const domain = Array.isArray(params.domain) ? params.domain : null;
			if (!targetWidget || !scheme) throw new Error("heatmap.adjustColorScale requires a heatmap target and a non-empty scheme.");
			if (domain && domain.length !== 2) throw new Error("heatmap.adjustColorScale domain must contain exactly two values when provided.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for heatmap color-scale updates.");
					const nextEncoding = { ...spec.encoding || {} };
					nextEncoding.color = {
						...nextEncoding.color || {},
						scale: {
							...nextEncoding.color && nextEncoding.color.scale || {},
							scheme,
							...domain ? { domain } : {}
						}
					};
					return {
						...spec,
						encoding: nextEncoding,
						_color_scale_state: {
							channel: "color",
							scheme,
							...domain ? { domain } : {}
						}
					};
				}),
				result: {
					widgetId: targetWidget.widgetId,
					scheme,
					...domain ? { domain } : {}
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the heatmap color scale scheme was updated.", "Read the target widget view state to confirm the requested color domain values."]
			};
		});
		if (!actionExecutor.has("heatmap.thresholdMask")) actionExecutor.register({ name: "heatmap.thresholdMask" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "heatmap",
				message: "heatmap.thresholdMask requires a valid heatmap target widget."
			});
			const minValue = Number(params.minValue);
			const maxValue = Number(params.maxValue);
			const outsideOpacity = Number.isFinite(params.outsideOpacity) ? Math.max(0, Math.min(1, params.outsideOpacity)) : .1;
			if (!targetWidget || !Number.isFinite(minValue) || !Number.isFinite(maxValue)) throw new Error("heatmap.thresholdMask requires a heatmap target plus finite minValue and maxValue.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for heatmap threshold masking.");
					const colorEncoding = spec?.encoding?.color;
					const colorField = colorEncoding?.field;
					if (!colorField) throw new Error("heatmap.thresholdMask requires a color encoding field on the active heatmap spec.");
					const aggregate = colorEncoding?.aggregate;
					const aggregateAs = colorEncoding?.as;
					const valueField = aggregate ? typeof aggregateAs === "string" && aggregateAs.trim().length > 0 ? aggregateAs.trim() : `${String(aggregate).toLowerCase()}_${colorField}` : colorField;
					return {
						...spec,
						encoding: {
							...spec.encoding || {},
							opacity: {
								condition: {
									test: `datum['${valueField}'] >= ${minValue} && datum['${valueField}'] <= ${maxValue}`,
									value: 1
								},
								value: outsideOpacity
							}
						}
					};
				}),
				result: {
					widgetId: targetWidget.widgetId,
					minValue,
					maxValue,
					outsideOpacity
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the heatmap opacity condition now masks values outside the requested threshold range.", "Read the target widget view state to confirm the requested threshold mask was applied."]
			};
		});
		if (!actionExecutor.has("heatmap.filterCellsByRegion")) actionExecutor.register({ name: "heatmap.filterCellsByRegion" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "heatmap",
				message: "heatmap.filterCellsByRegion requires a valid heatmap target widget."
			});
			const xValues = Array.isArray(params.xValues) ? params.xValues.filter((value) => value != null) : params.xValue != null ? [params.xValue] : [];
			const yValues = Array.isArray(params.yValues) ? params.yValues.filter((value) => value != null) : params.yValue != null ? [params.yValue] : [];
			if (!targetWidget || xValues.length === 0 && yValues.length === 0) throw new Error("heatmap.filterCellsByRegion requires a heatmap target and at least one of xValues/yValues or xValue/yValue.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for heatmap region filtering.");
					const xField = spec?.encoding?.x?.field;
					const yField = spec?.encoding?.y?.field;
					const xTimeUnit = spec?.encoding?.x?.timeUnit;
					const yTimeUnit = spec?.encoding?.y?.timeUnit;
					if (!xField || !yField) throw new Error("heatmap.filterCellsByRegion requires x and y encodings on the active heatmap spec.");
					let filterSpec = null;
					if (xValues.length > 0 && yValues.length === 0 && !xTimeUnit) filterSpec = {
						field: xField,
						notOneOf: [...xValues]
					};
					else if (yValues.length > 0 && xValues.length === 0 && !yTimeUnit) filterSpec = {
						field: yField,
						notOneOf: [...yValues]
					};
					else {
						const excludeParts = [];
						if (xValues.length > 0) {
							const { valueListExpr, datumExpr } = normalizeTimeUnitValues(xField, xValues, xTimeUnit);
							excludeParts.push(`indexof([${valueListExpr}], ${datumExpr}) >= 0`);
						}
						if (yValues.length > 0) {
							const { valueListExpr, datumExpr } = normalizeTimeUnitValues(yField, yValues, yTimeUnit);
							excludeParts.push(`indexof([${valueListExpr}], ${datumExpr}) >= 0`);
						}
						filterSpec = `!(${excludeParts.join(" && ")})`;
					}
					return {
						...spec,
						transform: replaceTaggedTransform$1(spec.transform, "heatmap.filterCellsByRegion", {
							filter: filterSpec,
							_widgetvaTag: "heatmap.filterCellsByRegion"
						})
					};
				}),
				result: {
					widgetId: targetWidget.widgetId,
					xValues,
					yValues
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the heatmap transform now excludes the requested region.", "Read the target widget rows to confirm the requested region no longer appears in the visible matrix."]
			};
		});
		if (!actionExecutor.has("heatmap.highlightRegionByValue")) actionExecutor.register({ name: "heatmap.highlightRegionByValue" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "heatmap",
				message: "heatmap.highlightRegionByValue requires a valid heatmap target widget."
			});
			const hasMin = params.minValue != null && params.minValue !== "";
			const hasMax = params.maxValue != null && params.maxValue !== "";
			const minValue = hasMin ? Number(params.minValue) : null;
			const maxValue = hasMax ? Number(params.maxValue) : null;
			const outsideOpacity = Number.isFinite(params.outsideOpacity) ? Math.max(0, Math.min(1, params.outsideOpacity)) : .12;
			if (!targetWidget || !hasMin && !hasMax || hasMin && !Number.isFinite(minValue) || hasMax && !Number.isFinite(maxValue)) throw new Error("heatmap.highlightRegionByValue requires a heatmap target and at least one finite minValue or maxValue.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for heatmap value-range highlighting.");
					const colorEncoding = spec?.encoding?.color;
					const colorField = colorEncoding?.field;
					if (!colorField) throw new Error("heatmap.highlightRegionByValue requires a color encoding field on the active heatmap spec.");
					const aggregate = colorEncoding?.aggregate;
					const aggregateAs = colorEncoding?.as;
					const valueField = aggregate ? typeof aggregateAs === "string" && aggregateAs.trim().length > 0 ? aggregateAs.trim() : `${String(aggregate).toLowerCase()}_${colorField}` : colorField;
					const tests = [];
					if (hasMin) tests.push(`datum['${valueField}'] >= ${minValue}`);
					if (hasMax) tests.push(`datum['${valueField}'] <= ${maxValue}`);
					return {
						...spec,
						encoding: {
							...spec.encoding || {},
							opacity: {
								condition: {
									test: tests.join(" && "),
									value: 1
								},
								value: outsideOpacity
							}
						}
					};
				}),
				result: {
					widgetId: targetWidget.widgetId,
					...hasMin ? { minValue } : {},
					...hasMax ? { maxValue } : {},
					outsideOpacity
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the heatmap opacity condition now highlights values inside the requested range.", "Read the target widget view state to confirm the value-range highlight was applied without filtering data away."]
			};
		});
		if (!actionExecutor.has("heatmap.clusterRowsCols")) actionExecutor.register({ name: "heatmap.clusterRowsCols" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "heatmap",
				message: "heatmap.clusterRowsCols requires a valid heatmap target widget."
			});
			const clusterRows = params.clusterRows !== false;
			const clusterCols = params.clusterCols !== false;
			const requestedMethod = typeof params.method === "string" ? params.method.toLowerCase().trim() : "sum";
			const method = [
				"sum",
				"mean",
				"max"
			].includes(requestedMethod) ? requestedMethod : "sum";
			if (!targetWidget || !clusterRows && !clusterCols) throw new Error("heatmap.clusterRowsCols requires a heatmap target and at least one of clusterRows or clusterCols to be true.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for heatmap row/column clustering.");
					const colorField = spec?.encoding?.color?.field;
					if (!colorField) throw new Error("heatmap.clusterRowsCols requires a color encoding field on the active heatmap spec.");
					const nextEncoding = cloneValue$17(spec.encoding || {});
					if (clusterRows && nextEncoding.y) nextEncoding.y = {
						...nextEncoding.y,
						sort: {
							op: method,
							field: colorField,
							order: "descending"
						}
					};
					if (clusterCols && nextEncoding.x) nextEncoding.x = {
						...nextEncoding.x,
						sort: {
							op: method,
							field: colorField,
							order: "descending"
						}
					};
					return {
						...spec,
						encoding: nextEncoding,
						_cluster_rows_cols_state: {
							cluster_rows: clusterRows,
							cluster_cols: clusterCols,
							method,
							color_field: colorField
						}
					};
				}),
				result: {
					widgetId: targetWidget.widgetId,
					clusterRows,
					clusterCols,
					method
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the heatmap x/y encodings now carry aggregate sort metadata.", "Read the target widget view state to confirm the requested rows and/or columns are reordered by aggregated value."]
			};
		});
		if (!actionExecutor.has("heatmap.transpose")) actionExecutor.register({ name: "heatmap.transpose" }, async (call, ctx) => {
			call?.params;
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "heatmap",
				message: "heatmap.transpose requires a valid heatmap target widget."
			});
			if (!targetWidget) throw new Error("heatmap.transpose requires a valid heatmap target widget.");
			const nextState = ctx.updateCurrentSpec((spec) => {
				if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for heatmap transpose.");
				const xEncoding = spec?.encoding?.x;
				const yEncoding = spec?.encoding?.y;
				if (!xEncoding || !yEncoding) throw new Error("heatmap.transpose requires both x and y encodings on the active heatmap spec.");
				return {
					...spec,
					encoding: {
						...spec.encoding || {},
						x: cloneValue$17(yEncoding),
						y: cloneValue$17(xEncoding)
					},
					...spec.width != null && spec.height != null ? {
						width: spec.height,
						height: spec.width
					} : {},
					_transpose_state: {
						...spec._transpose_state || { transposed: false },
						transposed: !(spec._transpose_state?.transposed === true)
					}
				};
			});
			return {
				nextState,
				result: {
					widgetId: targetWidget.widgetId,
					transposed: nextState?._transpose_state?.transposed === true
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the heatmap x and y encodings were swapped.", "Read the target widget view state to confirm the transpose marker and any width/height swap were applied."]
			};
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/widgets/heatmap/perception.js
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
	//#region ../../widgetva-kit/src/adapters/widgets/heatmap/humanInteraction.js
	function getHeatmapHumanInteractionConfig() {
		return {
			mode: "cellClick",
			actionName: "heatmap.filterCells",
			supportsDirectManipulation: true
		};
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgets/heatmap/state.js
	async function applyHeatmapState(args) {
		return applyVegaLiteRuntimeState(args);
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgetFamilies/heatmapWidgetAdapter.js
	var heatmapWidgetAdapter = createVegaLiteWidgetAdapter({
		kind: "heatmap",
		async applyState(args) {
			return applyHeatmapState(args);
		},
		buildActionDescriptors(args) {
			return buildHeatmapActionDescriptors(args);
		},
		buildPerceptionDescriptors(args) {
			return buildHeatmapPerceptionDescriptors(args);
		},
		getHumanInteractionConfig() {
			return getHeatmapHumanInteractionConfig();
		},
		registerActions(actionExecutor) {
			return registerHeatmapActions(actionExecutor);
		},
		registerPerceptionQueries(perceptionRegistry) {
			return registerHeatmapPerceptionQueries(perceptionRegistry);
		}
	});
	//#endregion
	//#region ../../widgetva-kit/src/widgets/line/actions.js
	function replaceTaggedTransform(transforms, tag, nextTransform) {
		const nextTransforms = (Array.isArray(transforms) ? transforms : []).filter((transform) => transform?._widgetvaTag !== tag);
		return nextTransform ? [...nextTransforms, nextTransform] : nextTransforms;
	}
	function replaceTaggedLayer$1(layers, tag, nextLayer) {
		const nextLayers = (Array.isArray(layers) ? layers : []).filter((layer) => layer?._widgetvaTag !== tag);
		return nextLayer ? [...nextLayers, nextLayer] : nextLayers;
	}
	function inferLineRootEncoding(spec) {
		return spec?.layer?.[0]?.encoding || spec?.encoding || {};
	}
	function inferRawTimeField(spec, rootEncoding, originalTransforms) {
		const taggedTimeUnit = (Array.isArray(originalTransforms) ? originalTransforms : []).find((transform) => transform && typeof transform === "object" && "timeUnit" in transform && typeof transform.field === "string");
		if (taggedTimeUnit?.field) return taggedTimeUnit.field;
		const xField = rootEncoding?.x?.field;
		if (typeof xField !== "string" || xField.length === 0) return null;
		if (!xField.includes("_")) return xField;
		const candidate = xField.split("_").at(-1);
		const rows = spec?.data?.values;
		if (Array.isArray(rows) && rows.length > 0 && candidate && Object.prototype.hasOwnProperty.call(rows[0], candidate)) return candidate;
		return xField;
	}
	function inferRawValueField(spec, rootEncoding, originalTransforms) {
		const aggregateTransform = (Array.isArray(originalTransforms) ? originalTransforms : []).find((transform) => transform && typeof transform === "object" && Array.isArray(transform.aggregate) && transform.aggregate.length > 0);
		if (aggregateTransform?.aggregate?.[0]?.field) return aggregateTransform.aggregate[0].field;
		const yField = rootEncoding?.y?.field;
		if (typeof yField !== "string" || yField.length === 0) return null;
		if (yField.startsWith("total_")) return yField.slice(6);
		if (yField.startsWith("sum_")) return yField.slice(4);
		return yField;
	}
	function detectTemporalAxis(encoding, timeField) {
		if (encoding?.x?.field === timeField || encoding?.x?.type === "temporal") return {
			timeAxis: "x",
			valueAxis: "y"
		};
		return {
			timeAxis: "y",
			valueAxis: "x"
		};
	}
	function buildLineActionDescriptors({ widgetRef, selectionRef, scope = "local", affectedRefs = [widgetRef] }) {
		const supportedWidgetKinds = ["line"];
		return [
			makeActionDescriptor({
				name: "line.selectSeries",
				title: "Select line series",
				description: "Select one or more categorical series represented in the line chart.",
				primitive: "select",
				category: "selection",
				scope,
				supportedWidgetKinds,
				targetRef: selectionRef || widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "selections" : "transforms"),
				paramsSchema: {
					type: "object",
					properties: {
						field: { type: "string" },
						values: {
							type: "array",
							items: { type: "string" }
						}
					},
					required: ["field", "values"]
				},
				postconditions: [{ description: "The active selection should contain the selected series values." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid line widget in the current workspace.",
					failureMessage: "line.selectSeries requires a valid line target widget."
				}],
				effects: [makeSelectionEffect(selectionRef || widgetRef, "Creates or updates a categorical selection over line series."), ...affectedRefs.filter((ref) => ref !== widgetRef).map((ref) => makeFilterEffect(ref, "Linked widgets may be filtered by the selected line series."))],
				examples: [{
					userGoal: "Focus one or more line series before comparing trends.",
					params: {
						field: "Origin",
						values: ["Japan"]
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "line.selectXValue",
				title: "Select a line x-axis value",
				description: "Select all visible line rows that share one x-axis value, such as one year or one named category bucket.",
				primitive: "select",
				category: "selection",
				scope,
				supportedWidgetKinds,
				targetRef: selectionRef || widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "selections" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						value: { anyOf: [{ type: "string" }, { type: "number" }] },
						field: { type: "string" }
					},
					required: ["value"]
				},
				postconditions: [{ description: "The active selection should contain one predicate targeting the chosen x-axis value." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid line widget in the current workspace.",
					failureMessage: "line.selectXValue requires a valid line target widget."
				}],
				effects: [makeSelectionEffect(selectionRef || widgetRef, "Creates or updates a selection over one x-axis value in the current line view."), ...affectedRefs.filter((ref) => ref !== widgetRef).map((ref) => makeFilterEffect(ref, "Linked widgets may update to the selected line x-axis slice."))],
				examples: [{
					userGoal: "Select one model year across the line view before checking linked distributions and details.",
					params: {
						field: "year",
						value: 1971
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "line.zoomXRegion",
				title: "Zoom line chart x-region",
				description: "Zoom the temporal x-axis of the line chart to a specific start/end range without discarding data.",
				primitive: "zoom",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "transforms"),
				paramsSchema: {
					type: "object",
					properties: {
						start: { type: "string" },
						end: { type: "string" }
					},
					required: ["start", "end"]
				},
				postconditions: [{ description: "The line chart x-axis domain should reflect the requested start/end range." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid line widget in the current workspace.",
					failureMessage: "line.zoomXRegion requires a valid line target widget."
				}],
				examples: [{
					userGoal: "Zoom into a particular date range to inspect the detailed trend.",
					params: {
						start: "2024-01-01",
						end: "2024-02-01"
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "line.focusLines",
				title: "Focus line series",
				description: "Emphasize one or more line series while dimming the remaining lines.",
				primitive: "focus",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						lines: {
							type: "array",
							items: { type: "string" }
						},
						lineField: { type: "string" },
						dimOpacity: { type: "number" }
					},
					required: ["lines"]
				},
				postconditions: [{ description: "The requested line series should be visually emphasized while the remaining lines are dimmed." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid line widget in the current workspace.",
					failureMessage: "line.focusLines requires a valid line target widget."
				}],
				examples: [{
					userGoal: "Focus a subset of line series before comparing their trends.",
					params: {
						lines: ["A"],
						lineField: "series",
						dimOpacity: .08
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "line.highlightTrend",
				title: "Highlight line trend",
				description: "Add or refresh a regression trend line layer over the existing line chart.",
				primitive: "annotate",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: { trendType: { type: "string" } }
				},
				postconditions: [{ description: "The line chart should include a visible regression trend line layer over the current x/y encoding." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid line widget in the current workspace.",
					failureMessage: "line.highlightTrend requires a valid line target widget."
				}],
				examples: [{
					userGoal: "Add a regression overlay before describing the overall trend direction.",
					params: { trendType: "increasing" }
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "line.showMovingAverage",
				title: "Overlay moving average",
				description: "Add or replace a moving-average overlay line computed from the current temporal/value encodings, optionally grouped by line series.",
				primitive: "annotate",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: { windowSize: { type: "number" } }
				},
				postconditions: [{ description: "A tagged moving-average overlay layer should be present and should use a Vega window transform over the current line encodings." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid line widget in the current workspace.",
					failureMessage: "line.showMovingAverage requires a valid line target widget."
				}],
				examples: [{
					userGoal: "Smooth a noisy line chart with a 3-period trailing moving average.",
					params: { windowSize: 3 }
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "line.drillDownXAxis",
				title: "Drill down line x-axis",
				description: "Drill a temporal line chart from a coarser time aggregation into a more detailed x-axis view.",
				primitive: "drillDown",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "transforms" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						level: { type: "string" },
						value: { type: "number" },
						parent: { type: "object" }
					},
					required: ["level", "value"]
				},
				postconditions: [{ description: "The line chart should switch to a finer temporal aggregation with matching filters and updated x/y encodings." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid line widget in the current workspace.",
					failureMessage: "line.drillDownXAxis requires a valid line target widget."
				}],
				examples: [{
					userGoal: "Drill a yearly trend into monthly detail for a specific year.",
					params: {
						level: "year",
						value: 2024
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "line.resetDrilldownXAxis",
				title: "Reset line x-axis drill-down",
				description: "Restore the original line chart encoding, transforms, and title after a temporal drill-down.",
				primitive: "navigate",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "transforms" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {}
				},
				postconditions: [{ description: "The line chart should revert to its original temporal encoding, transforms, and title." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid line widget in the current workspace.",
					failureMessage: "line.resetDrilldownXAxis requires a valid line target widget."
				}],
				examples: [{
					userGoal: "Return from a drilled monthly view back to the original yearly chart.",
					params: {}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "line.resampleXAxis",
				title: "Resample line x-axis",
				description: "Change the temporal aggregation granularity of a line chart and apply an aggregate to the value axis.",
				primitive: "aggregate",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						granularity: { type: "string" },
						agg: { type: "string" }
					},
					required: ["granularity"]
				},
				postconditions: [{ description: "The line chart time axis should use the requested timeUnit and the value axis should use the requested aggregation." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid line widget in the current workspace.",
					failureMessage: "line.resampleXAxis requires a valid line target widget."
				}],
				examples: [{
					userGoal: "Switch a dense daily series into monthly mean values before comparing long-term trends.",
					params: {
						granularity: "month",
						agg: "mean"
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "line.resetResampleXAxis",
				title: "Reset line x-axis resample",
				description: "Restore the original temporal encoding after a line x-axis resampling operation.",
				primitive: "navigate",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {}
				},
				postconditions: [{ description: "The line chart should revert to its original temporal encoding and clear the resample state." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid line widget in the current workspace.",
					failureMessage: "line.resetResampleXAxis requires a valid line target widget."
				}],
				examples: [{
					userGoal: "Return a resampled monthly line chart back to its original daily granularity.",
					params: {}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "line.boldLines",
				title: "Bold line series",
				description: "Increase the stroke width of one or more line series while keeping the remaining lines thin.",
				primitive: "highlight",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						lineNames: {
							type: "array",
							items: { type: "string" }
						},
						lineField: { type: "string" },
						boldWidth: { type: "number" },
						baseWidth: { type: "number" }
					},
					required: ["lineNames"]
				},
				postconditions: [{ description: "The requested line series should be rendered with a thicker stroke than the remaining lines." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid line widget in the current workspace.",
					failureMessage: "line.boldLines requires a valid line target widget."
				}],
				examples: [{
					userGoal: "Make one or more line series stand out before comparing the trends.",
					params: {
						lineNames: ["A"],
						lineField: "series",
						boldWidth: 4,
						baseWidth: 1
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "line.filterLines",
				title: "Filter out line series",
				description: "Exclude one or more line series from the current chart by writing a series filter into the line spec.",
				primitive: "filter",
				category: "dataTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "transforms" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						linesToRemove: {
							type: "array",
							items: { type: "string" }
						},
						lineField: { type: "string" }
					},
					required: ["linesToRemove"]
				},
				postconditions: [{ description: "The line chart transform list should exclude the requested line series." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid line widget in the current workspace.",
					failureMessage: "line.filterLines requires a valid line target widget."
				}],
				effects: affectedRefs.map((ref) => makeFilterEffect(ref, ref === widgetRef ? "The requested line series are excluded from the current chart." : "Linked widgets may update to reflect the removed line series.")),
				examples: [{
					userGoal: "Remove noisy or irrelevant series before comparing the remaining trends.",
					params: {
						linesToRemove: ["B"],
						lineField: "series"
					}
				}],
				reversible: true
			})
		];
	}
	function registerLineActions(actionExecutor) {
		if (!actionExecutor.has("line.selectSeries")) actionExecutor.register({ name: "line.selectSeries" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "line"
			});
			const field = typeof params.field === "string" ? params.field : null;
			const values = Array.isArray(params.values) ? params.values.filter((value) => typeof value === "string") : [];
			if (!targetWidget || !field || values.length === 0) throw new Error("line.selectSeries requires a line target, field, and one or more values.");
			const { rows: visibleRows } = ctx.readRowsForWidget(targetWidget.ref);
			const matchedCount = visibleRows.filter((row) => values.includes(row?.[field])).length;
			return buildSelectionActionResult({
				ctx,
				nextState: ctx.commitSelection({
					selection_id: `sel_${Date.now()}`,
					source_widget_id: targetWidget.widgetId || void 0,
					selection_type: "category",
					field,
					values,
					predicates: [{
						field,
						op: "in",
						value: values
					}],
					count: matchedCount,
					summary: `${field}: ${values.join(", ")}`
				}),
				selectedCount: matchedCount,
				verificationHints: ["Read the updated line selection state.", "Read linked widgets to confirm series-level filter propagation."]
			});
		});
		if (!actionExecutor.has("line.zoomXRegion")) actionExecutor.register({ name: "line.zoomXRegion" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "line",
				message: "line.zoomXRegion requires a valid line target widget."
			});
			const start = typeof params.start === "string" ? params.start : null;
			const end = typeof params.end === "string" ? params.end : null;
			if (!targetWidget || !start || !end) throw new Error("line.zoomXRegion requires a line target plus start and end values.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for line x-domain updates.");
					const nextEncoding = { ...spec.encoding || {} };
					if (!nextEncoding.x) throw new Error("line.zoomXRegion requires an x encoding on the active line spec.");
					nextEncoding.x = {
						...nextEncoding.x,
						scale: {
							...nextEncoding.x.scale || {},
							domain: [start, end]
						}
					};
					const nextMark = typeof spec.mark === "string" ? {
						type: spec.mark,
						clip: true
					} : {
						...spec.mark || {},
						clip: true
					};
					return {
						...spec,
						mark: nextMark,
						encoding: nextEncoding
					};
				}),
				result: {
					widgetId: targetWidget.widgetId,
					xDomain: [start, end]
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the line chart x-domain was updated.", "Read the target widget view state to confirm the new temporal x-domain values."]
			};
		});
		if (!actionExecutor.has("line.selectXValue")) actionExecutor.register({ name: "line.selectXValue" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "line",
				message: "line.selectXValue requires a valid line target widget."
			});
			const rawValue = params.value;
			const explicitField = typeof params.field === "string" && params.field.length > 0 ? params.field : null;
			if (!targetWidget || rawValue == null) throw new Error("line.selectXValue requires a line target and a non-null x-axis value.");
			const { rows: visibleRows } = ctx.readRowsForWidget(targetWidget.ref);
			const currentSpec = ctx.readCurrentSpec?.() || targetWidget.readState?.().currentSpec || targetWidget.readState?.().rawSpec || null;
			const rootEncoding = currentSpec?.layer?.[0]?.encoding || currentSpec?.encoding || {};
			const field = explicitField || rootEncoding?.x?.field || null;
			if (!field) throw new Error("line.selectXValue requires a resolvable x-axis field on the active line spec.");
			const matchedCount = visibleRows.filter((row) => row?.[field] === rawValue).length;
			return buildSelectionActionResult({
				ctx,
				nextState: ctx.commitSelection({
					selection_id: `sel_${Date.now()}`,
					source_widget_id: targetWidget.widgetId || void 0,
					selection_type: "category",
					field,
					values: [rawValue],
					predicates: [{
						field,
						op: "in",
						value: [rawValue]
					}],
					count: matchedCount,
					summary: `${field}: ${rawValue}`
				}),
				selectedCount: matchedCount,
				verificationHints: ["Read the updated line selection state.", "Read linked widgets to confirm the selected x-axis slice propagated beyond the line chart."]
			});
		});
		if (!actionExecutor.has("line.focusLines")) actionExecutor.register({ name: "line.focusLines" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "line",
				message: "line.focusLines requires a valid line target widget."
			});
			const lines = Array.isArray(params.lines) ? params.lines.filter((value) => typeof value === "string" && value.length > 0) : [];
			const dimOpacity = typeof params.dimOpacity === "number" ? params.dimOpacity : .08;
			if (!targetWidget || lines.length === 0) throw new Error("line.focusLines requires a line target and at least one line identifier.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for line focus updates.");
					const encoding = spec.encoding || {};
					const lineField = typeof params.lineField === "string" ? params.lineField : encoding?.color?.field || encoding?.detail?.field || null;
					if (!lineField) throw new Error("line.focusLines requires a lineField or an existing color/detail grouping field on the active line spec.");
					const linesJson = JSON.stringify(lines);
					return {
						...spec,
						encoding: {
							...encoding,
							opacity: {
								condition: {
									test: `indexof(${linesJson}, datum['${lineField}']) >= 0`,
									value: 1
								},
								value: dimOpacity
							}
						},
						_line_focus_state: {
							lines,
							line_field: lineField
						}
					};
				}),
				result: {
					widgetId: targetWidget.widgetId,
					lines,
					lineField: params.lineField || null,
					dimOpacity
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the line chart opacity condition now focuses the requested series.", "Read the target widget view state to confirm non-focused lines are dimmed."]
			};
		});
		if (!actionExecutor.has("line.highlightTrend")) actionExecutor.register({ name: "line.highlightTrend" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "line",
				message: "line.highlightTrend requires a valid line target widget."
			});
			const trendType = typeof params.trendType === "string" && params.trendType.length > 0 ? params.trendType : "increasing";
			if (!targetWidget) throw new Error("line.highlightTrend requires a valid line target widget.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for line trend highlighting.");
					const rootEncoding = spec?.layer?.[0]?.encoding || spec?.encoding || {};
					const xField = rootEncoding?.x?.field || null;
					const yField = rootEncoding?.y?.field || null;
					const xType = rootEncoding?.x?.type || "temporal";
					const yType = rootEncoding?.y?.type || "quantitative";
					if (!xField || !yField) throw new Error("line.highlightTrend requires x and y encodings on the active line spec.");
					const trendLayer = {
						_widgetvaTag: "line.highlightTrend",
						mark: {
							type: "line",
							color: "red",
							strokeDash: [5, 5],
							strokeWidth: 2
						},
						transform: [{
							regression: yField,
							on: xField
						}],
						encoding: {
							x: {
								field: xField,
								type: xType
							},
							y: {
								field: yField,
								type: yType
							}
						}
					};
					if (Array.isArray(spec.layer) && spec.layer.length > 0) return {
						...spec,
						layer: replaceTaggedLayer$1(spec.layer, "line.highlightTrend", trendLayer)
					};
					const nextSpec = { ...spec };
					const baseLayer = {
						mark: spec.mark || "line",
						encoding: spec.encoding || {}
					};
					delete nextSpec.mark;
					delete nextSpec.encoding;
					return {
						...nextSpec,
						layer: replaceTaggedLayer$1([baseLayer], "line.highlightTrend", trendLayer)
					};
				}),
				result: {
					widgetId: targetWidget.widgetId,
					trendType,
					overlay: "regression"
				},
				verificationHints: ["Call perception.inspectViewConfig to verify a regression trend layer was added to the line chart.", "Read the target widget view state to confirm the trend overlay uses the current x/y encoding fields."]
			};
		});
		if (!actionExecutor.has("line.showMovingAverage")) actionExecutor.register({ name: "line.showMovingAverage" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "line",
				message: "line.showMovingAverage requires a valid line target widget."
			});
			const windowSize = Number.isFinite(params.windowSize) ? Math.floor(Number(params.windowSize)) : 3;
			if (!targetWidget || windowSize < 1) throw new Error("line.showMovingAverage requires a valid line target widget and a windowSize >= 1.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for line moving-average overlays.");
					const rootEncoding = spec?.layer?.[0]?.encoding || spec?.encoding || {};
					const xField = rootEncoding?.x?.field || null;
					const yField = rootEncoding?.y?.field || null;
					const xType = rootEncoding?.x?.type || "temporal";
					if (!xField || !yField) throw new Error("line.showMovingAverage requires x and y encodings on the active line spec.");
					const colorEncoding = rootEncoding?.color && typeof rootEncoding.color === "object" ? structuredClone(rootEncoding.color) : null;
					const detailEncoding = rootEncoding?.detail && typeof rootEncoding.detail === "object" ? structuredClone(rootEncoding.detail) : null;
					const groupField = colorEncoding?.field || detailEncoding?.field || null;
					const maField = `${yField}_ma`;
					const maLayer = {
						_widgetvaTag: "line.showMovingAverage",
						mark: {
							type: "line",
							color: "orange",
							strokeWidth: 3,
							opacity: .8
						},
						transform: [{
							window: [{
								op: "mean",
								field: yField,
								as: maField
							}],
							frame: [-(windowSize - 1), 0],
							sort: [{
								field: xField,
								order: "ascending"
							}],
							...groupField ? { groupby: [groupField] } : {}
						}],
						encoding: {
							x: {
								field: xField,
								type: xType
							},
							y: {
								field: maField,
								type: "quantitative"
							},
							...colorEncoding ? { color: colorEncoding } : {},
							...!colorEncoding && detailEncoding ? { detail: detailEncoding } : {}
						}
					};
					if (Array.isArray(spec.layer) && spec.layer.length > 0) return {
						...spec,
						layer: replaceTaggedLayer$1(spec.layer, "line.showMovingAverage", maLayer)
					};
					const nextSpec = { ...spec };
					const baseLayer = {
						mark: spec.mark || "line",
						encoding: spec.encoding || {}
					};
					delete nextSpec.mark;
					delete nextSpec.encoding;
					return {
						...nextSpec,
						layer: replaceTaggedLayer$1([baseLayer], "line.showMovingAverage", maLayer)
					};
				}),
				result: {
					widgetId: targetWidget.widgetId,
					windowSize,
					overlay: "movingAverage"
				},
				verificationHints: ["Call perception.inspectViewConfig to verify a tagged moving-average overlay layer was added to the line chart.", "Read the target widget view state to confirm the overlay uses a window transform sorted by the current temporal axis."]
			};
		});
		if (!actionExecutor.has("line.drillDownXAxis")) actionExecutor.register({ name: "line.drillDownXAxis" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "line",
				message: "line.drillDownXAxis requires a valid line target widget."
			});
			const level = typeof params.level === "string" ? params.level.toLowerCase().trim() : null;
			const numericValue = Number.isFinite(params.value) ? Number(params.value) : null;
			const parent = params.parent && typeof params.parent === "object" && !Array.isArray(params.parent) ? params.parent : {};
			if (!targetWidget || !level || numericValue === null) throw new Error("line.drillDownXAxis requires a line target plus level and numeric value.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for line x-axis drill-down.");
					const drillState = spec._line_drilldown_state && typeof spec._line_drilldown_state === "object" ? { ...spec._line_drilldown_state } : {};
					if (!drillState.original_transform) {
						drillState.original_transform = Array.isArray(spec.transform) ? structuredClone(spec.transform) : [];
						drillState.original_encoding = structuredClone(spec.encoding || {});
						drillState.original_title = spec.title || "";
						const rootEncoding = inferLineRootEncoding(spec);
						drillState.raw_time_field = inferRawTimeField(spec, rootEncoding, drillState.original_transform);
						drillState.raw_value_field = inferRawValueField(spec, rootEncoding, drillState.original_transform);
						drillState.group_field = rootEncoding?.color?.field || null;
					}
					const rawDateField = drillState.raw_time_field;
					const rawValueField = drillState.raw_value_field;
					const groupField = drillState.group_field;
					if (!rawDateField || !rawValueField) throw new Error("line.drillDownXAxis requires x/y fields that can be resolved to raw date/value columns.");
					const nextTransforms = [];
					let nextEncoding;
					let nextParent = {};
					let titleSuffix = "";
					if (level === "year") {
						nextTransforms.push({
							filter: `year(datum.${rawDateField}) == ${numericValue}`,
							_widgetvaTag: "line.drillDownXAxis"
						});
						nextTransforms.push({
							timeUnit: "yearmonth",
							field: rawDateField,
							as: "month_date",
							_widgetvaTag: "line.drillDownXAxis"
						});
						nextTransforms.push({
							aggregate: [{
								op: "sum",
								field: rawValueField,
								as: "total_value"
							}],
							groupby: groupField ? ["month_date", groupField] : ["month_date"],
							_widgetvaTag: "line.drillDownXAxis"
						});
						nextParent = { year: numericValue };
						titleSuffix = `${numericValue} monthly trend`;
						nextEncoding = {
							x: {
								field: "month_date",
								type: "temporal",
								title: "Month",
								axis: { format: "%Y-%m" }
							},
							y: {
								field: "total_value",
								type: "quantitative",
								title: `Monthly total ${rawValueField}`
							},
							...groupField ? { color: drillState.original_encoding?.color || {
								field: groupField,
								type: "nominal"
							} } : {}
						};
					} else if (level === "month") {
						const yearValue = Number.isFinite(parent.year) ? Number(parent.year) : null;
						if (yearValue === null) throw new Error("line.drillDownXAxis month drill-down requires parent.year.");
						if (numericValue < 1 || numericValue > 12) throw new Error("line.drillDownXAxis month drill-down requires a month value between 1 and 12.");
						nextTransforms.push({
							filter: `year(datum.${rawDateField}) == ${yearValue} && month(datum.${rawDateField}) == ${numericValue - 1}`,
							_widgetvaTag: "line.drillDownXAxis"
						});
						nextTransforms.push({
							timeUnit: "yearmonthdate",
							field: rawDateField,
							as: "day_date",
							_widgetvaTag: "line.drillDownXAxis"
						});
						nextTransforms.push({
							aggregate: [{
								op: "sum",
								field: rawValueField,
								as: "total_value"
							}],
							groupby: groupField ? ["day_date", groupField] : ["day_date"],
							_widgetvaTag: "line.drillDownXAxis"
						});
						nextParent = {
							year: yearValue,
							month: numericValue
						};
						titleSuffix = `${yearValue}-${String(numericValue).padStart(2, "0")} daily trend`;
						nextEncoding = {
							x: {
								field: "day_date",
								type: "temporal",
								title: "Date",
								axis: { format: "%m-%d" }
							},
							y: {
								field: "total_value",
								type: "quantitative",
								title: `Daily total ${rawValueField}`
							},
							...groupField ? { color: drillState.original_encoding?.color || {
								field: groupField,
								type: "nominal"
							} } : {}
						};
					} else throw new Error(`line.drillDownXAxis does not support level "${level}".`);
					drillState.parent = nextParent;
					return {
						...spec,
						transform: nextTransforms,
						encoding: nextEncoding,
						title: titleSuffix,
						_line_drilldown_state: drillState
					};
				}),
				result: {
					widgetId: targetWidget.widgetId,
					level,
					value: numericValue,
					parent
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the line chart transform and x encoding now reflect the finer temporal drill-down.", "Read the target widget rows to confirm the line chart is now scoped to the drilled period."]
			};
		});
		if (!actionExecutor.has("line.resetDrilldownXAxis")) actionExecutor.register({ name: "line.resetDrilldownXAxis" }, async (call, ctx) => {
			call?.params;
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "line",
				message: "line.resetDrilldownXAxis requires a valid line target widget."
			});
			if (!targetWidget) throw new Error("line.resetDrilldownXAxis requires a valid line target widget.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for line drill-down reset.");
					const drillState = spec._line_drilldown_state;
					if (!drillState || typeof drillState !== "object") return spec;
					const nextSpec = { ...spec };
					if (Object.prototype.hasOwnProperty.call(drillState, "original_transform")) nextSpec.transform = Array.isArray(drillState.original_transform) ? structuredClone(drillState.original_transform) : [];
					else if (Array.isArray(nextSpec.transform)) nextSpec.transform = nextSpec.transform.filter((transform) => transform?._widgetvaTag !== "line.drillDownXAxis");
					if (drillState.original_encoding && typeof drillState.original_encoding === "object") nextSpec.encoding = structuredClone(drillState.original_encoding);
					if (Object.prototype.hasOwnProperty.call(drillState, "original_title")) nextSpec.title = drillState.original_title;
					delete nextSpec._line_drilldown_state;
					nextSpec._navigation_state = {
						mode: "reset",
						sourceAction: "line.resetDrilldownXAxis"
					};
					return nextSpec;
				}),
				result: {
					widgetId: targetWidget.widgetId,
					reset: true
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the original line x/y encoding and transforms were restored.", "Read the target widget view state to confirm the drill-down state marker has been removed."]
			};
		});
		if (!actionExecutor.has("line.resampleXAxis")) actionExecutor.register({ name: "line.resampleXAxis" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "line",
				message: "line.resampleXAxis requires a valid line target widget."
			});
			const granularity = typeof params.granularity === "string" ? params.granularity.toLowerCase().trim() : null;
			const agg = typeof params.agg === "string" ? params.agg.toLowerCase().trim() : "mean";
			const granularityMap = {
				day: "yearmonthdate",
				week: "yearweek",
				month: "yearmonth",
				quarter: "yearquarter",
				year: "year"
			};
			const allowedAgg = new Set([
				"mean",
				"sum",
				"max",
				"min",
				"median",
				"count"
			]);
			if (!targetWidget || !granularity || !granularityMap[granularity]) throw new Error("line.resampleXAxis requires a line target and a supported granularity: day, week, month, quarter, or year.");
			if (!allowedAgg.has(agg)) throw new Error("line.resampleXAxis requires a supported aggregation: mean, sum, max, min, median, or count.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for line x-axis resampling.");
					const nextSpec = { ...spec };
					const resampleState = nextSpec._resample_state && typeof nextSpec._resample_state === "object" ? { ...nextSpec._resample_state } : {};
					const rootEncoding = inferLineRootEncoding(nextSpec);
					const timeField = inferRawTimeField(nextSpec, rootEncoding, nextSpec.transform);
					if (!timeField) throw new Error("line.resampleXAxis requires a temporal field in the active line spec.");
					if (!resampleState.original_encoding) resampleState.original_encoding = structuredClone(rootEncoding);
					const applyEncodingUpdate = (encoding) => {
						const nextEncoding = structuredClone(encoding || {});
						const { timeAxis, valueAxis } = detectTemporalAxis(nextEncoding, timeField);
						if (!nextEncoding[timeAxis]) throw new Error("line.resampleXAxis requires a temporal axis encoding in the active line spec.");
						nextEncoding[timeAxis] = {
							...nextEncoding[timeAxis],
							timeUnit: granularityMap[granularity],
							type: "temporal"
						};
						if (nextEncoding[valueAxis]?.field) nextEncoding[valueAxis] = {
							...nextEncoding[valueAxis],
							aggregate: agg
						};
						return nextEncoding;
					};
					if (Array.isArray(nextSpec.layer) && nextSpec.layer.length > 0) nextSpec.layer = nextSpec.layer.map((layer, index) => {
						if (!layer?.encoding) return layer;
						if (index === 0 && !resampleState.original_encoding) resampleState.original_encoding = structuredClone(layer.encoding);
						return {
							...layer,
							encoding: applyEncodingUpdate(layer.encoding)
						};
					});
					else nextSpec.encoding = applyEncodingUpdate(nextSpec.encoding || {});
					resampleState.current_granularity = granularity;
					resampleState.current_agg = agg;
					nextSpec._resample_state = resampleState;
					return nextSpec;
				}),
				result: {
					widgetId: targetWidget.widgetId,
					granularity,
					agg
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the line chart time axis now uses the requested timeUnit.", "Read the target widget view state to confirm the value axis now carries the requested aggregation."]
			};
		});
		if (!actionExecutor.has("line.resetResampleXAxis")) actionExecutor.register({ name: "line.resetResampleXAxis" }, async (call, ctx) => {
			call?.params;
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "line",
				message: "line.resetResampleXAxis requires a valid line target widget."
			});
			if (!targetWidget) throw new Error("line.resetResampleXAxis requires a valid line target widget.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for line resample reset.");
					const resampleState = spec._resample_state;
					if (!resampleState || typeof resampleState !== "object") return spec;
					const nextSpec = { ...spec };
					const originalEncoding = resampleState.original_encoding;
					if (originalEncoding && typeof originalEncoding === "object") if (Array.isArray(nextSpec.layer) && nextSpec.layer.length > 0) nextSpec.layer = nextSpec.layer.map((layer, index) => {
						if (index !== 0 || !layer) return layer;
						return {
							...layer,
							encoding: structuredClone(originalEncoding)
						};
					});
					else nextSpec.encoding = structuredClone(originalEncoding);
					delete nextSpec._resample_state;
					nextSpec._navigation_state = {
						mode: "reset",
						sourceAction: "line.resetResampleXAxis"
					};
					return nextSpec;
				}),
				result: {
					widgetId: targetWidget.widgetId,
					reset: true
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the original line temporal encoding was restored.", "Read the target widget view state to confirm the resample state marker has been removed."]
			};
		});
		if (!actionExecutor.has("line.boldLines")) actionExecutor.register({ name: "line.boldLines" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "line",
				message: "line.boldLines requires a valid line target widget."
			});
			const lineNames = Array.isArray(params.lineNames) ? params.lineNames.filter((value) => typeof value === "string" && value.length > 0) : [];
			const boldWidth = typeof params.boldWidth === "number" ? params.boldWidth : 4;
			const baseWidth = typeof params.baseWidth === "number" ? params.baseWidth : 1;
			if (!targetWidget || lineNames.length === 0) throw new Error("line.boldLines requires a line target and at least one line identifier.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for line bolding updates.");
					const rootEncoding = spec?.layer?.[0]?.encoding || spec?.encoding || {};
					const lineField = typeof params.lineField === "string" ? params.lineField : rootEncoding?.color?.field || rootEncoding?.detail?.field || null;
					if (!lineField) throw new Error("line.boldLines requires a lineField or an existing color/detail grouping field on the active line spec.");
					const strokeWidth = {
						condition: {
							test: `indexof(${JSON.stringify(lineNames)}, datum['${lineField}']) >= 0`,
							value: boldWidth
						},
						value: baseWidth
					};
					if (Array.isArray(spec.layer) && spec.layer.length > 0) return {
						...spec,
						layer: spec.layer.map((layer) => {
							const mark = layer?.mark;
							if ((typeof mark === "string" ? mark : mark?.type) !== "line") return layer;
							return {
								...layer,
								encoding: {
									...layer?.encoding || {},
									strokeWidth
								}
							};
						})
					};
					return {
						...spec,
						encoding: {
							...spec.encoding || {},
							strokeWidth
						}
					};
				}),
				result: {
					widgetId: targetWidget.widgetId,
					lineNames,
					lineField: params.lineField || null,
					boldWidth,
					baseWidth
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the line chart strokeWidth condition now emphasizes the requested series.", "Read the target widget view state to confirm the requested line series are rendered with a thicker stroke."]
			};
		});
		if (!actionExecutor.has("line.filterLines")) actionExecutor.register({ name: "line.filterLines" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "line",
				message: "line.filterLines requires a valid line target widget."
			});
			const linesToRemove = Array.isArray(params.linesToRemove) ? params.linesToRemove.filter((value) => typeof value === "string" && value.length > 0) : [];
			if (!targetWidget || linesToRemove.length === 0) throw new Error("line.filterLines requires a line target and one or more line names to remove.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for line series filtering.");
					const rootEncoding = spec?.layer?.[0]?.encoding || spec?.encoding || {};
					const lineField = typeof params.lineField === "string" ? params.lineField : rootEncoding?.color?.field || rootEncoding?.detail?.field || null;
					if (!lineField) throw new Error("line.filterLines requires a line grouping field on the active line spec.");
					return {
						...spec,
						transform: replaceTaggedTransform(spec.transform, "line.filterLines", {
							filter: {
								field: lineField,
								notOneOf: linesToRemove
							},
							_widgetvaTag: "line.filterLines"
						})
					};
				}),
				result: {
					widgetId: targetWidget.widgetId,
					linesToRemove,
					...typeof params.lineField === "string" ? { lineField: params.lineField } : {}
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the line chart transform now excludes the requested line series.", "Read the target widget rows to confirm the removed series no longer appear in the visible line data."]
			};
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/widgets/line/perception.js
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
	//#region ../../widgetva-kit/src/adapters/widgets/line/humanInteraction.js
	function getLineHumanInteractionConfig() {
		return {
			mode: "categoryClick",
			actionName: "line.selectSeries",
			categoryFieldChannel: "color",
			supportsDirectManipulation: true
		};
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgets/line/state.js
	async function applyLineState(args) {
		return applyVegaLiteRuntimeState(args);
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgetFamilies/lineWidgetAdapter.js
	var lineWidgetAdapter = createVegaLiteWidgetAdapter({
		kind: "line",
		async applyState(args) {
			return applyLineState(args);
		},
		buildActionDescriptors(args) {
			return buildLineActionDescriptors(args);
		},
		buildPerceptionDescriptors(args) {
			return buildLinePerceptionDescriptors(args);
		},
		getHumanInteractionConfig() {
			return getLineHumanInteractionConfig();
		},
		registerActions(actionExecutor) {
			return registerLineActions(actionExecutor);
		},
		registerPerceptionQueries(perceptionRegistry) {
			return registerLinePerceptionQueries(perceptionRegistry);
		}
	});
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgets/map/actions.js
	function buildMapActionDescriptors({ widgetRef, selectionRef, scope = "local", affectedRefs = [widgetRef] }) {
		return [makeActionDescriptor({
			name: "map.selectRegion",
			title: "Select map regions",
			description: "Select one or more geographic regions represented in the current map view.",
			primitive: "select",
			category: "selection",
			scope,
			supportedWidgetKinds: ["map"],
			targetRef: selectionRef || widgetRef,
			affectedRefs,
			affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "selections" : "feedback"),
			paramsSchema: {
				type: "object",
				properties: {
					field: { type: "string" },
					values: {
						type: "array",
						items: {},
						minItems: 1
					}
				},
				required: ["field", "values"]
			},
			postconditions: [{ description: "The active selection should contain the requested geographic region values." }],
			preconditions: [{
				description: "The requested targetRef resolves to a valid map widget in the current workspace.",
				failureMessage: "map.selectRegion requires a valid map target widget."
			}],
			effects: [makeSelectionEffect(selectionRef || widgetRef, "Creates or updates a categorical selection over map regions."), ...affectedRefs.filter((ref) => ref !== widgetRef).map((ref) => makeHighlightEffect(ref, "Linked widgets may highlight or filter the selected regions."))],
			examples: [{
				userGoal: "Focus one or more regions before comparing downstream statistics.",
				params: {
					field: "State",
					values: ["California", "Texas"]
				}
			}],
			reversible: true
		})];
	}
	function registerMapActions(actionExecutor) {
		if (actionExecutor.has("map.selectRegion")) return;
		actionExecutor.register({ name: "map.selectRegion" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "map"
			});
			const field = typeof params.field === "string" ? params.field : null;
			const values = Array.isArray(params.values) ? params.values.filter((value) => value != null) : [];
			if (!targetWidget || !field || values.length === 0) throw new Error("map.selectRegion requires a map target, field, and one or more values.");
			const { rows: visibleRows } = ctx.readRowsForWidget(targetWidget.ref);
			const matchedCount = visibleRows.filter((row) => values.includes(row?.[field])).length;
			return buildSelectionActionResult({
				ctx,
				nextState: ctx.commitSelection({
					selection_id: `sel_${Date.now()}`,
					source_widget_id: targetWidget.widgetId || void 0,
					selection_type: "category",
					field,
					values,
					predicates: [{
						field,
						op: "in",
						value: values
					}],
					count: matchedCount,
					summary: `${field}: ${values.join(", ")}`
				}),
				selectedCount: matchedCount,
				verificationHints: ["Read the updated map selection state.", "Read linked widgets or visible rows to confirm region-level propagation."]
			});
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgets/map/humanInteraction.js
	function getMapHumanInteractionConfig() {
		return {
			mode: "categoryClick",
			actionName: "map.selectRegion",
			categoryFieldChannel: "color",
			supportsDirectManipulation: true
		};
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgets/map/perception.js
	function buildMapPerceptionDescriptors({ dataRef }) {
		return [makePerceptionDescriptor({
			name: "perception.compareGroups",
			title: "Compare groups",
			description: "Compare visible geographic groups in the current map view.",
			category: "compute",
			targetRef: dataRef,
			paramsSchema: {
				type: "object",
				properties: {
					groupField: { type: "string" },
					valueField: { type: "string" },
					groups: {
						type: "array",
						items: { type: "string" }
					},
					dataRef: { type: "string" }
				}
			},
			sideEffectFree: true,
			evidenceKinds: ["groupComparison", "geographicEvidence"],
			examples: [{
				userGoal: "Compare a few visible regions geographically.",
				params: {
					groupField: "State",
					valueField: "Population",
					groups: ["California", "Texas"]
				}
			}]
		})];
	}
	function registerMapPerceptionQueries(perceptionRegistry) {
		if (!perceptionRegistry.has("perception.compareGroups", { supportedWidgetKinds: ["map"] })) perceptionRegistry.register({
			name: "perception.compareGroups",
			supportedWidgetKinds: ["map"]
		}, async (call, ctx) => {
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "map"
			});
			const comparison = runDataPerceptionQuery({
				ctx,
				dataQueryExecutor: perceptionRegistry.dataQueryExecutor,
				targetWidget,
				kind: "compareGroups",
				spec: call?.params || {}
			});
			ctx.recordQuery({ affectedRefs: [targetWidget.ref] });
			return { result: buildPerceptionDataResult({
				dataQueryResult: comparison,
				fallbackDataRef: ctx.resolveRowsForWidget(targetWidget, call?.params || {}).dataRef
			}) };
		}, { supportedWidgetKinds: ["map"] });
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgets/map/state.js
	async function applyMapState(args) {
		return applyVegaLiteRuntimeState(args);
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgetFamilies/mapWidgetAdapter.js
	var mapWidgetAdapter = createVegaLiteWidgetAdapter({
		kind: "map",
		async applyState(args) {
			return applyMapState(args);
		},
		buildActionDescriptors(args) {
			return buildMapActionDescriptors(args);
		},
		buildPerceptionDescriptors(args) {
			return buildMapPerceptionDescriptors(args);
		},
		getHumanInteractionConfig() {
			return getMapHumanInteractionConfig();
		},
		registerActions(actionExecutor) {
			return registerMapActions(actionExecutor);
		},
		registerPerceptionQueries(perceptionRegistry) {
			return registerMapPerceptionQueries(perceptionRegistry);
		}
	});
	//#endregion
	//#region ../../widgetva-kit/src/widgets/parallelCoordinates/actions.js
	function cloneValue$16(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function updateParallelXOrder(node, dimensionOrder) {
		if (!node || typeof node !== "object") return;
		if (Array.isArray(node)) {
			for (const entry of node) updateParallelXOrder(entry, dimensionOrder);
			return;
		}
		if (node.encoding && typeof node.encoding === "object") {
			const xEncoding = node.encoding.x;
			if (xEncoding && typeof xEncoding === "object" && [
				"dimension",
				"key",
				"variable"
			].includes(xEncoding.field)) node.encoding.x = {
				...xEncoding,
				sort: dimensionOrder,
				scale: {
					...xEncoding.scale || {},
					domain: dimensionOrder
				}
			};
		}
		for (const value of Object.values(node)) updateParallelXOrder(value, dimensionOrder);
	}
	function buildParallelCoordinatesActionDescriptors({ widgetRef, selectionRef, scope = "local", affectedRefs = [widgetRef] }) {
		const supportedWidgetKinds = ["parallelCoordinates"];
		return [
			makeActionDescriptor({
				name: "parallelCoordinates.brushAxes",
				title: "Brush parallel coordinate axes",
				description: "Select rows whose values fall inside one or more axis-aligned numeric ranges.",
				primitive: "select",
				category: "selection",
				scope,
				supportedWidgetKinds,
				targetRef: selectionRef || widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "selections" : "transforms"),
				paramsSchema: {
					type: "object",
					properties: { rules: {
						type: "array",
						minItems: 1,
						items: {
							type: "object",
							properties: {
								field: { type: "string" },
								range: {
									type: "array",
									items: { type: "number" },
									minItems: 2,
									maxItems: 2
								}
							},
							required: ["field", "range"]
						}
					} },
					required: ["rules"]
				},
				postconditions: [{ description: "The active selection should contain interval predicates for the requested axes." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid parallel coordinates widget in the current workspace.",
					failureMessage: "parallelCoordinates.brushAxes requires a valid parallel coordinates target widget."
				}],
				effects: [makeSelectionEffect(selectionRef || widgetRef, "Creates or updates a multivariate interval selection over parallel axes."), ...affectedRefs.filter((ref) => ref !== widgetRef).map((ref) => makeFilterEffect(ref, "Linked widgets may be filtered by the brushed multivariate range."))],
				examples: [{
					userGoal: "Restrict analysis to a multivariate value corridor.",
					params: { rules: [{
						field: "Horsepower",
						range: [80, 160]
					}, {
						field: "Weight_in_lbs",
						range: [1800, 3200]
					}] }
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "parallelCoordinates.selectRecord",
				title: "Select one parallel-coordinate record",
				description: "Select one visible record by id so linked views can focus or compare that record without needing a brush gesture.",
				primitive: "select",
				category: "selection",
				scope,
				supportedWidgetKinds,
				targetRef: selectionRef || widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "selections" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						recordId: { anyOf: [{ type: "string" }, { type: "number" }] },
						field: { type: "string" }
					},
					required: ["recordId"]
				},
				postconditions: [{ description: "The active selection should contain one equality predicate targeting the selected record id." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid parallel coordinates widget in the current workspace.",
					failureMessage: "parallelCoordinates.selectRecord requires a valid parallel coordinates target widget."
				}],
				effects: [makeSelectionEffect(selectionRef || widgetRef, "Creates or updates a record-level selection anchored to one parallel-coordinates row."), ...affectedRefs.filter((ref) => ref !== widgetRef).map((ref) => makeFilterEffect(ref, "Linked widgets may update to the selected record detail."))],
				examples: [{
					userGoal: "Select one car record in the parallel view before checking the same car across other linked views.",
					params: {
						field: "id",
						recordId: "toyota-corona-mark-ii"
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "parallelCoordinates.reorderDimensions",
				title: "Reorder parallel-coordinate dimensions",
				description: "Reorder the visible dimension axes of a parallel coordinates view by rewriting the fold order and matching x-axis domain metadata.",
				primitive: "reencode",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: { dimensionOrder: {
						type: "array",
						minItems: 1,
						items: { type: "string" }
					} },
					required: ["dimensionOrder"]
				},
				postconditions: [{ description: "The fold transform and any matching parallel-coordinate x-axis scale domain metadata should reflect the requested dimension order." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid parallel coordinates widget in the current workspace.",
					failureMessage: "parallelCoordinates.reorderDimensions requires a valid parallel coordinates target widget."
				}],
				examples: [{
					userGoal: "Move the most important dimensions to the front before comparing multivariate trends.",
					params: { dimensionOrder: [
						"Weight",
						"Horsepower",
						"Miles_per_Gallon"
					] }
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "parallelCoordinates.filterDimension",
				title: "Filter a parallel-coordinate dimension",
				description: "Filter rows by a numeric range on one named dimension, inserting the predicate before the fold stage when the view is defined in wide format.",
				primitive: "filter",
				category: "dataTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "transforms" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						dimension: { type: "string" },
						range: {
							type: "array",
							minItems: 2,
							maxItems: 2,
							items: { type: "number" }
						}
					},
					required: ["dimension", "range"]
				},
				postconditions: [{ description: "The transform list should contain a numeric range predicate for the requested dimension, inserted ahead of the fold transform when present." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid parallel coordinates widget in the current workspace.",
					failureMessage: "parallelCoordinates.filterDimension requires a valid parallel coordinates target widget."
				}],
				examples: [{
					userGoal: "Keep only rows whose horsepower falls inside a specific corridor before comparing the remaining multivariate trajectories.",
					params: {
						dimension: "Horsepower",
						range: [80, 160]
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "parallelCoordinates.filterByCategory",
				title: "Filter a parallel-coordinate category field",
				description: "Exclude rows whose category field matches one or more requested values, inserting the predicate before the fold stage when the view is defined in wide format.",
				primitive: "filter",
				category: "dataTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "transforms" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						field: { type: "string" },
						values: { oneOf: [{ type: "string" }, {
							type: "array",
							minItems: 1,
							items: { type: "string" }
						}] }
					},
					required: ["field", "values"]
				},
				postconditions: [{ description: "The transform list should contain a categorical exclusion predicate for the requested field, inserted ahead of the fold transform when present." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid parallel coordinates widget in the current workspace.",
					failureMessage: "parallelCoordinates.filterByCategory requires a valid parallel coordinates target widget."
				}],
				examples: [{
					userGoal: "Exclude one or more categories before comparing the remaining multivariate trajectories.",
					params: {
						field: "Origin",
						values: ["USA", "Japan"]
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "parallelCoordinates.highlightCategory",
				title: "Highlight a parallel-coordinate category field",
				description: "Visually emphasize one or more category values by keeping matching trajectories fully opaque and dimming the rest.",
				primitive: "highlight",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						field: { type: "string" },
						values: { oneOf: [{ type: "string" }, {
							type: "array",
							minItems: 1,
							items: { type: "string" }
						}] }
					},
					required: ["field", "values"]
				},
				postconditions: [{ description: "The target line encoding should contain an opacity condition that keeps matching categories opaque and dims the rest." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid parallel coordinates widget in the current workspace.",
					failureMessage: "parallelCoordinates.highlightCategory requires a valid parallel coordinates target widget."
				}],
				examples: [{
					userGoal: "Highlight a few categories before comparing their multivariate trajectories against the background population.",
					params: {
						field: "Origin",
						values: ["USA", "Japan"]
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "parallelCoordinates.hideDimensions",
				title: "Hide or restore parallel-coordinate dimensions",
				description: "Temporarily hide one or more dimensions from a parallel coordinates view while preserving the original full dimension order for later restoration.",
				primitive: "reencode",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						dimensions: {
							type: "array",
							minItems: 1,
							items: { type: "string" }
						},
						mode: {
							type: "string",
							enum: ["hide", "show"]
						}
					},
					required: ["dimensions"]
				},
				postconditions: [{ description: "The fold order and matching x-axis domain metadata should exclude hidden dimensions and preserve the original full dimension list in widget state." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid parallel coordinates widget in the current workspace.",
					failureMessage: "parallelCoordinates.hideDimensions requires a valid parallel coordinates target widget."
				}],
				examples: [{
					userGoal: "Temporarily hide weight from a crowded parallel-coordinates view.",
					params: { dimensions: ["Weight"] }
				}, {
					userGoal: "Restore one previously hidden dimension without resetting the full view.",
					params: {
						dimensions: ["Weight"],
						mode: "show"
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "parallelCoordinates.resetHiddenDimensions",
				title: "Reset hidden parallel-coordinate dimensions",
				description: "Restore the full original dimension order after one or more dimensions have been hidden from a parallel coordinates view.",
				primitive: "reencode",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {}
				},
				postconditions: [{ description: "The full dimension list should be restored to the fold transform and matching x-axis domain metadata, and hidden-dimension widget state should be cleared." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid parallel coordinates widget in the current workspace.",
					failureMessage: "parallelCoordinates.resetHiddenDimensions requires a valid parallel coordinates target widget."
				}],
				examples: [{
					userGoal: "Restore every temporarily hidden dimension after a focused inspection pass.",
					params: {}
				}],
				reversible: true
			})
		];
	}
	function registerParallelCoordinatesActions(actionExecutor) {
		if (!actionExecutor.has("parallelCoordinates.brushAxes")) actionExecutor.register({ name: "parallelCoordinates.brushAxes" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "parallelCoordinates"
			});
			const rules = Array.isArray(params.rules) ? params.rules.filter((rule) => typeof rule?.field === "string" && Array.isArray(rule?.range) && rule.range.length === 2) : [];
			if (!targetWidget || rules.length === 0) throw new Error("parallelCoordinates.brushAxes requires a parallel coordinates target and at least one valid rule.");
			const { rows } = ctx.readRowsForWidget(targetWidget.ref);
			const normalizedRules = rules.map((rule) => ({
				field: rule.field,
				range: [Math.min(...rule.range), Math.max(...rule.range)]
			}));
			const filtered = rows.filter((row) => normalizedRules.every((rule) => {
				const value = row?.[rule.field];
				return typeof value === "number" && value >= rule.range[0] && value <= rule.range[1];
			}));
			return buildSelectionActionResult({
				ctx,
				nextState: ctx.commitSelection({
					selection_id: `sel_${Date.now()}`,
					source_widget_id: targetWidget.widgetId || void 0,
					selection_type: "interval",
					fields: normalizedRules.map((rule) => rule.field),
					value: Object.fromEntries(normalizedRules.map((rule) => [rule.field, rule.range])),
					predicates: normalizedRules.map((rule) => ({
						field: rule.field,
						op: "between",
						value: rule.range
					})),
					count: filtered.length,
					summary: normalizedRules.map((rule) => `${rule.field} ${rule.range[0]}~${rule.range[1]}`).join("; ")
				}),
				selectedCount: filtered.length,
				verificationHints: ["Read the updated parallel coordinates selection state.", "Read linked widgets to confirm multivariate range propagation."]
			});
		});
		if (!actionExecutor.has("parallelCoordinates.reorderDimensions")) actionExecutor.register({ name: "parallelCoordinates.reorderDimensions" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "parallelCoordinates",
				message: "parallelCoordinates.reorderDimensions requires a valid parallel coordinates target widget."
			});
			const dimensionOrder = Array.isArray(params.dimensionOrder) ? params.dimensionOrder.filter((dimension) => typeof dimension === "string" && dimension.trim().length > 0) : [];
			if (!targetWidget || dimensionOrder.length === 0) throw new Error("parallelCoordinates.reorderDimensions requires a parallel coordinates target and a non-empty dimensionOrder.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for parallel-dimension reordering.");
					const nextSpec = cloneValue$16(spec);
					const transforms = Array.isArray(nextSpec.transform) ? nextSpec.transform : [];
					const foldIndex = transforms.findIndex((transform) => transform && typeof transform === "object" && Array.isArray(transform.fold));
					if (foldIndex >= 0) {
						const currentFold = transforms[foldIndex].fold;
						const missing = dimensionOrder.filter((dimension) => !currentFold.includes(dimension));
						const extra = currentFold.filter((dimension) => !dimensionOrder.includes(dimension));
						if (missing.length > 0 || extra.length > 0) throw new Error("parallelCoordinates.reorderDimensions must provide a complete permutation of the current fold dimensions.");
						nextSpec.transform[foldIndex] = {
							...transforms[foldIndex],
							fold: dimensionOrder
						};
					}
					updateParallelXOrder(nextSpec, dimensionOrder);
					return nextSpec;
				}),
				result: {
					widgetId: targetWidget.widgetId,
					dimensionOrder
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the fold order and x-axis domain now match the requested dimension ordering.", "Read the target widget view state to confirm the visible parallel-axis order was updated without changing the underlying data rows."]
			};
		});
		if (!actionExecutor.has("parallelCoordinates.selectRecord")) actionExecutor.register({ name: "parallelCoordinates.selectRecord" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "parallelCoordinates",
				message: "parallelCoordinates.selectRecord requires a valid parallel coordinates target widget."
			});
			const recordId = params.recordId;
			const field = typeof params.field === "string" && params.field.length > 0 ? params.field : "id";
			if (!targetWidget || recordId == null) throw new Error("parallelCoordinates.selectRecord requires a parallel coordinates target and a recordId.");
			const { rows } = ctx.readRowsForWidget(targetWidget.ref);
			const matchedRows = rows.filter((row) => row?.[field] === recordId);
			const summary = matchedRows[0]?.name ? `Record: ${matchedRows[0].name}` : `${field}: ${recordId}`;
			return buildSelectionActionResult({
				ctx,
				nextState: ctx.commitSelection({
					selection_id: `sel_${Date.now()}`,
					source_widget_id: targetWidget.widgetId || void 0,
					selection_type: "category",
					field,
					values: [recordId],
					predicates: [{
						field,
						op: "equals",
						value: recordId
					}],
					count: matchedRows.length,
					summary
				}),
				selectedCount: matchedRows.length,
				verificationHints: ["Read the updated parallel-coordinates selection state.", "Read linked widgets to confirm the selected record became the current focus subset."]
			});
		});
		if (!actionExecutor.has("parallelCoordinates.filterDimension")) actionExecutor.register({ name: "parallelCoordinates.filterDimension" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "parallelCoordinates",
				message: "parallelCoordinates.filterDimension requires a valid parallel coordinates target widget."
			});
			const dimension = typeof params.dimension === "string" && params.dimension.trim().length > 0 ? params.dimension : null;
			const range = Array.isArray(params.range) && params.range.length === 2 ? params.range : null;
			if (!targetWidget || !dimension || !range || !range.every((value) => typeof value === "number" && Number.isFinite(value))) throw new Error("parallelCoordinates.filterDimension requires a parallel coordinates target, a dimension, and a two-number range.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for parallel-dimension filtering.");
					const nextSpec = cloneValue$16(spec);
					const transforms = Array.isArray(nextSpec.transform) ? [...nextSpec.transform] : [];
					const foldIndex = transforms.findIndex((transform) => transform && typeof transform === "object" && Array.isArray(transform.fold));
					const [minValue, maxValue] = [Math.min(...range), Math.max(...range)];
					const filterTransform = {
						filter: {
							field: dimension,
							range: [minValue, maxValue]
						},
						_widgetvaTag: "parallelCoordinates.filterDimension"
					};
					const nextTransforms = transforms.filter((transform) => transform?._widgetvaTag !== "parallelCoordinates.filterDimension");
					if (foldIndex >= 0) nextTransforms.splice(foldIndex, 0, filterTransform);
					else nextTransforms.unshift(filterTransform);
					nextSpec.transform = nextTransforms;
					return nextSpec;
				}),
				result: {
					widgetId: targetWidget.widgetId,
					dimension,
					range: [Math.min(...range), Math.max(...range)]
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the transform list now includes the requested numeric range filter ahead of the fold stage.", "Read the target widget rows to confirm only trajectories inside the requested dimension corridor remain visible."]
			};
		});
		if (!actionExecutor.has("parallelCoordinates.filterByCategory")) actionExecutor.register({ name: "parallelCoordinates.filterByCategory" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "parallelCoordinates",
				message: "parallelCoordinates.filterByCategory requires a valid parallel coordinates target widget."
			});
			const field = typeof params.field === "string" && params.field.trim().length > 0 ? params.field : null;
			const values = Array.isArray(params.values) ? params.values.filter((value) => typeof value === "string" && value.length > 0) : typeof params.values === "string" && params.values.length > 0 ? [params.values] : [];
			if (!targetWidget || !field || values.length === 0) throw new Error("parallelCoordinates.filterByCategory requires a parallel coordinates target, a field, and one or more category values.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for parallel-category filtering.");
					const nextSpec = cloneValue$16(spec);
					const transforms = Array.isArray(nextSpec.transform) ? [...nextSpec.transform] : [];
					const foldIndex = transforms.findIndex((transform) => transform && typeof transform === "object" && Array.isArray(transform.fold));
					const filterTransform = {
						filter: {
							field,
							notOneOf: [...values]
						},
						_widgetvaTag: "parallelCoordinates.filterByCategory"
					};
					const nextTransforms = transforms.filter((transform) => transform?._widgetvaTag !== "parallelCoordinates.filterByCategory");
					if (foldIndex >= 0) nextTransforms.splice(foldIndex, 0, filterTransform);
					else nextTransforms.unshift(filterTransform);
					nextSpec.transform = nextTransforms;
					return nextSpec;
				}),
				result: {
					widgetId: targetWidget.widgetId,
					field,
					values
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the transform list now includes the requested categorical exclusion filter ahead of the fold stage.", "Read the target widget rows to confirm trajectories belonging to the excluded categories no longer remain visible."]
			};
		});
		if (!actionExecutor.has("parallelCoordinates.highlightCategory")) actionExecutor.register({ name: "parallelCoordinates.highlightCategory" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "parallelCoordinates",
				message: "parallelCoordinates.highlightCategory requires a valid parallel coordinates target widget."
			});
			const field = typeof params.field === "string" && params.field.trim().length > 0 ? params.field : null;
			const values = Array.isArray(params.values) ? params.values.filter((value) => typeof value === "string" && value.length > 0) : typeof params.values === "string" && params.values.length > 0 ? [params.values] : [];
			if (!targetWidget || !field || values.length === 0) throw new Error("parallelCoordinates.highlightCategory requires a parallel coordinates target, a field, and one or more category values.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for parallel-category highlighting.");
					const nextSpec = cloneValue$16(spec);
					const opacityEncoding = {
						condition: {
							test: `indexof([${values.map((value) => JSON.stringify(value)).join(",")}], datum['${field}']) >= 0`,
							value: 1
						},
						value: .1
					};
					const lineLayer = Array.isArray(nextSpec.layer) ? nextSpec.layer.find((layer) => {
						const mark = layer?.mark;
						return mark === "line" || mark && typeof mark === "object" && mark.type === "line";
					}) : null;
					if (lineLayer && typeof lineLayer === "object") lineLayer.encoding = {
						...lineLayer.encoding || {},
						opacity: opacityEncoding
					};
					else nextSpec.encoding = {
						...nextSpec.encoding || {},
						opacity: opacityEncoding
					};
					return nextSpec;
				}),
				result: {
					widgetId: targetWidget.widgetId,
					field,
					values
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the line encoding now contains an opacity condition for the requested category values.", "Read the target widget view state to confirm matching categories remain visually prominent while other trajectories are dimmed."]
			};
		});
		if (!actionExecutor.has("parallelCoordinates.hideDimensions")) actionExecutor.register({ name: "parallelCoordinates.hideDimensions" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "parallelCoordinates",
				message: "parallelCoordinates.hideDimensions requires a valid parallel coordinates target widget."
			});
			const dimensions = Array.isArray(params.dimensions) ? params.dimensions.filter((dimension) => typeof dimension === "string" && dimension.trim().length > 0) : [];
			const mode = params.mode === "show" ? "show" : "hide";
			if (!targetWidget || dimensions.length === 0) throw new Error("parallelCoordinates.hideDimensions requires a parallel coordinates target and at least one dimension.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for hiding parallel-coordinate dimensions.");
					const nextSpec = cloneValue$16(spec);
					const transforms = Array.isArray(nextSpec.transform) ? nextSpec.transform : [];
					const foldIndex = transforms.findIndex((transform) => transform && typeof transform === "object" && Array.isArray(transform.fold));
					const storedState = nextSpec._pc_hidden_state && typeof nextSpec._pc_hidden_state === "object" ? nextSpec._pc_hidden_state : {};
					const allDimensions = Array.isArray(storedState.all_dimensions) && storedState.all_dimensions.length > 0 ? [...storedState.all_dimensions] : foldIndex >= 0 ? [...transforms[foldIndex].fold] : [];
					if (allDimensions.length === 0) throw new Error("parallelCoordinates.hideDimensions could not determine the full dimension list for the current view.");
					const hiddenSet = new Set(Array.isArray(storedState.hidden) ? storedState.hidden : []);
					for (const dimension of dimensions) {
						if (!allDimensions.includes(dimension)) throw new Error(`parallelCoordinates.hideDimensions cannot find dimension "${dimension}" in the current view.`);
						if (mode === "hide") hiddenSet.add(dimension);
						else hiddenSet.delete(dimension);
					}
					const visibleDimensions = allDimensions.filter((dimension) => !hiddenSet.has(dimension));
					if (visibleDimensions.length === 0) throw new Error("parallelCoordinates.hideDimensions must leave at least one visible dimension.");
					if (foldIndex >= 0) nextSpec.transform[foldIndex] = {
						...transforms[foldIndex],
						fold: visibleDimensions
					};
					updateParallelXOrder(nextSpec, visibleDimensions);
					nextSpec._pc_hidden_state = {
						hidden: allDimensions.filter((dimension) => hiddenSet.has(dimension)),
						all_dimensions: allDimensions
					};
					nextSpec._pc_reencode_state = {
						mode: "dimensionVisibility",
						sourceAction: "parallelCoordinates.hideDimensions",
						operation: mode,
						hidden_dimensions: allDimensions.filter((dimension) => hiddenSet.has(dimension)),
						visible_dimensions: visibleDimensions
					};
					return nextSpec;
				}),
				result: {
					widgetId: targetWidget.widgetId,
					dimensions,
					mode
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the visible fold order and x-axis domain no longer include the hidden dimensions.", "Read the target widget view state to confirm the original full dimension list remains stored for later restoration."]
			};
		});
		if (!actionExecutor.has("parallelCoordinates.resetHiddenDimensions")) actionExecutor.register({ name: "parallelCoordinates.resetHiddenDimensions" }, async (call, ctx) => {
			call?.params;
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "parallelCoordinates",
				message: "parallelCoordinates.resetHiddenDimensions requires a valid parallel coordinates target widget."
			});
			if (!targetWidget) throw new Error("parallelCoordinates.resetHiddenDimensions requires a valid parallel coordinates target widget.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for resetting hidden parallel-coordinate dimensions.");
					const nextSpec = cloneValue$16(spec);
					const hiddenState = nextSpec._pc_hidden_state && typeof nextSpec._pc_hidden_state === "object" ? nextSpec._pc_hidden_state : null;
					const allDimensions = Array.isArray(hiddenState?.all_dimensions) ? hiddenState.all_dimensions : [];
					if (allDimensions.length === 0) return nextSpec;
					const transforms = Array.isArray(nextSpec.transform) ? nextSpec.transform : [];
					const foldIndex = transforms.findIndex((transform) => transform && typeof transform === "object" && Array.isArray(transform.fold));
					if (foldIndex >= 0) nextSpec.transform[foldIndex] = {
						...transforms[foldIndex],
						fold: [...allDimensions]
					};
					updateParallelXOrder(nextSpec, [...allDimensions]);
					nextSpec._pc_reencode_state = {
						mode: "dimensionVisibility",
						sourceAction: "parallelCoordinates.resetHiddenDimensions",
						operation: "reset",
						hidden_dimensions: [],
						visible_dimensions: [...allDimensions]
					};
					delete nextSpec._pc_hidden_state;
					return nextSpec;
				}),
				result: { widgetId: targetWidget.widgetId },
				verificationHints: ["Call perception.inspectViewConfig to verify the full original dimension order has been restored on the fold transform and x-axis domain metadata.", "Read the target widget view state to confirm the hidden-dimension bookkeeping state has been cleared."]
			};
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/widgets/parallelCoordinates/perception.js
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
	//#region ../../widgetva-kit/src/adapters/widgets/parallelCoordinates/humanInteraction.js
	function getParallelCoordinatesHumanInteractionConfig() {
		return {
			mode: "multiBrush",
			actionName: "parallelCoordinates.brushAxes",
			supportsDirectManipulation: true
		};
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgets/parallelCoordinates/state.js
	async function applyParallelCoordinatesState(args) {
		return applyVegaLiteRuntimeState(args);
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgetFamilies/parallelCoordinatesWidgetAdapter.js
	var parallelCoordinatesWidgetAdapter = createVegaLiteWidgetAdapter({
		kind: "parallelCoordinates",
		async applyState(args) {
			return applyParallelCoordinatesState(args);
		},
		buildActionDescriptors(args) {
			return buildParallelCoordinatesActionDescriptors(args);
		},
		buildPerceptionDescriptors(args) {
			return buildParallelCoordinatesPerceptionDescriptors(args);
		},
		getHumanInteractionConfig() {
			return getParallelCoordinatesHumanInteractionConfig();
		},
		registerActions(actionExecutor) {
			return registerParallelCoordinatesActions(actionExecutor);
		},
		registerPerceptionQueries(perceptionRegistry) {
			return registerParallelCoordinatesPerceptionQueries(perceptionRegistry);
		}
	});
	//#endregion
	//#region ../../widgetva-kit/src/widgets/scatter/actions.js
	function replaceTaggedLayer(layers, tag, nextLayer) {
		const nextLayers = (Array.isArray(layers) ? layers : []).filter((layer) => layer?._widgetvaTag !== tag);
		return nextLayer ? [...nextLayers, nextLayer] : nextLayers;
	}
	function euclideanDistanceSquared(a, b) {
		const dx = a[0] - b[0];
		const dy = a[1] - b[1];
		return dx * dx + dy * dy;
	}
	function assignPointsToCenters(points, centers) {
		return points.map((point) => {
			let bestIndex = 0;
			let bestDistance = Number.POSITIVE_INFINITY;
			centers.forEach((center, index) => {
				const distance = euclideanDistanceSquared(point, center);
				if (distance < bestDistance) {
					bestDistance = distance;
					bestIndex = index;
				}
			});
			return bestIndex;
		});
	}
	function recomputeCenters(points, labels, clusterCount, previousCenters) {
		return Array.from({ length: clusterCount }, (_, clusterIndex) => {
			const clusterPoints = points.filter((_, pointIndex) => labels[pointIndex] === clusterIndex);
			if (!clusterPoints.length) return previousCenters[clusterIndex];
			const sums = clusterPoints.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]);
			return [sums[0] / clusterPoints.length, sums[1] / clusterPoints.length];
		});
	}
	function runKMeans$1(points, clusterCount, maxIterations = 25) {
		const safeClusterCount = Math.max(1, Math.min(clusterCount, points.length));
		let centers = points.slice(0, safeClusterCount).map((point) => [...point]);
		let labels = assignPointsToCenters(points, centers);
		for (let iteration = 0; iteration < maxIterations; iteration += 1) {
			const nextCenters = recomputeCenters(points, labels, safeClusterCount, centers);
			const nextLabels = assignPointsToCenters(points, nextCenters);
			const unchanged = nextLabels.every((label, index) => label === labels[index]);
			centers = nextCenters;
			labels = nextLabels;
			if (unchanged) break;
		}
		return {
			labels,
			centers
		};
	}
	function hasInlineObjectRows(spec) {
		return Array.isArray(spec?.data?.values) && spec.data.values.some((row) => row && typeof row === "object");
	}
	function isUrlBackedDataSpec(spec) {
		return typeof spec?.data?.url === "string" && spec.data.url.trim().length > 0;
	}
	function buildScatterActionDescriptors({ widgetRef, selectionRef, scope = "local", affectedRefs = [widgetRef] }) {
		const supportedWidgetKinds = ["scatter"];
		return [
			makeActionDescriptor({
				name: "scatter.brushRegion",
				title: "Brush scatterplot region",
				description: "Select points inside a data-space rectangle on the scatterplot.",
				primitive: "select",
				category: "selection",
				scope,
				supportedWidgetKinds,
				targetRef: selectionRef || widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "selections" : "transforms"),
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
				postconditions: [{ description: "The active selection should contain an interval over the x and y fields." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid scatter widget in the current workspace.",
					failureMessage: "scatter.brushRegion requires a valid scatter target widget."
				}],
				effects: [makeSelectionEffect(selectionRef || widgetRef, "Creates or updates an interval selection on the scatterplot."), ...affectedRefs.filter((ref) => ref !== widgetRef).map((ref) => makeFilterEffect(ref, "Linked widgets may be filtered or highlighted by the scatter selection."))],
				examples: [{
					userGoal: "Brush a region of interest in the scatterplot.",
					params: {
						xField: "Horsepower",
						yField: "Miles_per_Gallon",
						xRange: [80, 160],
						yRange: [20, 35]
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "scatter.zoomDomain",
				title: "Zoom scatterplot domain",
				description: "Zoom the scatterplot to a specific x and/or y domain.",
				primitive: "zoom",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "transforms"),
				paramsSchema: {
					type: "object",
					properties: {
						xDomain: {
							type: "array",
							minItems: 2,
							maxItems: 2,
							items: { anyOf: [{ type: "number" }, { type: "string" }] }
						},
						yDomain: {
							type: "array",
							minItems: 2,
							maxItems: 2,
							items: { anyOf: [{ type: "number" }, { type: "string" }] }
						}
					}
				},
				postconditions: [{ description: "The scatterplot view should reflect the requested x and/or y domain." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid scatter widget in the current workspace.",
					failureMessage: "scatter.zoomDomain requires a valid scatter target widget."
				}],
				examples: [{
					userGoal: "Zoom into the high-risk cluster region of the scatterplot.",
					params: {
						xDomain: [80, 160],
						yDomain: [20, 35]
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "scatter.identifyClusters",
				title: "Identify scatter clusters",
				description: "Cluster visible scatter points in the frontend and recolor the scatterplot by the derived cluster labels.",
				primitive: "annotate",
				category: "compute",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						nClusters: { type: "number" },
						method: { type: "string" }
					}
				},
				postconditions: [{ description: "The scatterplot data should include a derived cluster field and the color encoding should point to it." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid scatter widget with quantitative x/y encodings and enough visible rows.",
					failureMessage: "scatter.identifyClusters requires a valid scatter target widget with enough visible numeric points."
				}],
				examples: [{
					userGoal: "Color the visible scatter points by their inferred clusters.",
					params: {
						nClusters: 3,
						method: "kmeans"
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "scatter.showRegression",
				title: "Overlay scatter regression",
				description: "Add or replace a regression-line overlay on the current scatterplot using the active x/y encodings.",
				primitive: "annotate",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: { method: { type: "string" } }
				},
				postconditions: [{ description: "A tagged regression overlay layer should be present and should use the current scatter x/y fields." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid scatter widget in the current workspace.",
					failureMessage: "scatter.showRegression requires a valid scatter target widget."
				}],
				examples: [{
					userGoal: "Overlay a regression line on the scatterplot to inspect the overall trend.",
					params: { method: "linear" }
				}],
				reversible: true
			})
		];
	}
	function registerScatterActions(actionExecutor) {
		if (!actionExecutor.has("scatter.brushRegion")) actionExecutor.register({ name: "scatter.brushRegion" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "scatter"
			});
			const xRange = Array.isArray(params.xRange) ? params.xRange : null;
			const yRange = Array.isArray(params.yRange) ? params.yRange : null;
			if (!targetWidget || !params.xField || !params.yField || !xRange || !yRange) throw new Error("scatter.brushRegion requires a scatter target, xField, yField, xRange, and yRange.");
			const { rows } = ctx.readRowsForWidget(targetWidget.ref);
			const [xMin, xMax] = [Math.min(...xRange), Math.max(...xRange)];
			const [yMin, yMax] = [Math.min(...yRange), Math.max(...yRange)];
			const filtered = rows.filter((row) => {
				const x = row?.[params.xField];
				const y = row?.[params.yField];
				return typeof x === "number" && typeof y === "number" && x >= xMin && x <= xMax && y >= yMin && y <= yMax;
			});
			return buildSelectionActionResult({
				ctx,
				nextState: ctx.commitSelection({
					selection_id: `sel_${Date.now()}`,
					source_widget_id: targetWidget.widgetId || void 0,
					selection_type: "interval",
					fields: [params.xField, params.yField],
					value: {
						[params.xField]: [xMin, xMax],
						[params.yField]: [yMin, yMax]
					},
					domain: {
						xDomain: [xMin, xMax],
						yDomain: [yMin, yMax]
					},
					predicates: [{
						field: params.xField,
						op: "between",
						value: [xMin, xMax]
					}, {
						field: params.yField,
						op: "between",
						value: [yMin, yMax]
					}],
					count: filtered.length,
					summary: `${params.xField} ${xMin}~${xMax}; ${params.yField} ${yMin}~${yMax}`
				}),
				selectedCount: filtered.length,
				verificationHints: ["Read the updated widget selection state.", "Call perception.summarizeSelection to confirm the selected count."]
			});
		});
		if (!actionExecutor.has("scatter.zoomDomain")) actionExecutor.register({ name: "scatter.zoomDomain" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "scatter",
				message: "scatter.zoomDomain requires a valid scatter target widget."
			});
			const xDomain = Array.isArray(params.xDomain) ? params.xDomain : null;
			const yDomain = Array.isArray(params.yDomain) ? params.yDomain : null;
			if (!targetWidget || !xDomain && !yDomain) throw new Error("scatter.zoomDomain requires a scatter target and at least one domain range.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for scatter domain updates.");
					const nextEncoding = { ...spec.encoding || {} };
					if (xDomain && nextEncoding.x) nextEncoding.x = {
						...nextEncoding.x,
						scale: {
							...nextEncoding.x.scale || {},
							domain: xDomain
						}
					};
					if (yDomain && nextEncoding.y) nextEncoding.y = {
						...nextEncoding.y,
						scale: {
							...nextEncoding.y.scale || {},
							domain: yDomain
						}
					};
					const nextMark = typeof spec.mark === "string" ? {
						type: spec.mark,
						clip: true
					} : {
						...spec.mark || {},
						clip: true
					};
					return {
						...spec,
						mark: nextMark,
						encoding: nextEncoding
					};
				}),
				result: {
					widgetId: targetWidget.widgetId,
					...xDomain ? { xDomain } : {},
					...yDomain ? { yDomain } : {}
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the scatterplot domain was updated.", "Read the target widget view state to confirm the new x/y domain values."]
			};
		});
		if (!actionExecutor.has("scatter.identifyClusters")) actionExecutor.register({ name: "scatter.identifyClusters" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "scatter",
				message: "scatter.identifyClusters requires a valid scatter target widget."
			});
			const method = typeof params.method === "string" && params.method.trim().length > 0 ? params.method.trim().toLowerCase() : "kmeans";
			const requestedClusters = Number.isFinite(params.nClusters) ? Math.floor(params.nClusters) : 3;
			const nClusters = Math.max(1, requestedClusters);
			if (method !== "kmeans") throw new Error(`scatter.identifyClusters currently only supports the kmeans method. Received: ${method}.`);
			const currentSpec = ctx.readCurrentSpec();
			const { rows: visibleRows } = ctx.readRowsForWidget(targetWidget.ref);
			const sourceRows = Array.isArray(visibleRows) && visibleRows.length > 0 ? visibleRows : Array.isArray(currentSpec?.data?.values) ? currentSpec.data.values : [];
			const rootEncoding = currentSpec?.layer?.[0]?.encoding || currentSpec?.encoding || {};
			const xField = rootEncoding?.x?.field || null;
			const yField = rootEncoding?.y?.field || null;
			if (!xField || !yField) throw new Error("scatter.identifyClusters requires x and y encodings on the active scatter spec.");
			const points = [];
			const validSourceIndices = [];
			sourceRows.forEach((row, rowIndex) => {
				const x = row?.[xField];
				const y = row?.[yField];
				if (typeof x === "number" && Number.isFinite(x) && typeof y === "number" && Number.isFinite(y)) {
					points.push([x, y]);
					validSourceIndices.push(rowIndex);
				}
			});
			if (points.length < nClusters) throw new Error(`scatter.identifyClusters requires at least ${nClusters} visible numeric points.`);
			const { labels, centers } = runKMeans$1(points, nClusters);
			const clusterField = `cluster_${nClusters}`;
			const clusterStatistics = centers.map((center, clusterId) => ({
				cluster_id: clusterId,
				size: labels.filter((label) => label === clusterId).length,
				center
			}));
			const sourceIndexToCluster = /* @__PURE__ */ new Map();
			validSourceIndices.forEach((rowIndex, index) => {
				sourceIndexToCluster.set(rowIndex, labels[index]);
			});
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for scatter cluster identification.");
					const nextSpec = { ...spec };
					const nextValues = (hasInlineObjectRows(spec) ? spec.data.values : isUrlBackedDataSpec(spec) ? sourceRows : []).map((row, rowIndex) => {
						const nextRow = { ...row };
						if (sourceIndexToCluster.has(rowIndex)) nextRow[clusterField] = sourceIndexToCluster.get(rowIndex);
						return nextRow;
					});
					nextSpec.data = {
						...spec.data || {},
						values: nextValues
					};
					const nextEncoding = { ...spec.encoding || {} };
					nextEncoding.color = {
						field: clusterField,
						type: "nominal",
						scale: { scheme: "category10" },
						legend: { title: "Cluster" }
					};
					nextSpec.encoding = nextEncoding;
					nextSpec._scatter_cluster_state = {
						method,
						cluster_field: clusterField,
						n_clusters: nClusters,
						centers
					};
					return nextSpec;
				}),
				result: {
					widgetId: targetWidget.widgetId,
					method,
					nClusters,
					clusterField,
					clusterStatistics,
					message: `Identified ${nClusters} clusters`
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the scatter color encoding now points to the derived cluster field.", "Read the target widget spec data values to confirm visible rows received cluster labels."]
			};
		});
		if (!actionExecutor.has("scatter.showRegression")) actionExecutor.register({ name: "scatter.showRegression" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "scatter",
				message: "scatter.showRegression requires a valid scatter target widget."
			});
			const method = typeof params.method === "string" && params.method.trim().length > 0 ? params.method.trim().toLowerCase() : "linear";
			if (!targetWidget) throw new Error("scatter.showRegression requires a valid scatter target widget.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for scatter regression overlays.");
					const rootEncoding = spec?.layer?.[0]?.encoding || spec?.encoding || {};
					const xField = rootEncoding?.x?.field || null;
					const yField = rootEncoding?.y?.field || null;
					if (!xField || !yField) throw new Error("scatter.showRegression requires x and y encodings on the active scatter spec.");
					const regressionTransform = {
						regression: yField,
						on: xField
					};
					if (method === "poly") {
						regressionTransform.method = "poly";
						regressionTransform.order = 3;
					} else if (method === "quad") {
						regressionTransform.method = "poly";
						regressionTransform.order = 2;
					} else if (method === "log" || method === "exp") regressionTransform.method = method;
					else regressionTransform.method = "linear";
					const regressionLayer = {
						_widgetvaTag: "scatter.showRegression",
						mark: {
							type: "line",
							color: "red",
							strokeWidth: 2
						},
						transform: [regressionTransform],
						encoding: {
							x: {
								field: xField,
								type: "quantitative"
							},
							y: {
								field: yField,
								type: "quantitative"
							}
						}
					};
					if (Array.isArray(spec.layer) && spec.layer.length > 0) return {
						...spec,
						layer: replaceTaggedLayer(spec.layer, "scatter.showRegression", regressionLayer)
					};
					const nextSpec = { ...spec };
					const baseLayer = {
						mark: spec.mark || "point",
						encoding: spec.encoding || {}
					};
					delete nextSpec.mark;
					delete nextSpec.encoding;
					return {
						...nextSpec,
						layer: replaceTaggedLayer([baseLayer], "scatter.showRegression", regressionLayer)
					};
				}),
				result: {
					widgetId: targetWidget.widgetId,
					method,
					overlay: "regression"
				},
				verificationHints: ["Call perception.inspectViewConfig to verify a tagged regression overlay layer was added to the scatterplot.", "Read the target widget view state to confirm the regression transform uses the current x/y fields and requested method."]
			};
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/widgets/scatter/perception.js
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
	//#region ../../widgetva-kit/src/widgets/sankey/actions.js
	function cloneValue$15(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function findNamedDataSource$1(spec, name) {
		const data = Array.isArray(spec?.data) ? spec.data : [];
		const index = data.findIndex((entry) => entry && typeof entry === "object" && entry.name === name);
		if (index < 0) return {
			index: -1,
			values: null
		};
		return {
			index,
			values: Array.isArray(data[index]?.values) ? data[index].values : null
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
	function findNamedSignal(spec, name) {
		const signals = Array.isArray(spec?.signals) ? spec.signals : [];
		const index = signals.findIndex((entry) => entry && typeof entry === "object" && entry.name === name);
		if (index < 0) return {
			index: -1,
			signal: null
		};
		return {
			index,
			signal: signals[index]
		};
	}
	function computeNodeFlows(links) {
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
	function buildSankeyActionDescriptors({ widgetRef, selectionRef, scope = "local", affectedRefs = [widgetRef] }) {
		const supportedWidgetKinds = ["sankey"];
		return [
			makeActionDescriptor({
				name: "sankey.focusFlow",
				title: "Focus Sankey flow",
				description: "Focus one or more flow categories or nodes in the current Sankey view.",
				primitive: "select",
				category: "selection",
				scope,
				supportedWidgetKinds,
				targetRef: selectionRef || widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "selections" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						field: { type: "string" },
						values: {
							type: "array",
							items: {},
							minItems: 1
						}
					},
					required: ["field", "values"]
				},
				postconditions: [{ description: "The active selection should contain the requested flow or node categories." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid sankey widget in the current workspace.",
					failureMessage: "sankey.focusFlow requires a valid sankey target widget."
				}],
				effects: [makeSelectionEffect(selectionRef || widgetRef, "Creates or updates a categorical selection over Sankey flow nodes or links."), ...affectedRefs.filter((ref) => ref !== widgetRef).map((ref) => makeHighlightEffect(ref, "Linked widgets may highlight or filter the selected flow categories."))],
				examples: [{
					userGoal: "Focus a subset of flows before investigating bottlenecks.",
					params: {
						field: "source",
						values: ["A"]
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "sankey.selectAggregateNode",
				title: "Select a collapsed Sankey aggregate node",
				description: "Select one collapsed aggregate node by aggregate name so downstream context can focus that temporary group even when it does not map to row-level predicates.",
				primitive: "select",
				category: "selection",
				scope,
				supportedWidgetKinds,
				targetRef: selectionRef || widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "selections" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: { aggregateName: { type: "string" } },
					required: ["aggregateName"]
				},
				postconditions: [{ description: "The active selection should preserve the requested aggregateName even when no row-level predicates are available." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid sankey widget in the current workspace.",
					failureMessage: "sankey.selectAggregateNode requires a valid sankey target widget."
				}],
				effects: [makeSelectionEffect(selectionRef || widgetRef, "Creates or updates an aggregate-node selection over one collapsed Sankey group."), ...affectedRefs.filter((ref) => ref !== widgetRef).map((ref) => makeHighlightEffect(ref, "Linked widgets may use the selected Sankey aggregate as a focused comparison context."))],
				examples: [{
					userGoal: "Hold one collapsed aggregate group as the current focus before deciding whether to re-expand it.",
					params: { aggregateName: "collapsed:1:other" }
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "sankey.filterFlow",
				title: "Filter Sankey flow by threshold",
				description: "Keep only links at or above a minimum flow value, preferably by updating the Sankey threshold signal when one exists.",
				primitive: "filter",
				category: "dataTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "transforms" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: { minValue: { type: "number" } },
					required: ["minValue"]
				},
				postconditions: [{ description: "The Sankey threshold signal should reflect the requested minimum flow, or rawLinks/nodeConfig should be filtered to links at or above it." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid sankey widget in the current workspace and the current Sankey view has rawLinks.",
					failureMessage: "sankey.filterFlow requires a valid sankey target widget with rawLinks."
				}],
				examples: [{
					userGoal: "Hide tiny flows so the main pathways stand out more clearly.",
					params: { minValue: 20 }
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "sankey.collapseNodes",
				title: "Collapse Sankey nodes",
				description: "Collapse multiple nodes into one aggregate node by rewriting the raw link list and node configuration in the current Sankey view.",
				primitive: "aggregate",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						nodes: {
							type: "array",
							minItems: 1,
							items: { type: "string" }
						},
						aggregateName: { type: "string" }
					},
					required: ["nodes"]
				},
				postconditions: [{ description: "The requested nodes should be replaced by one aggregate node, and rawLinks/nodeConfig should reflect the new topology." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid sankey widget in the current workspace.",
					failureMessage: "sankey.collapseNodes requires a valid sankey target widget."
				}],
				examples: [{
					userGoal: "Merge several low-signal source nodes into one aggregate before comparing downstream flow structure.",
					params: {
						nodes: ["A", "B"],
						aggregateName: "Other Sources"
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "sankey.expandNode",
				title: "Expand a collapsed Sankey node",
				description: "Restore the original nodes and links for one previously collapsed aggregate node using the saved Sankey structural state.",
				primitive: "navigate",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: { aggregateName: { type: "string" } },
					required: ["aggregateName"]
				},
				postconditions: [{ description: "The aggregate node should be replaced by its original nodes and links, and the saved collapsed-group entry should be removed." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid sankey widget in the current workspace.",
					failureMessage: "sankey.expandNode requires a valid sankey target widget."
				}],
				examples: [{
					userGoal: "Re-expand one aggregate group after an earlier structural simplification pass.",
					params: { aggregateName: "Other Sources" }
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "sankey.highlightPath",
				title: "Highlight a Sankey path",
				description: "Visually emphasize a multi-step path by increasing opacity for edges and nodes on the path and dimming unrelated structure.",
				primitive: "highlight",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: { path: { oneOf: [{ type: "string" }, {
						type: "array",
						minItems: 2,
						items: { type: "string" }
					}] } },
					required: ["path"]
				},
				postconditions: [{ description: "The edge and node marks should contain path-sensitive opacity/stroke updates that emphasize the requested path and dim unrelated structure." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid sankey widget in the current workspace.",
					failureMessage: "sankey.highlightPath requires a valid sankey target widget."
				}],
				examples: [{
					userGoal: "Trace one conversion route through the Sankey graph while dimming everything else.",
					params: { path: [
						"A",
						"B",
						"C"
					] }
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "sankey.traceNode",
				title: "Trace Sankey node connections",
				description: "Highlight all edges directly connected to one node and visually emphasize that node while dimming unrelated structure.",
				primitive: "focus",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: { nodeName: { type: "string" } },
					required: ["nodeName"]
				},
				postconditions: [{ description: "Edges touching the requested node should remain prominent while unrelated edges and nodes are dimmed, or the selectedNode signal should be updated when the provider exposes it." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid sankey widget in the current workspace.",
					failureMessage: "sankey.traceNode requires a valid sankey target widget."
				}],
				examples: [{
					userGoal: "Trace all direct inflows and outflows for one node before deciding whether to collapse or reorder the layer.",
					params: { nodeName: "Checkout" }
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "sankey.colorFlows",
				title: "Color Sankey flows connected to nodes",
				description: "Recolor all edges directly connected to one or more nodes while leaving the unrelated edge color encoding as a fallback.",
				primitive: "reencode",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						nodes: {
							type: "array",
							minItems: 1,
							items: { type: "string" }
						},
						color: { type: "string" }
					},
					required: ["nodes"]
				},
				postconditions: [{ description: "Edges connected to the requested nodes should be recolored while unrelated edges still resolve through the prior fill encoding or a fallback color scale expression." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid sankey widget in the current workspace.",
					failureMessage: "sankey.colorFlows requires a valid sankey target widget."
				}],
				examples: [{
					userGoal: "Color all flows touching one or more nodes before presenting a focused Sankey story.",
					params: {
						nodes: ["Checkout"],
						color: "#e74c3c"
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "sankey.reorderNodesInLayer",
				title: "Reorder Sankey nodes in one layer",
				description: "Rewrite node order values for one Sankey depth layer using an explicit top-to-bottom node order.",
				primitive: "reencode",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: {
						depth: { type: "number" },
						order: {
							type: "array",
							minItems: 1,
							items: { type: "string" }
						}
					},
					required: ["depth", "order"]
				},
				postconditions: [{ description: "The nodeConfig entries at the requested depth should have updated order values reflecting the requested top-to-bottom sequence." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid sankey widget in the current workspace.",
					failureMessage: "sankey.reorderNodesInLayer requires a valid sankey target widget."
				}],
				examples: [{
					userGoal: "Reorder one Sankey layer to make important nodes appear first from top to bottom.",
					params: {
						depth: 0,
						order: [
							"C",
							"A",
							"B"
						]
					}
				}],
				reversible: true
			}),
			makeActionDescriptor({
				name: "sankey.autoCollapseByRank",
				title: "Auto-collapse Sankey nodes by rank",
				description: "Keep only the top-N nodes per Sankey layer by flow volume and collapse the remainder into layer-specific aggregate nodes.",
				primitive: "aggregate",
				category: "viewTransform",
				scope,
				supportedWidgetKinds,
				targetRef: widgetRef,
				affectedRefs,
				affectedStatePaths: affectedRefs.map((ref) => ref === widgetRef ? "view" : "feedback"),
				paramsSchema: {
					type: "object",
					properties: { topN: { type: "number" } },
					required: ["topN"]
				},
				postconditions: [{ description: "Each layer should keep only the top-N nodes by total flow while lower-ranked nodes are replaced by per-layer aggregate nodes in rawLinks/nodeConfig." }],
				preconditions: [{
					description: "The requested targetRef resolves to a valid sankey widget in the current workspace.",
					failureMessage: "sankey.autoCollapseByRank requires a valid sankey target widget."
				}],
				examples: [{
					userGoal: "Simplify a large Sankey by keeping only the most important nodes in each layer.",
					params: { topN: 2 }
				}],
				reversible: true
			})
		];
	}
	function registerSankeyActions(actionExecutor) {
		if (!actionExecutor.has("sankey.focusFlow")) actionExecutor.register({ name: "sankey.focusFlow" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "sankey"
			});
			const field = typeof params.field === "string" ? params.field : null;
			const values = Array.isArray(params.values) ? params.values.filter((value) => value != null) : [];
			if (!targetWidget || !field || values.length === 0) throw new Error("sankey.focusFlow requires a sankey target, field, and one or more values.");
			const { rows: visibleRows } = ctx.readRowsForWidget(targetWidget.ref);
			const matchedCount = visibleRows.filter((row) => values.includes(row?.[field])).length;
			return buildSelectionActionResult({
				ctx,
				nextState: ctx.commitSelection({
					selection_id: `sel_${Date.now()}`,
					source_widget_id: targetWidget.widgetId || void 0,
					selection_type: "category",
					field,
					values,
					predicates: [{
						field,
						op: "in",
						value: values
					}],
					count: matchedCount,
					summary: `${field}: ${values.join(", ")}`
				}),
				selectedCount: matchedCount,
				verificationHints: ["Read the updated Sankey selection state.", "Read linked widgets or feedback to confirm focused flow propagation."]
			});
		});
		if (!actionExecutor.has("sankey.selectAggregateNode")) actionExecutor.register({ name: "sankey.selectAggregateNode" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "sankey",
				message: "sankey.selectAggregateNode requires a valid sankey target widget."
			});
			const aggregateName = typeof params.aggregateName === "string" && params.aggregateName.trim().length > 0 ? params.aggregateName.trim() : null;
			if (!targetWidget || !aggregateName) throw new Error("sankey.selectAggregateNode requires a sankey target and an aggregateName.");
			return buildSelectionActionResult({
				ctx,
				nextState: ctx.commitSelection({
					selection_id: `sel_${Date.now()}`,
					source_widget_id: targetWidget.widgetId || void 0,
					selection_type: "category",
					field: "aggregateName",
					values: [aggregateName],
					predicates: [],
					count: 1,
					summary: `aggregateName: ${aggregateName}`,
					aggregateName
				}),
				selectedCount: 1,
				verificationHints: ["Read the updated Sankey selection state and confirm the aggregateName is preserved on the active selection.", "Read the coordination state to verify the aggregate selection became the current focused Sankey context."]
			});
		});
		if (!actionExecutor.has("sankey.filterFlow")) actionExecutor.register({ name: "sankey.filterFlow" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "sankey",
				message: "sankey.filterFlow requires a valid sankey target widget."
			});
			const minValue = Number(params.minValue);
			if (!targetWidget || !Number.isFinite(minValue)) throw new Error("sankey.filterFlow requires a sankey target and a finite minValue.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for sankey flow filtering.");
					const nextSpec = cloneValue$15(spec);
					const rawLinksSource = findNamedDataSource$1(nextSpec, "rawLinks");
					if (rawLinksSource.index < 0 || !rawLinksSource.values) throw new Error("sankey.filterFlow requires a rawLinks data source.");
					const survivingLinks = rawLinksSource.values.filter((link) => Number(link?.value || 0) >= minValue);
					if (survivingLinks.length === 0) throw new Error(`sankey.filterFlow found no links with value >= ${minValue}.`);
					const thresholdSignal = findNamedSignal(nextSpec, "threshold");
					if (thresholdSignal.index >= 0 && thresholdSignal.signal) {
						nextSpec.signals[thresholdSignal.index] = {
							...thresholdSignal.signal,
							value: minValue,
							...thresholdSignal.signal.bind && typeof thresholdSignal.signal.bind === "object" ? { bind: {
								...thresholdSignal.signal.bind,
								...Number.isFinite(thresholdSignal.signal.bind.max) && minValue > thresholdSignal.signal.bind.max ? { max: minValue * 1.5 } : {}
							} } : {}
						};
						nextSpec._sankey_filter_state = {
							mode: "threshold",
							min_value: minValue,
							source_action: "sankey.filterFlow"
						};
						return nextSpec;
					}
					nextSpec.data[rawLinksSource.index].values = survivingLinks;
					const nodeConfigSource = findNamedDataSource$1(nextSpec, "nodeConfig");
					if (nodeConfigSource.index >= 0 && nodeConfigSource.values) {
						const usedNodes = /* @__PURE__ */ new Set();
						survivingLinks.forEach((link) => {
							if (typeof link?.source === "string") usedNodes.add(link.source);
							if (typeof link?.target === "string") usedNodes.add(link.target);
						});
						nextSpec.data[nodeConfigSource.index].values = nodeConfigSource.values.filter((node) => usedNodes.has(node?.name));
					}
					nextSpec._sankey_filter_state = {
						mode: "threshold",
						min_value: minValue,
						source_action: "sankey.filterFlow"
					};
					return nextSpec;
				}),
				result: {
					widgetId: targetWidget.widgetId,
					minValue
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the threshold signal or rawLinks data now reflect the requested minimum flow.", "Read the target widget view state to confirm low-value links no longer participate in the visible Sankey structure."]
			};
		});
		if (!actionExecutor.has("sankey.collapseNodes")) actionExecutor.register({ name: "sankey.collapseNodes" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "sankey",
				message: "sankey.collapseNodes requires a valid sankey target widget."
			});
			const nodes = Array.isArray(params.nodes) ? params.nodes.filter((value) => typeof value === "string" && value.trim().length > 0) : [];
			const aggregateName = typeof params.aggregateName === "string" && params.aggregateName.trim().length > 0 ? params.aggregateName : "Other";
			if (!targetWidget || nodes.length === 0) throw new Error("sankey.collapseNodes requires a sankey target and one or more node names.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for collapsing Sankey nodes.");
					const nextSpec = cloneValue$15(spec);
					const rawLinksSource = findNamedDataSource$1(nextSpec, "rawLinks");
					const nodeConfigSource = findNamedDataSource$1(nextSpec, "nodeConfig");
					if (rawLinksSource.index < 0 || nodeConfigSource.index < 0 || !rawLinksSource.values || !nodeConfigSource.values) throw new Error("sankey.collapseNodes requires rawLinks and nodeConfig data sources.");
					const collapseSet = new Set(nodes);
					const existingNames = new Set(nodeConfigSource.values.map((node) => node?.name).filter((name) => typeof name === "string"));
					const missing = nodes.filter((name) => !existingNames.has(name));
					if (missing.length > 0) throw new Error(`sankey.collapseNodes cannot find node(s): ${missing.join(", ")}`);
					if (!nextSpec._sankey_state || typeof nextSpec._sankey_state !== "object") nextSpec._sankey_state = {
						original_nodes: cloneValue$15(nodeConfigSource.values),
						original_links: cloneValue$15(rawLinksSource.values),
						collapsed_groups: {}
					};
					if (!nextSpec._sankey_state.collapsed_groups || typeof nextSpec._sankey_state.collapsed_groups !== "object") nextSpec._sankey_state.collapsed_groups = {};
					nextSpec._sankey_state.collapsed_groups[aggregateName] = [...nodes];
					nextSpec._sankey_aggregate_state = {
						mode: "collapseNodes",
						aggregate_name: aggregateName,
						collapsed_nodes: [...nodes]
					};
					let collapseDepth = 0;
					let maxOrder = 0;
					for (const node of nodeConfigSource.values) {
						if (!node || typeof node !== "object") continue;
						if (collapseSet.has(node.name)) collapseDepth = typeof node.depth === "number" ? node.depth : collapseDepth;
						if ((typeof node.depth === "number" ? node.depth : 0) === collapseDepth) maxOrder = Math.max(maxOrder, typeof node.order === "number" ? node.order : 0);
					}
					const newNodes = nodeConfigSource.values.filter((node) => !collapseSet.has(node?.name));
					newNodes.push({
						name: aggregateName,
						depth: collapseDepth,
						order: maxOrder + 1,
						_is_aggregate: true,
						_collapsed_nodes: [...nodes]
					});
					const linkAgg = /* @__PURE__ */ new Map();
					for (const link of rawLinksSource.values) {
						if (!link || typeof link !== "object") continue;
						const src = link.source;
						const tgt = link.target;
						const value = Number(link.value || 0);
						const newSrc = collapseSet.has(src) ? aggregateName : src;
						const newTgt = collapseSet.has(tgt) ? aggregateName : tgt;
						if (newSrc === aggregateName && newTgt === aggregateName) continue;
						const key = `${newSrc}-->${newTgt}`;
						linkAgg.set(key, {
							source: newSrc,
							target: newTgt,
							value: (linkAgg.get(key)?.value || 0) + value
						});
					}
					nextSpec.data[nodeConfigSource.index].values = newNodes;
					nextSpec.data[rawLinksSource.index].values = [...linkAgg.values()];
					return nextSpec;
				}),
				result: {
					widgetId: targetWidget.widgetId,
					nodes,
					aggregateName
				},
				verificationHints: ["Call perception.inspectViewConfig to verify rawLinks and nodeConfig now include the aggregate node and collapsed topology.", "Read the target widget view state to confirm the original Sankey nodes and links were preserved in _sankey_state for later expansion."]
			};
		});
		if (!actionExecutor.has("sankey.expandNode")) actionExecutor.register({ name: "sankey.expandNode" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "sankey",
				message: "sankey.expandNode requires a valid sankey target widget."
			});
			const aggregateName = typeof params.aggregateName === "string" && params.aggregateName.trim().length > 0 ? params.aggregateName : null;
			if (!targetWidget || !aggregateName) throw new Error("sankey.expandNode requires a sankey target and an aggregateName.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for expanding Sankey nodes.");
					const nextSpec = cloneValue$15(spec);
					const rawLinksSource = findNamedDataSource$1(nextSpec, "rawLinks");
					const nodeConfigSource = findNamedDataSource$1(nextSpec, "nodeConfig");
					if (rawLinksSource.index < 0 || nodeConfigSource.index < 0 || !rawLinksSource.values || !nodeConfigSource.values) throw new Error("sankey.expandNode requires rawLinks and nodeConfig data sources.");
					const sankeyState = nextSpec._sankey_state && typeof nextSpec._sankey_state === "object" ? nextSpec._sankey_state : null;
					const collapsedGroups = sankeyState?.collapsed_groups && typeof sankeyState.collapsed_groups === "object" ? sankeyState.collapsed_groups : null;
					const originalNodes = Array.isArray(sankeyState?.original_nodes) ? sankeyState.original_nodes : null;
					const originalLinks = Array.isArray(sankeyState?.original_links) ? sankeyState.original_links : null;
					if (!collapsedGroups || !originalNodes || !originalLinks) throw new Error("sankey.expandNode requires saved _sankey_state with original nodes, links, and collapsed groups.");
					if (!Array.isArray(collapsedGroups[aggregateName])) throw new Error(`sankey.expandNode cannot find collapsed group "${aggregateName}".`);
					const collapsedNodeNames = new Set(collapsedGroups[aggregateName]);
					const newNodes = nodeConfigSource.values.filter((node) => node?.name !== aggregateName);
					for (const originalNode of originalNodes) if (collapsedNodeNames.has(originalNode?.name)) newNodes.push(cloneValue$15(originalNode));
					const currentNodeNames = new Set(newNodes.map((node) => node?.name).filter((name) => typeof name === "string"));
					const restoredLinks = [];
					for (const originalLink of originalLinks) {
						const src = originalLink?.source;
						const tgt = originalLink?.target;
						if (currentNodeNames.has(src) && currentNodeNames.has(tgt)) restoredLinks.push(cloneValue$15(originalLink));
					}
					for (const link of rawLinksSource.values) {
						const src = link?.source;
						const tgt = link?.target;
						if (src === aggregateName || tgt === aggregateName) continue;
						if (collapsedNodeNames.has(src) || collapsedNodeNames.has(tgt)) continue;
						if (!restoredLinks.some((existing) => existing?.source === src && existing?.target === tgt)) restoredLinks.push(cloneValue$15(link));
					}
					nextSpec.data[nodeConfigSource.index].values = newNodes;
					nextSpec.data[rawLinksSource.index].values = restoredLinks;
					delete nextSpec._sankey_state.collapsed_groups[aggregateName];
					nextSpec._navigation_state = {
						mode: "expandNode",
						sourceAction: "sankey.expandNode",
						aggregateName
					};
					return nextSpec;
				}),
				result: {
					widgetId: targetWidget.widgetId,
					aggregateName
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the aggregate node has been replaced by its original nodes and links.", "Read the target widget view state to confirm the corresponding collapsed-group entry was removed from _sankey_state."]
			};
		});
		if (!actionExecutor.has("sankey.highlightPath")) actionExecutor.register({ name: "sankey.highlightPath" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "sankey",
				message: "sankey.highlightPath requires a valid sankey target widget."
			});
			const path = Array.isArray(params.path) ? params.path.filter((value) => typeof value === "string" && value.trim().length > 0) : typeof params.path === "string" && params.path.trim().length > 0 ? params.path.split(",").map((value) => value.trim()).filter((value) => value.length > 0) : [];
			if (!targetWidget || path.length < 2) throw new Error("sankey.highlightPath requires a sankey target and a path with at least two nodes.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for highlighting a Sankey path.");
					const nextSpec = cloneValue$15(spec);
					const rawLinksSource = findNamedDataSource$1(nextSpec, "rawLinks");
					if (rawLinksSource.index < 0 || !rawLinksSource.values) throw new Error("sankey.highlightPath requires a rawLinks data source.");
					const linkSet = new Set(rawLinksSource.values.map((link) => `${link?.source}-->${link?.target}`));
					const highlightEdges = [];
					for (let index = 0; index < path.length - 1; index += 1) {
						const key = `${path[index]}-->${path[index + 1]}`;
						if (linkSet.has(key)) highlightEdges.push([path[index], path[index + 1]]);
					}
					if (highlightEdges.length === 0) throw new Error("sankey.highlightPath could not find any valid edges along the requested path.");
					const edgeMark = findNamedMark(nextSpec, "edgeMark");
					const nodeMark = findNamedMark(nextSpec, "nodeRect");
					const edgeConditions = highlightEdges.map(([source, target]) => `(datum.source === '${source}' && datum.target === '${target}')`);
					const nodeConditions = [...new Set(path)].map((node) => `datum.name === '${node}'`);
					if (edgeMark) {
						const update = (edgeMark.encode ||= {}).update ||= {};
						update.fillOpacity = { signal: `(${edgeConditions.join(" || ")}) ? 0.75 : 0.06` };
						update.strokeOpacity = { signal: `(${edgeConditions.join(" || ")}) ? 0.5 : 0.02` };
					}
					if (nodeMark) {
						const update = (nodeMark.encode ||= {}).update ||= {};
						update.fillOpacity = { signal: `(${nodeConditions.join(" || ")}) ? 1.0 : 0.15` };
						update.strokeWidth = { signal: `(${nodeConditions.join(" || ")}) ? 2.5 : 0.5` };
					}
					return nextSpec;
				}),
				result: {
					widgetId: targetWidget.widgetId,
					path
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the Sankey edge and node marks now contain path-sensitive opacity and stroke updates.", "Read the target widget view state to confirm the requested path remains prominent while unrelated edges and nodes are dimmed."]
			};
		});
		if (!actionExecutor.has("sankey.traceNode")) actionExecutor.register({ name: "sankey.traceNode" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "sankey",
				message: "sankey.traceNode requires a valid sankey target widget."
			});
			const nodeName = typeof params.nodeName === "string" && params.nodeName.trim().length > 0 ? params.nodeName.trim() : null;
			if (!targetWidget || !nodeName) throw new Error("sankey.traceNode requires a sankey target and a nodeName.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for tracing a Sankey node.");
					const nextSpec = cloneValue$15(spec);
					const rawLinksSource = findNamedDataSource$1(nextSpec, "rawLinks");
					if (rawLinksSource.index < 0 || !rawLinksSource.values) throw new Error("sankey.traceNode requires a rawLinks data source.");
					if (!rawLinksSource.values.some((link) => link?.source === nodeName || link?.target === nodeName)) throw new Error(`sankey.traceNode cannot find node "${nodeName}" in rawLinks.`);
					const selectedNodeSignal = findNamedSignal(nextSpec, "selectedNode");
					if (selectedNodeSignal.index >= 0 && selectedNodeSignal.signal) {
						nextSpec.signals[selectedNodeSignal.index] = {
							...selectedNodeSignal.signal,
							value: nodeName
						};
						nextSpec._sankey_focus_state = { node_name: nodeName };
						return nextSpec;
					}
					const edgeMark = findNamedMark(nextSpec, "edgeMark");
					const nodeMark = findNamedMark(nextSpec, "nodeRect");
					if (edgeMark) {
						const update = (edgeMark.encode ||= {}).update ||= {};
						update.fillOpacity = { signal: `datum.source === '${nodeName}' || datum.target === '${nodeName}' ? 0.75 : 0.08` };
					}
					if (nodeMark) {
						const update = (nodeMark.encode ||= {}).update ||= {};
						update.fillOpacity = { signal: `datum.name === '${nodeName}' ? 1.0 : 0.2` };
					}
					nextSpec._sankey_focus_state = { node_name: nodeName };
					return nextSpec;
				}),
				result: {
					widgetId: targetWidget.widgetId,
					nodeName
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the selectedNode signal or mark encodings now target the requested node and its directly connected flows.", "Read the target widget view state to confirm unrelated Sankey edges and nodes are dimmed relative to the traced node."]
			};
		});
		if (!actionExecutor.has("sankey.colorFlows")) actionExecutor.register({ name: "sankey.colorFlows" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "sankey",
				message: "sankey.colorFlows requires a valid sankey target widget."
			});
			const nodes = Array.isArray(params.nodes) ? params.nodes.filter((value) => typeof value === "string" && value.trim().length > 0) : [];
			const color = typeof params.color === "string" && params.color.trim().length > 0 ? params.color.trim() : "#e74c3c";
			if (!targetWidget || nodes.length === 0) throw new Error("sankey.colorFlows requires a sankey target and one or more node names.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for coloring Sankey flows.");
					const nextSpec = cloneValue$15(spec);
					const rawLinksSource = findNamedDataSource$1(nextSpec, "rawLinks");
					if (rawLinksSource.index < 0 || !rawLinksSource.values) throw new Error("sankey.colorFlows requires a rawLinks data source.");
					const nodesSet = new Set(nodes);
					const coloredEdges = rawLinksSource.values.filter((link) => link && typeof link === "object" && (nodesSet.has(link.source) || nodesSet.has(link.target))).map((link) => [link.source, link.target]);
					if (coloredEdges.length === 0) throw new Error(`sankey.colorFlows cannot find any flows connected to nodes: ${nodes.join(", ")}`);
					const edgeMark = findNamedMark(nextSpec, "edgeMark");
					if (!edgeMark) throw new Error("sankey.colorFlows requires an edgeMark in the current Sankey spec.");
					const update = (edgeMark.encode ||= {}).update ||= {};
					const originalFill = update.fill;
					let fallback = "scale('color', datum.source)";
					if (originalFill && typeof originalFill === "object" && !Array.isArray(originalFill)) {
						if (typeof originalFill.scale === "string" && typeof originalFill.field === "string") fallback = `scale('${originalFill.scale}', datum.${originalFill.field})`;
						else if (typeof originalFill.signal === "string" && originalFill.signal.trim().length > 0) fallback = `(${originalFill.signal})`;
						else if (Object.prototype.hasOwnProperty.call(originalFill, "value")) fallback = `'${originalFill.value}'`;
					}
					update.fill = { signal: `(${coloredEdges.map(([source, target]) => `(datum.source === '${source}' && datum.target === '${target}')`).join(" || ")}) ? '${color}' : ${fallback}` };
					nextSpec._sankey_reencode_state = {
						mode: "colorFlows",
						nodes: [...nodes],
						color
					};
					return nextSpec;
				}),
				result: {
					widgetId: targetWidget.widgetId,
					nodes,
					color
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the Sankey edgeMark fill encoding now recolors flows connected to the requested nodes.", "Read the target widget view state to confirm unrelated edge colors still resolve through the prior fill encoding fallback."]
			};
		});
		if (!actionExecutor.has("sankey.reorderNodesInLayer")) actionExecutor.register({ name: "sankey.reorderNodesInLayer" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "sankey",
				message: "sankey.reorderNodesInLayer requires a valid sankey target widget."
			});
			const depth = typeof params.depth === "number" && Number.isFinite(params.depth) ? params.depth : null;
			const order = Array.isArray(params.order) ? params.order.filter((value) => typeof value === "string" && value.trim().length > 0) : [];
			if (!targetWidget || depth == null || order.length === 0) throw new Error("sankey.reorderNodesInLayer requires a sankey target, a numeric depth, and a non-empty order list.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for reordering Sankey nodes in one layer.");
					const nextSpec = cloneValue$15(spec);
					const nodeConfigSource = findNamedDataSource$1(nextSpec, "nodeConfig");
					if (nodeConfigSource.index < 0 || !nodeConfigSource.values) throw new Error("sankey.reorderNodesInLayer requires a nodeConfig data source.");
					if (nodeConfigSource.values.filter((node) => Number(node?.depth ?? 0) === depth).length === 0) throw new Error(`sankey.reorderNodesInLayer cannot find nodes at depth ${depth}.`);
					const orderMap = new Map(order.map((name, index) => [name, index]));
					nextSpec.data[nodeConfigSource.index].values = nodeConfigSource.values.map((node) => {
						if (Number(node?.depth ?? 0) !== depth) return node;
						if (!orderMap.has(node?.name)) return node;
						return {
							...node,
							order: orderMap.get(node.name)
						};
					});
					nextSpec._sankey_reencode_state = {
						mode: "reorderNodesInLayer",
						depth,
						order: [...order]
					};
					return nextSpec;
				}),
				result: {
					widgetId: targetWidget.widgetId,
					depth,
					order
				},
				verificationHints: ["Call perception.inspectViewConfig to verify the nodeConfig entries at the requested depth now use the requested order values.", "Read the target widget view state to confirm the Sankey layer ordering changed without altering the underlying raw link topology."]
			};
		});
		if (!actionExecutor.has("sankey.autoCollapseByRank")) actionExecutor.register({ name: "sankey.autoCollapseByRank" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "sankey",
				message: "sankey.autoCollapseByRank requires a valid sankey target widget."
			});
			const topN = typeof params.topN === "number" && Number.isFinite(params.topN) ? params.topN : null;
			if (!targetWidget || topN == null || topN < 0) throw new Error("sankey.autoCollapseByRank requires a sankey target and a non-negative numeric topN.");
			return {
				nextState: ctx.updateCurrentSpec((spec) => {
					if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error("No active base spec is available for auto-collapsing Sankey nodes by rank.");
					const nextSpec = cloneValue$15(spec);
					const rawLinksSource = findNamedDataSource$1(nextSpec, "rawLinks");
					const nodeConfigSource = findNamedDataSource$1(nextSpec, "nodeConfig");
					if (rawLinksSource.index < 0 || nodeConfigSource.index < 0 || !rawLinksSource.values || !nodeConfigSource.values) throw new Error("sankey.autoCollapseByRank requires rawLinks and nodeConfig data sources.");
					if (!nextSpec._sankey_state || typeof nextSpec._sankey_state !== "object") nextSpec._sankey_state = {
						original_nodes: cloneValue$15(nodeConfigSource.values),
						original_links: cloneValue$15(rawLinksSource.values),
						collapsed_groups: {}
					};
					if (!nextSpec._sankey_state.collapsed_groups || typeof nextSpec._sankey_state.collapsed_groups !== "object") nextSpec._sankey_state.collapsed_groups = {};
					const nodeFlows = computeNodeFlows(rawLinksSource.values);
					const depthGroups = /* @__PURE__ */ new Map();
					for (const node of nodeConfigSource.values) {
						const depth = Number(node?.depth ?? 0);
						if (!depthGroups.has(depth)) depthGroups.set(depth, []);
						depthGroups.get(depth).push(node);
					}
					const nodesToKeep = /* @__PURE__ */ new Set();
					const collapsedByLayer = /* @__PURE__ */ new Map();
					const nodeToAggregate = /* @__PURE__ */ new Map();
					for (const [depth, group] of depthGroups.entries()) {
						const sortedGroup = [...group].sort((left, right) => {
							const leftTotal = nodeFlows.get(left?.name)?.total || 0;
							return (nodeFlows.get(right?.name)?.total || 0) - leftTotal;
						});
						for (const node of sortedGroup.slice(0, topN)) nodesToKeep.add(node?.name);
						const collapsedNames = sortedGroup.slice(topN).map((node) => node?.name).filter((name) => typeof name === "string");
						if (collapsedNames.length > 0) {
							const aggregateName = `Others (Layer ${depth})`;
							collapsedByLayer.set(depth, {
								aggregateName,
								collapsedNodes: collapsedNames
							});
							nextSpec._sankey_state.collapsed_groups[aggregateName] = collapsedNames;
							for (const name of collapsedNames) nodeToAggregate.set(name, aggregateName);
						}
					}
					if (collapsedByLayer.size === 0) return nextSpec;
					const newNodes = nodeConfigSource.values.filter((node) => nodesToKeep.has(node?.name));
					for (const [depth, info] of collapsedByLayer.entries()) {
						const maxOrder = (depthGroups.get(depth) || []).reduce((max, node) => Math.max(max, Number(node?.order ?? 0)), 0);
						newNodes.push({
							name: info.aggregateName,
							depth,
							order: maxOrder + 1,
							_is_aggregate: true,
							_collapsed_nodes: info.collapsedNodes
						});
					}
					const linkAgg = /* @__PURE__ */ new Map();
					for (const link of rawLinksSource.values) {
						if (!link || typeof link !== "object") continue;
						const source = nodeToAggregate.get(link.source) || link.source;
						const target = nodeToAggregate.get(link.target) || link.target;
						const key = `${source}-->${target}`;
						linkAgg.set(key, {
							source,
							target,
							value: (linkAgg.get(key)?.value || 0) + Number(link.value || 0)
						});
					}
					nextSpec.data[nodeConfigSource.index].values = newNodes;
					nextSpec.data[rawLinksSource.index].values = [...linkAgg.values()];
					nextSpec._sankey_aggregate_state = {
						mode: "autoCollapseByRank",
						top_n: topN,
						collapsed_groups: [...collapsedByLayer.entries()].map(([depth, info]) => ({
							depth,
							aggregate_name: info.aggregateName,
							collapsed_nodes: [...info.collapsedNodes]
						}))
					};
					return nextSpec;
				}),
				result: {
					widgetId: targetWidget.widgetId,
					topN
				},
				verificationHints: ["Call perception.inspectViewConfig to verify lower-ranked nodes were replaced by per-layer aggregate nodes in rawLinks/nodeConfig.", "Read the target widget view state to confirm the original Sankey topology remains preserved in _sankey_state for later restoration."]
			};
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/widgets/sankey/perception.js
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
	//#region ../../widgetva-kit/src/adapters/widgets/sankey/humanInteraction.js
	function getSankeyHumanInteractionConfig() {
		return {
			mode: "categoryClick",
			actionName: "sankey.focusFlow",
			categoryFieldChannel: "color",
			supportsDirectManipulation: true
		};
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgets/sankey/state.js
	async function applySankeyState(args) {
		return applyVegaLiteRuntimeState(args);
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgetFamilies/sankeyWidgetAdapter.js
	var sankeyWidgetAdapter = createVegaLiteWidgetAdapter({
		kind: "sankey",
		async applyState(args) {
			return applySankeyState(args);
		},
		buildActionDescriptors(args) {
			return buildSankeyActionDescriptors(args);
		},
		buildPerceptionDescriptors(args) {
			return buildSankeyPerceptionDescriptors(args);
		},
		getHumanInteractionConfig() {
			return getSankeyHumanInteractionConfig();
		},
		registerActions(actionExecutor) {
			return registerSankeyActions(actionExecutor);
		},
		registerPerceptionQueries(perceptionRegistry) {
			return registerSankeyPerceptionQueries(perceptionRegistry);
		}
	});
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgets/scatter/humanInteraction.js
	function getScatterHumanInteractionConfig() {
		return {
			mode: "brush2d",
			actionName: "scatter.brushRegion",
			supportsDirectManipulation: true
		};
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgets/scatter/state.js
	async function applyScatterState(args) {
		return applyVegaLiteRuntimeState(args);
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgetFamilies/scatterWidgetAdapter.js
	var scatterWidgetAdapter = createVegaLiteWidgetAdapter({
		kind: "scatter",
		bindHumanInteractions({ view, spec, interactionConfig, selectionSourceWidgetId, actionTargetRef, onActionCall, onSelectionChange }) {
			return bindWidgetHumanInteractions({
				view,
				spec,
				interactionConfig,
				selectionSourceWidgetId,
				actionTargetRef,
				onActionCall,
				onSelectionChange
			});
		},
		async applyState({ view, state }) {
			return applyScatterState({
				view,
				state
			});
		},
		buildActionDescriptors({ widgetRef, selectionRef, scope = "local", affectedRefs = [widgetRef] }) {
			return buildScatterActionDescriptors({
				widgetRef,
				selectionRef,
				scope,
				affectedRefs
			});
		},
		buildPerceptionDescriptors({ dataRef }) {
			return buildScatterPerceptionDescriptors({ dataRef });
		},
		getHumanInteractionConfig() {
			return getScatterHumanInteractionConfig();
		},
		registerActions(actionExecutor) {
			return registerScatterActions(actionExecutor);
		},
		registerPerceptionQueries(perceptionRegistry) {
			return registerScatterPerceptionQueries(perceptionRegistry);
		}
	});
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgets/table/actions.js
	function resolveDefaultKeyField(widgetState) {
		return (Array.isArray(widgetState?.rawSpec?.columns) ? widgetState.rawSpec.columns : [])[0] || null;
	}
	function buildTableActionDescriptors({ widgetRef, scope = "local", affectedRefs = [widgetRef] }) {
		return [makeActionDescriptor({
			name: "table.focusRows",
			title: "Focus table rows",
			description: "Focus a set of rows in the current table using a key field and one or more keys.",
			primitive: "navigate",
			category: "navigation",
			scope,
			supportedWidgetKinds: ["table"],
			targetRef: widgetRef,
			affectedRefs,
			paramsSchema: {
				type: "object",
				properties: {
					keyField: { type: "string" },
					keys: {
						type: "array",
						items: {},
						minItems: 1
					}
				},
				required: ["keys"]
			},
			postconditions: [{ description: "The workspace focus should move to the table and the table should expose a point selection for the requested keys." }],
			preconditions: [{
				description: "The table exposes at least one stable key field for row identity.",
				failureMessage: "No usable key field is available for row focus."
			}],
			effects: [makeSelectionEffect(widgetRef, "Creates a point selection that identifies focused table rows.")],
			examples: [{
				userGoal: "Jump to one or more detail rows that should be examined closely.",
				params: {
					keyField: "Name",
					keys: ["ford pinto"]
				}
			}],
			reversible: true
		})];
	}
	function registerTableActions(actionExecutor) {
		if (!actionExecutor.has("table.focusRows")) actionExecutor.register({ name: "table.focusRows" }, async (call, ctx) => {
			const params = call?.params || {};
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "table",
				message: "table.focusRows requires a valid target table widget."
			});
			const widgetState = ctx.readCurrentState({ refs: [targetWidget.ref] })?.widgets?.[targetWidget.ref];
			const keyField = typeof params.keyField === "string" ? params.keyField : resolveDefaultKeyField(widgetState);
			const keys = Array.isArray(params.keys) ? params.keys.filter((key) => key != null) : [];
			if (!keyField || keys.length === 0) throw new Error("table.focusRows requires a keyField and at least one key.");
			const selection = {
				selection_id: `table_focus_${Date.now()}`,
				source_widget_id: targetWidget.widgetId,
				selection_type: "point",
				keyField,
				keys,
				predicates: [{
					field: keyField,
					op: keys.length === 1 ? "equals" : "in",
					value: keys.length === 1 ? keys[0] : keys
				}],
				count: keys.length,
				summary: `Focused ${keys.length} row${keys.length === 1 ? "" : "s"} in ${targetWidget.widgetId}.`
			};
			ctx.getAppState().setCurrentFocusedWidgetRef(targetWidget.ref);
			return {
				nextState: ctx.commitSelection(selection),
				propagateFromSelection: true,
				result: {
					widgetId: targetWidget.widgetId,
					keyField,
					keys
				},
				verificationHints: ["Read the workspace state and confirm shared.focusedWidget points to the table.", "Read the table widget state and confirm a point selection exists for the requested keys."],
				notes: { userVisibleSummary: `Focused ${keys.length} table row${keys.length === 1 ? "" : "s"} via ${keyField}.` }
			};
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgets/table/humanInteraction.js
	function getTableHumanInteractionConfig() {
		return {
			mode: "rowClick",
			actionName: "table.focusRows",
			supportsDirectManipulation: true
		};
	}
	function bindTableHumanInteractions({ surface, state, interactionConfig, onActionCall }) {
		if (!surface || !interactionConfig || interactionConfig.mode !== "rowClick" || typeof onActionCall !== "function") return () => {};
		const handleClick = (event) => {
			const rowElement = event.target instanceof Element ? event.target.closest?.("[data-widgetva-row-index]") : null;
			if (!rowElement) return;
			const rowIndex = Number(rowElement.getAttribute("data-widgetva-row-index"));
			if (!Number.isInteger(rowIndex) || rowIndex < 0) return;
			const row = (Array.isArray(state?.rawSpec?.data?.values) ? state.rawSpec.data.values : [])[rowIndex];
			if (!row || typeof row !== "object") return;
			const columns = Array.isArray(state?.rawSpec?.columns) ? state.rawSpec.columns : [];
			const keyField = interactionConfig.keyField || columns[0] || null;
			const key = keyField ? row?.[keyField] : null;
			if (!keyField || key == null) return;
			onActionCall({
				callId: `human_${Date.now()}`,
				name: interactionConfig.actionName || "table.focusRows",
				actor: "human",
				targetRef: state?.ref || void 0,
				params: {
					targetRef: state?.ref || void 0,
					keyField,
					keys: [key]
				}
			});
		};
		surface.addEventListener("click", handleClick);
		return () => surface.removeEventListener("click", handleClick);
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgets/table/perception.js
	function buildTablePerceptionDescriptors({ dataRef }) {
		return [makePerceptionDescriptor({
			name: "perception.findExtremes",
			title: "Find extremes",
			description: "Return top-k or bottom-k rows by a numeric field in the visible table data.",
			category: "compute",
			targetRef: dataRef,
			paramsSchema: {
				type: "object",
				properties: {
					field: { type: "string" },
					direction: { type: "string" },
					limit: { type: "number" },
					dataRef: { type: "string" }
				}
			},
			sideEffectFree: true,
			evidenceKinds: ["rowEvidence", "rankEvidence"],
			examples: [{
				userGoal: "Find the highest or lowest records directly from the visible table.",
				params: {
					field: "Horsepower",
					direction: "max",
					limit: 5
				}
			}]
		}), makePerceptionDescriptor({
			name: "perception.compareGroups",
			title: "Compare groups",
			description: "Compare grouped statistics directly from the visible table rows.",
			category: "compute",
			targetRef: dataRef,
			paramsSchema: {
				type: "object",
				properties: {
					groupField: { type: "string" },
					valueField: { type: "string" },
					groups: {
						type: "array",
						items: { type: "string" }
					},
					dataRef: { type: "string" }
				}
			},
			sideEffectFree: true,
			evidenceKinds: ["groupComparison", "rowEvidence"],
			examples: [{
				userGoal: "Compare grouped statistics directly from detail rows.",
				params: {
					groupField: "Origin",
					valueField: "Horsepower",
					groups: ["Japan", "USA"]
				}
			}]
		})];
	}
	function registerTablePerceptionQueries(perceptionRegistry) {
		if (!perceptionRegistry.has("perception.findExtremes", { supportedWidgetKinds: ["table"] })) perceptionRegistry.register({
			name: "perception.findExtremes",
			supportedWidgetKinds: ["table"]
		}, async (call, ctx) => {
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "table"
			});
			const extremes = runDataPerceptionQuery({
				ctx,
				dataQueryExecutor: perceptionRegistry.dataQueryExecutor,
				targetWidget,
				kind: "findExtremes",
				spec: call?.params || {}
			});
			ctx.recordQuery({ affectedRefs: [targetWidget.ref] });
			return { result: buildPerceptionDataResult({
				dataQueryResult: extremes,
				fallbackDataRef: ctx.resolveRowsForWidget(targetWidget, call?.params || {}).dataRef
			}) };
		}, { supportedWidgetKinds: ["table"] });
		if (!perceptionRegistry.has("perception.compareGroups", { supportedWidgetKinds: ["table"] })) perceptionRegistry.register({
			name: "perception.compareGroups",
			supportedWidgetKinds: ["table"]
		}, async (call, ctx) => {
			const targetWidget = ctx.requireTargetWidget({
				targetRef: call?.queryScope?.widgetRef || null,
				kind: "table"
			});
			const comparison = runDataPerceptionQuery({
				ctx,
				dataQueryExecutor: perceptionRegistry.dataQueryExecutor,
				targetWidget,
				kind: "compareGroups",
				spec: call?.params || {}
			});
			ctx.recordQuery({ affectedRefs: [targetWidget.ref] });
			return { result: buildPerceptionDataResult({
				dataQueryResult: comparison,
				fallbackDataRef: ctx.resolveRowsForWidget(targetWidget, call?.params || {}).dataRef
			}) };
		}, { supportedWidgetKinds: ["table"] });
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgets/table/state.js
	async function applyTableState({ view, surface, state }) {
		const pointSelections = Object.values(state?.selections || {}).filter((selection) => selection?.kind === "point");
		const focusedSelection = pointSelections.length === 1 ? pointSelections[0] : null;
		const selectionSummaries = pointSelections.map((selection) => selection?.summary || "").filter(Boolean);
		const selectionFields = pointSelections.map((selection) => Array.isArray(selection?.predicates) ? selection.predicates : []).flat().filter((predicate) => predicate?.field && (predicate.op === "equals" || predicate.op === "in")).map((predicate) => predicate.field);
		const selectionField = selectionFields.length === 1 ? selectionFields[0] : new Set(selectionFields).size === 1 ? selectionFields[0] : "";
		if (surface) {
			surface.dataset.widgetvaSelectedCount = String(state?.data?.selectedCount ?? 0);
			surface.dataset.widgetvaVisibleCount = String(state?.data?.visibleCount ?? 0);
			surface.dataset.widgetvaSelectionSummary = focusedSelection?.summary || selectionSummaries.join(" · ");
			surface.dataset.widgetvaSelectionField = selectionField;
			surface.dataset.widgetvaSelectionCount = String(pointSelections.length);
			surface.dataset.widgetvaSelectionSummaries = JSON.stringify(selectionSummaries);
		}
		if (!view) return;
		try {
			if (typeof view.signal === "function") {
				view.signal("widgetva_tableSelection", focusedSelection || null);
				view.signal("widgetva_tableSelections", pointSelections);
			}
			await view.runAsync?.();
		} catch {}
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgetFamilies/tableWidgetAdapter.js
	var tableWidgetAdapter = createCustomWidgetAdapter({
		kind: "table",
		bindHumanInteractions(args) {
			return bindTableHumanInteractions(args);
		},
		async applyState(args) {
			return applyTableState(args);
		},
		buildActionDescriptors(args) {
			return buildTableActionDescriptors(args);
		},
		buildPerceptionDescriptors(args) {
			return buildTablePerceptionDescriptors(args);
		},
		getHumanInteractionConfig() {
			return getTableHumanInteractionConfig();
		},
		registerActions(actionExecutor) {
			return registerTableActions(actionExecutor);
		},
		registerPerceptionQueries(perceptionRegistry) {
			return registerTablePerceptionQueries(perceptionRegistry);
		}
	});
	//#endregion
	//#region ../../widgetva-kit/src/adapters/widgetFamilies/index.js
	var familyAdapters = new Map([
		["scatter", scatterWidgetAdapter],
		["bar", barWidgetAdapter],
		["line", lineWidgetAdapter],
		["heatmap", heatmapWidgetAdapter],
		["parallelCoordinates", parallelCoordinatesWidgetAdapter],
		["sankey", sankeyWidgetAdapter],
		["map", mapWidgetAdapter],
		["table", tableWidgetAdapter],
		["custom", defaultWidgetAdapter]
	]);
	function getWidgetFamilyAdapter(kind) {
		return familyAdapters.get(kind) || defaultWidgetAdapter;
	}
	function bindIfFunction(target, name) {
		const value = target?.[name];
		return typeof value === "function" ? value.bind(target) : void 0;
	}
	function pickProviderSharedDefinition(kind, { includeProviderRenderHooks = true } = {}) {
		const familyAdapter = getWidgetFamilyAdapter(kind);
		const baseDefinition = {
			kind,
			buildActionDescriptors: bindIfFunction(familyAdapter, "buildActionDescriptors"),
			buildPerceptionDescriptors: bindIfFunction(familyAdapter, "buildPerceptionDescriptors"),
			getHumanInteractionConfig: bindIfFunction(familyAdapter, "getHumanInteractionConfig"),
			registerActions: bindIfFunction(familyAdapter, "registerActions"),
			registerPerceptionQueries: bindIfFunction(familyAdapter, "registerPerceptionQueries"),
			readSelection: bindIfFunction(familyAdapter, "readSelection"),
			readViewport: bindIfFunction(familyAdapter, "readViewport")
		};
		if (!includeProviderRenderHooks) return baseDefinition;
		return {
			...baseDefinition,
			bindHumanInteractions: bindIfFunction(familyAdapter, "bindHumanInteractions"),
			applyState: bindIfFunction(familyAdapter, "applyState"),
			mount: bindIfFunction(familyAdapter, "mount"),
			update: bindIfFunction(familyAdapter, "update"),
			dispose: bindIfFunction(familyAdapter, "dispose")
		};
	}
	function createProviderFamilyAdapter(kind, provider = "vega-lite") {
		const sharedDefinition = pickProviderSharedDefinition(kind, { includeProviderRenderHooks: provider === "vega-lite" });
		if (provider === "echarts") return createEChartsWidgetAdapter({
			...sharedDefinition,
			bindHumanInteractions(args) {
				return bindEChartsFamilyInteractions(args);
			},
			buildOptionFromState(args) {
				return buildEChartsFamilyOption(args);
			}
		});
		if (provider === "d3") return createD3WidgetAdapter({
			...sharedDefinition,
			bindHumanInteractions(args) {
				return bindD3FamilyInteractions(args);
			},
			async renderFromState(args) {
				return renderD3FamilyState(args);
			}
		});
		return createVegaLiteWidgetAdapter(sharedDefinition);
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/actionExecutor.js
	function cloneValue$14(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function describeActionExecutorCountsSchema() {
		return cloneValue$14({
			type: "object",
			properties: {
				descriptorCount: { type: "integer" },
				handlerCount: { type: "integer" },
				preconditionCount: { type: "integer" }
			}
		});
	}
	function describeActionExecutorCapabilitiesSchema() {
		return cloneValue$14({
			type: "object",
			properties: {
				paramsValidation: { type: "boolean" },
				preconditionValidation: { type: "boolean" },
				stateSync: { type: "boolean" },
				traceRecording: { type: "boolean" },
				linkPropagation: { type: "boolean" }
			}
		});
	}
	function describeActionExecutorActionEntrySchema() {
		return cloneValue$14({
			type: "object",
			required: ["name"],
			properties: {
				name: { type: "string" },
				primitive: { type: ["string", "null"] },
				category: { type: ["string", "null"] },
				targetRef: { type: ["string", "null"] },
				affectedRefs: {
					type: "array",
					items: { type: "string" }
				},
				affectedStatePaths: {
					type: "array",
					items: { type: "string" }
				},
				supportedWidgetKinds: { anyOf: [{ type: "null" }, {
					type: "array",
					items: { type: "string" }
				}] },
				hasPreconditions: { type: "boolean" },
				preconditionDescriptorCount: { type: "integer" },
				preconditionHandlerRegistered: { type: "boolean" },
				postconditionCount: { type: "integer" },
				reversible: { type: "boolean" },
				effectCount: { type: "integer" },
				effectKinds: {
					type: "array",
					items: { type: "string" }
				}
			}
		});
	}
	function describeActionExecutorSummarySchema() {
		return cloneValue$14({
			type: "object",
			required: [
				"counts",
				"capabilities",
				"actions"
			],
			properties: {
				counts: describeActionExecutorCountsSchema(),
				capabilities: describeActionExecutorCapabilitiesSchema(),
				actions: {
					type: "array",
					items: describeActionExecutorActionEntrySchema()
				}
			}
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/actionContext.js
	function cloneValue$13(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function describeActionContextSummarySchema() {
		return cloneValue$13({
			type: "object",
			required: [
				"methods",
				"capabilities",
				"integrations"
			],
			properties: {
				methods: {
					type: "array",
					items: { type: "string" }
				},
				capabilities: {
					type: "object",
					properties: {
						workspaceRead: { type: "boolean" },
						workspaceWrite: { type: "boolean" },
						specMutation: { type: "boolean" },
						snapshotReplay: { type: "boolean" },
						runtimeDataRead: { type: "boolean" },
						runtimeDataWrite: { type: "boolean" },
						widgetTargetResolution: { type: "boolean" },
						selectionMutation: { type: "boolean" },
						annotationMutation: { type: "boolean" },
						linkPropagation: { type: "boolean" }
					}
				},
				integrations: {
					type: "object",
					properties: {
						store: { type: "boolean" },
						appState: { type: "boolean" },
						linkEngine: { type: "boolean" },
						traceRecorder: { type: "boolean" }
					}
				}
			}
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/actionUsage.js
	function cloneValue$12(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function describeActionUsageFieldExplanationSchema() {
		return cloneValue$12({
			type: "object",
			required: ["role", "reason"],
			properties: {
				role: { type: "string" },
				value: { type: ["string", "null"] },
				reason: { type: "string" }
			}
		});
	}
	function describeActionUsageFieldRoleMapSchema() {
		return cloneValue$12({
			type: "object",
			required: [
				"xField",
				"yField",
				"colorField",
				"categoryField",
				"measureField",
				"subCategoryField"
			],
			properties: {
				xField: { type: ["string", "null"] },
				yField: { type: ["string", "null"] },
				colorField: { type: ["string", "null"] },
				categoryField: { type: ["string", "null"] },
				measureField: { type: ["string", "null"] },
				subCategoryField: { type: ["string", "null"] }
			}
		});
	}
	function describeActionUsageFieldCandidatesSchema() {
		return cloneValue$12({
			type: "object",
			required: [
				"xFields",
				"yFields",
				"categoryFields",
				"measureFields",
				"groupFields"
			],
			properties: {
				xFields: {
					type: "array",
					items: { type: "string" }
				},
				yFields: {
					type: "array",
					items: { type: "string" }
				},
				categoryFields: {
					type: "array",
					items: { type: "string" }
				},
				measureFields: {
					type: "array",
					items: { type: "string" }
				},
				groupFields: {
					type: "array",
					items: { type: "string" }
				}
			}
		});
	}
	function describeActionUsageFieldRolesSchema() {
		return cloneValue$12({
			type: "object",
			required: [
				"resolved",
				"candidates",
				"explanations"
			],
			properties: {
				resolved: describeActionUsageFieldRoleMapSchema(),
				candidates: describeActionUsageFieldCandidatesSchema(),
				explanations: {
					type: "array",
					items: describeActionUsageFieldExplanationSchema()
				}
			}
		});
	}
	function describeActionUsageParamRoleSchema() {
		return cloneValue$12({
			type: "string",
			enum: [
				"structural",
				"intent",
				"optional"
			]
		});
	}
	function describeActionUsageParamRolesSchema() {
		return cloneValue$12({
			type: "object",
			additionalProperties: describeActionUsageParamRoleSchema()
		});
	}
	function describeActionUsageSpecContextSchema() {
		return cloneValue$12({
			type: "object",
			required: [
				"hasCurrentSpec",
				"dataSourceKind",
				"runtimeRowCount",
				"encodings"
			],
			properties: {
				hasCurrentSpec: { type: "boolean" },
				dataSourceKind: { type: ["string", "null"] },
				runtimeRowCount: {
					type: "integer",
					minimum: 0
				},
				encodings: {
					type: "object",
					required: [
						"x",
						"y",
						"color",
						"size",
						"shape"
					],
					properties: {
						x: { anyOf: [describeFieldEncodingSchema(), { type: "null" }] },
						y: { anyOf: [describeFieldEncodingSchema(), { type: "null" }] },
						color: { anyOf: [describeFieldEncodingSchema(), { type: "null" }] },
						size: { anyOf: [describeFieldEncodingSchema(), { type: "null" }] },
						shape: { anyOf: [describeFieldEncodingSchema(), { type: "null" }] }
					}
				}
			}
		});
	}
	function describeActionUsageEntrySchema() {
		return cloneValue$12({
			type: "object",
			required: [
				"name",
				"title",
				"description",
				"primitive",
				"category",
				"requiredParams",
				"paramRoles",
				"suggestedParams",
				"recommendedCall",
				"diagnostics"
			],
			properties: {
				name: { type: "string" },
				title: { type: "string" },
				description: { type: "string" },
				primitive: describeActionPrimitiveSchema(),
				category: describeActionCategorySchema(),
				targetRef: { type: ["string", "null"] },
				supportedWidgetKinds: { anyOf: [{ type: "null" }, {
					type: "array",
					items: describeWidgetKindSchema()
				}] },
				requiredParams: {
					type: "array",
					items: { type: "string" }
				},
				paramRoles: describeActionUsageParamRolesSchema(),
				suggestedParams: { type: "object" },
				recommendedCall: { type: "object" },
				diagnostics: {
					type: "array",
					items: { type: "string" }
				},
				paramsSchema: { anyOf: [{ type: "object" }, { type: "null" }] },
				examples: { anyOf: [{ type: "null" }, {
					type: "array",
					items: describeActionExampleSchema()
				}] },
				actionDescriptor: { anyOf: [describeActionDescriptorSchema(), { type: "null" }] }
			}
		});
	}
	function describeActionUsageSummarySchema() {
		return cloneValue$12({
			type: "object",
			required: [
				"targetRef",
				"widgetId",
				"widgetKind",
				"title",
				"diagnostics",
				"specContext",
				"fieldRoles",
				"actions"
			],
			properties: {
				targetRef: { type: ["string", "null"] },
				widgetId: { type: ["string", "null"] },
				widgetKind: { anyOf: [describeWidgetKindSchema(), { type: "null" }] },
				title: { type: ["string", "null"] },
				diagnostics: {
					type: "array",
					items: { type: "string" }
				},
				specContext: describeActionUsageSpecContextSchema(),
				fieldRoles: describeActionUsageFieldRolesSchema(),
				actions: {
					type: "array",
					items: describeActionUsageEntrySchema()
				}
			}
		});
	}
	function describeActionUsageRequestSchema() {
		return cloneValue$12({
			type: "object",
			additionalProperties: false,
			properties: {
				targetRef: { type: "string" },
				widgetRef: { type: "string" },
				widgetId: { type: "string" },
				actionName: { type: "string" },
				includeSchemas: { type: "boolean" },
				includeExamples: { type: "boolean" }
			}
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/responses.js
	function cloneValue$11(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function describeAgentResponseRecordSchema() {
		return cloneValue$11({
			type: "object",
			required: [
				"responseId",
				"actor",
				"content",
				"createdAt"
			],
			properties: {
				responseId: { type: "string" },
				runId: { type: ["string", "null"] },
				sessionId: { type: ["string", "null"] },
				workspaceId: { type: ["string", "null"] },
				actor: describeRuntimeActorSchema(),
				mode: { type: ["string", "null"] },
				query: { type: ["string", "null"] },
				content: { type: "string" },
				stateId: { type: ["string", "null"] },
				branchId: { type: ["string", "null"] },
				evidenceRefs: {
					type: "array",
					items: describeRefSchema()
				},
				coordinationEvidence: { anyOf: [{ type: "null" }, {
					type: "object",
					additionalProperties: true
				}] },
				usage: {
					type: "object",
					properties: {
						promptTokens: { type: ["number", "null"] },
						completionTokens: { type: ["number", "null"] },
						totalTokens: { type: ["number", "null"] },
						tokenCost: { type: ["number", "null"] },
						tokenCostUnit: { type: ["string", "null"] }
					}
				},
				createdAt: { type: "string" }
			}
		});
	}
	function describeResponseRecorderCapabilitiesSchema() {
		return cloneValue$11({
			type: "object",
			properties: {
				recordsFinalResponses: { type: "boolean" },
				latestResponseRead: { type: "boolean" },
				responseHistoryRead: { type: "boolean" },
				workspaceScopedReads: { type: "boolean" },
				lineageTracking: { type: "boolean" }
			}
		});
	}
	function describeResponseRecorderCountersSchema() {
		return cloneValue$11({
			type: "object",
			properties: {
				workspaceId: { type: ["string", "null"] },
				responseCount: { type: "integer" },
				latestResponseId: { type: ["string", "null"] },
				latestRunId: { type: ["string", "null"] },
				latestStateId: { type: ["string", "null"] },
				latestBranchId: { type: ["string", "null"] },
				latestActor: { anyOf: [describeRuntimeActorSchema(), { type: "null" }] },
				latestMode: { type: ["string", "null"] },
				latestQuery: { type: ["string", "null"] },
				latestEvidenceRefCount: { type: "integer" }
			}
		});
	}
	function describeResponseRecorderSummarySchema() {
		return cloneValue$11({
			type: "object",
			required: ["capabilities", "counters"],
			properties: {
				capabilities: describeResponseRecorderCapabilitiesSchema(),
				counters: describeResponseRecorderCountersSchema()
			}
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/perceptionContext.js
	function cloneValue$10(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function describePerceptionContextSummarySchema() {
		return cloneValue$10({
			type: "object",
			required: [
				"methods",
				"capabilities",
				"integrations"
			],
			properties: {
				methods: {
					type: "array",
					items: { type: "string" }
				},
				capabilities: {
					type: "object",
					properties: {
						workspaceRead: { type: "boolean" },
						runtimeDataRead: { type: "boolean" },
						widgetTargetResolution: { type: "boolean" },
						dataHandleResolution: { type: "boolean" },
						selectionScopedQueries: { type: "boolean" },
						traceRecording: { type: "boolean" }
					}
				},
				integrations: {
					type: "object",
					properties: {
						store: { type: "boolean" },
						traceRecorder: { type: "boolean" }
					}
				}
			}
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/dataQueryContext.js
	function cloneValue$9(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function describeDataQueryContextSummarySchema() {
		return cloneValue$9({
			type: "object",
			required: [
				"methods",
				"capabilities",
				"integrations"
			],
			properties: {
				methods: {
					type: "array",
					items: { type: "string" }
				},
				capabilities: {
					type: "object",
					properties: {
						workspaceRead: { type: "boolean" },
						runtimeDataRead: { type: "boolean" },
						widgetTargetResolution: { type: "boolean" },
						dataHandleResolution: { type: "boolean" },
						selectionTargetResolution: { type: "boolean" },
						explicitTargetValidation: { type: "boolean" },
						selectionScopedQueries: { type: "boolean" },
						traceRecording: { type: "boolean" }
					}
				},
				integrations: {
					type: "object",
					properties: {
						store: { type: "boolean" },
						traceRecorder: { type: "boolean" }
					}
				}
			}
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/dataQueryEngine.js
	function cloneValue$8(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function makeDataQueryEngineEngineSummary(summary = {}) {
		return {
			kind: summary?.kind ?? null,
			className: summary?.className ?? null
		};
	}
	function describeDataQueryEngineCountsSchema() {
		return cloneValue$8({
			type: "object",
			properties: {
				supportedQueryKindCount: { type: "integer" },
				supportedQueryDescriptorCount: { type: "integer" }
			}
		});
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
	function describeDataQueryEngineSummarySchema() {
		return cloneValue$8({
			type: "object",
			required: [
				"engine",
				"counts",
				"supportedQueryKinds",
				"supportedQueryDescriptors",
				"capabilities"
			],
			properties: {
				engine: {
					type: "object",
					properties: {
						kind: { type: ["string", "null"] },
						className: { type: ["string", "null"] }
					}
				},
				counts: describeDataQueryEngineCountsSchema(),
				supportedQueryKinds: {
					type: "array",
					items: { type: "string" }
				},
				supportedQueryDescriptors: {
					type: "array",
					items: describeDataQueryDescriptorSchema()
				},
				capabilities: {
					type: "object",
					properties: {
						localExecution: { type: "boolean" },
						remoteExecution: { type: "boolean" },
						sqlSupport: { type: "boolean" },
						fallbackEngine: { type: "boolean" }
					}
				}
			}
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/runtimeCore.js
	function cloneValue$7(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function describeRuntimeCoreComponentsSchema() {
		return cloneValue$7({
			type: "object",
			properties: {
				workspacePlanner: { type: "boolean" },
				widgetRegistry: { type: "boolean" },
				actionExecutor: { type: "boolean" },
				actionContext: { type: "boolean" },
				agentLoopRuntime: { type: "boolean" },
				perceptionQueryRegistry: { type: "boolean" },
				perceptionContext: { type: "boolean" },
				dataQueryExecutor: { type: "boolean" },
				dataQueryContext: { type: "boolean" },
				dataQueryEngine: { type: "boolean" },
				linkEngine: { type: "boolean" },
				stateManager: { type: "boolean" },
				interactionTraceRecorder: { type: "boolean" },
				responseRecorder: { type: "boolean" }
			}
		});
	}
	function describeRuntimeCoreRegistriesSchema() {
		return cloneValue$7({
			type: "object",
			properties: {
				widgetCount: { type: "integer" },
				dataHandleCount: { type: "integer" },
				linkCount: { type: "integer" },
				adapterCount: { type: "integer" },
				snapshotCount: { type: "integer" },
				branchCount: { type: "integer" },
				actionDescriptorCount: { type: "integer" },
				actionHandlerCount: { type: "integer" },
				actionPreconditionCount: { type: "integer" },
				perceptionDescriptorCount: { type: "integer" },
				perceptionHandlerCount: { type: "integer" },
				dataQueryKindCount: { type: "integer" },
				dataQueryDescriptorCount: { type: "integer" },
				linkPrimitiveCount: { type: "integer" },
				traceRecordCount: { type: "integer" },
				responseCount: { type: "integer" }
			}
		});
	}
	function describeRuntimeCoreCapabilitiesSchema() {
		return cloneValue$7({
			type: "object",
			properties: {
				paramsValidation: { type: "boolean" },
				perceptionReturnsValidation: { type: "boolean" },
				dataQueryReturnsValidation: { type: "boolean" },
				actionRun: { type: "boolean" },
				perceptionQueryRun: { type: "boolean" },
				dataQueryRun: { type: "boolean" },
				workspacePlanning: { type: "boolean" },
				verifiedActionRun: { type: "boolean" },
				agentLoopContextRead: { type: "boolean" },
				statePatching: { type: "boolean" },
				stateDelta: { type: "boolean" },
				workspaceDescriptionRead: { type: "boolean" },
				runtimeStoreRead: { type: "boolean" },
				widgetRegistryRead: { type: "boolean" },
				widgetAdapterListRead: { type: "boolean" },
				viewRead: { type: "boolean" },
				snapshotRead: { type: "boolean" },
				stateHistoryRead: { type: "boolean" },
				branchListRead: { type: "boolean" },
				interactionTraceRead: { type: "boolean" },
				primitiveTraceRead: { type: "boolean" },
				affectedRefsTraceRead: { type: "boolean" },
				actionCallTraceRead: { type: "boolean" },
				stateDeltaTraceRead: { type: "boolean" },
				verifyQueryResultsRead: { type: "boolean" },
				branchReplayEventsRead: { type: "boolean" },
				traceGraphRead: { type: "boolean" },
				stateJump: { type: "boolean" },
				branchCreate: { type: "boolean" },
				finalWorkspaceSnapshotRead: { type: "boolean" },
				linkPropagationEvaluation: { type: "boolean" },
				traceRecording: { type: "boolean" },
				branchReplay: { type: "boolean" },
				answerRecording: { type: "boolean" },
				latestResponseRead: { type: "boolean" },
				responseHistoryRead: { type: "boolean" },
				protocolIntrospection: { type: "boolean" }
			}
		});
	}
	function describeRuntimeCoreSummarySchema() {
		return cloneValue$7({
			type: "object",
			required: [
				"components",
				"registries",
				"capabilities"
			],
			properties: {
				components: describeRuntimeCoreComponentsSchema(),
				registries: describeRuntimeCoreRegistriesSchema(),
				capabilities: describeRuntimeCoreCapabilitiesSchema()
			}
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/runtimeStore.js
	function cloneValue$6(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function describeRuntimeStoreCurrentStateSummarySchema() {
		return cloneValue$6({
			type: ["object", "null"],
			properties: {
				stateId: { type: ["string", "null"] },
				focusedWidgetRef: { type: ["string", "null"] },
				focusedWidgetKind: { type: ["string", "null"] },
				focusedWidgetTitle: { type: ["string", "null"] },
				visibleCount: { type: ["number", "null"] },
				selectedCount: { type: ["number", "null"] },
				selectionCount: { type: "integer" },
				activeSelectionRefs: {
					type: "array",
					items: { type: "string" }
				},
				primarySelectionRef: { type: ["string", "null"] },
				primarySelectionSummary: { type: "string" },
				primarySelectionPredicates: {
					type: "array",
					items: { type: "object" }
				},
				annotationCount: { type: "integer" },
				comparisonTargetCount: { type: "integer" },
				globalFilterCount: { type: "integer" },
				taskMode: { type: ["string", "null"] },
				coordinationScope: { type: ["string", "null"] },
				evidenceType: { type: ["string", "null"] },
				interactionHorizon: { type: ["string", "null"] },
				replayRunMode: { type: ["string", "null"] },
				replayUserIntent: { type: "string" },
				changedRefs: {
					type: "array",
					items: { type: "string" }
				},
				removedRefs: {
					type: "array",
					items: { type: "string" }
				},
				sharedChanged: { type: "boolean" },
				taskContextChanged: { type: "boolean" },
				replayContextChanged: { type: "boolean" }
			}
		});
	}
	function describeRuntimeStoreRetentionSchema() {
		return cloneValue$6({
			type: "object",
			properties: {
				snapshotMax: { type: "integer" },
				traceMax: { type: "integer" },
				responseMax: { type: "integer" }
			}
		});
	}
	function describeRuntimeStoreIdentitySchema() {
		return cloneValue$6({
			type: "object",
			properties: {
				appId: { type: "string" },
				workspaceId: { type: "string" }
			}
		});
	}
	function describeRuntimeStoreStateSummarySchema() {
		return cloneValue$6({
			type: "object",
			required: ["stateId", "currentBranchId"],
			properties: {
				stateId: { type: ["string", "null"] },
				currentBranchId: { type: ["string", "null"] },
				previousStateId: { type: ["string", "null"] },
				version: { type: "integer" }
			}
		});
	}
	function describeRuntimeStoreIndexesSchema() {
		return cloneValue$6({
			type: "object",
			properties: {
				widgetCount: { type: "integer" },
				dataHandleCount: { type: "integer" },
				linkCount: { type: "integer" },
				widgetAdapterCount: { type: "integer" },
				actionDescriptorCount: { type: "integer" },
				perceptionDescriptorCount: { type: "integer" },
				widgetPatchCount: { type: "integer" }
			}
		});
	}
	function describeRuntimeStoreHistorySchema() {
		return cloneValue$6({
			type: "object",
			properties: {
				snapshotCount: { type: "integer" },
				traceCount: { type: "integer" },
				responseCount: { type: "integer" },
				branchCount: { type: "integer" },
				retention: describeRuntimeStoreRetentionSchema(),
				maxSnapshotRetention: { type: "integer" },
				maxTraceRetention: { type: "integer" },
				maxResponseRetention: { type: "integer" }
			}
		});
	}
	function describeRuntimeStoreCapabilitiesSchema() {
		return cloneValue$6({
			type: "object",
			properties: {
				deltaTracking: { type: "boolean" },
				snapshotHistory: { type: "boolean" },
				actorScopedHistory: { type: "boolean" },
				branchReplay: { type: "boolean" },
				traceGraph: { type: "boolean" },
				runtimeDataIndex: { type: "boolean" },
				adapterRegistry: { type: "boolean" },
				widgetStatePatching: { type: "boolean" }
			}
		});
	}
	function describeRuntimeStoreSummarySchema() {
		return cloneValue$6({
			type: "object",
			required: [
				"identity",
				"state",
				"indexes",
				"history",
				"capabilities"
			],
			properties: {
				identity: describeRuntimeStoreIdentitySchema(),
				state: describeRuntimeStoreStateSummarySchema(),
				currentStateSummary: describeRuntimeStoreCurrentStateSummarySchema(),
				indexes: describeRuntimeStoreIndexesSchema(),
				history: describeRuntimeStoreHistorySchema(),
				capabilities: describeRuntimeStoreCapabilitiesSchema()
			}
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/widgetRegistry.js
	function cloneValue$5(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function describeWidgetRegistryCountsSchema() {
		return cloneValue$5({
			type: "object",
			properties: {
				widgetCount: { type: "integer" },
				dataHandleCount: { type: "integer" },
				linkCount: { type: "integer" },
				adapterCount: { type: "integer" }
			}
		});
	}
	function describeWidgetRegistryRefsSchema() {
		return cloneValue$5({
			type: "object",
			properties: {
				widgetRefs: {
					type: "array",
					items: { type: "string" }
				},
				dataRefs: {
					type: "array",
					items: { type: "string" }
				},
				linkRefs: {
					type: "array",
					items: { type: "string" }
				}
			}
		});
	}
	function describeWidgetRegistryEntrySchema() {
		return cloneValue$5({
			type: "object",
			required: [
				"ref",
				"widgetId",
				"kind",
				"role"
			],
			properties: {
				ref: { type: "string" },
				widgetId: { type: "string" },
				kind: { type: "string" },
				role: { type: "string" },
				title: { type: "string" },
				description: { type: "string" },
				analyticRoles: {
					type: "array",
					items: { type: "string" }
				},
				sourceKind: { type: ["string", "null"] },
				supportsSpecMutation: { type: "boolean" },
				primaryDataRef: { type: ["string", "null"] },
				sourceDataRef: { type: ["string", "null"] },
				currentDataRef: { type: ["string", "null"] },
				usageNotes: {
					type: "array",
					items: { type: "string" }
				},
				actionNames: {
					type: "array",
					items: { type: "string" }
				},
				perceptionQueryNames: {
					type: "array",
					items: { type: "string" }
				},
				adapterProvider: { type: ["string", "null"] },
				providerCapabilities: { anyOf: [{ type: "null" }, describeWidgetAdapterProviderCapabilitiesSchema()] },
				adapterCapabilities: { anyOf: [{ type: "null" }, describeWidgetAdapterCapabilitiesSchema()] },
				humanInteractionMode: { type: ["string", "null"] },
				humanInteractionActionName: { type: ["string", "null"] },
				supportsDirectManipulation: { type: "boolean" }
			}
		});
	}
	function describeWidgetRegistrySummarySchema() {
		return cloneValue$5({
			type: "object",
			required: [
				"counts",
				"refs",
				"widgets",
				"dataHandles",
				"links"
			],
			properties: {
				counts: describeWidgetRegistryCountsSchema(),
				refs: describeWidgetRegistryRefsSchema(),
				widgets: {
					type: "array",
					items: describeWidgetRegistryEntrySchema()
				},
				dataHandles: {
					type: "array",
					items: describeDataHandleSchema()
				},
				links: {
					type: "array",
					items: describeWidgetLinkSchema()
				}
			}
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/perceptionRegistry.js
	function cloneValue$4(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function describePerceptionRegistryCountsSchema() {
		return cloneValue$4({
			type: "object",
			properties: {
				descriptorCount: { type: "integer" },
				handlerEntryCount: { type: "integer" }
			}
		});
	}
	function describePerceptionRegistryCapabilitiesSchema() {
		return cloneValue$4({
			type: "object",
			properties: {
				paramsValidation: { type: "boolean" },
				returnsValidation: { type: "boolean" },
				traceRecording: { type: "boolean" },
				linkPropagationEvidence: { type: "boolean" }
			}
		});
	}
	function describePerceptionRegistryQueryEntrySchema() {
		return cloneValue$4({
			type: "object",
			required: ["name"],
			properties: {
				name: { type: "string" },
				category: { type: ["string", "null"] },
				targetRef: { type: ["string", "null"] },
				handlerVariantCount: { type: "integer" },
				sideEffectFree: { type: "boolean" },
				evidenceKinds: {
					type: "array",
					items: { type: "string" }
				},
				verificationTargets: {
					type: "array",
					items: { type: "string" }
				},
				supportedWidgetKinds: { anyOf: [{ type: "null" }, {
					type: "array",
					items: { type: "string" }
				}] }
			}
		});
	}
	function describePerceptionRegistrySummarySchema() {
		return cloneValue$4({
			type: "object",
			required: [
				"counts",
				"capabilities",
				"queries"
			],
			properties: {
				counts: describePerceptionRegistryCountsSchema(),
				capabilities: describePerceptionRegistryCapabilitiesSchema(),
				queries: {
					type: "array",
					items: describePerceptionRegistryQueryEntrySchema()
				}
			}
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/dataQueryExecutor.js
	function cloneValue$3(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function describeDataQueryExecutorEngineSummarySchema() {
		return cloneValue$3({
			type: "object",
			properties: {
				kind: { type: ["string", "null"] },
				className: { type: ["string", "null"] }
			}
		});
	}
	function describeDataQueryExecutorCountsSchema() {
		return cloneValue$3({
			type: "object",
			properties: {
				supportedQueryKindCount: { type: "integer" },
				supportedQueryDescriptorCount: { type: "integer" }
			}
		});
	}
	function describeDataQueryExecutorCapabilitiesSchema() {
		return cloneValue$3({
			type: "object",
			properties: {
				schemaValidation: { type: "boolean" },
				returnsValidation: { type: "boolean" },
				traceRecording: { type: "boolean" },
				runtimeDataReads: { type: "boolean" }
			}
		});
	}
	function describeDataQueryExecutorSummarySchema() {
		return cloneValue$3({
			type: "object",
			required: [
				"engine",
				"counts",
				"capabilities",
				"supportedQueryKinds",
				"supportedQueryDescriptors"
			],
			properties: {
				engine: describeDataQueryExecutorEngineSummarySchema(),
				counts: describeDataQueryExecutorCountsSchema(),
				capabilities: describeDataQueryExecutorCapabilitiesSchema(),
				supportedQueryKinds: {
					type: "array",
					items: { type: "string" }
				},
				supportedQueryDescriptors: {
					type: "array",
					items: describeDataQueryDescriptorSchema()
				}
			}
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/stateManager.js
	function cloneValue$2(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function describeStateManagerCapabilitiesSchema() {
		return cloneValue$2({
			type: "object",
			properties: {
				stateIdGeneration: { type: "boolean" },
				deltaCreation: { type: "boolean" },
				statePatchCreation: { type: "boolean" },
				refScopedReads: { type: "boolean" }
			}
		});
	}
	function describeStateManagerCountersSchema() {
		return cloneValue$2({
			type: "object",
			properties: {
				generatedStateCount: { type: "integer" },
				lastGeneratedStateId: { type: ["string", "null"] }
			}
		});
	}
	function describeStateManagerSummarySchema() {
		return cloneValue$2({
			type: "object",
			required: ["capabilities", "counters"],
			properties: {
				capabilities: describeStateManagerCapabilitiesSchema(),
				reservedRefs: {
					type: "array",
					items: { type: "string" }
				},
				counters: describeStateManagerCountersSchema()
			}
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/traceRecorder.js
	function cloneValue$1(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function describeTraceRecorderCapabilitiesSchema() {
		return cloneValue$1({
			type: "object",
			properties: {
				recordsActions: { type: "boolean" },
				recordsPerceptionQueries: { type: "boolean" },
				recordsPerceptionQueryFailures: { type: "boolean" },
				recordsDataQueries: { type: "boolean" },
				recordsDataQueryFailures: { type: "boolean" },
				normalizedQueryFamily: { type: "boolean" },
				recordsSystemTransitions: { type: "boolean" },
				lineageTracking: { type: "boolean" }
			}
		});
	}
	function describeTraceRecorderCountersSchema() {
		return cloneValue$1({
			type: "object",
			properties: {
				traceCount: { type: "integer" },
				latestStateId: { type: ["string", "null"] },
				latestBranchId: { type: ["string", "null"] },
				latestEventKind: { type: ["string", "null"] },
				latestEventFamily: { type: ["string", "null"] },
				latestQuerySurface: { type: ["string", "null"] },
				latestOutcome: { type: ["string", "null"] }
			}
		});
	}
	function describeTraceRecorderEventKindsSchema() {
		return cloneValue$1({
			type: "array",
			items: { type: "string" }
		});
	}
	function describeTraceRecorderEventFamiliesSchema() {
		return cloneValue$1({
			type: "array",
			items: { type: "string" }
		});
	}
	function describeTraceRecorderQuerySurfacesSchema() {
		return cloneValue$1({
			type: "array",
			items: { type: "string" }
		});
	}
	function describeTraceRecorderSummarySchema() {
		return cloneValue$1({
			type: "object",
			required: ["capabilities", "counters"],
			properties: {
				capabilities: describeTraceRecorderCapabilitiesSchema(),
				counters: describeTraceRecorderCountersSchema(),
				eventKinds: describeTraceRecorderEventKindsSchema(),
				eventFamilies: describeTraceRecorderEventFamiliesSchema(),
				querySurfaces: describeTraceRecorderQuerySurfacesSchema()
			}
		});
	}
	//#endregion
	//#region ../../widgetva-kit/src/core/protocol/pagePort.js
	var BOOLEAN_SCHEMA = { type: "boolean" };
	var STRING_SCHEMA = { type: "string" };
	var REF_ARRAY_SCHEMA = {
		type: "array",
		items: { type: "string" }
	};
	function cloneValue(value) {
		return value == null ? value : JSON.parse(JSON.stringify(value));
	}
	function makeMethodDescriptor(descriptor) {
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
	function describePagePortAliasMapSchema() {
		return cloneValue({
			type: "object",
			additionalProperties: { type: "string" }
		});
	}
	function describePagePortErrorDescriptorSchema() {
		return cloneValue({
			type: "object",
			required: ["code", "description"],
			properties: {
				code: { type: "string" },
				description: { type: "string" }
			}
		});
	}
	function describePagePortErrorCatalogSchema() {
		return cloneValue({
			type: "object",
			additionalProperties: {
				type: "array",
				items: describePagePortErrorDescriptorSchema()
			}
		});
	}
	function describePagePortMethodReturnSchema() {
		return cloneValue({
			type: ["object", "null"],
			properties: {
				kind: { type: "string" },
				description: { type: "string" },
				schema: {}
			}
		});
	}
	function describePagePortMethodExampleSchema() {
		return cloneValue({
			type: "object",
			properties: {
				input: {},
				output: {},
				note: { type: "string" }
			}
		});
	}
	function describePagePortMethodDescriptorSchema() {
		return cloneValue({
			type: "object",
			required: [
				"stability",
				"aliases",
				"inputSchema",
				"returns",
				"errors"
			],
			properties: {
				stability: { type: "string" },
				aliases: {
					type: "array",
					items: { type: "string" }
				},
				inputSchema: { type: ["object", "null"] },
				returns: describePagePortMethodReturnSchema(),
				errors: {
					type: "array",
					items: describePagePortErrorDescriptorSchema()
				},
				description: { type: "string" },
				examples: {
					type: "array",
					items: describePagePortMethodExampleSchema()
				}
			}
		});
	}
	function describePagePortMethodDescriptorMapSchema() {
		return cloneValue({
			type: "object",
			additionalProperties: describePagePortMethodDescriptorSchema()
		});
	}
	function describePagePortDescriptionSchema() {
		return cloneValue({
			type: "object",
			required: [
				"version",
				"methods",
				"aliases",
				"methodDescriptors",
				"errorCatalog",
				"schemas",
				"transportHints"
			],
			properties: {
				version: { type: "string" },
				methods: {
					type: "array",
					items: { type: "string" }
				},
				aliases: describePagePortAliasMapSchema(),
				methodDescriptors: describePagePortMethodDescriptorMapSchema(),
				errorCatalog: describePagePortErrorCatalogSchema(),
				transportHints: describeWorkspaceTransportHintsSchema(),
				schemas: {
					type: "object",
					additionalProperties: {}
				},
				widgetAdapterIntrospection: { type: "boolean" },
				runtimeCoreIntrospection: { type: "boolean" },
				planner: { type: "boolean" },
				agentLoop: { type: "boolean" }
			}
		});
	}
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
	makeMethodDescriptor({
		description: "Describe the installed WidgetVA page port, including method catalog, aliases, schemas, and error semantics.",
		returns: {
			kind: "pagePortDescription",
			description: "A stable description of the external WidgetVA page API.",
			schema: describePagePortDescriptionSchema()
		},
		examples: [{
			userGoal: "Discover the stable WidgetVA page-port surface before connecting an external agent.",
			input: {}
		}]
	}), makeMethodDescriptor({
		aliases: ["workspace_describe"],
		description: "Describe the current workspace including widgets, data handles, links, actions, and perception queries.",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			properties: {
				includeSchemas: BOOLEAN_SCHEMA,
				includeExamples: BOOLEAN_SCHEMA,
				includeProtocolSchemas: BOOLEAN_SCHEMA
			}
		},
		returns: {
			kind: "workspaceDescription",
			description: "A workspace-level capability description with widget and runtime metadata.",
			schema: describeWorkspaceDescriptionSchema()
		}
	}), makeMethodDescriptor({
		aliases: ["ref_parse"],
		description: "Parse a WidgetVA ref string into structured ref parts.",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			properties: { ref: describeRefSchema() },
			required: ["ref"]
		},
		returns: {
			kind: "refParts",
			description: "Structured app/workspace/kind/id components parsed from a WidgetVA ref.",
			schema: { anyOf: [describeRefPartsSchema(), { type: "null" }] }
		}
	}), makeMethodDescriptor({
		aliases: ["runtime_core_describe"],
		description: "Describe the installed WidgetVA runtime core components, handler registries, and protocol-level execution capabilities.",
		returns: {
			kind: "runtimeCoreSummary",
			description: "A compact summary of the runtime core component graph and registered execution/query/link capabilities.",
			schema: describeRuntimeCoreSummarySchema()
		}
	}), makeMethodDescriptor({
		aliases: ["runtime_store_describe"],
		description: "Describe the current runtime-store indexes, history buffers, and replay capabilities.",
		returns: {
			kind: "runtimeStoreSummary",
			description: "A compact summary of runtime store state, registries, and replay/trace capacities.",
			schema: describeRuntimeStoreSummarySchema()
		}
	}), makeMethodDescriptor({
		aliases: ["widget_registry_describe"],
		description: "Describe the materialized widget/data/link/adapter registry maintained by the runtime core.",
		returns: {
			kind: "widgetRegistrySummary",
			description: "A compact registry summary covering widget refs, data refs, link refs, and per-widget registry entries.",
			schema: describeWidgetRegistrySummarySchema()
		}
	}), makeMethodDescriptor({
		aliases: ["action_executor_describe"],
		description: "Describe the installed ActionExecutor, including registered actions, handlers, and precondition coverage.",
		returns: {
			kind: "actionExecutorSummary",
			description: "A compact summary of ActionExecutor registrations, capabilities, and action surface.",
			schema: describeActionExecutorSummarySchema()
		}
	}), makeMethodDescriptor({
		aliases: ["action_context_describe"],
		description: "Describe the ActionContext contract that action handlers receive at runtime.",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			properties: {}
		},
		returns: {
			kind: "actionContextSummary",
			description: "A stable summary of ActionContext methods, capabilities, and integrations.",
			schema: describeActionContextSummarySchema()
		}
	}), makeMethodDescriptor({
		aliases: ["action_usage_describe"],
		description: "Describe how one action should be used on the current widget, including inferred fields, recommended params, and diagnostic guidance.",
		inputSchema: describeActionUsageRequestSchema(),
		returns: {
			kind: "actionUsageSummary",
			description: "Widget-scoped action-usage guidance with inferred field roles, recommended params, and diagnostics.",
			schema: describeActionUsageSummarySchema()
		}
	}), makeMethodDescriptor({
		aliases: ["perception_registry_describe"],
		description: "Describe the installed PerceptionQueryRegistry, including registered query handlers and supported widget-kind routing.",
		returns: {
			kind: "perceptionRegistrySummary",
			description: "A compact summary of perception-query registrations and evidence capabilities.",
			schema: describePerceptionRegistrySummarySchema()
		}
	}), makeMethodDescriptor({
		aliases: ["perception_context_describe"],
		description: "Describe the PerceptionContext contract that perception-query handlers receive at runtime.",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			properties: {}
		},
		returns: {
			kind: "perceptionContextSummary",
			description: "A stable summary of PerceptionContext methods, capabilities, and integrations.",
			schema: describePerceptionContextSummarySchema()
		}
	}), makeMethodDescriptor({
		aliases: ["data_query_executor_describe"],
		description: "Describe the installed DataQueryExecutor and its backing query-engine surface.",
		returns: {
			kind: "dataQueryExecutorSummary",
			description: "A compact summary of supported data-query kinds and query-engine capabilities.",
			schema: describeDataQueryExecutorSummarySchema()
		}
	}), makeMethodDescriptor({
		aliases: ["data_query_context_describe"],
		description: "Describe the DataQueryContext contract that data-query executions receive at runtime.",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			properties: {}
		},
		returns: {
			kind: "dataQueryContextSummary",
			description: "A stable summary of DataQueryContext methods, capabilities, and integrations.",
			schema: describeDataQueryContextSummarySchema()
		}
	}), makeMethodDescriptor({
		aliases: ["data_query_engine_describe"],
		description: "Describe the backing DataQueryEngine implementation and its supported query capabilities.",
		returns: {
			kind: "dataQueryEngineSummary",
			description: "A compact summary of the underlying data query engine implementation, supported query kinds, and execution capabilities.",
			schema: describeDataQueryEngineSummarySchema()
		}
	}), makeMethodDescriptor({
		aliases: ["state_manager_describe"],
		description: "Describe the installed StateManager capabilities and state-id generation counters.",
		returns: {
			kind: "stateManagerSummary",
			description: "A compact summary of StateManager responsibilities and generated state-id counters.",
			schema: describeStateManagerSummarySchema()
		}
	}), makeMethodDescriptor({
		aliases: ["trace_recorder_describe"],
		description: "Describe the installed InteractionTraceRecorder capabilities and current trace counters.",
		returns: {
			kind: "traceRecorderSummary",
			description: "A compact summary of unified trace-recording capabilities and current interaction-trace counts.",
			schema: describeTraceRecorderSummarySchema()
		}
	}), makeMethodDescriptor({
		aliases: ["response_recorder_describe"],
		description: "Describe the runtime response recorder used for final-answer capture and retrieval.",
		returns: {
			kind: "responseRecorderSummary",
			description: "Summary of final-response recording capabilities and counters.",
			schema: describeResponseRecorderSummarySchema()
		}
	}), makeMethodDescriptor({
		aliases: ["link_engine_describe"],
		description: "Describe the current LinkEngine primitive registry and materialized workspace link counts.",
		returns: {
			kind: "linkEngineSummary",
			description: "A compact summary of available link primitives and current workspace link topology size.",
			schema: describeLinkEngineSummarySchema()
		}
	}), makeMethodDescriptor({
		aliases: ["workspace_plan"],
		description: "Generate a workspace topology plan for the current specification and task context.",
		inputSchema: describeWorkspacePlanningRequestSchema(),
		returns: {
			kind: "workspacePlanningResult",
			description: "A planner-generated workspace topology with widgets, links, and rationale.",
			schema: describeWorkspacePlanningResultSchema()
		}
	}), makeMethodDescriptor({
		aliases: ["agent_loop_describe"],
		description: "Read a runtime-prepared observe-plan-act-verify-reason context bundle.",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			properties: { viewOptions: {
				type: "object",
				additionalProperties: false,
				properties: {
					refs: REF_ARRAY_SCHEMA,
					deltaSince: STRING_SCHEMA
				}
			} }
		},
		returns: {
			kind: "agentLoopContext",
			description: "A structured runtime bundle for closed-loop action planning and verification.",
			schema: describeAgentLoopContextSchema()
		}
	}), makeMethodDescriptor({
		aliases: ["widget_adapter_list"],
		description: "List materialized widget adapter instances and their provider/human-interaction capabilities.",
		returns: {
			kind: "widgetAdapterSummary[]",
			description: "Per-widget adapter metadata for runtime introspection.",
			schema: {
				type: "array",
				items: describeWidgetAdapterSummarySchema()
			}
		}
	}), makeMethodDescriptor({
		aliases: ["observation_read"],
		description: "Read a workspace-level observation envelope with workspace description, current state, coordination state, action/perception surfaces, and propagation summary.",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			properties: {
				readStateOptions: {
					type: "object",
					additionalProperties: false,
					properties: {
						refs: REF_ARRAY_SCHEMA,
						deltaSince: STRING_SCHEMA
					}
				},
				propagationOptions: {
					type: "object",
					additionalProperties: false,
					properties: { sourceRef: STRING_SCHEMA }
				}
			}
		},
		returns: {
			kind: "runtimeObservation",
			description: "A workspace-level observation bundle for agent-facing environment reads.",
			schema: {
				type: "object",
				additionalProperties: true
			}
		}
	}), makeMethodDescriptor({
		aliases: ["coordination_state_read"],
		description: "Read the current shared coordination state including focus, selections, highlight, viewport, filters, and annotations.",
		returns: {
			kind: "coordinationState",
			description: "A shared coordination-state projection derived from the runtime workspace state.",
			schema: {
				type: "object",
				additionalProperties: true
			}
		}
	}), makeMethodDescriptor({
		aliases: ["propagation_summary_read"],
		description: "Read a propagation summary over workspace links, optionally centered on one source ref.",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			properties: { sourceRef: STRING_SCHEMA }
		},
		returns: {
			kind: "propagationSummary",
			description: "A propagation summary bundle including candidate source refs, outgoing propagation entries, and optional evaluation results.",
			schema: {
				type: "object",
				additionalProperties: true
			}
		}
	}), makeMethodDescriptor({
		aliases: ["latest_coordination_result_read"],
		description: "Read the most recent coordination-driving runtime result bundle, including propagation and verification summaries when available.",
		returns: {
			kind: "latestCoordinationResult",
			description: "An ephemeral runtime result bundle for the most recent coordination-driving interaction.",
			schema: {
				type: ["object", "null"],
				additionalProperties: true
			}
		}
	}), makeMethodDescriptor({
		aliases: ["available_actions_list"],
		description: "List the currently available workspace and widget action descriptors.",
		returns: {
			kind: "actionDescriptor[]",
			description: "Available action descriptors exposed by the current runtime workspace.",
			schema: {
				type: "array",
				items: describeActionDescriptorSchema()
			}
		}
	}), makeMethodDescriptor({
		aliases: ["available_perceptions_list"],
		description: "List the currently available perception-query descriptors.",
		returns: {
			kind: "perceptionDescriptor[]",
			description: "Available perception descriptors exposed by the current runtime workspace.",
			schema: {
				type: "array",
				items: describePerceptionDescriptorSchema()
			}
		}
	}), makeMethodDescriptor({
		aliases: ["state_read"],
		description: "Read the current workspace state or a delta restricted to selected refs using the stable agent-facing state surface.",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			properties: {
				refs: REF_ARRAY_SCHEMA,
				deltaSince: STRING_SCHEMA
			}
		},
		returns: {
			kind: "workspaceState",
			description: "The current workspace state snapshot, optionally scoped by refs and/or delta base.",
			schema: describeWorkspaceStateSchema()
		}
	}), makeMethodDescriptor({
		aliases: ["view_read"],
		description: "Read the current workspace state or a delta restricted to selected refs.",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			properties: {
				refs: REF_ARRAY_SCHEMA,
				deltaSince: STRING_SCHEMA
			}
		},
		returns: {
			kind: "workspaceState",
			description: "The current workspace state snapshot, optionally scoped by refs and/or delta base.",
			schema: describeWorkspaceStateSchema()
		}
	}), makeMethodDescriptor({
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
			description: "A historical workspace snapshot, optionally annotated with branch and transition metadata.",
			schema: describeWorkspaceSnapshotSchema()
		}
	}), makeMethodDescriptor({
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
					items: describeRuntimeActorSchema()
				}
			}
		},
		returns: {
			kind: "stateSnapshotMeta[]",
			description: "Recent state-history entries with branch/transition metadata.",
			schema: {
				type: "array",
				items: describeStateSnapshotMetaSchema()
			}
		}
	}), makeMethodDescriptor({
		aliases: ["branch_list"],
		description: "List known runtime branches and their lineage metadata.",
		returns: {
			kind: "branchSummary[]",
			description: "Branch records maintained by the runtime trace store.",
			schema: {
				type: "array",
				items: describeBranchSummarySchema()
			}
		}
	}), makeMethodDescriptor({
		aliases: ["workspace_snapshot_read"],
		description: "Read the latest workspace snapshot for replay, inspection, or runtime history workflows.",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			properties: { refs: REF_ARRAY_SCHEMA }
		},
		returns: {
			kind: "workspaceSnapshot",
			description: "The latest workspace snapshot after current runtime state synchronization.",
			schema: describeWorkspaceSnapshotSchema()
		}
	}), makeMethodDescriptor({
		aliases: ["action_run"],
		description: "Execute an intent-level WidgetVA action against a target ref or widget.",
		inputSchema: describeActionCallSchema(),
		returns: {
			kind: "actionResult",
			description: "An action execution envelope with updated refs, state patch, result payload, and verification hints.",
			schema: describeActionResultSchema()
		},
		errors: PAGE_PORT_ERROR_CODES.action
	}), makeMethodDescriptor({
		aliases: ["verified_action_run"],
		description: "Execute an action and immediately return runtime verification evidence.",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			properties: {
				call: describeActionCallSchema(),
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
			description: "An action execution envelope augmented with post-action verification evidence.",
			schema: describeVerifiedActionResultSchema()
		},
		errors: PAGE_PORT_ERROR_CODES.action
	}), makeMethodDescriptor({
		aliases: ["jump_to_state"],
		description: "Jump the runtime back to a historical state and replay it into the live workspace.",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			properties: {
				callId: STRING_SCHEMA,
				actor: describeRuntimeActorSchema(),
				stateId: STRING_SCHEMA
			},
			required: ["stateId"]
		},
		returns: {
			kind: "actionResult",
			description: "A workspace.jumpToState action result.",
			schema: describeActionResultSchema()
		},
		errors: PAGE_PORT_ERROR_CODES.action
	}), makeMethodDescriptor({
		aliases: ["branch_from_state"],
		description: "Create and switch to a new runtime branch seeded from a historical state.",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			properties: {
				callId: STRING_SCHEMA,
				actor: describeRuntimeActorSchema(),
				stateId: STRING_SCHEMA,
				branchLabel: STRING_SCHEMA
			},
			required: ["stateId"]
		},
		returns: {
			kind: "actionResult",
			description: "A workspace.branchFromState action result.",
			schema: describeActionResultSchema()
		},
		errors: PAGE_PORT_ERROR_CODES.action
	}), makeMethodDescriptor({
		aliases: ["perception_query"],
		description: "Execute a WidgetVA perception query against the current view or a target widget/data ref.",
		inputSchema: describePerceptionQueryCallSchema(),
		returns: {
			kind: "perceptionResult",
			description: "A perception query envelope carrying structured evidence.",
			schema: describePerceptionResultSchema()
		},
		errors: PAGE_PORT_ERROR_CODES.perception
	}), makeMethodDescriptor({
		aliases: ["data_query_run"],
		description: "Execute a lower-level WidgetVA data query against a materialized data handle using the stable agent-facing act surface.",
		inputSchema: describeDataQueryCallSchema(),
		returns: {
			kind: "dataQueryResult",
			description: "A data-query envelope with rows, aggregates, or diagnostics depending on query kind.",
			schema: describeDataQueryResultSchema()
		},
		errors: PAGE_PORT_ERROR_CODES.dataQuery
	}), makeMethodDescriptor({
		aliases: ["data_query"],
		description: "Execute a lower-level WidgetVA data query against a materialized data handle.",
		inputSchema: describeDataQueryCallSchema(),
		returns: {
			kind: "dataQueryResult",
			description: "A data-query envelope with rows, aggregates, or diagnostics depending on query kind.",
			schema: describeDataQueryResultSchema()
		},
		errors: PAGE_PORT_ERROR_CODES.dataQuery
	}), makeMethodDescriptor({
		aliases: ["trace_read"],
		description: "Read the unified human+agent interaction trace from the runtime store using the stable verification surface.",
		inputSchema: {
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
					items: describeRuntimeActorSchema()
				}
			}
		},
		returns: {
			kind: "interactionTraceRecord[]",
			description: "Recent runtime interaction trace records.",
			schema: {
				type: "array",
				items: describeInteractionTraceRecordSchema()
			}
		}
	}), makeMethodDescriptor({
		aliases: ["interaction_trace_read"],
		description: "Read the unified human+agent interaction trace from the runtime store.",
		inputSchema: {
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
					items: describeRuntimeActorSchema()
				}
			}
		},
		returns: {
			kind: "interactionTraceRecord[]",
			description: "Recent runtime interaction trace records.",
			schema: {
				type: "array",
				items: describeInteractionTraceRecordSchema()
			}
		}
	}), makeMethodDescriptor({
		aliases: ["workspace_replay"],
		description: "Replay a historical state into the live workspace using the stable replay surface.",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			properties: {
				callId: STRING_SCHEMA,
				actor: describeRuntimeActorSchema(),
				stateId: STRING_SCHEMA
			},
			required: ["stateId"]
		},
		returns: {
			kind: "actionResult",
			description: "A workspace.jumpToState action result returned through the stable replay surface.",
			schema: describeActionResultSchema()
		},
		errors: PAGE_PORT_ERROR_CODES.action
	}), makeMethodDescriptor({
		aliases: ["trace_graph_read"],
		description: "Read the runtime trace graph with branch and transition relationships.",
		inputSchema: {
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
					items: describeRuntimeActorSchema()
				}
			}
		},
		returns: {
			kind: "traceGraph",
			description: "A graph-friendly projection of runtime states and transitions.",
			schema: describeTraceGraphSchema()
		}
	}), makeMethodDescriptor({
		aliases: ["agent_response_read"],
		description: "Read the latest recorded final response for the current or specified workspace.",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			properties: { workspaceId: STRING_SCHEMA }
		},
		returns: {
			kind: "agentResponseRecord",
			description: "Latest recorded final response, if available.",
			schema: { anyOf: [describeAgentResponseRecordSchema(), { type: "null" }] }
		}
	}), makeMethodDescriptor({
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
			description: "Recent recorded final responses for the current or specified workspace.",
			schema: {
				type: "array",
				items: describeAgentResponseRecordSchema()
			}
		}
	}), makeMethodDescriptor({
		aliases: ["link_propagation_evaluate"],
		description: "Evaluate the current propagation consistency for all outgoing links from a given source ref.",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			properties: { sourceRef: STRING_SCHEMA },
			required: ["sourceRef"]
		},
		returns: {
			kind: "linkPropagationEvaluation",
			description: "Per-link consistency checks for runtime propagation semantics.",
			schema: describeLinkPropagationEvaluationSchema()
		}
	}), makeMethodDescriptor({
		aliases: ["agent_response_record"],
		description: "Record a final response for the current workspace, produced by the agent or another runtime actor, for later history and inspection workflows.",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			required: ["content"],
			properties: {
				responseId: STRING_SCHEMA,
				runId: STRING_SCHEMA,
				sessionId: STRING_SCHEMA,
				actor: describeRuntimeActorSchema(),
				mode: STRING_SCHEMA,
				query: STRING_SCHEMA,
				content: STRING_SCHEMA,
				evidenceRefs: REF_ARRAY_SCHEMA
			}
		},
		returns: {
			kind: "agentResponseRecord",
			description: "The recorded final-response record with runtime lineage metadata.",
			schema: describeAgentResponseRecordSchema()
		}
	});
	//#endregion
	//#region ../../widgetva-kit/src/core/data/DataQueryEngine.js
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
		if (predicate.op === "equals") return value === predicate.value;
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
	//#endregion
	//#region ../../widgetva-kit/src/core/rendering/RendererAdapterRegistry.js
	function normalizeProvider(provider) {
		return typeof provider === "string" && provider.trim().length > 0 ? provider.trim() : null;
	}
	function normalizeSupportedWidgetKinds(value) {
		return Array.isArray(value) ? value.filter((entry) => typeof entry === "string" && entry.trim().length > 0) : [];
	}
	function normalizeRegistryEntry(entry = {}) {
		const provider = normalizeProvider(entry.provider);
		if (!provider) throw new Error("RendererAdapterRegistry entries require a non-empty provider string.");
		if (typeof entry.createAdapter !== "function") throw new Error(`RendererAdapterRegistry entry ${provider} requires createAdapter().`);
		return {
			provider,
			createAdapter: entry.createAdapter,
			createDefinition: typeof entry.createDefinition === "function" ? entry.createDefinition : null,
			supportedWidgetKinds: normalizeSupportedWidgetKinds(entry.supportedWidgetKinds),
			metadata: entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata) ? { ...entry.metadata } : {}
		};
	}
	function createRendererAdapterRegistry(entries = []) {
		const entryMap = /* @__PURE__ */ new Map();
		function register(entry) {
			const normalized = normalizeRegistryEntry(entry);
			entryMap.set(normalized.provider, normalized);
			return normalized;
		}
		function resolve(provider) {
			const normalized = normalizeProvider(provider);
			return normalized ? entryMap.get(normalized) || null : null;
		}
		function has(provider) {
			return Boolean(resolve(provider));
		}
		function list() {
			return [...entryMap.values()].map((entry) => ({
				provider: entry.provider,
				supportedWidgetKinds: [...entry.supportedWidgetKinds],
				metadata: { ...entry.metadata }
			}));
		}
		function supportsWidgetKind(provider, widgetKind) {
			const entry = resolve(provider);
			if (!entry || typeof widgetKind !== "string" || widgetKind.length === 0) return false;
			return entry.supportedWidgetKinds.length === 0 || entry.supportedWidgetKinds.includes(widgetKind);
		}
		function createAdapter(provider, args = {}) {
			const entry = resolve(provider);
			if (!entry) throw new Error(`Renderer adapter provider ${provider} is not registered.`);
			return entry.createAdapter(args);
		}
		for (const entry of Array.isArray(entries) ? entries : []) register(entry);
		return {
			register,
			resolve,
			has,
			list,
			supportsWidgetKind,
			createAdapter
		};
	}
	//#endregion
	//#region ../../widgetva-kit/src/adapters/installWidgetView.js
	function createDefaultProviderBackedAdapter(provider, definition = {}) {
		const normalizedDefinition = definition && typeof definition === "object" && !Array.isArray(definition) ? definition : {};
		const kind = typeof normalizedDefinition.kind === "string" ? normalizedDefinition.kind : null;
		if (kind && ![
			"vega-lite-view",
			"d3-view",
			"echarts-view"
		].includes(kind)) {
			const familyAdapter = createProviderFamilyAdapter(kind, provider);
			return {
				...familyAdapter,
				...normalizedDefinition,
				provider: familyAdapter.provider,
				providerCapabilities: {
					...familyAdapter.providerCapabilities || {},
					...normalizedDefinition.providerCapabilities || {}
				}
			};
		}
		if (provider === "d3") return createD3WidgetAdapter(normalizedDefinition);
		if (provider === "echarts") return createEChartsWidgetAdapter(normalizedDefinition);
		return createVegaLiteWidgetAdapter(normalizedDefinition);
	}
	createRendererAdapterRegistry([
		{
			provider: "vega-lite",
			createAdapter({ definition = {} } = {}) {
				return createDefaultProviderBackedAdapter("vega-lite", definition);
			}
		},
		{
			provider: "d3",
			createAdapter({ definition = {} } = {}) {
				return createDefaultProviderBackedAdapter("d3", definition);
			}
		},
		{
			provider: "echarts",
			createAdapter({ definition = {} } = {}) {
				return createDefaultProviderBackedAdapter("echarts", definition);
			}
		}
	]);
	//#endregion
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
	function readObservableD3ScatterRows(root = globalThis.window) {
		return findObservableD3PointMarks(root).map((mark, index) => {
			const center = (typeof mark?.tagName === "string" ? mark.tagName.toLowerCase() : "") === "circle" ? readCircleCenter(mark) : readPathCenter(mark);
			if (!center) return null;
			return {
				id: `pt_${index + 1}`,
				__screenX: center.cx,
				__screenY: center.cy
			};
		}).filter(Boolean);
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
	function readObservableD3LineRows(root = globalThis.window) {
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
		return {
			count: normalizedRows.length,
			xMin: xs.length ? Math.min(...xs) : null,
			xMax: xs.length ? Math.max(...xs) : null,
			yMin: ys.length ? Math.min(...ys) : null,
			yMax: ys.length ? Math.max(...ys) : null,
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
	//#region extension/src/content/observableD3WorkerContentScript.js
	var REQUEST_TYPE = "widgetva:observable-d3-worker-request";
	var RESPONSE_TYPE = "widgetva:observable-d3-worker-response";
	var SOURCE_TOP = "widgetva-observable-d3-top";
	var SOURCE_WORKER = "widgetva-observable-d3-worker";
	var WIDGETVA_BRUSH_OVERLAY_ATTR = "data-widgetva-brush-overlay";
	var WIDGETVA_SURFACE_PROBE_ATTR = "data-widgetva-surface-probe";
	var WIDGETVA_VIEWBOX_CACHE_ATTR = "data-widgetva-original-viewbox";
	var WIDGETVA_LINE_SLICE_ATTR = "data-widgetva-line-slice-overlay";
	var WIDGETVA_LINE_TREND_ATTR = "data-widgetva-line-trend-overlay";
	var WIDGETVA_LINE_MA_ATTR = "data-widgetva-line-ma-overlay";
	var WIDGETVA_LINE_DRILLDOWN_ATTR = "data-widgetva-line-drilldown-overlay";
	var WIDGETVA_SCATTER_REGRESSION_ATTR = "data-widgetva-scatter-regression-overlay";
	var originalMarkState = /* @__PURE__ */ new WeakMap();
	var currentViewport = null;
	var currentLineViewport = null;
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
	function removeBrushOverlay(surface) {
		surface?.querySelector?.(`[${WIDGETVA_BRUSH_OVERLAY_ATTR}="true"]`)?.remove?.();
	}
	function removeLineSliceOverlay(surface) {
		surface?.ownerDocument?.querySelector?.(`[${WIDGETVA_LINE_SLICE_ATTR}="true"]`)?.remove?.();
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
	function removeScatterRegressionOverlay(surface) {
		surface?.querySelector?.(`[${WIDGETVA_SCATTER_REGRESSION_ATTR}="true"]`)?.remove?.();
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
	function renderBrushOverlay(surface, selection) {
		if (!surface || typeof surface?.tagName !== "string" || surface.tagName.toLowerCase() !== "svg") return;
		const xDomain = Array.isArray(selection?.domain?.xDomain) ? selection.domain.xDomain : null;
		const yDomain = Array.isArray(selection?.domain?.yDomain) ? selection.domain.yDomain : null;
		if (!xDomain || !yDomain) {
			removeBrushOverlay(surface);
			return;
		}
		const rect = readRectLike(surface);
		const x = Math.min(xDomain[0], xDomain[1]) - rect.left;
		const y = Math.min(yDomain[0], yDomain[1]) - rect.top;
		const width = Math.abs(xDomain[1] - xDomain[0]);
		const height = Math.abs(yDomain[1] - yDomain[0]);
		const doc = surface.ownerDocument || window.document;
		const overlay = surface.querySelector?.(`[${WIDGETVA_BRUSH_OVERLAY_ATTR}="true"]`) || doc?.createElementNS?.("http://www.w3.org/2000/svg", "rect");
		if (!overlay) return;
		overlay.setAttribute(WIDGETVA_BRUSH_OVERLAY_ATTR, "true");
		overlay.setAttribute("x", String(x));
		overlay.setAttribute("y", String(y));
		overlay.setAttribute("width", String(width));
		overlay.setAttribute("height", String(height));
		overlay.setAttribute("fill", "rgba(250, 204, 21, 0.18)");
		overlay.setAttribute("stroke", "#dc2626");
		overlay.setAttribute("stroke-width", "2");
		overlay.setAttribute("stroke-dasharray", "6 4");
		overlay.setAttribute("pointer-events", "none");
		if (!overlay.parentNode) surface.appendChild(overlay);
	}
	function clearMarkFeedback(mark) {
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
	function renderLineMovingAverageOverlay(surface, paths = []) {
		removeLineMovingAverageOverlay(surface);
		if (!surface || typeof surface?.tagName !== "string" || surface.tagName.toLowerCase() !== "svg" || paths.length === 0) return { applied: false };
		const overlayGroup = createSvgGroupNode(surface);
		if (!overlayGroup) return { applied: false };
		overlayGroup.setAttribute(WIDGETVA_LINE_MA_ATTR, "true");
		overlayGroup.setAttribute("pointer-events", "none");
		paths.forEach((path) => {
			const clone = path.cloneNode?.(true);
			if (!clone) return;
			clone.removeAttribute?.("data-testid");
			clone.setAttribute("stroke", "#f59e0b");
			clone.setAttribute("stroke-width", "3");
			clone.setAttribute("opacity", "0.85");
			clone.setAttribute("fill", "none");
			clone.style.stroke = "#f59e0b";
			clone.style.strokeWidth = "3px";
			clone.style.opacity = "0.85";
			clone.style.filter = "drop-shadow(0 0 4px rgba(245, 158, 11, 0.35))";
			overlayGroup.appendChild(clone);
		});
		surface.appendChild(overlayGroup);
		return {
			applied: true,
			overlayCount: paths.length
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
		const values = inferDrilldownValues(drilldown, readObservableD3LineXAxisLabels(window));
		if (values.length > 0) renderLineSliceOverlay(surface, values);
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
			highlightedValues: values
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
	function pointInsideInterval(point, selection) {
		const xDomain = Array.isArray(selection?.domain?.xDomain) ? selection.domain.xDomain : null;
		const yDomain = Array.isArray(selection?.domain?.yDomain) ? selection.domain.yDomain : null;
		if (!xDomain || !yDomain) return true;
		return point.__screenX >= xDomain[0] && point.__screenX <= xDomain[1] && point.__screenY >= yDomain[0] && point.__screenY <= yDomain[1];
	}
	function applyScatterSelection(selection = null) {
		const { surface, marks } = readSurfaceAndMarks();
		const rows = readObservableD3ScatterRows(window);
		if (!selection) removeBrushOverlay(surface);
		else renderBrushOverlay(surface, selection);
		let selectedCount = 0;
		marks.forEach((circle, index) => {
			const row = rows[index] || null;
			const selected = row && pointInsideInterval(row, selection);
			if (!selection) {
				clearMarkFeedback(circle);
				return;
			}
			if (selected) selectedCount += 1;
			applyMarkFeedback(circle, selected);
		});
		return {
			selectedCount,
			totalCount: rows.length
		};
	}
	function applyBarSelection(selection = null) {
		const { marks } = readSurfaceAndBarMarks();
		const rows = readObservableD3BarRows(window);
		const values = Array.isArray(selection?.values) ? selection.values : [];
		const selectedSet = new Set(values);
		let selectedCount = 0;
		marks.forEach((mark, index) => {
			const row = rows[index] || null;
			if (!selection) {
				clearMarkFeedback(mark);
				mark.style.display = "";
				return;
			}
			const selected = !!row && selectedSet.has(row.category);
			if (selected) selectedCount += 1;
			applyMarkFeedback(mark, selected);
			mark.style.display = "";
		});
		return {
			selectedCount,
			totalCount: rows.length
		};
	}
	function applyBarFilter(filter = null) {
		const { marks } = readSurfaceAndBarMarks();
		const rows = readObservableD3BarRows(window);
		const values = Array.isArray(filter?.categories) ? filter.categories : [];
		const visibleSet = new Set(values);
		let visibleCount = 0;
		marks.forEach((mark, index) => {
			const row = rows[index] || null;
			if (!filter) {
				mark.style.display = "";
				clearMarkFeedback(mark);
				return;
			}
			const visible = !!row && visibleSet.has(row.category);
			if (visible) visibleCount += 1;
			mark.style.display = visible ? "" : "none";
			if (visible) clearMarkFeedback(mark);
		});
		return {
			visibleCount,
			totalCount: rows.length
		};
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
	function mapLinePathsToSeries(surface, paths) {
		const seriesLabels = readLineSeriesLabelEntries(surface);
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
		if (!surface || requested.size === 0) return;
		const plotRegion = findObservableD3PlotRegion(window);
		const xLabels = readLineXAxisLabelEntries(surface).filter((entry) => requested.has(entry.text));
		if (xLabels.length === 0) return;
		const doc = surface.ownerDocument || window.document;
		const host = doc?.body || doc?.documentElement;
		const overlay = doc?.createElement?.("div");
		if (!host || !overlay) return;
		overlay.setAttribute(WIDGETVA_LINE_SLICE_ATTR, "true");
		overlay.style.position = "fixed";
		overlay.style.pointerEvents = "none";
		overlay.style.zIndex = "2147483646";
		xLabels.forEach((entry) => {
			const bar = doc.createElement("div");
			const centerX = entry.rect.left + entry.rect.width / 2;
			bar.style.position = "absolute";
			bar.style.left = `${centerX - 2}px`;
			bar.style.top = `${plotRegion?.screenRect?.top || entry.rect.top}px`;
			bar.style.width = "4px";
			bar.style.height = `${plotRegion?.screenRect?.height || 160}px`;
			bar.style.background = "rgba(220, 38, 38, 0.65)";
			bar.style.boxShadow = "0 0 8px rgba(220, 38, 38, 0.5)";
			overlay.appendChild(bar);
		});
		host.appendChild(overlay);
	}
	function applyLineSelection(selection = null) {
		const { surface, paths } = readSurfaceAndLinePaths();
		const rows = readObservableD3LineRows(window);
		removeLineSliceOverlay(surface);
		if (!selection) {
			mapLinePathsToSeries(surface, paths).forEach(({ path }) => clearMarkFeedback(path));
			return {
				selectedCount: 0,
				totalCount: rows.length
			};
		}
		const field = typeof selection?.field === "string" ? selection.field : null;
		const values = Array.isArray(selection?.values) ? selection.values : [];
		const selectedSet = new Set(values);
		const matchedRows = rows.filter((row) => field && selectedSet.has(row?.[field]));
		if (field === "series") mapLinePathsToSeries(surface, paths).forEach(({ path, series }) => {
			applyMarkFeedback(path, series != null && selectedSet.has(series));
		});
		else if (field === "xValue") renderLineSliceOverlay(surface, values);
		return {
			selectedCount: matchedRows.length,
			totalCount: rows.length
		};
	}
	function applyLineFocus(focus = null) {
		const { surface, paths } = readSurfaceAndLinePaths();
		const mappings = mapLinePathsToSeries(surface, paths);
		if (!focus) {
			mappings.forEach(({ path }) => clearMarkFeedback(path));
			return {
				focusedCount: 0,
				totalCount: mappings.length
			};
		}
		const lines = Array.isArray(focus?.lines) ? focus.lines : [];
		const dimOpacity = Number.isFinite(focus?.dimOpacity) ? Number(focus.dimOpacity) : .08;
		const lineSet = new Set(lines);
		let focusedCount = 0;
		mappings.forEach(({ path, series }) => {
			const focused = series != null && lineSet.has(series);
			if (focused) focusedCount += 1;
			applyLinePathFocusFeedback(path, focused, dimOpacity);
		});
		return {
			focusedCount,
			totalCount: mappings.length
		};
	}
	function applyLineTrend(trend = null) {
		const { surface } = readSurfaceAndLinePaths();
		return renderLineTrendOverlay(surface, trend);
	}
	function applyLineMovingAverage(movingAverage = null) {
		const { surface, paths } = readSurfaceAndLinePaths();
		if (!movingAverage) {
			removeLineMovingAverageOverlay(surface);
			return { applied: false };
		}
		return renderLineMovingAverageOverlay(surface, paths);
	}
	function applyLineDrilldown(drilldown = null) {
		const { surface } = readSurfaceAndLinePaths();
		if (!drilldown) {
			removeLineDrilldownOverlay(surface);
			removeLineSliceOverlay(surface);
			return { applied: false };
		}
		return renderLineDrilldownOverlay(surface, drilldown);
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
			mark.setAttribute?.("opacity", "0.9");
			mark.setAttribute?.("fill-opacity", "0.95");
			mark.setAttribute?.("fill", color);
			mark.setAttribute?.("stroke", "#111827");
			mark.setAttribute?.("stroke-width", "1");
			mark.style.opacity = "0.9";
			mark.style.fillOpacity = "0.95";
			mark.style.fill = color;
			mark.style.stroke = "#111827";
			mark.style.strokeWidth = "1px";
			mark.style.filter = "";
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
	function applyScatterViewport(viewport = null) {
		const { surface } = readSurfaceAndMarks();
		if (!surface || typeof surface?.tagName !== "string" || surface.tagName.toLowerCase() !== "svg") {
			currentViewport = viewport && typeof viewport === "object" ? viewport : null;
			return {
				viewport: currentViewport,
				applied: false,
				reason: "Observable D3 viewport zoom currently requires an SVG surface."
			};
		}
		const xDomain = Array.isArray(viewport?.xDomain) ? viewport.xDomain : null;
		const yDomain = Array.isArray(viewport?.yDomain) ? viewport.yDomain : null;
		if (!xDomain && !yDomain) {
			const originalViewBox = surface.getAttribute(WIDGETVA_VIEWBOX_CACHE_ATTR);
			if (originalViewBox != null && originalViewBox !== "") surface.setAttribute("viewBox", originalViewBox);
			else surface.removeAttribute("viewBox");
			currentViewport = null;
			return {
				viewport: null,
				applied: true
			};
		}
		if (!surface.hasAttribute(WIDGETVA_VIEWBOX_CACHE_ATTR)) {
			const initialViewBox = surface.getAttribute("viewBox");
			surface.setAttribute(WIDGETVA_VIEWBOX_CACHE_ATTR, initialViewBox == null ? "" : initialViewBox);
		}
		const surfaceRect = readRectLike(surface);
		const localLeft = xDomain ? Math.min(...xDomain) - surfaceRect.left : 0;
		const localTop = yDomain ? Math.min(...yDomain) - surfaceRect.top : 0;
		const localRight = xDomain ? Math.max(...xDomain) - surfaceRect.left : surfaceRect.width;
		const localBottom = yDomain ? Math.max(...yDomain) - surfaceRect.top : surfaceRect.height;
		const localWidth = Math.max(localRight - localLeft, 1);
		const localHeight = Math.max(localBottom - localTop, 1);
		surface.setAttribute("viewBox", `${localLeft} ${localTop} ${localWidth} ${localHeight}`);
		currentViewport = {
			...xDomain ? { xDomain: [...xDomain] } : {},
			...yDomain ? { yDomain: [...yDomain] } : {}
		};
		return {
			viewport: currentViewport,
			applied: true,
			viewBox: [
				localLeft,
				localTop,
				localWidth,
				localHeight
			]
		};
	}
	function applyLineViewport(viewport = null) {
		const { surface } = readSurfaceAndLinePaths();
		if (!surface || typeof surface?.tagName !== "string" || surface.tagName.toLowerCase() !== "svg") {
			currentLineViewport = viewport && typeof viewport === "object" ? viewport : null;
			return {
				viewport: currentLineViewport,
				applied: false,
				reason: "Observable D3 line viewport zoom currently requires an SVG surface."
			};
		}
		const xDomain = Array.isArray(viewport?.xDomain) ? viewport.xDomain : null;
		if (!xDomain) {
			const originalViewBox = surface.getAttribute(WIDGETVA_VIEWBOX_CACHE_ATTR);
			if (originalViewBox != null && originalViewBox !== "") surface.setAttribute("viewBox", originalViewBox);
			else surface.removeAttribute("viewBox");
			currentLineViewport = null;
			return {
				viewport: null,
				applied: true
			};
		}
		const parsedStart = parseComparableAxisValue(xDomain[0]);
		const parsedEnd = parseComparableAxisValue(xDomain[1]);
		if (parsedStart == null || parsedEnd == null) {
			currentLineViewport = { xDomain: [...xDomain] };
			return {
				viewport: currentLineViewport,
				applied: false,
				reason: "Line x-domain values could not be parsed."
			};
		}
		const low = compareComparableAxisValue(parsedStart, parsedEnd) <= 0 ? parsedStart : parsedEnd;
		const high = compareComparableAxisValue(parsedStart, parsedEnd) <= 0 ? parsedEnd : parsedStart;
		const plotRegion = findObservableD3PlotRegion(window);
		const labelEntries = readLineXAxisLabelEntries(surface).map((entry) => ({
			...entry,
			comparable: parseComparableAxisValue(entry.text)
		})).filter((entry) => entry.comparable != null).filter((entry) => compareComparableAxisValue(entry.comparable, low) >= 0 && compareComparableAxisValue(entry.comparable, high) <= 0);
		if (!surface.hasAttribute(WIDGETVA_VIEWBOX_CACHE_ATTR)) {
			const initialViewBox = surface.getAttribute("viewBox");
			surface.setAttribute(WIDGETVA_VIEWBOX_CACHE_ATTR, initialViewBox == null ? "" : initialViewBox);
		}
		if (labelEntries.length === 0) {
			currentLineViewport = { xDomain: [...xDomain] };
			return {
				viewport: currentLineViewport,
				applied: false,
				reason: "No visible x-axis labels matched the requested line x-domain."
			};
		}
		const surfaceRect = readRectLike(surface);
		const plotLocal = plotRegion?.localRect || {
			left: 0,
			top: 0,
			width: surfaceRect.width,
			height: surfaceRect.height
		};
		const centers = labelEntries.map((entry) => entry.rect.left + entry.rect.width / 2);
		const leftPx = Math.min(...centers);
		const rightPx = Math.max(...centers);
		const left = Math.max(leftPx - surfaceRect.left - 24, plotLocal.left);
		const right = Math.min(rightPx - surfaceRect.left + 24, plotLocal.left + plotLocal.width);
		const width = Math.max(right - left, 1);
		const top = plotLocal.top;
		const height = Math.max(plotLocal.height, 1);
		surface.setAttribute("viewBox", `${left} ${top} ${width} ${height}`);
		currentLineViewport = { xDomain: [...xDomain] };
		return {
			viewport: currentLineViewport,
			applied: true,
			matchedLabels: labelEntries.map((entry) => entry.text),
			viewBox: [
				left,
				top,
				width,
				height
			]
		};
	}
	function readDebugSnapshot() {
		const { surface, marks } = readSurfaceAndMarks();
		const rows = readObservableD3ScatterRows(window);
		return {
			route: "worker",
			surface: describeObservableD3Surface(window),
			plotRegion: findObservableD3PlotRegion(window),
			surfaceRect: readRectLike(surface),
			markCount: marks.length,
			rowSummary: summarizeObservableD3ScatterRows(rows),
			viewport: currentViewport,
			barRows: readObservableD3BarRows(window),
			lineRows: readObservableD3LineRows(window)
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
			else if (message.method === "readScatterRows") result = { rows: readObservableD3ScatterRows(window) };
			else if (message.method === "readBarRows") result = { rows: readObservableD3BarRows(window) };
			else if (message.method === "readLineRows") result = { rows: readObservableD3LineRows(window) };
			else if (message.method === "applyScatterSelection") result = applyScatterSelection(message.params?.selection || null);
			else if (message.method === "applyBarSelection") result = applyBarSelection(message.params?.selection || null);
			else if (message.method === "applyBarFilter") result = applyBarFilter(message.params?.filter || null);
			else if (message.method === "applyBarSort") result = applyBarSort(message.params?.sort || null);
			else if (message.method === "applyLineSelection") result = applyLineSelection(message.params?.selection || null);
			else if (message.method === "applyLineFocus") result = applyLineFocus(message.params?.focus || null);
			else if (message.method === "applyLineTrend") result = applyLineTrend(message.params?.trend || null);
			else if (message.method === "applyLineMovingAverage") result = applyLineMovingAverage(message.params?.movingAverage || null);
			else if (message.method === "applyLineDrilldown") result = applyLineDrilldown(message.params?.drilldown || null);
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
