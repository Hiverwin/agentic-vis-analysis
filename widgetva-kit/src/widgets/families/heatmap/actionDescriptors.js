const DESCRIPTORS = [
  {
    "name": "heatmap.filterCells",
    "description": "Filter the workspace through a heatmap cell identified by its x/y category pair.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "xField": {
          "type": "string"
        },
        "yField": {
          "type": "string"
        },
        "xValue": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "number"
            }
          ]
        },
        "yValue": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "number"
            }
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
        "xField",
        "yField",
        "xValue",
        "yValue"
      ]
    },
    "examples": [
      {
        "userGoal": "Select one heatmap cell and inspect linked detail views.",
        "params": {
          "xField": "Origin",
          "yField": "Cylinders",
          "xValue": "Japan",
          "yValue": "4"
        }
      }
    ]
  },
  {
    "name": "heatmap.selectCell",
    "description": "Select a single heatmap cell through the canonical heatmap cell contract.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "xField": {
          "type": "string"
        },
        "yField": {
          "type": "string"
        },
        "xValue": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "number"
            }
          ]
        },
        "yValue": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "number"
            }
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
        "xField",
        "yField",
        "xValue",
        "yValue"
      ]
    },
    "examples": [
      {
        "userGoal": "Select one heatmap cell and inspect linked detail views.",
        "params": {
          "xField": "Origin",
          "yField": "Cylinders",
          "xValue": "Japan",
          "yValue": "4"
        }
      }
    ]
  },
  {
    "name": "heatmap.selectSubmatrix",
    "description": "Select a heatmap submatrix defined by one or more x-axis and/or y-axis coordinates without mutating the view spec.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "xValues": {
          "type": "array",
          "items": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "number"
              }
            ]
          }
        },
        "yValues": {
          "type": "array",
          "items": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "number"
              }
            ]
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
      }
    },
    "examples": [
      {
        "userGoal": "Select a rectangular region of the heatmap before inspecting linked views.",
        "params": {
          "xValues": [
            "Q1",
            "Q2"
          ],
          "yValues": [
            "A",
            "B"
          ]
        }
      }
    ]
  },
  {
    "name": "heatmap.drilldownAxis",
    "description": "Drill a temporal heatmap x-axis from year to month or from month to date by narrowing the visible period and refining the x-axis timeUnit.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "level": {
          "type": "string"
        },
        "value": {
          "anyOf": [
            {
              "type": "number"
            },
            {
              "type": "string"
            }
          ]
        },
        "parent": {
          "type": "object"
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
        "level",
        "value"
      ]
    },
    "examples": [
      {
        "userGoal": "Drill a yearly heatmap into monthly detail for one year.",
        "params": {
          "level": "year",
          "value": 2024
        }
      }
    ]
  },
  {
    "name": "heatmap.resetDrilldown",
    "description": "Restore the original temporal x-axis encoding and remove drill-down filters from the heatmap.",
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
        "userGoal": "Return a drilled heatmap back to its original yearly overview.",
        "params": {}
      }
    ]
  },
  {
    "name": "heatmap.addMarginalBars",
    "description": "Compose a heatmap with optional top and right marginal bar charts that aggregate the heatmap value field along each axis.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "op": {
          "type": "string"
        },
        "showTop": {
          "type": "boolean"
        },
        "showRight": {
          "type": "boolean"
        },
        "barSize": {
          "type": "number"
        },
        "barColor": {
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
      }
    },
    "examples": [
      {
        "userGoal": "Add row and column marginal summaries before comparing the overall heatmap structure.",
        "params": {
          "op": "mean",
          "showTop": true,
          "showRight": true,
          "barSize": 70,
          "barColor": "#666666"
        }
      }
    ]
  },
  {
    "name": "heatmap.highlightRegion",
    "description": "Highlight one or more heatmap rows, columns, or their intersection without filtering away the rest of the matrix.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "xValues": {
          "type": "array",
          "items": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "number"
              }
            ]
          }
        },
        "yValues": {
          "type": "array",
          "items": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "number"
              }
            ]
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
      }
    },
    "examples": [
      {
        "userGoal": "Highlight one row/column region before comparing extreme cells.",
        "params": {
          "xValues": [
            "Q1"
          ],
          "yValues": [
            "A"
          ]
        }
      }
    ]
  },
  {
    "name": "heatmap.adjustColorScale",
    "description": "Update the heatmap color scheme and optional numeric domain without changing the underlying data.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "scheme": {
          "type": "string"
        },
        "domain": {
          "type": "array",
          "minItems": 2,
          "maxItems": 2,
          "items": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "string"
              }
            ]
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
      }
    },
    "examples": [
      {
        "userGoal": "Switch to a new color scheme and tighten the value range for comparison.",
        "params": {
          "scheme": "blues",
          "domain": [
            0,
            25
          ]
        }
      }
    ]
  },
  {
    "name": "heatmap.thresholdMask",
    "description": "Visually dim heatmap cells whose color values fall outside the requested threshold range. Provide minValue, maxValue, or both.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "minValue": {
          "anyOf": [
            {
              "type": "number"
            },
            {
              "type": "string"
            }
          ]
        },
        "maxValue": {
          "anyOf": [
            {
              "type": "number"
            },
            {
              "type": "string"
            }
          ]
        },
        "outsideOpacity": {
          "type": "number"
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
      "anyOf": [
        {
          "required": [
            "minValue"
          ]
        },
        {
          "required": [
            "maxValue"
          ]
        }
      ]
    },
    "examples": [
      {
        "userGoal": "Dim low-signal cells while keeping the full matrix visible.",
        "params": {
          "minValue": 10,
          "maxValue": 25,
          "outsideOpacity": 0.1
        }
      }
    ]
  },
  {
    "name": "heatmap.filterCellsByRegion",
    "description": "Exclude one or more heatmap rows, columns, or their intersection by writing a region filter into the heatmap spec.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "xValue": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "number"
            }
          ]
        },
        "yValue": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "number"
            }
          ]
        },
        "xValues": {
          "type": "array",
          "items": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "number"
              }
            ]
          }
        },
        "yValues": {
          "type": "array",
          "items": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "number"
              }
            ]
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
      }
    },
    "examples": [
      {
        "userGoal": "Remove one heatmap row-column intersection before inspecting the remaining structure.",
        "params": {
          "xValues": [
            "Q1"
          ],
          "yValues": [
            "A"
          ]
        }
      }
    ]
  },
  {
    "name": "heatmap.highlightRegionByValue",
    "description": "Visually emphasize cells whose displayed values fall inside a requested range, while dimming the rest without filtering data away.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "minValue": {
          "anyOf": [
            {
              "type": "number"
            },
            {
              "type": "string"
            }
          ]
        },
        "maxValue": {
          "anyOf": [
            {
              "type": "number"
            },
            {
              "type": "string"
            }
          ]
        },
        "outsideOpacity": {
          "type": "number"
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
      }
    },
    "examples": [
      {
        "userGoal": "Highlight only mid-range or high-value cells before comparing hotspots.",
        "params": {
          "minValue": 10,
          "maxValue": 25,
          "outsideOpacity": 0.12
        }
      }
    ]
  },
  {
    "name": "heatmap.clusterRowsCols",
    "description": "Reorder heatmap rows and/or columns by aggregated cell values so high-value bands are grouped toward the front.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "clusterRows": {
          "type": "boolean"
        },
        "clusterCols": {
          "type": "boolean"
        },
        "method": {
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
      }
    },
    "examples": [
      {
        "userGoal": "Bring the hottest rows and columns toward the front of the matrix.",
        "params": {
          "clusterRows": true,
          "clusterCols": true,
          "method": "sum"
        }
      }
    ]
  },
  {
    "name": "heatmap.transpose",
    "description": "Swap the heatmap x and y encodings to quickly inspect the matrix from the opposite orientation.",
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
        "userGoal": "Flip rows and columns to compare the matrix from the opposite orientation.",
        "params": {}
      }
    ]
  }
]

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function rootEncoding(spec) {
  return spec?.layer?.[0]?.encoding || spec?.encoding || {}
}

function heatmapCapabilities(spec) {
  const encoding = rootEncoding(spec)
  const hasXAxis = typeof encoding?.x?.field === 'string' && encoding.x.field.length > 0
  const hasYAxis = typeof encoding?.y?.field === 'string' && encoding.y.field.length > 0
  const hasAxes = hasXAxis && hasYAxis
  const hasColorField = typeof encoding?.color?.field === 'string' && encoding.color.field.length > 0
  const hasTemporalXAxis = encoding?.x?.type === 'temporal' || typeof encoding?.x?.timeUnit === 'string'
  return { hasAxes, hasColorField, hasTemporalXAxis }
}

function filterDescriptorsBySpec(descriptors, widgetSpec) {
  if (!widgetSpec) return descriptors
  const { hasAxes, hasColorField, hasTemporalXAxis } = heatmapCapabilities(widgetSpec)
  return descriptors.filter((descriptor) => {
    if (!descriptor?.name) return true
    if ([
      'heatmap.filterCells',
      'heatmap.selectCell',
      'heatmap.selectSubmatrix',
      'heatmap.highlightRegion',
      'heatmap.filterCellsByRegion',
      'heatmap.transpose',
    ].includes(descriptor.name)) return hasAxes
    if ([
      'heatmap.addMarginalBars',
      'heatmap.adjustColorScale',
      'heatmap.thresholdMask',
      'heatmap.highlightRegionByValue',
      'heatmap.clusterRowsCols',
    ].includes(descriptor.name)) return hasAxes && hasColorField
    if (descriptor.name === 'heatmap.drilldownAxis' || descriptor.name === 'heatmap.resetDrilldown') return hasAxes && hasTemporalXAxis
    return true
  })
}

export function buildHeatmapActionDescriptors({ widgetSpec = null } = {}) {
  return filterDescriptorsBySpec(DESCRIPTORS, widgetSpec).map(clone)
}
