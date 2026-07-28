const DESCRIPTORS = [
  {
    "name": "parallelCoordinates.selectRecord",
    "description": "Select one visible record by id so linked views can focus or compare that record without needing a brush gesture.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "recordId": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "number"
            }
          ]
        },
        "field": {
          "type": "string"
        },
        "queryScope": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "dataRef": {
              "type": "string"
            },
            "selectionRef": {
              "type": "string"
            },
            "focusRef": {
              "type": "string"
            },
            "viewportRef": {
              "type": "string"
            }
          }
        }
      },
      "required": [
        "recordId"
      ]
    },
    "examples": [
      {
        "userGoal": "Select one car record in the parallel view before checking the same car across other linked views.",
        "params": {
          "field": "id",
          "recordId": "toyota-corona-mark-ii"
        }
      }
    ]
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
          "items": {
            "type": "string"
          }
        },
        "queryScope": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "dataRef": {
              "type": "string"
            },
            "selectionRef": {
              "type": "string"
            },
            "focusRef": {
              "type": "string"
            },
            "viewportRef": {
              "type": "string"
            }
          }
        }
      },
      "required": [
        "dimensionOrder"
      ]
    },
    "examples": [
      {
        "userGoal": "Move the most important dimensions to the front before comparing multivariate trends.",
        "params": {
          "dimensionOrder": [
            "Weight",
            "Horsepower",
            "Miles_per_Gallon"
          ]
        }
      }
    ]
  },
  {
    "name": "parallelCoordinates.filterDimension",
    "description": "Filter rows by a numeric range on one named dimension, inserting the predicate before the fold stage when the view is defined in wide format.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "dimension": {
          "type": "string"
        },
        "range": {
          "type": "array",
          "minItems": 2,
          "maxItems": 2,
          "items": {
            "type": "number"
          }
        },
        "queryScope": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "dataRef": {
              "type": "string"
            },
            "selectionRef": {
              "type": "string"
            },
            "focusRef": {
              "type": "string"
            },
            "viewportRef": {
              "type": "string"
            }
          }
        }
      },
      "required": [
        "dimension",
        "range"
      ]
    },
    "examples": [
      {
        "userGoal": "Keep only rows whose horsepower falls inside a specific corridor before comparing the remaining multivariate trajectories.",
        "params": {
          "dimension": "Horsepower",
          "range": [
            80,
            160
          ]
        }
      }
    ]
  },
  {
    "name": "parallelCoordinates.filterByCategory",
    "description": "Exclude rows whose category field matches one or more requested values, inserting the predicate before the fold stage when the view is defined in wide format.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "field": {
          "type": "string"
        },
        "values": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "string"
          }
        },
        "queryScope": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "dataRef": {
              "type": "string"
            },
            "selectionRef": {
              "type": "string"
            },
            "focusRef": {
              "type": "string"
            },
            "viewportRef": {
              "type": "string"
            }
          }
        }
      },
      "required": [
        "field",
        "values"
      ]
    },
    "examples": [
      {
        "userGoal": "Exclude one or more categories before comparing the remaining multivariate trajectories.",
        "params": {
          "field": "Origin",
          "values": [
            "USA",
            "Japan"
          ]
        }
      }
    ]
  },
  {
    "name": "parallelCoordinates.highlightCategory",
    "description": "Visually emphasize one or more category values by keeping matching trajectories fully opaque and dimming the rest.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "field": {
          "type": "string"
        },
        "values": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "string"
          }
        },
        "queryScope": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "dataRef": {
              "type": "string"
            },
            "selectionRef": {
              "type": "string"
            },
            "focusRef": {
              "type": "string"
            },
            "viewportRef": {
              "type": "string"
            }
          }
        }
      },
      "required": [
        "field",
        "values"
      ]
    },
    "examples": [
      {
        "userGoal": "Highlight a few categories before comparing their multivariate trajectories against the background population.",
        "params": {
          "field": "Origin",
          "values": [
            "USA",
            "Japan"
          ]
        }
      }
    ]
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
          "items": {
            "type": "string"
          }
        },
        "mode": {
          "type": "string",
          "enum": [
            "hide",
            "show"
          ]
        },
        "queryScope": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "dataRef": {
              "type": "string"
            },
            "selectionRef": {
              "type": "string"
            },
            "focusRef": {
              "type": "string"
            },
            "viewportRef": {
              "type": "string"
            }
          }
        }
      },
      "required": [
        "dimensions"
      ]
    },
    "examples": [
      {
        "userGoal": "Temporarily hide weight from a crowded parallel-coordinates view.",
        "params": {
          "dimensions": [
            "Weight"
          ]
        }
      },
      {
        "userGoal": "Restore one previously hidden dimension without resetting the full view.",
        "params": {
          "dimensions": [
            "Weight"
          ],
          "mode": "show"
        }
      }
    ]
  },
  {
    "name": "parallelCoordinates.resetHiddenDimensions",
    "description": "Restore the full original dimension order after one or more dimensions have been hidden from a parallel coordinates view.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "queryScope": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "dataRef": {
              "type": "string"
            },
            "selectionRef": {
              "type": "string"
            },
            "focusRef": {
              "type": "string"
            },
            "viewportRef": {
              "type": "string"
            }
          }
        }
      }
    },
    "examples": [
      {
        "userGoal": "Restore every temporarily hidden dimension after a focused inspection pass.",
        "params": {}
      }
    ]
  }
]

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function parallelCoordinatesCapabilities(spec) {
  const transforms = Array.isArray(spec?.transform) ? spec.transform : []
  const foldTransform = transforms.find((transform) => transform && typeof transform === 'object' && Array.isArray(transform.fold))
  const hiddenState = spec?._pc_hidden_state && typeof spec._pc_hidden_state === 'object' ? spec._pc_hidden_state : null
  const allDimensions = Array.isArray(hiddenState?.all_dimensions) && hiddenState.all_dimensions.length > 0
    ? hiddenState.all_dimensions
    : (Array.isArray(foldTransform?.fold) ? foldTransform.fold : [])
  return {
    hasDimensionList: Array.isArray(allDimensions) && allDimensions.length > 0,
    hasHiddenDimensionsState: Array.isArray(hiddenState?.all_dimensions)
      && hiddenState.all_dimensions.length > 0
      && Array.isArray(hiddenState?.hidden)
      && hiddenState.hidden.length > 0,
  }
}

function filterDescriptorsBySpec(descriptors, widgetSpec) {
  if (!widgetSpec) return descriptors
  const { hasDimensionList, hasHiddenDimensionsState } = parallelCoordinatesCapabilities(widgetSpec)
  return descriptors.filter((descriptor) => {
    if (!descriptor?.name) return true
    if (descriptor.name === 'parallelCoordinates.reorderDimensions' || descriptor.name === 'parallelCoordinates.hideDimensions') return hasDimensionList
    if (descriptor.name === 'parallelCoordinates.resetHiddenDimensions') return hasHiddenDimensionsState
    return true
  })
}

export function buildParallelCoordinatesActionDescriptors({ widgetSpec = null } = {}) {
  return filterDescriptorsBySpec(DESCRIPTORS, widgetSpec).map(clone)
}
