import {
  describeActionCallSchema,
  describeActionDescriptorSchema,
} from '../core/protocol/actions.js'
import { describePerceptionDescriptorSchema } from '../core/protocol/perception.js'
import { describeVerifiedActionResultSchema } from '../core/protocol/agentLoop.js'
import {
  describeActionResultSchema,
  describePerceptionResultSchema,
} from '../core/protocol/results.js'

export const SINGLE_WIDGET_AGENT_CONTRACT_VERSION = 'widgetva.single-widget.agent.v1'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function uniqueNames(names = []) {
  return [...new Set((Array.isArray(names) ? names : []).filter((name) => typeof name === 'string' && name.length > 0))]
}

export function makeSingleWidgetAgentContract(contract = {}) {
  const catalog = contract?.catalog && typeof contract.catalog === 'object' ? contract.catalog : {}
  const actionDescriptors = Array.isArray(catalog.actionDescriptors) ? catalog.actionDescriptors : []
  const perceptionDescriptors = Array.isArray(catalog.perceptionDescriptors) ? catalog.perceptionDescriptors : []

  const availableActionNames = uniqueNames(
    Array.isArray(catalog.availableActionNames)
      ? catalog.availableActionNames
      : actionDescriptors.map((descriptor) => descriptor?.name),
  )
  const availablePerceptionNames = uniqueNames(
    Array.isArray(catalog.availablePerceptionNames)
      ? catalog.availablePerceptionNames
      : perceptionDescriptors.map((descriptor) => descriptor?.name),
  )

  return {
    version: SINGLE_WIDGET_AGENT_CONTRACT_VERSION,
    widget: {
      ref: null,
      widgetId: null,
      kind: null,
      title: null,
      role: null,
      ...(contract?.widget || {}),
    },
    observe: {
      observationMethodName: 'readObservation',
      stateMethodName: 'readState',
      verificationStateMethodName: 'readVerificationState',
      perceptionMethodName: 'queryPerception',
      ...(contract?.observe || {}),
    },
    act: {
      actionMethodName: 'executeAction',
      verifiedActionMethodName: 'executeVerifiedAction',
      ...(contract?.act || {}),
    },
    verify: {
      verifyQueryName: 'perception.verifyActionEffect',
      verificationStateMethodName: 'readVerificationState',
      verificationContract: null,
      ...(contract?.verify || {}),
    },
    catalog: {
      actionDescriptors: clone(actionDescriptors),
      perceptionDescriptors: clone(perceptionDescriptors),
      availableActionNames,
      availablePerceptionNames,
    },
    schemas: {
      actionCall: describeActionCallSchema(),
      actionResult: describeActionResultSchema(),
      verifiedActionResult: describeVerifiedActionResultSchema(),
      perceptionResult: describePerceptionResultSchema(),
      actionDescriptor: describeActionDescriptorSchema(),
      perceptionDescriptor: describePerceptionDescriptorSchema(),
      ...(contract?.schemas || {}),
    },
  }
}

export function describeSingleWidgetAgentContractSchema() {
  return clone({
    type: 'object',
    required: ['version', 'widget', 'observe', 'act', 'verify', 'catalog', 'schemas'],
    properties: {
      version: { type: 'string' },
      widget: {
        type: 'object',
        required: ['ref', 'widgetId', 'kind', 'title', 'role'],
        properties: {
          ref: { type: ['string', 'null'] },
          widgetId: { type: ['string', 'null'] },
          kind: { type: ['string', 'null'] },
          title: { type: ['string', 'null'] },
          role: { type: ['string', 'null'] },
        },
      },
      observe: {
        type: 'object',
        required: ['observationMethodName', 'stateMethodName', 'verificationStateMethodName', 'perceptionMethodName'],
        properties: {
          observationMethodName: { type: 'string' },
          stateMethodName: { type: 'string' },
          verificationStateMethodName: { type: 'string' },
          perceptionMethodName: { type: 'string' },
        },
      },
      act: {
        type: 'object',
        required: ['actionMethodName', 'verifiedActionMethodName'],
        properties: {
          actionMethodName: { type: 'string' },
          verifiedActionMethodName: { type: 'string' },
        },
      },
      verify: {
        type: 'object',
        required: ['verifyQueryName', 'verificationStateMethodName', 'verificationContract'],
        properties: {
          verifyQueryName: { type: 'string' },
          verificationStateMethodName: { type: 'string' },
          verificationContract: {
            anyOf: [
              { type: 'null' },
              { type: 'object', additionalProperties: true },
            ],
          },
        },
      },
      catalog: {
        type: 'object',
        required: ['actionDescriptors', 'perceptionDescriptors', 'availableActionNames', 'availablePerceptionNames'],
        properties: {
          actionDescriptors: {
            type: 'array',
            items: describeActionDescriptorSchema(),
          },
          perceptionDescriptors: {
            type: 'array',
            items: describePerceptionDescriptorSchema(),
          },
          availableActionNames: {
            type: 'array',
            items: { type: 'string' },
          },
          availablePerceptionNames: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
      schemas: {
        type: 'object',
        required: ['actionCall', 'actionResult', 'verifiedActionResult', 'perceptionResult', 'actionDescriptor', 'perceptionDescriptor'],
        properties: {
          actionCall: { type: 'object' },
          actionResult: { type: 'object' },
          verifiedActionResult: { type: 'object' },
          perceptionResult: { type: 'object' },
          actionDescriptor: { type: 'object' },
          perceptionDescriptor: { type: 'object' },
        },
      },
    },
  })
}

export function describeSingleWidgetAgentContractFromWidget(widget) {
  if (!widget || typeof widget.readObservation !== 'function') {
    throw new Error('describeSingleWidgetAgentContractFromWidget requires a widget with readObservation().')
  }

  const observation = widget.readObservation() || {}
  const verificationState = typeof widget.readVerificationState === 'function'
    ? widget.readVerificationState()
    : null

  return makeSingleWidgetAgentContract({
    widget: {
      ref: observation?.widgetRef || null,
      widgetId: observation?.widgetId || null,
      kind: observation?.kind || null,
      title: observation?.title || null,
      role: observation?.role || null,
    },
    verify: {
      verificationContract: clone(verificationState?.contract || observation?.verification?.contract || null),
    },
    catalog: {
      actionDescriptors: clone(observation?.actionDescriptors || []),
      perceptionDescriptors: clone(observation?.perceptionDescriptors || []),
      availableActionNames: clone(observation?.actionNames || []),
      availablePerceptionNames: clone(observation?.perceptionNames || []),
    },
  })
}
