const DESCRIPTORS = [
  {
    "name": "line.selectSeries",
    "description": "Select one or more categorical series represented in the line chart.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "field": {
          "type": "string"
        },
        "values": {
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
      },
      "required": [
        "field",
        "values"
      ]
    },
    "examples": [
      {
        "userGoal": "Focus one or more line series before comparing trends.",
        "params": {
          "field": "Origin",
          "values": [
            "Japan"
          ]
        }
      }
    ]
  },
  {
    "name": "line.selectXValue",
    "description": "Select all visible line rows that share one x-axis value, such as one year or one named category bucket.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "value": {
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
        "value"
      ]
    },
    "examples": [
      {
        "userGoal": "Select one model year across the line view before checking linked distributions and details.",
        "params": {
          "field": "year",
          "value": 1971
        }
      }
    ]
  },
  {
    "name": "line.zoomXRegion",
    "description": "Zoom the temporal x-axis of the line chart to a specific start/end range without discarding data.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "start": {
          "type": "string"
        },
        "end": {
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
        "start",
        "end"
      ]
    },
    "examples": [
      {
        "userGoal": "Zoom into a particular date range to inspect the detailed trend.",
        "params": {
          "start": "2024-01-01",
          "end": "2024-02-01"
        }
      }
    ]
  },
  {
    "name": "line.focusLines",
    "description": "Emphasize one or more line series while dimming the remaining lines.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "lines": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "lineField": {
          "type": "string"
        },
        "dimOpacity": {
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
      "required": [
        "lines"
      ]
    },
    "examples": [
      {
        "userGoal": "Focus a subset of line series before comparing their trends.",
        "params": {
          "lines": [
            "A"
          ],
          "lineField": "series",
          "dimOpacity": 0.08
        }
      }
    ]
  },
  {
    "name": "line.highlightTrend",
    "description": "Add or refresh a regression trend line layer over the existing line chart.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "trendType": {
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
        "userGoal": "Add a regression overlay before describing the overall trend direction.",
        "params": {
          "trendType": "increasing"
        }
      }
    ]
  },
  {
    "name": "line.showMovingAverage",
    "description": "Add or replace a moving-average overlay line computed from the current temporal/value encodings, optionally grouped by line series.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "windowSize": {
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
        "userGoal": "Smooth a noisy line chart with a 3-period trailing moving average.",
        "params": {
          "windowSize": 3
        }
      }
    ]
  },
  {
    "name": "line.drillDownXAxis",
    "description": "Drill a temporal line chart from a coarser time aggregation into a more detailed x-axis view.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "level": {
          "type": "string"
        },
        "value": {
          "type": "number"
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
        "userGoal": "Drill a yearly trend into monthly detail for a specific year.",
        "params": {
          "level": "year",
          "value": 2024
        }
      }
    ]
  },
  {
    "name": "line.resetDrilldownXAxis",
    "description": "Restore the original line chart encoding, transforms, and title after a temporal drill-down.",
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
        "userGoal": "Return from a drilled monthly view back to the original yearly chart.",
        "params": {}
      }
    ]
  },
  {
    "name": "line.resampleXAxis",
    "description": "Change the temporal aggregation granularity of a line chart and apply an aggregate to the value axis.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "granularity": {
          "type": "string"
        },
        "agg": {
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
        "granularity"
      ]
    },
    "examples": [
      {
        "userGoal": "Switch a dense daily series into monthly mean values before comparing long-term trends.",
        "params": {
          "granularity": "month",
          "agg": "mean"
        }
      }
    ]
  },
  {
    "name": "line.resetResampleXAxis",
    "description": "Restore the original temporal encoding after a line x-axis resampling operation.",
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
        "userGoal": "Return a resampled monthly line chart back to its original daily granularity.",
        "params": {}
      }
    ]
  },
  {
    "name": "line.boldLines",
    "description": "Increase the stroke width of one or more line series while keeping the remaining lines thin.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "lineNames": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "lineField": {
          "type": "string"
        },
        "boldWidth": {
          "type": "number"
        },
        "baseWidth": {
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
      "required": [
        "lineNames"
      ]
    },
    "examples": [
      {
        "userGoal": "Make one or more line series stand out before comparing the trends.",
        "params": {
          "lineNames": [
            "A"
          ],
          "lineField": "series",
          "boldWidth": 4,
          "baseWidth": 1
        }
      }
    ]
  },
  {
    "name": "line.filterLines",
    "description": "Exclude one or more line series from the current chart by writing a series filter into the line spec.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "linesToRemove": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "lineField": {
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
        "linesToRemove"
      ]
    },
    "examples": [
      {
        "userGoal": "Remove noisy or irrelevant series before comparing the remaining trends.",
        "params": {
          "linesToRemove": [
            "B"
          ],
          "lineField": "series"
        }
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

function inferRawTimeField(spec, encoding, transforms) {
  const timeUnitTransform = (Array.isArray(transforms) ? transforms : []).find(
    (transform) => transform && typeof transform === 'object' && transform.timeUnit,
  )
  if (timeUnitTransform?.field) return timeUnitTransform.field
  const xField = encoding?.x?.field
  return typeof xField === 'string' && xField.length > 0 ? xField : null
}

function inferRawValueField(spec, encoding, transforms) {
  const aggregateTransform = (Array.isArray(transforms) ? transforms : []).find(
    (transform) => transform && typeof transform === 'object' && Array.isArray(transform.aggregate) && transform.aggregate.length > 0,
  )
  if (aggregateTransform?.aggregate?.[0]?.field) return aggregateTransform.aggregate[0].field
  const yField = encoding?.y?.field
  return typeof yField === 'string' && yField.length > 0 ? yField.replace(/^total_/, '').replace(/^sum_/, '') : null
}

function lineCapabilities(spec) {
  const encoding = rootEncoding(spec)
  const transforms = Array.isArray(spec?.transform) ? spec.transform : []
  const xField = typeof encoding?.x?.field === 'string' && encoding.x.field.length > 0 ? encoding.x.field : null
  const yField = typeof encoding?.y?.field === 'string' && encoding.y.field.length > 0 ? encoding.y.field : null
  const groupingField = typeof encoding?.color?.field === 'string' && encoding.color.field.length > 0
    ? encoding.color.field
    : (typeof encoding?.detail?.field === 'string' && encoding.detail.field.length > 0 ? encoding.detail.field : null)
  const hasTemporalAxis = encoding?.x?.type === 'temporal'
    || encoding?.y?.type === 'temporal'
    || typeof encoding?.x?.timeUnit === 'string'
    || typeof encoding?.y?.timeUnit === 'string'
  return {
    hasXField: Boolean(xField),
    hasXYFields: Boolean(xField && yField),
    hasGroupingField: Boolean(groupingField),
    hasTemporalAxis,
    hasDrilldownFields: Boolean(inferRawTimeField(spec, encoding, transforms) && inferRawValueField(spec, encoding, transforms)),
  }
}

function filterDescriptorsBySpec(descriptors, widgetSpec) {
  if (!widgetSpec) return descriptors
  const { hasXField, hasXYFields, hasGroupingField, hasTemporalAxis, hasDrilldownFields } = lineCapabilities(widgetSpec)
  return descriptors.filter((descriptor) => {
    if (!descriptor?.name) return true
    if (descriptor.name === 'line.selectXValue' || descriptor.name === 'line.zoomXRegion') return hasXField
    if (descriptor.name === 'line.focusLines' || descriptor.name === 'line.boldLines' || descriptor.name === 'line.filterLines') return hasGroupingField
    if (descriptor.name === 'line.highlightTrend' || descriptor.name === 'line.showMovingAverage') return hasXYFields
    if (descriptor.name === 'line.drillDownXAxis' || descriptor.name === 'line.resetDrilldownXAxis') return hasTemporalAxis && hasDrilldownFields
    if (descriptor.name === 'line.resampleXAxis' || descriptor.name === 'line.resetResampleXAxis') return hasTemporalAxis
    return true
  })
}

export function buildLineActionDescriptors({ widgetSpec = null } = {}) {
  return filterDescriptorsBySpec(DESCRIPTORS, widgetSpec).map(clone)
}
