import { cloneJsonValue as clone } from '../../../shared/clone.js'
const DESCRIPTORS = [
  {
    "name": "bar.clickCategory",
    "description": "Click one or more categorical groups represented by bars and preserve the chart context, matching the page’s existing in-place category emphasis when available.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "field": {
          "type": "string"
        },
        "values": {
          "type": "array",
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
        "userGoal": "Click the sun bar so linked views react the same way as the existing Vega bar click.",
        "params": {
          "field": "weather",
          "values": [
            "sun"
          ]
        }
      }
    ]
  },
  {
    "name": "bar.selectCategory",
    "description": "Select one or more categorical groups represented by bars while preserving the surrounding chart context.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "field": {
          "type": "string"
        },
        "values": {
          "type": "array",
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
        "userGoal": "Select a subset of categories from the summary bar chart.",
        "params": {
          "field": "Origin",
          "values": [
            "Japan",
            "USA"
          ]
        }
      }
    ]
  },
  {
    "name": "bar.sortBars",
    "description": "Sort bar groups by the requested order and optional field.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "channel": {
          "type": "string"
        },
        "order": {
          "type": "string",
          "enum": [
            "ascending",
            "descending"
          ]
        },
        "field": {
          "type": "string"
        },
        "aggregate": {
          "type": "string"
        },
        "bySubcategory": {
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
        "channel",
        "order"
      ]
    },
    "examples": [
      {
        "userGoal": "Sort the bar chart descending by the aggregated measure.",
        "params": {
          "channel": "x",
          "order": "descending"
        }
      },
      {
        "userGoal": "Sort grouped or stacked categories using one specific subcategory as the ranking signal.",
        "params": {
          "channel": "x",
          "order": "descending",
          "bySubcategory": "Type1"
        }
      }
    ]
  },
  {
    "name": "bar.highlightTopN",
    "description": "Visually emphasize the top-N categories by measure while dimming the remaining bars.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "n": {
          "type": "number"
        },
        "order": {
          "type": "string",
          "enum": [
            "ascending",
            "descending"
          ]
        },
        "categoryField": {
          "type": "string"
        },
        "measureField": {
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
        "n"
      ]
    },
    "examples": [
      {
        "userGoal": "Highlight only the top 5 categories by value before comparing them.",
        "params": {
          "n": 5,
          "order": "descending",
          "categoryField": "category",
          "measureField": "value"
        }
      }
    ]
  },
  {
    "name": "bar.filterCategories",
    "description": "Filter the bar chart to a requested set of categories while leaving the other encodings intact.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "categories": {
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
        "categories"
      ]
    },
    "examples": [
      {
        "userGoal": "Keep only a few categories before comparing them in detail.",
        "params": {
          "categories": [
            "A",
            "C"
          ],
          "field": "category"
        }
      }
    ]
  },
  {
    "name": "bar.addBars",
    "description": "Expand the managed visible-category set of a bar chart by adding one or more category bars back into the visibility filter.",
    "paramsSchema": {
      "type": "object",
      "properties": {
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
        "values"
      ]
    },
    "examples": [
      {
        "userGoal": "Add previously hidden categories back into the current bar comparison without resetting the rest of the view.",
        "params": {
          "values": [
            "East",
            "West"
          ],
          "field": "category"
        }
      }
    ]
  },
  {
    "name": "bar.removeBars",
    "description": "Shrink the managed visible-category set of a bar chart by removing one or more category bars from the visibility filter.",
    "paramsSchema": {
      "type": "object",
      "properties": {
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
        "values"
      ]
    },
    "examples": [
      {
        "userGoal": "Temporarily remove several categories from the current bar comparison without resetting the rest of the view.",
        "params": {
          "values": [
            "East",
            "West"
          ],
          "field": "category"
        }
      }
    ]
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
              "x": {
                "anyOf": [
                  {
                    "type": "string"
                  },
                  {
                    "type": "number"
                  }
                ]
              },
              "sub": {
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
            "required": [
              "x",
              "sub"
            ]
          }
        },
        "xField": {
          "type": "string"
        },
        "subField": {
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
        "items"
      ]
    },
    "examples": [
      {
        "userGoal": "Bring a few grouped or stacked members back into the current comparison without resetting the whole chart.",
        "params": {
          "items": [
            {
              "x": "A",
              "sub": "Type2"
            }
          ],
          "xField": "category",
          "subField": "type"
        }
      }
    ]
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
              "x": {
                "anyOf": [
                  {
                    "type": "string"
                  },
                  {
                    "type": "number"
                  }
                ]
              },
              "sub": {
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
            "required": [
              "x",
              "sub"
            ]
          }
        },
        "xField": {
          "type": "string"
        },
        "subField": {
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
        "items"
      ]
    },
    "examples": [
      {
        "userGoal": "Temporarily remove a few grouped or stacked members from the current comparison without resetting the whole chart.",
        "params": {
          "items": [
            {
              "x": "A",
              "sub": "Type2"
            }
          ],
          "xField": "category",
          "subField": "type"
        }
      }
    ]
  },
  {
    "name": "bar.filterSubcategories",
    "description": "Exclude one or more grouped or stacked subcategories from the current bar chart while preserving the remaining categories.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "subcategoriesToRemove": {
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
        "subField": {
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
        "subcategoriesToRemove"
      ]
    },
    "examples": [
      {
        "userGoal": "Remove several grouped or stacked subcategories before comparing the remaining composition.",
        "params": {
          "subcategoriesToRemove": [
            "Type2"
          ],
          "subField": "type"
        }
      }
    ]
  },
  {
    "name": "bar.expandStack",
    "description": "Filter to one category from a stacked bar chart and expand its stacked segments into parallel bars for easier comparison.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "category": {
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
        "category"
      ]
    },
    "examples": [
      {
        "userGoal": "Expand one stacked category to compare its internal composition without stacked baselines.",
        "params": {
          "category": "East China"
        }
      }
    ]
  },
  {
    "name": "bar.toggleStackMode",
    "description": "Switch a grouped/stacked bar chart between grouped and stacked display modes.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "mode": {
          "type": "string",
          "enum": [
            "grouped",
            "stacked"
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
        "mode"
      ]
    },
    "examples": [
      {
        "userGoal": "Switch the current stacked bar chart into grouped mode for easier cross-category comparison.",
        "params": {
          "mode": "grouped"
        }
      }
    ]
  }
]

function rootEncoding(spec) {
  return spec?.layer?.[0]?.encoding || spec?.encoding || {}
}

function barCapabilities(spec) {
  const encoding = rootEncoding(spec)
  const xField = encoding?.x?.field || null
  const yField = encoding?.y?.field || null
  const xType = encoding?.x?.type || null
  const yType = encoding?.y?.type || null
  const xIsCategory = (xType === 'nominal' || xType === 'ordinal') && !encoding?.x?.bin
  const yIsCategory = (yType === 'nominal' || yType === 'ordinal') && !encoding?.y?.bin
  const categoryField = xIsCategory && xField
    ? xField
    : (yIsCategory && yField ? yField : null)
  const subcategoryField = encoding?.xOffset?.field || encoding?.color?.field || null
  const colorField = encoding?.color?.field || null
  return {
    hasCategoryField: Boolean(categoryField),
    hasSubcategoryField: Boolean(categoryField && subcategoryField),
    hasColorField: Boolean(colorField),
  }
}

function filterDescriptorsBySpec(descriptors, widgetSpec) {
  if (!widgetSpec) return descriptors
  const { hasCategoryField, hasSubcategoryField, hasColorField } = barCapabilities(widgetSpec)
  return descriptors.filter((descriptor) => {
    if (!descriptor?.name) return true
    if ([
      'bar.clickCategory',
      'bar.selectCategory',
      'bar.sortBars',
      'bar.highlightTopN',
      'bar.filterCategories',
      'bar.addBars',
      'bar.removeBars',
    ].includes(descriptor.name)) return hasCategoryField
    if ([
      'bar.addBarItems',
      'bar.removeBarItems',
      'bar.filterSubcategories',
    ].includes(descriptor.name)) return hasSubcategoryField
    if (descriptor.name === 'bar.expandStack' || descriptor.name === 'bar.toggleStackMode') {
      return hasCategoryField && hasColorField
    }
    return true
  })
}

export function buildBarActionDescriptors({ widgetSpec = null } = {}) {
  return filterDescriptorsBySpec(DESCRIPTORS, widgetSpec).map(clone)
}
