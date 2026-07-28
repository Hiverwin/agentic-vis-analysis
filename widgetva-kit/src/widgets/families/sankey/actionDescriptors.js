const DESCRIPTORS = [
  {
    "name": "sankey.focusFlow",
    "description": "Focus one or more flow categories or nodes in the current Sankey view.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "field": {
          "type": "string"
        },
        "values": {
          "type": "array",
          "items": {},
          "minItems": 1
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
        "userGoal": "Focus a subset of flows before investigating bottlenecks.",
        "params": {
          "field": "source",
          "values": [
            "A"
          ]
        }
      }
    ]
  },
  {
    "name": "sankey.selectAggregateNode",
    "description": "Select one collapsed aggregate node by aggregate name so downstream context can focus that temporary group even when it does not map to row-level predicates.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "aggregateName": {
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
        "aggregateName"
      ]
    },
    "examples": [
      {
        "userGoal": "Hold one collapsed aggregate group as the current focus before deciding whether to re-expand it.",
        "params": {
          "aggregateName": "collapsed:1:other"
        }
      }
    ]
  },
  {
    "name": "sankey.filterFlow",
    "description": "Keep only links at or above a minimum flow value, preferably by updating the Sankey threshold signal when one exists.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "minValue": {
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
        "minValue"
      ]
    },
    "examples": [
      {
        "userGoal": "Hide tiny flows so the main pathways stand out more clearly.",
        "params": {
          "minValue": 20
        }
      }
    ]
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
          "items": {
            "type": "string"
          }
        },
        "aggregateName": {
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
        "nodes"
      ]
    },
    "examples": [
      {
        "userGoal": "Merge several low-signal source nodes into one aggregate before comparing downstream flow structure.",
        "params": {
          "nodes": [
            "A",
            "B"
          ],
          "aggregateName": "Other Sources"
        }
      }
    ]
  },
  {
    "name": "sankey.expandNode",
    "description": "Restore the original nodes and links for one previously collapsed aggregate node using the saved Sankey structural state.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "aggregateName": {
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
        "aggregateName"
      ]
    },
    "examples": [
      {
        "userGoal": "Re-expand one aggregate group after an earlier structural simplification pass.",
        "params": {
          "aggregateName": "Other Sources"
        }
      }
    ]
  },
  {
    "name": "sankey.highlightPath",
    "description": "Visually emphasize a multi-step path by increasing opacity for edges and nodes on the path and dimming unrelated structure.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "path": {
          "oneOf": [
            {
              "type": "string"
            },
            {
              "type": "array",
              "minItems": 2,
              "items": {
                "type": "string"
              }
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
        "path"
      ]
    },
    "examples": [
      {
        "userGoal": "Trace one conversion route through the Sankey graph while dimming everything else.",
        "params": {
          "path": [
            "A",
            "B",
            "C"
          ]
        }
      }
    ]
  },
  {
    "name": "sankey.traceNode",
    "description": "Highlight all edges directly connected to one node and visually emphasize that node while dimming unrelated structure.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "nodeName": {
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
        "nodeName"
      ]
    },
    "examples": [
      {
        "userGoal": "Trace all direct inflows and outflows for one node before deciding whether to collapse or reorder the layer.",
        "params": {
          "nodeName": "Checkout"
        }
      }
    ]
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
          "items": {
            "type": "string"
          }
        },
        "color": {
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
        "nodes"
      ]
    },
    "examples": [
      {
        "userGoal": "Color all flows touching one or more nodes before presenting a focused Sankey story.",
        "params": {
          "nodes": [
            "Checkout"
          ],
          "color": "#e74c3c"
        }
      }
    ]
  },
  {
    "name": "sankey.reorderNodesInLayer",
    "description": "Rewrite node order values for one Sankey depth layer using an explicit top-to-bottom node order.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "depth": {
          "type": "number"
        },
        "order": {
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
        "depth",
        "order"
      ]
    },
    "examples": [
      {
        "userGoal": "Reorder one Sankey layer to make important nodes appear first from top to bottom.",
        "params": {
          "depth": 0,
          "order": [
            "C",
            "A",
            "B"
          ]
        }
      }
    ]
  },
  {
    "name": "sankey.autoCollapseByRank",
    "description": "Keep only the top-N nodes per Sankey layer by flow volume and collapse the remainder into layer-specific aggregate nodes.",
    "paramsSchema": {
      "type": "object",
      "properties": {
        "topN": {
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
        "topN"
      ]
    },
    "examples": [
      {
        "userGoal": "Simplify a large Sankey by keeping only the most important nodes in each layer.",
        "params": {
          "topN": 2
        }
      }
    ]
  }
]

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function findNamedDataSource(spec, name) {
  const data = Array.isArray(spec?.data) ? spec.data : []
  const index = data.findIndex((entry) => entry && typeof entry === 'object' && entry.name === name)
  return { index, values: index >= 0 && Array.isArray(data[index]?.values) ? data[index].values : null }
}

function findNamedMark(spec, name) {
  const marks = Array.isArray(spec?.marks) ? spec.marks : []
  for (const mark of marks) {
    if (mark?.name === name) return mark
    if (mark?.type === 'group' && Array.isArray(mark.marks)) {
      const nested = mark.marks.find((entry) => entry?.name === name)
      if (nested) return nested
    }
  }
  return null
}

function sankeyCapabilities(spec) {
  const rawLinksSource = findNamedDataSource(spec, 'rawLinks')
  const linksSource = findNamedDataSource(spec, 'links')
  const nodesSource = findNamedDataSource(spec, 'nodes')
  const nodeConfigSource = findNamedDataSource(spec, 'nodeConfig')
  const collapsedGroups = spec?._sankey_state?.collapsed_groups
  return {
    hasVegaShape: Array.isArray(spec?.data) || Array.isArray(spec?.marks),
    hasRawLinks: rawLinksSource.index >= 0 && Array.isArray(rawLinksSource.values),
    hasLinks: linksSource.index >= 0 && Array.isArray(linksSource.values),
    hasNodes: nodesSource.index >= 0 && Array.isArray(nodesSource.values),
    hasNodeConfig: nodeConfigSource.index >= 0 && Array.isArray(nodeConfigSource.values),
    hasCollapsedGroups: collapsedGroups != null && typeof collapsedGroups === 'object' && !Array.isArray(collapsedGroups) && Object.keys(collapsedGroups).length > 0,
    hasEdgeMark: Boolean(findNamedMark(spec, 'edgeMark')),
  }
}

function filterDescriptorsBySpec(descriptors, widgetSpec) {
  if (!widgetSpec) return descriptors
  const { hasVegaShape, hasRawLinks, hasLinks, hasNodes, hasNodeConfig, hasCollapsedGroups, hasEdgeMark } = sankeyCapabilities(widgetSpec)
  if (!hasVegaShape) return descriptors
  return descriptors.filter((descriptor) => {
    if (!descriptor?.name) return true
    if (descriptor.name === 'sankey.expandNode') return hasCollapsedGroups
    if (descriptor.name === 'sankey.colorFlows') return hasEdgeMark || hasLinks || hasRawLinks
    if (descriptor.name === 'sankey.reorderNodesInLayer' || descriptor.name === 'sankey.autoCollapseByRank') {
      return (hasRawLinks || hasLinks) && (hasNodeConfig || hasNodes)
    }
    if (descriptor.name === 'sankey.filterFlow' || descriptor.name === 'sankey.collapseNodes' || descriptor.name === 'sankey.traceNode') return hasRawLinks || hasLinks
    return true
  })
}

export function buildSankeyActionDescriptors({ widgetSpec = null } = {}) {
  return filterDescriptorsBySpec(DESCRIPTORS, widgetSpec).map(clone)
}
